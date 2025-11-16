// API Configuration for SafeBite Node.js Backend
const RENDER_BASE = 'https://safebite-server-zh2r.onrender.com';
const LOCALHOST_BASE = 'http://localhost:3000';
const HOSTNAME = 'https://safebite-server-zh2r.onrender.com';
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Import error handler for Hostinger + Render setup
// This will be loaded before this file in your HTML

const API_CONFIG = {
    // Use localhost in development, Render backend in production
    BASE_URL: IS_LOCALHOST ? LOCALHOST_BASE : RENDER_BASE,
    
    // Debug logging
    DEBUG: IS_LOCALHOST,
    
    // API Endpoints
    ENDPOINTS: {
        // Authentication endpoints
        AUTH: {
            LOGIN: '/api/auth/login',
            REGISTER: '/api/auth/register',
            LOGOUT: '/api/auth/logout',
            FORGOT_PASSWORD: '/api/auth/forgot-password',
            RESET_PASSWORD: '/api/auth/reset-password',
            SEND_SIGNUP_OTP: '/api/auth/send-signup-otp',
            VERIFY_SIGNUP_OTP: '/api/auth/verify-signup-otp'
        },
        
        // User endpoints
        USER: {
            PROFILE: '/api/users/profile',
            UPDATE_PROFILE: '/api/users/profile',
            CHANGE_PASSWORD: '/api/users/change-password',
            FOOD_ITEMS: '/api/users/food-items',
            FOOD_TYPES: '/api/users/food-types',
            LOGS: '/api/users/logs',
            DASHBOARD_DATA: '/api/users/dashboard-data',
            ACTIVITY_SUMMARY: '/api/users/activity-summary'
        },
        
        // Admin endpoints
        ADMIN: {
            LOGIN: '/api/admin/login',
            USERS: '/api/admin/users',
            USER_DETAILS: '/api/admin/users',
            UPDATE_USER_STATUS: '/api/admin/users',
            LOGS: '/api/admin/logs',
            USER_LOGS: '/api/admin/user-logs',
            SPOILAGE_ALERTS: '/api/admin/spoilage-alerts',
            STATISTICS: '/api/admin/statistics',
            VERIFY_PASSWORD: '/api/admin/verify-password',
            FEEDBACKS: {
                STATISTICS: '/api/feedbacks/statistics',
                ALL: '/api/feedbacks',
                FILTER: '/api/feedbacks/filter',
                UPDATE: '/api/feedbacks',
                BY_TYPE: '/api/feedbacks/type',
                BY_USER: '/api/feedbacks/user'
            },
            REPORTS: {
                NEW_USERS: '/api/admin/reports/new-users',
                TOP_SPOILING_FOODS: '/api/admin/reports/top-spoiling-foods',
                MOST_USED_SENSOR: '/api/admin/reports/most-used-sensor'
            }
        },
        
        // Sensor endpoints
        SENSOR: {
            ARDUINO_DATA: '/api/sensor/arduino-data',
            DATA: '/api/sensor/data',
            LATEST: '/api/sensor/latest',
            BY_DATE: '/api/sensor/by-date',
            STATISTICS: '/api/sensor/statistics',
            ALERTS: '/api/sensor/alerts',
            DEVICES: '/api/sensor/devices'
        },
        
        // AI endpoints
        AI: {
            ANALYZE: '/api/ai/analyze',
            CHAT: '/api/ai/chat',
            ANALYSIS_HISTORY: '/api/ai/analysis-history',
            CHAT_HISTORY: '/api/ai/chat-history',
            TRAINING: '/api/ai/training',
            FOOD_ANALYSIS: '/api/ai/food-analysis'
        },
        
        // ML endpoints
        ML: {
            PREDICTION: '/api/ml/prediction',
            TRAINING: '/api/ml-training',
            MODELS: '/api/ml-models',
            WORKFLOW: '/api/ml-workflow',
            ANALYTICS: '/api/ml/analytics'
        },
        
        // Analytics endpoints
        ANALYTICS: {
            SENSOR: '/api/sensor-analytics',
            SPOILAGE: '/api/spoilage-analytics',
            STATISTICS: '/api/statistics'
        },
        
        // Device management endpoints
        DEVICE: {
            MANAGEMENT: '/api/device-management',
            ALERTS: '/api/alerts'
        },
        
        // Feedback endpoints
        FEEDBACK: {
            STATISTICS: '/api/feedbacks/statistics',
            ALL: '/api/feedbacks',
            FILTER: '/api/feedbacks/filter',
            UPDATE: '/api/feedbacks',
            BY_TYPE: '/api/feedbacks/type',
            BY_USER: '/api/feedbacks/user'
        }
    }
};

