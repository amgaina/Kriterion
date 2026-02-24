'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

export type CalendarEvent = {
    date: string;
    event_type: string;
};

type DashboardCalendarProps = {
    highlightDates?: string[];
    events?: CalendarEvent[];
    selectedDate?: Date | null;
    onSelectDate?: (date: Date | null) => void;
};

export function DashboardCalendar({
    highlightDates = [],
    events = [],
    selectedDate = null,
    onSelectDate,
}: DashboardCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(
        () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
    const didAutoNav = useRef(false);

    // Auto-navigate to nearest upcoming event month once data loads
    useEffect(() => {
        if (didAutoNav.current || highlightDates.length === 0) return;
        didAutoNav.current = true;

        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nowMonthKey = todayKey.slice(0, 7);

        const hasEventsThisMonth = highlightDates.some((d) => d.startsWith(nowMonthKey));
        if (hasEventsThisMonth) return; // already showing current month

        const nearest = highlightDates
            .filter((d) => d >= todayKey)
            .sort()[0];

        if (nearest) {
            const [y, m] = nearest.split('-').map(Number);
            setCurrentMonth(new Date(y, m - 1, 1));
        }
    }, [highlightDates]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const ev of events) {
            const key = ev.date.slice(0, 10);
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(ev.event_type);
        }
        return map;
    }, [events]);

    const highlightSet = useMemo(
        () => new Set(highlightDates.map((d) => d.slice(0, 10))),
        [highlightDates],
    );

    const startWeekday = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) calendarDays.push(null);
    for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);
    while (calendarDays.length % 7 !== 0) calendarDays.push(null);

    const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 px-4 pt-4">
                <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold text-gray-700">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        Calendar
                    </span>
                    <span className="flex items-center gap-0.5 text-gray-500">
                        <button
                            type="button"
                            onClick={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-[6rem] text-center text-xs font-medium">
                            {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="Next month"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
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

                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                        if (!day) return <div key={index} className="aspect-square" />;

                        const y = currentMonth.getFullYear();
                        const m = currentMonth.getMonth();
                        const dateObj = new Date(y, m, day);
                        const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                        const types = eventsByDate.get(dateKey);
                        const hasDeadline = types?.has('deadline') || types?.has('grading');
                        const hasCourseEvent = types?.has('course_start') || types?.has('course_end');
                        const hasEvent = hasDeadline || hasCourseEvent;

                        const isSelected = !!selectedDate && isSameDay(selectedDate, dateObj);
                        const today = isToday(dateObj);

                        let cellClass = 'text-gray-700 hover:bg-gray-100';
                        if (isSelected) {
                            cellClass = 'bg-primary text-white shadow-sm ring-2 ring-primary/20';
                        } else if (hasDeadline) {
                            cellClass = 'bg-red-50 text-red-700 font-bold ring-1 ring-red-200 hover:bg-red-100';
                        } else if (hasCourseEvent) {
                            cellClass = 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-200 hover:bg-blue-100';
                        } else if (today) {
                            cellClass = 'bg-primary/10 text-primary font-bold';
                        }

                        return (
                            <button
                                key={index}
                                type="button"
                                className={`
                                    aspect-square rounded-lg flex flex-col items-center justify-center
                                    text-xs font-medium transition-all duration-150 ${cellClass}
                                `}
                                onClick={() => onSelectDate?.(isSelected ? null : dateObj)}
                                title={
                                    hasEvent
                                        ? `Events on ${format(dateObj, 'MMM d, yyyy')}`
                                        : format(dateObj, 'MMM d, yyyy')
                                }
                            >
                                <span className="leading-none">{day}</span>
                                {hasEvent && (
                                    <div className="flex gap-0.5 mt-0.5">
                                        {hasDeadline && (
                                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`} />
                                        )}
                                        {hasCourseEvent && (
                                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>Due date</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Course</span>
                    </div>
                    {selectedDate && (
                        <button
                            onClick={() => onSelectDate?.(null)}
                            className="ml-auto text-primary hover:underline"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
