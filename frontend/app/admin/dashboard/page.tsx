'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar } from '@/components/ui/avatar';
import Link from 'next/link';
import {
    Users,
    BookOpen,
    CheckCircle,
    ArrowRight,
    BarChart3,
    PieChart,
    Shield
} from 'lucide-react';

export default function AdminDashboard() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['system-stats'],
        queryFn: () => apiClient.getSystemStats(),
        refetchInterval: 30000,
    });

    const recentActivity = [
        { id: 1, user: 'John Smith', action: 'Submitted assignment', time: '2 minutes ago', type: 'submission' },
        { id: 2, user: 'Jane Doe', action: 'Created new course', time: '15 minutes ago', type: 'course' },
        { id: 3, user: 'Bob Wilson', action: 'Graded 25 submissions', time: '1 hour ago', type: 'grading' },
        { id: 4, user: 'Alice Brown', action: 'Updated password', time: '2 hours ago', type: 'security' },
        { id: 5, user: 'Charlie Davis', action: 'Enrolled in CS101', time: '3 hours ago', type: 'enrollment' },
    ];

    const systemHealth = [
        { name: 'API Server', status: 'healthy', uptime: '99.9%' },
        { name: 'Database', status: 'healthy', uptime: '99.8%' },
        { name: 'File Storage', status: 'healthy', uptime: '100%' },
        { name: 'Grading Engine', status: 'healthy', uptime: '99.5%' },
    ];

    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout>
                <div className="space-y-6">
                    {/* Welcome Section */}
                    <div className="bg-gradient-to-r from-[#862733] to-[#a63344] rounded-2xl p-6 text-white">
                        <div>
                            <h1 className="text-2xl font-bold">Welcome back, Admin!</h1>
                            <p className="text-white/80 mt-1">
                                Here's what's happening with your grading system today.
                            </p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard
                            title="Total Users"
                            value={isLoading ? '...' : stats?.users?.total || 0}
                            subtitle={`${stats?.users?.active || 0} active`}
                            icon={Users}
                            variant="primary"
                            trend={{ value: 12, label: 'vs last month' }}
                        />
                        <StatsCard
                            title="Courses"
                            value={isLoading ? '...' : stats?.courses?.total || 0}
                            subtitle={`${stats?.courses?.active || 0} active`}
                            icon={BookOpen}
                            variant="warning"
                        />

                    </div>

                    {/* Second Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Activity Chart */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Activity Overview</CardTitle>
                                        <CardDescription>Submissions and logins over the past week</CardDescription>
                                    </div>
                                    <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#862733]">
                                        <option>Last 7 days</option>
                                        <option>Last 30 days</option>
                                        <option>Last 90 days</option>
                                    </select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                    <div className="text-center">
                                        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-500 text-sm">Activity chart visualization</p>
                                        <p className="text-gray-400 text-xs mt-1">
                                            {stats?.recent_activity?.logins_24h || 0} logins • {stats?.recent_activity?.submissions_24h || 0} submissions today
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* User Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>User Distribution</CardTitle>
                                <CardDescription>Breakdown by role</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-green-500" />
                                            <span className="text-sm text-gray-600">Admins</span>
                                        </div>
                                        <span className="text-sm font-medium">{stats?.users?.admins || 0}</span>
                                    </div>
                                    <Progress
                                        value={stats?.users?.admins || 0}
                                        max={stats?.users?.total || 1}
                                        variant="success"
                                    />
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100">
                                    <div className="flex items-center justify-center">
                                        <PieChart className="w-32 h-32 text-gray-300" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Third Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Recent Activity */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Recent Activity</CardTitle>
                                        <CardDescription>Latest actions across the system</CardDescription>
                                    </div>
                                    <Link
                                        href="/admin/security/audit"
                                        className="text-sm text-[#862733] hover:underline flex items-center gap-1"
                                    >
                                        View all <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                            <Avatar alt={activity.user} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                                                <p className="text-sm text-gray-500 truncate">{activity.action}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={
                                                    activity.type === 'submission' ? 'primary' :
                                                        activity.type === 'course' ? 'success' :
                                                            activity.type === 'grading' ? 'warning' :
                                                                activity.type === 'security' ? 'danger' : 'default'
                                                }>
                                                    {activity.type}
                                                </Badge>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">{activity.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* System Health */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>System Health</CardTitle>
                                        <CardDescription>Service status</CardDescription>
                                    </div>
                                    <Badge variant="success">All Systems Operational</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {systemHealth.map((service) => (
                                        <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${service.status === 'healthy' ? 'bg-green-500' :
                                                    service.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`} />
                                                <span className="text-sm font-medium text-gray-700">{service.name}</span>
                                            </div>
                                            <span className="text-xs text-gray-500">{service.uptime} uptime</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-green-800">Everything is running smoothly</p>
                                            <p className="text-xs text-green-600 mt-0.5">Last checked 2 minutes ago</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </AdminLayout>
        </ProtectedRoute>
    );
}
