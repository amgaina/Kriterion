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
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { CourseLoadingSkeleton } from '@/components/course/CourseLoading';
import { EnrollStudentModal } from '@/components/course/EnrollStudentModal';
import { BulkEnrollModal } from '@/components/course/BulkEnrollModal';
import { CourseCard, CourseCardGrid } from '@/components/course/CourseCard';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import {
    Plus,
    Search,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    GraduationCap,
} from 'lucide-react';

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
    not_found?: string[];
    already_enrolled?: string[];
}

/** Single enroll response - student not found */
interface EnrollByEmailResponse {
    enrolled?: boolean;
    student_not_found?: boolean;
    message?: string;
    admin_notified?: boolean;
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


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FacultyCoursesPage() {
    const router = useRouter();
    const { user } = useAuth();

    // ========== UI State ==========
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
    const [enrollModal, setEnrollModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [bulkEnrollModal, setBulkEnrollModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

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

    // ========== Helper Functions ==========

    const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
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

    // ========== Render ==========

    return (
        <>
            <div className="space-y-6 pb-8">

                {/* ==================== Notification ==================== */}
                <AnimatePresence mode="wait">
                {notification && (
                    <motion.div
                        key="notification"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className={`relative w-full rounded-lg border p-4 flex items-start gap-3 ${
                        notification.type === 'success'
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        {notification.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : notification.type === 'warning' ? (
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                            <p className="font-semibold text-sm">
                                {notification.type === 'success' ? 'Success' : notification.type === 'warning' ? 'Warning' : 'Error'}
                            </p>
                            <p className="text-sm mt-0.5">{notification.message}</p>
                        </div>
                        <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-black/5">
                            <span className="sr-only">Dismiss</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* ==================== Page Header ==================== */}
                <InnerHeaderDesign
                    title="My Courses"
                    subtitle="Manage your courses, assignments, and enrolled students"
                    actions={
                        <Link
                            href="/faculty/courses/new"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium border border-white/30 transition-all duration-200"
                        >
                            <Plus className="w-4 h-4" />
                            Create Course
                        </Link>
                    }
                />

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
                {isLoading && <CourseLoadingSkeleton count={6} />}

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
                    <CourseCardGrid>
                        {filteredCourses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                variant="faculty"
                                basePath="/faculty/courses"
                                actions={{
                                    onEnroll: () => setEnrollModal({ open: true, course }),
                                    onBulkEnroll: () => setBulkEnrollModal({ open: true, course }),
                                    onEdit: () => {},
                                    onView: () => navigateToCourse(course.id),
                                }}
                            />
                        ))}
                    </CourseCardGrid>
                )}

            </div>

            {/* ==================== Enroll Modals (reusable) ==================== */}
            {enrollModal.course && (
                <EnrollStudentModal
                    courseId={enrollModal.course.id}
                    isOpen={enrollModal.open}
                    onClose={() => setEnrollModal({ open: false })}
                    courseInfo={{ code: enrollModal.course.code, name: enrollModal.course.name }}
                    invalidateKeys={[[...QUERY_KEYS.facultyCourses]]}
                    onSuccess={(data) => {
                        if (data.student_not_found) {
                            showNotification('warning', data.message || 'Student is not in the system. Request has been sent to admin.');
                        } else {
                            showNotification('success', 'Student enrolled successfully!');
                        }
                    }}
                    onError={(err: any) => {
                        const detail = err?.response?.data?.detail;
                        showNotification('error', typeof detail === 'string' ? detail : 'Failed to enroll student');
                    }}
                />
            )}
            {bulkEnrollModal.course && (
                <BulkEnrollModal
                    courseId={bulkEnrollModal.course.id}
                    isOpen={bulkEnrollModal.open}
                    onClose={() => setBulkEnrollModal({ open: false })}
                    courseInfo={{ code: bulkEnrollModal.course.code, name: bulkEnrollModal.course.name }}
                    invalidateKeys={[[...QUERY_KEYS.facultyCourses]]}
                    onSuccess={(data) => {
                        const parts: string[] = [];
                        if (data.enrolled > 0) parts.push(`Enrolled ${data.enrolled}`);
                        const hasNotFound = data.not_found && data.not_found.length > 0;
                        if (hasNotFound) {
                            parts.push(`${data.not_found!.length} not in system`);
                        }
                        if (data.already_enrolled && data.already_enrolled.length > 0) {
                            parts.push(`${data.already_enrolled.length} already enrolled`);
                        }
                        const message = parts.length > 0 ? parts.join('. ') : 'No students enrolled.';
                        const type = hasNotFound ? 'warning' : (data.enrolled > 0 ? 'success' : 'error');
                        showNotification(type, message);
                    }}
                    onError={(err: any) => {
                        showNotification('error', err?.response?.data?.detail || 'Failed to bulk enroll students');
                    }}
                />
            )}

        </>
    );
}
