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
     */
    handleApiError(response, customMessage = null) {
        const status = response.status;
        let errorPage = '';

        switch (status) {
            case 400:
                errorPage = '/pages/400.html';
                break;
            case 401:
                errorPage = '/pages/401.html';
                break;
            case 403:
                errorPage = '/pages/403.html';
                break;
            case 404:
                errorPage = '/pages/404.html';
                break;
            case 500:
                errorPage = '/pages/500.html';
                break;
            default:
                errorPage = '/pages/500.html';
        }

        // Log the error for debugging
        console.error(`API Error ${status}:`, {
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            customMessage
        });

        // Redirect to error page
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
                this.handleApiError(response);
                return null;
            }

            return response;
        } catch (error) {
            console.error('Network error:', error);
            // Redirect to 500 error page for network issues
            window.location.href = '/pages/500.html';
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
            // Unknown error - redirect to 500 page
            window.location.href = '/pages/500.html';
        }
    }

    /**
     * Initialize error handling for the page
     */
    init() {
        // Global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (event.reason && event.reason.status) {
                this.handleApiError(event.reason);
            }
        });

        // Global error handler for JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            // Only redirect to error page for critical errors
            if (event.error && event.error.name === 'TypeError') {
                window.location.href = '/pages/500.html';
            }
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

// Example usage:
/*
// Instead of:
fetch('/api/sensor/data')
    .then(response => response.json())
    .catch(error => console.error(error));

// Use:
errorHandler.apiCall('/api/sensor/data')
    .then(response => response.json())
    .then(data => console.log(data));
*/
