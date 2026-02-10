import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export function DashboardCalendar() {
    // Simple calendar data for current month (static UI, no real data yet)
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startWeekday = currentMonthStart.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = currentMonthEnd.getDate();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) {
        calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }
    while (calendarDays.length % 7 !== 0) {
        calendarDays.push(null);
    }

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#862733]" />
                        Calendar
                    </span>
                    <span className="text-sm text-gray-500">{format(today, 'MMMM yyyy')}</span>
                </CardTitle>
                <CardDescription>Assignment schedule overview</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-2">
                    {weekdayLabels.map((day) => (
                        <div key={day} className="text-center font-medium">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2 text-sm">
                    {calendarDays.map((day, index) => (
                        <div
                            key={index}
                            className={`h-10 rounded-lg flex flex-col items-center justify-center ${
                                day ? 'bg-gray-50 text-gray-900' : ''
                            }`}
                        >
                            {day && (
                                <>
                                    <span>{day}</span>
                                    {/* Static dot for now; will later reflect real assignments */}
                                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gray-300" />
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

