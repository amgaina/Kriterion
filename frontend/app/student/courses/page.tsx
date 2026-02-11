'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    BookOpen,
    Search,
    Calendar,
    Clock,
    FileCode,
    ChevronRight,
    Play,
    Eye,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Trophy,
    TrendingUp,
    Target,
    Zap,
    Flame,
    Award
} from 'lucide-react';
import { format, isPast, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';

interface Course {
    id: number;
    name: string;
    code: string;
    description: string;
    semester: string;
    year: number;
    students_count?: number;
    assignments_count?: number;
    color?: string;
}

interface Assignment {
    id: number;
    title: string;
    description: string;
    course_id: number;
    due_date: string;
    max_score: number;
    difficulty: string;
    is_published: boolean;
    course?: {
        id: number;
        code: string;
        name: string;
    };
}

interface Submission {
    id: number;
    assignment_id: number;
    status: string;
    score: number | null;
    submitted_at: string;
}

export default function StudentCoursesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'courses' | 'assignments'>('assignments');
    const [assignmentFilter, setAssignmentFilter] = useState('all');

    const { data: courses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ['student-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ['student-assignments'],
        queryFn: () => apiClient.getAssignments(),
    });

    const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
        queryKey: ['student-submissions'],
        queryFn: () => apiClient.getSubmissions(),
    });

    // Get assignment status based on submission
    const getAssignmentStatus = (assignmentId: number, dueDate: string) => {
        const submission = submissions.find((s: Submission) => s.assignment_id === assignmentId);
        
        if (submission) {
            if (submission.score !== null) return 'graded';
            return 'submitted';
        }
        
        if (isPast(new Date(dueDate))) return 'overdue';
        return 'pending';
    };

    // Enrich assignments with submission data
    const enrichedAssignments = useMemo(() => {
        return assignments.map((assignment: Assignment) => {
            const submission = submissions.find((s: Submission) => s.assignment_id === assignment.id);
            const status = getAssignmentStatus(assignment.id, assignment.due_date);
            
            return {
                ...assignment,
                submission,
                status,
            };
        });
    }, [assignments, submissions]);

    // Filter assignments
    const filteredAssignments = enrichedAssignments.filter((assignment: any) => {
        const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            assignment.course?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesFilter = assignmentFilter === 'all' || 
            (assignmentFilter === 'pending' && assignment.status === 'pending') ||
            (assignmentFilter === 'submitted' && assignment.status === 'submitted') ||
            (assignmentFilter === 'graded' && assignment.status === 'graded') ||
            (assignmentFilter === 'overdue' && assignment.status === 'overdue');
        
        return matchesSearch && matchesFilter && assignment.is_published;
    });

    // Stats calculations
    const stats = useMemo(() => {
        const totalAssignments = enrichedAssignments.filter((a: any) => a.is_published).length;
        const completedAssignments = enrichedAssignments.filter((a: any) => a.status === 'graded').length;
        const pendingAssignments = enrichedAssignments.filter((a: any) => a.status === 'pending').length;
        const avgScore = enrichedAssignments
            .filter((a: any) => a.submission?.score !== null)
            .reduce((sum: number, a: any) => sum + (a.submission?.score || 0), 0) / 
            (completedAssignments || 1);

        return {
            totalAssignments,
            completedAssignments,
            pendingAssignments,
            avgScore: avgScore.toFixed(1),
        };
    }, [enrichedAssignments]);

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty.toLowerCase()) {
            case 'easy': return 'bg-green-100 text-green-700 border-green-200';
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'hard': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'graded':
                return {
                    icon: CheckCircle2,
                    label: 'Graded',
                    color: 'text-green-600 bg-green-50 border-green-200',
                    iconColor: 'text-green-600'
                };
            case 'submitted':
                return {
                    icon: Clock,
                    label: 'Submitted',
                    color: 'text-blue-600 bg-blue-50 border-blue-200',
                    iconColor: 'text-blue-600'
                };
            case 'overdue':
                return {
                    icon: XCircle,
                    label: 'Overdue',
                    color: 'text-red-600 bg-red-50 border-red-200',
                    iconColor: 'text-red-600'
                };
            default:
                return {
                    icon: AlertCircle,
                    label: 'Pending',
                    color: 'text-orange-600 bg-orange-50 border-orange-200',
                    iconColor: 'text-orange-600'
                };
        }
    };

    const formatDueDate = (dueDate: string) => {
        const date = new Date(dueDate);
        if (isToday(date)) return 'Due Today';
        if (isTomorrow(date)) return 'Due Tomorrow';
        if (isPast(date)) return `Overdue by ${formatDistanceToNow(date)}`;
        return `Due ${formatDistanceToNow(date, { addSuffix: true })}`;
    };

    const getActionButton = (assignment: any) => {
        if (assignment.status === 'graded') {
            return (
                <Link href={`/student/assignments/${assignment.id}`}>
                    <Button size="sm" variant="outline" className="gap-2 border-[#862733] text-[#862733] hover:bg-[#862733] hover:text-white">
                        <Eye className="w-4 h-4" />
                        View Results
                    </Button>
                </Link>
            );
        }
        
        if (assignment.status === 'submitted') {
            return (
                <Link href={`/student/assignments/${assignment.id}`}>
                    <Button size="sm" variant="outline" className="gap-2">
                        <Eye className="w-4 h-4" />
                        View Submission
                    </Button>
                </Link>
            );
        }
        
        return (
            <Link href={`/student/assignments/${assignment.id}`}>
                <Button size="sm" className="gap-2 bg-[#862733] hover:bg-[#6d1f29] text-white">
                    <Play className="w-4 h-4" />
                    {assignment.status === 'overdue' ? 'Submit Late' : 'Start Assignment'}
                </Button>
            </Link>
        );
    };

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header with Tabs */}
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#862733] to-[#b8394a] bg-clip-text text-transparent">
                                    My Learning Dashboard
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    Track your progress and stay on top of assignments
                                </p>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex items-center gap-2 border-b border-gray-200">
                            <button
                                onClick={() => setActiveTab('assignments')}
                                className={`px-4 py-3 font-medium text-sm transition-all relative ${
                                    activeTab === 'assignments'
                                        ? 'text-[#862733] border-b-2 border-[#862733]'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileCode className="w-4 h-4" />
                                    Assignments
                                    <Badge variant="default" className="ml-1">{stats.totalAssignments}</Badge>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('courses')}
                                className={`px-4 py-3 font-medium text-sm transition-all relative ${
                                    activeTab === 'courses'
                                        ? 'text-[#862733] border-b-2 border-[#862733]'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    Courses
                                    <Badge variant="default" className="ml-1">{courses.length}</Badge>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Assignments Tab */}
                    {activeTab === 'assignments' && (
                        <div className="space-y-6">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600 font-medium">Total Assignments</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalAssignments}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                                <Target className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600 font-medium">Completed</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.completedAssignments}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                                                <Trophy className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600 font-medium">Pending</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingAssignments}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                                                <Flame className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600 font-medium">Avg Score</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avgScore}%</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                                                <TrendingUp className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search assignments..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {['all', 'pending', 'submitted', 'graded', 'overdue'].map((filter) => (
                                        <Button
                                            key={filter}
                                            size="sm"
                                            variant={assignmentFilter === filter ? 'default' : 'outline'}
                                            onClick={() => setAssignmentFilter(filter)}
                                            className={assignmentFilter === filter ? 'bg-[#862733] hover:bg-[#6d1f29]' : ''}
                                        >
                                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Assignments List */}
                            {assignmentsLoading || submissionsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <div className="w-16 h-16 border-4 border-[#862733] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-gray-500">Loading assignments...</p>
                                    </div>
                                </div>
                            ) : filteredAssignments.length > 0 ? (
                                <div className="space-y-3">
                                    {filteredAssignments.map((assignment: any) => {
                                        const statusConfig = getStatusConfig(assignment.status);
                                        const StatusIcon = statusConfig.icon;

                                        return (
                                            <Card key={assignment.id} className="hover:shadow-lg transition-all border-l-4 border-l-transparent hover:border-l-[#862733] group">
                                                <CardContent className="p-5">
                                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                                        {/* Left: Assignment Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#862733] transition-colors">
                                                                    {assignment.title}
                                                                </h3>
                                                                <Badge variant="outline" className={`${getDifficultyColor(assignment.difficulty)} border`}>
                                                                    {assignment.difficulty}
                                                                </Badge>
                                                            </div>
                                                            
                                                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                                                {assignment.description}
                                                            </p>

                                                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                                                <div className="flex items-center gap-1.5">
                                                                    <BookOpen className="w-4 h-4" />
                                                                    <span className="font-medium">{assignment.course?.code}</span>
                                                                    <span className="hidden sm:inline">- {assignment.course?.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Award className="w-4 h-4" />
                                                                    <span>{assignment.max_score} points</span>
                                                                </div>
                                                                <div className={`flex items-center gap-1.5 ${isPast(new Date(assignment.due_date)) && assignment.status === 'pending' ? 'text-red-600 font-medium' : ''}`}>
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{formatDueDate(assignment.due_date)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Status & Actions */}
                                                        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 lg:w-48">
                                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusConfig.color} w-full sm:w-auto justify-center`}>
                                                                <StatusIcon className={`w-4 h-4 ${statusConfig.iconColor}`} />
                                                                <span className="font-medium text-sm">{statusConfig.label}</span>
                                                            </div>
                                                            
                                                            {assignment.status === 'graded' && assignment.submission?.score !== null && (
                                                                <div className="w-full sm:w-auto">
                                                                    <div className="text-center mb-1">
                                                                        <span className="text-2xl font-bold text-[#862733]">
                                                                            {assignment.submission.score}
                                                                        </span>
                                                                        <span className="text-gray-500">/{assignment.max_score}</span>
                                                                    </div>
                                                                    <Progress 
                                                                        value={(assignment.submission.score / assignment.max_score) * 100} 
                                                                        className="h-2"
                                                                    />
                                                                </div>
                                                            )}
                                                            
                                                            <div className="w-full sm:w-auto">
                                                                {getActionButton(assignment)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Card className="border-2 border-dashed">
                                    <CardContent className="py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                            <FileCode className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No assignments found</h3>
                                        <p className="text-gray-500">
                                            {searchQuery || assignmentFilter !== 'all'
                                                ? 'Try adjusting your filters or search query.'
                                                : 'No assignments have been published yet.'}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Courses Tab */}
                    {activeTab === 'courses' && (
                        <div className="space-y-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search courses..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {coursesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <div className="w-16 h-16 border-4 border-[#862733] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-gray-500">Loading courses...</p>
                                    </div>
                                </div>
                            ) : courses.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {courses.map((course: Course) => (
                                        <Link key={course.id} href={`/student/courses/${course.id}`}>
                                            <Card className="h-full hover:shadow-xl transition-all group cursor-pointer border-t-4 border-t-[#862733]">
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <Badge variant="default" className="font-mono">
                                                            {course.code}
                                                        </Badge>
                                                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#862733] group-hover:translate-x-1 transition-all" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#862733] transition-colors line-clamp-2">
                                                        {course.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                                                        {course.description || 'No description available'}
                                                    </p>
                                                </CardHeader>
                                                <CardContent className="pt-0">
                                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                                        <span>{course.semester} {course.year}</span>
                                                        {course.assignments_count !== undefined && (
                                                            <span className="font-medium">{course.assignments_count} assignments</span>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <Card className="border-2 border-dashed">
                                    <CardContent className="py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                            <BookOpen className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No courses found</h3>
                                        <p className="text-gray-500">
                                            {searchQuery
                                                ? 'Try adjusting your search query.'
                                                : 'You are not enrolled in any courses yet.'}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
