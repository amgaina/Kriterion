'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { format, isSameDay, parseISO } from 'date-fns';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
    CalendarDays,
    Clock,
    FileText,
    ChevronRight,
    AlertTriangle,
    CheckCircle,
    PanelRightClose,
    PanelRightOpen,
    X,
    BookOpen,
    GraduationCap,
} from 'lucide-react';

/** Generic calendar event shape - roles map their data to this */
export interface CalendarEvent {
    id: number;
    title: string;
    date: string;
    event_type: string;
    course_code?: string;
    course_name?: string;
    detail?: string;
}

export interface RoleDashboardLayoutProps {
    children: React.ReactNode;
    allowedRoles: string[];
    /** Query to fetch events. Required - pass { queryFn: () => [] } for roles with no events. */
    eventsQuery: Pick<UseQueryOptions<CalendarEvent[]>, 'queryKey' | 'queryFn'> & {
        staleTime?: number;
    };
    /** Build href for an event. Required. */
    getEventHref: (event: CalendarEvent) => string;
}

export default function RoleDashboardLayout({
    children,
    allowedRoles,
    eventsQuery,
    getEventHref,
}: RoleDashboardLayoutProps) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(true);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    const { data: events = [] } = useQuery<CalendarEvent[]>({
        ...eventsQuery,
        staleTime: eventsQuery.staleTime ?? 5 * 60_000,
        refetchOnWindowFocus: false,
    });

    const highlightDates = useMemo(() => events.map((e) => e.date), [events]);

    const calendarEvents = useMemo(
        () =>
            events.map((e) => ({
                date: e.date.slice(0, 10),
                event_type: e.event_type,
            })),
        [events],
    );

    const filteredEvents = useMemo(() => {
        if (selectedDate) {
            return events.filter((e) => {
                try {
                    return isSameDay(parseISO(e.date), selectedDate);
                } catch {
                    return false;
                }
            });
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        return events.filter((e) => e.date >= todayStr).slice(0, 8);
    }, [events, selectedDate]);

    return (
        <ProtectedRoute allowedRoles={allowedRoles}>
            <DashboardLayout>
                <div className="flex gap-5 h-full min-h-0">
                    {/* Main content */}
                    <div className="flex-1 min-w-0 overflow-y-auto">
                        {children}
                    </div>

                    {/* Desktop: reopen button when calendar is collapsed */}
                    {!calendarOpen && (
                        <button
                            onClick={() => setCalendarOpen(true)}
                            className="hidden lg:flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-primary hover:border-primary/30 transition-colors self-start mt-1"
                            title="Show calendar"
                        >
                            <PanelRightOpen className="w-4 h-4" />
                        </button>
                    )}

                    {/* Desktop: calendar sidebar */}
                    <aside
                        className={`
                            ${calendarOpen ? 'w-72 xl:w-80' : 'w-0 overflow-hidden'}
                            hidden lg:block flex-shrink-0 transition-all duration-300
                        `}
                    >
                        <div className="h-full space-y-3 flex flex-col">
                            <div className="flex justify-end flex-shrink-0">
                                <button
                                    onClick={() => setCalendarOpen(false)}
                                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                    title="Hide calendar"
                                >
                                    <PanelRightClose className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex-shrink-0">
                                <DashboardCalendar
                                    highlightDates={highlightDates}
                                    events={calendarEvents}
                                    selectedDate={selectedDate}
                                    onSelectDate={setSelectedDate}
                                />
                            </div>

                            <EventsList
                                events={filteredEvents}
                                selectedDate={selectedDate}
                                getEventHref={getEventHref}
                            />
                        </div>
                    </aside>

                    {/* Mobile: floating calendar button */}
                    <button
                        onClick={() => setMobileDrawerOpen(true)}
                        className="fixed bottom-6 right-6 z-40 lg:hidden p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary-700 transition-colors"
                        aria-label="Open calendar"
                    >
                        <CalendarDays className="w-5 h-5" />
                    </button>

                    {/* Mobile: calendar drawer */}
                    {mobileDrawerOpen && (
                        <div className="lg:hidden fixed inset-0 z-50">
                            <div
                                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                                onClick={() => setMobileDrawerOpen(false)}
                            />
                            <div className="absolute right-0 top-0 bottom-0 w-[min(320px,85vw)] bg-white shadow-2xl flex flex-col">
                                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-primary" /> Calendar
                                    </h3>
                                    <button
                                        onClick={() => setMobileDrawerOpen(false)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <DashboardCalendar
                                        highlightDates={highlightDates}
                                        events={calendarEvents}
                                        selectedDate={selectedDate}
                                        onSelectDate={setSelectedDate}
                                    />
                                    <div className="space-y-1.5">
                                        <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-primary" />
                                            {selectedDate
                                                ? `Events · ${format(selectedDate, 'MMM d')}`
                                                : 'Upcoming'}
                                        </h4>
                                        {filteredEvents.length === 0 ? (
                                            <p className="text-[11px] text-gray-400 text-center py-3">No events</p>
                                        ) : (
                                            filteredEvents.map((event) => (
                                                <Link
                                                    key={`mob-${event.id}-${event.event_type}`}
                                                    href={getEventHref(event)}
                                                    onClick={() => setMobileDrawerOpen(false)}
                                                    className="block p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    <p className="text-xs font-medium text-gray-900 truncate">{event.title}</p>
                                                    <p className="text-[11px] text-gray-400">
                                                        {event.course_code || ''} · {format(parseISO(event.date), 'MMM d')}
                                                    </p>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

function eventStyle(event: CalendarEvent) {
    const isPast = new Date(event.date + 'T23:59:59') < new Date();
    const t = event.event_type;
    if (t === 'course_start') return { bg: 'bg-blue-50 text-blue-600', Icon: BookOpen };
    if (t === 'course_end') return { bg: isPast ? 'bg-gray-100 text-gray-500' : 'bg-purple-50 text-purple-600', Icon: GraduationCap };
    if (isPast) return { bg: 'bg-amber-50 text-amber-600', Icon: AlertTriangle };
    if (t === 'deadline') return { bg: 'bg-red-50 text-red-500', Icon: FileText };
    return { bg: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle };
}

function EventsList({
    events,
    selectedDate,
    getEventHref,
}: {
    events: CalendarEvent[];
    selectedDate: Date | null;
    getEventHref: (event: CalendarEvent) => string;
}) {
    return (
        <Card className="border-0 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 px-4 pt-3 flex-shrink-0">
                <CardTitle className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {selectedDate ? `Events · ${format(selectedDate, 'MMM d')}` : 'Upcoming'}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 flex-1 overflow-y-auto">
                {events.length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-3">
                        {selectedDate ? 'No events on this date' : 'No upcoming events'}
                    </p>
                ) : (
                    <div className="space-y-1">
                        {events.map((event) => {
                            const { bg, Icon } = eventStyle(event);
                            return (
                                <Link
                                    key={`${event.id}-${event.event_type}`}
                                    href={getEventHref(event)}
                                    className="block group"
                                >
                                    <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                        <div className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${bg}`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                {event.title}
                                            </p>
                                            <p className="text-[10px] text-gray-400 truncate">
                                                {event.course_code ? `${event.course_code} · ` : ''}{format(parseISO(event.date), 'MMM d')}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
