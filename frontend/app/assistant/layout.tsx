'use client';

import RoleDashboardLayout, { CalendarEvent } from '@/components/layouts/RoleDashboardLayout';
import apiClient from '@/lib/api-client';

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleDashboardLayout
            allowedRoles={['ASSISTANT']}
            eventsQuery={{
                queryKey: ['assistant-upcoming-events'],
                queryFn: async () => apiClient.getAssistantUpcomingEvents() as Promise<CalendarEvent[]>,
            }}
            getEventHref={(event) => {
                if (event.event_type === 'grading' && event.course_id) {
                    return `/assistant/courses/${event.course_id}/assignments/${event.id}`;
                }
                return event.course_id ? `/assistant/courses/${event.course_id}` : '/assistant/dashboard';
            }}
        >
            {children}
        </RoleDashboardLayout>
    );
}
