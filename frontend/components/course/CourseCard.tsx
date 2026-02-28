'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Calendar,
    Clock,
    ChevronRight,
    ArrowRight,
    Edit,
    UserPlus,
    Upload,
    GraduationCap,
    BookOpen,
} from 'lucide-react';

/** Course status for styling */
type CourseStatus = 'active' | 'draft' | 'archived';

/** Minimal course interface - components accept flexible course shapes */
export interface CourseCardData {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    section?: string | null;
    semester?: string;
    year?: number;
    status?: CourseStatus | string;
    is_active?: boolean;
    created_at?: string;
    color?: string | null;
    students_count?: number;
    assignments_count?: number;
    student_count?: number;
    assignment_count?: number;
    instructor_name?: string;
}

/** Role-specific actions */
export type CourseCardVariant = 'faculty' | 'student' | 'admin';

export interface CourseCardActions {
    onEnroll?: (course: CourseCardData) => void;
    onBulkEnroll?: (course: CourseCardData) => void;
    onEdit?: (course: CourseCardData) => void;
    onView?: (course: CourseCardData) => void;
}

export interface CourseCardProps {
    course: CourseCardData;
    variant: CourseCardVariant;
    basePath: string;
    actions?: CourseCardActions;
}

const COURSE_COLORS: Record<string, { bg: string; light: string }> = {
    active: { bg: 'bg-gradient-to-br from-emerald-500 to-teal-600', light: 'bg-emerald-50' },
    draft: { bg: 'bg-gradient-to-br from-amber-500 to-orange-600', light: 'bg-amber-50' },
    archived: { bg: 'bg-gradient-to-br from-gray-400 to-gray-600', light: 'bg-gray-50' },
};

const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const getCourseInitials = (code: string): string => {
    return code.replace(/[^A-Z]/g, '').slice(0, 2) || code.slice(0, 2).toUpperCase();
};

const getStatusLabel = (course: CourseCardData): string => {
    if (course.is_active === false) return 'Archived';
    if (course.status) return String(course.status).charAt(0).toUpperCase() + String(course.status).slice(1);
    return 'Active';
};

const getColorScheme = (course: CourseCardData) => {
    const status = course.status || (course.is_active === false ? 'archived' : 'active');
    return COURSE_COLORS[status] || COURSE_COLORS.active;
};

export function CourseCard({ course, variant, basePath, actions }: CourseCardProps) {
    const router = useRouter();
    const colorScheme = getColorScheme(course);
    const headerStyle = course.color ? { backgroundColor: course.color } : undefined;
    const headerClass = `p-4 md:p-5 text-white relative overflow-hidden ${!course.color ? colorScheme.bg : ''}`;

    const courseUrl = `${basePath}/${course.id}`;
    const handleClick = () => {
        if (actions?.onView) {
            actions.onView(course);
        } else {
            router.push(courseUrl);
        }
    };

    const assignmentsCount =
        course.assignments_count ?? course.assignment_count ?? 0;
    const studentsCount = course.students_count ?? course.student_count ?? 0;
    const semesterYear = [course.semester, course.year].filter(Boolean).join(' ');

    return (
        <Card
            className="group overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-md h-full flex flex-col"
            onClick={handleClick}
        >
            {/* Header */}
            <div className={headerClass} style={headerStyle}>
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/20" />
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">
                                {getCourseInitials(course.code)}
                            </div>
                            <div>
                                <p className="font-semibold text-white/90 text-sm">{course.code}</p>
                                {course.section && (
                                    <p className="text-xs text-white/70">Section {course.section}</p>
                                )}
                            </div>
                        </div>
                        {(variant === 'faculty' || variant === 'admin') && (
                            <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">
                                {getStatusLabel(course)}
                            </div>
                        )}
                    </div>
                    <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:underline decoration-white/50">
                        {course.name}
                    </h3>
                </div>

                {(variant === 'faculty' || variant === 'admin') && (
                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                )}
                {variant === 'student' && (
                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-5 h-5" />
                    </div>
                )}
            </div>

            {/* Body */}
            <CardContent className="p-4 md:p-5 flex-1 flex flex-col">
                {course.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-shrink-0">
                        {course.description}
                    </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>{semesterYear || '—'}</span>
                    </div>
                    {variant === 'student' && assignmentsCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{assignmentsCount} assignments</span>
                        </div>
                    )}
                    {(variant === 'admin' && (assignmentsCount > 0 || studentsCount > 0)) && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>{studentsCount} students</span>
                            <span className="text-gray-300">·</span>
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{assignmentsCount} assignments</span>
                        </div>
                    )}
                    {course.created_at && variant === 'faculty' && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Created {formatDate(course.created_at)}</span>
                        </div>
                    )}
                </div>

                {/* Actions - variant specific */}
                {variant === 'faculty' && actions && (
                    <div
                        className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {actions.onEdit && (
                            <Link href={`${basePath}/new?edit=${course.id}`} onClick={(e) => e.stopPropagation()}>
                                <Button variant="outline" size="sm" className="text-xs px-2" type="button">
                                    <Edit className="w-3.5 h-3.5" />
                                </Button>
                            </Link>
                        )}
                        {actions.onEnroll && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => actions.onEnroll!(course)}
                            >
                                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                                Enroll
                            </Button>
                        )}
                        {actions.onBulkEnroll && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => actions.onBulkEnroll!(course)}
                            >
                                <Upload className="w-3.5 h-3.5 mr-1.5" />
                                Bulk
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs px-2"
                            onClick={() => handleClick()}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                {variant === 'student' && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs"
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(courseUrl);
                            }}
                        >
                            View Course
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                )}

                {variant === 'admin' && actions && (
                    <div
                        className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => handleClick()}
                        >
                            View
                        </Button>
                        {actions.onEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => actions.onEdit!(course)}
                            >
                                <Edit className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        {actions.onEnroll && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => actions.onEnroll!(course)}
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/** Grid wrapper for consistent layout */
export function CourseCardGrid({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 ${className ?? ''}`}
        >
            {children}
        </div>
    );
}
