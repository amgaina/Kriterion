'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, FileText, Users, UserCog, UsersRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackLink } from '@/components/ui/BackLink';
import apiClient from '@/lib/api-client';

interface CourseForLayout {
    id: number;
    code: string;
    name: string;
    color?: string | null;
    semester?: string;
    year?: number;
    section?: string | null;
}

function courseGradient(hex: string | null | undefined): React.CSSProperties {
    if (!hex || !hex.startsWith('#')) {
        return { background: 'linear-gradient(135deg, #862733 0%, #6b1f2a 100%)' };
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const darker = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`;
    return { background: `linear-gradient(135deg, ${hex} 0%, ${darker} 100%)` };
}

export default function CourseLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const courseId = params?.courseId as string;
    const pathname = usePathname();

    // Do not show the banner/layout shell on deep grading/assignment detail pages.
    const isGradingPage = pathname?.includes('/grade/') === true;
    const isAssignmentDetail =
        !!pathname &&
        !!courseId &&
        /\/faculty\/courses\/[^/]+\/assignments\/\d+/.test(pathname);
    const showBanner = !isGradingPage && !isAssignmentDetail;

    const { data: course } = useQuery<CourseForLayout>({
        queryKey: ['course-shell', courseId],
        queryFn: () => apiClient.getCourse(Number(courseId)) as Promise<CourseForLayout>,
        enabled: !!courseId && showBanner,
    });

    if (!showBanner) {
        return <>{children}</>;
    }

    const navItems = [
        { label: 'Overview', href: `/faculty/courses/${courseId}`, icon: LayoutDashboard },
        { label: 'Assignments', href: `/faculty/courses/${courseId}/assignments`, icon: FileText },
        { label: 'Students', href: `/faculty/courses/${courseId}/students`, icon: Users },
        { label: 'Groups', href: `/faculty/courses/${courseId}/groups`, icon: UsersRound },
        { label: 'Assistants', href: `/faculty/courses/${courseId}/assistants`, icon: UserCog },
    ];

    const isActive = (href: string) => {
        if (href === `/faculty/courses/${courseId}`) {
            return pathname === href || pathname === `/faculty/courses/${courseId}/`;
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50/50">
            <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-0">
                <BackLink href="/faculty/courses" label="Back to Courses" />

                {/* Sticky banner — larger, course color background */}
                <div
                    className="sticky top-10 z-20 rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
                    style={courseGradient(course?.color)}
                >
                    <div className="px-6 sm:px-8 py-6 sm:py-8">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold shadow-inner px-1.5 min-w-0">
                                    <span
                                        className="text-center leading-none break-words [word-break:break-word]"
                                        style={{ fontSize: 'clamp(10px, 1.1vw, 14px)' }}
                                    >
                                        {course?.code ? course.code.slice(0, 2).toUpperCase() : 'CR'}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white/80 text-sm uppercase tracking-wider">
                                        {course?.section ? `Section ${course.section}` : 'Course'}
                                    </p>
                                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight mt-0.5">
                                        {course ? `${course.code} · ${course.name}` : 'Loading…'}
                                    </h1>
                                    {course?.semester && course?.year && (
                                        <p className="text-white/70 text-sm mt-1">
                                            {course.semester} {course.year}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Tabs — pill on top of banner */}
                    <div className="px-4 sm:px-6 pb-4 pt-0">
                        <nav className="inline-flex items-center gap-1 rounded-xl bg-black/10 backdrop-blur-sm px-1.5 py-1.5">
                            {navItems.map((item) => {
                                const active = isActive(item.href);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="relative block active:scale-[0.98] transition-transform duration-200"
                                    >
                                        <span
                                            className={`relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                                                active
                                                    ? 'text-white'
                                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4 flex-shrink-0" />
                                            {item.label}
                                        </span>
                                        <AnimatePresence>
                                            {active && (
                                                <motion.span
                                                    layoutId="course-tab"
                                                    className="absolute inset-0 z-0 rounded-lg bg-white/25"
                                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                                                    initial={false}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </div>

            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
                {children}
            </main>
        </div>
    );
}
