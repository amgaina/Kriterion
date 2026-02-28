'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute allowedRoles={['ASSISTANT']}>
            <DashboardLayout>
                {children}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
