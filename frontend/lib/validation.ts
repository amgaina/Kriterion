import { z } from 'zod';

// Login validation schema
export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be less than 100 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Register validation schema
export const registerSchema = z.object({
    username: z
        .string()
        .min(1, 'Username is required')
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens'),
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be less than 100 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z
        .string()
        .min(1, 'Please confirm your password'),
    firstName: z
        .string()
        .min(1, 'First name is required')
        .max(50, 'First name must be less than 50 characters'),
    lastName: z
        .string()
        .min(1, 'Last name is required')
        .max(50, 'Last name must be less than 50 characters'),
}).refine((data: any) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

// Forgot Password validation schema
export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// Reset Password validation schema
export const resetPasswordSchema = z.object({
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be less than 100 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z
        .string()
        .min(1, 'Please confirm your password'),
}).refine((data: any) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// Assignment creation validation schema (complete)
export const assignmentCreateSchema = z.object({
    // Required fields
    title: z.string().min(1, 'Title is required'),
    language_id: z.coerce.number().int().positive('Language is required'),
    description: z.string().min(1, 'Description is required'),
    due_date: z
        .string()
        .min(1, 'Due date is required')
        .refine((v: any) => !Number.isNaN(Date.parse(v)), {
            message: 'Invalid date/time',
        }),
    
    // Optional fields with defaults
    instructions: z.string().optional().or(z.literal('')),
    max_score: z.coerce.number().min(0, 'Max score must be >= 0').default(100),
    passing_score: z.coerce.number().min(0, 'Passing score must be >= 0').default(60),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    
    // Late submission policy
    allow_late: z.coerce.boolean().default(true),
    late_penalty_per_day: z.coerce.number().min(0).max(100).default(10),
    max_late_days: z.coerce.number().min(0).default(7),
    
    // Submission settings
    max_attempts: z.coerce.number().min(0).default(10),
    max_file_size_mb: z.coerce.number().min(1).default(10),
    max_num_files: z.coerce.number().min(1).default(5),
    allowedExtensionsStr: z.string().optional().or(z.literal('')),
    requiredFilesStr: z.string().optional().or(z.literal('')),
    
    // Group settings
    allow_groups: z.coerce.boolean().default(false),
    max_group_size: z.coerce.number().min(1).default(4),
    
    // Integrity checks
    enable_plagiarism_check: z.coerce.boolean().default(true),
    plagiarism_threshold: z.coerce.number().min(0).max(100).default(30),
    enable_ai_detection: z.coerce.boolean().default(true),
    ai_detection_threshold: z.coerce.number().min(0).max(100).default(50),
    
    // Grading weights
    test_weight: z.coerce.number().min(0).max(100).default(70),
    rubric_weight: z.coerce.number().min(0).max(100).default(30),
    
    // Rubric settings (for weighted rubric)
    rubric_min_points: z.coerce.number().min(0).default(0),
    rubric_max_points: z.coerce.number().min(0.5).default(10),
    
    // Publishing
    is_published: z.coerce.boolean().default(false),
})
.refine((data: any) => data.passing_score <= data.max_score, {
    message: 'Passing score cannot exceed max score',
    path: ['passing_score'],
})
.refine((data: any) => data.test_weight + data.rubric_weight === 100, {
    message: 'Test weight and manual weight must sum to 100%',
    path: ['rubric_weight'],
})
.refine((data: any) => data.rubric_max_points > data.rubric_min_points, {
    message: 'Rubric max points must be greater than min points',
    path: ['rubric_max_points'],
});

export type AssignmentCreateForm = z.infer<typeof assignmentCreateSchema>;
