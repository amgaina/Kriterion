'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { NotificationButton } from '@/components/notifications/NotificationButton';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface DashboardLayoutProps {
    children: React.ReactNode;
}

// Icons as components
const DashboardIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
);

const BookIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
);

const AssignmentIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const SubmissionIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
);

const ReportIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const UsersIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const SettingsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const AuditIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

const GradeIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LogoutIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

const MenuIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CloseIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const getNavItems = (role: UserRole): NavItem[] => {
    const baseUrl = role === 'STUDENT' ? '/student' : role === 'FACULTY' ? '/faculty' : role === 'ASSISTANT' ? '/assistant' : '/admin';

    if (role === 'STUDENT') {
        return [
            { label: 'Dashboard', href: `${baseUrl}/dashboard`, icon: <DashboardIcon /> },
            { label: 'My Courses', href: `${baseUrl}/courses`, icon: <BookIcon /> },
            { label: 'Assignments', href: `${baseUrl}/assignments`, icon: <AssignmentIcon /> },
            { label: 'Grades', href: `${baseUrl}/grades`, icon: <GradeIcon /> },
            { label: 'Progress', href: `${baseUrl}/progress`, icon: <ReportIcon /> },
            { label: 'Schedule', href: `${baseUrl}/schedule`, icon: <AuditIcon /> },
            { label: 'Help', href: `${baseUrl}/help`, icon: <SubmissionIcon /> },
            { label: 'Settings', href: `${baseUrl}/settings`, icon: <SettingsIcon /> },
        ];
    }

    if (role === 'FACULTY') {
        return [
            { label: 'Dashboard', href: `${baseUrl}/dashboard`, icon: <DashboardIcon /> },
            { label: 'Courses', href: `${baseUrl}/courses`, icon: <BookIcon /> },
            { label: 'Reports', href: `${baseUrl}/reports`, icon: <ReportIcon /> },
        ];
    }

    if (role === 'ASSISTANT') {
        return [
            { label: 'Dashboard', href: `${baseUrl}/dashboard`, icon: <DashboardIcon /> },
            { label: 'My Courses', href: `${baseUrl}/courses`, icon: <BookIcon /> },
        ];
    }

    // ADMIN
    return [
        { label: 'Dashboard', href: `${baseUrl}/dashboard`, icon: <DashboardIcon /> },
        { label: 'Users', href: `${baseUrl}/users`, icon: <UsersIcon /> },
        { label: 'Courses', href: `${baseUrl}/courses`, icon: <BookIcon /> },
        { label: 'Languages', href: `${baseUrl}/languages`, icon: <SettingsIcon /> },
        { label: 'Security', href: `${baseUrl}/security`, icon: <AuditIcon /> },
        { label: 'Reports', href: `${baseUrl}/reports`, icon: <ReportIcon /> },
        { label: 'Settings', href: `${baseUrl}/settings`, icon: <SettingsIcon /> },
    ];
};

