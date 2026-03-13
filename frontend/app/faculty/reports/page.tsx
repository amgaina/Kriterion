'use client';

import { useMemo, useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getAssignmentStatusSummaries, getStudentIdsMatchingStatuses } from '@/lib/course-report-utils';
import { AssignmentAttentionBadges } from '@/components/ui/AssignmentAttentionBadges';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import {
    Download,
    TrendingUp,
    Users,
    FileCode,
    BarChart3,
    BookOpen,
    CheckCircle,
    Clock,
    AlertCircle,
    Filter,
} from 'lucide-react';

type FacultyCourse = {
    id: number;
    code: string;
    name: string;
};

type CourseReport = {
    course: {
        id: number;
        code: string;
        name: string;
        semester?: string | null;
        year?: number | null;
    };
    total_students: number;
    total_assignments: number;
    total_submissions: number;
    course_average_score?: number | null;
    assignments?: {
        id: number;
        title: string;
        max_score: number;
        due_date?: string | null;
    }[];
    student_reports?: {
        id: number;
        name: string;
        email: string;
        student_id?: string | null;
        average_score?: number | null;
        completed_assignments: number;
        total_assignments: number;
        assignment_grades?: {
            assignment_id: number;
            assignment_title: string;
            score?: number | null;
            max_score?: number;
            status: 'graded' | 'ungraded' | 'missing' | 'not_submitted';
            submitted_at?: string | null;
        }[];
    }[];
};

