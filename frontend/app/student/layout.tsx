'use client';

import { usePathname } from 'next/navigation';
import RoleDashboardLayout, { CalendarEvent } from '@/components/layouts/RoleDashboardLayout';
import apiClient from '@/lib/api-client';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAssignmentWorkspace = pathname?.startsWith('/student/assignments/') === true && pathname !== '/student/assignments';

    return (
        <RoleDashboardLayout
            allowedRoles={['STUDENT']}
            eventsQuery={{
                queryKey: ['student-upcoming-events'],
                queryFn: () => apiClient.getStudentUpcomingEvents(),
            }}
            getEventHref={(event: CalendarEvent) => `/student/assignments/${event.id}`}
            hideCalendarSidebar={isAssignmentWorkspace}
        >
            {children}
        </RoleDashboardLayout>
    );
}