// Intercept fetch to route relative "/api/..." calls to the correct BASE_URL in production
(() => {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !window.__safebiteFetchPatched) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
            try {
                // Only rewrite when input is a string and starts with "/api/"
                if (typeof input === 'string' && input.startsWith('/api/')) {
                    const fullUrl = `${API_CONFIG.BASE_URL}${input}`;
                    return originalFetch(fullUrl, init);
                }
                // Rewrite absolute calls pointing to current origin + /api/... to BASE_URL
                if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
                    const currentOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                    if (currentOrigin && input.startsWith(`${currentOrigin}/api/`) && API_CONFIG.BASE_URL !== currentOrigin) {
                        const rewritten = input.replace(currentOrigin, API_CONFIG.BASE_URL);
                        return originalFetch(rewritten, init);
                    }
                }
                // If input is a Request object with relative "/api/" URL
                if (input && typeof Request !== 'undefined' && input instanceof Request) {
                    const url = input.url || '';
                    // Relative Request URLs in browsers are resolved to absolute using current origin,
                    // so detect if it points to current origin + /api/ and rewrite to BASE_URL
                    const currentOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                    if (currentOrigin && url.startsWith(`${currentOrigin}/api/`) && API_CONFIG.BASE_URL !== currentOrigin) {
                        const rewritten = url.replace(currentOrigin, API_CONFIG.BASE_URL);
                        return originalFetch(rewritten, init);
                    }
                }
            } catch (_) {}
            return originalFetch(input, init);
        };
        window.__safebiteFetchPatched = true;
    }
})();

// Helper function to build full API URL
function buildApiUrl(endpoint) {
    return `${API_CONFIG.BASE_URL}${endpoint}`;
}

// Helper function to make authenticated API requests
async function makeApiRequest(endpoint, options = {}) {
    const url = buildApiUrl(endpoint);
    
    // Debug logging for localhost
    if (API_CONFIG.DEBUG) {
        console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    }
    
    // Check for JWT token in multiple possible locations for compatibility
    const token = localStorage.getItem('jwt_token') || 
                  localStorage.getItem('sessionToken') || 
                  sessionStorage.getItem('jwt_token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
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
        const response = await fetch(url, requestOptions);
        
        // Handle different response types
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
        
        if (!response.ok) {
            // Debug logging for localhost
            if (API_CONFIG.DEBUG) {
                console.error(`❌ API Error: ${response.status} ${response.statusText}`, data);
            }
            
            // Extract error message from response
            const errorMessage = data.error || data.message || `HTTP error! status: ${response.status}`;
            
            // Check if this is an auth endpoint that shouldn't redirect to error page
            // Include login, forgot password, OTP, and registration endpoints
            const isAuthEndpoint = endpoint.includes('/login') || 
                                  endpoint.includes('/auth/login') || 
                                  endpoint.includes('/admin/login') ||
                                  endpoint.includes('/forgot-password') ||
                                  endpoint.includes('/forgot_password') ||
                                  endpoint.includes('/send-signup-otp') ||
                                  endpoint.includes('/verify-signup-otp') ||
                                  endpoint.includes('/send-otp') ||
                                  endpoint.includes('/verify-otp') ||
                                  endpoint.includes('/register') ||
                                  endpoint.includes('/signup');
            
            // Use error handler for Hostinger + Render setup (but skip redirect for auth endpoints)
            if (window.SafeBiteErrorHandler && !isAuthEndpoint) {
                window.SafeBiteErrorHandler.handleApiError(response, errorMessage);
                // Return error object instead of null so login functions can access error message
                return {
                    success: false,
                    error: errorMessage,
                    message: errorMessage,
                    status: response.status
                };
            }
            
            // For auth endpoints, return error object without redirecting
            return {
                success: false,
                error: errorMessage,
                message: errorMessage,
                status: response.status
            };
        }
        
        // Debug logging for successful responses
        if (API_CONFIG.DEBUG) {
            console.log(`✅ API Success: ${response.status}`, data);
        }
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        
        // Use error handler for network errors
        if (window.SafeBiteErrorHandler && !error.status) {
            window.SafeBiteErrorHandler.handleSafeBiteError(error, 'API Request');
            return null;
        }
        
        throw error;
    }
}

