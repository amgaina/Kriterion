'use client';

import { usePathname } from 'next/navigation';
import RoleDashboardLayout, { CalendarEvent } from '@/components/layouts/RoleDashboardLayout';
import apiClient from '@/lib/api-client';

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isGradingPage = pathname?.includes('/grade/') === true;

    return (
        <RoleDashboardLayout
            allowedRoles={['FACULTY']}
            eventsQuery={{
                queryKey: ['faculty-upcoming-events'],
                queryFn: () => apiClient.getFacultyUpcomingEvents(),
            }}
            getEventHref={(event: CalendarEvent) => {
                if (event.event_type === 'course_start' || event.event_type === 'course_end')
                    return `/faculty/courses/${event.id}`;
                return `/faculty/assignments/${event.id}`;
            }}
            hideCalendarSidebar={isGradingPage}
        >
            {children}
        </RoleDashboardLayout>
    );
}
