'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import Link from 'next/link';
import {
    Users,
    BookOpen,
    CheckCircle,
    ArrowRight
} from 'lucide-react';

export default function AdminDashboard() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['system-stats'],
        queryFn: () => apiClient.getSystemStats(),
        refetchInterval: 30000,
    });

    const { data: systemHealthData } = useQuery({
        queryKey: ['system-health'],
        queryFn: () => apiClient.getSystemHealth(),
        refetchInterval: 30000,
    });

    const recentActivity = [
        { id: 1, user: 'John Smith', action: 'Submitted assignment', time: '2 minutes ago', type: 'submission' },
        { id: 2, user: 'Jane Doe', action: 'Created new course', time: '15 minutes ago', type: 'course' },
        { id: 3, user: 'Bob Wilson', action: 'Graded 25 submissions', time: '1 hour ago', type: 'grading' },
        { id: 4, user: 'Alice Brown', action: 'Updated password', time: '2 hours ago', type: 'security' },
        { id: 5, user: 'Charlie Davis', action: 'Enrolled in CS101', time: '3 hours ago', type: 'enrollment' },
    ];

    const defaultSystemHealth = [
        { name: 'API Server', status: 'offline' },
        { name: 'Database', status: 'offline' },
        { name: 'File Storage', status: 'offline' },
        { name: 'Grading Engine', status: 'offline' },
    ];
    const systemHealth = systemHealthData?.services || defaultSystemHealth;
    const allSystemsOnline = systemHealth.every((service: { status: string }) => service.status === 'online');
    const lastCheckedLabel = systemHealthData?.checked_at
        ? new Date(systemHealthData.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : 'just now';

    return (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatsCard
                    title="Faculty Members"
                    value={isLoading ? '...' : stats?.users?.faculty || 0}
                    subtitle={`${stats?.users?.total || 0} total users`}
                    icon={Users}
                    variant="primary"
                />
                <StatsCard
                    title="Students"
                    value={isLoading ? '...' : stats?.users?.students || 0}
                    subtitle={`${stats?.users?.total || 0} total users`}
                    icon={Users}
                    variant="success"
                />
                <StatsCard
                    title="Courses"
                    value={isLoading ? '...' : stats?.courses?.total || 0}
                    subtitle={`${stats?.courses?.active || 0} active`}
                    icon={BookOpen}
                    variant="warning"
                />

            </div>

            {/* Activity & Health */}
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
                            <Badge variant={allSystemsOnline ? 'success' : 'warning'}>
                                {allSystemsOnline ? 'All Systems Online' : 'System Degraded'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {systemHealth.map((service: { name: string; status: string }) => (
                                <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${service.status === 'online' ? 'bg-green-500' :
                                            service.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                            }`} />
                                        <span className="text-sm font-medium text-gray-700">{service.name}</span>
                                    </div>
                                    <span className={`text-xs font-medium ${service.status === 'online' ? 'text-green-700' : 'text-red-700'}`}>
                                        {service.status === 'online' ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className={`mt-4 p-4 rounded-lg border ${allSystemsOnline ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-start gap-3">
                                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${allSystemsOnline ? 'text-green-600' : 'text-amber-600'}`} />
                                <div>
                                    <p className={`text-sm font-medium ${allSystemsOnline ? 'text-green-800' : 'text-amber-800'}`}>
                                        {allSystemsOnline ? 'Everything is running smoothly' : 'Some services are currently unavailable'}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${allSystemsOnline ? 'text-green-600' : 'text-amber-700'}`}>
                                        Last checked at {lastCheckedLabel}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
