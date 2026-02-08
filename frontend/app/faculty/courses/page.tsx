'use client';

/**
 * Faculty Courses Page
 * 
 * This page displays all courses taught by the faculty member.
 * Features:
 * - Beautiful card-based responsive layout
 * - Each course card is clickable and navigates to course details
 * - Real-time data from backend with caching
 * - Create new courses
 * - Enroll students (single or bulk)
 * - Search and filter courses
 * - Statistics overview
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import {
    BookOpen,
    Plus,
    Search,
    Users,
    FileText,
    Calendar,
    Clock,
    UserPlus,
    Upload,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    GraduationCap,
    ArrowRight
} from 'lucide-react';
import { Edit, Trash2 } from 'lucide-react';

// ============================================================================
// TYPES - Matching Backend Models
// ============================================================================

/** Course status enum matching backend CourseStatus */
type CourseStatus = 'draft' | 'active' | 'archived';

/** Course interface matching backend Course model with computed fields */
interface Course {
    id: number;
    code: string;
    name: string;
    description: string | null;
    section: string | null;
    semester: string;
    year: number;
    instructor_id: number;
    is_active: boolean;
    status: CourseStatus;
    students_count: number;
    assignments_count: number;
    created_at: string;
    color?: string | null;
    allow_late_submissions?: boolean;
    default_late_penalty?: number;
    updated_at?: string;
}

/** New course creation payload */
interface NewCourse {
    code: string;
    name: string;
    description: string;
    section: string;
    semester: string;
    year: number;
}

/** Bulk enrollment response from backend */
interface BulkEnrollResponse {
    enrolled: number;
    failed: number;
    errors: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Query keys for React Query cache management */
const QUERY_KEYS = {
    facultyCourses: ['faculty-courses'] as const,
    courseStudents: (courseId: number) => ['course-students', courseId] as const,
};

/** Cache configuration for optimal performance */
const CACHE_CONFIG = {
    staleTime: 5 * 60 * 1000,      // 5 minutes - data considered fresh
    gcTime: 30 * 60 * 1000,        // 30 minutes - garbage collection time
    refetchOnWindowFocus: false,   // Don't refetch on tab focus
    refetchOnMount: false,         // Use cached data on mount
};

/** Course card color schemes based on status */
const COURSE_COLORS = {
    active: {
        bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
        light: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200'
    },
    draft: {
        bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
        light: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200'
    },
    archived: {
        bg: 'bg-gradient-to-br from-gray-400 to-gray-600',
        light: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200'
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date string to readable format
 */
const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

/**
 * Get initials from course code for avatar
 */
const getCourseInitials = (code: string): string => {
    return code.replace(/[^A-Z]/g, '').slice(0, 2) || code.slice(0, 2).toUpperCase();
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FacultyCoursesPage() {
    const router = useRouter();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // ========== UI State ==========
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
    const [createModal, setCreateModal] = useState(false);
    const [enrollModal, setEnrollModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [bulkEnrollModal, setBulkEnrollModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // ========== Form State ==========
    const [newCourse, setNewCourse] = useState<NewCourse>({
        code: '',
        name: '',
        description: '',
        section: '',
        semester: 'Spring',
        year: new Date().getFullYear(),
    });
    const [editCourseId, setEditCourseId] = useState<number | null>(null);
    const [enrollEmail, setEnrollEmail] = useState('');
    const [bulkEmails, setBulkEmails] = useState('');

    // ========== Data Fetching ==========
    const {
        data: courses = [],
        isLoading,
        isError,
        error,
        isFetching,
        refetch
    } = useQuery({
        queryKey: QUERY_KEYS.facultyCourses,
        queryFn: async () => {
            const data = await apiClient.getCourses();
            return data as Course[];
        },
        ...CACHE_CONFIG,
    });

    // ========== Mutations ==========

    /** Create new course mutation */
    const createMutation = useMutation({
        mutationFn: (data: NewCourse) => apiClient.createCourse(data),
        onSuccess: (newCourse) => {
            queryClient.setQueryData<Course[]>(QUERY_KEYS.facultyCourses, (old = []) => {
                return [...old, { ...newCourse, students_count: 0, assignments_count: 0 }];
            });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.facultyCourses });
            setCreateModal(false);
            resetNewCourseForm();
            showNotification('success', 'Course created successfully!');
        },
        onError: (error: any) => {
            showNotification('error', error.response?.data?.detail || 'Failed to create course');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: NewCourse }) => apiClient.updateCourse(id, data),
        onSuccess: (updated: any) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.facultyCourses });
            setCreateModal(false);
            setEditCourseId(null);
            resetNewCourseForm();
            showNotification('success', 'Course updated successfully');
        },
        onError: (err: any) => {
            showNotification('error', err.response?.data?.detail || 'Failed to update course');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => apiClient.deleteCourse(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.facultyCourses });
            showNotification('success', 'Course deleted');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to delete course')
    });

