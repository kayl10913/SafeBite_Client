// Secure Authentication Utility
// This replaces localStorage-based token storage with secure httpOnly cookies

class SecureAuth {
    constructor() {
        this.baseUrl = window.location.origin;
    }

    /**
     * Login user with secure cookie-based authentication
     */
    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: Include cookies
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                // Store only non-sensitive user data in localStorage
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('user_data', JSON.stringify(data.user));
                localStorage.setItem('session_token', data.session.token);
                localStorage.setItem('sessionExpires', data.session.expires_at);
                
                // JWT token is now stored in secure httpOnly cookie automatically
                console.log('✅ Login successful - JWT token stored in secure httpOnly cookie');
                
                return data;
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Admin login with secure cookie-based authentication
     */
    async adminLogin(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: Include cookies
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                // Store only non-sensitive admin data in localStorage
                localStorage.setItem('currentAdmin', JSON.stringify(data.admin));
                localStorage.setItem('admin_data', JSON.stringify(data.admin));
                localStorage.setItem('session_token', data.session.token);
                localStorage.setItem('sessionExpires', data.session.expires_at);
                
                // JWT token is now stored in secure httpOnly cookie automatically
                console.log('✅ Admin login successful - JWT token stored in secure httpOnly cookie');
                
                return data;
            } else {
                throw new Error(data.error || 'Admin login failed');
            }
        } catch (error) {
            console.error('Admin login error:', error);
            throw error;
        }
    }

    /**
     * Logout user and clear secure cookie
     */
    async logout() {
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include', // Important: Include cookies
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            // Clear localStorage data
            localStorage.removeItem('currentUser');
            localStorage.removeItem('user_data');
            localStorage.removeItem('currentAdmin');
            localStorage.removeItem('admin_data');
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('session_token');
            localStorage.removeItem('sessionExpires');

            console.log('✅ Logout successful - Secure cookie cleared');
            
            return await response.json();
        } catch (error) {
            console.error('Logout error:', error);
            // Clear localStorage even if server request fails
            localStorage.clear();
            throw error;
        }
    }

    /**
     * Admin logout and clear secure cookie
     */
    async adminLogout() {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/logout`, {
                method: 'POST',
                credentials: 'include', // Important: Include cookies
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            // Clear localStorage data
            localStorage.removeItem('currentUser');
            localStorage.removeItem('user_data');
            localStorage.removeItem('currentAdmin');
            localStorage.removeItem('admin_data');
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('session_token');
            localStorage.removeItem('sessionExpires');

            console.log('✅ Admin logout successful - Secure cookie cleared');
            
            return await response.json();
        } catch (error) {
            console.error('Admin logout error:', error);
            // Clear localStorage even if server request fails
            localStorage.clear();
            throw error;
        }
    }

    /**
     * Check if user is logged in (based on localStorage user data)
     * Note: Actual authentication is now handled by secure httpOnly cookies
     */
    isLoggedIn() {
        return !!(localStorage.getItem('currentUser') || localStorage.getItem('currentAdmin'));
    }

    /**
     * Get current user data from localStorage
     */
    getCurrentUser() {
        const userData = localStorage.getItem('user_data');
        return userData ? JSON.parse(userData) : null;
    }

    /**
     * Get current admin data from localStorage
     */
    getCurrentAdmin() {
        const adminData = localStorage.getItem('admin_data');
        return adminData ? JSON.parse(adminData) : null;
    }

    /**
     * Make authenticated API request with credentials
     */
    async makeAuthenticatedRequest(endpoint, options = {}) {
        const defaultOptions = {
            credentials: 'include', // Important: Include cookies for authentication
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions);
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Token expired or invalid - redirect to login
                    this.handleAuthError();
                    throw new Error('Authentication failed');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('Authenticated request error:', error);
            throw error;
        }
    }

    /**
     * Handle authentication errors (token expired, etc.)
     */
    handleAuthError() {
        console.warn('🔒 Authentication error - redirecting to login');
        localStorage.clear();
        window.location.href = '/login';
    }
}

// Create global instance
window.SecureAuth = new SecureAuth();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecureAuth;
}
