/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  async rewrites() {
    return [
      // Static Kathmandu Momo landing (public/kathmandu-momo.html).
      { source: '/', destination: '/kathmandu-momo.html' },
      // Uploaded images (UPLOADS_DIR) via media route — /uploads/menu/*.jpg in prod.
      {
        source: '/uploads/:path*',
        destination: '/api/media/:path*',
      },
    ];
  },
};

export default nextConfig;