export default function FacultyReportsPage() {
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<number[]>([]);

    const { data: courses = [], isLoading: loadingCourses } = useQuery<FacultyCourse[]>({
        queryKey: ['faculty-courses'],
        queryFn: () => apiClient.getFacultyCourses(),
    });

    const effectiveCourseId = selectedCourseId ?? (courses[0]?.id ?? null);

    const {
        data: courseReport,
        isLoading: loadingReport,
    } = useQuery<CourseReport | null>({
        queryKey: ['course-report', effectiveCourseId],
        enabled: !!effectiveCourseId,
        queryFn: () =>
            effectiveCourseId ? apiClient.getCourseReport(effectiveCourseId) : Promise.resolve(null),
    });

    const isLoading = loadingCourses || loadingReport;

    const currentCourse = useMemo(
        () => courses.find((c) => c.id === effectiveCourseId) || null,
        [courses, effectiveCourseId],
    );

    const assignmentOptions = courseReport?.assignments ?? [];
    const studentOptions = courseReport?.student_reports ?? [];

    const selectedAssignments = useMemo(
        () => assignmentOptions.filter((assignment) => selectedAssignmentIds.includes(assignment.id)),
        [assignmentOptions, selectedAssignmentIds],
    );

    const selectedStudents = useMemo(
        () => studentOptions.filter((student) => selectedStudentIds.includes(student.id)),
        [studentOptions, selectedStudentIds],
    );

    const areAllStudentsSelected =
        studentOptions.length > 0 && selectedStudentIds.length === studentOptions.length;
    const areAllAssignmentsSelected =
        assignmentOptions.length > 0 && selectedAssignmentIds.length === assignmentOptions.length;
    const shouldShowSelectedReport = selectedStudentIds.length > 0 && selectedAssignmentIds.length > 0;
    const assignmentSummaries = useMemo(
        () => getAssignmentStatusSummaries(courseReport),
        [courseReport],
    );
    const totalNeedsGrading = useMemo(
        () => assignmentSummaries.reduce((sum, assignment) => sum + assignment.ungradedCount, 0),
        [assignmentSummaries],
    );
    const totalMissingSubmissions = useMemo(
        () => assignmentSummaries.reduce((sum, assignment) => sum + assignment.missingCount, 0),
        [assignmentSummaries],
    );
    const assignmentSummaryMap = useMemo(
        () => new Map(assignmentSummaries.map((assignment) => [assignment.assignmentId, assignment])),
        [assignmentSummaries],
    );

    const getGradeForAssignment = (
        student: NonNullable<CourseReport['student_reports']>[number],
        assignmentId: number,
    ) => student.assignment_grades?.find((grade) => grade.assignment_id === assignmentId) ?? null;

    const totalStudents = courseReport?.total_students ?? 0;
    const overallAverage = courseReport?.course_average_score ?? null;
    const totalAssignments = courseReport?.total_assignments ?? 0;
    const totalSubmissions = courseReport?.total_submissions ?? 0;

    const gradeDistribution = useMemo(() => {
        const buckets = [
            { label: 'A (90-100)', min: 90, max: 100 },
            { label: 'B (80-89)', min: 80, max: 89.999 },
            { label: 'C (70-79)', min: 70, max: 79.999 },
            { label: 'D (60-69)', min: 60, max: 69.999 },
            { label: 'F (<60)', min: 0, max: 59.999 },
        ];

        const students = courseReport?.student_reports ?? [];
        const totals = buckets.map((b) => ({
            grade: b.label,
            count: 0,
            percentage: 0,
        }));

        const validScores = students
            .map((s) => s.average_score)
            .filter((v): v is number => typeof v === 'number');

        if (!validScores.length) return totals;

        for (const score of validScores) {
            const idx = buckets.findIndex((b) => score >= b.min && score <= b.max);
            if (idx >= 0) totals[idx].count += 1;
        }

        const totalCount = validScores.length;
        return totals.map((t) => ({
            ...t,
            percentage: totalCount ? Math.round((t.count / totalCount) * 100) : 0,
        }));
    }, [courseReport]);

    const handleDownloadCourseReport = async () => {
        if (!effectiveCourseId) return;
        try {
            const blob = await apiClient.exportCourseReport(
                effectiveCourseId,
                selectedStudentIds.length > 0 ? selectedStudentIds : undefined,
                selectedAssignmentIds.length > 0 ? selectedAssignmentIds : undefined,
            );
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `course_report_${courseReport?.course.code || effectiveCourseId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            // eslint-disable-next-line no-alert
            alert('Failed to download report. Please try again.');
        }
    };

    const handleDownloadCanvas = async () => {
        if (!effectiveCourseId) return;
        try {
            const blob = await apiClient.exportCanvasGradebook(effectiveCourseId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `canvas_gradebook_${courseReport?.course.code || effectiveCourseId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            // eslint-disable-next-line no-alert
            alert('Failed to export Canvas gradebook.');
        }
    };

    const applyQuickFilter = (status: 'ungraded' | 'missing') => {
        const matchingAssignmentIds = assignmentSummaries
            .filter((assignment) =>
                status === 'ungraded' ? assignment.ungradedCount > 0 : assignment.missingCount > 0,
            )
            .map((assignment) => assignment.assignmentId);

        const matchingStudentIds = getStudentIdsMatchingStatuses(
            courseReport,
            matchingAssignmentIds,
            [status],
        );

        setSelectedAssignmentIds(matchingAssignmentIds);
        setSelectedStudentIds(matchingStudentIds);
    };

    const clearSelections = () => {
        setSelectedStudentIds([]);
        setSelectedAssignmentIds([]);
    };

    return (
        <div className="space-y-6">
            <InnerHeaderDesign
                title="Course performance"
                subtitle={
                    currentCourse
                        ? `${currentCourse.code} · ${currentCourse.name}`
                        : 'Choose a course to see live performance analytics'
                }
                actions={
                    <>
                        <Button
                            variant="outline"
                            onClick={handleDownloadCanvas}
                            disabled={!effectiveCourseId || isLoading}
                            className="bg-transparent border-white/30 text-white hover:bg-white/20 hover:text-white disabled:bg-transparent disabled:text-white/60"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Canvas gradebook CSV
                        </Button>
                        <Button
                            onClick={handleDownloadCourseReport}
                            disabled={!effectiveCourseId || isLoading}
                            className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                        >
                            <FileCode className="w-4 h-4 mr-2" />
                            Download course report
                        </Button>
                    </>
                }
            />

            {/* Course selector */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <select
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent min-w-[220px]"
                                value={effectiveCourseId ?? ''}
                                onChange={(e) => {
                                    setSelectedCourseId(Number(e.target.value) || null);
                                    setSelectedStudentIds([]);
                                    setSelectedAssignmentIds([]);
                                }}
                            >
                                {courses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.code} · {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {currentCourse && (
                            <div className="text-xs text-gray-500">
                                <span className="font-medium text-gray-700">{currentCourse.code}</span>{' '}
                                · {courseReport?.course.semester} {courseReport?.course.year}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Selection filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Grade report filters</CardTitle>
                    <CardDescription>
                        Select specific students and assignments, or use a quick filter to jump to work that needs attention.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-800">Students</p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {selectedStudentIds.length} selected
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (areAllStudentsSelected) {
                                        setSelectedStudentIds([]);
                                    } else {
                                        setSelectedStudentIds(studentOptions.map((student) => student.id));
                                    }
                                }}
                            >
                                {areAllStudentsSelected ? 'Deselect all' : 'Select all'}
                            </Button>
                        </div>
                        <div className="max-h-44 overflow-auto space-y-2 pr-1">
                            {studentOptions.map((student) => (
                                <label key={student.id} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={selectedStudentIds.includes(student.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedStudentIds((prev) => [...prev, student.id]);
                                            } else {
                                                setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                    />
                                    <span className="truncate">{student.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-800">Assignments</p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {selectedAssignmentIds.length} selected
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (areAllAssignmentsSelected) {
                                        setSelectedAssignmentIds([]);
                                    } else {
                                        setSelectedAssignmentIds(assignmentOptions.map((assignment) => assignment.id));
                                    }
                                }}
                            >
                                {areAllAssignmentsSelected ? 'Deselect all' : 'Select all'}
                            </Button>
                        </div>
                        <div className="max-h-44 overflow-auto space-y-2 pr-1">
                            {assignmentOptions.map((assignment) => {
                                const summary = assignmentSummaryMap.get(assignment.id);

                                return (
                                <label key={assignment.id} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={selectedAssignmentIds.includes(assignment.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedAssignmentIds((prev) => [...prev, assignment.id]);
                                            } else {
                                                setSelectedAssignmentIds((prev) => prev.filter((id) => id !== assignment.id));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                    />
                                    <span className="truncate">{assignment.title}</span>
                                    {summary ? (
                                        <AssignmentAttentionBadges
                                            ungradedCount={summary.ungradedCount}
                                            missingCount={summary.missingCount}
                                            compact
                                            className="ml-auto"
                                        />
                                    ) : null}
                                </label>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
                <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Filter className="w-4 h-4 text-gray-500" /> Quick filters
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('ungraded')}
                            disabled={totalNeedsGrading === 0}
                        >
                            Only ungraded
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => applyQuickFilter('missing')}
                            disabled={totalMissingSubmissions === 0}
                        >
                            Only missing
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearSelections}
                            disabled={selectedStudentIds.length === 0 && selectedAssignmentIds.length === 0}
                        >
                            Clear selections
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Selected students x assignments matrix */}
            {shouldShowSelectedReport ? (
            <Card>
                <CardHeader>
                    <CardTitle>Selected grade report</CardTitle>
                    <CardDescription>
                        Displays selected students&apos; grades across selected assignments.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[820px]">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 sticky left-0 bg-gray-50">Student</th>
                                    {selectedAssignments.map((assignment) => (
                                        <th key={assignment.id} className="text-center py-3 px-4 font-medium text-gray-600 whitespace-nowrap">
                                            {assignment.title}
                                        </th>
                                    ))}
                                    <th className="text-center py-3 px-4 font-medium text-gray-600">Average</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedStudents.map((student) => {
                                    const scores = selectedAssignments
                                        .map((assignment) => getGradeForAssignment(student, assignment.id)?.score)
                                        .filter((value): value is number => typeof value === 'number');
                                    const average = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;

                                    return (
                                        <tr key={student.id} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="py-3 px-4 sticky left-0 bg-white hover:bg-gray-50">
                                                <p className="font-medium text-gray-900">{student.name}</p>
                                                {student.student_id && <p className="text-xs text-gray-500">ID: {student.student_id}</p>}
                                            </td>
                                            {selectedAssignments.map((assignment) => {
                                                const grade = getGradeForAssignment(student, assignment.id);
                                                return (
                                                    <td key={`${student.id}-${assignment.id}`} className="py-3 px-4 text-center">
                                                        {grade?.score != null ? (
                                                            <ScoreBadge percent={grade.score} successThreshold={75} warningThreshold={0}>
                                                                {grade.score.toFixed(1)}%
                                                            </ScoreBadge>
                                                        ) : grade?.status === 'ungraded' ? (
                                                            <Badge variant="warning">Ungraded</Badge>
                                                        ) : grade?.status === 'missing' ? (
                                                            <Badge variant="destructive">Missing</Badge>
                                                        ) : grade?.status === 'not_submitted' ? (
                                                            <span className="text-xs text-gray-500">Not Submitted</span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="py-3 px-4 text-center">
                                                {average != null ? (
                                                    <ScoreBadge percent={average} successThreshold={75} warningThreshold={0}>
                                                        {average.toFixed(1)}%
                                                    </ScoreBadge>
                                                ) : (
                                                    <span className="text-xs text-gray-400">No graded work</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!isLoading && selectedStudents.length === 0 && (
                                    <tr>
                                        <td colSpan={Math.max(2, selectedAssignments.length + 2)} className="py-6 text-center text-sm text-gray-500">
                                            No students selected.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
            ) : (
            <Card>
                <CardContent className="py-6 text-sm text-gray-500">
                    Select at least one student and one assignment to view the selected grade report.
                </CardContent>
            </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Assignment grading visibility</CardTitle>
                    <CardDescription>
                        Track where faculty action is still needed across the course.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {assignmentSummaries.map((assignment) => (
                        <div key={assignment.assignmentId} className="rounded-xl border border-gray-200 p-4 bg-white">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium text-gray-900">{assignment.title}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {assignment.dueDate
                                            ? `Due ${new Date(assignment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                            : 'No due date'}
                                    </p>
                                </div>
                                {assignment.totalFlaggedCount > 0 ? (
                                    <Badge variant="warning">{assignment.totalFlaggedCount} flagged</Badge>
                                ) : (
                                    <Badge variant="success">All clear</Badge>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <AssignmentAttentionBadges
                                    ungradedCount={assignment.ungradedCount}
                                    missingCount={assignment.missingCount}
                                    notSubmittedCount={assignment.notSubmittedCount}
                                />
                            </div>
                        </div>
                    ))}
                    {!isLoading && assignmentSummaries.length === 0 && (
                        <div className="text-sm text-gray-500">No assignments available for this course yet.</div>
                    )}
                </CardContent>
            </Card>

            {/* Key metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Enrolled students</p>
                                <p className="text-2xl font-bold">{isLoading ? '…' : totalStudents}</p>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Students actively enrolled in this course.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Course average</p>
                                <p className="text-2xl font-bold">
                                    {isLoading ? '…' : overallAverage != null ? `${overallAverage.toFixed(1)}%` : '—'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Mean of each student&apos;s current course grade.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Assignments</p>
                                <p className="text-2xl font-bold">{isLoading ? '…' : totalAssignments}</p>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-orange-600" />
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            All assignments associated with this course.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total submissions</p>
                                <p className="text-2xl font-bold">{isLoading ? '…' : totalSubmissions}</p>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            All attempts across assignments in this course.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Needs grading</p>
                                <p className="text-2xl font-bold">{isLoading ? '…' : totalNeedsGrading}</p>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-yellow-700" />
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Latest submissions that still need manual grading.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Missing submissions</p>
                                <p className="text-2xl font-bold">{isLoading ? '…' : totalMissingSubmissions}</p>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Past-due assignments with no submission from enrolled students.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Student-level performance */}
            <Card>
                <CardHeader>
                    <CardTitle>Student course averages</CardTitle>
                    <CardDescription>
                        Current course grade and assignment completion for each enrolled student.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="text-left py-3 px-4 font-medium text-gray-600">Student</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-600">Average grade</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-600">Completed / total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(courseReport?.student_reports ?? []).map((s) => (
                                    <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-gray-900">{s.name}</p>
                                            {s.student_id && (
                                                <p className="text-xs text-gray-500">ID: {s.student_id}</p>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-gray-700">{s.email}</td>
                                        <td className="py-3 px-4 text-center">
                                            {s.average_score != null ? (
                                                <ScoreBadge percent={s.average_score} successThreshold={90} warningThreshold={75}>
                                                    {s.average_score.toFixed(1)}%
                                                </ScoreBadge>
                                            ) : (
                                                <span className="text-xs text-gray-400">No graded work yet</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-[#862733]"
                                                        style={{
                                                            width:
                                                                s.total_assignments > 0
                                                                    ? `${Math.min(
                                                                        100,
                                                                        (s.completed_assignments / s.total_assignments) * 100,
                                                                    ).toFixed(0)}%`
                                                                    : '0%',
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-700">
                                                    {s.completed_assignments}/{s.total_assignments}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading &&
                                    (!courseReport?.student_reports || !courseReport.student_reports.length) && (
                                        <tr>
                                            <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                                                No enrollments found for this course yet.
                                            </td>
                                        </tr>
                                    )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Grade distribution & guidance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Grade distribution</CardTitle>
                        <CardDescription>Based on students&apos; current course averages.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {gradeDistribution.map((item) => (
                            <div key={item.grade}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="font-medium">{item.grade}</span>
                                    <span className="text-gray-500">
                                        {item.count} students ({item.percentage}%)
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-4">
                                    <div
                                        className={`h-4 rounded-full ${item.grade.startsWith('A')
                                                ? 'bg-green-500'
                                                : item.grade.startsWith('B')
                                                    ? 'bg-blue-500'
                                                    : item.grade.startsWith('C')
                                                        ? 'bg-yellow-500'
                                                        : item.grade.startsWith('D')
                                                            ? 'bg-orange-500'
                                                            : 'bg-red-500'
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
                        <CardTitle>Teaching insights</CardTitle>
                        <CardDescription>Use these patterns to adjust instruction.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-gray-600">
                        <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                            <p>
                                A strong &quot;A/B&quot; cluster suggests the class is ready for more challenging
                                material or optional enrichment problems.
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                            <p>
                                Noticeable &quot;D/F&quot; tails often highlight topics that could benefit from a
                                short recap, extra examples, or targeted office hours.
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-600 mt-0.5" />
                            <p>
                                Combine this distribution with the student table above to quickly identify who to
                                proactively reach out to before major deadlines.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}