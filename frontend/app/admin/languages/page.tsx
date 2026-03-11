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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dropdown } from '@/components/ui/dropdown';
import { Alert } from '@/components/ui/alert';
import {
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    Code,
    Settings,
    Play,
    Pause,
    CheckCircle,
    XCircle,
    Terminal,
    FileCode,
    Cpu,
    Clock
} from 'lucide-react';

interface Language {
    id: number;
    name: string;
    display_name: string;
    version: string;
    file_extension: string;
    is_active: boolean;
    compile_command?: string;
    run_command: string;
    timeout_seconds: number;
    memory_limit_mb: number;
    created_at: string;
}

const DEFAULT_LANGUAGES = [
    { name: 'python', display_name: 'Python', version: '3.11', extension: '.py', run: 'python3 {file}', compile: null, timeout: 10, memory: 256 },
    { name: 'java', display_name: 'Java', version: '17', extension: '.java', run: 'java {class}', compile: 'javac {file}', timeout: 15, memory: 512 },
    { name: 'cpp', display_name: 'C++', version: '17', extension: '.cpp', run: './{executable}', compile: 'g++ -std=c++17 -o {executable} {file}', timeout: 10, memory: 256 },
    { name: 'c', display_name: 'C', version: '11', extension: '.c', run: './{executable}', compile: 'gcc -std=c11 -o {executable} {file}', timeout: 10, memory: 256 },
    { name: 'javascript', display_name: 'JavaScript', version: 'Node 18', extension: '.js', run: 'node {file}', compile: null, timeout: 10, memory: 256 },
    { name: 'typescript', display_name: 'TypeScript', version: '5.0', extension: '.ts', run: 'ts-node {file}', compile: null, timeout: 10, memory: 256 },
    { name: 'rust', display_name: 'Rust', version: '1.70', extension: '.rs', run: './{executable}', compile: 'rustc -o {executable} {file}', timeout: 15, memory: 256 },
    { name: 'go', display_name: 'Go', version: '1.21', extension: '.go', run: 'go run {file}', compile: null, timeout: 10, memory: 256 },
];

