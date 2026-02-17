'use client';

import React, { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/ui/stats-card';
import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';
import {
    BookOpen,
    FileCode,
    Award,
    Clock,
    CheckCircle,
    ArrowRight,
    ChevronRight
} from 'lucide-react';

export default function StudentDashboardPage() {
    const { user } = useAuth();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['student-stats'],
        queryFn: () => apiClient.getDashboardStats(),
    });



    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ['student-assignments'],
        queryFn: () => apiClient.getAssignments(),
    });

    // Mock data for demonstration
    const mockStats = {
        enrolled_courses: 4,
        total_submissions: 28,
        pending_assignments: 3,
        average_score: 85,
        streak_days: 7,
    };

    const mockUpcomingAssignments = [
        { id: 1, title: 'Binary Search Implementation', course_name: 'Data Structures', due_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), status: 'pending' },
        { id: 2, title: 'REST API Project', course_name: 'Web Development', due_date: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), status: 'pending' },
        { id: 3, title: 'Sorting Algorithms Quiz', course_name: 'Algorithms', due_date: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), status: 'pending' },
    ];





    const displayStats = stats || mockStats;
    const displayAssignments = assignments.length > 0 ? assignments : mockUpcomingAssignments;

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const highlightDates = displayAssignments
        .map((assignment: any) => assignment.due_date)
        .filter((date: string | undefined | null) => Boolean(date));

    const filteredAssignments = selectedDate
        ? displayAssignments.filter((assignment: any) => {
              const raw = assignment.due_date;
              if (!raw) return false;
              const due = new Date(raw);
              if (isNaN(due.getTime())) return false;
              return due.toDateString() === selectedDate.toDateString();
          })
        : displayAssignments;

    const assignmentsToShow = (selectedDate ? filteredAssignments : displayAssignments).slice(0, 3);

    const getTimeRemaining = (dueDate: string) => {
        const due = new Date(dueDate);
        if (isPast(due)) return { text: 'Overdue', urgent: true };
        const distance = formatDistanceToNow(due, { addSuffix: true });
        const isUrgent = isWithinInterval(due, { start: new Date(), end: addDays(new Date(), 1) });
        return { text: distance, urgent: isUrgent };
    };

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <DashboardLayout>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                    {/* Welcome Section */}
                    <div className="bg-gradient-to-r from-[#862733] to-[#a13040] rounded-xl p-4 text-white">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h1 className="text-xl font-semibold">
                                    Welcome back, {user?.full_name?.split(' ')[0] || 'Student'}! 👋
                                </h1>
                                <p className="text-white/80 mt-1 text-sm">
                                    You have {displayStats.pending_assignments || 3} assignments due this week.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">    
                                <Link href="/student/assignments">
                                    <Button className="bg-white text-[#862733] hover:bg-white/90 py-1 px-3 text-sm">
                                        View Assignments
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[360px]">
                        {/* Left column: Stats Cards (stack & stretch on large screens) */}
                        <div className="lg:col-span-1 grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:gap-3 h-full">
                            <div className="lg:flex-1">
                                <StatsCard className="p-4 min-h-[84px] lg:h-full lg:flex-1 lg:flex lg:flex-col lg:justify-center"
                                    title="Enrolled Courses"
                                    value={statsLoading ? '...' : displayStats.enrolled_courses}
                                    icon={BookOpen}
                                    iconSize={36}
                                    variant="primary"
                                />
                            </div>

                            <div className="lg:flex-1">
                                <StatsCard className="p-4 min-h-[84px] lg:h-full lg:flex-1 lg:flex lg:flex-col lg:justify-center"
                                    title="Submissions"
                                    value={statsLoading ? '...' : displayStats.total_submissions}
                                    icon={FileCode}
                                    iconSize={36}
                                    variant="success"
                                />
                            </div>

                            <div className="lg:flex-1">
                                <StatsCard className="p-4 min-h-[84px] lg:h-full lg:flex-1 lg:flex lg:flex-col lg:justify-center"
                                    title="Pending"
                                    value={statsLoading ? '...' : displayStats.pending_assignments || 3}
                                    icon={Clock}
                                    iconSize={36}
                                    variant="warning"
                                />
                            </div>

                            <div className="lg:flex-1">
                                <StatsCard className="p-4 min-h-[84px] lg:h-full lg:flex-1 lg:flex lg:flex-col lg:justify-center"
                                    title="Average Score"
                                    value={statsLoading ? '...' : `${displayStats.average_score}%`}
                                    icon={Award}
                                    iconSize={36}
                                    variant="default"
                                />
                            </div>
                        </div>

                        {/* Right column: Calendar on top, Upcoming Assignments below */}
                        <div className="lg:col-span-2 space-y-4">
                            <DashboardCalendar
                                highlightDates={highlightDates}
                                selectedDate={selectedDate}
                                onSelectDate={setSelectedDate}
                                compact
                            />

                            {/* Upcoming Assignments (moved below calendar) */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-[#862733]" />
                                            Upcoming Assignments
                                        </CardTitle>
                                        <CardDescription>
                                            {selectedDate
                                                ? `Assignments due on ${format(selectedDate, 'MMM d, yyyy')}`
                                                : 'Assignments due soon'}
                                        </CardDescription>
                                    </div>
                                    <Link href="/student/assignments">
                                        <Button variant="ghost" size="sm">
                                            View All
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </Link>
                                </CardHeader>
                                <CardContent>
                                    {assignmentsLoading ? (
                                        <div className="text-center py-6 text-gray-500">Loading...</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {assignmentsToShow.map((assignment: any) => {
                                                const timeInfo = getTimeRemaining(assignment.due_date);
                                                return (
                                                    <Link
                                                        key={assignment.id}
                                                        href={`/student/assignments/${assignment.id}`}
                                                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${timeInfo.urgent ? 'bg-red-100' : 'bg-blue-100'}`}>
                                                            <FileCode className={`w-4 h-4 ${timeInfo.urgent ? 'text-red-600' : 'text-blue-600'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm text-gray-900 truncate">{assignment.title}</p>
                                                            <p className="text-xs text-gray-500">{assignment.course_name || assignment.course?.name}</p>
                                                        </div>
                                                        <Badge variant={timeInfo.urgent ? 'danger' : 'warning'} className="text-xs">{timeInfo.text}</Badge>
                                                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                                                    </Link>
                                                );
                                            })}
                                            {(selectedDate ? filteredAssignments.length : displayAssignments.length) === 0 && (
                                                <div className="text-center py-6 text-gray-500">
                                                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
                                                    <p>All caught up! No pending assignments.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>


                        </div>
                    </div>




                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
