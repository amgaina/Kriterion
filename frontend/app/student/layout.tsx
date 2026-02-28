'use client';

import RoleDashboardLayout, { CalendarEvent } from '@/components/layouts/RoleDashboardLayout';
import apiClient from '@/lib/api-client';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleDashboardLayout
            allowedRoles={['STUDENT']}
            eventsQuery={{
                queryKey: ['student-upcoming-events'],
                queryFn: () => apiClient.getStudentUpcomingEvents(),
            }}
            getEventHref={(event: CalendarEvent) => `/student/assignments/${event.id}`}
        >
            {children}
        </RoleDashboardLayout>
    );
}
