'use client';

import React from 'react';
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
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/ui/stats-card';
import {
    BookOpen,
    FileCode,
    Award,
    Clock,
    TrendingUp,
    CheckCircle,
    ArrowRight,
    Zap,
    ChevronRight
} from 'lucide-react';

export default function StudentDashboardPage() {
    const { user } = useAuth();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['student-stats'],
        queryFn: () => apiClient.getDashboardStats(),
    });

    const { data: courses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ['student-courses'],
        queryFn: () => apiClient.getCourses(),
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

    const mockCourses = [
        { id: 1, name: 'Data Structures', code: 'CS201', instructor_name: 'Dr. Smith', progress: 75, assignments_completed: 6, total_assignments: 8 },
        { id: 2, name: 'Web Development', code: 'CS301', instructor_name: 'Prof. Johnson', progress: 60, assignments_completed: 3, total_assignments: 5 },
        { id: 3, name: 'Algorithms', code: 'CS202', instructor_name: 'Dr. Williams', progress: 45, assignments_completed: 4, total_assignments: 9 },
        { id: 4, name: 'Database Systems', code: 'CS303', instructor_name: 'Prof. Brown', progress: 90, assignments_completed: 9, total_assignments: 10 },
    ];

    const mockRecentGrades = [
        { id: 1, title: 'Linked List Operations', course: 'Data Structures', score: 92, max_score: 100 },
        { id: 2, title: 'SQL Queries Lab', course: 'Database Systems', score: 88, max_score: 100 },
        { id: 3, title: 'React Components', course: 'Web Development', score: 95, max_score: 100 },
    ];

    const displayStats = stats || mockStats;
    const displayAssignments = assignments.length > 0 ? assignments : mockUpcomingAssignments;
    const displayCourses = courses.length > 0 ? courses : mockCourses;

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
                <div className="space-y-6">
                    {/* Welcome Section */}
                    <div className="bg-gradient-to-r from-[#862733] to-[#a13040] rounded-xl p-6 text-white">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold">
                                    Welcome back, {user?.full_name?.split(' ')[0] || 'Student'}! 👋
                                </h1>
                                <p className="text-white/80 mt-1">
                                    You have {displayStats.pending_assignments || 3} assignments due this week.
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-center px-4 py-2 bg-white/10 rounded-lg">
                                    <p className="text-2xl font-bold">{displayStats.streak_days || 7}</p>
                                    <p className="text-xs text-white/70">Day Streak 🔥</p>
                                </div>
                                <Link href="/student/assignments">
                                    <Button className="bg-white text-[#862733] hover:bg-white/90">
                                        View Assignments
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard
                            title="Enrolled Courses"
                            value={statsLoading ? '...' : displayStats.enrolled_courses}
                            icon={BookOpen}
                            trend={{ value: 0, label: 'Active' }}
                            variant="primary"
                        />
                        <StatsCard
                            title="Submissions"
                            value={statsLoading ? '...' : displayStats.total_submissions}
                            icon={FileCode}
                            trend={{ value: 5, label: 'this week' }}
                            variant="success"
                        />
                        <StatsCard
                            title="Pending"
                            value={statsLoading ? '...' : displayStats.pending_assignments || 3}
                            icon={Clock}
                            trend={{ value: 0, label: 'due soon' }}
                            variant="warning"
                        />
                        <StatsCard
                            title="Average Score"
                            value={statsLoading ? '...' : `${displayStats.average_score}%`}
                            icon={Award}
                            trend={{ value: 3, label: 'improvement' }}
                            variant="default"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Upcoming Assignments */}
                        <Card className="lg:col-span-2">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-[#862733]" />
                                        Upcoming Assignments
                                    </CardTitle>
                                    <CardDescription>Assignments due soon</CardDescription>
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
                                    <div className="text-center py-8 text-gray-500">Loading...</div>
                                ) : (
                                    <div className="space-y-3">
                                        {displayAssignments.slice(0, 4).map((assignment: any) => {
                                            const timeInfo = getTimeRemaining(assignment.due_date);
                                            return (
                                                <Link
                                                    key={assignment.id}
                                                    href={`/student/assignments/${assignment.id}`}
                                                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                                                >
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${timeInfo.urgent ? 'bg-red-100' : 'bg-blue-100'}`}>
                                                        <FileCode className={`w-5 h-5 ${timeInfo.urgent ? 'text-red-600' : 'text-blue-600'}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-900 truncate">{assignment.title}</p>
                                                        <p className="text-sm text-gray-500">{assignment.course_name || assignment.course?.name}</p>
                                                    </div>
                                                    <Badge variant={timeInfo.urgent ? 'danger' : 'warning'}>{timeInfo.text}</Badge>
                                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                                                </Link>
                                            );
                                        })}
                                        {displayAssignments.length === 0 && (
                                            <div className="text-center py-8 text-gray-500">
                                                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                                <p>All caught up! No pending assignments.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Grades */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-[#862733]" />
                                    Recent Grades
                                </CardTitle>
                                <CardDescription>Your latest results</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {mockRecentGrades.map((grade) => (
                                        <div key={grade.id} className="p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="font-medium text-gray-900 text-sm truncate flex-1">{grade.title}</p>
                                                <Badge variant={grade.score >= 90 ? 'success' : grade.score >= 70 ? 'warning' : 'danger'}>
                                                    {grade.score}%
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-500">{grade.course}</p>
                                            <Progress
                                                value={grade.score}
                                                max={grade.max_score}
                                                size="sm"
                                                variant={grade.score >= 90 ? 'success' : grade.score >= 70 ? 'warning' : 'danger'}
                                                className="mt-2"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <Link href="/student/grades">
                                    <Button variant="outline" className="w-full mt-4">View All Grades</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>

                    {/* My Courses */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-[#862733]" />
                                    My Courses
                                </CardTitle>
                                <CardDescription>Track your progress</CardDescription>
                            </div>
                            <Link href="/student/courses">
                                <Button variant="ghost" size="sm">View All<ChevronRight className="w-4 h-4 ml-1" /></Button>
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {displayCourses.slice(0, 4).map((course: any) => (
                                    <Link
                                        key={course.id}
                                        href={`/student/courses/${course.id}`}
                                        className="p-4 border border-gray-200 rounded-lg hover:border-[#862733]/30 hover:shadow-sm transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-medium text-gray-900 group-hover:text-[#862733]">{course.name}</h3>
                                                <p className="text-sm text-gray-500">{course.code}</p>
                                            </div>
                                            <Badge variant="outline">{course.progress}%</Badge>
                                        </div>
                                        <Progress value={course.progress} size="sm" className="mb-2" />
                                        <div className="flex items-center justify-between text-sm text-gray-500">
                                            <span>{course.instructor_name || course.instructor?.full_name}</span>
                                            <span>{course.assignments_completed}/{course.total_assignments} done</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Link href="/student/assignments">
                            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                <CardContent className="p-4 text-center">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                        <FileCode className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <p className="font-medium text-gray-900">Start Assignment</p>
                                    <p className="text-sm text-gray-500">Begin coding</p>
                                </CardContent>
                            </Card>
                        </Link>
                        <Link href="/student/grades">
                            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                <CardContent className="p-4 text-center">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                        <Award className="w-6 h-6 text-green-600" />
                                    </div>
                                    <p className="font-medium text-gray-900">View Grades</p>
                                    <p className="text-sm text-gray-500">Check results</p>
                                </CardContent>
                            </Card>
                        </Link>
                        <Link href="/student/progress">
                            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                <CardContent className="p-4 text-center">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                        <TrendingUp className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <p className="font-medium text-gray-900">My Progress</p>
                                    <p className="text-sm text-gray-500">Track learning</p>
                                </CardContent>
                            </Card>
                        </Link>
                        <Link href="/student/help">
                            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                <CardContent className="p-4 text-center">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-100 flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                                        <Zap className="w-6 h-6 text-yellow-600" />
                                    </div>
                                    <p className="font-medium text-gray-900">Get Help</p>
                                    <p className="text-sm text-gray-500">Support center</p>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
