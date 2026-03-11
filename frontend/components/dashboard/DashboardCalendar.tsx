'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
    format, 
    isSameDay, 
    isToday, 
    startOfWeek, 
    endOfWeek, 
    addDays, 
    differenceInDays,
    differenceInHours,
    isPast,
    isFuture,
    parseISO,
    isWithinInterval,
    addWeeks,
    subWeeks
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    CalendarDays, 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon,
    List,
    LayoutGrid,
    Clock,
    AlertCircle,
    CheckCircle2,
    BookOpen,
    GraduationCap,
    Target,
    Bell,
    Users,
    FileText
} from 'lucide-react';

// ============== Types ==============

export type CalendarViewMode = 'month' | 'week' | 'list';

export type CalendarEventType = 
    | 'deadline' 
    | 'grading' 
    | 'course_start' 
    | 'course_end' 
    | 'exam'
    | 'office_hours'
    | 'reminder'
    | 'announcement'
    | 'submission';

export type CalendarEvent = {
    date: string;
    event_type: string;
    course_code?: string;
    course_id?: number;
    title?: string;
    priority?: 'low' | 'medium' | 'high';
};

type DashboardCalendarProps = {
    highlightDates?: string[];
    events?: CalendarEvent[];
    selectedDate?: Date | null;
    onSelectDate?: (date: Date | null) => void;
    showViewToggle?: boolean;
    defaultView?: CalendarViewMode;
    compactMode?: boolean;
};

// ============== Color Helpers ==============

