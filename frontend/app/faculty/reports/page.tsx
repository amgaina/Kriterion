'use client';

import { Fragment, useMemo, useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getAssignmentStatusSummaries } from '@/lib/course-report-utils';
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
    Search,
    Mail,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
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
    const [selectedReportColWidths, setSelectedReportColWidths] = useState<Record<string, number>>({
        student: 320,
        average: 180,
    });

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
        staleTime: 30_000,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
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

    const clearSelections = () => {
        setSelectedStudentIds([]);
        setSelectedAssignmentIds([]);
    };

    const getSelectedReportColWidth = (columnKey: string) => {
        if (selectedReportColWidths[columnKey] != null) return selectedReportColWidths[columnKey];
        if (columnKey === 'student') return 320;
        if (columnKey === 'average') return 180;
        return 230;
    };

    const startSelectedReportResize = (columnKey: string, event: React.MouseEvent<HTMLSpanElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = getSelectedReportColWidth(columnKey);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX;
            const nextWidth = Math.max(140, Math.min(520, startWidth + delta));
            setSelectedReportColWidths((prev) => ({ ...prev, [columnKey]: nextWidth }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
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
                                <label
                                    key={student.id}
                                    className="flex items-center gap-2.5 text-sm text-gray-700 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors"
                                >
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
                                return (
                                    <label
                                        key={assignment.id}
                                        className="flex items-center gap-2.5 text-sm text-gray-700 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors"
                                    >
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
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
                <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Filter className="w-4 h-4 text-gray-500" /> Selections
                        </span>
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
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle>Selected Grade Report</CardTitle>
                            <CardDescription>
                                Displays selected students&apos; grades across selected assignments.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">{selectedStudents.length} Students</Badge>
                            <Badge variant="outline">{selectedAssignments.length} Assignments</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto rounded-b-xl border-t border-gray-100">
                        <table className="w-full text-sm min-w-[820px] table-fixed">
                            <thead>
                                <tr className="border-b bg-gray-50/90">
                                    <th
                                        className="text-left py-3 px-4 font-semibold text-gray-600 sticky left-0 bg-gray-50/90 z-10 border-r border-gray-200 relative"
                                        style={{ width: getSelectedReportColWidth('student') }}
                                    >
                                        Student
                                        <span
                                            className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-primary/10"
                                            onMouseDown={(event) => startSelectedReportResize('student', event)}
                                        />
                                    </th>
                                    {selectedAssignments.map((assignment) => (
                                        <th
                                            key={assignment.id}
                                            className="text-center py-3 px-4 font-semibold text-gray-600 whitespace-nowrap max-w-[200px] border-r border-gray-200 relative"
                                            title={assignment.title}
                                            style={{ width: getSelectedReportColWidth(`assignment-${assignment.id}`) }}
                                        >
                                            <span className="inline-block truncate max-w-[180px] align-bottom">
                                                {assignment.title}
                                            </span>
                                            <span
                                                className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-primary/10"
                                                onMouseDown={(event) =>
                                                    startSelectedReportResize(`assignment-${assignment.id}`, event)
                                                }
                                            />
                                        </th>
                                    ))}
                                    <th
                                        className="text-center py-3 px-4 font-semibold text-gray-600 relative"
                                        style={{ width: getSelectedReportColWidth('average') }}
                                    >
                                        Average
                                        <span
                                            className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-primary/10"
                                            onMouseDown={(event) => startSelectedReportResize('average', event)}
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedStudents.map((student) => {
                                    const scores = selectedAssignments
                                        .map((assignment) => getGradeForAssignment(student, assignment.id)?.score)
                                        .filter((value): value is number => typeof value === 'number');
                                    const average = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
                                    const gradedCount = scores.length;

                                    return (
                                        <tr key={student.id} className="border-b last:border-0 odd:bg-white even:bg-gray-50/30 hover:bg-gray-50/70 transition-colors">
                                            <td
                                                className="py-3 px-4 sticky left-0 bg-inherit z-10 border-r border-gray-200"
                                                style={{ width: getSelectedReportColWidth('student') }}
                                            >
                                                <p className="font-medium text-gray-900">{student.name}</p>
                                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                                    {student.student_id ? <span>ID: {student.student_id}</span> : null}
                                                    <span className="text-gray-300">•</span>
                                                    <span>{gradedCount}/{selectedAssignments.length} graded</span>
                                                </div>
                                            </td>
                                            {selectedAssignments.map((assignment) => {
                                                const grade = getGradeForAssignment(student, assignment.id);
                                                return (
                                                    <td
                                                        key={`${student.id}-${assignment.id}`}
                                                        className="py-3 px-4 text-center border-r border-gray-200"
                                                        style={{ width: getSelectedReportColWidth(`assignment-${assignment.id}`) }}
                                                    >
                                                        {grade?.score != null ? (
                                                            <ScoreBadge percent={grade.score} successThreshold={75} warningThreshold={0}>
                                                                {grade.score.toFixed(1)}%
                                                            </ScoreBadge>
                                                        ) : grade?.status === 'ungraded' ? (
                                                            <Badge variant="warning">Needs Grading</Badge>
                                                        ) : grade?.status === 'missing' ? (
                                                            <Badge variant="destructive">Missing</Badge>
                                                        ) : grade?.status === 'not_submitted' ? (
                                                            <Badge variant="outline">Not Submitted</Badge>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td
                                                className="py-3 px-4 text-center"
                                                style={{ width: getSelectedReportColWidth('average') }}
                                            >
                                                {average != null ? (
                                                    <ScoreBadge percent={average} successThreshold={75} warningThreshold={0}>
                                                        {average.toFixed(1)}%
                                                    </ScoreBadge>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">No graded work</span>
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
            <StudentAveragesTable
                students={courseReport?.student_reports ?? []}
                isLoading={isLoading}
            />

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

// ─────────────────────────────────────────────────────────────────────────────
// StudentAveragesTable
// ─────────────────────────────────────────────────────────────────────────────

type StudentReport = NonNullable<CourseReport['student_reports']>[number];

type SortKey = 'name' | 'average_score' | 'completed';
type SortDir = 'asc' | 'desc';

function getLetterGrade(score: number): { letter: string; color: string; bg: string } {
    if (score >= 90) return { letter: 'A', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    if (score >= 80) return { letter: 'B', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
    if (score >= 70) return { letter: 'C', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' };
    if (score >= 60) return { letter: 'D', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
    return { letter: 'F', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
}

function getBarColor(score: number): string {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-yellow-400';
    if (score >= 60) return 'bg-orange-400';
    return 'bg-red-500';
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('');
}

const AVATAR_COLORS = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
];

function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function StudentAveragesTable({
    students,
    isLoading,
}: {
    students: StudentReport[];
    isLoading: boolean;
}) {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedStudentIds, setExpandedStudentIds] = useState<number[]>([]);
    const [showDetailedStatusChips, setShowDetailedStatusChips] = useState(false);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const toggleStudentDetails = (studentId: number) => {
        setExpandedStudentIds((prev) =>
            prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
        );
    };

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return students
            .filter(
                (s) =>
                    !q ||
                    s.name.toLowerCase().includes(q) ||
                    s.email.toLowerCase().includes(q) ||
                    (s.student_id ?? '').toLowerCase().includes(q),
            )
            .sort((a, b) => {
                let cmp = 0;
                if (sortKey === 'name') {
                    cmp = a.name.localeCompare(b.name);
                } else if (sortKey === 'average_score') {
                    cmp = (a.average_score ?? -1) - (b.average_score ?? -1);
                } else if (sortKey === 'completed') {
                    cmp = a.completed_assignments / Math.max(a.total_assignments, 1)
                        - b.completed_assignments / Math.max(b.total_assignments, 1);
                }
                return sortDir === 'asc' ? cmp : -cmp;
            });
    }, [students, search, sortKey, sortDir]);

    const SortIcon = ({ k }: { k: SortKey }) => {
        if (sortKey !== k) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300 ml-1" />;
        return sortDir === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 text-primary ml-1" />
            : <ChevronDown className="w-3.5 h-3.5 text-primary ml-1" />;
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle>Student course averages</CardTitle>
                        <CardDescription className="mt-0.5">
                            Current grade and assignment completion for each enrolled student.
                        </CardDescription>
                    </div>
                    {students.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => setShowDetailedStatusChips((prev) => !prev)}
                            >
                                {showDetailedStatusChips ? 'Use compact status' : 'Show detailed status'}
                            </Button>
                            <div className="relative w-full sm:w-56">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search students…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : students.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Users className="w-10 h-10 mb-3 text-gray-200" />
                        <p className="text-sm font-medium">No enrollments yet</p>
                        <p className="text-xs mt-1">Students will appear here once they enrol in this course.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-gray-50/80">
                                    <th
                                        className="text-left py-2.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide cursor-pointer select-none border-r border-gray-200"
                                        onClick={() => toggleSort('name')}
                                    >
                                        <span className="flex items-center">
                                            Student <SortIcon k="name" />
                                        </span>
                                    </th>
                                    <th className="text-left py-2.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell border-r border-gray-200">
                                        Email
                                    </th>
                                    <th
                                        className="text-center py-2.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide cursor-pointer select-none border-r border-gray-200"
                                        onClick={() => toggleSort('average_score')}
                                    >
                                        <span className="flex items-center justify-center">
                                            Avg Grade <SortIcon k="average_score" />
                                        </span>
                                    </th>
                                    <th
                                        className="text-center py-2.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide cursor-pointer select-none border-r border-gray-200"
                                        onClick={() => toggleSort('completed')}
                                    >
                                        <span className="flex items-center justify-center">
                                            Progress <SortIcon k="completed" />
                                        </span>
                                    </th>
                                    <th className="text-center py-2.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">
                                        Assignment Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                                            No students match &ldquo;{search}&rdquo;
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((s) => {
                                        const pct = s.total_assignments > 0
                                            ? Math.min(100, (s.completed_assignments / s.total_assignments) * 100)
                                            : 0;
                                        const hasScore = s.average_score != null;
                                        const grade = hasScore ? getLetterGrade(s.average_score!) : null;
                                        const barColor = hasScore ? getBarColor(s.average_score!) : 'bg-gray-300';
                                        const initials = getInitials(s.name);
                                        const avatarColor = getAvatarColor(s.name);
                                        const assignmentGrades = s.assignment_grades ?? [];
                                        const statusCounts = assignmentGrades.reduce(
                                            (acc, assignmentGrade) => {
                                                acc[assignmentGrade.status] += 1;
                                                return acc;
                                            },
                                            {
                                                graded: 0,
                                                ungraded: 0,
                                                missing: 0,
                                                not_submitted: 0,
                                            },
                                        );
                                        const notGradedCount =
                                            statusCounts.ungraded + statusCounts.missing + statusCounts.not_submitted;
                                        const isExpanded = expandedStudentIds.includes(s.id);

                                        return (
                                            <Fragment key={s.id}>
                                                <tr className="hover:bg-gray-50/70 transition-colors group">
                                                    {/* Student */}
                                                    <td className="py-3 px-4 border-r border-gray-100">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleStudentDetails(s.id)}
                                                                className="w-5 h-5 rounded border border-gray-200 text-gray-400 hover:text-primary hover:border-primary/30 flex items-center justify-center transition-colors"
                                                                aria-label={isExpanded ? 'Hide assignment details' : 'Show assignment details'}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                            <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900 leading-tight">{s.name}</p>
                                                                <p className="text-[11px] text-gray-400">
                                                                    {s.student_id ? `ID: ${s.student_id}` : s.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Email */}
                                                    <td className="py-3 px-4 hidden md:table-cell border-r border-gray-100">
                                                        <a
                                                            href={`mailto:${s.email}`}
                                                            className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors text-xs"
                                                        >
                                                            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                                            {s.email}
                                                        </a>
                                                    </td>

                                                    {/* Average grade */}
                                                    <td className="py-3 px-4 text-center border-r border-gray-100">
                                                        {hasScore ? (
                                                            <div className="inline-flex items-center gap-2">
                                                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${grade!.bg} ${grade!.color}`}>
                                                                    {grade!.letter}
                                                                </span>
                                                                <span className="text-sm font-semibold text-gray-800">
                                                                    {s.average_score!.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 italic">
                                                                <Clock className="w-3 h-3" /> Not graded
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Progress bar */}
                                                    <td className="py-3 px-4 border-r border-gray-100">
                                                        <div className="flex items-center gap-2.5 justify-center">
                                                            <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden flex-shrink-0">
                                                                <div
                                                                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                                                                    style={{ width: `${pct.toFixed(0)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-medium text-gray-700 tabular-nums w-8">
                                                                {s.completed_assignments}/{s.total_assignments}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Assignment statuses */}
                                                    <td className="py-3 px-4 hidden lg:table-cell">
                                                        {assignmentGrades.length > 0 ? (
                                                            <div className="flex flex-wrap justify-center gap-1.5">
                                                                {showDetailedStatusChips ? (
                                                                    <>
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                            Graded {statusCounts.graded}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-amber-50 text-amber-700 border-amber-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                                            Ungraded {statusCounts.ungraded}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                                            Missing {statusCounts.missing}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-gray-50 text-gray-600 border-gray-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                                                            Not Submitted {statusCounts.not_submitted}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                            Graded {statusCounts.graded}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-slate-50 text-slate-700 border-slate-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                                            Not Graded {notGradedCount}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-300">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-gray-50/40 border-b border-gray-100">
                                                        <td colSpan={5} className="px-4 py-3">
                                                            {assignmentGrades.length > 0 ? (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                                                    {assignmentGrades.map((ag) => (
                                                                        <div
                                                                            key={`${s.id}-${ag.assignment_id}`}
                                                                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex items-center justify-between gap-2"
                                                                        >
                                                                            <p className="text-xs text-gray-700 truncate" title={ag.assignment_title}>
                                                                                {ag.assignment_title}
                                                                            </p>
                                                                            {ag.status === 'graded' ? (
                                                                                <Badge variant="success">
                                                                                    {ag.score != null ? `${ag.score.toFixed(1)}%` : 'Graded'}
                                                                                </Badge>
                                                                            ) : ag.status === 'ungraded' ? (
                                                                                <Badge variant="warning">Ungraded</Badge>
                                                                            ) : ag.status === 'missing' ? (
                                                                                <Badge variant="destructive">Missing</Badge>
                                                                            ) : (
                                                                                <Badge variant="outline">Not Submitted</Badge>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-400">No assignment status data available.</p>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-[11px] text-gray-400">
                                Showing {filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> A (≥90)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> B (≥80)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> C (≥70)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> D (≥60)</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> F</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}