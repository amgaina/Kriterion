'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/lib/use-mutation-with-invalidation';
import apiClient from '@/lib/api-client';
import { parseBulkUsersFromFile, type BulkUserCreateInput, type BulkUserParseError } from '@/lib/parse-bulk-users';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Dropdown } from '@/components/ui/dropdown';
import { Alert } from '@/components/ui/alert';
import Link from 'next/link';
import {
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    Lock,
    UserCheck,
    UserX,
    Mail,
    Download,
    Upload,
    Filter,
    RefreshCw,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

interface User {
    id: number;
    email: string;
    full_name: string;
    role: string;
    student_id?: string;
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
    last_login?: string;
}

interface BulkImportSummary {
    created: number;
    failed: number;
    errors: string[];
}

export default function UsersPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; user?: User }>({ open: false });
    const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
    const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user?: User }>({ open: false });
    const [newPassword, setNewPassword] = useState('');
    const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
    const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
    const [parsedUsers, setParsedUsers] = useState<BulkUserCreateInput[]>([]);
    const [parseErrors, setParseErrors] = useState<BulkUserParseError[]>([]);
    const [bulkImportSummary, setBulkImportSummary] = useState<BulkImportSummary | null>(null);

    const { data: users = [], isLoading, refetch } = useQuery({
        queryKey: ['users', roleFilter],
        queryFn: () => apiClient.getUsers(roleFilter || undefined),
    });

    const deleteMutation = useMutationWithInvalidation({
        mutationFn: (userId: number) => apiClient.deleteUser(userId),
        invalidateGroups: ['allUsers', 'allDashboards'],
        onSuccess: () => {
            setDeleteModal({ open: false });
        },
    });

    const bulkDeleteMutation = useMutationWithInvalidation({
        mutationFn: async (userIds: number[]) => {
            for (const id of userIds) {
                await apiClient.deleteUser(id);
            }
        },
        invalidateGroups: ['allUsers', 'allDashboards'],
        onSuccess: () => {
            setBulkDeleteModal(false);
            setSelectedUsers([]);
        },
    });

    const activateMutation = useMutationWithInvalidation({
        mutationFn: (userId: number) => apiClient.activateUser(userId),
        invalidateGroups: ['allUsers'],
    });

    const deactivateMutation = useMutationWithInvalidation({
        mutationFn: (userId: number) => apiClient.deactivateUser(userId),
        invalidateGroups: ['allUsers'],
    });

    const resetPasswordMutation = useMutation({
        mutationFn: ({ userId, password }: { userId: number; password: string }) =>
            apiClient.resetUserPassword(userId, password),
        onSuccess: () => {
            setResetPasswordModal({ open: false });
            setNewPassword('');
        },
    });

    const bulkImportMutation = useMutation({
        mutationFn: async (rows: BulkUserCreateInput[]) => {
            const errors: string[] = [];
            let created = 0;

            for (const row of rows) {
                try {
                    await apiClient.createUser({
                        email: row.email,
                        full_name: row.full_name,
                        role: row.role,
                        password: row.password,
                        student_id: row.student_id,
                        is_active: row.is_active,
                        send_welcome_email: row.send_welcome_email,
                    });
                    created += 1;
                } catch (error: any) {
                    const detail = error?.response?.data?.detail;
                    const detailText = Array.isArray(detail)
                        ? detail.map((item: any) => item?.msg).filter(Boolean).join(', ')
                        : (typeof detail === 'string' ? detail : 'Failed to create user');
                    errors.push(`${row.email}: ${detailText}`);
                }
            }

            return {
                created,
                failed: rows.length - created,
                errors,
            };
        },
        onSuccess: (result) => {
            setBulkImportSummary(result);
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const resetBulkImportState = () => {
        setBulkImportFile(null);
        setParsedUsers([]);
        setParseErrors([]);
        setBulkImportSummary(null);
    };

    const handleBulkImportFile = async (file: File | null) => {
        setBulkImportFile(file);
        setParsedUsers([]);
        setParseErrors([]);
        setBulkImportSummary(null);

        if (!file) return;

        try {
            const result = await parseBulkUsersFromFile(file);
            setParsedUsers(result.users);
            setParseErrors(result.errors);
        } catch {
            setParseErrors([{ row: 1, message: 'Unable to parse the selected file.' }]);
        }
    };

    const closeBulkImportModal = () => {
        if (bulkImportMutation.isPending) return;
        setBulkImportModalOpen(false);
        resetBulkImportState();
    };

    const filteredUsers = users.filter((user: User) =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectRow = (user: User) => {
        setSelectedUsers(prev =>
            prev.find(u => u.id === user.id)
                ? prev.filter(u => u.id !== user.id)
                : [...prev, user]
        );
    };

    const handleSelectAll = () => {
        setSelectedUsers(selectedUsers.length === filteredUsers.length ? [] : filteredUsers);
    };

    const columns = [
        {
            key: 'user',
            header: 'User',
            cell: (user: User) => (
                <div className="flex items-center gap-3">
                    <Avatar alt={user.full_name} size="sm" />
                    <div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'role',
            header: 'Role',
            cell: (user: User) => (
                <Badge variant={
                    user.role === 'ADMIN' ? 'danger' :
                        user.role === 'FACULTY' ? 'primary' :
                            user.role === 'ASSISTANT' ? 'warning' : 'default'
                }>
                    {user.role}
                </Badge>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (user: User) => (
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">{user.is_active ? 'Active' : 'Inactive'}</span>
                </div>
            ),
        },
        {
            key: 'student_id',
            header: 'Student ID',
            cell: (user: User) => (
                <span className="text-sm text-gray-600">{user.student_id || '-'}</span>
            ),
        },
        {
            key: 'last_login',
            header: 'Last Login',
            cell: (user: User) => (
                <span className="text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                </span>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (user: User) => (
                <Dropdown
                    trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    }
                    items={[
                        { label: 'Edit', value: 'edit', icon: <Edit className="w-4 h-4" /> },
                        { label: 'Reset Password', value: 'reset', icon: <Lock className="w-4 h-4" /> },
                        { label: 'Send Email', value: 'email', icon: <Mail className="w-4 h-4" /> },
                        {
                            label: user.is_active ? 'Deactivate' : 'Activate',
                            value: user.is_active ? 'deactivate' : 'activate',
                            icon: user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />
                        },
                        { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, danger: true },
                    ]}
                    onSelect={(value) => {
                        if (value === 'delete') setDeleteModal({ open: true, user });
                        else if (value === 'reset') setResetPasswordModal({ open: true, user });
                        else if (value === 'activate') activateMutation.mutate(user.id);
                        else if (value === 'deactivate') deactivateMutation.mutate(user.id);
                        else if (value === 'edit') window.location.href = `/admin/users/${user.id}/edit`;
                    }}
                    align="right"
                />
            ),
        },
    ];

    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                        <p className="text-gray-500 mt-1">Manage all users in the system</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Link href="/admin/users/new">
                            <Button size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Add User
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-500">Total Users</p>
                            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-500">Active</p>
                            <p className="text-2xl font-bold text-green-600">
                                {users.filter((u: User) => u.is_active).length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-500">Faculty</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {users.filter((u: User) => u.role === 'FACULTY').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-500">Students</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {users.filter((u: User) => u.role === 'STUDENT').length}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters & Search */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <SearchInput
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Search users..."
                                className="md:w-80"
                            />
                            <Select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                options={[
                                    { value: '', label: 'All Roles' },
                                    { value: 'ADMIN', label: 'Admin' },
                                    { value: 'FACULTY', label: 'Faculty' },
                                    { value: 'ASSISTANT', label: 'Assistant' },
                                    { value: 'STUDENT', label: 'Student' },
                                ]}
                                className="md:w-40"
                            />
                            <div className="flex-1" />
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        resetBulkImportState();
                                        setBulkImportModalOpen(true);
                                    }}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Import
                                </Button>
                                <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </Button>
                            </div>
                        </div>

                        {selectedUsers.length > 0 && (
                            <div className="mt-4 p-3 bg-[#862733]/5 rounded-lg flex items-center justify-between">
                                <span className="text-sm text-[#862733]">
                                    {selectedUsers.length} users selected
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm">
                                        Send Email
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-red-600 hover:bg-red-50"
                                        onClick={() => setBulkDeleteModal(true)}
                                    >
                                        Delete Selected
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Users Table */}
                <Card>
                    <DataTable
                        columns={columns}
                        data={filteredUsers}
                        isLoading={isLoading}
                        emptyMessage="No users found"
                        selectedRows={selectedUsers}
                        onSelectRow={handleSelectRow}
                        onSelectAll={handleSelectAll}
                    />
                </Card>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false })}
                title="Delete User"
                description="Are you sure you want to delete this user? This action cannot be undone."
            >
                <Alert type="warning">
                    You are about to delete <strong>{deleteModal.user?.full_name}</strong>.
                    All their data will be permanently removed.
                </Alert>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setDeleteModal({ open: false })}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => deleteModal.user && deleteMutation.mutate(deleteModal.user.id)}
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete User'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                isOpen={resetPasswordModal.open}
                onClose={() => {
                    setResetPasswordModal({ open: false });
                    setNewPassword('');
                }}
                title="Reset Password"
                description={`Set a new password for ${resetPasswordModal.user?.full_name}`}
            >
                <div className="space-y-4">
                    <Input
                        label="New Password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                    />
                    <p className="text-sm text-gray-500">
                        Password must be at least 8 characters with uppercase, lowercase, number, and special character.
                    </p>
                </div>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setResetPasswordModal({ open: false })}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => resetPasswordModal.user && resetPasswordMutation.mutate({
                            userId: resetPasswordModal.user.id,
                            password: newPassword
                        })}
                        disabled={!newPassword || resetPasswordMutation.isPending}
                    >
                        {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Bulk Delete Confirmation Modal */}
            <Modal
                isOpen={bulkDeleteModal}
                onClose={() => setBulkDeleteModal(false)}
                title="Delete Selected Users"
                description="Are you sure you want to delete the selected users? This action cannot be undone."
            >
                <Alert type="warning">
                    You are about to delete <strong>{selectedUsers.length} users</strong>:
                    <ul className="mt-2 list-disc list-inside text-sm">
                        {selectedUsers.slice(0, 5).map(user => (
                            <li key={user.id}>{user.full_name} ({user.email})</li>
                        ))}
                        {selectedUsers.length > 5 && (
                            <li>...and {selectedUsers.length - 5} more</li>
                        )}
                    </ul>
                </Alert>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setBulkDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => bulkDeleteMutation.mutate(selectedUsers.map(u => u.id))}
                        disabled={bulkDeleteMutation.isPending}
                    >
                        {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedUsers.length} Users`}
                    </Button>
                </ModalFooter>
            </Modal>

            <Modal
                isOpen={bulkImportModalOpen}
                onClose={closeBulkImportModal}
                title="Bulk Create Users"
                description="Upload one template for STUDENT, FACULTY, ASSISTANT, and ADMIN users."
                size="lg"
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-sm text-gray-700">
                            Required columns: <strong>email, full_name, role, password</strong>. Student rows also require <strong>student_id</strong>.
                        </p>
                        <a
                            href="/bulk-user-template.csv"
                            download="bulk-user-template.csv"
                            className="inline-flex items-center gap-2 text-sm text-[#862733] hover:underline"
                        >
                            <Download className="w-4 h-4" />
                            Download template
                        </a>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV or Excel</label>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={(e) => handleBulkImportFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                        />
                        {bulkImportFile && (
                            <p className="mt-2 text-xs text-gray-500">Selected: {bulkImportFile.name}</p>
                        )}
                    </div>

                    {parseErrors.length > 0 && (
                        <Alert type="warning">
                            <div className="space-y-1">
                                <p className="font-medium">Some rows are invalid and will be skipped.</p>
                                <ul className="list-disc list-inside text-sm">
                                    {parseErrors.slice(0, 8).map((error, index) => (
                                        <li key={`${error.row}-${index}`}>
                                            Row {error.row}: {error.message}
                                        </li>
                                    ))}
                                    {parseErrors.length > 8 && (
                                        <li>...and {parseErrors.length - 8} more</li>
                                    )}
                                </ul>
                            </div>
                        </Alert>
                    )}

                    {(parsedUsers.length > 0 || parseErrors.length > 0) && (
                        <div className="rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 flex items-center gap-2">
                            {parsedUsers.length > 0 ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                            )}
                            Ready to create <strong>{parsedUsers.length}</strong> user{parsedUsers.length === 1 ? '' : 's'}.
                            {parseErrors.length > 0 && (
                                <span className="text-gray-500">Skipped invalid rows: {parseErrors.length}</span>
                            )}
                        </div>
                    )}

                    {bulkImportSummary && (
                        <Alert type={bulkImportSummary.failed > 0 ? 'warning' : 'success'}>
                            <div className="space-y-1">
                                <p className="font-medium">
                                    Created {bulkImportSummary.created} user{bulkImportSummary.created === 1 ? '' : 's'}
                                    {bulkImportSummary.failed > 0 ? `, failed ${bulkImportSummary.failed}` : ''}.
                                </p>
                                {bulkImportSummary.errors.length > 0 && (
                                    <ul className="list-disc list-inside text-sm">
                                        {bulkImportSummary.errors.slice(0, 8).map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                        {bulkImportSummary.errors.length > 8 && (
                                            <li>...and {bulkImportSummary.errors.length - 8} more</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </Alert>
                    )}
                </div>

                <ModalFooter>
                    <Button variant="outline" onClick={closeBulkImportModal} disabled={bulkImportMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => bulkImportMutation.mutate(parsedUsers)}
                        disabled={bulkImportMutation.isPending || parsedUsers.length === 0}
                    >
                        {bulkImportMutation.isPending ? 'Creating Users...' : `Create ${parsedUsers.length} Users`}
                    </Button>
                </ModalFooter>
            </Modal>
        </ProtectedRoute>
    );
}
