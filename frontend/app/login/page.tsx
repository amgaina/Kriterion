'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/validation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle, Code2, Shield, GraduationCap } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, isLoading: authLoading, isAuthenticated, user } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (isAuthenticated && user) {
            const returnUrl = searchParams.get('returnUrl');
            if (returnUrl) {
                router.replace(decodeURIComponent(returnUrl));
            } else {
                switch (user.role) {
                    case 'STUDENT': router.replace('/student/dashboard'); break;
                    case 'FACULTY': router.replace('/faculty/dashboard'); break;
                    case 'ADMIN': router.replace('/admin/dashboard'); break;
                    default: router.replace('/');
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

    const emailDomainValid = useMemo(() => {
        if (!email || !email.includes('@')) return null;
        const lower = email.toLowerCase();
        if (lower.endsWith('@ulm.edu') || lower.endsWith('@warhawks.ulm.edu')) return true;
        return false;
    }, [email]);

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
        <div className="min-h-screen w-full flex flex-col">
            <Navbar />
            <div className="flex-1 flex pt-16">
            {/* Left panel — branding */}
            <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:flex lg:w-[45%] xl:w-[42%] bg-primary relative overflow-hidden flex-col justify-between p-10 xl:p-14"
            >
                {/* Background shapes */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/[0.04]" />
                    <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white/[0.03]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.02]" />
                </div>

                {/* Logo */}
                <div className="relative z-10">
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center">
                            <span className="text-white font-extrabold text-base">K</span>
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">Kriterion</span>
                    </Link>
                </div>

                {/* Center content */}
                <div className="relative z-10 -mt-10">
                    <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
                        Grade code,<br />not papers.
                    </h2>
                    <p className="text-white/50 text-sm leading-relaxed max-w-sm mb-10">
                        Automated compilation, test-case evaluation, rubric scoring, and plagiarism detection — all in one platform.
                    </p>

                    <div className="space-y-3">
                        {[
                            { icon: <Code2 className="w-4 h-4" />, text: "5 languages supported" },
                            { icon: <Shield className="w-4 h-4" />, text: "Sandboxed execution" },
                            { icon: <GraduationCap className="w-4 h-4" />, text: "Instant feedback for students" },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                                className="flex items-center gap-3 text-white/40"
                            >
                                <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center text-white/50">
                                    {item.icon}
                                </div>
                                <span className="text-sm font-medium">{item.text}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Bottom */}
                <div className="relative z-10">
                    <p className="text-white/25 text-xs">&copy; {new Date().getFullYear()} Kriterion</p>
                </div>
            </motion.div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center px-6 py-10 bg-gray-50 relative">
                {/* Subtle dot pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: "radial-gradient(circle at 1px 1px, #862733 1px, transparent 0)",
                        backgroundSize: "24px 24px",
                    }}
                />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={mounted ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-[420px] relative z-10"
                >
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2.5 mb-8">
                        <Link href="/" className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                <span className="text-white font-extrabold text-sm">K</span>
                            </div>
                            <span className="text-base font-bold text-gray-900 tracking-tight">Kriterion</span>
                        </Link>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                        Welcome back
                    </h1>
                    <p className="text-sm text-gray-500 mb-8">
                        Sign in to your account to continue.
                    </p>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mb-5"
                            >
                                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {/* Email */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="email" className="text-sm font-semibold text-gray-700">
                                    Email
                                </label>
                                <button
                                    type="button"
                                    onClick={handleNotYou}
                                    className="text-xs font-medium text-primary hover:text-primary-800 transition-colors"
                                >
                                    Not you?
                                </button>
                            </div>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                {...register('email')}
                                className={`w-full bg-white border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all ${
                                    errors.email
                                        ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                                        : 'border-gray-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/10'
                                }`}
                                placeholder="you@ulm.edu"
                            />
                            {errors.email && (
                                <motion.p
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-1.5 text-xs text-red-600"
                                >
                                    {errors.email.message}
                                </motion.p>
                            )}
                            <AnimatePresence>
                                {emailDomainValid === false && !errors.email && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <p className="mt-1.5 text-xs text-red-500">
                                            Only @ulm.edu and @warhawks.ulm.edu emails are supported.
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="text-sm font-semibold text-gray-700 mb-1.5 block">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    {...register('password')}
                                    className={`w-full bg-white border rounded-xl px-4 py-3 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all ${
                                        errors.password
                                            ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                                            : 'border-gray-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/10'
                                    }`}
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <motion.p
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-1.5 text-xs text-red-600"
                                >
                                    {errors.password.message}
                                </motion.p>
                            )}
                        </div>

                        {/* Forgot password */}
                        <div className="flex justify-end">
                            <Link
                                href="/forgot-password"
                                className="text-xs font-medium text-primary hover:text-primary-800 transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {/* Submit */}
                        <motion.button
                            type="submit"
                            disabled={!canSubmit}
                            whileTap={canSubmit ? { scale: 0.98 } : {}}
                            className="group w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-primary-800 transition-all shadow-lg shadow-primary/15 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <p className="mt-8 text-center text-sm text-gray-500">
                        Need an account?{' '}
                        <Link href="/contact" className="font-semibold text-primary hover:text-primary-800 transition-colors">
                            Contact us
                        </Link>
                    </p>
                </motion.div>
            </div>
            </div>
        </div>
    );
}
