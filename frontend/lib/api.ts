import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token: newRefreshToken } = response.data;
          
          Cookies.set('access_token', access_token, { expires: 1/48 }); // 30 minutes
          Cookies.set('refresh_token', newRefreshToken, { expires: 7 });

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, refresh_token } = response.data;
    
    Cookies.set('access_token', access_token, { expires: 1/48 }); // 30 minutes
    Cookies.set('refresh_token', refresh_token, { expires: 7 });
    
    return response.data;
  },
  
  register: async (data: any) => {
    return api.post('/auth/register', data);
  },
  
  logout: () => {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
  },
  
  getCurrentUser: async () => {
    return api.get('/auth/me');
  },
};

// Courses API
export const coursesApi = {
  list: () => api.get('/courses'),
  get: (id: number) => api.get(`/courses/${id}`),
  create: (data: any) => api.post('/courses', data),
  update: (id: number, data: any) => api.patch(`/courses/${id}`, data),
  enroll: (courseId: number, studentId: number) => 
    api.post(`/courses/${courseId}/enroll`, { student_id: studentId }),
};

// Assignments API
export const assignmentsApi = {
  list: (courseId?: number) => 
    api.get('/assignments', { params: { course_id: courseId } }),
  get: (id: number) => api.get(`/assignments/${id}`),
  create: (data: any) => api.post('/assignments', data),
  update: (id: number, data: any) => api.patch(`/assignments/${id}`, data),
};

// Submissions API
export const submissionsApi = {
  list: (assignmentId?: number) => 
    api.get('/submissions', { params: { assignment_id: assignmentId } }),
  get: (id: number) => api.get(`/submissions/${id}`),
  create: (data: FormData) => 
    api.post('/submissions', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: number, data: any) => api.patch(`/submissions/${id}`, data),
};

export default api;
