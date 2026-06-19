import { db } from '@/db';
import { galleries, posts, images, likes, user as userTable } from '@/db/schema';
import { eq, desc, inArray, count, and } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { verifyGalleryAccess, galleryCookieName } from '@/lib/gallery-auth';
import { isEntitled } from '@/lib/entitlements';
import { auth } from '@/lib/auth';
import { ShareButtons } from '@/components/ShareButtons';
import { LikeButton } from '@/components/LikeButton';
import { UploadComposer } from '@/components/UploadComposer';
import { DeletePostButton } from '@/components/DeletePostButton';
import { PostCarousel } from '@/components/PostCarousel';
import { EditMessageButton } from '@/components/EditMessageButton';
import { GalleryLightbox, type LightboxImage } from '@/components/GalleryLightbox';
import { UnlockForm } from './UnlockForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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
      passwordHash: galleries.passwordHash,
      uploadsClosedAt: galleries.uploadsClosedAt,
      ownerId: galleries.ownerId,
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
  const uploadsClosed = !!(gallery.uploadsClosedAt && gallery.uploadsClosedAt <= new Date());

  // load posts with their media
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
    .innerJoin(images, eq(images.postId, posts.id))
    .where(eq(posts.galleryId, gallery.id))
    .orderBy(desc(posts.createdAt));

  // group media under their post
  const byPost = new Map<
    string,
    {
      postId: string;
      guestName: string | null;
      message: string | null;
      images: { publicId: string; mimeType: string }[];
    }
  >();
  for (const r of rows) {
    if (!byPost.has(r.postId))
      byPost.set(r.postId, { postId: r.postId, guestName: r.guestName, message: r.message, images: [] });
    byPost.get(r.postId)!.images.push({ publicId: r.publicId, mimeType: r.mimeType });
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
      <header className="masthead">
        <p className="masthead__eyebrow">A shared album</p>
        <h1 className="masthead__title">{gallery.title}</h1>
        <p className="masthead__sub">Every guest's view of the day, in one place.</p>
      </header>

      <UploadComposer slug={slug} uploadsClosed={uploadsClosed} />

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
                  <div className="post__actions">
                    <LikeButton
                      postId={post.postId}
                      initialCount={likeCounts.get(post.postId) ?? 0}
                      initialLiked={guestLikedSet.has(post.postId)}
                    />
                    <ShareButtons publicId={post.images[0].publicId} />
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
