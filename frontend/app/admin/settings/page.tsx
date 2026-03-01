'use client';

import { useState } from 'react';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import {
    Settings,
    Server,
    Shield,
    Mail,
    Bell,
    Database,
    Clock,
    Globe,
    Palette,
    Lock,
    Key,
    Save,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Upload,
    Download,
    Trash2
} from 'lucide-react';

interface SettingsSection {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
}

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState('general');
    const [hasChanges, setHasChanges] = useState(false);
    const [resetModal, setResetModal] = useState(false);
    const [backupModal, setBackupModal] = useState(false);

    const [settings, setSettings] = useState({
        // General
        siteName: 'Kriterion',
        siteDescription: 'Automated Programming Assignment Grading System',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        maintenanceMode: false,

        // Security
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumber: true,
        passwordRequireSpecial: true,
        sessionTimeout: 30,
        maxLoginAttempts: 5,
        lockoutDuration: 15,
        enable2FA: false,

        // Email
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
        emailFrom: 'noreply@kriterion.edu',
        emailFromName: 'Kriterion System',

        // Notifications
        emailOnSubmission: true,
        emailOnGrading: true,
        emailOnNewAssignment: true,
        emailOnDueReminder: true,
        reminderDays: 2,

        // Code Execution
        defaultTimeout: 10,
        defaultMemoryLimit: 256,
        maxConcurrentJobs: 10,
        sandboxEnabled: true,

        // Appearance
        primaryColor: '#862733',
        logoUrl: '',
        faviconUrl: '',
    });

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const saveMutation = useMutation({
        mutationFn: (data: any) => apiClient.updateSettings(data),
        onSuccess: () => setHasChanges(false),
    });

    const sections: SettingsSection[] = [
        { id: 'general', title: 'General', description: 'Basic system settings', icon: <Settings className="w-5 h-5" /> },
        { id: 'security', title: 'Security', description: 'Password and authentication', icon: <Shield className="w-5 h-5" /> },
        { id: 'email', title: 'Email', description: 'SMTP configuration', icon: <Mail className="w-5 h-5" /> },
        { id: 'notifications', title: 'Notifications', description: 'Email notifications', icon: <Bell className="w-5 h-5" /> },
        { id: 'execution', title: 'Code Execution', description: 'Sandbox settings', icon: <Server className="w-5 h-5" /> },
        { id: 'appearance', title: 'Appearance', description: 'Branding and theme', icon: <Palette className="w-5 h-5" /> },
        { id: 'backup', title: 'Backup & Reset', description: 'Data management', icon: <Database className="w-5 h-5" /> },
    ];

    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout>
                <div className="space-y-6">
                    <InnerHeaderDesign
                        title="System Settings"
                        subtitle="Configure system-wide settings and preferences"
                        actions={
                            hasChanges ? (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => window.location.reload()}
                                        className="border-white/30 text-white hover:bg-white/20 hover:text-white"
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Discard
                                    </Button>
                                    <Button
                                        onClick={() => saveMutation.mutate(settings)}
                                        className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </Button>
                                </div>
                            ) : undefined
                        }
                    />

                    {hasChanges && (
                        <Alert type="warning" title="Unsaved Changes">
                            You have unsaved changes. Don't forget to save before leaving.
                        </Alert>
                    )}

                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Sidebar Navigation */}
                        <div className="lg:w-64 flex-shrink-0">
                            <Card>
                                <CardContent className="p-2">
                                    <nav className="space-y-1">
                                        {sections.map(section => (
                                            <button
                                                key={section.id}
                                                onClick={() => setActiveSection(section.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeSection === section.id
                                                    ? 'bg-[#862733]/10 text-[#862733]'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <span className={activeSection === section.id ? 'text-[#862733]' : 'text-gray-400'}>
                                                    {section.icon}
                                                </span>
                                                <div>
                                                    <p className="font-medium text-sm">{section.title}</p>
                                                    <p className="text-xs text-gray-500">{section.description}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </nav>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Settings Content */}
                        <div className="flex-1">
                            {/* General Settings */}
                            {activeSection === 'general' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Settings className="w-5 h-5 text-[#862733]" />
                                            General Settings
                                        </CardTitle>
                                        <CardDescription>Configure basic system settings</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <Input
                                            label="Site Name"
                                            value={settings.siteName}
                                            onChange={(e) => updateSetting('siteName', e.target.value)}
                                        />
                                        <Textarea
                                            label="Site Description"
                                            value={settings.siteDescription}
                                            onChange={(e) => updateSetting('siteDescription', e.target.value)}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Select
                                                label="Timezone"
                                                value={settings.timezone}
                                                onChange={(e) => updateSetting('timezone', e.target.value)}
                                                options={[
                                                    { value: 'America/New_York', label: 'Eastern (ET)' },
                                                    { value: 'America/Chicago', label: 'Central (CT)' },
                                                    { value: 'America/Denver', label: 'Mountain (MT)' },
                                                    { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
                                                    { value: 'UTC', label: 'UTC' },
                                                ]}
                                            />
                                            <Select
                                                label="Date Format"
                                                value={settings.dateFormat}
                                                onChange={(e) => updateSetting('dateFormat', e.target.value)}
                                                options={[
                                                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                                                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                                                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                                                ]}
                                            />
                                        </div>
                                        <div className="pt-4 border-t">
                                            <Switch
                                                checked={settings.maintenanceMode}
                                                onChange={(checked) => updateSetting('maintenanceMode', checked)}
                                                label="Maintenance Mode"
                                                description="When enabled, only admins can access the system"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Security Settings */}
                            {activeSection === 'security' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Shield className="w-5 h-5 text-[#862733]" />
                                            Security Settings
                                        </CardTitle>
                                        <CardDescription>Configure password policies and authentication</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div>
                                            <h3 className="font-medium text-gray-900 mb-4">Password Policy</h3>
                                            <div className="space-y-4">
                                                <Input
                                                    label="Minimum Password Length"
                                                    type="number"
                                                    value={settings.passwordMinLength.toString()}
                                                    onChange={(e) => updateSetting('passwordMinLength', parseInt(e.target.value))}
                                                />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Switch
                                                        checked={settings.passwordRequireUppercase}
                                                        onChange={(checked) => updateSetting('passwordRequireUppercase', checked)}
                                                        label="Require Uppercase"
                                                    />
                                                    <Switch
                                                        checked={settings.passwordRequireLowercase}
                                                        onChange={(checked) => updateSetting('passwordRequireLowercase', checked)}
                                                        label="Require Lowercase"
                                                    />
                                                    <Switch
                                                        checked={settings.passwordRequireNumber}
                                                        onChange={(checked) => updateSetting('passwordRequireNumber', checked)}
                                                        label="Require Number"
                                                    />
                                                    <Switch
                                                        checked={settings.passwordRequireSpecial}
                                                        onChange={(checked) => updateSetting('passwordRequireSpecial', checked)}
                                                        label="Require Special Character"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t">
                                            <h3 className="font-medium text-gray-900 mb-4">Session & Login</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input
                                                    label="Session Timeout (minutes)"
                                                    type="number"
                                                    value={settings.sessionTimeout.toString()}
                                                    onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
                                                />
                                                <Input
                                                    label="Max Login Attempts"
                                                    type="number"
                                                    value={settings.maxLoginAttempts.toString()}
                                                    onChange={(e) => updateSetting('maxLoginAttempts', parseInt(e.target.value))}
                                                />
                                                <Input
                                                    label="Lockout Duration (minutes)"
                                                    type="number"
                                                    value={settings.lockoutDuration.toString()}
                                                    onChange={(e) => updateSetting('lockoutDuration', parseInt(e.target.value))}
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t">
                                            <Switch
                                                checked={settings.enable2FA}
                                                onChange={(checked) => updateSetting('enable2FA', checked)}
                                                label="Enable Two-Factor Authentication"
                                                description="Require 2FA for admin accounts"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Email Settings */}
                            {activeSection === 'email' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Mail className="w-5 h-5 text-[#862733]" />
                                            Email Settings
                                        </CardTitle>
                                        <CardDescription>Configure SMTP server for sending emails</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="SMTP Host"
                                                value={settings.smtpHost}
                                                onChange={(e) => updateSetting('smtpHost', e.target.value)}
                                                placeholder="smtp.gmail.com"
                                            />
                                            <Input
                                                label="SMTP Port"
                                                type="number"
                                                value={settings.smtpPort.toString()}
                                                onChange={(e) => updateSetting('smtpPort', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="SMTP Username"
                                                value={settings.smtpUser}
                                                onChange={(e) => updateSetting('smtpUser', e.target.value)}
                                            />
                                            <Input
                                                label="SMTP Password"
                                                type="password"
                                                value={settings.smtpPassword}
                                                onChange={(e) => updateSetting('smtpPassword', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="From Email"
                                                value={settings.emailFrom}
                                                onChange={(e) => updateSetting('emailFrom', e.target.value)}
                                            />
                                            <Input
                                                label="From Name"
                                                value={settings.emailFromName}
                                                onChange={(e) => updateSetting('emailFromName', e.target.value)}
                                            />
                                        </div>
                                        <div className="pt-4">
                                            <Button variant="outline">
                                                <Mail className="w-4 h-4 mr-2" />
                                                Send Test Email
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Notification Settings */}
                            {activeSection === 'notifications' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Bell className="w-5 h-5 text-[#862733]" />
                                            Notification Settings
                                        </CardTitle>
                                        <CardDescription>Configure email notifications for users</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-4">
                                            <Switch
                                                checked={settings.emailOnSubmission}
                                                onChange={(checked) => updateSetting('emailOnSubmission', checked)}
                                                label="Email on Submission"
                                                description="Send confirmation when a student submits an assignment"
                                            />
                                            <Switch
                                                checked={settings.emailOnGrading}
                                                onChange={(checked) => updateSetting('emailOnGrading', checked)}
                                                label="Email on Grading"
                                                description="Notify students when their submission is graded"
                                            />
                                            <Switch
                                                checked={settings.emailOnNewAssignment}
                                                onChange={(checked) => updateSetting('emailOnNewAssignment', checked)}
                                                label="Email on New Assignment"
                                                description="Notify students when a new assignment is published"
                                            />
                                            <Switch
                                                checked={settings.emailOnDueReminder}
                                                onChange={(checked) => updateSetting('emailOnDueReminder', checked)}
                                                label="Due Date Reminder"
                                                description="Send reminder before assignment due date"
                                            />
                                            {settings.emailOnDueReminder && (
                                                <Input
                                                    label="Reminder Days Before Due"
                                                    type="number"
                                                    value={settings.reminderDays.toString()}
                                                    onChange={(e) => updateSetting('reminderDays', parseInt(e.target.value))}
                                                    className="ml-6"
                                                />
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Code Execution Settings */}
                            {activeSection === 'execution' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Server className="w-5 h-5 text-[#862733]" />
                                            Code Execution Settings
                                        </CardTitle>
                                        <CardDescription>Configure sandbox and execution limits</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Default Timeout (seconds)"
                                                type="number"
                                                value={settings.defaultTimeout.toString()}
                                                onChange={(e) => updateSetting('defaultTimeout', parseInt(e.target.value))}
                                            />
                                            <Input
                                                label="Default Memory Limit (MB)"
                                                type="number"
                                                value={settings.defaultMemoryLimit.toString()}
                                                onChange={(e) => updateSetting('defaultMemoryLimit', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <Input
                                            label="Max Concurrent Jobs"
                                            type="number"
                                            value={settings.maxConcurrentJobs.toString()}
                                            onChange={(e) => updateSetting('maxConcurrentJobs', parseInt(e.target.value))}
                                        />
                                        <div className="pt-4 border-t">
                                            <Switch
                                                checked={settings.sandboxEnabled}
                                                onChange={(checked) => updateSetting('sandboxEnabled', checked)}
                                                label="Enable Sandbox"
                                                description="Run code in isolated containers for security"
                                            />
                                        </div>
                                        <Alert type="info" title="Execution Environment">
                                            Code is executed in Docker containers with restricted network access and resource limits.
                                        </Alert>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Appearance Settings */}
                            {activeSection === 'appearance' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Palette className="w-5 h-5 text-[#862733]" />
                                            Appearance Settings
                                        </CardTitle>
                                        <CardDescription>Customize branding and theme</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="color"
                                                    value={settings.primaryColor}
                                                    onChange={(e) => updateSetting('primaryColor', e.target.value)}
                                                    className="w-12 h-12 rounded-lg border cursor-pointer"
                                                />
                                                <Input
                                                    value={settings.primaryColor}
                                                    onChange={(e) => updateSetting('primaryColor', e.target.value)}
                                                    className="w-32"
                                                />
                                                <div
                                                    className="px-4 py-2 rounded-lg text-white font-medium"
                                                    style={{ backgroundColor: settings.primaryColor }}
                                                >
                                                    Preview
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                                                <p className="text-xs text-gray-500 mt-1">PNG, JPG or SVG (max 2MB)</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Favicon</label>
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                                                <p className="text-xs text-gray-500 mt-1">ICO, PNG (32x32 recommended)</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Backup & Reset */}
                            {activeSection === 'backup' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Database className="w-5 h-5 text-[#862733]" />
                                            Backup & Reset
                                        </CardTitle>
                                        <CardDescription>Data management and system reset options</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <h3 className="font-medium text-gray-900 mb-2">Database Backup</h3>
                                            <p className="text-sm text-gray-600 mb-4">
                                                Create a backup of all system data including users, courses, assignments, and submissions.
                                            </p>
                                            <div className="flex gap-2">
                                                <Button variant="outline" onClick={() => setBackupModal(true)}>
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Export Backup
                                                </Button>
                                                <Button variant="outline">
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Import Backup
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <h3 className="font-medium text-red-900 mb-2">Danger Zone</h3>
                                            <p className="text-sm text-red-700 mb-4">
                                                These actions are irreversible. Please proceed with caution.
                                            </p>
                                            <div className="space-y-2">
                                                <Button
                                                    variant="outline"
                                                    className="text-red-600 border-red-300 hover:bg-red-100"
                                                    onClick={() => setResetModal(true)}
                                                >
                                                    <RefreshCw className="w-4 h-4 mr-2" />
                                                    Reset Settings to Default
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="text-red-600 border-red-300 hover:bg-red-100 ml-2"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Clear All Data
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reset Confirmation Modal */}
                <Modal
                    isOpen={resetModal}
                    onClose={() => setResetModal(false)}
                    title="Reset Settings"
                    size="sm"
                >
                    <Alert type="warning" title="Are you sure?">
                        This will reset all settings to their default values. This action cannot be undone.
                    </Alert>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setResetModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => {
                                // Reset logic
                                setResetModal(false);
                            }}
                        >
                            Reset Settings
                        </Button>
                    </ModalFooter>
                </Modal>

                {/* Backup Modal */}
                <Modal
                    isOpen={backupModal}
                    onClose={() => setBackupModal(false)}
                    title="Export Backup"
                    size="md"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Select what to include in the backup:
                        </p>
                        <div className="space-y-3">
                            <Switch checked={true} onChange={() => { }} label="Users" />
                            <Switch checked={true} onChange={() => { }} label="Courses" />
                            <Switch checked={true} onChange={() => { }} label="Assignments" />
                            <Switch checked={true} onChange={() => { }} label="Submissions" />
                            <Switch checked={true} onChange={() => { }} label="Settings" />
                        </div>
                    </div>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setBackupModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setBackupModal(false)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Backup
                        </Button>
                    </ModalFooter>
                </Modal>
            </AdminLayout>
        </ProtectedRoute>
    );
}
