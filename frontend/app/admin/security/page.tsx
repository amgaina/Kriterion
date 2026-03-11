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
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import {
    MoreVertical,
    Eye,
    Download,
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShieldX,
    LogIn,
    LogOut,
    UserCog,
    FileEdit,
    Trash2,
    AlertTriangle,
    Clock,
    MapPin,
    Monitor,
    RefreshCw
} from 'lucide-react';

interface AuditLog {
    id: number;
    user_id?: number;
    user_name?: string;
    user_email?: string;
    action: string;
    resource_type: string;
    resource_id?: number;
    resource_name?: string;
    ip_address?: string;
    user_agent?: string;
    status: 'success' | 'failure' | 'warning';
    details?: string;
    created_at: string;
}

const mockAuditLogs: AuditLog[] = [
    { id: 1, user_name: 'Admin User', user_email: 'admin@kriterion.edu', action: 'login', resource_type: 'auth', status: 'success', ip_address: '192.168.1.1', user_agent: 'Chrome 120', created_at: new Date().toISOString() },
    { id: 2, user_name: 'Admin User', user_email: 'admin@kriterion.edu', action: 'create', resource_type: 'user', resource_name: 'John Student', status: 'success', ip_address: '192.168.1.1', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 3, user_name: 'Faculty User', user_email: 'faculty@kriterion.edu', action: 'update', resource_type: 'assignment', resource_name: 'Binary Search', status: 'success', ip_address: '10.0.0.25', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 4, user_name: 'Unknown', user_email: 'attacker@evil.com', action: 'login', resource_type: 'auth', status: 'failure', ip_address: '45.33.32.156', details: 'Invalid credentials - 5 failed attempts', created_at: new Date(Date.now() - 10800000).toISOString() },
    { id: 5, user_name: 'Admin User', user_email: 'admin@kriterion.edu', action: 'delete', resource_type: 'user', resource_name: 'Test Account', status: 'warning', ip_address: '192.168.1.1', created_at: new Date(Date.now() - 14400000).toISOString() },
];

