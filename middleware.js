import { NextResponse } from 'next/server';

/**
 * Security headers + landing rewrite.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  let response;
  if (pathname === '/') {
    response = NextResponse.rewrite(new URL('/kathmandu-momo.html', request.url));
  } else {
    response = NextResponse.next();
  }

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '0');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // Allow landing page images, fonts, Google Maps, and Vercel Live feedback script / analytics
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self' https://vercel.live https://*.vercel.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.com https://*.vercel-insights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live https://*.vercel.com",
      "img-src 'self' data: blob: https: https://vercel.live https://*.vercel.com",
      "font-src 'self' data: https://fonts.gstatic.com https://vercel.live https://*.vercel.com",
      "connect-src 'self' https://vercel.live https://*.vercel.com https://*.vercel-insights.com https://vitals.vercel-insights.com wss://*.vercel.com",
      "frame-src 'self' https://www.google.com https://maps.google.com https://*.google.com https://vercel.live https://*.vercel.com",
      "frame-ancestors 'self' https://vercel.live https://*.vercel.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
