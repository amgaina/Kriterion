'use client';

import RoleDashboardLayout, { CalendarEvent } from '@/components/layouts/RoleDashboardLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleDashboardLayout
            allowedRoles={['ADMIN']}
            eventsQuery={{
                queryKey: ['admin-upcoming-events'],
                queryFn: async () => [] as CalendarEvent[],
            }}
            getEventHref={() => '#'}
        >
            {children}
        </RoleDashboardLayout>
    );
}