export default function SecurityPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [dateRange, setDateRange] = useState('today');
    const [actionFilter, setActionFilter] = useState('');
    const [detailModal, setDetailModal] = useState<{ open: boolean; log?: AuditLog }>({ open: false });

    const { data: auditLogs = mockAuditLogs, isLoading } = useQuery({
        queryKey: ['audit-logs', dateRange, actionFilter],
        queryFn: () => Promise.resolve(mockAuditLogs), // Replace with apiClient.getAuditLogs()
    });

    const filteredLogs = auditLogs.filter((log: AuditLog) =>
        log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(searchQuery.toLowerCase())
    ).filter((log: AuditLog) =>
        actionFilter ? log.action === actionFilter : true
    );

    const successLogs = filteredLogs.filter((l: AuditLog) => l.status === 'success');
    const failureLogs = filteredLogs.filter((l: AuditLog) => l.status === 'failure');
    const warningLogs = filteredLogs.filter((l: AuditLog) => l.status === 'warning');

    const tabs = [
        { id: 'all', label: 'All Events', count: filteredLogs.length, icon: <Shield className="w-4 h-4" /> },
        { id: 'success', label: 'Success', count: successLogs.length, icon: <ShieldCheck className="w-4 h-4 text-green-500" /> },
        { id: 'failure', label: 'Failures', count: failureLogs.length, icon: <ShieldX className="w-4 h-4 text-red-500" /> },
        { id: 'warning', label: 'Warnings', count: warningLogs.length, icon: <ShieldAlert className="w-4 h-4 text-yellow-500" /> },
    ];

    const getFilteredByTab = () => {
        switch (activeTab) {
            case 'success': return successLogs;
            case 'failure': return failureLogs;
            case 'warning': return warningLogs;
            default: return filteredLogs;
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'login': return <LogIn className="w-4 h-4" />;
            case 'logout': return <LogOut className="w-4 h-4" />;
            case 'create': return <UserCog className="w-4 h-4" />;
            case 'update': return <FileEdit className="w-4 h-4" />;
            case 'delete': return <Trash2 className="w-4 h-4" />;
            default: return <Shield className="w-4 h-4" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success': return <Badge variant="success">Success</Badge>;
            case 'failure': return <Badge variant="danger">Failed</Badge>;
            case 'warning': return <Badge variant="warning">Warning</Badge>;
            default: return <Badge variant="default">{status}</Badge>;
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const columns = [
        {
            key: 'event',
            header: 'Event',
            cell: (log: AuditLog) => (
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${log.status === 'success' ? 'bg-green-100 text-green-600' :
                        log.status === 'failure' ? 'bg-red-100 text-red-600' :
                            'bg-yellow-100 text-yellow-600'
                        }`}>
                        {getActionIcon(log.action)}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 capitalize">{log.action} {log.resource_type}</p>
                        {log.resource_name && (
                            <p className="text-sm text-gray-500">{log.resource_name}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'user',
            header: 'User',
            cell: (log: AuditLog) => (
                <div className="flex items-center gap-2">
                    <Avatar alt={log.user_name || 'Unknown'} size="sm" />
                    <div>
                        <p className="text-sm font-medium">{log.user_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{log.user_email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'ip',
            header: 'IP Address',
            cell: (log: AuditLog) => (
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{log.ip_address || 'N/A'}</code>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (log: AuditLog) => getStatusBadge(log.status),
        },
        {
            key: 'time',
            header: 'Time',
            cell: (log: AuditLog) => (
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{formatTimeAgo(log.created_at)}</span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (log: AuditLog) => (
                <button
                    onClick={() => setDetailModal({ open: true, log })}
                    className="p-1 hover:bg-gray-100 rounded"
                >
                    <Eye className="w-4 h-4 text-gray-500" />
                </button>
            ),
        },
    ];

    return (
        <ProtectedRoute allowedRoles={['ADMIN']}>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Security & Audit Logs</h1>
                            <p className="text-gray-500 mt-1">Monitor system activity and security events</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <Button variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Export Logs
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#862733]/10 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-[#862733]" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Total Events</p>
                                        <p className="text-xl font-bold text-gray-900">{auditLogs.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                        <ShieldCheck className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Successful</p>
                                        <p className="text-xl font-bold text-green-600">{successLogs.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                        <ShieldX className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Failed</p>
                                        <p className="text-xl font-bold text-red-600">{failureLogs.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Warnings</p>
                                        <p className="text-xl font-bold text-yellow-600">{warningLogs.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Security Alerts */}
                    {failureLogs.length > 0 && (
                        <Card className="border-red-200 bg-red-50">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                                    <div>
                                        <h3 className="font-medium text-red-900">Security Alert</h3>
                                        <p className="text-sm text-red-700 mt-1">
                                            {failureLogs.length} failed login attempt(s) detected. Review the logs below for details.
                                        </p>
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
                                        value={dateRange}
                                        onChange={(e) => setDateRange(e.target.value)}
                                        options={[
                                            { value: 'today', label: 'Today' },
                                            { value: 'week', label: 'This Week' },
                                            { value: 'month', label: 'This Month' },
                                            { value: 'all', label: 'All Time' },
                                        ]}
                                        className="w-32"
                                    />
                                    <Select
                                        value={actionFilter}
                                        onChange={(e) => setActionFilter(e.target.value)}
                                        options={[
                                            { value: '', label: 'All Actions' },
                                            { value: 'login', label: 'Login' },
                                            { value: 'logout', label: 'Logout' },
                                            { value: 'create', label: 'Create' },
                                            { value: 'update', label: 'Update' },
                                            { value: 'delete', label: 'Delete' },
                                        ]}
                                        className="w-32"
                                    />
                                    <SearchInput
                                        value={searchQuery}
                                        onChange={setSearchQuery}
                                        placeholder="Search logs..."
                                        className="md:w-48"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Audit Logs Table */}
                    <Card>
                        <DataTable
                            columns={columns}
                            data={getFilteredByTab()}
                            isLoading={isLoading}
                            emptyMessage="No audit logs found"
                        />
                    </Card>
                </div>

                {/* Log Detail Modal */}
                <Modal
                    isOpen={detailModal.open}
                    onClose={() => setDetailModal({ open: false })}
                    title="Audit Log Details"
                    size="lg"
                >
                    {detailModal.log && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${detailModal.log.status === 'success' ? 'bg-green-100 text-green-600' :
                                    detailModal.log.status === 'failure' ? 'bg-red-100 text-red-600' :
                                        'bg-yellow-100 text-yellow-600'
                                    }`}>
                                    {getActionIcon(detailModal.log.action)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-gray-900 capitalize">
                                        {detailModal.log.action} {detailModal.log.resource_type}
                                    </h3>
                                    <p className="text-sm text-gray-500">{detailModal.log.resource_name}</p>
                                </div>
                                {getStatusBadge(detailModal.log.status)}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">User</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Avatar alt={detailModal.log.user_name || 'Unknown'} size="sm" />
                                            <div>
                                                <p className="text-sm font-medium">{detailModal.log.user_name}</p>
                                                <p className="text-xs text-gray-500">{detailModal.log.user_email}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Timestamp</label>
                                        <p className="text-sm mt-1">
                                            {new Date(detailModal.log.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">IP Address</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                                                {detailModal.log.ip_address}
                                            </code>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">User Agent</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Monitor className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm">{detailModal.log.user_agent || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {detailModal.log.details && (
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Details</label>
                                    <div className="mt-1 p-3 bg-gray-50 rounded-lg border">
                                        <p className="text-sm text-gray-700">{detailModal.log.details}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setDetailModal({ open: false })}>
                            Close
                        </Button>
                    </ModalFooter>
                </Modal>
        </ProtectedRoute>
    );
}