export default function LanguagesPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [createModal, setCreateModal] = useState(false);
    const [editModal, setEditModal] = useState<{ open: boolean; language?: Language }>({ open: false });
    const [testModal, setTestModal] = useState<{ open: boolean; language?: Language }>({ open: false });

    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        version: '',
        file_extension: '',
        is_active: true,
        compile_command: '',
        run_command: '',
        timeout_seconds: 10,
        memory_limit_mb: 256,
    });

    const { data: languages = [], isLoading } = useQuery({
        queryKey: ['languages'],
        queryFn: () => apiClient.getLanguages(),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiClient.createLanguage(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['languages'] });
            setCreateModal(false);
            resetForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => apiClient.updateLanguage(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['languages'] });
            setEditModal({ open: false });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => apiClient.deleteLanguage(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['languages'] }),
    });

    const resetForm = () => {
        setFormData({
            name: '',
            display_name: '',
            version: '',
            file_extension: '',
            is_active: true,
            compile_command: '',
            run_command: '',
            timeout_seconds: 10,
            memory_limit_mb: 256,
        });
    };

    const openEditModal = (language: Language) => {
        setFormData({
            name: language.name,
            display_name: language.display_name,
            version: language.version,
            file_extension: language.file_extension,
            is_active: language.is_active,
            compile_command: language.compile_command || '',
            run_command: language.run_command,
            timeout_seconds: language.timeout_seconds,
            memory_limit_mb: language.memory_limit_mb,
        });
        setEditModal({ open: true, language });
    };

    const loadTemplate = (template: typeof DEFAULT_LANGUAGES[0]) => {
        setFormData({
            name: template.name,
            display_name: template.display_name,
            version: template.version,
            file_extension: template.extension,
            is_active: true,
            compile_command: template.compile || '',
            run_command: template.run,
            timeout_seconds: template.timeout,
            memory_limit_mb: template.memory,
        });
    };

    const filteredLanguages = languages.filter((lang: Language) =>
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const columns = [
        {
            key: 'language',
            header: 'Language',
            cell: (lang: Language) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#862733] to-[#862733]/70 flex items-center justify-center">
                        <Code className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{lang.display_name}</p>
                        <p className="text-sm text-gray-500">{lang.name}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'version',
            header: 'Version',
            cell: (lang: Language) => (
                <Badge variant="outline">{lang.version}</Badge>
            ),
        },
        {
            key: 'extension',
            header: 'Extension',
            cell: (lang: Language) => (
                <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-gray-400" />
                    <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{lang.file_extension}</code>
                </div>
            ),
        },
        {
            key: 'limits',
            header: 'Limits',
            cell: (lang: Language) => (
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span>{lang.timeout_seconds}s timeout</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Cpu className="w-3 h-3 text-gray-400" />
                        <span>{lang.memory_limit_mb}MB memory</span>
                    </div>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (lang: Language) => (
                <Badge variant={lang.is_active ? 'success' : 'default'}>
                    {lang.is_active ? 'Active' : 'Disabled'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (lang: Language) => (
                <Dropdown
                    trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    }
                    items={[
                        { label: 'Test Execution', value: 'test', icon: <Play className="w-4 h-4" /> },
                        { label: 'Edit', value: 'edit', icon: <Edit className="w-4 h-4" /> },
                        { label: 'Configure', value: 'configure', icon: <Settings className="w-4 h-4" /> },
                        {
                            label: lang.is_active ? 'Disable' : 'Enable',
                            value: 'toggle',
                            icon: lang.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />
                        },
                        { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, danger: true },
                    ]}
                    onSelect={(value) => {
                        if (value === 'delete') deleteMutation.mutate(lang.id);
                        else if (value === 'edit') openEditModal(lang);
                        else if (value === 'test') setTestModal({ open: true, language: lang });
                        else if (value === 'toggle') {
                            updateMutation.mutate({ id: lang.id, data: { is_active: !lang.is_active } });
                        }
                    }}
                    align="right"
                />
            ),
        },
    ];

    const LanguageForm = ({ onSubmit, submitText }: { onSubmit: () => void; submitText: string }) => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="Language Name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="python"
                />
                <Input
                    label="Display Name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Python"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="Version"
                    value={formData.version}
                    onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="3.11"
                />
                <Input
                    label="File Extension"
                    value={formData.file_extension}
                    onChange={(e) => setFormData(prev => ({ ...prev, file_extension: e.target.value }))}
                    placeholder=".py"
                />
            </div>
            <Input
                label="Compile Command (Optional)"
                value={formData.compile_command}
                onChange={(e) => setFormData(prev => ({ ...prev, compile_command: e.target.value }))}
                placeholder="javac {file}"
            />
            <Input
                label="Run Command"
                value={formData.run_command}
                onChange={(e) => setFormData(prev => ({ ...prev, run_command: e.target.value }))}
                placeholder="python3 {file}"
            />
            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="Timeout (seconds)"
                    type="number"
                    value={formData.timeout_seconds.toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) }))}
                />
                <Input
                    label="Memory Limit (MB)"
                    type="number"
                    value={formData.memory_limit_mb.toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, memory_limit_mb: parseInt(e.target.value) }))}
                />
            </div>
            <Switch
                checked={formData.is_active}
                onChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                label="Active"
                description="Language is available for assignments"
            />
        </div>
    );

    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Programming Languages</h1>
                        <p className="text-gray-500 mt-1">Configure supported programming languages for code execution</p>
                    </div>
                    <Button onClick={() => setCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Language
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#862733]/10 flex items-center justify-center">
                                    <Code className="w-5 h-5 text-[#862733]" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Languages</p>
                                    <p className="text-xl font-bold text-gray-900">{languages.length}</p>
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
                                    <p className="text-sm text-gray-500">Active</p>
                                    <p className="text-xl font-bold text-green-600">
                                        {languages.filter((l: Language) => l.is_active).length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <XCircle className="w-5 h-5 text-gray-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Disabled</p>
                                    <p className="text-xl font-bold text-gray-600">
                                        {languages.filter((l: Language) => !l.is_active).length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Terminal className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Compiled</p>
                                    <p className="text-xl font-bold text-blue-600">
                                        {languages.filter((l: Language) => l.compile_command).length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <Card>
                    <CardContent className="p-4">
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search languages..."
                            className="max-w-md"
                        />
                    </CardContent>
                </Card>

                {/* Languages Table */}
                <Card>
                    <DataTable
                        columns={columns}
                        data={filteredLanguages}
                        isLoading={isLoading}
                        emptyMessage="No languages configured"
                    />
                </Card>
            </div>

            {/* Create Language Modal */}
            <Modal
                isOpen={createModal}
                onClose={() => { setCreateModal(false); resetForm(); }}
                title="Add Programming Language"
                description="Configure a new programming language for code execution"
                size="lg"
            >
                <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">Quick Templates:</p>
                    <div className="flex flex-wrap gap-2">
                        {DEFAULT_LANGUAGES.map(template => (
                            <button
                                key={template.name}
                                onClick={() => loadTemplate(template)}
                                className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 hover:border-[#862733] hover:text-[#862733] transition-colors"
                            >
                                {template.display_name}
                            </button>
                        ))}
                    </div>
                </div>
                <LanguageForm onSubmit={() => createMutation.mutate(formData)} submitText="Add Language" />
                <ModalFooter>
                    <Button variant="outline" onClick={() => { setCreateModal(false); resetForm(); }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => createMutation.mutate(formData)}
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? 'Adding...' : 'Add Language'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Edit Language Modal */}
            <Modal
                isOpen={editModal.open}
                onClose={() => { setEditModal({ open: false }); resetForm(); }}
                title="Edit Programming Language"
                description={`Update configuration for ${editModal.language?.display_name}`}
                size="lg"
            >
                <LanguageForm
                    onSubmit={() => updateMutation.mutate({ id: editModal.language!.id, data: formData })}
                    submitText="Save Changes"
                />
                <ModalFooter>
                    <Button variant="outline" onClick={() => { setEditModal({ open: false }); resetForm(); }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => updateMutation.mutate({ id: editModal.language!.id, data: formData })}
                        disabled={updateMutation.isPending}
                    >
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Test Execution Modal */}
            <Modal
                isOpen={testModal.open}
                onClose={() => setTestModal({ open: false })}
                title="Test Language Execution"
                description={`Test ${testModal.language?.display_name} execution environment`}
                size="lg"
            >
                <div className="space-y-4">
                    <Alert type="info" title="Test Environment">
                        This will test the code execution environment for {testModal.language?.display_name}.
                    </Alert>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Test Code</label>
                        <Textarea
                            value={testModal.language?.name === 'python'
                                ? 'print("Hello, Kriterion!")'
                                : testModal.language?.name === 'java'
                                    ? 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, Kriterion!");\n  }\n}'
                                    : 'console.log("Hello, Kriterion!");'}
                            onChange={() => { }}
                            rows={8}
                            className="font-mono text-sm"
                        />
                    </div>
                    <div className="bg-gray-900 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Output</span>
                            <Badge variant="success">Passed</Badge>
                        </div>
                        <pre className="text-green-400 font-mono text-sm">Hello, Kriterion!</pre>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-gray-50 rounded p-3">
                            <p className="text-gray-500">Execution Time</p>
                            <p className="font-medium">0.023s</p>
                        </div>
                        <div className="bg-gray-50 rounded p-3">
                            <p className="text-gray-500">Memory Used</p>
                            <p className="font-medium">12.4 MB</p>
                        </div>
                        <div className="bg-gray-50 rounded p-3">
                            <p className="text-gray-500">Exit Code</p>
                            <p className="font-medium text-green-600">0</p>
                        </div>
                    </div>
                </div>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setTestModal({ open: false })}>
                        Close
                    </Button>
                    <Button>
                        <Play className="w-4 h-4 mr-2" />
                        Run Test
                    </Button>
                </ModalFooter>
            </Modal>
        </ProtectedRoute>
    );
}
