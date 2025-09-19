// Global Navigation Helper for SafeBite
// This script provides consistent navigation functions across all pages

const Navigation = {
    // Navigate to different pages
    goTo: function(page, params = {}) {
        const baseUrl = window.location.origin;
        let url = '';
        
        switch(page) {
            case 'home':
                url = '/';
                break;
            case 'login':
                url = '/login';
                break;
            case 'admin-login':
                url = '/admin-login';
                break;
            case 'user-dashboard':
                url = '/user-dashboard';
                break;
            case 'admin-dashboard':
                url = '/admin-dashboard';
                break;
            case 'signup':
                url = '/login'; // Signup is handled within login page
                break;
            default:
                url = '/';
        }
        
        // Add query parameters if any
        if (Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            url += `?${queryString}`;
        }
        
        window.location.href = url;
    },
    
    // Navigate back
    goBack: function() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            this.goTo('home');
        }
    },
    
    // Navigate to external URL
    goToExternal: function(url, newTab = false) {
        if (newTab) {
            window.open(url, '_blank');
        } else {
            window.location.href = url;
        }
    },
    
    // Check if current page matches
    isCurrentPage: function(page) {
        const currentPath = window.location.pathname;
        switch(page) {
            case 'home':
                return currentPath === '/';
            case 'login':
                return currentPath === '/login';
            case 'admin-login':
                return currentPath === '/admin-login';
            case 'user-dashboard':
                return currentPath === '/user-dashboard';
            case 'admin-dashboard':
                return currentPath === '/admin-dashboard';
            default:
                return false;
        }
    },
    
    // Get current page name
    getCurrentPage: function() {
        const currentPath = window.location.pathname;
        if (currentPath === '/') return 'home';
        if (currentPath === '/login') return 'login';
        if (currentPath === '/admin-login') return 'admin-login';
        if (currentPath === '/user-dashboard') return 'user-dashboard';
        if (currentPath === '/admin-dashboard') return 'admin-dashboard';
        return 'unknown';
    },
    
    // Add navigation event listeners to elements
    addListeners: function() {
        // Add navigation to buttons with specific text
        const allButtons = document.querySelectorAll('button, a');
        allButtons.forEach(button => {
            const text = button.textContent.toLowerCase();
            
            if (text.includes('login') || text.includes('sign in')) {
                button.addEventListener('click', function(e) {
                    if (!button.hasAttribute('href') && !button.hasAttribute('onclick')) {
                        e.preventDefault();
                        Navigation.goTo('login');
                    }
                });
            }
            
            if (text.includes('sign up') || text.includes('register')) {
                button.addEventListener('click', function(e) {
                    if (!button.hasAttribute('href') && !button.hasAttribute('onclick')) {
                        e.preventDefault();
                        Navigation.goTo('signup');
                    }
                });
            }
            
            if (text.includes('admin')) {
                button.addEventListener('click', function(e) {
                    if (!button.hasAttribute('href') && !button.hasAttribute('onclick')) {
                        e.preventDefault();
                        Navigation.goTo('admin-login');
                    }
                });
            }
            
            if (text.includes('dashboard')) {
                button.addEventListener('click', function(e) {
                    if (!button.hasAttribute('href') && !button.hasAttribute('onclick')) {
                        e.preventDefault();
                        Navigation.goTo('user-dashboard');
                    }
                });
            }
            
            if (text.includes('home')) {
                button.addEventListener('click', function(e) {
                    if (!button.hasAttribute('href') && !button.hasAttribute('onclick')) {
                        e.preventDefault();
                        Navigation.goTo('home');
                    }
                });
            }
        });
    },
    
    // Initialize navigation
    init: function() {
        this.addListeners();
        console.log('SafeBite Navigation initialized on:', this.getCurrentPage());
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        Navigation.init();
    });
} else {
    Navigation.init();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
} else {
    // Browser environment
    window.Navigation = Navigation;
}
