'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dropdown } from '@/components/ui/dropdown';
import { Tabs } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    FileCode,
    Calendar,
    Eye,
    Copy,
    Clock,
    CheckCircle,
    AlertTriangle,
    Code
} from 'lucide-react';

interface Assignment {
    id: number;
    title: string;
    description?: string;
    course_id: number;
    course_name?: string;
    due_date: string;
    language: string;
    max_score: number;
    is_published: boolean;
    allow_late: boolean;
    late_penalty?: number;
    submission_count?: number;
    graded_count?: number;
    created_at: string;
}

export default function AssignmentsPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [createModal, setCreateModal] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState('');

    const [newAssignment, setNewAssignment] = useState({
        title: '',
        description: '',
        course_id: '',
        due_date: '',
        language: 'python',
        max_score: 100,
        is_published: false,
        allow_late: true,
        late_penalty: 10,
    });

    const { data: assignments = [], isLoading } = useQuery({
        queryKey: ['assignments'],
        queryFn: () => apiClient.getAssignments(),
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: languages = [] } = useQuery({
        queryKey: ['languages'],
        queryFn: () => apiClient.getLanguages(),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiClient.createAssignment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            setCreateModal(false);
            setNewAssignment({
                title: '',
                description: '',
                course_id: '',
                due_date: '',
                language: 'python',
                max_score: 100,
                is_published: false,
                allow_late: true,
                late_penalty: 10,
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (assignmentId: number) => apiClient.deleteAssignment(assignmentId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }),
    });

    const filteredAssignments = assignments.filter((assignment: Assignment) =>
        assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (assignment.course_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    ).filter((assignment: Assignment) =>
        selectedCourse ? assignment.course_id.toString() === selectedCourse : true
    );

    const now = new Date();
    const upcoming = filteredAssignments.filter((a: Assignment) =>
        new Date(a.due_date) > now && a.is_published
    );
    const past = filteredAssignments.filter((a: Assignment) =>
        new Date(a.due_date) <= now
    );
    const drafts = filteredAssignments.filter((a: Assignment) => !a.is_published);

    const tabs = [
        { id: 'all', label: 'All', count: filteredAssignments.length },
        { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
        { id: 'past', label: 'Past', count: past.length },
        { id: 'drafts', label: 'Drafts', count: drafts.length },
    ];

    const getFilteredByTab = () => {
        switch (activeTab) {
            case 'upcoming': return upcoming;
            case 'past': return past;
            case 'drafts': return drafts;
            default: return filteredAssignments;
        }
    };

    const getDueStatus = (dueDate: string) => {
        const due = new Date(dueDate);
        const diff = due.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (days < 0) return { label: 'Past Due', variant: 'danger' as const };
        if (days === 0) return { label: 'Due Today', variant: 'warning' as const };
        if (days <= 3) return { label: `${days} days left`, variant: 'warning' as const };
        return { label: `${days} days left`, variant: 'default' as const };
    };

    const columns = [
        {
            key: 'assignment',
            header: 'Assignment',
            cell: (assignment: Assignment) => (
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-[#862733]/10 flex items-center justify-center">
                            <Code className="w-4 h-4 text-[#862733]" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">{assignment.title}</p>
                            <p className="text-sm text-gray-500">{assignment.course_name}</p>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'language',
            header: 'Language',
            cell: (assignment: Assignment) => (
                <Badge variant="outline">{assignment.language}</Badge>
            ),
        },
        {
            key: 'due_date',
            header: 'Due Date',
            cell: (assignment: Assignment) => {
                const status = getDueStatus(assignment.due_date);
                return (
                    <div>
                        <p className="text-sm text-gray-900">
                            {new Date(assignment.due_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </p>
                        <Badge variant={status.variant} className="mt-1">{status.label}</Badge>
                    </div>
                );
            },
        },
        {
            key: 'submissions',
            header: 'Submissions',
            cell: (assignment: Assignment) => {
                const submitted = assignment.submission_count || 0;
                const graded = assignment.graded_count || 0;
                const total = 50; // Example total students
                const progress = (submitted / total) * 100;

                return (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">{submitted}/{total}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-green-600">{graded} graded</span>
                        </div>
                        <Progress value={progress} size="sm" />
                    </div>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            cell: (assignment: Assignment) => (
                <Badge variant={assignment.is_published ? 'success' : 'default'}>
                    {assignment.is_published ? 'Published' : 'Draft'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (assignment: Assignment) => (
                <Dropdown
                    trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    }
                    items={[
                        { label: 'View Submissions', value: 'submissions', icon: <Eye className="w-4 h-4" /> },
                        { label: 'Edit', value: 'edit', icon: <Edit className="w-4 h-4" /> },
                        { label: 'Duplicate', value: 'duplicate', icon: <Copy className="w-4 h-4" /> },
                        {
                            label: assignment.is_published ? 'Unpublish' : 'Publish',
                            value: 'toggle',
                            icon: assignment.is_published ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />
                        },
                        { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, danger: true },
                    ]}
                    onSelect={(value) => {
                        if (value === 'delete') deleteMutation.mutate(assignment.id);
                        else if (value === 'edit') window.location.href = `/admin/assignments/${assignment.id}/edit`;
                        else if (value === 'submissions') window.location.href = `/admin/assignments/${assignment.id}/submissions`;
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
                            <h1 className="text-2xl font-bold text-gray-900">Assignment Management</h1>
                            <p className="text-gray-500 mt-1">Create and manage programming assignments</p>
                        </div>
                        <Button onClick={() => setCreateModal(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Assignment
                        </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#862733]/10 flex items-center justify-center">
                                        <FileCode className="w-5 h-5 text-[#862733]" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Total Assignments</p>
                                        <p className="text-xl font-bold text-gray-900">{assignments.length}</p>
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
                                        <p className="text-sm text-gray-500">Published</p>
                                        <p className="text-xl font-bold text-green-600">
                                            {assignments.filter((a: Assignment) => a.is_published).length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Due This Week</p>
                                        <p className="text-xl font-bold text-yellow-600">
                                            {assignments.filter((a: Assignment) => {
                                                const due = new Date(a.due_date);
                                                const diff = due.getTime() - now.getTime();
                                                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                                return days >= 0 && days <= 7;
                                            }).length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Avg. Submissions</p>
                                        <p className="text-xl font-bold text-blue-600">
                                            {Math.round(assignments.reduce((acc: number, a: Assignment) =>
                                                acc + (a.submission_count || 0), 0) / (assignments.length || 1))}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

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
                                        placeholder="Search assignments..."
                                        className="md:w-48"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Assignments Table */}
                    <Card>
                        <DataTable
                            columns={columns}
                            data={getFilteredByTab()}
                            isLoading={isLoading}
                            emptyMessage="No assignments found"
                        />
                    </Card>
                </div>

                {/* Create Assignment Modal */}
                <Modal
                    isOpen={createModal}
                    onClose={() => setCreateModal(false)}
                    title="Create New Assignment"
                    description="Set up a programming assignment for students"
                    size="lg"
                >
                    <div className="space-y-4">
                        <Input
                            label="Assignment Title"
                            value={newAssignment.title}
                            onChange={(e) => setNewAssignment(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Binary Search Implementation"
                        />
                        <Textarea
                            label="Description"
                            value={newAssignment.description}
                            onChange={(e) => setNewAssignment(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Write a detailed description of the assignment..."
                            rows={4}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Course"
                                value={newAssignment.course_id}
                                onChange={(e) => setNewAssignment(prev => ({ ...prev, course_id: e.target.value }))}
                                options={courses.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
                                placeholder="Select course"
                            />
                            <Select
                                label="Programming Language"
                                value={newAssignment.language}
                                onChange={(e) => setNewAssignment(prev => ({ ...prev, language: e.target.value }))}
                                options={languages.map((l: any) => ({ value: l.name, label: l.display_name || l.name }))}
                                placeholder="Select language"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Due Date"
                                type="datetime-local"
                                value={newAssignment.due_date}
                                onChange={(e) => setNewAssignment(prev => ({ ...prev, due_date: e.target.value }))}
                            />
                            <Input
                                label="Max Score"
                                type="number"
                                value={newAssignment.max_score.toString()}
                                onChange={(e) => setNewAssignment(prev => ({ ...prev, max_score: parseInt(e.target.value) }))}
                            />
                        </div>
                        <div className="border-t pt-4 space-y-4">
                            <Switch
                                checked={newAssignment.allow_late}
                                onChange={(checked) => setNewAssignment(prev => ({ ...prev, allow_late: checked }))}
                                label="Allow Late Submissions"
                                description="Students can submit after the due date with a penalty"
                            />
                            {newAssignment.allow_late && (
                                <Input
                                    label="Late Penalty (%)"
                                    type="number"
                                    value={newAssignment.late_penalty?.toString() || '10'}
                                    onChange={(e) => setNewAssignment(prev => ({ ...prev, late_penalty: parseInt(e.target.value) }))}
                                />
                            )}
                            <Switch
                                checked={newAssignment.is_published}
                                onChange={(checked) => setNewAssignment(prev => ({ ...prev, is_published: checked }))}
                                label="Publish Immediately"
                                description="Make the assignment visible to students right away"
                            />
                        </div>
                    </div>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate(newAssignment)}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
                        </Button>
                    </ModalFooter>
                </Modal>
        </ProtectedRoute>
    );
}
