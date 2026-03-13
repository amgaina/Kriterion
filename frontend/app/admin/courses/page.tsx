'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/lib/use-mutation-with-invalidation';
import apiClient from '@/lib/api-client';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dropdown } from '@/components/ui/dropdown';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    Users,
    BookOpen,
    Calendar,
    Eye,
    Archive,
    UserPlus,
    UserCog,
    CheckCircle
} from 'lucide-react';

interface Course {
    id: number;
    name: string;
    code: string;
    description?: string;
    instructor_id: number;
    instructor_name?: string;
    semester?: string;
    year?: number;
    section?: string;
    is_active: boolean;
    student_count?: number;
    assignment_count?: number;
    created_at: string;
}

export default function CoursesPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [createModal, setCreateModal] = useState(false);
    const [enrollModal, setEnrollModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [enrollSearch, setEnrollSearch] = useState('');
    const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
    const [assistantModal, setAssistantModal] = useState<{ open: boolean; course?: Course }>({ open: false });
    const [assistantEmail, setAssistantEmail] = useState('');
    const [editCourseId, setEditCourseId] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState<any>(null);

    const [newCourse, setNewCourse] = useState({
        name: '',
        code: '',
        description: '',
        instructor_id: '',
        section: '',
        semester: 'Fall',
        year: new Date().getFullYear(),
        is_active: true,
    });


    const { data: courses = [], isLoading } = useQuery({
        queryKey: ['courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: faculty = [] } = useQuery({
        queryKey: ['users', 'FACULTY'],
        queryFn: () => apiClient.getUsers('FACULTY'),
    });

    const { data: students = [] } = useQuery({
        queryKey: ['users', 'STUDENT'],
        queryFn: () => apiClient.getUsers('STUDENT'),
    });

    const { data: assistants = [] } = useQuery({
        queryKey: ['users', 'ASSISTANT'],
        queryFn: () => apiClient.getUsers('ASSISTANT'),
    });

    // Transform courses data to match admin page interface
    // Map backend field names (students_count, assignments_count) to frontend interface names
    const transformedCourses = courses.map((course: any) => {
        const instructor = faculty.find((f: any) => f.id === course.instructor_id);
        return {
            ...course,
            instructor_name: instructor?.full_name || 'Unassigned',
            student_count: course.students_count || 0,
            assignment_count: course.assignments_count || 0,
        };
    });

    const createMutation = useMutationWithInvalidation({
        mutationFn: (data: any) => apiClient.createCourse(data),
        invalidateGroups: ['allCourses', 'allDashboards'],
        onSuccess: () => {
            setCreateModal(false);
            setNewCourse({
                name: '',
                code: '',
                description: '',
                instructor_id: '',
                section: '',
                semester: 'Fall',
                year: new Date().getFullYear(),
                is_active: true,
            });
        },
    });

    const updateMutation = useMutationWithInvalidation({
        mutationFn: ({ id, data }: { id: number; data: any }) => apiClient.updateCourse(id, data),
        invalidateGroups: ['allCourses', 'allDashboards'],
        onSuccess: () => {
            setEditCourseId(null);
            setEditFormData(null);
        },
    });

    const deleteMutation = useMutationWithInvalidation({
        mutationFn: (courseId: number) => apiClient.deleteCourse(courseId),
        invalidateGroups: ['allCourses', 'allDashboards'],
    });

    const archiveMutation = useMutationWithInvalidation({
        mutationFn: (courseId: number) => apiClient.updateCourse(courseId, { is_active: false }),
        invalidateGroups: ['allCourses', 'allDashboards'],
    });

    const addAssistantMutation = useMutationWithInvalidation({
        mutationFn: ({ courseId, email }: { courseId: number; email: string }) =>
            apiClient.addCourseAssistant(courseId, email),
        invalidateGroups: ['allCourses', 'allDashboards'],
        onSuccess: () => {
            setAssistantModal({ open: false });
            setAssistantEmail('');
        },
    });

    const enrollMutation = useMutationWithInvalidation({
        mutationFn: ({ courseId, studentIds }: { courseId: number; studentIds: number[] }) =>
            Promise.all(studentIds.map(id => apiClient.enrollStudent(courseId, id))),
        invalidateGroups: ['allCourses', 'allDashboards'],
        onSuccess: () => {
            setEnrollSuccess(`Successfully enrolled ${selectedStudentIds.length} student(s).`);
            setSelectedStudentIds([]);
        },
    });

    const filteredCourses = transformedCourses.filter((course: Course) =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tabs = [
        { id: 'all', label: 'All Courses', count: transformedCourses.length },
        { id: 'active', label: 'Active', count: transformedCourses.filter((c: Course) => c.is_active).length },
        { id: 'archived', label: 'Archived', count: transformedCourses.filter((c: Course) => !c.is_active).length },
    ];

    const columns = [
        {
            key: 'course',
            header: 'Course',
            cell: (course: Course) => (
                <div>
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{course.name}</p>
                        <Badge variant="outline">{course.code}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{course.description || 'No description'}</p>
                </div>
            ),
        },
        {
            key: 'instructor',
            header: 'Instructor',
            cell: (course: Course) => (
                <span className="text-sm">{course.instructor_name || 'Unassigned'}</span>
            ),
        },
        {
            key: 'semester',
            header: 'Semester',
            cell: (course: Course) => (
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{course.semester} {course.year}</span>
                </div>
            ),
        },
        {
            key: 'students',
            header: 'Students',
            cell: (course: Course) => (
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{course.student_count || 0}</span>
                </div>
            ),
        },
        {
            key: 'assignments',
            header: 'Assignments',
            cell: (course: Course) => (
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    <span>{course.assignment_count || 0}</span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (course: Course) => (
                <Badge variant={course.is_active ? 'success' : 'default'}>
                    {course.is_active ? 'Active' : 'Archived'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (course: Course) => (
                <Dropdown
                    trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    }
                    items={[
                        { label: 'View', value: 'view', icon: <Eye className="w-4 h-4" /> },
                        { label: 'Edit', value: 'edit', icon: <Edit className="w-4 h-4" /> },
                        { label: 'Enroll Students', value: 'enroll', icon: <UserPlus className="w-4 h-4" /> },
                        { label: 'Add Assistant', value: 'assistant', icon: <UserCog className="w-4 h-4" /> },
                        { label: 'Archive', value: 'archive', icon: <Archive className="w-4 h-4" /> },
                        { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, danger: true },
                    ]}
                    onSelect={(value) => {
                        if (value === 'view') router.push(`/faculty/courses/${course.id}`);
                        else if (value === 'enroll') {
                            setSelectedStudentIds([]);
                            setEnrollSearch('');
                            setEnrollSuccess(null);
                            setEnrollModal({ open: true, course });
                        }
                        else if (value === 'delete') deleteMutation.mutate(course.id);
                        else if (value === 'assistant') {
                            setAssistantEmail('');
                            setAssistantModal({ open: true, course });
                        }
                        else if (value === 'archive') archiveMutation.mutate(course.id);
                        else if (value === 'edit') {
                            setEditCourseId(course.id);
                            setEditFormData({
                                name: course.name,
                                code: course.code,
                                description: course.description || '',
                                instructor_id: course.instructor_id,
                                section: course.section || '',
                                semester: course.semester || 'Fall',
                                year: course.year || new Date().getFullYear(),
                                is_active: course.is_active,
                            });
                        }
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
                            <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
                            <p className="text-gray-500 mt-1">Manage courses, enrollments, and assignments</p>
                        </div>
                        <Button onClick={() => setCreateModal(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Course
                        </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Total Courses</p>
                                <p className="text-2xl font-bold text-gray-900">{transformedCourses.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Active Courses</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {transformedCourses.filter((c: any) => c.is_active).length}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Total Enrollments</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {transformedCourses.reduce((acc: number, c: any) => acc + (c.student_count || 0), 0)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Total Assignments</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {transformedCourses.reduce((acc: number, c: any) => acc + (c.assignment_count || 0), 0)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabs & Search */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <Tabs
                                    tabs={tabs}
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    className="flex-1"
                                />
                                <SearchInput
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder="Search courses..."
                                    className="md:w-64"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Courses Table */}
                    <Card>
                        <DataTable
                            columns={columns}
                            data={filteredCourses.filter((c: Course) =>
                                activeTab === 'all' ? true :
                                    activeTab === 'active' ? c.is_active :
                                        !c.is_active
                            )}
                            isLoading={isLoading}
                            emptyMessage="No courses found"
                        />
                    </Card>
                </div>

                {/* Create Course Modal */}
                <Modal
                    isOpen={createModal}
                    onClose={() => setCreateModal(false)}
                    title="Create New Course"
                    description="Set up a new course for the semester"
                    size="lg"
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Input
                                label="Course Name"
                                value={newCourse.name}
                                onChange={(e) => setNewCourse(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Introduction to Programming"
                            />
                            <Input
                                label="Course Code"
                                value={newCourse.code}
                                onChange={(e) => setNewCourse(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                placeholder="CS101"
                            />
                            <Input
                                label="Section"
                                value={newCourse.section}
                                onChange={(e) => setNewCourse(prev => ({ ...prev, section: e.target.value }))}
                                placeholder="e.g., A, B, 001"
                            />
                        </div>
                        <Textarea
                            label="Description"
                            value={newCourse.description}
                            onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter course description..."
                        />
                        <Select
                            label="Instructor"
                            value={newCourse.instructor_id}
                            onChange={(e) => setNewCourse(prev => ({ ...prev, instructor_id: e.target.value }))}
                            options={faculty.map((f: any) => ({ value: f.id.toString(), label: f.full_name }))}
                            placeholder="Select instructor"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Semester"
                                value={newCourse.semester}
                                onChange={(e) => setNewCourse(prev => ({ ...prev, semester: e.target.value }))}
                                options={[
                                    { value: 'Fall', label: 'Fall' },
                                    { value: 'Spring', label: 'Spring' },
                                    { value: 'Summer', label: 'Summer' },
                                ]}
                            />
                            <Input
                                label="Year"
                                type="number"
                                value={newCourse.year.toString()}
                                onChange={(e) => setNewCourse(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                            />
                        </div>
                        <Switch
                            checked={newCourse.is_active}
                            onChange={(checked) => setNewCourse(prev => ({ ...prev, is_active: checked }))}
                            label="Active Course"
                            description="Course is visible to students and faculty"
                        />
                    </div>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                const courseData = {
                                    ...newCourse,
                                    instructor_id: newCourse.instructor_id ? parseInt(newCourse.instructor_id) : null,
                                };
                                createMutation.mutate(courseData);
                            }}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Course'}
                        </Button>
                    </ModalFooter>
                </Modal>

                {/* Edit Course Modal */}
                <Modal
                    isOpen={editCourseId !== null && editFormData !== null}
                    onClose={() => {
                        setEditCourseId(null);
                        setEditFormData(null);
                    }}
                    title="Edit Course"
                    description="Update course information"
                    size="lg"
                >
                    {editFormData && (
                        <>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <Input
                                        label="Course Name"
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData((prev: Course) => ({ ...prev, name: e.target.value }))}
                                        placeholder="Introduction to Programming"
                                    />
                                    <Input
                                        label="Course Code"
                                        value={editFormData.code}
                                        onChange={(e) => setEditFormData((prev: Course) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        placeholder="CS101"
                                    />
                                    <Input
                                        label="Section"
                                        value={editFormData.section}
                                        onChange={(e) => setEditFormData((prev: Course) => ({ ...prev, section: e.target.value }))}
                                        placeholder="A"
                                    />
                                </div>
                                <Textarea
                                    label="Description"
                                    value={editFormData.description}
                                    onChange={(e) => setEditFormData((prev: Course) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Course description"
                                    rows={3}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Select
                                        label="Instructor"
                                        value={editFormData.instructor_id?.toString() || ''}
                                        onChange={(e) => setEditFormData((prev: Course) => ({ ...prev, instructor_id: parseInt(e.target.value) }))}
                                        options={faculty.map((f: any) => ({
                                            value: f.id.toString(),
                                            label: f.full_name
                                        }))}
                                    />
                                    <Select
                                        label="Semester"
                                        value={editFormData.semester}
                                        onChange={(e) => setEditFormData((prev: Course) => ({ ...prev, semester: e.target.value }))}
                                        options={[
                                            { value: 'Spring', label: 'Spring' },
                                            { value: 'Summer', label: 'Summer' },
                                            { value: 'Fall', label: 'Fall' },
                                            { value: 'Winter', label: 'Winter' },
                                        ]}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label="Year"
                                        type="number"
                                        value={editFormData.year?.toString()}
                                        onChange={(e) => setEditFormData((prev: Course) => ({ ...prev, year: parseInt(e.target.value) }))}
                                    />
                                    <Switch
                                        checked={editFormData.is_active}
                                        onChange={(checked: boolean) => setEditFormData((prev: Course) => ({ ...prev, is_active: checked }))}
                                        label="Active Course"
                                        description="Course is visible to students and faculty"
                                    />
                                </div>
                            </div>
                            <ModalFooter>
                                <Button variant="outline" onClick={() => {
                                    setEditCourseId(null);
                                    setEditFormData(null);
                                }}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (editCourseId !== null) {
                                            const courseData = {
                                                ...editFormData,
                                                instructor_id: editFormData.instructor_id ? parseInt(editFormData.instructor_id) : null,
                                            };
                                            updateMutation.mutate({ id: editCourseId, data: courseData });
                                        }
                                    }}
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? 'Updating...' : 'Update Course'}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </Modal>

                {/* Enroll Students Modal */}
                <Modal
                    isOpen={enrollModal.open}
                    onClose={() => { setEnrollModal({ open: false }); setSelectedStudentIds([]); setEnrollSearch(''); setEnrollSuccess(null); }}
                    title="Enroll Students"
                    description={`Add students to ${enrollModal.course?.name}`}
                    size="lg"
                >
                    <div className="space-y-4">
                        <SearchInput
                            value={enrollSearch}
                            onChange={setEnrollSearch}
                            placeholder="Search students..."
                        />
                        {enrollSuccess && (
                            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                {enrollSuccess}
                            </div>
                        )}
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                            {students
                                .filter((s: any) =>
                                    !enrollSearch ||
                                    s.full_name.toLowerCase().includes(enrollSearch.toLowerCase()) ||
                                    s.email.toLowerCase().includes(enrollSearch.toLowerCase())
                                )
                                .map((student: any) => (
                                <div key={student.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setSelectedStudentIds(prev =>
                                        prev.includes(student.id)
                                            ? prev.filter(id => id !== student.id)
                                            : [...prev, student.id]
                                    )}>
                                    <input
                                        type="checkbox"
                                        readOnly
                                        checked={selectedStudentIds.includes(student.id)}
                                        className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733] pointer-events-none"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{student.full_name}</p>
                                        <p className="text-xs text-gray-500">{student.email}</p>
                                    </div>
                                    <Badge variant="outline">{student.student_id || 'N/A'}</Badge>
                                </div>
                                ))}
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>{selectedStudentIds.length} student(s) selected</span>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => { setEnrollModal({ open: false }); setSelectedStudentIds([]); setEnrollSearch(''); setEnrollSuccess(null); }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (enrollModal.course && selectedStudentIds.length > 0) {
                                    enrollMutation.mutate({ courseId: enrollModal.course.id, studentIds: selectedStudentIds });
                                }
                            }}
                            disabled={selectedStudentIds.length === 0 || enrollMutation.isPending}
                        >
                            {enrollMutation.isPending ? 'Enrolling...' : `Enroll ${selectedStudentIds.length > 0 ? `(${selectedStudentIds.length})` : 'Students'}`}
                        </Button>
                    </ModalFooter>
                </Modal>

                {/* Add Assistant Modal */}
                <Modal
                    isOpen={assistantModal.open}
                    onClose={() => { setAssistantModal({ open: false }); setAssistantEmail(''); }}
                    title="Add Grading Assistant"
                    description={`Assign an assistant to ${assistantModal.course?.name}`}
                    size="md"
                >
                    <div className="space-y-4">
                        <Select
                            label="Assistant"
                            value={assistantEmail}
                            onChange={(e) => setAssistantEmail(e.target.value)}
                            options={assistants.map((assistant: any) => ({
                                value: assistant.email,
                                label: `${assistant.full_name || assistant.email} (${assistant.email})`,
                            }))}
                            placeholder="Select assistant"
                        />
                        <Input
                            label="Or enter assistant email"
                            value={assistantEmail}
                            onChange={(e) => setAssistantEmail(e.target.value)}
                            placeholder="assistant@kriterion.edu"
                        />
                    </div>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => { setAssistantModal({ open: false }); setAssistantEmail(''); }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (assistantModal.course && assistantEmail.trim()) {
                                    addAssistantMutation.mutate({
                                        courseId: assistantModal.course.id,
                                        email: assistantEmail.trim(),
                                    });
                                }
                            }}
                            disabled={!assistantEmail.trim() || addAssistantMutation.isPending}
                        >
                            {addAssistantMutation.isPending ? 'Adding...' : 'Add Assistant'}
                        </Button>
                    </ModalFooter>
                </Modal>
        </ProtectedRoute>
    );
}
