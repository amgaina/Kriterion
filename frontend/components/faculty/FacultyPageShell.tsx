'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay, parseISO } from 'date-fns';
import apiClient from '@/lib/api-client';
import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    CalendarDays,
    Clock,
    FileText,
    ChevronRight,
    AlertTriangle,
    CheckCircle,
    PanelRightClose,
    PanelRightOpen,
} from 'lucide-react';
import Link from 'next/link';

interface FacultyEvent {
    id: number;
    title: string;
    course_name: string;
    course_code: string;
    event_type: string;
    date: string;
    detail?: string;
}

interface FacultyPageShellProps {
    children: React.ReactNode;
    hideCalendar?: boolean;
}

export function FacultyPageShell({ children, hideCalendar = false }: FacultyPageShellProps) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(true);
    const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);

    const { data: events = [] } = useQuery<FacultyEvent[]>({
        queryKey: ['faculty-upcoming-events'],
        queryFn: () => apiClient.getFacultyUpcomingEvents(),
        staleTime: 60_000,
    });

    const highlightDates = useMemo(
        () => events.map((e) => e.date),
        [events]
    );

    const filteredEvents = useMemo(() => {
        if (!selectedDate) return events.slice(0, 6);
        return events.filter((e) => {
            try {
                return isSameDay(parseISO(e.date), selectedDate);
            } catch {
                return false;
            }
        });
    }, [events, selectedDate]);

    if (hideCalendar) return <>{children}</>;

    return (
        <div className="flex gap-5 h-full min-h-0">
            {/* Main content */}
            <div className={`flex-1 min-w-0 transition-all duration-300 ${calendarOpen ? '' : 'w-full'}`}>
                {children}
            </div>

            {/* Calendar sidebar toggle (mobile) */}
            <button
                onClick={() => setMobileCalendarOpen(true)}
                className="fixed bottom-6 right-6 z-40 lg:hidden p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary-700 transition-colors"
                aria-label="Open calendar"
            >
                <CalendarDays className="w-5 h-5" />
            </button>

            {/* Reopen button - visible on desktop when calendar is collapsed */}
            {!calendarOpen && (
                <button
                    onClick={() => setCalendarOpen(true)}
                    className="hidden lg:flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-primary hover:border-primary/30 transition-colors self-start mt-1"
                    title="Show calendar"
                >
                    <PanelRightOpen className="w-4 h-4" />
                </button>
            )}

            {/* Calendar sidebar */}
            <aside
                className={`
                    ${calendarOpen ? 'w-72 xl:w-80' : 'w-0 overflow-hidden'}
                    hidden lg:block flex-shrink-0 transition-all duration-300
                `}
            >
                <div className="h-full space-y-3 flex flex-col">
                    {/* Close toggle */}
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
                            selectedDate={selectedDate}
                            onSelectDate={setSelectedDate}
                        />
                    </div>

                    {/* Events list below calendar - scrollable */}
                    <Card className="border-0 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                        <CardHeader className="pb-2 px-4 pt-3 flex-shrink-0">
                            <CardTitle className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                {selectedDate
                                    ? `Events · ${format(selectedDate, 'MMM d')}`
                                    : 'Upcoming'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 flex-1 overflow-y-auto">
                            {filteredEvents.length === 0 ? (
                                <p className="text-[11px] text-gray-400 text-center py-3">
                                    {selectedDate ? 'No events on this date' : 'No upcoming events'}
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {filteredEvents.map((event) => {
                                        const isDeadline = event.event_type === 'deadline';
                                        const isPast = new Date(event.date) < new Date();
                                        return (
                                            <Link
                                                key={`${event.id}-${event.event_type}`}
                                                href={`/faculty/assignments/${event.id}`}
                                                className="block group"
                                            >
                                                <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                                    <div className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${isPast
                                                            ? 'bg-amber-50 text-amber-600'
                                                            : isDeadline
                                                                ? 'bg-red-50 text-red-500'
                                                                : 'bg-emerald-50 text-emerald-600'
                                                        }`}>
                                                        {isPast ? (
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                        ) : isDeadline ? (
                                                            <FileText className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                            {event.title}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 truncate">
                                                            {event.course_code} · {format(parseISO(event.date), 'MMM d')}
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
                </div>
            </aside>

            {/* Mobile calendar drawer */}
            {mobileCalendarOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setMobileCalendarOpen(false)}
                    />
                    <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl overflow-y-auto p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-primary" /> Calendar
                            </h3>
                            <button
                                onClick={() => setMobileCalendarOpen(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                <PanelRightClose className="w-4 h-4" />
                            </button>
                        </div>
                        <DashboardCalendar
                            highlightDates={highlightDates}
                            selectedDate={selectedDate}
                            onSelectDate={setSelectedDate}
                        />
                        <div className="space-y-1.5 pt-2">
                            <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 px-1">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                {selectedDate
                                    ? `Events · ${format(selectedDate, 'MMM d')}`
                                    : 'Upcoming'}
                            </h4>
                            {filteredEvents.length === 0 ? (
                                <p className="text-[11px] text-gray-400 text-center py-3">
                                    No events
                                </p>
                            ) : (
                                filteredEvents.map((event) => (
                                    <Link
                                        key={`mob-${event.id}-${event.event_type}`}
                                        href={`/faculty/assignments/${event.id}`}
                                        onClick={() => setMobileCalendarOpen(false)}
                                        className="block p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <p className="text-xs font-medium text-gray-900 truncate">{event.title}</p>
                                        <p className="text-[11px] text-gray-400">{event.course_code} · {format(parseISO(event.date), 'MMM d')}</p>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
