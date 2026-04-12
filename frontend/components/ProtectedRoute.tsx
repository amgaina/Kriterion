'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

// Redirect helper function
const getDashboardPath = (role: UserRole): string => {
    switch (role) {
        case 'STUDENT':
            return '/student/dashboard';
        case 'FACULTY':
            return '/faculty/dashboard';
        case 'ASSISTANT':
            return '/assistant/dashboard';
        case 'ADMIN':
            return '/admin/dashboard';
        default:
            return '/login';
    }
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (isLoading) return;

        // Not authenticated - redirect to login with return URL
        if (!isAuthenticated) {
            const returnUrl = encodeURIComponent(pathname);
            router.replace(`/login?returnUrl=${returnUrl}`);
            return;
        }

        // Check role authorization
        if (allowedRoles && user) {
            if (!allowedRoles.includes(user.role)) {
                // Unauthorized role - redirect to their dashboard
                router.replace(getDashboardPath(user.role));
                return;
            }
        }

        // Authorized
        setIsAuthorized(true);
    }, [isLoading, isAuthenticated, user, allowedRoles, router, pathname]);

    // Show loading while checking auth
    if (isLoading) {
        return <LoadingSpinner />;
    }

    // Not authenticated or not authorized - show nothing while redirecting
    if (!isAuthenticated || !isAuthorized) {
        return <LoadingSpinner />;
    }

    return <>{children}</>;
}

// Higher-order component for page-level protection
export function withAuth<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    allowedRoles?: UserRole[]
) {
    return function AuthenticatedComponent(props: P) {
        return (
            <ProtectedRoute allowedRoles={allowedRoles}>
                <WrappedComponent {...props} />
            </ProtectedRoute>
        );
    };
}
