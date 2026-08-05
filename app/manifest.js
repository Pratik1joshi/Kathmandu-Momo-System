/** Web app manifest — brand name / colours when the POS is installed to a home screen. */
export default function manifest() {
  return {
    name: 'Kathmandu Momo',
    short_name: 'Kathmandu Momo',
    description:
      'Kathmandu Momo — momo, Nepali kitchen and café in Birendranagar, Surkhet.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#e30613',
    icons: [
      { src: '/icon-192.png?v=2083', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png?v=2083', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png?v=2083', sizes: '180x180', type: 'image/png' },
    ],
  };
}
