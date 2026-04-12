'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { AcknowledgementPopup } from '@/components/ui/acknowledgement-popup';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { CourseLoadingSpinner } from '@/components/course/CourseLoading';
import {
    Plus,
    Edit,
    Trash2,
    Code,
    CheckCircle,
    XCircle,
    Terminal,
    FileCode,
    Cpu,
    Clock,
    Search,
    ToggleLeft,
    ToggleRight,
    AlertCircle,
} from 'lucide-react';

interface Language {
    id: number;
    name: string;
    display_name: string;
    file_extension: string;
    is_active: boolean;
    compile_command?: string | null;
    run_command: string;
    docker_image?: string | null;
    default_timeout_seconds: number;
    default_memory_mb: number;
    created_at: string;
}

interface FormData {
    name: string;
    display_name: string;
    file_extension: string;
    run_command: string;
    compile_command: string;
    docker_image: string;
    default_timeout_seconds: number;
    default_memory_mb: number;
    is_active: boolean;
}

const BLANK_FORM: FormData = {
    name: '',
    display_name: '',
    file_extension: '',
    run_command: '',
    compile_command: '',
    docker_image: '',
    default_timeout_seconds: 30,
    default_memory_mb: 256,
    is_active: true,
};

const TEMPLATES = [
    {
        name: 'python', display_name: 'Python', file_extension: '.py',
        run_command: 'python3 {file}', compile_command: '',
        docker_image: 'python:3.11-slim',
        default_timeout_seconds: 10, default_memory_mb: 256, is_active: true,
    },
    {
        name: 'java', display_name: 'Java', file_extension: '.java',
        run_command: 'java {class}', compile_command: 'javac {file}',
        docker_image: 'openjdk:17-slim',
        default_timeout_seconds: 15, default_memory_mb: 512, is_active: true,
    }
];

function validate(form: FormData): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.display_name.trim()) e.display_name = 'Required';
    if (!form.file_extension.trim()) e.file_extension = 'Required';
    if (!form.run_command.trim()) e.run_command = 'Required';
    if (form.default_timeout_seconds < 1 || form.default_timeout_seconds > 300)
        e.default_timeout_seconds = '1–300 seconds';
    if (form.default_memory_mb < 32 || form.default_memory_mb > 4096)
        e.default_memory_mb = '32–4096 MB';
    return e;
}

