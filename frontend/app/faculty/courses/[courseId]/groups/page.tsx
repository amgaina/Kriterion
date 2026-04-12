'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { AcknowledgementPopup } from '@/components/ui/acknowledgement-popup';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { CourseLoadingPage, CourseLoadingSpinner } from '@/components/course/CourseLoading';
import {
    UsersRound,
    Plus,
    Trash2,
    UserPlus,
    UserMinus,
    ChevronDown,
    ChevronUp,
    Crown,
    Search,
    Users,
    UserCheck,
    AlertCircle,
} from 'lucide-react';

interface GroupMember {
    id: number;
    user_id: number;
    full_name: string;
    email: string;
    student_id: string | null;
    is_leader: boolean;
}

interface Group {
    id: number;
    name: string;
    max_members: number;
    created_at: string;
    members: GroupMember[];
}

interface Student {
    id: number;
    full_name: string;
    email: string;
    student_id?: string | null;
    status: string;
}

interface SystemStudent {
    id: number;
    full_name: string;
    email: string;
    student_id?: string | null;
    is_active?: boolean;
    role?: string;
}

export default function CourseGroupsPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const queryClient = useQueryClient();

    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupMaxMembers, setNewGroupMaxMembers] = useState(4);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [addMemberModal, setAddMemberModal] = useState<Group | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
    const [notification, setNotification] = useState<{
        open: boolean;
        type: 'success' | 'error';
        title: string;
        message: string;
    }>({ open: false, type: 'success', title: '', message: '' });

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ open: true, type, title: type === 'success' ? 'Success' : 'Error', message });
    };

    const { data: groups = [], isLoading: groupsLoading } = useQuery<Group[]>({
        queryKey: ['course-groups', courseId],
        queryFn: () => apiClient.getCourseGroups(courseId),
        enabled: !!courseId,
    });

    // Enrolled students in this course (for stats + unassigned callout)
    const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
        queryKey: ['course-students', courseId],
        queryFn: async () => {
            const data = await apiClient.getCourseStudents(courseId);
            return (Array.isArray(data) ? data : []) as Student[];
        },
        enabled: !!courseId,
    });

    // All active students in the system (for the "Add member" picker)
    const { data: systemStudents = [], isLoading: systemStudentsLoading } = useQuery<SystemStudent[]>({
        queryKey: ['system-students'],
        queryFn: () => apiClient.getFacultyStudents() as Promise<SystemStudent[]>,
        enabled: !!addMemberModal,
        staleTime: 60_000,
    });

    const { data: course } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId) as Promise<{ color?: string | null }>,
        enabled: !!courseId,
    });
    const accentColor = course?.color || '#862733';

    const activeStudents = useMemo(() => students.filter((s) => s.status === 'active'), [students]);

    // All user IDs already assigned to ANY group
    const assignedUserIds = useMemo(
        () => new Set(groups.flatMap((g) => g.members.map((m) => m.user_id))),
        [groups],
    );

    // Enrolled students not in any group (for the amber callout)
    const unassignedStudents = useMemo(
        () => activeStudents.filter((s) => !assignedUserIds.has(s.id)),
        [activeStudents, assignedUserIds],
    );

    // System students not yet in any group, filtered by search
    const filteredAvailableStudents = useMemo(() => {
        if (!addMemberModal) return [];
        const inGroup = new Set(addMemberModal.members.map((m) => m.user_id));
        // Exclude students already in this group or ANY other group
        const candidates = systemStudents.filter(
            (s) => (s.is_active !== false) && !assignedUserIds.has(s.id) && !inGroup.has(s.id),
        );
        const q = memberSearch.trim().toLowerCase();
        if (!q) return candidates;
        return candidates.filter(
            (s) =>
                s.full_name.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q) ||
                (s.student_id ?? '').toLowerCase().includes(q),
        );
    }, [addMemberModal, systemStudents, assignedUserIds, memberSearch]);

    // mutations
    const createGroupMutation = useMutation({
        mutationFn: () => apiClient.createCourseGroup(courseId, { name: newGroupName.trim(), max_members: newGroupMaxMembers }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-groups', courseId] });
            setNewGroupName('');
            setNewGroupMaxMembers(4);
            setCreateModalOpen(false);
            showNotification('success', 'Group created successfully.');
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create group.';
            showNotification('error', typeof msg === 'string' ? msg : 'Failed to create group.');
        },
    });

    const deleteGroupMutation = useMutation({
        mutationFn: (groupId: number) => apiClient.deleteCourseGroup(courseId, groupId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-groups', courseId] });
            setDeleteTarget(null);
            showNotification('success', 'Group deleted.');
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to delete group.';
            showNotification('error', typeof msg === 'string' ? msg : 'Failed to delete group.');
        },
    });

    const addMemberMutation = useMutation({
        mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) =>
            apiClient.addGroupMember(courseId, groupId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-groups', courseId] });
            setAddMemberModal(null);
            setMemberSearch('');
            setSelectedStudentId(null);
            showNotification('success', 'Student added to group.');
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to add student.';
            showNotification('error', typeof msg === 'string' ? msg : 'Failed to add student.');
        },
    });

    const removeMemberMutation = useMutation({
        mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) =>
            apiClient.removeGroupMember(courseId, groupId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-groups', courseId] });
            showNotification('success', 'Student removed from group.');
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to remove student.';
            showNotification('error', typeof msg === 'string' ? msg : 'Failed to remove student.');
        },
    });

    const toggleGroup = (groupId: number) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const openAddMember = (group: Group) => {
        setAddMemberModal(group);
        setMemberSearch('');
        setSelectedStudentId(null);
    };

    if (groupsLoading || studentsLoading) {
        return <CourseLoadingPage message="Loading groups..." />;
    }

    return (
        <>
            <div className="space-y-6 pb-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <UsersRound className="w-5 h-5" style={{ color: accentColor }} />
                            Student Groups
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Each student can only belong to one group.
                        </p>
                    </div>
                    <Button
                        onClick={() => setCreateModalOpen(true)}
                        className="gap-2 text-white"
                        style={{ backgroundColor: accentColor }}
                    >
                        <Plus className="w-4 h-4" /> New Group
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}18` }}>
                                    <UsersRound className="w-5 h-5" style={{ color: accentColor }} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
                                    <p className="text-xs text-gray-500">Groups</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <UserCheck className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-emerald-600">{assignedUserIds.size}</p>
                                    <p className="text-xs text-gray-500">Assigned</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md col-span-2 sm:col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-amber-600">{unassignedStudents.length}</p>
                                    <p className="text-xs text-gray-500">Unassigned</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Groups list */}
                {groups.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
                        <UsersRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="font-medium text-gray-600">No groups yet</p>
                        <p className="text-sm text-gray-400 mt-1 mb-5">Create your first group to get started.</p>
                        <Button
                            onClick={() => setCreateModalOpen(true)}
                            className="gap-2 text-white"
                            style={{ backgroundColor: accentColor }}
                        >
                            <Plus className="w-4 h-4" /> Create First Group
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {groups.map((group) => {
                            const expanded = expandedGroups.has(group.id);
                            const isFull = group.members.length >= group.max_members;
                            const fillPct = Math.round((group.members.length / group.max_members) * 100);

                            return (
                                <Card key={group.id} className="border-gray-200 shadow-sm overflow-hidden">
                                    {/* Group header row */}
                                    <div
                                        className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => toggleGroup(group.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: `${accentColor}15` }}
                                            >
                                                <UsersRound className="w-5 h-5" style={{ color: accentColor }} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{group.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${fillPct}%`,
                                                                backgroundColor: isFull ? '#16a34a' : accentColor,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {group.members.length}/{group.max_members}
                                                        {isFull && (
                                                            <span className="ml-1.5 text-emerald-600 font-medium">Full</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(group); }}
                                                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                title="Delete group"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            {expanded
                                                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                                : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </div>
                                    </div>

                                    {/* Expanded members */}
                                    {expanded && (
                                        <div className="border-t border-gray-100 bg-gray-50/50">
                                            {group.members.length === 0 ? (
                                                <div className="py-6 text-center text-sm text-gray-400">
                                                    No members yet.
                                                </div>
                                            ) : (
                                                <ul className="divide-y divide-gray-100">
                                                    {group.members.map((member) => (
                                                        <li key={member.id} className="flex items-center justify-between px-5 py-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div
                                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                                                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                                                                >
                                                                    {member.full_name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 truncate">
                                                                        {member.full_name}
                                                                        {member.is_leader && (
                                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                                                                                <Crown className="w-2.5 h-2.5" /> Leader
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeMemberMutation.mutate({ groupId: group.id, userId: member.user_id })}
                                                                disabled={removeMemberMutation.isPending}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                                                                title="Remove from group"
                                                            >
                                                                <UserMinus className="w-4 h-4" />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}

                                            {/* Add member button */}
                                            <div className="px-5 py-3 border-t border-gray-100">
                                                {isFull ? (
                                                    <p className="text-xs text-amber-600 flex items-center gap-1.5">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        Group is at maximum capacity ({group.max_members} members).
                                                    </p>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => openAddMember(group)}
                                                        className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                                                        style={{ color: accentColor }}
                                                    >
                                                        <UserPlus className="w-4 h-4" /> Add student
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Unassigned students callout */}
                {unassignedStudents.length > 0 && groups.length > 0 && (
                    <Card className="border border-amber-200 bg-amber-50/50 shadow-none">
                        <CardContent className="p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">
                                    {unassignedStudents.length} student{unassignedStudents.length !== 1 ? 's' : ''} not assigned to any group
                                </p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    {unassignedStudents.map(s => s.full_name).join(', ')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Create Group Modal */}
            <Modal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                title="Create New Group"
                size="sm"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Group Name</label>
                        <Input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="e.g., Team Alpha"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newGroupName.trim()) createGroupMutation.mutate();
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Members</label>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={newGroupMaxMembers}
                            onChange={(e) => setNewGroupMaxMembers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                            style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                        />
                    </div>
                </div>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => {
                            if (!newGroupName.trim()) {
                                showNotification('error', 'Group name is required.');
                                return;
                            }
                            createGroupMutation.mutate();
                        }}
                        disabled={createGroupMutation.isPending || !newGroupName.trim()}
                        className="text-white"
                        style={{ backgroundColor: accentColor }}
                    >
                        {createGroupMutation.isPending
                            ? <CourseLoadingSpinner size="sm" label="Creating..." />
                            : <><Plus className="w-4 h-4 mr-1.5" /> Create Group</>}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Add Member Modal */}
            <Modal
                isOpen={!!addMemberModal}
                onClose={() => { setAddMemberModal(null); setMemberSearch(''); setSelectedStudentId(null); }}
                title={`Add Student to ${addMemberModal?.name ?? ''}`}
                size="sm"
            >
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search by name, email, or ID..."
                            value={memberSearch}
                            onChange={(e) => { setMemberSearch(e.target.value); setSelectedStudentId(null); }}
                            className="pl-9"
                        />
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        {systemStudentsLoading ? (
                            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
                                <CourseLoadingSpinner size="sm" label="Loading students..." />
                            </div>
                        ) : filteredAvailableStudents.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-400">
                                {memberSearch.trim()
                                    ? 'No students match your search.'
                                    : 'All active students are already in groups.'}
                            </div>
                        ) : (
                            <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                                {filteredAvailableStudents.map((s) => {
                                    const selected = selectedStudentId === s.id;
                                    return (
                                        <li key={s.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedStudentId(selected ? null : s.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                    selected ? 'border-l-2' : 'hover:bg-gray-50'
                                                }`}
                                                style={selected ? { borderLeftColor: accentColor, backgroundColor: `${accentColor}08` } : {}}
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                                    style={selected
                                                        ? { backgroundColor: accentColor, color: 'white' }
                                                        : { backgroundColor: '#f3f4f6', color: '#4b5563' }}
                                                >
                                                    {s.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{s.full_name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{s.email}</p>
                                                </div>
                                                {s.student_id && (
                                                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{s.student_id}</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
                <ModalFooter>
                    <Button variant="outline" onClick={() => { setAddMemberModal(null); setMemberSearch(''); setSelectedStudentId(null); }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            if (!addMemberModal || !selectedStudentId) return;
                            addMemberMutation.mutate({ groupId: addMemberModal.id, userId: selectedStudentId });
                        }}
                        disabled={!selectedStudentId || addMemberMutation.isPending}
                        className="text-white"
                        style={{ backgroundColor: accentColor }}
                    >
                        {addMemberMutation.isPending
                            ? <CourseLoadingSpinner size="sm" label="Adding..." />
                            : <><UserPlus className="w-4 h-4 mr-1.5" /> Add to Group</>}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Delete Group Confirmation */}
            <ConfirmDeleteModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteGroupMutation.mutate(deleteTarget.id)}
                confirmationPhrase="Delete"
                itemName={deleteTarget?.name}
                title="Delete Group?"
                description={
                    deleteTarget
                        ? `Are you sure you want to delete "${deleteTarget.name}"? All members will be removed. Type "Delete" to confirm.`
                        : undefined
                }
                confirmLabel="Delete Group"
                confirmHint='Type "Delete" below to confirm.'
                loadingLabel="Deleting..."
                isLoading={deleteGroupMutation.isPending}
            />

            <AcknowledgementPopup
                isOpen={notification.open}
                onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
                type={notification.type}
                title={notification.title}
                message={notification.message}
            />
        </>
    );
}
