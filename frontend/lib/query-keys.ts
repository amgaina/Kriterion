/**
 * Centralized query key definitions for React Query.
 * Using consistent keys ensures proper cache invalidation across the app.
 */

export const queryKeys = {
    // Courses
    courses: {
        all: ['courses'] as const,
        faculty: ['faculty-courses'] as const,
        student: ['student-courses'] as const,
        assistant: ['assistant-courses'] as const,
        dashboard: ['faculty-courses-dashboard'] as const,
        detail: (id: number | string) => ['course', id] as const,
        students: (courseId: number | string) => ['course-students', courseId] as const,
        assistants: (courseId: number | string) => ['course-assistants', courseId] as const,
    },
    
    // Users
    users: {
        all: ['users'] as const,
        byRole: (role: string) => ['users', role] as const,
        detail: (id: number | string) => ['user', id] as const,
        profile: ['profile'] as const,
    },
    
    // Assignments
    assignments: {
        all: ['assignments'] as const,
        byCourse: (courseId: number | string) => ['course-assignments', courseId] as const,
        detail: (id: number | string) => ['assignment', id] as const,
        student: ['student-assignments'] as const,
    },
    
    // Submissions
    submissions: {
        byAssignment: (assignmentId: number | string) => ['assignment-submissions', assignmentId] as const,
        byStudent: (assignmentId: number | string) => ['submissions', assignmentId] as const,
        detail: (id: number | string) => ['submission-detail', id] as const,
    },
    
    // Notifications
    notifications: {
        byUser: (userId: number | string) => ['notifications', userId] as const,
    },
    
    // Dashboard/Stats
    dashboard: {
        student: ['student-dashboard'] as const,
        faculty: ['faculty-dashboard'] as const,
        admin: ['admin-dashboard'] as const,
        assistant: ['assistant-dashboard'] as const,
    },
    
    // Languages
    languages: {
        all: ['languages'] as const,
    },

    // Events
    events: {
        student: ['student-upcoming-events'] as const,
        faculty: ['faculty-upcoming-events'] as const,
    },
} as const;

/**
 * Query key groups for bulk invalidation.
 * Use these when a mutation should invalidate multiple related queries.
 */
export const invalidationGroups = {
    // Invalidate all course-related queries
    allCourses: [
        queryKeys.courses.all,
        queryKeys.courses.faculty, 
        queryKeys.courses.student,
        queryKeys.courses.assistant,
        queryKeys.courses.dashboard,
    ],
    
    // Invalidate all user-related queries
    allUsers: [
        queryKeys.users.all,
        ['users', 'STUDENT'],
        ['users', 'FACULTY'],
        ['users', 'ASSISTANT'],
        ['users', 'ADMIN'],
    ],
    
    // Invalidate dashboard queries (useful after any data change)
    allDashboards: [
        queryKeys.dashboard.student,
        queryKeys.dashboard.faculty,
        queryKeys.dashboard.admin,
        queryKeys.dashboard.assistant,
    ],
} as const;