export default function LanguagesPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [createModal, setCreateModal] = useState(false);
    const [editTarget, setEditTarget] = useState<Language | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Language | null>(null);
    const [form, setForm] = useState<FormData>(BLANK_FORM);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [notification, setNotification] = useState<{
        open: boolean; type: 'success' | 'error'; title: string; message: string;
    }>({ open: false, type: 'success', title: '', message: '' });

    const showNotif = (type: 'success' | 'error', message: string) =>
        setNotification({ open: true, type, title: type === 'success' ? 'Success' : 'Error', message });

    const { data: languages = [], isLoading } = useQuery<Language[]>({
        queryKey: ['admin-languages'],
        queryFn: () => apiClient.getLanguages(false) as Promise<Language[]>,
    });

    const createMutation = useMutation({
        mutationFn: (data: FormData) => apiClient.createLanguage({
            ...data,
            compile_command: data.compile_command.trim() || null,
            docker_image: data.docker_image.trim() || null,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-languages'] });
            setCreateModal(false);
            setForm(BLANK_FORM);
            setFormErrors({});
            showNotif('success', `Language "${form.display_name}" added successfully.`);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.detail ?? 'Failed to create language.';
            showNotif('error', typeof msg === 'string' ? msg : 'Failed to create language.');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: FormData }) =>
            apiClient.updateLanguage(id, {
                ...data,
                compile_command: data.compile_command.trim() || null,
                docker_image: data.docker_image.trim() || null,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-languages'] });
            setEditTarget(null);
            setForm(BLANK_FORM);
            setFormErrors({});
            showNotif('success', 'Language updated.');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.detail ?? 'Failed to update language.';
            showNotif('error', typeof msg === 'string' ? msg : 'Failed to update language.');
        },
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
            apiClient.updateLanguage(id, { is_active }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-languages'] }),
        onError: (err: any) => showNotif('error', err?.response?.data?.detail ?? 'Failed to toggle.'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => apiClient.deleteLanguage(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-languages'] });
            setDeleteTarget(null);
            showNotif('success', 'Language deleted.');
        },
        onError: (err: any) => showNotif('error', err?.response?.data?.detail ?? 'Failed to delete.'),
    });

    const openCreate = () => { setForm(BLANK_FORM); setFormErrors({}); setCreateModal(true); };
    const openEdit = (lang: Language) => {
        setForm({
            name: lang.name,
            display_name: lang.display_name,
            file_extension: lang.file_extension,
            run_command: lang.run_command,
            compile_command: lang.compile_command ?? '',
            docker_image: lang.docker_image ?? '',
            default_timeout_seconds: lang.default_timeout_seconds,
            default_memory_mb: lang.default_memory_mb,
            is_active: lang.is_active,
        });
        setFormErrors({});
        setEditTarget(lang);
    };

    const handleCreate = () => {
        const errs = validate(form);
        if (Object.keys(errs).length) { setFormErrors(errs); return; }
        createMutation.mutate(form);
    };

    const handleUpdate = () => {
        const errs = validate(form);
        if (Object.keys(errs).length) { setFormErrors(errs); return; }
        updateMutation.mutate({ id: editTarget!.id, data: form });
    };

    const set = (key: keyof FormData, value: string | number | boolean) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: '' }));
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return languages;
        return languages.filter(l =>
            l.name.toLowerCase().includes(q) || l.display_name.toLowerCase().includes(q)
        );
    }, [languages, search]);

    const stats = useMemo(() => ({
        total: languages.length,
        active: languages.filter(l => l.is_active).length,
        disabled: languages.filter(l => !l.is_active).length,
        compiled: languages.filter(l => !!l.compile_command).length,
    }), [languages]);

    const LanguageForm = (_: { isPending: boolean }) => (
        <div className="space-y-4">
            {/* Templates */}
            <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Quick templates</p>
                <div className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map(t => (
                        <button
                            key={t.name}
                            type="button"
                            onClick={() => { setForm({ ...t }); setFormErrors({}); }}
                            className="px-3 py-1 text-xs border border-gray-200 rounded-full hover:border-[#862733] hover:text-[#862733] hover:bg-[#862733]/5 transition-colors"
                        >
                            {t.display_name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Input
                        label="Language ID"
                        value={form.name}
                        onChange={e => set('name', e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="python"
                        error={formErrors.name}
                    />
                    <p className="text-xs text-gray-400 mt-1">Lowercase, no spaces (e.g. python, cpp)</p>
                </div>
                <Input
                    label="Display Name"
                    value={form.display_name}
                    onChange={e => set('display_name', e.target.value)}
                    placeholder="Python"
                    error={formErrors.display_name}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Input
                        label="File Extension"
                        value={form.file_extension}
                        onChange={e => set('file_extension', e.target.value)}
                        placeholder=".py"
                        error={formErrors.file_extension}
                    />
                </div>
                <Input
                    label="Docker Image"
                    value={form.docker_image}
                    onChange={e => set('docker_image', e.target.value)}
                    placeholder="python:3.11-slim"
                />
            </div>

            <Input
                label="Run Command"
                value={form.run_command}
                onChange={e => set('run_command', e.target.value)}
                placeholder="python3 {file}"
                error={formErrors.run_command}
            />
            <div>
                <Input
                    label="Compile Command"
                    value={form.compile_command}
                    onChange={e => set('compile_command', e.target.value)}
                    placeholder="javac {file}  (leave blank for interpreted languages)"
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty for interpreted languages like Python.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Input
                        label="Timeout (seconds)"
                        type="number"
                        value={String(form.default_timeout_seconds)}
                        onChange={e => set('default_timeout_seconds', parseInt(e.target.value) || 30)}
                        error={formErrors.default_timeout_seconds}
                    />
                </div>
                <div>
                    <Input
                        label="Memory Limit (MB)"
                        type="number"
                        value={String(form.default_memory_mb)}
                        onChange={e => set('default_memory_mb', parseInt(e.target.value) || 256)}
                        error={formErrors.default_memory_mb}
                    />
                </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                    onClick={() => set('is_active', !form.is_active)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-[#862733]' : 'bg-gray-300'}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-700">Active</p>
                    <p className="text-xs text-gray-500">Available for use in assignments</p>
                </div>
            </label>
        </div>
    );

    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
            <div className="space-y-6 pb-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Programming Languages</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure supported languages for code execution</p>
                    </div>
                    <Button onClick={openCreate} className="gap-2 bg-[#862733] hover:bg-[#a03040] text-white self-start sm:self-auto">
                        <Plus className="w-4 h-4" /> Add Language
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total', value: stats.total, icon: <Code className="w-5 h-5 text-[#862733]" />, bg: 'bg-[#862733]/10' },
                        { label: 'Active', value: stats.active, icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-100' },
                        { label: 'Disabled', value: stats.disabled, icon: <XCircle className="w-5 h-5 text-gray-500" />, bg: 'bg-gray-100' },
                        { label: 'Compiled', value: stats.compiled, icon: <Terminal className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-100' },
                    ].map(s => (
                        <Card key={s.label} className="border-0 shadow-md">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                                    {s.icon}
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                                    <p className="text-xs text-gray-500">{s.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Search */}
                <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search languages..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Language cards */}
                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <CourseLoadingSpinner size="md" label="Loading languages..." />
                    </div>
                ) : filtered.length === 0 ? (
                    <Card className="border-0 shadow-md">
                        <CardContent className="py-20 text-center">
                            <Code className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="font-medium text-gray-600">
                                {languages.length === 0 ? 'No languages configured' : 'No languages match your search'}
                            </p>
                            {languages.length === 0 && (
                                <Button onClick={openCreate} className="mt-4 bg-[#862733] hover:bg-[#a03040] text-white gap-2">
                                    <Plus className="w-4 h-4" /> Add First Language
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map(lang => (
                            <Card key={lang.id} className={`border-0 shadow-md overflow-hidden transition-shadow hover:shadow-lg ${!lang.is_active ? 'opacity-60' : ''}`}>
                                <div className="h-1.5" style={{ backgroundColor: lang.is_active ? '#862733' : '#d1d5db' }} />
                                <CardContent className="p-4 space-y-3">
                                    {/* Top row */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-[#862733]/10 flex items-center justify-center flex-shrink-0">
                                                <Code className="w-5 h-5 text-[#862733]" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{lang.display_name}</p>
                                                <p className="text-xs text-gray-500 font-mono">{lang.name}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${lang.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {lang.is_active ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-1.5 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <FileCode className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{lang.file_extension}</code>
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Terminal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            <span className="font-mono text-xs truncate">{lang.run_command}</span>
                                        </div>
                                        {lang.compile_command && (
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Code className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                                <span className="font-mono text-xs truncate text-blue-600">{lang.compile_command}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Limits */}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-gray-100">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {lang.default_timeout_seconds}s
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Cpu className="w-3 h-3" /> {lang.default_memory_mb}MB
                                        </span>
                                        {lang.docker_image && (
                                            <span className="flex items-center gap-1 truncate">
                                                <Terminal className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate font-mono">{lang.docker_image}</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            onClick={() => toggleMutation.mutate({ id: lang.id, is_active: !lang.is_active })}
                                            disabled={toggleMutation.isPending}
                                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${lang.is_active
                                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                                            title={lang.is_active ? 'Disable' : 'Enable'}
                                        >
                                            {lang.is_active
                                                ? <><ToggleRight className="w-3.5 h-3.5" /> Disable</>
                                                : <><ToggleLeft className="w-3.5 h-3.5" /> Enable</>}
                                        </button>
                                        <button
                                            onClick={() => openEdit(lang)}
                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                        >
                                            <Edit className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(lang)}
                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors ml-auto"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={createModal}
                onClose={() => { setCreateModal(false); setForm(BLANK_FORM); setFormErrors({}); }}
                title="Add Programming Language"
                description="Configure a new language for code execution"
                size="lg"
            >
                <LanguageForm isPending={createMutation.isPending} />
                {createMutation.isError && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {(createMutation.error as any)?.response?.data?.detail ?? 'Failed to create language.'}
                    </div>
                )}
                <ModalFooter>
                    <Button variant="outline" onClick={() => { setCreateModal(false); setForm(BLANK_FORM); setFormErrors({}); }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={createMutation.isPending}
                        className="bg-[#862733] hover:bg-[#a03040] text-white gap-2"
                    >
                        {createMutation.isPending
                            ? <CourseLoadingSpinner size="sm" label="Adding..." />
                            : <><Plus className="w-4 h-4" /> Add Language</>}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editTarget}
                onClose={() => { setEditTarget(null); setForm(BLANK_FORM); setFormErrors({}); }}
                title={`Edit ${editTarget?.display_name ?? 'Language'}`}
                description="Update execution configuration"
                size="lg"
            >
                <LanguageForm isPending={updateMutation.isPending} />
                {updateMutation.isError && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {(updateMutation.error as any)?.response?.data?.detail ?? 'Failed to update language.'}
                    </div>
                )}
                <ModalFooter>
                    <Button variant="outline" onClick={() => { setEditTarget(null); setForm(BLANK_FORM); setFormErrors({}); }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdate}
                        disabled={updateMutation.isPending}
                        className="bg-[#862733] hover:bg-[#a03040] text-white gap-2"
                    >
                        {updateMutation.isPending
                            ? <CourseLoadingSpinner size="sm" label="Saving..." />
                            : <><Edit className="w-4 h-4" /> Save Changes</>}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Delete Modal */}
            <ConfirmDeleteModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                confirmationPhrase="Delete"
                itemName={deleteTarget?.display_name}
                title="Delete Language?"
                description={
                    deleteTarget
                        ? `Are you sure you want to delete "${deleteTarget.display_name}"? Any assignments using this language may be affected. Type "Delete" to confirm.`
                        : undefined
                }
                confirmLabel="Delete Language"
                confirmHint='Type "Delete" below to confirm.'
                loadingLabel="Deleting..."
                isLoading={deleteMutation.isPending}
            />

            <AcknowledgementPopup
                isOpen={notification.open}
                onClose={() => setNotification(prev => ({ ...prev, open: false }))}
                type={notification.type}
                title={notification.title}
                message={notification.message}
            />
        </ProtectedRoute>
    );
}
