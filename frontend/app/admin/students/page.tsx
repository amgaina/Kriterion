'use client';

import { useRef, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/lib/use-mutation-with-invalidation';
import apiClient from '@/lib/api-client';
import { parseStudentsFromFile } from '@/lib/parse-students';
import * as XLSX from 'xlsx';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dropdown } from '@/components/ui/dropdown';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import Link from 'next/link';
import {
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    GraduationCap,
    Mail,
    BookOpen,
    AlertCircle,
    Download,
    Upload,
    UserX,
    CheckCircle
} from 'lucide-react';

interface Student {
    id: number;
    email: string;
    full_name: string;
    student_id?: string;
    is_active: boolean;
    is_verified: boolean;
    enrolled_courses?: number;
    submissions?: number;
    avg_score?: number;
    created_at: string;
}

interface BulkImportSummary {
    created: number;
    skipped: number;
    existing_emails: string[];
    duplicate_emails_in_file: string[];
    existing_student_ids: string[];
    duplicate_student_ids_in_file: string[];
}

export default function StudentsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [bulkModal, setBulkModal] = useState(false);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkImportSummary, setBulkImportSummary] = useState<BulkImportSummary | null>(null);
    const [bulkImportError, setBulkImportError] = useState<string | null>(null);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: students = [], isLoading } = useQuery({
        queryKey: ['users', 'STUDENT'],
        queryFn: () => apiClient.getUsers('STUDENT'),
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const deleteMutation = useMutationWithInvalidation({
        mutationFn: (userId: number) => apiClient.deleteUser(userId),
        invalidateGroups: ['allUsers', 'allDashboards'],
    });

    const bulkImportMutation = useMutationWithInvalidation({
        mutationFn: (students: Array<{ email: string; full_name?: string; student_id?: string }>) =>
            apiClient.bulkImportStudents(students),
        invalidateGroups: ['allUsers', 'allDashboards'],
        onSuccess: (data: BulkImportSummary) => {
            setBulkImportSummary(data);
            setBulkImportError(null);
            setBulkFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (err: any) => {
            setBulkImportError(err?.response?.data?.detail || 'Bulk import failed');
        },
    });

    const resetBulkModalState = () => {
        setBulkFile(null);
        setBulkImportSummary(null);
        setBulkImportError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
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

    const handleBulkImport = async () => {
        setBulkImportError(null);
        setBulkImportSummary(null);

        if (!bulkFile) {
            setBulkImportError('Please upload a CSV or Excel file first.');
            return;
        }

        const parsedRows = await parseStudentsFromFile(bulkFile);
        if (!parsedRows.length) {
            setBulkImportError('No valid student rows found. Ensure your file includes at least an email column.');
            return;
        }

        bulkImportMutation.mutate(parsedRows);
    };

    const filteredStudents = students.filter((student: Student) =>
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeStudents = filteredStudents.filter((s: Student) => s.is_active);
    const inactiveStudents = filteredStudents.filter((s: Student) => !s.is_active);
    const atRisk = filteredStudents.filter((s: Student) => (s.avg_score || 100) < 60);

    const tabs = [
        { id: 'all', label: 'All Students', count: filteredStudents.length },
        { id: 'active', label: 'Active', count: activeStudents.length },
        { id: 'inactive', label: 'Inactive', count: inactiveStudents.length },
        { id: 'at-risk', label: 'At Risk', count: atRisk.length, icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
    ];

    const getFilteredByTab = () => {
        switch (activeTab) {
            case 'active': return activeStudents;
            case 'inactive': return inactiveStudents;
            case 'at-risk': return atRisk;
            default: return filteredStudents;
        }
    };

    const toggleSelectAll = () => {
        if (selectedStudents.length === filteredStudents.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(filteredStudents.map((s: Student) => s.id));
        }
    };

    const toggleSelect = (id: number) => {
        if (selectedStudents.includes(id)) {
            setSelectedStudents(selectedStudents.filter(sid => sid !== id));
        } else {
            setSelectedStudents([...selectedStudents, id]);
        }
    };

    const columns = [
        {
            key: 'select',
            header: (
                <input
                    type="checkbox"
                    checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                />
            ),
            className: 'w-10',
            cell: (student: Student) => (
                <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.id)}
                    onChange={() => toggleSelect(student.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                />
            ),
        },
        {
            key: 'student',
            header: 'Student',
            cell: (student: Student) => (
                <div className="flex items-center gap-3">
                    <Avatar alt={student.full_name} size="md" />
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{student.full_name}</p>
                            {student.is_verified && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                        </div>
                        <p className="text-sm text-gray-500">{student.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'student_id',
            header: 'Student ID',
            cell: (student: Student) => (
                <Badge variant="outline">{student.student_id || 'N/A'}</Badge>
            ),
        },
        {
            key: 'courses',
            header: 'Courses',
            cell: (student: Student) => (
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    <span>{student.enrolled_courses || 0}</span>
                </div>
            ),
        },
        {
            key: 'submissions',
            header: 'Submissions',
            cell: (student: Student) => (
                <span className="text-sm">{student.submissions || 0}</span>
            ),
        },
        {
            key: 'avg_score',
            header: 'Avg Score',
            cell: (student: Student) => {
                const score = student.avg_score || 0;
                const color = score >= 90 ? 'text-green-600' : score >= 70 ? 'text-yellow-600' : 'text-red-600';
                return (
                    <span className={`font-medium ${color}`}>{score}%</span>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            cell: (student: Student) => (
                <Badge variant={student.is_active ? 'success' : 'default'}>
                    {student.is_active ? 'Active' : 'Inactive'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (student: Student) => (
                <Dropdown
                    trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    }
                    items={[
                        { label: 'View Profile', value: 'view', icon: <GraduationCap className="w-4 h-4" /> },
                        { label: 'Edit', value: 'edit', icon: <Edit className="w-4 h-4" /> },
                        { label: 'Send Email', value: 'email', icon: <Mail className="w-4 h-4" /> },
                        { label: student.is_active ? 'Deactivate' : 'Activate', value: 'toggle', icon: <UserX className="w-4 h-4" /> },
                        { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, danger: true },
                    ]}
                    onSelect={(value) => {
                        if (value === 'delete') deleteMutation.mutate(student.id);
                        else if (value === 'edit') window.location.href = `/admin/users/${student.id}/edit`;
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
                        <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
                        <p className="text-gray-500 mt-1">Manage student accounts and enrollments</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setBulkModal(true)}>
                            <Upload className="w-4 h-4 mr-2" />
                            Import Students
                        </Button>
                        <Button asChild>
                            <Link href="/admin/users/new">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Student
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#862733]/10 flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5 text-[#862733]" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Students</p>
                                    <p className="text-xl font-bold text-gray-900">{students.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Active Students</p>
                                    <p className="text-xl font-bold text-green-600">
                                        {students.filter((s: Student) => s.is_active).length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Avg. Enrollments</p>
                                    <p className="text-xl font-bold text-blue-600">
                                        {Math.round(students.reduce((acc: number, s: Student) =>
                                            acc + (s.enrolled_courses || 0), 0) / (students.length || 1))}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">At Risk</p>
                                    <p className="text-xl font-bold text-red-600">
                                        {students.filter((s: Student) => (s.avg_score || 100) < 60).length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bulk Actions Bar */}
                {selectedStudents.length > 0 && (
                    <Card className="bg-[#862733]/5 border-[#862733]/20">
                        <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-[#862733]">
                                    {selectedStudents.length} student(s) selected
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">
                                        <Mail className="w-4 h-4 mr-1" />
                                        Email Selected
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        <Download className="w-4 h-4 mr-1" />
                                        Export
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Filters & Tabs */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <Tabs
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                className="flex-1"
                            />
                            <div className="flex gap-2">
                                <Select
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    options={[
                                        { value: '', label: 'All Courses' },
                                        ...courses.map((c: any) => ({ value: c.id.toString(), label: c.name }))
                                    ]}
                                    className="w-40"
                                />
                                <SearchInput
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder="Search students..."
                                    className="md:w-48"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Students Table */}
                <Card>
                    <DataTable
                        columns={columns}
                        data={getFilteredByTab()}
                        isLoading={isLoading}
                        emptyMessage="No students found"
                    />
                </Card>
            </div>

            {/* Bulk Import Modal */}
            <Modal
                isOpen={bulkModal}
                onClose={() => {
                    setBulkModal(false);
                    resetBulkModalState();
                }}
                title="Bulk Import Students"
                description="Import multiple students from Excel or CSV"
                size="md"
            >
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-sm text-gray-600 mb-2">
                            Upload a CSV or Excel file with student details
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            id="csv-upload"
                            onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                        />
                        <label htmlFor="csv-upload">
                            <Button variant="outline" asChild>
                                <span>Choose File</span>
                            </Button>
                        </label>
                        {bulkFile && (
                            <p className="text-xs text-gray-500 mt-3">
                                Selected: {bulkFile.name}
                            </p>
                        )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Template & Format:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Headers: full_name, email, student_id</li>
                            <li>• Email must be unique</li>
                            <li>• The student_id is required and must be unique.</li>
                            <li>• If full_name is missing, it will be generated from email</li>
                            <li>• Temporary passwords are auto-generated securely</li>
                        </ul>
                        <div className="flex items-center gap-4 mt-3">
                            <button
                                onClick={handleDownloadExcelTemplate}
                                className="text-[#862733] text-sm hover:underline"
                                type="button"
                            >
                                Download Excel Template
                            </button>
                            <a
                                href="/bulk-student-import-template.csv"
                                download="bulk-student-import-template.csv"
                                className="text-[#862733] text-sm hover:underline"
                            >
                                Download CSV Template
                            </a>
                        </div>
                    </div>

                    {bulkImportError && (
                        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                            {bulkImportError}
                        </div>
                    )}

                    {bulkImportSummary && (
                        <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800 space-y-1">
                            <p className="font-medium">Import completed</p>
                            <p>Created: {bulkImportSummary.created}</p>
                            <p>Skipped: {bulkImportSummary.skipped}</p>
                        </div>
                    )}
                </div>
                <ModalFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setBulkModal(false);
                            resetBulkModalState();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleBulkImport} disabled={bulkImportMutation.isPending || !bulkFile}>
                        Import Students
                    </Button>
                </ModalFooter>
            </Modal>
        </ProtectedRoute>
    );
}