    /** Enroll single student mutation */
    const enrollMutation = useMutation({
        mutationFn: async ({ courseId, email }: { courseId: number; email: string }) => {
            return apiClient.enrollStudentByEmail(courseId, email);
        },
        onSuccess: (_, { courseId }) => {
            queryClient.setQueryData<Course[]>(QUERY_KEYS.facultyCourses, (old = []) => {
                return old.map(c => c.id === courseId ? { ...c, students_count: c.students_count + 1 } : c);
            });
            setEnrollModal({ open: false });
            setEnrollEmail('');
            showNotification('success', 'Student enrolled successfully!');
        },
        onError: (error: any) => {
            showNotification('error', error.response?.data?.detail || 'Failed to enroll student');
        },
    });

    /** Bulk enroll students mutation */
    const bulkEnrollMutation = useMutation({
        mutationFn: async ({ courseId, emails }: { courseId: number; emails: string[] }) => {
            return apiClient.bulkEnrollStudents(courseId, emails) as Promise<BulkEnrollResponse>;
        },
        onSuccess: (data, { courseId }) => {
            queryClient.setQueryData<Course[]>(QUERY_KEYS.facultyCourses, (old = []) => {
                return old.map(c => c.id === courseId ? { ...c, students_count: c.students_count + data.enrolled } : c);
            });
            setBulkEnrollModal({ open: false });
            setBulkEmails('');
            const message = data.failed > 0
                ? `Enrolled ${data.enrolled} students. ${data.failed} failed.`
                : `Successfully enrolled ${data.enrolled} students!`;
            showNotification('success', message);
        },
        onError: (error: any) => {
            showNotification('error', error.response?.data?.detail || 'Failed to bulk enroll students');
        },
    });