// Generate consistent colors for courses based on course_code/id
const COURSE_COLORS = [
    { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
    { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200' },
    { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
    { bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-500', border: 'border-pink-200' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500', border: 'border-cyan-200' },
    { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200' },
];

function getCourseColor(courseCode?: string, courseId?: number) {
    if (!courseCode && !courseId) return COURSE_COLORS[0];
    const key = courseCode || String(courseId);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

// Event type styling
const EVENT_TYPE_STYLES: Record<string, { icon: typeof FileText; color: string; label: string }> = {
    deadline: { icon: FileText, color: 'text-red-500', label: 'Due Date' },
    grading: { icon: Target, color: 'text-orange-500', label: 'Grading' },
    course_start: { icon: BookOpen, color: 'text-blue-500', label: 'Course Start' },
    course_end: { icon: GraduationCap, color: 'text-purple-500', label: 'Course End' },
    exam: { icon: AlertCircle, color: 'text-red-600', label: 'Exam' },
    office_hours: { icon: Users, color: 'text-green-500', label: 'Office Hours' },
    reminder: { icon: Bell, color: 'text-yellow-500', label: 'Reminder' },
    announcement: { icon: Bell, color: 'text-cyan-500', label: 'Announcement' },
    submission: { icon: CheckCircle2, color: 'text-gray-500', label: 'Submitted' },
};

function getEventTypeStyle(eventType: string) {
    return EVENT_TYPE_STYLES[eventType] || EVENT_TYPE_STYLES.deadline;
}

// ============== Time Remaining Helper ==============

function getTimeRemaining(dateStr: string): { text: string; urgent: boolean; overdue: boolean } {
    const date = parseISO(dateStr + (dateStr.includes('T') ? '' : 'T23:59:59'));
    const now = new Date();
    
    if (isPast(date)) {
        const daysPast = Math.abs(differenceInDays(date, now));
        if (daysPast === 0) return { text: 'Today (past)', urgent: true, overdue: true };
        if (daysPast === 1) return { text: '1 day ago', urgent: false, overdue: true };
        return { text: `${daysPast}d ago`, urgent: false, overdue: true };
    }
    
    const hoursLeft = differenceInHours(date, now);
    const daysLeft = differenceInDays(date, now);
    
    if (hoursLeft < 1) return { text: '< 1 hour', urgent: true, overdue: false };
    if (hoursLeft < 24) return { text: `${hoursLeft}h left`, urgent: true, overdue: false };
    if (daysLeft === 1) return { text: '1 day left', urgent: true, overdue: false };
    if (daysLeft <= 3) return { text: `${daysLeft}d left`, urgent: true, overdue: false };
    if (daysLeft <= 7) return { text: `${daysLeft} days`, urgent: false, overdue: false };
    return { text: format(date, 'MMM d'), urgent: false, overdue: false };
}

// ============== Main Component ==============

export function DashboardCalendar({
    highlightDates = [],
    events = [],
    selectedDate = null,
    onSelectDate,
    showViewToggle = true,
    defaultView = 'month',
    compactMode = false,
}: DashboardCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(
        () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
    const [viewMode, setViewMode] = useState<CalendarViewMode>(defaultView);
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date()));
    const didAutoNav = useRef(false);
    const calendarRef = useRef<HTMLDivElement>(null);
    
    // Touch gesture state
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);

    // Jump to today
    const goToToday = useCallback(() => {
        const today = new Date();
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setCurrentWeekStart(startOfWeek(today));
        onSelectDate?.(today);
    }, [onSelectDate]);

    // Check if currently showing today's month/week
    const isShowingToday = useMemo(() => {
        const today = new Date();
        if (viewMode === 'month') {
            return currentMonth.getFullYear() === today.getFullYear() && 
                   currentMonth.getMonth() === today.getMonth();
        }
        return isWithinInterval(today, { start: currentWeekStart, end: endOfWeek(currentWeekStart) });
    }, [currentMonth, currentWeekStart, viewMode]);

    // Auto-navigate to nearest upcoming event month once data loads
    useEffect(() => {
        if (didAutoNav.current || highlightDates.length === 0) return;
        didAutoNav.current = true;

        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nowMonthKey = todayKey.slice(0, 7);

        const hasEventsThisMonth = highlightDates.some((d) => d.startsWith(nowMonthKey));
        if (hasEventsThisMonth) return;

        const nearest = highlightDates.filter((d) => d >= todayKey).sort()[0];
        if (nearest) {
            const [y, m] = nearest.split('-').map(Number);
            setCurrentMonth(new Date(y, m - 1, 1));
        }
    }, [highlightDates]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!calendarRef.current?.contains(document.activeElement)) return;
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (viewMode === 'month') {
                    setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
                } else {
                    setCurrentWeekStart((p) => subWeeks(p, 1));
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (viewMode === 'month') {
                    setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));
                } else {
                    setCurrentWeekStart((p) => addWeeks(p, 1));
                }
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                goToToday();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [viewMode, goToToday]);

    // Touch gesture handlers for swipe navigation
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX.current;
        const deltaY = touchEndY - touchStartY.current;

        // Only trigger swipe if horizontal movement is greater than vertical
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                // Swipe right - go to previous
                if (viewMode === 'month') {
                    setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
                } else {
                    setCurrentWeekStart((p) => subWeeks(p, 1));
                }
            } else {
                // Swipe left - go to next
                if (viewMode === 'month') {
                    setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));
                } else {
                    setCurrentWeekStart((p) => addWeeks(p, 1));
                }
            }
        }
    };

    // Events organized by date
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const ev of events) {
            const key = ev.date.slice(0, 10);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
        }
        return map;
    }, [events]);

    // Event types by date for dot indicators
    const eventTypesByDate = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const ev of events) {
            const key = ev.date.slice(0, 10);
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(ev.event_type);
        }
        return map;
    }, [events]);

    // Unique courses for legend with colors
    const uniqueCourses = useMemo(() => {
        const courses = new Map<string, typeof COURSE_COLORS[0]>();
        for (const ev of events) {
            if (ev.course_code && !courses.has(ev.course_code)) {
                courses.set(ev.course_code, getCourseColor(ev.course_code, ev.course_id));
            }
        }
        return courses;
    }, [events]);

    // Navigation handlers
    const goToPrevious = () => {
        if (viewMode === 'month') {
            setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
        } else {
            setCurrentWeekStart((p) => subWeeks(p, 1));
        }
    };

    const goToNext = () => {
        if (viewMode === 'month') {
            setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));
        } else {
            setCurrentWeekStart((p) => addWeeks(p, 1));
        }
    };

    // Calendar days for month view
    const calendarDays = useMemo(() => {
        const startWeekday = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        
        const days: (number | null)[] = [];
        for (let i = 0; i < startWeekday; i++) days.push(null);
        for (let day = 1; day <= daysInMonth; day++) days.push(day);
        while (days.length % 7 !== 0) days.push(null);
        return days;
    }, [currentMonth]);

    // Week days for week view
    const weekDays = useMemo(() => {
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(currentWeekStart, i));
        }
        return days;
    }, [currentWeekStart]);

    // Sorted events for list view
    const sortedEvents = useMemo(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        return [...events]
            .filter((e) => e.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 15);
    }, [events]);

    const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // ============== Render Functions ==============

    const renderDayCell = (day: number | null, index: number, isWeekView = false, dateOverride?: Date) => {
        if (day === null && !isWeekView) return <div key={index} className="aspect-square" />;

        const dateObj = isWeekView && dateOverride 
            ? dateOverride 
            : new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day!);
        
        const dateKey = format(dateObj, 'yyyy-MM-dd');
        const dayEvents = eventsByDate.get(dateKey) || [];
        const types = eventTypesByDate.get(dateKey);
        
        const hasDeadline = types?.has('deadline') || types?.has('grading') || types?.has('exam');
        const hasCourseEvent = types?.has('course_start') || types?.has('course_end');
        const hasReminder = types?.has('reminder') || types?.has('announcement');
        const hasOfficeHours = types?.has('office_hours');
        const eventCount = dayEvents.length;

        const isSelected = !!selectedDate && isSameDay(selectedDate, dateObj);
        const today = isToday(dateObj);
        const inPast = isPast(dateObj) && !today;

        // Determine cell styling
        let cellClass = 'text-gray-700 hover:bg-gray-100';
        if (isSelected) {
            cellClass = 'bg-primary text-white shadow-sm ring-2 ring-primary/20';
        } else if (today) {
            cellClass = 'bg-primary/10 text-primary font-bold ring-2 ring-primary/30';
        } else if (hasDeadline && !inPast) {
            cellClass = 'bg-red-50 text-red-700 font-bold ring-1 ring-red-200 hover:bg-red-100';
        } else if (hasCourseEvent) {
            cellClass = 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-200 hover:bg-blue-100';
        } else if (hasReminder) {
            cellClass = 'bg-yellow-50 text-yellow-700 font-semibold ring-1 ring-yellow-200 hover:bg-yellow-100';
        } else if (hasOfficeHours) {
            cellClass = 'bg-green-50 text-green-700 font-semibold ring-1 ring-green-200 hover:bg-green-100';
        } else if (inPast) {
            cellClass = 'text-gray-400 hover:bg-gray-50';
        }

        return (
            <button
                key={index}
                type="button"
                className={`
                    ${isWeekView ? 'h-16' : 'aspect-square'} 
                    rounded-lg flex flex-col items-center justify-center
                    text-xs font-medium transition-all duration-150 relative ${cellClass}
                `}
                onClick={() => onSelectDate?.(isSelected ? null : dateObj)}
                title={
                    eventCount > 0
                        ? `${eventCount} event${eventCount > 1 ? 's' : ''} on ${format(dateObj, 'MMM d, yyyy')}`
                        : format(dateObj, 'MMM d, yyyy')
                }
            >
                <span className="leading-none">{isWeekView ? format(dateObj, 'd') : day}</span>
                
                {/* Event count badge */}
                {eventCount > 1 && !isSelected && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                        {eventCount}
                    </span>
                )}
                
                {/* Event type dots */}
                {eventCount > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                        {hasDeadline && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`} />
                        )}
                        {hasCourseEvent && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                        )}
                        {hasReminder && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-yellow-500'}`} />
                        )}
                        {hasOfficeHours && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                        )}
                    </div>
                )}
            </button>
        );
    };

    const renderMonthView = () => (
        <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => renderDayCell(day, index))}
        </div>
    );

    const renderWeekView = () => (
        <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1">
                {weekDays.map((date, index) => (
                    <div key={index} className="text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                            {weekdayLabels[index]}
                        </div>
                        {renderDayCell(date.getDate(), index, true, date)}
                    </div>
                ))}
            </div>
            
            {/* Week events summary */}
            <div className="border-t pt-2 mt-2 max-h-32 overflow-y-auto">
                {weekDays.map((date) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const dayEvents = eventsByDate.get(dateKey) || [];
                    if (dayEvents.length === 0) return null;
                    
                    return (
                        <div key={dateKey} className="mb-2">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase">
                                {format(date, 'EEE, MMM d')}
                            </p>
                            {dayEvents.slice(0, 2).map((ev, i) => {
                                const courseColor = getCourseColor(ev.course_code, ev.course_id);
                                const timeInfo = getTimeRemaining(ev.date);
                                return (
                                    <div 
                                        key={i} 
                                        className={`text-[11px] px-2 py-1 rounded mt-0.5 ${courseColor.bg} ${courseColor.text} truncate flex items-center justify-between`}
                                    >
                                        <span className="truncate">{ev.title || ev.course_code || ev.event_type}</span>
                                        {!timeInfo.overdue && (
                                            <span className={`text-[9px] ml-1 flex-shrink-0 ${timeInfo.urgent ? 'font-bold' : ''}`}>
                                                {timeInfo.text}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                            {dayEvents.length > 2 && (
                                <p className="text-[10px] text-gray-400 mt-0.5">+{dayEvents.length - 2} more</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderListView = () => (
        <div className="space-y-1 max-h-64 overflow-y-auto">
            {sortedEvents.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">No upcoming events</p>
            ) : (
                sortedEvents.map((event, index) => {
                    const courseColor = getCourseColor(event.course_code, event.course_id);
                    const timeInfo = getTimeRemaining(event.date);
                    const style = getEventTypeStyle(event.event_type);
                    const IconComponent = style.icon;
                    
                    return (
                        <button
                            key={index}
                            type="button"
                            onClick={() => onSelectDate?.(parseISO(event.date))}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left border ${courseColor.border}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${courseColor.bg}`}>
                                <IconComponent className={`w-4 h-4 ${style.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-gray-900 truncate">
                                    {event.title || event.course_code || style.label}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                    {event.course_code && <span className="mr-1">{event.course_code} ·</span>}
                                    {format(parseISO(event.date), 'MMM d, yyyy')}
                                </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                                <span className={`
                                    text-[10px] px-1.5 py-0.5 rounded-full font-medium
                                    ${timeInfo.overdue 
                                        ? 'bg-gray-100 text-gray-500' 
                                        : timeInfo.urgent 
                                            ? 'bg-red-100 text-red-700' 
                                            : 'bg-gray-100 text-gray-600'}
                                `}>
                                    {timeInfo.text}
                                </span>
                            </div>
                        </button>
                    );
                })
            )}
        </div>
    );

    return (
        <Card 
            ref={calendarRef} 
            className="border-0 shadow-sm"
            tabIndex={0}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold text-gray-700">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        Calendar
                    </span>
                    
                    {/* View mode toggle */}
                    {showViewToggle && (
                        <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
                            <button
                                type="button"
                                onClick={() => setViewMode('month')}
                                className={`p-1 rounded ${viewMode === 'month' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                title="Month view"
                            >
                                <LayoutGrid className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('week')}
                                className={`p-1 rounded ${viewMode === 'week' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                title="Week view"
                            >
                                <CalendarIcon className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                title="List view"
                            >
                                <List className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </CardTitle>
                
                {/* Navigation */}
                {viewMode !== 'list' && (
                    <div className="flex items-center justify-between mt-2">
                        <button
                            type="button"
                            onClick={goToPrevious}
                            className="p-1 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
                            aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">
                                {viewMode === 'month' 
                                    ? format(currentMonth, 'MMMM yyyy')
                                    : `${format(currentWeekStart, 'MMM d')} - ${format(endOfWeek(currentWeekStart), 'MMM d, yyyy')}`
                                }
                            </span>
                            
                            {/* Today button */}
                            {!isShowingToday && (
                                <button
                                    type="button"
                                    onClick={goToToday}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                                >
                                    Today
                                </button>
                            )}
                        </div>
                        
                        <button
                            type="button"
                            onClick={goToNext}
                            className="p-1 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
                            aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </CardHeader>
            
            <CardContent className="px-4 pb-4">
                {/* Weekday headers for month view */}
                {viewMode === 'month' && (
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {weekdayLabels.map((day) => (
                            <div
                                key={day}
                                className="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-1"
                            >
                                {day}
                            </div>
                        ))}
                    </div>
                )}

                {/* Calendar content based on view mode */}
                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'list' && renderListView()}

                {/* Legend */}
                <div className="mt-3 pt-2 border-t border-gray-100">
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span>Due/Exam</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Course</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span>Reminder</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span>Office Hrs</span>
                        </div>
                    </div>
                    
                    {/* Course color legend (if courses exist) */}
                    {uniqueCourses.size > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {Array.from(uniqueCourses.entries()).slice(0, 4).map(([code, color]) => (
                                <span key={code} className={`text-[9px] px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
                                    {code}
                                </span>
                            ))}
                            {uniqueCourses.size > 4 && (
                                <span className="text-[9px] text-gray-400">+{uniqueCourses.size - 4} more</span>
                            )}
                        </div>
                    )}
                    
                    {/* Selection and keyboard hints */}
                    <div className="flex items-center justify-between mt-2">
                        {selectedDate && (
                            <button
                                onClick={() => onSelectDate?.(null)}
                                className="text-[10px] text-primary hover:underline"
                            >
                                Clear selection
                            </button>
                        )}
                        <span className="text-[9px] text-gray-400 ml-auto hidden sm:inline">
                            ← → navigate · T today
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
