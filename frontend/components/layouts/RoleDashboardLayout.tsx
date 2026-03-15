'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { format, isSameDay, parseISO, differenceInDays, differenceInHours, isPast } from 'date-fns';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/contexts/AuthContext';
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
    Target,
    Bell,
    Users,
    AlertCircle,
} from 'lucide-react';

/** Generic calendar event shape - roles map their data to this */
export interface CalendarEvent {
    id: number;
    title: string;
    date: string;
    event_type: string;
    course_code?: string;
    course_name?: string;
    course_id?: number;
    detail?: string;
    priority?: 'low' | 'medium' | 'high';
}

export interface RoleDashboardLayoutProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    /** Query to fetch events. Required - pass { queryFn: () => [] } for roles with no events. */
    eventsQuery: Pick<UseQueryOptions<CalendarEvent[]>, 'queryKey' | 'queryFn'> & {
        staleTime?: number;
    };
    /** Build href for an event. Required. */
    getEventHref: (event: CalendarEvent) => string;
    /** When true, hide the calendar/upcoming sidebar (e.g. on grading page). */
    hideCalendarSidebar?: boolean;
}

export default function RoleDashboardLayout({
    children,
    allowedRoles,
    eventsQuery,
    getEventHref,
    hideCalendarSidebar = false,
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
                course_code: e.course_code,
                course_id: e.course_id,
                title: e.title,
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
            <DashboardLayout hideTopNav={hideCalendarSidebar}>
                <div className="flex gap-5 h-full min-h-0">
                    {/* Main content */}
                    <div className="flex-1 min-w-0 overflow-y-auto">
                        {children}
                    </div>

                    {/* Desktop: reopen button when calendar is collapsed */}
                    {!hideCalendarSidebar && !calendarOpen && (
                        <button
                            onClick={() => setCalendarOpen(true)}
                            className="hidden lg:flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-primary hover:border-primary/30 transition-colors self-start mt-1"
                            title="Show calendar"
                        >
                            <PanelRightOpen className="w-4 h-4" />
                        </button>
                    )}

                    {/* Desktop: calendar sidebar */}
                    {!hideCalendarSidebar && (
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
                    )}

                    {/* Mobile: floating calendar button */}
                    {!hideCalendarSidebar && (
                    <button
                        onClick={() => setMobileDrawerOpen(true)}
                        className="fixed bottom-6 right-6 z-40 lg:hidden p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary-700 transition-colors"
                        aria-label="Open calendar"
                    >
                        <CalendarDays className="w-5 h-5" />
                    </button>
                    )}

                    {/* Mobile: calendar drawer */}
                    {!hideCalendarSidebar && mobileDrawerOpen && (
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
                                            filteredEvents.map((event) => {
                                                const timeInfo = getTimeRemaining(event.date);
                                                const { bg, Icon } = eventStyle(event);
                                                
                                                return (
                                                    <Link
                                                        key={`mob-${event.id}-${event.event_type}`}
                                                        href={getEventHref(event)}
                                                        onClick={() => setMobileDrawerOpen(false)}
                                                        className="block p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${bg}`}>
                                                                <Icon className="w-3 h-3" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-gray-900 truncate">{event.title}</p>
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-[11px] text-gray-400">
                                                                        {event.course_code || ''} · {format(parseISO(event.date), 'MMM d')}
                                                                    </p>
                                                                    <span className={`
                                                                        text-[9px] px-1.5 py-0.5 rounded-full font-medium
                                                                        ${timeInfo.overdue 
                                                                            ? 'bg-gray-100 text-gray-500' 
                                                                            : timeInfo.urgent 
                                                                                ? 'bg-red-100 text-red-700' 
                                                                                : 'bg-gray-100 text-gray-600'}
                                                                    `}>
                                                                        {timeInfo.text}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            })
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

// ============== Helpers ==============

function getTimeRemaining(dateStr: string): { text: string; urgent: boolean; overdue: boolean } {
    const date = parseISO(dateStr + (dateStr.includes('T') ? '' : 'T23:59:59'));
    const now = new Date();
    
    if (isPast(date)) {
        const daysPast = Math.abs(differenceInDays(date, now));
        if (daysPast === 0) return { text: 'Today', urgent: true, overdue: true };
        if (daysPast === 1) return { text: '1d ago', urgent: false, overdue: true };
        return { text: `${daysPast}d ago`, urgent: false, overdue: true };
    }
    
    const hoursLeft = differenceInHours(date, now);
    const daysLeft = differenceInDays(date, now);
    
    if (hoursLeft < 1) return { text: '< 1h', urgent: true, overdue: false };
    if (hoursLeft < 24) return { text: `${hoursLeft}h`, urgent: true, overdue: false };
    if (daysLeft === 1) return { text: '1 day', urgent: true, overdue: false };
    if (daysLeft <= 3) return { text: `${daysLeft}d`, urgent: true, overdue: false };
    if (daysLeft <= 7) return { text: `${daysLeft} days`, urgent: false, overdue: false };
    return { text: format(date, 'MMM d'), urgent: false, overdue: false };
}

// Course color generator for consistent coloring
const COURSE_COLORS = [
    { bg: 'bg-blue-50', text: 'text-blue-600' },
    { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { bg: 'bg-purple-50', text: 'text-purple-600' },
    { bg: 'bg-amber-50', text: 'text-amber-600' },
    { bg: 'bg-pink-50', text: 'text-pink-600' },
    { bg: 'bg-cyan-50', text: 'text-cyan-600' },
];

function getCourseColor(courseCode?: string) {
    if (!courseCode) return COURSE_COLORS[0];
    let hash = 0;
    for (let i = 0; i < courseCode.length; i++) {
        hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

function eventStyle(event: CalendarEvent) {
    const eventIsPast = isPast(parseISO(event.date + 'T23:59:59'));
    const t = event.event_type;
    const courseColor = getCourseColor(event.course_code);
    
    if (t === 'course_start') return { bg: 'bg-blue-50 text-blue-600', Icon: BookOpen };
    if (t === 'course_end') return { bg: eventIsPast ? 'bg-gray-100 text-gray-500' : 'bg-purple-50 text-purple-600', Icon: GraduationCap };
    if (t === 'exam') return { bg: eventIsPast ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600', Icon: AlertCircle };
    if (t === 'office_hours') return { bg: 'bg-green-50 text-green-600', Icon: Users };
    if (t === 'reminder' || t === 'announcement') return { bg: 'bg-yellow-50 text-yellow-600', Icon: Bell };
    if (t === 'grading') return { bg: 'bg-orange-50 text-orange-600', Icon: Target };
    if (eventIsPast) return { bg: 'bg-gray-100 text-gray-500', Icon: CheckCircle };
    if (t === 'deadline') return { bg: `${courseColor.bg} ${courseColor.text}`, Icon: FileText };
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
                            const timeInfo = getTimeRemaining(event.date);
                            
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
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <p className="text-[10px] text-gray-400 truncate">
                                                    {event.course_code ? `${event.course_code} · ` : ''}{format(parseISO(event.date), 'MMM d')}
                                                </p>
                                                {/* Time remaining badge */}
                                                <span className={`
                                                    text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0
                                                    ${timeInfo.overdue 
                                                        ? 'bg-gray-100 text-gray-500' 
                                                        : timeInfo.urgent 
                                                            ? 'bg-red-100 text-red-700 animate-pulse' 
                                                            : 'bg-gray-100 text-gray-600'}
                                                `}>
                                                    {timeInfo.text}
                                                </span>
                                            </div>
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