const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
        case 'ADMIN':
            return 'bg-red-100 text-red-800';
        case 'FACULTY':
            return 'bg-blue-100 text-blue-800';
        case 'ASSISTANT':
            return 'bg-amber-100 text-amber-800';
        case 'STUDENT':
            return 'bg-green-100 text-green-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const getTopNavItems = (role: UserRole) => {
    if (role === 'STUDENT') {
        return [
            { label: 'Dashboard', href: '/student/dashboard' },
            { label: 'My Courses', href: '/student/courses' },
            { label: 'Assignments', href: '/student/assignments' },
            { label: 'Grades', href: '/student/grades' }
        ];
    }

    if (role === 'FACULTY') {
        return [
            { label: 'Dashboard', href: '/faculty/dashboard' },
            { label: 'Courses', href: '/faculty/courses' },
            { label: 'Reports', href: '/faculty/reports' },
        ];
    }

    if (role === 'ASSISTANT') {
        return [
            { label: 'Dashboard', href: '/assistant/dashboard' },
            { label: 'My Courses', href: '/assistant/courses' },
        ];
    }

    // ADMIN
    return [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Users', href: '/admin/users' },
        { label: 'Courses', href: '/admin/courses' },
        { label: 'Reports', href: '/admin/reports' },
        { label: 'Settings', href: '/admin/settings' },
    ];
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [contentVisible, setContentVisible] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);

    const handleNavClick = (e: React.MouseEvent, href: string, closeSidebar = false) => {
        if (e) e.preventDefault();
        if (isNavigating) return;

        if (closeSidebar) setSidebarOpen(false);

        // If clicking the same route, just ensure content is visible
        if (pathname === href || pathname.startsWith(href + '/')) {
            setContentVisible(true);
            return;
        }

        // Respect reduced motion user preference
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            router.push(href);
            return;
        }

        setIsNavigating(true);
        setContentVisible(false);

        // Wait for exit animation to finish before navigating
        const NAV_DELAY = 450; // ms, should be shorter than the container duration (500ms)
        setTimeout(() => {
            router.push(href);
            setIsNavigating(false);
        }, NAV_DELAY);
    };

    if (!user) return null;

    const currentUser = user!;

    const navItems = getNavItems(currentUser.role);
    const topNavItems = getTopNavItems(currentUser.role);
    const isAdmin = currentUser.role === 'ADMIN';
    const isAdminDashboard = isAdmin && (pathname === '/admin/dashboard' || pathname.startsWith('/admin/dashboard/'));

    // For students, remove the primary learning nav from the sidebar since we show it in the top nav
    // Also remove 'Help' and 'Settings' from the sidebar and surface them in the profile menu
    const sidebarItems = currentUser.role === 'STUDENT'
        ? navItems.filter(i => !['Dashboard', 'My Courses', 'Assignments', 'Grades', 'Progress', 'Schedule', 'Help', 'Settings'].includes(i.label))
        : navItems;

    const handleLogout = () => {
        logout();
    };

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // On route change, reveal content after the new page mounts (we trigger exit explicitly on clicks)
    React.useEffect(() => {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setContentVisible(true);
            return;
        }

        // Small delay to allow the new route to render before fading in
        const t = setTimeout(() => setContentVisible(true), 80);
        return () => clearTimeout(t);
    }, [pathname]);

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* Sidebar (was used only for admin; students and faculty use top nav only).
                We now hide it for all admin pages to match the faculty-style layout. */}
            {user.role === 'ADMIN' && false && (
                <>
                    {/* Mobile sidebar backdrop */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* Sidebar */}
                    <aside
                        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                            }`}
                    >
                        {/* Logo Section */}
                        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
                            <Link href={`/${currentUser.role.toLowerCase()}/dashboard`} className="flex items-center gap-3">
                                <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#862733] flex items-center justify-center">
                                    <Image
                                        src="/logo.png"
                                        alt="Kriterion"
                                        width={28}
                                        height={28}
                                        className="object-contain"
                                    />
                                </div>
                                <span className="text-xl font-bold text-gray-900">Kriterion</span>
                            </Link>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
                            >
                                <CloseIcon />
                            </button>
                        </div>

                        {/* User Info */}
                        <div className="border-b border-gray-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-[#862733] flex items-center justify-center text-white font-semibold">
                                    {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900">
                                        {currentUser.full_name}
                                    </p>
                                    <p className="truncate text-xs text-gray-500">{currentUser.email}</p>
                                </div>
                            </div>
                            <div className="mt-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(currentUser.role)}`}>
                                    {currentUser.role}
                                </span>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 overflow-y-auto p-4">
                            <ul className="space-y-1">
                                {sidebarItems.map((item) => {
                                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                onClick={(e) => handleNavClick(e, item.href, true)}
                                                aria-current={isActive ? 'page' : undefined}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transform transition-transform duration-500 ease-[cubic-bezier(.2,.9,.2,1)] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#862733] ${isActive
                                                    ? 'bg-[#862733] text-white shadow-md ring-1 ring-[#862733]/20'
                                                    : 'text-gray-700 hover:bg-gray-100 hover:-translate-y-0.5 hover:shadow-sm'
                                                    }`}
                                            >
                                                <span className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700 transition-colors'}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>

                        {/* Logout Button - Mobile only */}
                        <div className="border-t border-gray-200 p-4 lg:hidden">
                            <button
                                onClick={handleLogout}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                            >
                                <LogoutIcon />
                                Sign Out
                            </button>
                        </div>
                    </aside>
                </>
            )}

            {/* Main Content */}
            <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${isAdmin && false ? 'lg:pl-72' : ''}`}>
                {/* Top Header */}
                <header className="flex-shrink-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                    <div className="px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 min-w-0">
                        {/* Left side */}
                        {isAdmin && false ? (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
                            >
                                <MenuIcon />
                            </button>
                        ) : (
                            <Link href={`/${user.role.toLowerCase()}/dashboard`} className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
                                <div className="h-9 w-9 sm:h-10 sm:w-10 overflow-hidden rounded-lg bg-[#862733] flex items-center justify-center flex-shrink-0">
                                    <Image
                                        src="/logo.png"
                                        alt="Kriterion"
                                        width={28}
                                        height={28}
                                        className="object-contain w-5 h-5 sm:w-7 sm:h-7"
                                    />
                                </div>
                                <span className="text-base sm:text-xl font-bold text-gray-900 truncate">Kriterion</span>
                            </Link>
                        )}

                        {/* Center - Navigation (desktop) */}
                        <nav className="hidden md:flex items-center flex-1 min-w-0 justify-center">
                            <div className="flex w-full max-w-xl mx-auto">
                                {topNavItems.map((item) => {
                                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={(e) => handleNavClick(e, item.href)}
                                            className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                                isActive
                                                    ? 'text-[#862733] bg-[#862733]/10 font-semibold'
                                                    : 'text-gray-700 hover:text-[#862733] hover:bg-gray-50'
                                            }`}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </nav>

                        {/* Right side */}
                        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                            <NotificationButton role={user.role} />

                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex-1 text-right hidden sm:block min-w-0 max-w-[140px] md:max-w-none">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
                                        <p className="text-xs text-gray-500 truncate hidden sm:block">{user.email}</p>
                                    </div>
                                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-[#862733] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                </button>

                                {userMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                                        <div className="p-4 text-center border-b border-gray-200">
                                            <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-[#862733] flex items-center justify-center text-white text-2xl font-semibold">
                                                {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                                            <p className="text-xs text-gray-500 mt-1 break-words">{user.email}</p>
                                            <span className="inline-block mt-3 px-3 py-1 bg-[#862733] text-white text-xs font-medium rounded-full">
                                                {user.role === 'FACULTY' ? 'Faculty' : user.role === 'STUDENT' ? 'Student' : user.role === 'ASSISTANT' ? 'Grading Assistant' : 'Admin'}
                                            </span>
                                        </div>

                                        <div className="p-2 space-y-1">
                                            <Link
                                                href={`/${user.role.toLowerCase()}/settings`}
                                                className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                                onClick={() => setUserMenuOpen(false)}
                                            >
                                                <SettingsIcon />
                                                Settings
                                            </Link>

                                            {user.role === 'STUDENT' && (
                                                <Link
                                                    href={`/${user.role.toLowerCase()}/help`}
                                                    className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                                    onClick={() => setUserMenuOpen(false)}
                                                >
                                                    <SubmissionIcon />
                                                    Help
                                                </Link>
                                            )}
                                        </div>

                                        <div className="border-t border-gray-200 p-2">
                                            <button
                                                onClick={() => {
                                                    setShowLogoutConfirm(true);
                                                }}
                                                className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
                                            >
                                                <LogoutIcon />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="md:hidden border-t border-gray-200 bg-gray-50/80">
                        <nav
                            className="grid gap-2 px-3 py-2.5"
                            style={{ gridTemplateColumns: `repeat(${topNavItems.length}, minmax(0, 1fr))` }}
                        >
                            {topNavItems.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={(e) => handleNavClick(e, item.href)}
                                        className={`flex items-center justify-center py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[40px] ${
                                            isActive
                                                ? 'text-white bg-[#862733] shadow-sm'
                                                : 'text-gray-600 hover:text-[#862733] hover:bg-white'
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </header>

                {/* Logout Confirmation Modal */}
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-[calc(100vw-2rem)] max-w-sm animate-in zoom-in duration-200">
                            {/* Logo/Avatar */}
                            <div className="flex justify-center mb-6">
                                <div className="h-12 w-12 rounded-full bg-[#862733] flex items-center justify-center text-white text-lg font-bold">
                                    {user.full_name?.charAt(0).toUpperCase() || 'S'}
                                </div>
                            </div>
                            
                            {/* Title */}
                            <h2 className="text-center text-xl font-semibold text-gray-900 mb-3">Sign out?</h2>
                            
                            {/* Description */}
                            <p className="text-center text-sm text-gray-600 mb-8">You'll be signed out of your account.</p>
                            
                            {/* Buttons */}
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => {
                                        setShowLogoutConfirm(false);
                                        setUserMenuOpen(false);
                                    }}
                                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                                >
                                    No
                                </button>
                                <button
                                    onClick={() => {
                                        setShowLogoutConfirm(false);
                                        handleLogout();
                                    }}
                                    className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#862733] hover:bg-[#a13040] transition-colors"
                                >
                                    Yes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Page Content */}
                <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
                    <div className={`h-full motion-reduce:transition-none transition-all duration-500 ease-[cubic-bezier(.2,.9,.2,1)] transform will-change-transform will-change-opacity ${contentVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-98'}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}