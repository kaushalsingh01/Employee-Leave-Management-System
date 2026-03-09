// public/js/api.js
const API = {
    BASE_URL: 'http://localhost:3000/api',
    token: localStorage.getItem('token'),

    // Helper method to get headers
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    },

    // Handle response
    async handleResponse(response) {
        const data = await response.json();

        if (!response.ok) {
            // Handle token expiration
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            }

            const error = new Error(data.message || 'Something went wrong');
            error.status = response.status;
            error.details = data.details || [];
            throw error;
        }

        return data;
    },

    // Auth endpoints
    auth: {
        async login(email, password) {
            const response = await fetch(`${API.BASE_URL}/auth/login`, {
                method: 'POST',
                headers: API.getHeaders(false),
                body: JSON.stringify({ email, password })
            });

            const data = await API.handleResponse(response);
            if (data.token) {
                API.token = data.token;
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            return data;
        },

        async register(userData) {
            const response = await fetch(`${API.BASE_URL}/auth/register`, {
                method: 'POST',
                headers: API.getHeaders(false),
                body: JSON.stringify(userData)
            });

            return API.handleResponse(response);
        },

        logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            API.token = null;
            window.location.href = '/';
        }
    },

    // Leave endpoints
    leave: {
        // Submit leave request
        async submit(requestData) {
            const response = await fetch(`${API.BASE_URL}/leaves`, {
                method: 'POST',
                headers: API.getHeaders(),
                body: JSON.stringify(requestData)
            });
            return API.handleResponse(response);
        },

        // Get user's leave requests
        async getMyRequests() {
            const response = await fetch(`${API.BASE_URL}/leaves/my-requests`, {
                headers: API.getHeaders()
            });
            return API.handleResponse(response);
        },

        // Get user's leave balance
        async getMyBalance() {
            const response = await fetch(`${API.BASE_URL}/leaves/my-balance`, {
                headers: API.getHeaders()
            });
            return API.handleResponse(response);
        },

        // Get pending requests (manager only)
        async getPendingRequests() {
            const response = await fetch(`${API.BASE_URL}/leaves/pending`, {
                headers: API.getHeaders()
            });
            return API.handleResponse(response);
        },

        // Get team requests (manager only)
        async getTeamRequests() {
            const response = await fetch(`${API.BASE_URL}/leaves/team`, {
                headers: API.getHeaders()
            });
            return API.handleResponse(response);
        },

        // Get employee balance (manager only)
        async getEmployeeBalance(employeeId) {
            const response = await fetch(`${API.BASE_URL}/leaves/team/${employeeId}/balance`, {
                headers: API.getHeaders()
            });
            return API.handleResponse(response);
        },

        // Approve/reject request (manager only)
        async processRequest(requestId, status, comments = '') {
            const response = await fetch(`${API.BASE_URL}/leaves/${requestId}/approve`, {
                method: 'PUT',
                headers: API.getHeaders(),
                body: JSON.stringify({ status, comments })
            });
            return API.handleResponse(response);
        },

        // Get single request
        async getRequest(requestId) {
            const response = await fetch(`${API.BASE_URL}/leaves/${requestId}`, {
                headers: API.getHeaders()
            });
            return API.handleResponse(response);
        },

        // Cancel request (employee only)
        async cancelRequest(requestId, reason = '') {
            const response = await fetch(`${API.BASE_URL}/leaves/${requestId}/cancel`, {
                method: 'POST',
                headers: API.getHeaders(),
                body: JSON.stringify({ reason })
            });
            return API.handleResponse(response);
        }
    },

    // Helper to get current user
    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    // Helper to check if user is logged in
    isAuthenticated() {
        return !!this.token;
    },

    // Helper to check user role
    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    }
};

// Redirect if not authenticated
function requireAuth() {
    if (!API.isAuthenticated()) {
        window.location.href = '/';
    }
}

// Redirect based on role
function redirectToDashboard() {
    const user = API.getCurrentUser();
    if (user) {
        if (user.role === 'manager') {
            window.location.href = '/manager.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    }
}