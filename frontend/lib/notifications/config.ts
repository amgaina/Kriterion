import { UserRole } from '@/contexts/AuthContext';

export type NotificationRole = UserRole;

export const ROLE_NOTIFICATION_TYPES: Record<NotificationRole, readonly string[]> = {
    STUDENT: ['HOMEWORK_POSTED', 'GRADE_POSTED', 'assignment_new', 'assignment_graded'],
    FACULTY: ['NEW_SUBMISSION_RECEIVED', 'submission_received'],
    ASSISTANT: ['NEW_SUBMISSION_RECEIVED', 'submission_received'],
    ADMIN: ['NEW_USER_REGISTERED', 'COURSE_APPROVAL_REQUIRED', 'SYSTEM_ALERT'],
} as const;

export type NotificationType =
    | 'HOMEWORK_POSTED'
    | 'HOMEWORK_DUE'
    | 'GRADE_POSTED'
    | 'NEW_SUBMISSION_RECEIVED'
    | 'GRADING_PENDING'
    | 'NEW_USER_REGISTERED'
    | 'COURSE_APPROVAL_REQUIRED'
    | 'SYSTEM_ALERT'
    | 'assignment_new'
    | 'assignment_due'
    | 'assignment_graded'
    | 'submission_received'
    | 'course_assigned';

export interface NotificationTypeConfig {
    label: string;
    roles: readonly NotificationRole[];
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
    HOMEWORK_POSTED: { label: 'New Assignment', roles: ['STUDENT'] },
    HOMEWORK_DUE: { label: 'Assignment Due', roles: [] },
    GRADE_POSTED: { label: 'Assignment Graded', roles: ['STUDENT'] },
    assignment_new: { label: 'New Assignment', roles: ['STUDENT'] },
    assignment_due: { label: 'Assignment Due', roles: [] },
    assignment_graded: { label: 'Assignment Graded', roles: ['STUDENT'] },
    NEW_SUBMISSION_RECEIVED: { label: 'New Submission', roles: ['FACULTY', 'ASSISTANT'] },
    GRADING_PENDING: { label: 'Grading Pending', roles: [] },
    submission_received: { label: 'New Submission', roles: ['FACULTY', 'ASSISTANT'] },
    course_assigned: { label: 'Course Assigned', roles: [] },
    NEW_USER_REGISTERED: { label: 'New User Registered', roles: ['ADMIN'] },
    COURSE_APPROVAL_REQUIRED: { label: 'Course Approval Required', roles: ['ADMIN'] },
    SYSTEM_ALERT: { label: 'System Alert', roles: ['ADMIN'] },
};
