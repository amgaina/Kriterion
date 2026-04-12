'use client';

import { useMemo, useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getAssignmentStatusSummaries, getStudentIdsMatchingStatuses } from '@/lib/course-report-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import {
    Download,
    TrendingUp,
    Users,
    FileCode,
    BookOpen,
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
                    <CardTitle>Grade report</CardTitle>
                    <CardDescription>
                        Choose which students and assignments to include. Leave filters empty to include everyone and everything.
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
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
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
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                    {assignmentOptions.map((assignment) => (
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
                                </label>
                                    ))}
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

            {/* Simple end of report page */}
        </div>
    );
}