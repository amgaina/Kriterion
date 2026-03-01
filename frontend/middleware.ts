import { NextRequest, NextResponse } from 'next/server';

/**
 * Strict role-based route protection.
 *
 * Reads `kriterion_auth` and `kriterion_role` cookies set on login.
 *   - STUDENT can only access /student/**
 *   - FACULTY can only access /faculty/**
 *   - ADMIN   can only access /admin/**
 *
 * Unauthenticated users hitting any protected route are sent to /login.
 * Authenticated users hitting /login are redirected to their dashboard.
 */

const ROLE_PREFIX: Record<string, string> = {
  STUDENT: '/student',
  FACULTY: '/faculty',
  ASSISTANT: '/assistant',
  ADMIN: '/admin',
};

const ROLE_HOME: Record<string, string> = {
  STUDENT: '/student/dashboard',
  FACULTY: '/faculty/dashboard',
  ASSISTANT: '/assistant/dashboard',
  ADMIN: '/admin/dashboard',
};

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/forgot-password',
  '/contact',
  '/team',
  '/how-it-works',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Static assets, API routes, Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return true;
  }
  return false;
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/student') ||
    pathname.startsWith('/faculty') ||
    pathname.startsWith('/assistant') ||
    pathname.startsWith('/admin')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public assets and non-protected pages
  if (isPublicPath(pathname) && pathname !== '/login') {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get('kriterion_auth')?.value === '1';
  const role = request.cookies.get('kriterion_role')?.value || '';

  // Authenticated user hitting /login → redirect to their dashboard
  if (pathname === '/login' && isAuthenticated && role && ROLE_HOME[role]) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  // Not a protected route → allow
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Unauthenticated user hitting a protected route → login
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated - enforce role boundaries
  const allowedPrefix = ROLE_PREFIX[role];
  if (!allowedPrefix || !pathname.startsWith(allowedPrefix)) {
    // User is trying to access a route outside their role - redirect home
    const home = ROLE_HOME[role] || '/login';
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next.js internals.
     * This ensures the middleware runs on page navigations.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
