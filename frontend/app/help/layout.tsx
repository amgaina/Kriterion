'use client';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <DashboardLayout hideTopNav={false}>
                {children}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
