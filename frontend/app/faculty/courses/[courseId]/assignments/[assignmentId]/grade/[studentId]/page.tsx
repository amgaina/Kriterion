'use client';

import { useParams } from 'next/navigation';
import { GradingPageContent } from '@/components/grading/GradingPageContent';

export default function FacultyGradingPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const assignmentId = Number(params?.assignmentId);
    const studentId = Number(params?.studentId);
    const assignmentListHref = `/faculty/courses/${courseId}/assignments/${assignmentId}`;
    return (
        <GradingPageContent
            courseId={courseId}
            assignmentId={assignmentId}
            studentId={studentId}
            assignmentListHref={assignmentListHref}
        />
    );
}
