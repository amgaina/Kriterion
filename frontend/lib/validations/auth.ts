import { z } from 'zod';

// Login validation schema
export const loginSchema = z.object({
    username: z
        .string()
        .min(1, 'Username is required')
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens'),
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
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

// Forgot password validation schema
export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// Reset password validation schema
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
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
