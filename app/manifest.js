/** Web app manifest — brand name / colours when the POS is installed to a home screen. */
export default function manifest() {
  return {
    name: 'Kathmandu Momo',
    short_name: 'KM',
    description:
      'Kathmandu Momo — momo, Nepali kitchen and café in Birendranagar, Surkhet.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0E0C0A',
    theme_color: '#0E0C0A',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
  };
}