// Authentication helper functions
const Auth = {
    // Login user
    async login(email, password) {
        const response = await makeApiRequest(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response.success && response.jwt_token) {
            // Store tokens consistently
            localStorage.setItem('jwt_token', response.jwt_token);
            localStorage.setItem('user_data', JSON.stringify(response.user));
            localStorage.setItem('session_token', response.session.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
        }
        
        return response;
    },
    
    // Register user
    async register(userData) {
        return await makeApiRequest(API_CONFIG.ENDPOINTS.AUTH.REGISTER, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    
    // Logout user
    async logout() {
        const sessionToken = localStorage.getItem('session_token');
        
        try {
            await makeApiRequest(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, {
                method: 'POST',
                body: JSON.stringify({ session_token: sessionToken })
            });
        } catch (error) {
            console.warn('Logout API call failed:', error);
        }
        
        // Clear all token variations from local storage
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('session_token');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentAdmin');
        localStorage.removeItem('admin_data');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('sessionExpires');
        sessionStorage.clear();
    },
    
    // Forgot password
    async forgotPassword(email) {
        return await makeApiRequest(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },
    
    // Reset password
    async resetPassword(email, otp, newPassword, confirmPassword) {
        return await makeApiRequest(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, {
            method: 'POST',
            body: JSON.stringify({
                email,
                otp,
                new_password: newPassword,
                confirm_password: confirmPassword
            })
        });
    },
    
    // Check if user is logged in
    isLoggedIn() {
        return !!(localStorage.getItem('jwt_token') || 
                  localStorage.getItem('sessionToken') || 
                  localStorage.getItem('currentUser') || 
                  localStorage.getItem('currentAdmin'));
    },
    
    // Get current user data
    getCurrentUser() {
        const userData = localStorage.getItem('user_data') || 
                         localStorage.getItem('currentUser') ||
                         localStorage.getItem('currentAdmin');
        return userData ? JSON.parse(userData) : null;
    }
};

// Admin helper functions
const AdminAPI = {
    // Admin login
    async login(email, password) {
        const response = await makeApiRequest(API_CONFIG.ENDPOINTS.ADMIN.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response.success && response.jwt_token) {
            // Store tokens consistently
            localStorage.setItem('jwt_token', response.jwt_token);
            localStorage.setItem('admin_data', JSON.stringify(response.admin));
            localStorage.setItem('session_token', response.session.token);
            localStorage.setItem('currentAdmin', JSON.stringify(response.admin));
        }
        
        return response;
    },
    
    // Get all users
    async getUsers(page = 1, limit = 20, search = '', status = '') {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(search && { search }),
            ...(status && { status })
        });
        
        return await makeApiRequest(`${API_CONFIG.ENDPOINTS.ADMIN.USERS}?${params}`);
    },
    
    // Get user details
    async getUserDetails(userId) {
        return await makeApiRequest(`${API_CONFIG.ENDPOINTS.ADMIN.USER_DETAILS}/${userId}`);
    },
    
    // Update user status
    async updateUserStatus(userId, accountStatus) {
        return await makeApiRequest(`${API_CONFIG.ENDPOINTS.ADMIN.UPDATE_USER_STATUS}/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ account_status: accountStatus })
        });
    },
    
    // Get new users report data
    async getNewUsersReport(startDate, endDate, page = 1, limit = 25) {
        const params = new URLSearchParams({
            page: page,
            limit: limit
        });
        
        if (startDate && startDate.trim() !== '') {
            params.append('start_date', startDate);
        }
        
        if (endDate && endDate.trim() !== '') {
            params.append('end_date', endDate);
        }
        
        const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.ADMIN.REPORTS.NEW_USERS}?${params}`);
        return response;
    },

    async getTopSpoilingFoodsReport(startDate, endDate, page = 1, limit = 25) {
        const params = new URLSearchParams({
            page: page,
            limit: limit
        });
        
        if (startDate && startDate.trim() !== '') {
            params.append('start_date', startDate);
        }
        
        if (endDate && endDate.trim() !== '') {
            params.append('end_date', endDate);
        }
        
        const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.ADMIN.REPORTS.TOP_SPOILING_FOODS}?${params}`);
        return response;
    },

    async getMostUsedSensorReport(startDate, endDate, dateRangeType, page = 1, limit = 25) {
        const params = new URLSearchParams({
            page: page,
            limit: limit
        });
        
        // Only send date parameters based on the date range type
        if (dateRangeType === 'Custom' && startDate && endDate && startDate.trim() !== '' && endDate.trim() !== '') {
            // Custom date range: send start_date and end_date
            params.append('start_date', startDate);
            params.append('end_date', endDate);
        } else if (dateRangeType && dateRangeType !== 'All Time' && dateRangeType !== 'Custom') {
            // Predefined ranges (Daily, Weekly, Monthly, Yearly): send date_range_type only
            params.append('date_range_type', dateRangeType.toLowerCase());
        }
        // All Time: no date parameters needed
        
        // debug logs removed
        
        const response = await makeApiRequest(`${API_CONFIG.ENDPOINTS.ADMIN.REPORTS.MOST_USED_SENSOR}?${params}`);
        return response;
    }
};

// Sensor helper functions
const SensorAPI = {
    // Send Arduino sensor data (public endpoint)
    async sendArduinoData(sensorData) {
        return await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SENSOR.ARDUINO_DATA), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sensorData)
        }).then(response => response.json());
    },
    
    // Get sensor data
    async getSensorData(params = {}) {
        const searchParams = new URLSearchParams(params);
        return await makeApiRequest(`${API_CONFIG.ENDPOINTS.SENSOR.DATA}?${searchParams}`);
    },
    
    // Get latest sensor reading
    async getLatestReading(deviceId = '') {
        const params = deviceId ? `?device_id=${deviceId}` : '';
        return await makeApiRequest(`${API_CONFIG.ENDPOINTS.SENSOR.LATEST}${params}`);
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_CONFIG, makeApiRequest, Auth, AdminAPI, SensorAPI, buildApiUrl };
} else {
    // Browser environment
    window.API_CONFIG = API_CONFIG;
    window.makeApiRequest = makeApiRequest;
    window.Auth = Auth;
    window.AdminAPI = AdminAPI;
    window.SensorAPI = SensorAPI;
    window.buildApiUrl = buildApiUrl;
    
    // Debug logging for configuration
    if (API_CONFIG.DEBUG) {
        console.log(`🔧 SafeBite API Config: Using ${API_CONFIG.BASE_URL} (localhost mode)`);
    }
}
