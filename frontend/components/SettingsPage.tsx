'use client';

import { useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import {
    User,
    Phone,
    Lock,
    Globe,
    Shield,
    Save,
    Camera,
    Eye,
    EyeOff,
    Loader2,
    CheckCircle,
    Settings,
} from 'lucide-react';

interface SettingsPageProps {
    allowedRoles: UserRole[];
}

// Role-specific configurations
const getRoleBadge = (role: UserRole) => {
    const badges = {
        STUDENT: 'Student',
        FACULTY: 'Faculty',
        ASSISTANT: 'Grading Assistant',
        ADMIN: 'Administrator',
    };
    return badges[role] || role;
};

const getRoleAvatarFallback = (role: UserRole, name?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    const fallbacks = {
        STUDENT: 'S',
        FACULTY: 'F',
        ASSISTANT: 'A',
        ADMIN: 'A',
    };
    return fallbacks[role] || 'U';
};

export function SettingsPage({ allowedRoles }: SettingsPageProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('profile');
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        full_name: user?.full_name || '',
        email: user?.email || '',
        phone: '',
        bio: '',
        github_url: '',
        linkedin_url: '',
    });

    // Password form state
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const tabs = [
        { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
        { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    ];

    const updateProfileMutation = useMutation({
        mutationFn: async (data: typeof profileForm) => {
            return new Promise((resolve) => setTimeout(resolve, 1000));
        },
        onSuccess: () => {
            setSuccessMessage('Profile updated successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        },
    });

    const updatePasswordMutation = useMutation({
        mutationFn: async (data: typeof passwordForm) => {
            return new Promise((resolve) => setTimeout(resolve, 1000));
        },
        onSuccess: () => {
            setSuccessMessage('Password updated successfully!');
            setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
            setTimeout(() => setSuccessMessage(''), 3000);
        },
    });

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(profileForm);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            return;
        }
        updatePasswordMutation.mutate(passwordForm);
    };

    return (
        <ProtectedRoute allowedRoles={allowedRoles}>
            <div className="space-y-6">
                <InnerHeaderDesign
                    title="Settings"
                    subtitle="Manage your account settings and preferences"
                />

                {successMessage && (
                    <Alert type="success" title="Success">
                        {successMessage}
                    </Alert>
                )}

                {/* Tabs */}
                <Card>
                    <CardContent className="p-4">
                        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
                    </CardContent>
                </Card>

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <form onSubmit={handleProfileSubmit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Information</CardTitle>
                                <CardDescription>Update your personal information</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Avatar Section */}
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <Avatar
                                            alt={user?.full_name || 'User'}
                                            fallback={getRoleAvatarFallback(user?.role || 'STUDENT', user?.full_name)}
                                            size="xl"
                                        />
                                        <button
                                            type="button"
                                            className="absolute bottom-0 right-0 p-2 bg-[#862733] rounded-full text-white hover:bg-[#6d1f2a] transition-colors"
                                        >
                                            <Camera className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">{user?.full_name}</h3>
                                        <p className="text-sm text-gray-500">{user?.email}</p>
                                        <Badge variant="info" className="mt-2">{getRoleBadge(user?.role || 'STUDENT')}</Badge>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Full Name
                                        </label>
                                        <Input
                                            value={profileForm.full_name}
                                            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                                            placeholder="Enter your full name"
                                            disabled={user?.role !== 'ADMIN'}
                                        />
                                        {user?.role !== 'ADMIN' && (
                                            <p className="text-xs text-gray-500 mt-1">Contact admin to change name</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email Address
                                        </label>
                                        <Input
                                            type="email"
                                            value={profileForm.email}
                                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                            placeholder="Enter your email"
                                            disabled
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Contact admin to change email</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Phone Number
                                        </label>
                                        <Input
                                            value={profileForm.phone}
                                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                            placeholder="Enter your phone number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            GitHub Profile
                                        </label>
                                        <Input
                                            value={profileForm.github_url}
                                            onChange={(e) => setProfileForm({ ...profileForm, github_url: e.target.value })}
                                            placeholder="https://github.com/username"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Bio
                                        </label>
                                        <textarea
                                            value={profileForm.bio}
                                            onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#862733]/20 focus:border-[#862733]"
                                            placeholder="Tell us about yourself..."
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={updateProfileMutation.isPending}>
                                        {updateProfileMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4 mr-2" />
                                        )}
                                        Save Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Security Settings</CardTitle>
                            <CardDescription>Manage your password and security preferences</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Current Password
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            value={passwordForm.current_password}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                            placeholder="Enter current password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={passwordForm.new_password}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                            placeholder="Enter new password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Confirm New Password
                                    </label>
                                    <Input
                                        type="password"
                                        value={passwordForm.confirm_password}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                        placeholder="Confirm new password"
                                    />
                                    {passwordForm.new_password && passwordForm.confirm_password &&
                                        passwordForm.new_password !== passwordForm.confirm_password && (
                                            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                                        )}
                                </div>
                                <Button
                                    type="submit"
                                    disabled={updatePasswordMutation.isPending ||
                                        !passwordForm.current_password ||
                                        !passwordForm.new_password ||
                                        passwordForm.new_password !== passwordForm.confirm_password
                                    }
                                >
                                    {updatePasswordMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Lock className="w-4 h-4 mr-2" />
                                    )}
                                    Update Password
                                </Button>
                            </form>

                            <div className="mt-8 pt-8 border-t">
                                <h3 className="font-medium text-gray-900 mb-4">Active Sessions</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                                <Globe className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">Current Session</p>
                                                <p className="text-sm text-gray-500">macOS • Chrome • San Francisco, CA</p>
                                            </div>
                                        </div>
                                        <Badge variant="success">Active</Badge>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
