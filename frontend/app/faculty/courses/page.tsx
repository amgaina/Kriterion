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
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
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
    start_date?: string | null;
    end_date?: string | null;
    instructor_id: number;
    is_active: boolean;
    status: CourseStatus;
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
    start_date?: string;
    end_date?: string;
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
    const [enrollModal, setEnrollModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [bulkEnrollModal, setBulkEnrollModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // ========== Form State ==========
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

    /** Enroll single student mutation */
    const enrollMutation = useMutation({
        mutationFn: async ({ courseId, email }: { courseId: number; email: string }) => {
            return apiClient.enrollStudentByEmail(courseId, email);
        },
        onSuccess: (_, { courseId }) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.facultyCourses });
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
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.facultyCourses });
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
        <>
                <div className="space-y-6 pb-8">

                    {/* ==================== Notification ==================== */}
                    {notification && (
                        <div className={`relative w-full rounded-lg border p-4 flex items-start gap-3 ${
                            notification.type === 'success'
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                            {notification.type === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{notification.type === 'success' ? 'Success' : 'Error'}</p>
                                <p className="text-sm mt-0.5">{notification.message}</p>
                            </div>
                            <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">
                                <span className="sr-only">Dismiss</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
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
                        </div>
                    </div>

                    {/* ==================== Error State ==================== */}
                    {isError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold text-sm text-red-800">Failed to load courses</p>
                                <p className="text-sm text-red-700 mt-0.5">{(error as any)?.message || 'An error occurred while loading courses.'}</p>
                            </div>
                            <button
                                onClick={() => refetch()}
                                className="px-3 py-1.5 text-sm border border-red-300 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* ==================== Search & Filters ==================== */}

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
        </>
    );
}
