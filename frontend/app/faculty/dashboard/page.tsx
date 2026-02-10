'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { BookOpen, Users, FileText, Clock, ArrowRight } from 'lucide-react';
import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';

export default function FacultyDashboard() {
    const { user } = useAuth();

    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => apiClient.getDashboardStats(),
    });

    // Placeholder calendar data for now: upcoming grading / assignment milestones
    const mockFacultyEvents = [
        new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
        new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
        new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    ];

    const quickLinks = [
        {
            title: 'Manage Courses',
            description: 'Create and manage your courses',
            href: '/faculty/courses',
            icon: BookOpen,
            color: 'bg-blue-500'
        },
        {
            title: 'Assignments',
            description: 'Create and grade assignments',
            href: '/faculty/assignments',
            icon: FileText,
            color: 'bg-green-500'
        },
        {
            title: 'Submissions',
            description: 'Review student submissions',
            href: '/faculty/submissions',
            icon: Clock,
            color: 'bg-orange-500'
        },
        {
            title: 'Reports',
            description: 'View analytics and export grades',
            href: '/faculty/reports',
            icon: Users,
            color: 'bg-purple-500'
        },
    ];

    return (
        <ProtectedRoute allowedRoles={['FACULTY']}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Welcome Section */}
                    <div className="bg-gradient-to-r from-[#862733] to-[#a63344] rounded-2xl p-6 text-white">
                        <h1 className="text-2xl font-bold">Welcome back, {user?.full_name?.split(' ')[0] || 'Faculty'}! 👋</h1>
                        <p className="text-white/80 mt-1">
                            Here's an overview of your courses and pending tasks.
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatsCard
                            title="Total Courses"
                            value={isLoading ? '...' : stats?.total_courses || 0}
                            icon={BookOpen}
                            subtitle="Active courses"
                        />
                        <StatsCard
                            title="Total Students"
                            value={isLoading ? '...' : stats?.total_students || 0}
                            icon={Users}
                            subtitle="Enrolled students"
                        />
                        <StatsCard
                            title="Assignments"
                            value={isLoading ? '...' : stats?.total_assignments || 0}
                            icon={FileText}
                            subtitle="Total assignments"
                        />
                        <StatsCard
                            title="Pending Grading"
                            value={isLoading ? '...' : stats?.pending_grading || 0}
                            icon={Clock}
                            subtitle="Awaiting review"
                            trend={stats?.pending_grading > 0 ? { value: stats.pending_grading, label: 'need review' } : undefined}
                        />
                    </div>

                    {/* Main Content Row: Upcoming Teaching + Calendar (mirrors student layout) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Upcoming Teaching / Grading */}
                        <Card className="lg:col-span-2">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-[#862733]" />
                                        Upcoming Teaching & Grading
                                    </CardTitle>
                                    <CardDescription>
                                        Key sessions and grading work for the next few days
                                    </CardDescription>
                                </div>
                                <Link href="/faculty/assignments">
                                    <span className="text-sm text-[#862733] hover:underline flex items-center gap-1">
                                        View assignments
                                        <ArrowRight className="w-4 h-4" />
                                    </span>
                                </Link>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
                                            <BookOpen className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">
                                                Lecture: Data Structures
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Tomorrow • Section A
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100">
                                            <FileText className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">
                                                Grade: Linked List Assignment
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Due in 3 days • 24 submissions pending
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Calendar column (same position as student) */}
                        <div className="space-y-4">
                            <DashboardCalendar highlightDates={mockFacultyEvents} />
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {quickLinks.map((link) => (
                                <Link key={link.href} href={link.href}>
                                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                                        <CardContent className="p-6">
                                            <div className={`w-10 h-10 ${link.color} rounded-lg flex items-center justify-center mb-4`}>
                                                <link.icon className="w-5 h-5 text-white" />
                                            </div>
                                            <h3 className="font-semibold text-gray-900">{link.title}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{link.description}</p>
                                            <div className="flex items-center text-[#862733] text-sm mt-3 font-medium">
                                                Go to {link.title.toLowerCase()}
                                                <ArrowRight className="w-4 h-4 ml-1" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
