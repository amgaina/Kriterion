'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { Avatar } from '@/components/ui/avatar';
import { Dropdown } from '@/components/ui/dropdown';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import Link from 'next/link';
import {
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    Users,
    BookOpen,
    Code,
    Settings,
    Eye,
    UserPlus
} from 'lucide-react';

interface Faculty {
    id: number;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    courses_count?: number;
    students_count?: number;
    created_at: string;
}

export default function FacultyPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [permissionsModal, setPermissionsModal] = useState<{ open: boolean; faculty?: Faculty }>({ open: false });
    const [assignStudentsModal, setAssignStudentsModal] = useState<{ open: boolean; faculty?: Faculty }>({ open: false });

    // Language permissions state
    const [languagePermissions, setLanguagePermissions] = useState({
        python: true,
        java: true,
        javascript: false,
        cpp: false,
        c: false,
        csharp: false,
    });

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', 'FACULTY'],
        queryFn: () => apiClient.getUsers('FACULTY'),
    });

    const { data: students = [] } = useQuery({
        queryKey: ['users', 'STUDENT'],
        queryFn: () => apiClient.getUsers('STUDENT'),
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const filteredFaculty = users.filter((user: Faculty) =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tabs = [
        { id: 'all', label: 'All Faculty', count: users.length },
        { id: 'active', label: 'Active', count: users.filter((u: Faculty) => u.is_active).length },
        { id: 'inactive', label: 'Inactive', count: users.filter((u: Faculty) => !u.is_active).length },
    ];

    const columns = [
        {
            key: 'faculty',
            header: 'Faculty Member',
            cell: (faculty: Faculty) => (
                <div className="flex items-center gap-3">
                    <Avatar alt={faculty.full_name} size="md" />
                    <div>
                        <p className="font-medium text-gray-900">{faculty.full_name}</p>
                        <p className="text-sm text-gray-500">{faculty.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'courses',
            header: 'Courses',
            cell: (faculty: Faculty) => (
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    <span>{faculty.courses_count || 0}</span>
                </div>
            ),
        },
        {
            key: 'students',
            header: 'Students',
            cell: (faculty: Faculty) => (
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{faculty.students_count || 0}</span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (faculty: Faculty) => (
                <Badge variant={faculty.is_active ? 'success' : 'danger'}>
                    {faculty.is_active ? 'Active' : 'Inactive'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (faculty: Faculty) => (
                <Dropdown
                    trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    }
                    items={[
                        { label: 'View Profile', value: 'view', icon: <Eye className="w-4 h-4" /> },
                        { label: 'Edit', value: 'edit', icon: <Edit className="w-4 h-4" /> },
                        { label: 'Assign Students', value: 'students', icon: <UserPlus className="w-4 h-4" /> },
                        { label: 'Language Permissions', value: 'permissions', icon: <Code className="w-4 h-4" /> },
                        { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, danger: true },
                    ]}
                    onSelect={(value) => {
                        if (value === 'permissions') setPermissionsModal({ open: true, faculty });
                        else if (value === 'students') setAssignStudentsModal({ open: true, faculty });
                        else if (value === 'edit') window.location.href = `/admin/users/${faculty.id}/edit`;
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
                            <h1 className="text-2xl font-bold text-gray-900">Faculty Management</h1>
                            <p className="text-gray-500 mt-1">Manage faculty members, courses, and permissions</p>
                        </div>
                        <Link href="/admin/faculty/new">
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Faculty
                            </Button>
                        </Link>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Total Faculty</p>
                                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Active Courses</p>
                                <p className="text-2xl font-bold text-blue-600">{courses.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Total Students</p>
                                <p className="text-2xl font-bold text-green-600">{students.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Avg Students/Faculty</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {users.length > 0 ? Math.round(students.length / users.length) : 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabs & Search */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                                <Tabs
                                    tabs={tabs}
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    className="flex-1"
                                />
                                <SearchInput
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder="Search faculty..."
                                    className="md:w-64"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Faculty Table */}
                    <Card>
                        <DataTable
                            columns={columns}
                            data={filteredFaculty.filter((f: Faculty) =>
                                activeTab === 'all' ? true :
                                    activeTab === 'active' ? f.is_active :
                                        !f.is_active
                            )}
                            isLoading={isLoading}
                            emptyMessage="No faculty members found"
                        />
                    </Card>
                </div>

                {/* Language Permissions Modal */}
                <Modal
                    isOpen={permissionsModal.open}
                    onClose={() => setPermissionsModal({ open: false })}
                    title="Language Permissions"
                    description={`Configure programming language access for ${permissionsModal.faculty?.full_name}`}
                    size="md"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Select which programming languages this faculty member can use for assignments:
                        </p>
                        <div className="space-y-3">
                            <Switch
                                checked={languagePermissions.python}
                                onChange={(checked) => setLanguagePermissions(prev => ({ ...prev, python: checked }))}
                                label="Python"
                                description="Python 3.x programming language"
                            />
                            <Switch
                                checked={languagePermissions.java}
                                onChange={(checked) => setLanguagePermissions(prev => ({ ...prev, java: checked }))}
                                label="Java"
                                description="Java 11+ programming language"
                            />
                            <Switch
                                checked={languagePermissions.javascript}
                                onChange={(checked) => setLanguagePermissions(prev => ({ ...prev, javascript: checked }))}
                                label="JavaScript"
                                description="Node.js JavaScript runtime"
                            />
                            <Switch
                                checked={languagePermissions.cpp}
                                onChange={(checked) => setLanguagePermissions(prev => ({ ...prev, cpp: checked }))}
                                label="C++"
                                description="C++17 programming language"
                            />
                            <Switch
                                checked={languagePermissions.c}
                                onChange={(checked) => setLanguagePermissions(prev => ({ ...prev, c: checked }))}
                                label="C"
                                description="C programming language"
                            />
                            <Switch
                                checked={languagePermissions.csharp}
                                onChange={(checked) => setLanguagePermissions(prev => ({ ...prev, csharp: checked }))}
                                label="C#"
                                description=".NET C# programming language"
                            />
                        </div>
                    </div>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setPermissionsModal({ open: false })}>
                            Cancel
                        </Button>
                        <Button onClick={() => setPermissionsModal({ open: false })}>
                            Save Permissions
                        </Button>
                    </ModalFooter>
                </Modal>

                {/* Assign Students Modal */}
                <Modal
                    isOpen={assignStudentsModal.open}
                    onClose={() => setAssignStudentsModal({ open: false })}
                    title="Assign Students"
                    description={`Add students to ${assignStudentsModal.faculty?.full_name}'s courses`}
                    size="lg"
                >
                    <div className="space-y-4">
                        <Select
                            label="Select Course"
                            options={courses.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
                            placeholder="Choose a course"
                        />
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                            {students.slice(0, 10).map((student: any) => (
                                <div key={student.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]" />
                                    <Avatar alt={student.full_name} size="sm" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{student.full_name}</p>
                                        <p className="text-xs text-gray-500">{student.email}</p>
                                    </div>
                                    <Badge variant="outline">{student.student_id || 'N/A'}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setAssignStudentsModal({ open: false })}>
                            Cancel
                        </Button>
                        <Button onClick={() => setAssignStudentsModal({ open: false })}>
                            Assign Students
                        </Button>
                    </ModalFooter>
                </Modal>
        </ProtectedRoute>
    );
}
