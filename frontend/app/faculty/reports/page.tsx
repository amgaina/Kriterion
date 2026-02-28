'use client';

import { useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import {
    Download,
    TrendingUp,
    Users,
    FileCode,
    BarChart3,
    PieChart,
    Calendar,
    BookOpen,
    CheckCircle,
    Clock,
    AlertCircle,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

interface CourseStats {
    id: string;
    name: string;
    code: string;
    students: number;
    averageGrade: number;
    submissionRate: number;
    completionRate: number;
}

interface AssignmentStats {
    id: string;
    title: string;
    course: string;
    submissions: number;
    totalStudents: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
}

export default function FacultyReportsPage() {
    const [selectedCourse, setSelectedCourse] = useState<string>('all');
    const [dateRange, setDateRange] = useState('month');
    const [activeTab, setActiveTab] = useState('courses');

    // Using mock data - in real app would fetch from API
    const isLoading = false;

    // Mock data
    const courseStats: CourseStats[] = [
        { id: '1', name: 'Introduction to Programming', code: 'CS101', students: 45, averageGrade: 78.5, submissionRate: 92, completionRate: 88 },
        { id: '2', name: 'Data Structures', code: 'CS201', students: 32, averageGrade: 72.3, submissionRate: 85, completionRate: 80 },
        { id: '3', name: 'Algorithms', code: 'CS301', students: 28, averageGrade: 68.7, submissionRate: 78, completionRate: 75 },
    ];

    const assignmentStats: AssignmentStats[] = [
        { id: '1', title: 'Hello World', course: 'CS101', submissions: 45, totalStudents: 45, averageScore: 95, highestScore: 100, lowestScore: 70, passRate: 100 },
        { id: '2', title: 'Variables and Data Types', course: 'CS101', submissions: 43, totalStudents: 45, averageScore: 88, highestScore: 100, lowestScore: 55, passRate: 95 },
        { id: '3', title: 'Control Flow Statements', course: 'CS101', submissions: 38, totalStudents: 45, averageScore: 75, highestScore: 100, lowestScore: 40, passRate: 82 },
        { id: '4', title: 'Linked List Implementation', course: 'CS201', submissions: 28, totalStudents: 32, averageScore: 68, highestScore: 95, lowestScore: 30, passRate: 71 },
        { id: '5', title: 'Binary Search Tree', course: 'CS201', submissions: 20, totalStudents: 32, averageScore: 62, highestScore: 90, lowestScore: 25, passRate: 65 },
    ];

    const gradeDistribution = [
        { grade: 'A (90-100)', count: 25, percentage: 24 },
        { grade: 'B (80-89)', count: 32, percentage: 30 },
        { grade: 'C (70-79)', count: 28, percentage: 27 },
        { grade: 'D (60-69)', count: 12, percentage: 11 },
        { grade: 'F (<60)', count: 8, percentage: 8 },
    ];

    const recentActivity = [
        { type: 'submission', student: 'John Smith', assignment: 'Control Flow', time: '5 mins ago' },
        { type: 'graded', student: 'Jane Doe', assignment: 'Variables', time: '15 mins ago' },
        { type: 'submission', student: 'Bob Wilson', assignment: 'Linked List', time: '32 mins ago' },
        { type: 'late', student: 'Alice Brown', assignment: 'Control Flow', time: '1 hour ago' },
    ];

    const totalStudents = courseStats.reduce((acc, c) => acc + c.students, 0);
    const overallAverage = (courseStats.reduce((acc, c) => acc + c.averageGrade, 0) / courseStats.length).toFixed(1);
    const overallSubmissionRate = (courseStats.reduce((acc, c) => acc + c.submissionRate, 0) / courseStats.length).toFixed(0);

    const handleExportGrades = () => {
        // In real app, this would generate and download a CSV/Excel file
        alert('Exporting grades to CSV...');
    };

    const handleExportReport = () => {
        // In real app, this would generate a PDF report
        alert('Generating PDF report...');
    };

    return (
        <div className="space-y-6">
                    <InnerHeaderDesign
                        title="Reports & Analytics"
                        subtitle="Track student performance and course metrics"
                        actions={
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleExportGrades}
                                    className="border-white/30 text-white hover:bg-white/20 hover:text-white"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export Grades
                                </Button>
                                <Button
                                    onClick={handleExportReport}
                                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                                >
                                    <FileCode className="w-4 h-4 mr-2" />
                                    Generate Report
                                </Button>
                            </>
                        }
                    />

                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <select
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                >
                                    <option value="all">All Courses</option>
                                    {courseStats.map((c) => (
                                        <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                    ))}
                                </select>
                                <select
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                >
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="semester">This Semester</option>
                                    <option value="year">This Year</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Overview Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Total Students</p>
                                        <p className="text-2xl font-bold">{totalStudents}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-blue-600" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                                    <ArrowUp className="w-3 h-3" />
                                    <span>+5 this week</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Class Average</p>
                                        <p className="text-2xl font-bold">{overallAverage}%</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-green-600" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                                    <ArrowUp className="w-3 h-3" />
                                    <span>+2.3% from last month</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Submission Rate</p>
                                        <p className="text-2xl font-bold">{overallSubmissionRate}%</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <FileCode className="w-5 h-5 text-orange-600" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-red-600">
                                    <ArrowDown className="w-3 h-3" />
                                    <span>-3% from last week</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Pending Grading</p>
                                        <p className="text-2xl font-bold">23</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-purple-600" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                                    <span>5 overdue</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs
                        tabs={[
                            { id: 'courses', label: 'Course Performance' },
                            { id: 'assignments', label: 'Assignment Analytics' },
                            { id: 'grades', label: 'Grade Distribution' }
                        ]}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />

                    {/* Course Performance Tab */}
                    {activeTab === 'courses' && (
                        <TabPanel>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {courseStats.map((course) => (
                                    <Card key={course.id}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="default">{course.code}</Badge>
                                                <BookOpen className="w-5 h-5 text-gray-400" />
                                            </div>
                                            <CardTitle className="text-lg">{course.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-500">Students</span>
                                                <span className="font-medium">{course.students}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="text-gray-500">Average Grade</span>
                                                    <span className="font-medium">{course.averageGrade}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-[#862733]"
                                                        style={{ width: `${course.averageGrade}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="text-gray-500">Submission Rate</span>
                                                    <span className="font-medium">{course.submissionRate}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-green-500"
                                                        style={{ width: `${course.submissionRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="text-gray-500">Completion Rate</span>
                                                    <span className="font-medium">{course.completionRate}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-blue-500"
                                                        style={{ width: `${course.completionRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabPanel>
                    )}

                    {/* Assignment Analytics Tab */}
                    {activeTab === 'assignments' && (
                        <TabPanel>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Assignment Performance</CardTitle>
                                    <CardDescription>Detailed statistics for each assignment</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-3 px-4 font-medium text-gray-600">Assignment</th>
                                                    <th className="text-left py-3 px-4 font-medium text-gray-600">Course</th>
                                                    <th className="text-center py-3 px-4 font-medium text-gray-600">Submissions</th>
                                                    <th className="text-center py-3 px-4 font-medium text-gray-600">Avg Score</th>
                                                    <th className="text-center py-3 px-4 font-medium text-gray-600">High/Low</th>
                                                    <th className="text-center py-3 px-4 font-medium text-gray-600">Pass Rate</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {assignmentStats.map((a) => (
                                                    <tr key={a.id} className="border-b hover:bg-gray-50">
                                                        <td className="py-3 px-4">
                                                            <p className="font-medium text-gray-900">{a.title}</p>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <Badge variant="default">{a.course}</Badge>
                                                        </td>
                                                        <td className="text-center py-3 px-4">
                                                            <span className="font-medium">{a.submissions}</span>
                                                            <span className="text-gray-500">/{a.totalStudents}</span>
                                                        </td>
                                                        <td className="text-center py-3 px-4">
                                                            <Badge variant={a.averageScore >= 70 ? 'success' : a.averageScore >= 60 ? 'warning' : 'danger'}>
                                                                {a.averageScore}%
                                                            </Badge>
                                                        </td>
                                                        <td className="text-center py-3 px-4">
                                                            <span className="text-green-600">{a.highestScore}</span>
                                                            <span className="text-gray-400"> / </span>
                                                            <span className="text-red-600">{a.lowestScore}</span>
                                                        </td>
                                                        <td className="text-center py-3 px-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                                                    <div
                                                                        className={`h-2 rounded-full ${a.passRate >= 80 ? 'bg-green-500' : a.passRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                        style={{ width: `${a.passRate}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-sm">{a.passRate}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabPanel>
                    )}

                    {/* Grade Distribution Tab */}
                    {activeTab === 'grades' && (
                        <TabPanel>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Grade Distribution</CardTitle>
                                        <CardDescription>Breakdown of student grades</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {gradeDistribution.map((item) => (
                                            <div key={item.grade}>
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="font-medium">{item.grade}</span>
                                                    <span className="text-gray-500">{item.count} students ({item.percentage}%)</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-4">
                                                    <div
                                                        className={`h-4 rounded-full ${item.grade.startsWith('A') ? 'bg-green-500' :
                                                            item.grade.startsWith('B') ? 'bg-blue-500' :
                                                                item.grade.startsWith('C') ? 'bg-yellow-500' :
                                                                    item.grade.startsWith('D') ? 'bg-orange-500' :
                                                                        'bg-red-500'
                                                            }`}
                                                        style={{ width: `${item.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Recent Activity</CardTitle>
                                        <CardDescription>Latest student submissions and grading</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {recentActivity.map((activity, index) => (
                                                <div key={index} className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.type === 'submission' ? 'bg-blue-100' :
                                                        activity.type === 'graded' ? 'bg-green-100' :
                                                            'bg-red-100'
                                                        }`}>
                                                        {activity.type === 'submission' ? (
                                                            <FileCode className={`w-4 h-4 text-blue-600`} />
                                                        ) : activity.type === 'graded' ? (
                                                            <CheckCircle className={`w-4 h-4 text-green-600`} />
                                                        ) : (
                                                            <AlertCircle className={`w-4 h-4 text-red-600`} />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {activity.student}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {activity.type === 'submission' && 'Submitted'}
                                                            {activity.type === 'graded' && 'Graded'}
                                                            {activity.type === 'late' && 'Late submission'}
                                                            {' '}{activity.assignment}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-gray-400">{activity.time}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabPanel>
                    )}
                    </div>
    );
}
