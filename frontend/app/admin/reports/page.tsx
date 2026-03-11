'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs } from '@/components/ui/tabs';
import { StatsCard } from '@/components/ui/stats-card';
import {
    Download,
    Users,
    BookOpen,
    FileCode,
    TrendingUp,
    TrendingDown,
    Calendar,
    BarChart2,
    PieChart,
    Activity,
    Clock,
    Target,
    Award,
    AlertTriangle,
    CheckCircle,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

interface ReportMetric {
    label: string;
    value: number | string;
    change?: number;
    trend?: 'up' | 'down';
    icon: React.ReactNode;
    color: string;
}

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState('month');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: () => apiClient.getCourses(),
    });

    // Mock data for reports
    const metrics: ReportMetric[] = [
        { label: 'Total Students', value: 450, change: 12, trend: 'up', icon: <Users className="w-5 h-5" />, color: 'blue' },
        { label: 'Active Courses', value: 24, change: 3, trend: 'up', icon: <BookOpen className="w-5 h-5" />, color: 'green' },
        { label: 'Submissions', value: '2,847', change: -5, trend: 'down', icon: <FileCode className="w-5 h-5" />, color: 'purple' },
        { label: 'Avg. Score', value: '78%', change: 4, trend: 'up', icon: <Target className="w-5 h-5" />, color: 'yellow' },
    ];

    const topCourses = [
        { name: 'Intro to Python', students: 120, submissions: 450, avgScore: 85 },
        { name: 'Data Structures', students: 95, submissions: 380, avgScore: 72 },
        { name: 'Algorithms', students: 88, submissions: 320, avgScore: 68 },
        { name: 'Web Development', students: 75, submissions: 290, avgScore: 81 },
        { name: 'Database Systems', students: 72, submissions: 275, avgScore: 76 },
    ];

    const languageStats = [
        { name: 'Python', count: 1250, percentage: 44 },
        { name: 'Java', count: 850, percentage: 30 },
        { name: 'C++', count: 450, percentage: 16 },
        { name: 'JavaScript', count: 200, percentage: 7 },
        { name: 'Other', count: 97, percentage: 3 },
    ];

    const recentActivity = [
        { type: 'submission', message: '25 new submissions in last hour', time: '1h ago' },
        { type: 'grading', message: '180 submissions auto-graded', time: '2h ago' },
        { type: 'enrollment', message: '15 students enrolled in Data Structures', time: '3h ago' },
        { type: 'assignment', message: 'New assignment published: Binary Trees', time: '5h ago' },
    ];

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <BarChart2 className="w-4 h-4" /> },
        { id: 'courses', label: 'Courses', icon: <BookOpen className="w-4 h-4" /> },
        { id: 'students', label: 'Students', icon: <Users className="w-4 h-4" /> },
        { id: 'submissions', label: 'Submissions', icon: <FileCode className="w-4 h-4" /> },
    ];

    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
                            <p className="text-gray-500 mt-1">System-wide statistics and insights</p>
                        </div>
                        <div className="flex gap-2">
                            <Select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                options={[
                                    { value: 'week', label: 'This Week' },
                                    { value: 'month', label: 'This Month' },
                                    { value: 'quarter', label: 'This Quarter' },
                                    { value: 'year', label: 'This Year' },
                                ]}
                                className="w-36"
                            />
                            <Button variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Export Report
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Card>
                        <CardContent className="p-4">
                            <Tabs
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </CardContent>
                    </Card>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Key Metrics */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {metrics.map((metric, index) => (
                                    <Card key={index}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${metric.color}-100`}>
                                                    <span className={`text-${metric.color}-600`}>{metric.icon}</span>
                                                </div>
                                                {metric.trend && (
                                                    <Badge variant={metric.trend === 'up' ? 'success' : 'danger'} className="text-xs">
                                                        {metric.trend === 'up' ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
                                                        {Math.abs(metric.change || 0)}%
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-2xl font-bold text-gray-900 mt-3">{metric.value}</p>
                                            <p className="text-sm text-gray-500">{metric.label}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Submission Trends Chart */}
                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-[#862733]" />
                                            Submission Trends
                                        </CardTitle>
                                        <CardDescription>Daily submissions over the past 30 days</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                                            <div className="text-center text-gray-500">
                                                <BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p>Chart visualization would go here</p>
                                                <p className="text-sm">(Integration with Recharts or Chart.js)</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Language Distribution */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <PieChart className="w-5 h-5 text-[#862733]" />
                                            Language Distribution
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {languageStats.map((lang, index) => (
                                                <div key={index}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-medium">{lang.name}</span>
                                                        <span className="text-sm text-gray-500">{lang.count} ({lang.percentage}%)</span>
                                                    </div>
                                                    <Progress value={lang.percentage} size="sm" />
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Top Courses */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Award className="w-5 h-5 text-[#862733]" />
                                            Top Performing Courses
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {topCourses.map((course, index) => (
                                                <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                                    <div className="w-8 h-8 rounded-full bg-[#862733]/10 flex items-center justify-center text-[#862733] font-bold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-900">{course.name}</p>
                                                        <p className="text-sm text-gray-500">{course.students} students • {course.submissions} submissions</p>
                                                    </div>
                                                    <Badge variant={course.avgScore >= 80 ? 'success' : course.avgScore >= 60 ? 'warning' : 'danger'}>
                                                        {course.avgScore}%
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Recent Activity */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-[#862733]" />
                                            Recent Activity
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {recentActivity.map((activity, index) => (
                                                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.type === 'submission' ? 'bg-blue-100 text-blue-600' :
                                                        activity.type === 'grading' ? 'bg-green-100 text-green-600' :
                                                            activity.type === 'enrollment' ? 'bg-purple-100 text-purple-600' :
                                                                'bg-yellow-100 text-yellow-600'
                                                        }`}>
                                                        {activity.type === 'submission' ? <FileCode className="w-4 h-4" /> :
                                                            activity.type === 'grading' ? <CheckCircle className="w-4 h-4" /> :
                                                                activity.type === 'enrollment' ? <Users className="w-4 h-4" /> :
                                                                    <BookOpen className="w-4 h-4" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-gray-900">{activity.message}</p>
                                                        <p className="text-xs text-gray-500">{activity.time}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Performance Summary */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Target className="w-5 h-5 text-[#862733]" />
                                        Performance Summary
                                    </CardTitle>
                                    <CardDescription>Grade distribution across all courses</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-5 gap-4">
                                        {[
                                            { grade: 'A', range: '90-100%', count: 580, percentage: 20, color: 'green' },
                                            { grade: 'B', range: '80-89%', count: 870, percentage: 31, color: 'blue' },
                                            { grade: 'C', range: '70-79%', count: 725, percentage: 26, color: 'yellow' },
                                            { grade: 'D', range: '60-69%', count: 420, percentage: 15, color: 'orange' },
                                            { grade: 'F', range: '0-59%', count: 252, percentage: 9, color: 'red' },
                                        ].map((grade, index) => (
                                            <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                                                <div className={`text-3xl font-bold ${grade.color === 'green' ? 'text-green-600' :
                                                    grade.color === 'blue' ? 'text-blue-600' :
                                                        grade.color === 'yellow' ? 'text-yellow-600' :
                                                            grade.color === 'orange' ? 'text-orange-600' :
                                                                'text-red-600'
                                                    }`}>
                                                    {grade.grade}
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">{grade.range}</p>
                                                <p className="text-lg font-semibold mt-2">{grade.count}</p>
                                                <p className="text-xs text-gray-500">{grade.percentage}%</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {/* Courses Tab */}
                    {activeTab === 'courses' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Course Performance Report</CardTitle>
                                        <CardDescription>Detailed metrics for all courses</CardDescription>
                                    </div>
                                    <Select
                                        value={selectedCourse}
                                        onChange={(e) => setSelectedCourse(e.target.value)}
                                        options={[
                                            { value: '', label: 'All Courses' },
                                            ...courses.map((c: any) => ({ value: c.id.toString(), label: c.name }))
                                        ]}
                                        className="w-48"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Course</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Students</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Assignments</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Submissions</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Avg Score</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-600">Completion</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topCourses.map((course, index) => (
                                                <tr key={index} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-medium">{course.name}</td>
                                                    <td className="py-3 px-4">{course.students}</td>
                                                    <td className="py-3 px-4">8</td>
                                                    <td className="py-3 px-4">{course.submissions}</td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant={course.avgScore >= 80 ? 'success' : course.avgScore >= 60 ? 'warning' : 'danger'}>
                                                            {course.avgScore}%
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={Math.round((course.submissions / (course.students * 8)) * 100)} size="sm" className="w-20" />
                                                            <span className="text-sm text-gray-500">
                                                                {Math.round((course.submissions / (course.students * 8)) * 100)}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Students Tab */}
                    {activeTab === 'students' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Student Performance Distribution</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm">Excellent (90-100%)</span>
                                                <span className="text-sm text-gray-500">85 students (19%)</span>
                                            </div>
                                            <Progress value={19} variant="success" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm">Good (80-89%)</span>
                                                <span className="text-sm text-gray-500">135 students (30%)</span>
                                            </div>
                                            <Progress value={30} variant="default" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm">Average (70-79%)</span>
                                                <span className="text-sm text-gray-500">112 students (25%)</span>
                                            </div>
                                            <Progress value={25} variant="warning" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm">Below Average (60-69%)</span>
                                                <span className="text-sm text-gray-500">72 students (16%)</span>
                                            </div>
                                            <Progress value={16} variant="warning" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm">At Risk (&lt;60%)</span>
                                                <span className="text-sm text-gray-500">46 students (10%)</span>
                                            </div>
                                            <Progress value={10} variant="danger" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Student Engagement</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                                                <p className="text-3xl font-bold text-[#862733]">87%</p>
                                                <p className="text-sm text-gray-500">On-time submissions</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                                                <p className="text-3xl font-bold text-blue-600">3.2</p>
                                                <p className="text-sm text-gray-500">Avg attempts/assignment</p>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex items-center gap-2 text-yellow-800 mb-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                <span className="font-medium">Attention Required</span>
                                            </div>
                                            <p className="text-sm text-yellow-700">
                                                46 students have scores below 60% and may need additional support.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Submissions Tab */}
                    {activeTab === 'submissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Submission Statistics</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <span className="text-sm text-gray-600">Total Submissions</span>
                                            <span className="font-bold">2,847</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                            <span className="text-sm text-green-700">Passed</span>
                                            <span className="font-bold text-green-700">2,134 (75%)</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                            <span className="text-sm text-red-700">Failed</span>
                                            <span className="font-bold text-red-700">713 (25%)</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                            <span className="text-sm text-yellow-700">Late Submissions</span>
                                            <span className="font-bold text-yellow-700">342 (12%)</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>Execution Results Breakdown</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-green-50 rounded-lg">
                                            <div className="flex items-center gap-2 text-green-700 mb-2">
                                                <CheckCircle className="w-5 h-5" />
                                                <span className="font-medium">All Tests Passed</span>
                                            </div>
                                            <p className="text-2xl font-bold text-green-700">1,845</p>
                                            <p className="text-sm text-green-600">65% of submissions</p>
                                        </div>
                                        <div className="p-4 bg-yellow-50 rounded-lg">
                                            <div className="flex items-center gap-2 text-yellow-700 mb-2">
                                                <AlertTriangle className="w-5 h-5" />
                                                <span className="font-medium">Partial Pass</span>
                                            </div>
                                            <p className="text-2xl font-bold text-yellow-700">512</p>
                                            <p className="text-sm text-yellow-600">18% of submissions</p>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-lg">
                                            <div className="flex items-center gap-2 text-red-700 mb-2">
                                                <AlertTriangle className="w-5 h-5" />
                                                <span className="font-medium">Compilation Error</span>
                                            </div>
                                            <p className="text-2xl font-bold text-red-700">287</p>
                                            <p className="text-sm text-red-600">10% of submissions</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-2 text-gray-700 mb-2">
                                                <Clock className="w-5 h-5" />
                                                <span className="font-medium">Timeout</span>
                                            </div>
                                            <p className="text-2xl font-bold text-gray-700">203</p>
                                            <p className="text-sm text-gray-600">7% of submissions</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
        </ProtectedRoute>
    );
}
