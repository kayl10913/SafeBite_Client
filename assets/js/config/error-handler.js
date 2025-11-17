/**
 * SafeBite Error Handler for Hostinger + Render Setup
 * Handles API errors from Render backend and redirects to Hostinger error pages
 */

class SafeBiteErrorHandler {
    constructor() {
        this.backendUrl = 'https://safebite-server-zh2r.onrender.com';
        this.frontendUrl = window.location.origin; // Your Hostinger domain
    }

    /**
     * Handle API response errors
     * @param {Response} response - Fetch API response object
     * @param {string} customMessage - Optional custom error message
     * @param {boolean} preventRedirect - If true, don't redirect (for auth/signup endpoints)
     */
    handleApiError(response, customMessage = null, preventRedirect = false) {
        const status = response.status;
        
        // Check if this is an auth/signup endpoint by examining the URL
        const url = response.url || '';
        const isAuthEndpoint = url.includes('/login') || 
                              url.includes('/register') ||
                              url.includes('/signup') ||
                              url.includes('/forgot-password') ||
                              url.includes('/forgot_password') ||
                              url.includes('/send-signup-otp') ||
                              url.includes('/verify-signup-otp') ||
                              url.includes('/send-otp') ||
                              url.includes('/verify-otp') ||
                              url.includes('/password') ||
                              preventRedirect;
        
        // Never redirect for auth/signup endpoints or if preventRedirect is true
        if (isAuthEndpoint) {
            console.warn(`API Error ${status} (auth endpoint - not redirecting):`, {
                url: response.url,
                status: response.status,
                statusText: response.statusText,
                customMessage
            });
            return; // Exit early, don't redirect
        }
        
        let errorPage = '';

        switch (status) {
            case 400:
                errorPage = 'error/400';
                break;
            case 401:
                errorPage = 'error/401';
                break;
            case 403:
                errorPage = 'error/403';
                break;
            case 404:
                // Don't redirect for 404 errors - they're often non-critical (missing endpoints, etc.)
                // Just log the error instead
                console.warn(`API 404 Error (non-critical):`, {
                    url: response.url,
                    status: response.status,
                    statusText: response.statusText,
                    customMessage
                });
                return; // Exit early, don't redirect
            case 500:
                errorPage = 'error/500';
                break;
            default:
                errorPage = 'error/500';
        }

        // Log the error for debugging
        console.error(`API Error ${status}:`, {
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            customMessage
        });

        // Redirect to error page (only for critical errors, not 404s or auth endpoints)
        window.location.href = errorPage;
    }

    /**
     * Enhanced fetch wrapper with automatic error handling
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {Object} options - Fetch options
     * @returns {Promise} - Fetch promise
     */
    async apiCall(endpoint, options = {}) {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.backendUrl}${endpoint}`;
            
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                // Handle error (404s won't redirect, other errors will)
                this.handleApiError(response);
                return null;
            }

            return response;
        } catch (error) {
            console.error('Network error:', error);
            // Don't redirect for network errors - they're often temporary
            // Just log and return null
            console.warn('Network error occurred, but not redirecting to prevent disruption');
            return null;
        }
    }

    /**
     * Handle specific SafeBite API errors
     */
    handleSafeBiteError(error, context = '') {
        console.error(`SafeBite Error in ${context}:`, error);
        
        if (error.status) {
            this.handleApiError({ status: error.status });
        } else {
            // Unknown error - log but don't redirect to prevent disruption
            console.warn('Unknown error occurred, but not redirecting to prevent disruption');
        }
    }

    /**
     * Initialize error handling for the page
     * NOTE: Global error handlers are disabled to prevent disruption during normal usage.
     * Only explicit API error handling will trigger redirects.
     */
    init() {
        // Global error handler for unhandled promise rejections
        // DISABLED: Don't automatically redirect on promise rejections
        // This prevents disruption when typing in forms or during normal interactions
        window.addEventListener('unhandledrejection', (event) => {
            console.warn('Unhandled promise rejection (logged, not redirecting):', event.reason);
            // Don't redirect - just log the error
            // Only explicit API error handling in makeApiRequest will trigger redirects
        });

        // Global error handler for JavaScript errors
        // DISABLED: Don't automatically redirect on JavaScript errors
        // This prevents disruption when typing in password fields or during form interactions
        window.addEventListener('error', (event) => {
            // Only log errors, don't redirect
            // This prevents the 404 error page from appearing when typing in password fields
            console.warn('JavaScript error (logged, not redirecting):', {
                message: event.error ? event.error.message : event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
            // Don't redirect - just log the error
            // Only explicit API error handling in makeApiRequest will trigger redirects
        });
    }
}

// Create global instance
const errorHandler = new SafeBiteErrorHandler();

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => errorHandler.init());
} else {
    errorHandler.init();
}

// Export for use in other modules
window.SafeBiteErrorHandler = errorHandler;