    // ========== Helper Functions ==========

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const resetNewCourseForm = () => {
        setNewCourse({
            code: '',
            name: '',
            description: '',
            section: '',
            semester: 'Spring',
            year: new Date().getFullYear(),
        });
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.facultyCourses });
        refetch();
    };

    const handleBulkEnroll = () => {
        if (!bulkEnrollModal.course) return;
        const emails = bulkEmails
            .split(/[\n,;]+/)
            .map(e => e.trim().toLowerCase())
            .filter(e => e && e.includes('@'));
        if (emails.length > 0) {
            bulkEnrollMutation.mutate({ courseId: bulkEnrollModal.course.id, emails });
        }
    };

    const navigateToCourse = (courseId: number) => {
        router.push(`/faculty/courses/${courseId}`);
    };

    // ========== Computed Values ==========

    /** Filter courses based on search and status */
    const filteredCourses = useMemo(() => {
        let result = courses;

        // Filter by status
        if (statusFilter !== 'all') {
            result = result.filter(c => c.status === statusFilter);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(course =>
                course.name.toLowerCase().includes(query) ||
                course.code.toLowerCase().includes(query) ||
                course.description?.toLowerCase().includes(query) ||
                course.section?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [courses, searchQuery, statusFilter]);

    /** Calculate statistics */
    const stats = useMemo(() => ({
        totalCourses: courses.length,
        totalStudents: courses.reduce((acc, c) => acc + c.students_count, 0),
        totalAssignments: courses.reduce((acc, c) => acc + c.assignments_count, 0),
        activeCourses: courses.filter(c => c.status === 'active' && c.is_active).length,
        draftCourses: courses.filter(c => c.status === 'draft').length,
        archivedCourses: courses.filter(c => c.status === 'archived').length,
    }), [courses]);

    /** Get status badge component */
    const getStatusBadge = (course: Course) => {
        if (!course.is_active) {
            return <Badge variant="default" className="text-xs">Inactive</Badge>;
        }
        const variants: Record<CourseStatus, { variant: 'success' | 'warning' | 'default'; label: string }> = {
            active: { variant: 'success', label: 'Active' },
            draft: { variant: 'warning', label: 'Draft' },
            archived: { variant: 'default', label: 'Archived' }
        };
        const config = variants[course.status] || variants.active;
        return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
    };

    // ========== Render ==========

    return (
        <ProtectedRoute allowedRoles={['FACULTY']}>
            <DashboardLayout>
                <div className="space-y-6 pb-8">

                    {/* ==================== Notification ==================== */}
                    {notification && (
                        <Alert
                            type={notification.type}
                            title={notification.type === 'success' ? 'Success' : 'Error'}
                            onClose={() => setNotification(null)}
                        >
                            {notification.message}
                        </Alert>
                    )}

                    {/* ==================== Page Header ==================== */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                                My Courses
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Manage your courses, assignments, and enrolled students
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isFetching}
                                className="h-9"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </Button>
                            <Button onClick={() => setCreateModal(true)} className="h-9">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Course
                            </Button>
                        </div>
                    </div>

                    {/* ==================== Error State ==================== */}
                    {isError && (
                        <Alert type="error" title="Failed to load courses">
                            <div className="flex items-center justify-between">
                                <span>{(error as any)?.message || 'An error occurred while loading courses.'}</span>
                                <Button variant="outline" size="sm" onClick={() => refetch()}>
                                    Try Again
                                </Button>
                            </div>
                        </Alert>
                    )}

                    {/* ==================== Statistics Cards ==================== */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {/* Total Courses */}
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
                                        <p className="text-xs md:text-sm text-gray-500">Total Courses</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Total Students */}
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                        <Users className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                                        <p className="text-xs md:text-sm text-gray-500">Total Students</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Total Assignments */}
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <FileText className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalAssignments}</p>
                                        <p className="text-xs md:text-sm text-gray-500">Assignments</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Active Courses */}
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.activeCourses}</p>
                                        <p className="text-xs md:text-sm text-gray-500">Active</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ==================== Search & Filters ==================== */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row gap-3">
                                {/* Search Input */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search courses by name, code, or description..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                {/* Status Filter */}
                                <div className="flex gap-2">
                                    <select
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as CourseStatus | 'all')}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="draft">Draft</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            {/* Active filters indicator */}
                            {(searchQuery || statusFilter !== 'all') && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                                    <span>Showing {filteredCourses.length} of {courses.length} courses</span>
                                    <button
                                        onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                                        className="text-[#862733] hover:underline"
                                    >
                                        Clear filters
                                    </button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ==================== Loading State ==================== */}
                    {isLoading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                            {[1, 2, 3].map((i) => (
                                <Card key={i} className="animate-pulse">
                                    <div className="h-32 bg-gray-200 rounded-t-lg" />
                                    <CardContent className="p-4 space-y-3">
                                        <div className="h-5 bg-gray-200 rounded w-3/4" />
                                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                                        <div className="h-4 bg-gray-200 rounded w-full" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* ==================== Empty State ==================== */}
                    {!isLoading && courses.length === 0 && (
                        <Card>
                            <CardContent className="py-16">
                                <div className="text-center">
                                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                                        <GraduationCap className="w-10 h-10 text-gray-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses yet</h3>
                                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                        Create your first course to start managing assignments and enrolling students.
                                    </p>
                                    <Button onClick={() => setCreateModal(true)} size="lg">
                                        <Plus className="w-5 h-5 mr-2" />
                                        Create Your First Course
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ==================== No Results State ==================== */}
                    {!isLoading && courses.length > 0 && filteredCourses.length === 0 && (
                        <Card>
                            <CardContent className="py-12">
                                <div className="text-center">
                                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-1">No courses found</h3>
                                    <p className="text-gray-500">
                                        Try adjusting your search or filter criteria
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ==================== Course Cards Grid ==================== */}
                    {!isLoading && filteredCourses.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                            {filteredCourses.map((course) => {
                                const colorScheme = COURSE_COLORS[course.status] || COURSE_COLORS.active;

                                return (
                                    <Card
                                        key={course.id}
                                        className="group overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-md"
                                        onClick={() => navigateToCourse(course.id)}
                                    >
                                        {/* Course Header with Gradient */}
                                        <div className={`${colorScheme.bg} p-4 md:p-5 text-white relative overflow-hidden`}>
                                            {/* Background Pattern */}
                                            <div className="absolute inset-0 opacity-10">
                                                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/20" />
                                                <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />
                                            </div>

                                            <div className="relative z-10">
                                                <div className="flex items-start justify-between mb-3">
                                                    {/* Course Code Badge */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">
                                                            {getCourseInitials(course.code)}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-white/90 text-sm">
                                                                {course.code}
                                                            </p>
                                                            {course.section && (
                                                                <p className="text-xs text-white/70">
                                                                    Section {course.section}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">
                                                        {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                                                    </div>
                                                </div>

                                                {/* Course Name */}
                                                <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:underline decoration-white/50">
                                                    {course.name}
                                                </h3>
                                            </div>

                                            {/* Hover Arrow */}
                                            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="w-5 h-5" />
                                            </div>
                                        </div>

                                        {/* Course Body */}
                                        <CardContent className="p-4 md:p-5">
                                            {/* Description */}
                                            {course.description && (
                                                <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                                                    {course.description}
                                                </p>
                                            )}

                                            {/* Stats Row */}
                                            <div className="flex items-center justify-between text-sm mb-4">
                                                <div className="flex items-center gap-4">
                                                    {/* Students Count */}
                                                    <div className="flex items-center gap-1.5 text-gray-600">
                                                        <Users className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium">{course.students_count}</span>
                                                        <span className="text-gray-400 hidden sm:inline">students</span>
                                                    </div>

                                                    {/* Assignments Count */}
                                                    <div className="flex items-center gap-1.5 text-gray-600">
                                                        <FileText className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium">{course.assignments_count}</span>
                                                        <span className="text-gray-400 hidden sm:inline">assignments</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Semester & Date Info */}
                                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>{course.semester} {course.year}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>Created {formatDate(course.created_at)}</span>
                                                </div>
                                            </div>

                                            {/* Action Buttons - Prevent event propagation */}
                                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEnrollModal({ open: true, course });
                                                    }}
                                                >
                                                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                                                    Enroll
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBulkEnrollModal({ open: true, course });
                                                    }}
                                                >
                                                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                                                    Bulk
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs px-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigateToCourse(course.id);
                                                    }}
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs px-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // open edit modal with prefilled data
                                                        setEditCourseId(course.id);
                                                        setNewCourse({
                                                            code: course.code,
                                                            name: course.name,
                                                            description: course.description || '',
                                                            section: course.section || '',
                                                            semester: course.semester,
                                                            year: course.year,
                                                        });
                                                        setCreateModal(true);
                                                    }}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs px-2 text-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm(`Delete course ${course.code}? This cannot be undone.`)) {
                                                            deleteMutation.mutate(course.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* Background refresh indicator */}
                    {isFetching && !isLoading && (
                        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-600 border">
                            <RefreshCw className="w-4 h-4 animate-spin text-[#862733]" />
                            Updating...
                        </div>
                    )}
                </div>

                {/* ==================== Create Course Modal ==================== */}
                <Modal
                    isOpen={createModal}
                    onClose={() => { setCreateModal(false); setEditCourseId(null); resetNewCourseForm(); }}
                    title={editCourseId ? 'Edit Course' : 'Create New Course'}
                    size="lg"
                >
                    <div className="space-y-4">
                        {/* Course Code & Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Course Code <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    placeholder="e.g., CS101"
                                    value={newCourse.code}
                                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value.toUpperCase() })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Unique identifier for the course</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Section
                                </label>
                                <Input
                                    placeholder="e.g., A, B, 001"
                                    value={newCourse.section}
                                    onChange={(e) => setNewCourse({ ...newCourse, section: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Optional section identifier</p>
                            </div>
                        </div>

                        {/* Course Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Course Name <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="e.g., Introduction to Computer Science"
                                value={newCourse.name}
                                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent resize-none text-sm"
                                rows={3}
                                placeholder="Enter a brief description of the course content and objectives..."
                                value={newCourse.description}
                                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                            />
                        </div>

                        {/* Semester & Year */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Semester <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent text-sm"
                                    value={newCourse.semester}
                                    onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })}
                                >
                                    <option value="Spring">Spring</option>
                                    <option value="Summer">Summer</option>
                                    <option value="Fall">Fall</option>
                                    <option value="Winter">Winter</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Year <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="number"
                                    value={newCourse.year}
                                    onChange={(e) => setNewCourse({ ...newCourse, year: parseInt(e.target.value) || new Date().getFullYear() })}
                                    min={2020}
                                    max={2035}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button variant="outline" onClick={() => setCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (editCourseId) {
                                    updateMutation.mutate({ id: editCourseId, data: newCourse });
                                } else {
                                    createMutation.mutate(newCourse);
                                }
                            }}
                            disabled={!newCourse.code.trim() || !newCourse.name.trim() || createMutation.isPending || updateMutation.isPending}
                        >
                            {(createMutation.isPending || updateMutation.isPending) ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    {editCourseId ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    {editCourseId ? 'Update Course' : 'Create Course'}
                                </>
                            )}
                        </Button>
                    </div>
                </Modal>

                {/* ==================== Enroll Student Modal ==================== */}
                <Modal
                    isOpen={enrollModal.open}
                    onClose={() => setEnrollModal({ open: false })}
                    title="Enroll Student"
                    size="md"
                >
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                            Enrolling student in:
                        </p>
                        <p className="font-semibold text-gray-900">
                            {enrollModal.course?.code} - {enrollModal.course?.name}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Student Email
                        </label>
                        <Input
                            type="email"
                            placeholder="student@kriterion.edu"
                            value={enrollEmail}
                            onChange={(e) => setEnrollEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && enrollEmail && enrollModal.course) {
                                    enrollMutation.mutate({ courseId: enrollModal.course.id, email: enrollEmail });
                                }
                            }}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            The student must already have an account in the system.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button variant="outline" onClick={() => setEnrollModal({ open: false })}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => enrollModal.course && enrollMutation.mutate({ courseId: enrollModal.course.id, email: enrollEmail })}
                            disabled={!enrollEmail.trim() || !enrollEmail.includes('@') || enrollMutation.isPending}
                        >
                            {enrollMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Enrolling...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Enroll Student
                                </>
                            )}
                        </Button>
                    </div>
                </Modal>

                {/* ==================== Bulk Enroll Modal ==================== */}
                <Modal
                    isOpen={bulkEnrollModal.open}
                    onClose={() => setBulkEnrollModal({ open: false })}
                    title="Bulk Enroll Students"
                    size="lg"
                >
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                            Bulk enrolling students in:
                        </p>
                        <p className="font-semibold text-gray-900">
                            {bulkEnrollModal.course?.code} - {bulkEnrollModal.course?.name}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Student Emails
                        </label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent font-mono text-sm"
                            rows={8}
                            placeholder="Enter student emails, one per line:&#10;student1@kriterion.edu&#10;student2@kriterion.edu&#10;student3@kriterion.edu"
                            value={bulkEmails}
                            onChange={(e) => setBulkEmails(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            You can paste emails from a spreadsheet. Separate by new lines, commas, or semicolons.
                        </p>
                    </div>

                    {/* Email Counter */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                        {(() => {
                            const validEmails = bulkEmails
                                .split(/[\n,;]+/)
                                .filter(e => e.trim() && e.includes('@')).length;
                            return (
                                <>
                                    {validEmails > 0 ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 text-gray-400" />
                                    )}
                                    <p className="text-sm font-medium text-gray-700">
                                        {validEmails} valid email{validEmails !== 1 ? 's' : ''} detected
                                    </p>
                                </>
                            );
                        })()}
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button variant="outline" onClick={() => setBulkEnrollModal({ open: false })}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkEnroll}
                            disabled={bulkEnrollMutation.isPending || !bulkEmails.split(/[\n,;]+/).filter(e => e.trim() && e.includes('@')).length}
                        >
                            {bulkEnrollMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Enrolling...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Bulk Enroll
                                </>
                            )}
                        </Button>
                    </div>
                </Modal>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
