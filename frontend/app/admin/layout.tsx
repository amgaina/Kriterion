'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardLayout>{children}</DashboardLayout>
        </ProtectedRoute>
    );
}
