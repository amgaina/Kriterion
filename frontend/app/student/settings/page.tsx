'use client';

import { useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import {
    User,
    Mail,
    Phone,
    Lock,
    Bell,
    Moon,
    Sun,
    Globe,
    Shield,
    Save,
    Camera,
    Eye,
    EyeOff,
    Loader2,
    CheckCircle,
    Settings,
    Palette
} from 'lucide-react';

export default function StudentSettingsPage() {
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

    // Notification settings
    const [notifications, setNotifications] = useState({
        email_assignments: true,
        email_grades: true,
        email_announcements: true,
        push_due_dates: true,
        push_grades: true,
        push_messages: false,
    });

    // Appearance settings
    const [appearance, setAppearance] = useState({
        theme: 'light',
        language: 'en',
        code_font_size: '14',
        code_theme: 'vs-dark',
    });

    const tabs = [
        { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
        { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
        { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    ];

    const updateProfileMutation = useMutation({
        mutationFn: async (data: typeof profileForm) => {
            // Simulate API call
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
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <DashboardLayout>
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
                                                alt={user?.full_name || 'Student'}
                                                fallback={user?.full_name?.charAt(0) || 'S'}
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
                                            <Badge variant="info" className="mt-2">Student</Badge>
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
                                            />
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

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notification Preferences</CardTitle>
                                <CardDescription>Choose how you want to be notified</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                                        <Mail className="w-5 h-5" />
                                        Email Notifications
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-700">New Assignments</p>
                                                <p className="text-sm text-gray-500">Get notified when new assignments are posted</p>
                                            </div>
                                            <Toggle
                                                checked={notifications.email_assignments}
                                                onChange={(checked: boolean) => setNotifications({ ...notifications, email_assignments: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-700">Grade Updates</p>
                                                <p className="text-sm text-gray-500">Get notified when your assignments are graded</p>
                                            </div>
                                            <Toggle
                                                checked={notifications.email_grades}
                                                onChange={(checked: boolean) => setNotifications({ ...notifications, email_grades: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-700">Course Announcements</p>
                                                <p className="text-sm text-gray-500">Get notified about important announcements</p>
                                            </div>
                                            <Toggle
                                                checked={notifications.email_announcements}
                                                onChange={(checked: boolean) => setNotifications({ ...notifications, email_announcements: checked })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t">
                                    <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                                        <Bell className="w-5 h-5" />
                                        Push Notifications
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-700">Due Date Reminders</p>
                                                <p className="text-sm text-gray-500">Get reminded before assignment deadlines</p>
                                            </div>
                                            <Toggle
                                                checked={notifications.push_due_dates}
                                                onChange={(checked: boolean) => setNotifications({ ...notifications, push_due_dates: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-700">Grade Notifications</p>
                                                <p className="text-sm text-gray-500">Instant notification when graded</p>
                                            </div>
                                            <Toggle
                                                checked={notifications.push_grades}
                                                onChange={(checked: boolean) => setNotifications({ ...notifications, push_grades: checked })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Preferences
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Appearance Settings</CardTitle>
                                <CardDescription>Customize how the application looks</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setAppearance({ ...appearance, theme: 'light' })}
                                            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${appearance.theme === 'light' ? 'border-[#862733] bg-[#862733]/5' : 'border-gray-200'
                                                }`}
                                        >
                                            <Sun className="w-5 h-5" />
                                            <span className="font-medium">Light</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAppearance({ ...appearance, theme: 'dark' })}
                                            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${appearance.theme === 'dark' ? 'border-[#862733] bg-[#862733]/5' : 'border-gray-200'
                                                }`}
                                        >
                                            <Moon className="w-5 h-5" />
                                            <span className="font-medium">Dark</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Code Editor Theme
                                    </label>
                                    <select
                                        value={appearance.code_theme}
                                        onChange={(e) => setAppearance({ ...appearance, code_theme: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#862733]/20"
                                    >
                                        <option value="vs-dark">VS Code Dark</option>
                                        <option value="vs-light">VS Code Light</option>
                                        <option value="monokai">Monokai</option>
                                        <option value="dracula">Dracula</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Code Font Size
                                    </label>
                                    <select
                                        value={appearance.code_font_size}
                                        onChange={(e) => setAppearance({ ...appearance, code_font_size: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#862733]/20"
                                    >
                                        <option value="12">12px</option>
                                        <option value="14">14px</option>
                                        <option value="16">16px</option>
                                        <option value="18">18px</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Language
                                    </label>
                                    <select
                                        value={appearance.language}
                                        onChange={(e) => setAppearance({ ...appearance, language: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#862733]/20"
                                    >
                                        <option value="en">English</option>
                                        <option value="es">Español</option>
                                        <option value="fr">Français</option>
                                        <option value="de">Deutsch</option>
                                    </select>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Preferences
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
