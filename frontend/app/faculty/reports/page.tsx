'use client';

import { useMemo, useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    student_reports?: {
        id: number;
        name: string;
        email: string;
        student_id?: string | null;
        average_score?: number | null;
        completed_assignments: number;
        total_assignments: number;
    }[];
};

export default function FacultyReportsPage() {
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

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
            const blob = await apiClient.exportCourseReport(effectiveCourseId);
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
                            className="border-white/30 text-white hover:bg-white/20 hover:text-white"
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
                                onChange={(e) => setSelectedCourseId(Number(e.target.value) || null)}
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
                                                <Badge
                                                    variant={
                                                        s.average_score >= 90
                                                            ? 'success'
                                                            : s.average_score >= 75
                                                                ? 'warning'
                                                                : 'default'
                                                    }
                                                >
                                                    {s.average_score.toFixed(1)}%
                                                </Badge>
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