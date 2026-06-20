import { db } from '@/db';
import { galleries, posts, images, likes, user as userTable } from '@/db/schema';
import { eq, desc, inArray, count, and, sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { verifyGalleryAccess, galleryCookieName } from '@/lib/gallery-auth';
import { isEntitled } from '@/lib/entitlements';
import { auth } from '@/lib/auth';
import { LikeButton } from '@/components/LikeButton';
import { UploadComposer } from '@/components/UploadComposer';
import { DeletePostButton } from '@/components/DeletePostButton';
import { PostCarousel } from '@/components/PostCarousel';
import { EditMessageButton } from '@/components/EditMessageButton';
import { GalleryLightbox, type LightboxImage } from '@/components/GalleryLightbox';
import { EditDescriptionInline } from '@/components/EditDescriptionInline';
import { UnlockForm } from './UnlockForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

function formatPostTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [gallery] = await db
    .select({ title: galleries.title, passwordHash: galleries.passwordHash })
    .from(galleries)
    .where(eq(galleries.slug, slug));

  if (!gallery) return {};

  const meta: Metadata = {
    title: `${gallery.title} · Mantel`,
    openGraph: {
      title: gallery.title,
      description: 'A shared album — add your photos and memories.',
      type: 'website',
    },
  };

  // OG image only for open galleries — scrapers can't get past the lock
  if (!gallery.passwordHash) {
    const [firstImg] = await db
      .select({ publicId: images.publicId })
      .from(images)
      .innerJoin(posts, eq(images.postId, posts.id))
      .innerJoin(galleries, eq(posts.galleryId, galleries.id))
      .where(and(eq(galleries.slug, slug), sql`${images.mimeType} like 'image/%'`))
      .orderBy(desc(images.createdAt))
      .limit(1);
    if (firstImg) {
      const appUrl = process.env.APP_URL || 'http://localhost:13000';
      meta.openGraph!.images = [`${appUrl}/i/${firstImg.publicId}`];
    }
  }

  return meta;
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locked?: string }>;
}) {
  const { slug } = await params;
  await searchParams;

  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      description: galleries.description,
      passwordHash: galleries.passwordHash,
      uploadsClosedAt: galleries.uploadsClosedAt,
      ownerId: galleries.ownerId,
      isDemo: galleries.isDemo,
      ownerStatus: userTable.status,
      ownerExpiresAt: userTable.expiresAt,
    })
    .from(galleries)
    .innerJoin(userTable, eq(galleries.ownerId, userTable.id))
    .where(eq(galleries.slug, slug));

  if (!gallery) notFound();

  if (!isEntitled({ status: gallery.ownerStatus, expiresAt: gallery.ownerExpiresAt })) {
    return (
      <div className="wrap">
        <div className="panel">
          <h2>This gallery has expired</h2>
          <p>The hosting period for this gallery has ended, so its photos are no longer available.</p>
        </div>
      </div>
    );
  }

  // locked? require a valid cookie, else show the password prompt
  if (gallery.passwordHash) {
    const store = await cookies();
    const cookie = store.get(galleryCookieName(gallery.id))?.value;
    if (!verifyGalleryAccess(cookie, gallery.id)) {
      return (
        <div className="wrap">
          <UnlockForm slug={slug} title={gallery.title} />
        </div>
      );
    }
  }

  // Is the current viewer the host who owns this gallery? Only then do we
  // show moderation controls. Guests (no session, or a different account)
  // never see them.
  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = session?.user?.id === gallery.ownerId;

  // fire-and-forget view count — don't slow down page render
  db.update(galleries)
    .set({ viewCount: sql`${galleries.viewCount} + 1` })
    .where(eq(galleries.id, gallery.id))
    .catch(() => {});
  const uploadsClosed = !!(gallery.uploadsClosedAt && gallery.uploadsClosedAt <= new Date());

  // load posts with their media (leftJoin so text-only posts appear)
  const rows = await db
    .select({
      postId: posts.id,
      guestName: posts.guestName,
      message: posts.message,
      createdAt: posts.createdAt,
      publicId: images.publicId,
      mimeType: images.mimeType,
      width: images.width,
      height: images.height,
    })
    .from(posts)
    .leftJoin(images, eq(images.postId, posts.id))
    .where(eq(posts.galleryId, gallery.id))
    .orderBy(desc(posts.createdAt));

  // group media under their post
  const byPost = new Map<
    string,
    {
      postId: string;
      guestName: string | null;
      message: string | null;
      createdAt: Date;
      images: { publicId: string; mimeType: string; width: number | null; height: number | null }[];
    }
  >();
  for (const r of rows) {
    if (!byPost.has(r.postId))
      byPost.set(r.postId, { postId: r.postId, guestName: r.guestName, message: r.message, createdAt: r.createdAt, images: [] });
    // leftJoin: publicId is null for text-only posts
    if (r.publicId)
      byPost.get(r.postId)!.images.push({ publicId: r.publicId, mimeType: r.mimeType!, width: r.width, height: r.height });
  }

  // flat image list for the lightbox, with per-post start indices
  const allLightboxImages: LightboxImage[] = [];
  const startIndexByPost = new Map<string, number>();
  for (const post of byPost.values()) {
    startIndexByPost.set(post.postId, allLightboxImages.length);
    for (const img of post.images) {
      allLightboxImages.push({
        publicId: img.publicId,
        mimeType: img.mimeType,
        guestName: post.guestName,
        message: post.message,
      });
    }
  }

  // like counts and this guest's liked set
  const postIds = [...byPost.keys()];
  const cookieStore = await cookies();
  const guestToken = cookieStore.get('mantel_guest_token')?.value;

  const likeCounts = new Map<string, number>();
  const guestLikedSet = new Set<string>();

  if (postIds.length > 0) {
    const countRows = await db
      .select({ postId: likes.postId, n: count() })
      .from(likes)
      .where(inArray(likes.postId, postIds))
      .groupBy(likes.postId);
    for (const r of countRows) likeCounts.set(r.postId, r.n);

    if (guestToken) {
      const myRows = await db
        .select({ postId: likes.postId })
        .from(likes)
        .where(and(inArray(likes.postId, postIds), eq(likes.guestToken, guestToken)));
      for (const r of myRows) guestLikedSet.add(r.postId);
    }
  }

  return (
    <>
    <div className="wrap">
      {gallery.isDemo && (
        <div className="demo-notice">
          <span>You&rsquo;re viewing a demo gallery.&nbsp;</span>
          <Link href="/signin" className="demo-notice__cta">Create your own &rarr;</Link>
        </div>
      )}

      <header className="masthead">
        <p className="masthead__eyebrow">{gallery.isDemo ? 'Demo gallery' : 'A shared album'}</p>
        <h1 className="masthead__title">{gallery.title}</h1>
        {isOwner && !gallery.isDemo
          ? <EditDescriptionInline galleryId={gallery.id} initialDescription={gallery.description} />
          : gallery.description && <p className="masthead__sub">{gallery.description}</p>
        }
      </header>

      {!gallery.isDemo && <UploadComposer slug={slug} uploadsClosed={uploadsClosed} />}

      {byPost.size === 0 ? (
        <div className="panel">
          <h2>No posts yet</h2>
          <p>Be the first to add a moment from the day.</p>
        </div>
      ) : (
        <GalleryLightbox allImages={allLightboxImages}>
          <div className="wall">
            {[...byPost.values()].map((post) => (
              <article className="post" key={post.postId}>
                <PostCarousel
                  images={post.images}
                  startIndex={startIndexByPost.get(post.postId)}
                />
                <div className="post__body">
                  {isOwner
                    ? <EditMessageButton postId={post.postId} initialMessage={post.message} />
                    : post.message && <p className="post__msg">{post.message}</p>
                  }
                  {post.guestName && <p className="post__byline">{post.guestName}</p>}
                  <p className="post__time">{formatPostTime(post.createdAt)}</p>
                  <div className="post__actions">
                    <LikeButton
                      postId={post.postId}
                      initialCount={likeCounts.get(post.postId) ?? 0}
                      initialLiked={guestLikedSet.has(post.postId)}
                    />
                  </div>
                  {isOwner && <DeletePostButton postId={post.postId} />}
                </div>
              </article>
            ))}
          </div>
        </GalleryLightbox>
      )}
    </div>

      <footer className="site-footer">
        <Link href="/privacy" className="site-footer__link">Privacy policy</Link>
      </footer>
    </>
  );
}
