'use client';

import { useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    User,
    Mail,
    Phone,
    Github,
    Linkedin,
    Shield,
    Bell,
    Save,
    Loader2,
    CheckCircle2,
    Eye,
    EyeOff,
    KeyRound,
    CalendarDays,
    AtSign,
} from 'lucide-react';

interface Profile {
    id: number;
    email: string;
    full_name: string;
    role: string;
    student_id: string | null;
    phone: string | null;
    bio: string | null;
    avatar_url: string | null;
    github_url: string | null;
    linkedin_url: string | null;
    is_verified: boolean;
    created_at: string;
    last_login: string | null;
}

type Tab = 'profile' | 'security' | 'notifications';

export default function FacultySettingsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [successMessage, setSuccessMessage] = useState('');

    const { data: profile, isLoading } = useQuery<Profile>({
        queryKey: ['profile'],
        queryFn: () => apiClient.getProfile(),
    });

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
        { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    ];

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    return (
        <div className="space-y-6">
                        <InnerHeaderDesign
                            title="Settings"
                            subtitle="Manage your profile, security, and notification preferences."
                        />

                        {/* Success toast */}
                        {successMessage && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                {successMessage}
                            </div>
                        )}

                        {/* Profile card at top */}
                        {profile && (
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-700 to-primary-800 p-6 text-white">
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                                        {profile.full_name?.charAt(0).toUpperCase() || 'F'}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-bold truncate">{profile.full_name}</h2>
                                        <p className="text-sm text-white/70 truncate">{profile.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="inline-flex items-center gap-1 text-xs bg-white/20 rounded-full px-2.5 py-0.5">
                                                <Shield className="w-3 h-3" /> Faculty
                                            </span>
                                            {profile.is_verified && (
                                                <span className="inline-flex items-center gap-1 text-xs bg-emerald-400/20 rounded-full px-2.5 py-0.5">
                                                    <CheckCircle2 className="w-3 h-3" /> Verified
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab navigation */}
                        <div className="flex gap-1 border-b border-gray-200">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        {activeTab === 'profile' && (
                            <ProfileTab
                                profile={profile}
                                isLoading={isLoading}
                                onSuccess={showSuccess}
                                queryClient={queryClient}
                            />
                        )}
                        {activeTab === 'security' && (
                            <SecurityTab onSuccess={showSuccess} />
                        )}
                        {activeTab === 'notifications' && (
                            <NotificationsTab onSuccess={showSuccess} />
                        )}
        </div>
    );
}

/* ========== Profile Tab ========== */

function ProfileTab({
    profile,
    isLoading,
    onSuccess,
    queryClient,
}: {
    profile?: Profile;
    isLoading: boolean;
    onSuccess: (msg: string) => void;
    queryClient: ReturnType<typeof useQueryClient>;
}) {
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [github, setGithub] = useState('');
    const [linkedin, setLinkedin] = useState('');
    const [initialized, setInitialized] = useState(false);

    if (profile && !initialized) {
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setBio(profile.bio || '');
        setGithub(profile.github_url || '');
        setLinkedin(profile.linkedin_url || '');
        setInitialized(true);
    }

    const mutation = useMutation({
        mutationFn: () =>
            apiClient.updateProfile({
                full_name: fullName,
                phone: phone || undefined,
                bio: bio || undefined,
                github_url: github || undefined,
                linkedin_url: linkedin || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            onSuccess('Profile updated successfully');
        },
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" /> Personal Information
                    </CardTitle>
                    <CardDescription>Update your personal details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="pl-9"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    value={profile?.email || ''}
                                    disabled
                                    className="pl-9 bg-gray-50 text-gray-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="pl-9"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Username (ID)</label>
                            <div className="relative">
                                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    value={profile?.email?.split('@')[0] || ''}
                                    disabled
                                    className="pl-9 bg-gray-50 text-gray-500"
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                            placeholder="Tell us about yourself..."
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Github className="w-4 h-4 text-primary" /> Social Links
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">GitHub</label>
                            <div className="relative">
                                <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    value={github}
                                    onChange={(e) => setGithub(e.target.value)}
                                    className="pl-9"
                                    placeholder="https://github.com/username"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">LinkedIn</label>
                            <div className="relative">
                                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    value={linkedin}
                                    onChange={(e) => setLinkedin(e.target.value)}
                                    className="pl-9"
                                    placeholder="https://linkedin.com/in/username"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="bg-primary hover:bg-primary-700 text-white"
                >
                    {mutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                </Button>
            </div>

            {/* Account info */}
            {profile && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-primary" /> Account Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-gray-500">Role</dt>
                                <dd className="font-medium text-gray-900 capitalize">{profile.role}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Status</dt>
                                <dd className="font-medium text-gray-900">
                                    {profile.is_verified ? 'Verified' : 'Unverified'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Member since</dt>
                                <dd className="font-medium text-gray-900">
                                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Last login</dt>
                                <dd className="font-medium text-gray-900">
                                    {profile.last_login
                                        ? new Date(profile.last_login).toLocaleString()
                                        : 'Never'}
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/* ========== Security Tab ========== */

function SecurityTab({ onSuccess }: { onSuccess: (msg: string) => void }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [error, setError] = useState('');

    const mutation = useMutation({
        mutationFn: () => apiClient.changePassword(currentPassword, newPassword),
        onSuccess: () => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
            onSuccess('Password changed successfully');
        },
        onError: (err: any) => {
            setError(err?.response?.data?.detail || 'Failed to change password');
        },
    });

    const handleSubmit = () => {
        setError('');
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        mutation.mutate();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" /> Change Password
                </CardTitle>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
                {error && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                        {error}
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                    <div className="relative">
                        <Input
                            type={showCurrent ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                    <div className="relative">
                        <Input
                            type={showNew ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 8 characters"
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                    />
                </div>
                <Button
                    onClick={handleSubmit}
                    disabled={mutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                    className="bg-primary hover:bg-primary-700 text-white"
                >
                    {mutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                        <KeyRound className="w-4 h-4 mr-2" />
                    )}
                    Change Password
                </Button>
            </CardContent>
        </Card>
    );
}

/* ========== Notifications Tab ========== */

function NotificationsTab({ onSuccess }: { onSuccess: (msg: string) => void }) {
    const { data: settings, isLoading } = useQuery({
        queryKey: ['notification-settings'],
        queryFn: () => apiClient.getNotificationSettings(),
    });
    const queryClient = useQueryClient();
    const [localSettings, setLocalSettings] = useState<Record<string, boolean>>({});
    const [initialized, setInitialized] = useState(false);

    if (settings && !initialized) {
        setLocalSettings(settings);
        setInitialized(true);
    }

    const mutation = useMutation({
        mutationFn: (data: Record<string, boolean>) => apiClient.updateNotificationSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
            onSuccess('Notification preferences saved');
        },
    });

    const toggle = (key: string) => {
        setLocalSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const notifGroups = [
        {
            title: 'Email Notifications',
            items: [
                { key: 'email_submissions', label: 'New submissions' },
                { key: 'email_grades', label: 'Grade updates' },
                { key: 'email_announcements', label: 'Announcements' },
                { key: 'email_deadlines', label: 'Upcoming deadlines' },
            ],
        },
        {
            title: 'Push Notifications',
            items: [
                { key: 'push_submissions', label: 'New submissions' },
                { key: 'push_grades', label: 'Grade updates' },
                { key: 'push_announcements', label: 'Announcements' },
                { key: 'push_deadlines', label: 'Upcoming deadlines' },
            ],
        },
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {notifGroups.map((group) => (
                <Card key={group.title}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Bell className="w-4 h-4 text-primary" /> {group.title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y divide-gray-100">
                            {group.items.map((item) => (
                                <div
                                    key={item.key}
                                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                                >
                                    <span className="text-sm text-gray-700">{item.label}</span>
                                    <button
                                        type="button"
                                        onClick={() => toggle(item.key)}
                                        className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                                            localSettings[item.key] ? 'bg-primary' : 'bg-gray-200'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-1 ${
                                                localSettings[item.key] ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
            <div className="flex justify-end">
                <Button
                    onClick={() => mutation.mutate(localSettings)}
                    disabled={mutation.isPending}
                    className="bg-primary hover:bg-primary-700 text-white"
                >
                    {mutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Preferences
                </Button>
            </div>
        </div>
    );
}
