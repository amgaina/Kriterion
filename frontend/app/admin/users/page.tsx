'use client';

import { useRef, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/lib/use-mutation-with-invalidation';
import apiClient from '@/lib/api-client';
import { parseStudentsFromFile } from '@/lib/parse-students';
import * as XLSX from 'xlsx';
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
    RefreshCw
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

export default function UsersPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; user?: User }>({ open: false });
    const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
    const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user?: User }>({ open: false });
    const [importGuideModalOpen, setImportGuideModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);

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

    const bulkImportMutation = useMutationWithInvalidation({
        mutationFn: (students: Array<{ email: string; full_name?: string; student_id?: string }>) =>
            apiClient.bulkImportStudents(students),
        invalidateGroups: ['allUsers', 'allDashboards'],
        onSuccess: (data: any) => {
            const created = data?.created || 0;
            const skipped = data?.skipped || 0;
            setImportStatus({
                type: skipped > 0 ? 'warning' : 'success',
                message: skipped > 0
                    ? `Imported ${created} student(s). Skipped ${skipped} duplicate/existing row(s).`
                    : `Imported ${created} student(s) successfully.`,
            });
            if (importFileInputRef.current) importFileInputRef.current.value = '';
        },
        onError: (err: any) => {
            setImportStatus({
                type: 'error',
                message: err?.response?.data?.detail || 'Failed to import students.',
            });
            if (importFileInputRef.current) importFileInputRef.current.value = '';
        },
    });

    const handleImportClick = () => {
        setImportStatus(null);
        setImportGuideModalOpen(true);
    };

    const handleDownloadExcelTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['full_name', 'email', 'student_id'],
            ['Ada Lovelace', 'ada.lovelace@example.edu', 'S001'],
            ['Alan Turing', 'alan.turing@example.edu', 'S002'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        XLSX.writeFile(wb, 'bulk-student-import-template.xlsx');
    };

    const handleChooseImportFile = () => {
        importFileInputRef.current?.click();
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportGuideModalOpen(false);
        setImportStatus(null);
        const parsedRows = await parseStudentsFromFile(file);
        if (!parsedRows.length) {
            setImportStatus({
                type: 'error',
                message: 'No valid rows found. Use a CSV/XLSX file with at least an email column.',
            });
            if (importFileInputRef.current) importFileInputRef.current.value = '';
            return;
        }

        bulkImportMutation.mutate(parsedRows);
    };

    const handleExport = () => {
        const usersToExport = selectedUsers.length > 0 ? selectedUsers : filteredUsers;

        if (usersToExport.length === 0) {
            // You could add a toast notification here to inform the user that there is nothing to export.
            return;
        }

        const data = usersToExport.map((user: User) => ({
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            student_id: user.role === 'STUDENT' ? user.student_id || '' : '',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');
        XLSX.writeFile(wb, `kriterion_users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                            <input
                                ref={importFileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={handleImportFileChange}
                            />

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
                                    onClick={handleImportClick}
                                    disabled={bulkImportMutation.isPending}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    {bulkImportMutation.isPending ? 'Importing...' : 'Import Students'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExport}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </Button>
                            </div>
                        </div>

                        {importStatus && (
                            <div className="mt-4">
                                <Alert type={importStatus.type}>
                                    {importStatus.message}
                                </Alert>
                            </div>
                        )}

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

            {/* Import Guide Modal */}
            <Modal
                isOpen={importGuideModalOpen}
                onClose={() => setImportGuideModalOpen(false)}
                title="Import Students"
                description="Use CSV or Excel with this structure before uploading."
            >
                <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">Required format</p>
                        <ul className="text-sm text-gray-700 space-y-1">
                            <li>• Headers: full_name, email, student_id</li>
                            <li>• Email values must be valid and unique</li>
                            <li>• The student_id is required and must be unique.</li>
                            <li>• Missing full_name will be generated from the email</li>
                        </ul>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Example rows
                        </div>
                        <div className="p-3 text-sm text-gray-700 font-mono space-y-1">
                            <p>full_name,email,student_id</p>
                            <p>Ada Lovelace,ada.lovelace@example.edu,S001</p>
                            <p>Alan Turing,alan.turing@example.edu,S002</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <button
                            type="button"
                            onClick={handleDownloadExcelTemplate}
                            className="text-[#862733] hover:underline"
                        >
                            Download Excel template
                        </button>
                        <a
                            href="/bulk-student-import-template.csv"
                            download="bulk-student-import-template.csv"
                            className="text-[#862733] hover:underline"
                        >
                            Download CSV template
                        </a>
                    </div>
                </div>

                <ModalFooter>
                    <Button variant="outline" onClick={() => setImportGuideModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleChooseImportFile} disabled={bulkImportMutation.isPending}>
                        Choose File to Import
                    </Button>
                </ModalFooter>
            </Modal>
        </ProtectedRoute>
    );
}
