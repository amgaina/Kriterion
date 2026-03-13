export type ReportGradeStatus = 'graded' | 'ungraded' | 'missing' | 'not_submitted';

type CourseReportAssignmentLike = {
    id: number;
    title: string;
    due_date?: string | null;
};

type CourseReportStudentGradeLike = {
    assignment_id: number;
    status: ReportGradeStatus;
};

type CourseReportStudentLike = {
    id: number;
    assignment_grades?: CourseReportStudentGradeLike[];
};

type CourseReportLike = {
    assignments?: CourseReportAssignmentLike[];
    student_reports?: CourseReportStudentLike[];
};

export type AssignmentStatusSummary = {
    assignmentId: number;
    title: string;
    dueDate?: string | null;
    gradedCount: number;
    ungradedCount: number;
    missingCount: number;
    notSubmittedCount: number;
    totalFlaggedCount: number;
};

export function getAssignmentStatusSummaries(report: CourseReportLike | null | undefined): AssignmentStatusSummary[] {
    if (!report?.assignments?.length) return [];

    const summaryMap = new Map<number, AssignmentStatusSummary>(
        report.assignments.map((assignment) => [
            assignment.id,
            {
                assignmentId: assignment.id,
                title: assignment.title,
                dueDate: assignment.due_date,
                gradedCount: 0,
                ungradedCount: 0,
                missingCount: 0,
                notSubmittedCount: 0,
                totalFlaggedCount: 0,
            },
        ]),
    );

    for (const student of report.student_reports ?? []) {
        for (const grade of student.assignment_grades ?? []) {
            const summary = summaryMap.get(grade.assignment_id);
            if (!summary) {
                continue;
            }

            if (grade.status === 'graded') {
                summary.gradedCount += 1;
            } else if (grade.status === 'ungraded') {
                summary.ungradedCount += 1;
                summary.totalFlaggedCount += 1;
            } else if (grade.status === 'missing') {
                summary.missingCount += 1;
                summary.totalFlaggedCount += 1;
            } else if (grade.status === 'not_submitted') {
                summary.notSubmittedCount += 1;
            }
        }
    }

    return report.assignments.map((assignment) => summaryMap.get(assignment.id)!);
}

export function getStudentIdsMatchingStatuses(
    report: CourseReportLike | null | undefined,
    assignmentIds: number[],
    statuses: ReportGradeStatus[],
): number[] {
    if (!report?.student_reports?.length) return [];

    const targetStatuses = new Set(statuses);
    const targetAssignmentIds = new Set(
        assignmentIds.length > 0
            ? assignmentIds
            : (report.assignments ?? []).map((assignment) => assignment.id),
    );

    return report.student_reports
        .filter((student) =>
            (student.assignment_grades ?? []).some(
                (grade) => targetAssignmentIds.has(grade.assignment_id) && targetStatuses.has(grade.status),
            ),
        )
        .map((student) => student.id);
}