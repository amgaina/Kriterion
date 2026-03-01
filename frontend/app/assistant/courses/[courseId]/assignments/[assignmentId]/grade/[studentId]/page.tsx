'use client';

import { useParams } from 'next/navigation';
import { GradingPageContent } from '@/app/faculty/courses/[courseId]/assignments/[assignmentId]/grade/[studentId]/page';

/**
 * Assistant grading page - uses the same GradingPageContent as faculty.
 * Assistants can ONLY grade; they cannot create/edit assignments or manage courses.
 * Backend enforces: _can_grade_for_course checks CourseAssistant assignment.
 */
export default function AssistantGradingPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const assignmentId = Number(params?.assignmentId);
    const studentId = Number(params?.studentId);
    const assignmentListHref = `/assistant/courses/${courseId}/assignments/${assignmentId}`;

    return (
        <GradingPageContent
            courseId={courseId}
            assignmentId={assignmentId}
            studentId={studentId}
            assignmentListHref={assignmentListHref}
            isAssistant={true}
        />
    );
}
