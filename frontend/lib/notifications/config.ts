import { UserRole } from '@/contexts/AuthContext';

export type NotificationRole = UserRole;

export const ROLE_NOTIFICATION_TYPES: Record<NotificationRole, readonly string[]> = {
    STUDENT: [
        'assignment_new',
        'assignment_due',
        'assignment_graded',
        'grade_posted',
        'student_enrolled',
    ],
    FACULTY: [
        'submission_received',
        'new_submission_received',
    ],
    ASSISTANT: [
        'submission_received',
        'new_submission_received',
        'assignment_new',
        'assignment_due',
        'grading_pending',
    ],
    ADMIN: [
        'new_user_registered',
        'course_approval_required',
        'system_alert',
    ],
} as const;

export type NotificationType =
    | 'assignment_new'
    | 'assignment_due'
    | 'assignment_graded'
    | 'submission_received'
    | 'new_submission_received'
    | 'grade_posted'
    | 'student_enrolled'
    | 'grading_pending'
    | 'new_user_registered'
    | 'course_approval_required'
    | 'system_alert';

export interface NotificationTypeConfig {
    label: string;
    roles: readonly NotificationRole[];
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
    assignment_new: {
        label: 'Assignment Posted',
        roles: ['STUDENT', 'ASSISTANT'],
    },
    assignment_graded: {
        label: 'Assignment Graded',
        roles: ['STUDENT'],
    },
    assignment_due: {
        label: 'Assignment Due',
        roles: ['STUDENT', 'ASSISTANT'],
    },
    submission_received: {
        label: 'Submission Received',
        roles: ['FACULTY', 'ASSISTANT'],
    },
    new_submission_received: {
        label: 'New Submission Received',
        roles: ['FACULTY', 'ASSISTANT'],
    },
    grade_posted: {
        label: 'Grade Posted',
        roles: ['STUDENT'],
    },
    student_enrolled: {
        label: 'Enrolled in Course',
        roles: ['STUDENT'],
    },
    grading_pending: {
        label: 'Grading Pending',
        roles: ['ASSISTANT'],
    },
    new_user_registered: {
        label: 'New User Registered',
        roles: ['ADMIN'],
    },
    course_approval_required: {
        label: 'Course Approval Required',
        roles: ['ADMIN'],
    },
    system_alert: {
        label: 'System Alert',
        roles: ['ADMIN'],
    },
};
