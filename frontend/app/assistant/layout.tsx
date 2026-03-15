'use client';

import { usePathname } from 'next/navigation';
import RoleDashboardLayout, { CalendarEvent } from '@/components/layouts/RoleDashboardLayout';

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isGradingPage = pathname?.includes('/grade/') === true;

    return (
        <RoleDashboardLayout
            allowedRoles={['ASSISTANT']}
            eventsQuery={{
                queryKey: ['assistant-upcoming-events'],
                queryFn: async () => [] as CalendarEvent[],
            }}
            getEventHref={() => '#'}
            hideCalendarSidebar={isGradingPage}
        >
            {children}
        </RoleDashboardLayout>
    );
}
