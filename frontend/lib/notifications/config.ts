import { UserRole } from '@/contexts/AuthContext';

export type NotificationRole = UserRole;

export const ROLE_NOTIFICATION_TYPES: Record<NotificationRole, readonly string[]> = {
    STUDENT: [
        'HOMEWORK_POSTED', 'HOMEWORK_DUE', 'GRADE_POSTED',
        'ASSIGNMENT_NEW', 'ASSIGNMENT_DUE', 'ASSIGNMENT_GRADED',
        'assignment_new', 'assignment_due', 'assignment_graded',
    ],
    FACULTY: ['NEW_SUBMISSION_RECEIVED', 'GRADING_PENDING', 'SUBMISSION_RECEIVED', 'submission_received'],
    ASSISTANT: ['NEW_SUBMISSION_RECEIVED', 'GRADING_PENDING', 'SUBMISSION_RECEIVED', 'submission_received'],
    ADMIN: ['NEW_USER_REGISTERED', 'COURSE_APPROVAL_REQUIRED', 'SYSTEM_ALERT'],
} as const;

export type NotificationType =
    | 'ASSIGNMENT_NEW'
    | 'ASSIGNMENT_DUE'
    | 'ASSIGNMENT_GRADED'
    | 'SUBMISSION_RECEIVED'
    | 'assignment_new'
    | 'assignment_due'
    | 'assignment_graded'
    | 'submission_received'
    | 'HOMEWORK_POSTED'
    | 'HOMEWORK_DUE'
    | 'GRADE_POSTED'
    | 'NEW_SUBMISSION_RECEIVED'
    | 'GRADING_PENDING'
    | 'NEW_USER_REGISTERED'
    | 'COURSE_APPROVAL_REQUIRED'
    | 'SYSTEM_ALERT';

export interface NotificationTypeConfig {
    label: string;
    roles: readonly NotificationRole[];
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
    ASSIGNMENT_NEW: {
        label: 'Assignment Posted',
        roles: ['STUDENT'],
    },
    ASSIGNMENT_GRADED: {
        label: 'Assignment Graded',
        roles: ['STUDENT'],
    },
    ASSIGNMENT_DUE: {
        label: 'Assignment Due',
        roles: ['STUDENT'],
    },
    SUBMISSION_RECEIVED: {
        label: 'Submission Received',
        roles: ['FACULTY', 'ASSISTANT'],
    },
    assignment_new: {
        label: 'Assignment Posted',
        roles: ['STUDENT'],
    },
    assignment_due: {
        label: 'Assignment Due',
        roles: ['STUDENT'],
    },
    assignment_graded: {
        label: 'Assignment Graded',
        roles: ['STUDENT'],
    },
    submission_received: {
        label: 'Submission Received',
        roles: ['FACULTY', 'ASSISTANT'],
    },
    HOMEWORK_POSTED: {
        label: 'Homework Posted',
        roles: ['STUDENT'],
    },
    HOMEWORK_DUE: {
        label: 'Homework Due',
        roles: ['STUDENT'],
    },
    GRADE_POSTED: {
        label: 'Grade Posted',
        roles: ['STUDENT'],
    },
    NEW_SUBMISSION_RECEIVED: {
        label: 'New Submission Received',
        roles: ['FACULTY', 'ASSISTANT'],
    },
    GRADING_PENDING: {
        label: 'Grading Pending',
        roles: ['FACULTY', 'ASSISTANT'],
    },
    NEW_USER_REGISTERED: {
        label: 'New User Registered',
        roles: ['ADMIN'],
    },
    COURSE_APPROVAL_REQUIRED: {
        label: 'Course Approval Required',
        roles: ['ADMIN'],
    },
    SYSTEM_ALERT: {
        label: 'System Alert',
        roles: ['ADMIN'],
    },
};
