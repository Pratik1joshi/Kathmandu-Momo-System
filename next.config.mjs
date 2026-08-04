/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  async rewrites() {
    return [
      // Landing page: Kathmandu Momo marketing site at /
      {
        source: '/',
        destination: '/kathmandu-momo.html',
      },
      // Serve uploaded images (stored in UPLOADS_DIR, outside /public) through
      // the media route. Without this, /uploads/menu/*.jpg 404s in production.
      {
        source: '/uploads/:path*',
        destination: '/api/media/:path*',
      },
    ];
  },
};

export default nextConfig;
