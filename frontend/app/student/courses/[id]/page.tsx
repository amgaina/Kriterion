'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { format, isPast } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BackLink } from '@/components/ui/BackLink';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { getScoreBgColor, getScoreTextColor } from '@/lib/score-utils';
import {
    BookOpen,
    User,
    Mail,
    FileCode,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Award,
    LayoutDashboard,
    ClipboardList,
    TrendingUp,
    Clock,
    Target,
} from 'lucide-react';

interface Course {
    id: number;
    name: string;
    code: string;
    description?: string | null;
    semester: string;
    year: number;
    section?: string | null;
    color?: string | null;
    instructor_id: number;
    instructor_name?: string | null;
    instructor_email?: string | null;
}

interface Assignment {
    id: number;
    title: string;
    course_id: number;
    max_score: number;
    due_date?: string;
    is_published?: boolean;
}

interface Submission {
    id: number;
    assignment_id: number;
    final_score?: number | null;
    max_score?: number;
    graded_at?: string | null;
    submitted_at?: string | null;
}

function courseGradient(hex: string | null | undefined): React.CSSProperties {
    if (!hex || !hex.startsWith('#')) {
        return { background: 'linear-gradient(135deg, #862733 0%, #6b1f2a 100%)' };
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const darker = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`;
    return { background: `linear-gradient(135deg, ${hex} 0%, ${darker} 100%)` };
}

const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'assignments', label: 'Assignments', icon: ClipboardList },
    { id: 'grades', label: 'Grades', icon: Award },
];

export default function StudentCourseDetailPage() {
    const params = useParams();
    const courseId = Number(params.id);
    const [activeTab, setActiveTab] = useState('overview');

    const { data: course, isLoading: courseLoading, isError: courseError, error: courseErr, refetch: refetchCourse } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId),
        enabled: !!courseId,
    });

    const { data: assignments = [] } = useQuery({
        queryKey: ['student-assignments', courseId],
        queryFn: () => apiClient.getAssignments(courseId),
        enabled: !!courseId,
    });

    const { data: submissions = [] } = useQuery({
        queryKey: ['student-submissions'],
        queryFn: () => apiClient.getSubmissions(),
        staleTime: 2 * 60 * 1000,
    });

    const courseAssignments = (assignments as (Assignment & { is_published?: boolean })[])
        .filter((a) => a.is_published !== false)
        .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime());

    const submissionByAssignment = new Map<number, Submission>();
    (submissions as Submission[]).forEach((s) => {
        const existing = submissionByAssignment.get(s.assignment_id);
        const sGraded = s.final_score != null;
        const eGraded = existing?.final_score != null;
        if (!existing) {
            submissionByAssignment.set(s.assignment_id, s);
        } else if (sGraded && !eGraded) {
            submissionByAssignment.set(s.assignment_id, s);
        } else if (sGraded && eGraded && s.graded_at && existing.graded_at && new Date(s.graded_at) > new Date(existing.graded_at)) {
            submissionByAssignment.set(s.assignment_id, s);
        } else if (!sGraded && !eGraded && s.submitted_at && existing.submitted_at && new Date(s.submitted_at) > new Date(existing.submitted_at)) {
            submissionByAssignment.set(s.assignment_id, s);
        }
    });

    const gradedAssignments = courseAssignments.filter((a) => submissionByAssignment.get(a.id)?.final_score != null);
    const gradedScores: number[] = gradedAssignments.map((a) => {
        const sub = submissionByAssignment.get(a.id)!;
        const max = sub.max_score ?? a.max_score ?? 100;
        return (sub.final_score! / max) * 100;
    });
    const totalGrade = gradedScores.length > 0
        ? Math.round(gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length)
        : null;

    const pendingAssignments = courseAssignments.filter((a) => {
        const sub = submissionByAssignment.get(a.id);
        return !sub || sub.final_score == null;
    });
    const submittedPending = pendingAssignments.filter((a) => !!submissionByAssignment.get(a.id));
    const unsubmitted = pendingAssignments.filter((a) => !submissionByAssignment.get(a.id));
    const overdueCount = unsubmitted.filter((a) => a.due_date && isPast(new Date(a.due_date))).length;

    if (courseError || !courseId) {
        return (
            <div className="min-h-screen bg-gray-50/50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10">
                    <BackLink href="/student/courses" label="Back to Courses" />
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-12 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <p className="font-semibold text-gray-900">Failed to load course</p>
                        <p className="text-sm text-gray-600 mt-1">{(courseErr as Error)?.message || 'Course not found.'}</p>
                        <Button variant="outline" onClick={() => refetchCourse()} className="mt-4">Try Again</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (courseLoading || !course) {
        return (
            <div className="min-h-screen bg-gray-50/50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10">
                    <div className="h-8 w-28 bg-gray-200 rounded animate-pulse mb-4" />
                    <div className="h-48 bg-gray-200 rounded-2xl animate-pulse mb-6" />
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const c = course as Course;

    return (
        <div className="min-h-screen flex flex-col bg-gray-50/50">
            <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-0">
                <BackLink href="/student/courses" label="Back to Courses" />

                {/* Colored banner — matches faculty layout */}
                <div
                    className="sticky top-10 z-20 rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
                    style={courseGradient(c.color)}
                >
                    <div className="px-6 sm:px-8 py-6 sm:py-8">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold shadow-inner px-1.5 flex-shrink-0">
                                    <span
                                        className="text-center leading-none break-words [word-break:break-word]"
                                        style={{ fontSize: 'clamp(10px, 1.1vw, 14px)' }}
                                    >
                                        {c.code ? c.code.slice(0, 2).toUpperCase() : 'CR'}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white/80 text-sm uppercase tracking-wider">
                                        {c.section ? `Section ${c.section}` : 'Course'}
                                    </p>
                                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight mt-0.5">
                                        {c.code} · {c.name}
                                    </h1>
                                    {c.semester && c.year && (
                                        <p className="text-white/70 text-sm mt-1">{c.semester} {c.year}</p>
                                    )}
                                </div>
                            </div>

                            {/* Grade pill on the right */}
                            {totalGrade != null && (
                                <div className="flex-shrink-0 self-start sm:self-auto">
                                    <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2.5">
                                        <TrendingUp className="w-4 h-4 text-white/80" />
                                        <span className="text-white font-semibold text-sm">Current Grade</span>
                                        <span className="text-white font-bold text-lg ml-1">{totalGrade}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-4 sm:px-6 pb-4 pt-0">
                        <nav className="inline-flex items-center gap-1 rounded-xl bg-black/10 backdrop-blur-sm px-1.5 py-1.5">
                            {TABS.map((tab) => {
                                const active = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className="relative block active:scale-[0.98] transition-transform duration-200"
                                    >
                                        <span
                                            className={`relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                                                active
                                                    ? 'text-white'
                                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4 flex-shrink-0" />
                                            {tab.label}
                                        </span>
                                        <AnimatePresence>
                                            {active && (
                                                <motion.span
                                                    layoutId="student-course-tab"
                                                    className="absolute inset-0 z-0 rounded-lg bg-white/25"
                                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                                                    initial={false}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </div>

            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Stat cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <StatCard
                                icon={<ClipboardList className="w-5 h-5" />}
                                label="Total Assignments"
                                value={String(courseAssignments.length)}
                                color="blue"
                            />
                            <StatCard
                                icon={<CheckCircle2 className="w-5 h-5" />}
                                label="Graded"
                                value={String(gradedAssignments.length)}
                                color="green"
                            />
                            <StatCard
                                icon={<Clock className="w-5 h-5" />}
                                label="Submitted"
                                value={String(submittedPending.length)}
                                color="amber"
                            />
                            <StatCard
                                icon={<AlertCircle className="w-5 h-5" />}
                                label="Overdue"
                                value={String(overdueCount)}
                                color={overdueCount > 0 ? 'red' : 'gray'}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* Course info */}
                            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-[#862733]" />
                                    Course Information
                                </h2>
                                <div className="space-y-4">
                                    <InfoRow label="Course" value={`${c.code} — ${c.name}`} />
                                    {c.semester && <InfoRow label="Term" value={`${c.semester} ${c.year}`} />}
                                    {c.section && <InfoRow label="Section" value={c.section} />}
                                    {c.description && <InfoRow label="Description" value={c.description} />}
                                    {(c.instructor_name || c.instructor_email) && (
                                        <div className="pt-3 border-t border-gray-50">
                                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Instructor</p>
                                            <div className="flex flex-col gap-1.5">
                                                {c.instructor_name && (
                                                    <span className="flex items-center gap-2 text-gray-800 text-sm">
                                                        <User className="w-4 h-4 text-[#862733] flex-shrink-0" />
                                                        {c.instructor_name}
                                                    </span>
                                                )}
                                                {c.instructor_email && (
                                                    <a
                                                        href={`mailto:${c.instructor_email}`}
                                                        className="flex items-center gap-2 text-[#862733] hover:underline text-sm"
                                                    >
                                                        <Mail className="w-4 h-4 flex-shrink-0" />
                                                        {c.instructor_email}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Grade summary */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col">
                                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-[#862733]" />
                                    Grade Summary
                                </h2>
                                <div className="flex flex-col items-center justify-center flex-1 gap-4 py-2">
                                    <div
                                        className={`w-24 h-24 rounded-3xl flex items-center justify-center ${
                                            totalGrade != null ? getScoreBgColor(totalGrade) : 'bg-gray-50'
                                        }`}
                                    >
                                        <span
                                            className={`text-2xl font-bold ${
                                                totalGrade != null ? getScoreTextColor(totalGrade) : 'text-gray-400'
                                            }`}
                                        >
                                            {totalGrade != null ? `${totalGrade}%` : '—'}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-gray-500">
                                            {gradedScores.length} of {courseAssignments.length} assignments graded
                                        </p>
                                        {totalGrade == null && (
                                            <p className="text-xs text-gray-400 mt-1">No grades yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pending / Upcoming */}
                        {unsubmitted.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                    Needs Attention ({unsubmitted.length})
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {unsubmitted.map((a) => {
                                        const isOverdue = a.due_date && isPast(new Date(a.due_date));
                                        return (
                                            <Link
                                                key={a.id}
                                                href={`/student/assignments/${a.id}`}
                                                className={`flex items-center gap-3 p-4 rounded-xl border transition-all group hover:shadow-sm ${
                                                    isOverdue
                                                        ? 'border-red-100 bg-red-50/50 hover:border-red-200'
                                                        : 'border-gray-100 hover:border-[#862733]/20 hover:bg-[#862733]/5'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-100' : 'bg-gray-50 group-hover:bg-[#862733]/10'}`}>
                                                    <FileCode className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-gray-400 group-hover:text-[#862733]'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 text-sm truncate">{a.title}</p>
                                                    <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                        {isOverdue ? 'Overdue · ' : 'Due '}
                                                        {a.due_date ? format(new Date(a.due_date), 'MMM d, h:mm a') : '—'}
                                                    </p>
                                                </div>
                                                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isOverdue ? 'text-red-400' : 'text-gray-300 group-hover:text-[#862733]'}`} />
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {pendingAssignments.length === 0 && courseAssignments.length > 0 && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-100">
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                                <p className="text-sm text-green-800 font-medium">All caught up! No pending assignments.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ASSIGNMENTS TAB */}
                {activeTab === 'assignments' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900">All Assignments</h2>
                            <span className="text-sm text-gray-500">{courseAssignments.length} total</span>
                        </div>
                        {courseAssignments.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                                    <FileCode className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-gray-500 font-medium">No assignments yet</p>
                                <p className="text-sm text-gray-400 mt-1">Check back later</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {courseAssignments.map((a) => {
                                    const sub = submissionByAssignment.get(a.id);
                                    const isGraded = sub?.final_score != null;
                                    const isSubmitted = !!sub && !isGraded;
                                    const maxScore = sub?.max_score ?? a.max_score ?? 100;
                                    const isOverdue = a.due_date && isPast(new Date(a.due_date)) && !isGraded && !isSubmitted;
                                    const pct = isGraded ? Math.round((sub!.final_score! / maxScore) * 100) : null;
                                    return (
                                        <Link
                                            key={a.id}
                                            href={`/student/assignments/${a.id}`}
                                            className="flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-gray-50/80 transition-colors group"
                                        >
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                isGraded ? getScoreBgColor(pct!) :
                                                isSubmitted ? 'bg-blue-50' :
                                                isOverdue ? 'bg-red-50' : 'bg-gray-50'
                                            }`}>
                                                {isGraded ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                ) : isSubmitted ? (
                                                    <Clock className="w-5 h-5 text-blue-500" />
                                                ) : isOverdue ? (
                                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                                ) : (
                                                    <FileCode className="w-5 h-5 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 truncate group-hover:text-[#862733] transition-colors">
                                                    {a.title}
                                                </p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                        {isOverdue ? 'Overdue · ' : ''}
                                                        Due {a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : '—'}
                                                    </p>
                                                    {isSubmitted && (
                                                        <span className="text-xs text-blue-600 font-medium">Submitted</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {isGraded ? (
                                                    <ScoreBadge percent={pct!} successThreshold={70} warningThreshold={60}>
                                                        {Math.round(sub!.final_score!)}/{maxScore}
                                                    </ScoreBadge>
                                                ) : (
                                                    <span className="text-sm text-gray-400 tabular-nums">—/{maxScore}</span>
                                                )}
                                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#862733]" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* GRADES TAB */}
                {activeTab === 'grades' && (
                    <div className="space-y-4">
                        {/* Summary bar */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 ${totalGrade != null ? getScoreBgColor(totalGrade) : 'bg-gray-50'}`}>
                                    <span className={`text-xl font-bold ${totalGrade != null ? getScoreTextColor(totalGrade) : 'text-gray-400'}`}>
                                        {totalGrade != null ? `${totalGrade}%` : '—'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-gray-900">Course Average</p>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Based on {gradedScores.length} of {courseAssignments.length} graded assignments
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Per-assignment grades */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-5 sm:px-6 py-4 border-b border-gray-50">
                                <h2 className="font-semibold text-gray-900">Assignment Scores</h2>
                            </div>
                            {courseAssignments.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Award className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No assignments yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {courseAssignments.map((a) => {
                                        const sub = submissionByAssignment.get(a.id);
                                        const isGraded = sub?.final_score != null;
                                        const maxScore = sub?.max_score ?? a.max_score ?? 100;
                                        const pct = isGraded ? Math.round((sub!.final_score! / maxScore) * 100) : null;
                                        return (
                                            <Link
                                                key={a.id}
                                                href={`/student/assignments/${a.id}`}
                                                className="flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-gray-50/80 transition-colors group"
                                            >
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isGraded ? getScoreBgColor(pct!) : 'bg-gray-50'}`}>
                                                    {isGraded ? (
                                                        <span className={`text-sm font-bold ${getScoreTextColor(pct!)}`}>{pct}%</span>
                                                    ) : (
                                                        <FileCode className="w-5 h-5 text-gray-300" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-[#862733] transition-colors">
                                                        {a.title}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {isGraded && sub?.graded_at
                                                            ? `Graded ${format(new Date(sub.graded_at), 'MMM d, yyyy')}`
                                                            : sub ? 'Submitted · Awaiting grade' : 'Not submitted'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    {isGraded ? (
                                                        <div className="text-right">
                                                            <ScoreBadge percent={pct!} successThreshold={70} warningThreshold={60}>
                                                                {Math.round(sub!.final_score!)}/{maxScore}
                                                            </ScoreBadge>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-gray-400 border-gray-200 text-xs">
                                                            —/{maxScore}
                                                        </Badge>
                                                    )}
                                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#862733]" />
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'blue' | 'green' | 'amber' | 'red' | 'gray' }) {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
        gray: 'bg-gray-50 text-gray-400',
    };
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
                {icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-sm text-gray-800 mt-0.5">{value}</p>
        </div>
    );
}
