'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const LogoutIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

const SettingsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

export function AdminLayout({ children }: AdminLayoutProps) {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);

    const navItems = [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Users', href: '/admin/users' },
        { label: 'Courses', href: '/admin/courses' },
        { label: 'Languages', href: '/admin/languages' },
        { label: 'Security', href: '/admin/security' },
        { label: 'Reports', href: '/admin/reports' },
        { label: 'Settings', href: '/admin/settings' },
    ];

    if (!user) return null;

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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 lg:px-6 h-16 flex items-center justify-between">
                    {/* Left side - Logo */}
                    <Link href="/admin/dashboard" className="flex items-center gap-3">
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

                    {/* Center - Navigation */}
                    <nav className="hidden lg:flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'text-[#862733] bg-[#862733]/10 font-semibold'
                                            : 'text-gray-700 hover:text-[#862733] hover:bg-gray-50'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right side - User Profile */}
                    <div className="flex items-center gap-4">
                        {/* Notifications */}
                        <button className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                        </button>

                        {/* User Profile Menu */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex-1 text-right hidden sm:block min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-[#862733] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                    {user.full_name?.charAt(0).toUpperCase() || 'A'}
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                                    {/* User Info Section */}
                                    <div className="p-4 text-center border-b border-gray-200">
                                        <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-[#862733] flex items-center justify-center text-white text-2xl font-semibold">
                                            {user.full_name?.charAt(0).toUpperCase() || 'A'}
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                                        <p className="text-xs text-gray-500 mt-1 break-words">{user.email}</p>
                                        <span className="inline-block mt-3 px-3 py-1 bg-[#862733] text-white text-xs font-medium rounded-full">
                                            System Admin
                                        </span>
                                    </div>

                                    {/* Menu Items */}
                                    <div className="p-2 space-y-1">
                                        <Link
                                            href="/admin/settings"
                                            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                            onClick={() => setUserMenuOpen(false)}
                                        >
                                            <SettingsIcon />
                                            Settings
                                        </Link>
                                    </div>

                                    {/* Sign Out */}
                                    <div className="border-t border-gray-200 p-2">
                                        <button
                                            onClick={() => setShowLogoutConfirm(true)}
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

                {/* Mobile Navigation */}
                <div className="lg:hidden border-t border-gray-200 bg-gray-50 overflow-x-auto">
                    <nav className="flex gap-1 p-4">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                                        isActive
                                            ? 'text-[#862733] bg-white font-semibold'
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
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 animate-in zoom-in duration-200">
                        <div className="flex justify-center mb-6">
                            <div className="h-12 w-12 rounded-full bg-[#862733] flex items-center justify-center text-white text-lg font-bold">
                                {user.full_name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                        </div>

                        <h2 className="text-center text-xl font-semibold text-gray-900 mb-3">Sign out?</h2>
                        <p className="text-center text-sm text-gray-600 mb-8">You'll be signed out of your account.</p>

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
            <main className="p-4 lg:p-6">
                <div className="mx-auto max-w-7xl w-full">
                    <div className="bg-white/90 dark:bg-[#0b0b0b]/80 rounded-2xl shadow-sm p-6">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
