const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Block the site from being framed (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Don't send the full URL as referer to other origins
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features we never use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // CSP: lock down what can run/load on our pages.
  // script-src needs 'unsafe-inline' because Next.js injects inline hydration scripts.
  // media-src allows https: so presigned cloud-storage URLs work regardless of provider.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob: https:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // standalone build = small Docker image, only ships what's needed to run
  output: 'standalone',
  // Type-checking and linting run separately (`npx tsc --noEmit`), so we skip
  // the duplicate serial passes `next build` would otherwise run on the
  // critical path. Purely a build-speed win — type errors are still caught by
  // the standalone tsc step, just not during the Docker build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '150mb',
    },
    // raises the default 10MB cap on request bodies readable by route handlers
    middlewareClientMaxBodySize: '150mb',
    // run webpack compilation in a worker thread so it doesn't contend with
    // the main build process
    webpackBuildWorker: true,
  },
  // we serve images through our own access-controlled route, so Next's
  // image optimizer isn't in the path for gallery photos
  images: { unoptimized: true },
  // sharp and heic-convert use native/WASM bits that the standalone
  // tracer can't follow through their dynamic requires. Marking them
  // external keeps them as real node_modules at runtime instead of
  // half-bundled. Without this, HEIC uploads crash in the Docker image
  // even though they work in `next dev`.
  serverExternalPackages: ['sharp', 'heic-convert', 'libheif-js'],
  // belt-and-suspenders: explicitly include the WASM payload in the
  // traced output for the upload route that does the decoding.
  outputFileTracingIncludes: {
    '/api/upload': ['./node_modules/libheif-js/**/*'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
