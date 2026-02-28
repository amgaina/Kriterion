'use client';

import RoleDashboardLayout, { CalendarEvent } from '@/components/layouts/RoleDashboardLayout';

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleDashboardLayout
            allowedRoles={['ASSISTANT']}
            eventsQuery={{
                queryKey: ['assistant-upcoming-events'],
                queryFn: async () => [] as CalendarEvent[],
            }}
            getEventHref={() => '#'}
        >
            {children}
        </RoleDashboardLayout>
    );
}
