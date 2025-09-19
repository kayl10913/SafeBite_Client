// User Authentication and Dashboard Management
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    function checkUserAuth() {
        const currentUser = localStorage.getItem('currentUser');
        
        if (!currentUser) {
            // Redirect to login if no user is logged in
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(currentUser);
            displayUserInfo(user);
        } catch (error) {
            console.error('Error parsing user data:', error);
            localStorage.removeItem('currentUser');
            window.location.href = '/login';
        }
    }

    // Display user information in sidebar
    function displayUserInfo(user) {
        const accountText = document.getElementById('accountText');
        const sidebarTitle = document.querySelector('.sidebar-title');
        
        if (accountText) {
            accountText.textContent = user.username || user.name || user.email || 'User';
        }
        
        if (sidebarTitle) {
            sidebarTitle.textContent = user.username || user.name || user.email || 'User';
        }
    }

    // Handle logout
    function handleLogout() {
        const sessionToken = localStorage.getItem('jwt_token') || 
                             localStorage.getItem('sessionToken') || 
                             localStorage.getItem('session_token');
        
        if (sessionToken) {
            // Call backend logout API to log the activity
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                }
            })
            .then(response => response.json())
            .then(data => {
                // Clear user data regardless of API response
                localStorage.removeItem('currentUser');
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('sessionExpires');
                
                // Show logout message
                showLogoutMessage();
                
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            })
            .catch(error => {
                console.error('Logout API error:', error);
                // Still logout even if API fails
                localStorage.removeItem('currentUser');
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('sessionExpires');
                
                showLogoutMessage();
                
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            });
        } else {
            // Fallback if no session token
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('sessionExpires');
            
            showLogoutMessage();
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
        }
    }

    // Show logout message
    function showLogoutMessage() {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        toast.textContent = 'Logging out...';
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // Initialize authentication
    checkUserAuth();

    // Add logout event listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Add keyboard shortcut for logout (Ctrl+L)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            handleLogout();
        }
    });

    // Add session timeout check (optional)
    function checkSessionTimeout() {
        const lastActivity = localStorage.getItem('lastActivity');
        const currentTime = Date.now();
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes
        
        if (lastActivity && (currentTime - parseInt(lastActivity)) > sessionTimeout) {
            handleLogout();
        }
        
        // Update last activity
        localStorage.setItem('lastActivity', currentTime.toString());
    }

    // Update activity timestamp on user interaction
    document.addEventListener('click', function() {
        localStorage.setItem('lastActivity', Date.now().toString());
    });

    // Check session timeout every minute
    setInterval(checkSessionTimeout, 60000);

    console.log('User authentication initialized');
    console.log('✅ User Dashboard connected successfully!');
    console.log('📁 CSS files: User-assets folder');
    console.log('📁 JS files: User folder');
}); 