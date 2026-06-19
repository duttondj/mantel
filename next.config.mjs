/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone build = small Docker image, only ships what's needed to run
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '150mb',
    },
    // raises the default 10MB cap on request bodies readable by route handlers
    middlewareClientMaxBodySize: '150mb',
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
};

export default nextConfig;
