'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/validation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, isLoading: authLoading, isAuthenticated, user } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Redirect authenticated users to their dashboard
    useEffect(() => {
        if (isAuthenticated && user) {
            const returnUrl = searchParams.get('returnUrl');
            if (returnUrl) {
                router.replace(decodeURIComponent(returnUrl));
            } else {
                switch (user.role) {
                    case 'STUDENT':
                        router.replace('/student/dashboard');
                        break;
                    case 'FACULTY':
                        router.replace('/faculty/dashboard');
                        break;
                    case 'ADMIN':
                        router.replace('/admin/dashboard');
                        break;
                    default:
                        router.replace('/');
                }
            }
        }
    }, [isAuthenticated, user, router, searchParams]);

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
        mode: 'onSubmit',
    });

    const email = watch('email');
    const password = watch('password');

    const canSubmit = useMemo(() => {
        return !!email?.trim() && !!password && !isLoading && !authLoading;
    }, [email, password, isLoading, authLoading]);

    const onSubmit = async (data: LoginFormData) => {
        setError('');
        setIsLoading(true);

        try {
            await login(data.email, data.password);
        } catch (err: any) {
            setError(err.message || 'Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNotYou = () => {
        setError('');
        reset({ email: '', password: '' });
    };

    return (
        <div className="min-h-screen w-full">
            {/* Background image */}
            <div className="fixed inset-0 -z-10">
                <Image
                    src="/login-background.png"
                    alt=""
                    fill
                    priority
                    className="object-cover"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-black/10" />
            </div>

            <div className="min-h-screen flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-[480px]">
                    <div className="overflow-hidden rounded-md bg-white shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
                        {/* Top maroon bar + logo */}
                        <div className="relative h-[110px] bg-[#7A1E2C]">
                            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                                <div className="h-[58px] w-[58px] overflow-hidden rounded-full bg-white/90 ring-2 ring-white/60 flex items-center justify-center">
                                    <Image
                                        src="/logo.png"
                                        alt="Logo"
                                        width={46}
                                        height={46}
                                        className="object-contain"
                                        priority
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Card body */}
                        <div className="px-8 py-7">
                            <div className="flex items-center gap-2 text-[18px] font-semibold text-gray-700">
                                <span className="text-gray-500" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M9 7H7a2 2 0 0 0-2 2v2m0 0v2a2 2 0 0 0 2 2h2m-4-4h6M15 7h2a2 2 0 0 1 2 2v2m0 0v2a2 2 0 0 1-2 2h-2m4-4h-6"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </span>
                                <span>
                                    Connecting to <span className="font-semibold text-gray-800">Kriterion</span>
                                </span>
                            </div>

                            {error && (
                                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
                                {/* Email header row */}
                                <div className="flex items-end justify-between">
                                    <label htmlFor="email" className="block text-[15px] font-semibold text-gray-500">
                                        Email
                                    </label>

                                    <button
                                        type="button"
                                        onClick={handleNotYou}
                                        className="text-sm font-medium text-[#0B4C92] hover:underline"
                                    >
                                        Not you?
                                    </button>
                                </div>

                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    {...register('email')}
                                    className={`mt-2 w-full rounded-sm border px-3 py-2.5 text-[15px] text-gray-700 outline-none focus:ring-2 ${errors.email
                                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                                        : 'border-gray-300 focus:border-[#0B4C92] focus:ring-[#0B4C92]/20'
                                        }`}
                                />

                                {errors.email ? (
                                    <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
                                ) : (
                                    <p className="mt-3 text-center text-sm text-[#0B4C92]">
                                        Enter your email address.
                                    </p>
                                )}

                                {/* Password */}
                                <label htmlFor="password" className="mt-6 block text-[15px] font-semibold text-gray-500">
                                    Password
                                </label>

                                <div className="relative mt-2">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        {...register('password')}
                                        className={`w-full rounded-sm border px-3 py-2.5 pr-11 text-[15px] text-gray-700 outline-none focus:ring-2 ${errors.password
                                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-gray-300 focus:border-[#0B4C92] focus:ring-[#0B4C92]/20'
                                            }`}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((s) => !s)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                <path
                                                    d="M10.7 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                />
                                                <path
                                                    d="M6.23 6.23C4.02 7.72 2.46 9.74 2 12c1.27 4.64 5.4 8 10 8 1.67 0 3.26-.44 4.64-1.22"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                />
                                                <path
                                                    d="M9.88 5.1A10.6 10.6 0 0 1 12 4c4.6 0 8.73 3.36 10 8-.34 1.25-.98 2.4-1.85 3.38"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                <path
                                                    d="M2 12c1.27-4.64 5.4-8 10-8s8.73 3.36 10 8c-1.27 4.64-5.4 8-10 8s-8.73-3.36-10-8Z"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinejoin="round"
                                                />
                                                <path
                                                    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>}

                                {/* Continue button */}
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="mt-6 w-full rounded-sm bg-[#5F6368] py-3 text-[18px] font-semibold text-white shadow-sm transition hover:bg-[#4F5358] focus:outline-none focus:ring-4 focus:ring-black/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isLoading ? 'Signing in…' : 'Continue'}
                                </button>

                                <div className="mt-6 text-center">
                                    <Link href="/forgot-password" className="text-sm text-[#0B4C92] hover:underline">
                                        Forgot Password
                                    </Link>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
