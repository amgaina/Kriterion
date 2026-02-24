'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import {
    FileCode,
    Search,
    Clock,
    CheckCircle,
    AlertCircle,
    Calendar,
    Filter,
    ChevronRight,
    Play,
    Eye,
    BookOpen
} from 'lucide-react';

interface Assignment {
    id: number;
    title: string;
    description: string;
    course_id: number;
    course_name: string;
    course_code: string;
    due_date: string;
    status: 'pending' | 'submitted' | 'graded' | 'late';
    score?: number;
    max_score: number;
    language: string;
    difficulty: 'easy' | 'medium' | 'hard';
    submission_count: number;
    max_submissions: number;
}

export default function StudentAssignmentsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedCourse, setSelectedCourse] = useState('all');

    const { data: assignments = [], isLoading } = useQuery({
        queryKey: ['student-assignments'],
        queryFn: () => apiClient.getAssignments(),
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['student-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const displayAssignments = assignments;

    const tabs = [
        { id: 'all', label: 'All', icon: <FileCode className="w-4 h-4" /> },
        { id: 'pending', label: 'Pending', icon: <Clock className="w-4 h-4" /> },
        { id: 'submitted', label: 'Submitted', icon: <CheckCircle className="w-4 h-4" /> },
        { id: 'graded', label: 'Graded', icon: <CheckCircle className="w-4 h-4" /> },
        { id: 'late', label: 'Overdue', icon: <AlertCircle className="w-4 h-4" /> },
    ];

    const filteredAssignments = displayAssignments.filter((assignment: Assignment) => {
        const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            assignment.course_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab = activeTab === 'all' || assignment.status === activeTab;
        const matchesCourse = selectedCourse === 'all' || assignment.course_id.toString() === selectedCourse;
        return matchesSearch && matchesTab && matchesCourse;
    });

    const getStatusBadge = (assignment: Assignment) => {
        switch (assignment.status) {
            case 'pending':
                const dueDate = new Date(assignment.due_date);
                const isUrgent = isWithinInterval(dueDate, { start: new Date(), end: addDays(new Date(), 1) });
                return <Badge variant={isUrgent ? 'danger' : 'warning'}>Pending</Badge>;
            case 'submitted':
                return <Badge variant="info">Submitted</Badge>;
            case 'graded':
                return <Badge variant="success">Graded</Badge>;
            case 'late':
                return <Badge variant="danger">Overdue</Badge>;
            default:
                return <Badge variant="default">{assignment.status}</Badge>;
        }
    };

    const getDifficultyBadge = (difficulty: string) => {
        switch (difficulty) {
            case 'easy':
                return <Badge variant="success">Easy</Badge>;
            case 'medium':
                return <Badge variant="warning">Medium</Badge>;
            case 'hard':
                return <Badge variant="danger">Hard</Badge>;
            default:
                return <Badge variant="default">{difficulty}</Badge>;
        }
    };

    const getTimeRemaining = (dueDate: string) => {
        const due = new Date(dueDate);
        if (isPast(due)) return { text: 'Overdue', urgent: true };
        return { text: formatDistanceToNow(due, { addSuffix: true }), urgent: isWithinInterval(due, { start: new Date(), end: addDays(new Date(), 1) }) };
    };

    const pendingCount = displayAssignments.filter((a: Assignment) => a.status === 'pending').length;
    const submittedCount = displayAssignments.filter((a: Assignment) => a.status === 'submitted').length;
    const gradedCount = displayAssignments.filter((a: Assignment) => a.status === 'graded').length;
    const overdueCount = displayAssignments.filter((a: Assignment) => a.status === 'late').length;

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
                            <p className="text-gray-500 mt-1">
                                {pendingCount} pending • {submittedCount} submitted • {gradedCount} graded
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search assignments..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 w-64"
                                />
                            </div>
                            <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/20"
                            >
                                <option value="all">All Courses</option>
                                {(courses.length > 0 ? courses : []).map((course: any) => (
                                    <option key={course.id} value={course.id}>{course.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className={activeTab === 'pending' ? 'ring-2 ring-[#862733]' : ''}>
                            <CardContent className="p-4 cursor-pointer" onClick={() => setActiveTab('pending')}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                                        <p className="text-sm text-gray-500">Pending</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className={activeTab === 'submitted' ? 'ring-2 ring-[#862733]' : ''}>
                            <CardContent className="p-4 cursor-pointer" onClick={() => setActiveTab('submitted')}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <CheckCircle className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{submittedCount}</p>
                                        <p className="text-sm text-gray-500">Submitted</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className={activeTab === 'graded' ? 'ring-2 ring-[#862733]' : ''}>
                            <CardContent className="p-4 cursor-pointer" onClick={() => setActiveTab('graded')}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{gradedCount}</p>
                                        <p className="text-sm text-gray-500">Graded</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className={activeTab === 'late' ? 'ring-2 ring-[#862733]' : ''}>
                            <CardContent className="p-4 cursor-pointer" onClick={() => setActiveTab('late')}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{overdueCount}</p>
                                        <p className="text-sm text-gray-500">Overdue</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabs */}
                    <Card>
                        <CardContent className="p-4">
                            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
                        </CardContent>
                    </Card>

                    {/* Assignments List */}
                    {isLoading ? (
                        <div className="text-center py-12 text-gray-500">Loading assignments...</div>
                    ) : filteredAssignments.length > 0 ? (
                        <div className="space-y-4">
                            {filteredAssignments.map((assignment: Assignment) => {
                                const timeInfo = getTimeRemaining(assignment.due_date);
                                return (
                                    <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-0">
                                            <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4">
                                                {/* Assignment Icon */}
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${assignment.status === 'graded' ? 'bg-green-100' :
                                                    assignment.status === 'submitted' ? 'bg-blue-100' :
                                                        assignment.status === 'late' ? 'bg-red-100' : 'bg-yellow-100'
                                                    }`}>
                                                    <FileCode className={`w-6 h-6 ${assignment.status === 'graded' ? 'text-green-600' :
                                                        assignment.status === 'submitted' ? 'text-blue-600' :
                                                            assignment.status === 'late' ? 'text-red-600' : 'text-yellow-600'
                                                        }`} />
                                                </div>

                                                {/* Assignment Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start gap-2 mb-1">
                                                        <h3 className="font-semibold text-gray-900 truncate">
                                                            {assignment.title}
                                                        </h3>
                                                        {getStatusBadge(assignment)}
                                                        {getDifficultyBadge(assignment.difficulty)}
                                                    </div>
                                                    <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                                                        {assignment.description}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <BookOpen className="w-4 h-4" />
                                                            {assignment.course_code} - {assignment.course_name}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-4 h-4" />
                                                            Due {format(new Date(assignment.due_date), 'MMM dd, yyyy')}
                                                        </span>
                                                        <Badge variant="outline">{assignment.language}</Badge>
                                                    </div>
                                                </div>

                                                {/* Score or Time */}
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    {assignment.status === 'graded' && assignment.score !== undefined ? (
                                                        <div className="text-right">
                                                            <p className="text-2xl font-bold text-[#862733]">{assignment.score}%</p>
                                                            <p className="text-sm text-gray-500">Score</p>
                                                        </div>
                                                    ) : assignment.status !== 'graded' && (
                                                        <div className="text-right">
                                                            <p className={`text-sm font-medium ${timeInfo.urgent ? 'text-red-600' : 'text-gray-600'}`}>
                                                                {timeInfo.text}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {assignment.submission_count}/{assignment.max_submissions} attempts
                                                            </p>
                                                        </div>
                                                    )}

                                                    <Link href={`/student/assignments/${assignment.id}`}>
                                                        <Button
                                                            variant={assignment.status === 'pending' || assignment.status === 'late' ? 'default' : 'outline'}
                                                            size="sm"
                                                        >
                                                            {assignment.status === 'pending' || assignment.status === 'late' ? (
                                                                <>
                                                                    <Play className="w-4 h-4 mr-1" />
                                                                    Start
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Eye className="w-4 h-4 mr-1" />
                                                                    View
                                                                </>
                                                            )}
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <FileCode className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                                <p className="text-gray-500">
                                    {searchQuery ? 'Try adjusting your search criteria' : 'No assignments match the selected filter.'}
                                </p>
                                <Button variant="outline" className="mt-4" onClick={() => { setActiveTab('all'); setSearchQuery(''); }}>
                                    Clear Filters
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
