'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import apiClient from '@/lib/api-client';

export type UserRole = 'STUDENT' | 'FACULTY' | 'ADMIN';

export interface User {
    id: number;
    email: string;
    full_name: string;
    role: UserRole;
    student_id?: string;
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
    last_login?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    register: (userData: any) => Promise<void>;
}

const ROLE_HOME: Record<UserRole, string> = {
    STUDENT: '/student/dashboard',
    FACULTY: '/faculty/dashboard',
    ADMIN: '/admin/dashboard',
};

function setRoleCookie(role: string) {
    if (typeof window === 'undefined') return;
    const maxAge = 60 * 60 * 24 * 7;
    document.cookie = `kriterion_role=${role}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `kriterion_auth=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearRoleCookie() {
    if (typeof window === 'undefined') return;
    document.cookie = 'kriterion_role=; path=/; max-age=0';
    document.cookie = 'kriterion_auth=; path=/; max-age=0';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const accessToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
            if (!accessToken) {
                setIsLoading(false);
                return;
            }

            const userData = await apiClient.getCurrentUser();
            setUser(userData);
            setRoleCookie(userData.role);
        } catch (error) {
            console.error('Auth check failed:', error);
            apiClient.clearTokens();
            clearRoleCookie();
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = useCallback(async (email: string, password: string) => {
        try {
            const data = await apiClient.login(email, password);
            const userData = data.user ?? await apiClient.getCurrentUser();
            setUser(userData);
            setRoleCookie(userData.role);

            const home = ROLE_HOME[userData.role as UserRole] || '/';
            router.push(home);
        } catch (error: any) {
            console.error('Login failed:', error);
            throw new Error(error.response?.data?.detail || 'Login failed');
        }
    }, [router]);

    const logout = useCallback(() => {
        apiClient.logout();
        clearRoleCookie();
        setUser(null);
        router.push('/login');
    }, [router]);

    const register = useCallback(async (userData: any) => {
        try {
            await apiClient.register(userData);
            router.push('/login');
        } catch (error: any) {
            console.error('Registration failed:', error);
            throw new Error(error.response?.data?.detail || 'Registration failed');
        }
    }, [router]);

    const value = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
