import axios, { AxiosInstance} from 'axios';

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_BASE_URL = PUBLIC_API.endsWith('/api/v1') ? PUBLIC_API : `${PUBLIC_API.replace(/\/$/, '')}/api/v1`;

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add auth token
        this.client.interceptors.request.use(
            (config) => {
                const token = this.getAccessToken();
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor to handle token refresh
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                try {
                    // Log axios error details for easier debugging (network / CORS / response)
                    // Avoid throwing during logging
                    // eslint-disable-next-line no-console
                    console.error('API response error:', error?.toJSON ? error.toJSON() : error);
                } catch (logErr) {
                    // ignore logging errors
                }
                const originalRequest = error.config;

                // If 401 and not already retried, try to refresh token
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        const refreshToken = this.getRefreshToken();
                        if (refreshToken) {
                            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                                refresh_token: refreshToken,
                            });

                            const { access_token, refresh_token } = response.data;
                            this.setTokens(access_token, refresh_token);

                            originalRequest.headers.Authorization = `Bearer ${access_token}`;
                            return this.client(originalRequest);
                        }
                    } catch (refreshError) {
                        // Refresh failed, clear tokens and redirect to login
                        this.clearTokens();
                        if (typeof window !== 'undefined') {
                            window.location.href = '/login';
                        }
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    private getAccessToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('access_token');
    }

    private getRefreshToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('refresh_token');
    }

    setTokens(accessToken: string, refreshToken: string) {
        if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
        }
    }

    clearTokens() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }
    }

    // Auth endpoints
    async login(email: string, password: string) {
        const response = await this.client.post('/auth/login', { email, password });
        const { access_token, refresh_token } = response.data;
        this.setTokens(access_token, refresh_token);
        return response.data;
    }

    async register(userData: any) {
        const response = await this.client.post('/auth/register', userData);
        return response.data;
    }

    async logout() {
        this.clearTokens();
    }

    async getCurrentUser() {
        const response = await this.client.get('/auth/me');
        return response.data;
    }

    // Course endpoints
    async getCourses() {
        const response = await this.client.get('/courses');
        return response.data;
    }

    async getCourse(id: number) {
        const response = await this.client.get(`/courses/${id}`);
        return response.data;
    }

    async createCourse(data: any) {
        const response = await this.client.post('/courses', data);
        return response.data;
    }

    async updateCourse(id: number, data: any) {
        const response = await this.client.patch(`/courses/${id}`, data);
        return response.data;
    }

    async deleteCourse(id: number) {
        await this.client.delete(`/courses/${id}`);
    }

    async enrollStudent(courseId: number, studentId: number) {
        const response = await this.client.post(`/courses/${courseId}/enroll`, null, {
            params: { student_id: studentId }
        });
        return response.data;
    }

    async enrollStudentByEmail(courseId: number, email: string) {
        const response = await this.client.post(`/courses/${courseId}/enroll-by-email`, { email });
        return response.data;
    }

    async bulkEnrollStudents(courseId: number, emails: string[]) {
        const response = await this.client.post(`/courses/${courseId}/bulk-enroll`, { emails });
        return response.data;
    }

    async getCourseStudents(courseId: number) {
        const response = await this.client.get(`/courses/${courseId}/students`);
        return response.data;
    }

    async unenrollStudent(courseId: number, studentId: number) {
        const response = await this.client.delete(`/courses/${courseId}/students/${studentId}`);
        return response.data;
    }

    // Assignment endpoints
    async getAssignments(courseId?: number) {
        const params = courseId ? { course_id: courseId } : {};
        const response = await this.client.get('/assignments', { params });
        return response.data;
    }

    async getAssignment(id: number) {
        const response = await this.client.get(`/assignments/${id}`);
        return response.data;
    }

    async createAssignment(data: any) {
        const response = await this.client.post('/assignments', data);
        return response.data;
    }

    async updateAssignment(id: number, data: any) {
        const response = await this.client.put(`/assignments/${id}`, data);
        return response.data;
    }

    async deleteAssignment(id: number) {
        await this.client.delete(`/assignments/${id}`);
    }

    async publishAssignment(id: number) {
        const response = await this.client.post(`/assignments/${id}/publish`);
        return response.data;
    }

    // Submission endpoints
    async getSubmissions(assignmentId?: number, studentId?: number) {
        const params: any = {};
        if (assignmentId) params.assignment_id = assignmentId;
        if (studentId) params.student_id = studentId;
        const response = await this.client.get('/submissions', { params });
        return response.data;
    }

    async getSubmission(id: number) {
        const response = await this.client.get(`/submissions/${id}`);
        return response.data;
    }

    async createSubmission(assignmentId: number, files: File[], groupId?: number) {
        const formData = new FormData();
        formData.append('assignment_id', assignmentId.toString());
        if (groupId) formData.append('group_id', groupId.toString());
        files.forEach((file) => formData.append('files', file));

        const response = await this.client.post('/submissions', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    async gradeSubmission(id: number) {
        const response = await this.client.post(`/submissions/${id}/grade`);
        return response.data;
    }

    async overrideScore(id: number, newScore: number, reason: string) {
        const formData = new FormData();
        formData.append('new_score', newScore.toString());
        formData.append('reason', reason);

        const response = await this.client.put(`/submissions/${id}/override-score`, formData);
        return response.data;
    }

    async downloadSubmission(id: number) {
        const response = await this.client.get(`/submissions/${id}/download`, {
            responseType: 'blob',
        });
        return response.data;
    }

    async runCode(assignmentId: number, files: { name: string; content: string }[]) {
        const response = await this.client.post(`/assignments/${assignmentId}/run`, { files });
        return response.data;
    }

    // Reports endpoints
    async getDashboardStats(courseId?: number) {
        const params = courseId ? { course_id: courseId } : {};
        const response = await this.client.get('/reports/dashboard', { params });
        return response.data;
    }

    async getStudentReport(studentId: number, courseId?: number) {
        const params = courseId ? { course_id: courseId } : {};
        const response = await this.client.get(`/reports/student/${studentId}`, { params });
        return response.data;
    }

    async getAssignmentReport(assignmentId: number) {
        const response = await this.client.get(`/reports/assignment/${assignmentId}`);
        return response.data;
    }

    async getCourseReport(courseId: number) {
        const response = await this.client.get(`/reports/course/${courseId}`);
        return response.data;
    }

    async exportCanvasGradebook(courseId: number) {
        const response = await this.client.get(`/reports/export/canvas/${courseId}`, {
            responseType: 'blob',
        });
        return response.data;
    }

    // Admin endpoints
    async getUsers(role?: string) {
        const params = role ? { role } : {};
        const response = await this.client.get('/admin/users', { params });
        return response.data;
    }

    async getUser(id: number) {
        const response = await this.client.get(`/admin/users/${id}`);
        return response.data;
    }

    async updateUser(id: number, data: any) {
        const response = await this.client.put(`/admin/users/${id}`, data);
        return response.data;
    }

    async deleteUser(id: number) {
        await this.client.delete(`/admin/users/${id}`);
    }

    async activateUser(id: number) {
        const response = await this.client.post(`/admin/users/${id}/activate`);
        return response.data;
    }

    async deactivateUser(id: number) {
        const response = await this.client.post(`/admin/users/${id}/deactivate`);
        return response.data;
    }

    async resetUserPassword(id: number, newPassword: string) {
        const response = await this.client.post(`/admin/users/${id}/reset-password`, { new_password: newPassword });
        return response.data;
    }

    async getAuditLogs(userId?: number, eventType?: string, days?: number) {
        const params: any = {};
        if (userId) params.user_id = userId;
        if (eventType) params.event_type = eventType;
        if (days) params.days = days;
        const response = await this.client.get('/admin/audit-logs', { params });
        return response.data;
    }

    async getSystemStats() {
        const response = await this.client.get('/admin/system-stats');
        return response.data;
    }

    async createUser(data: any) {
        const response = await this.client.post('/admin/users', data);
        return response.data;
    }

    // Language endpoints
    async getLanguages() {
        const response = await this.client.get('/languages');
        return response.data;
    }

    async getLanguage(id: number) {
        const response = await this.client.get(`/languages/${id}`);
        return response.data;
    }

    async createLanguage(data: any) {
        const response = await this.client.post('/languages', data);
        return response.data;
    }

    async updateLanguage(id: number, data: any) {
        const response = await this.client.put(`/languages/${id}`, data);
        return response.data;
    }

    async deleteLanguage(id: number) {
        await this.client.delete(`/languages/${id}`);
    }

    // Settings endpoints
    async getSettings() {
        const response = await this.client.get('/admin/settings');
        return response.data;
    }

    async updateSettings(data: any) {
        const response = await this.client.put('/admin/settings', data);
        return response.data;
    }

    // Audit logs
    async getAuditLogsFiltered(params: { 
        dateRange?: string; 
        action?: string; 
        status?: string;
        search?: string;
    }) {
        const response = await this.client.get('/admin/audit-logs', { params });
        return response.data;
    }

    // Storage / S3 uploads
    async getPresignedUpload(fileName: string, fileType: string, folder?: string): Promise<{ url?: string; uploadUrl?: string; key: string; publicUrl?: string; }> {
        // Endpoint to be provided by backend. Common patterns:
        // POST /storage/presign-upload or /files/presign
        const response = await this.client.post('/storage/presign', {
            file_name: fileName,
            file_type: fileType,
            folder: folder || 'uploads'
        });
        const data = response.data;
        return {
            url: data.url,
            uploadUrl: data.uploadUrl || data.url,
            key: data.key,
            publicUrl: data.publicUrl || data.public_url,
        };
    }
}

export const apiClient = new ApiClient();
export default apiClient;
