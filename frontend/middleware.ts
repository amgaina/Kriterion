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

function safeRedirect(baseUrl: string, path: string): NextResponse {
  try {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }
}

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const baseUrl = request.url;

    // Skip public assets and non-protected pages
    if (isPublicPath(pathname) && pathname !== '/login') {
      return NextResponse.next();
    }

    const isAuthenticated = request.cookies.get('kriterion_auth')?.value === '1';
    const role = (request.cookies.get('kriterion_role')?.value || '').trim();

    // Authenticated user hitting /login → redirect to their dashboard
    if (pathname === '/login' && isAuthenticated && role) {
      const home = ROLE_HOME[role];
      if (home) return safeRedirect(baseUrl, home);
    }

    // Not a protected route → allow
    if (!isProtectedPath(pathname)) {
      return NextResponse.next();
    }

    // Unauthenticated user hitting a protected route → login
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', baseUrl);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Authenticated - enforce role boundaries
    const allowedPrefix = ROLE_PREFIX[role];
    if (!allowedPrefix || !pathname.startsWith(allowedPrefix)) {
      const home = ROLE_HOME[role] || '/login';
      return safeRedirect(baseUrl, home);
    }

    return NextResponse.next();
  } catch {
    // Fallback: allow request to proceed rather than return 500
    return NextResponse.next();
  }
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
