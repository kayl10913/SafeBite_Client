// User Authentication and Dashboard Management
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    function checkUserAuth() {
        const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
        
        if (!sessionToken) {
            // Redirect to login if no token is found
            window.location.href = '/login';
            return;
        }
        
        // Load user info from API instead of localStorage
        loadUserInfoFromAPI();
    }
    
    // Load user info from API
    async function loadUserInfoFromAPI() {
        try {
            console.log('user-auth.js: Loading user info from API...');
            
            const sessionToken = localStorage.getItem('jwt_token') || 
                               localStorage.getItem('sessionToken') || 
                               localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('user-auth.js: No session token found');
                return;
            }
            
            const response = await fetch('/api/users/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('user-auth.js: API response:', result);
            
            if (result.success && result.user) {
                displayUserInfo(result.user);
            } else {
                console.error('user-auth.js: Failed to load user info:', result.error);
                // Fallback to showing generic user info
                displayUserInfo({ username: 'User' });
            }
        } catch (error) {
            console.error('user-auth.js: Error loading user info:', error);
            // Fallback to showing generic user info
            displayUserInfo({ username: 'User' });
        }
    }

    // Display user information in sidebar
    function displayUserInfo(user) {
        console.log('user-auth.js: Displaying user info:', user);
        
        const accountText = document.getElementById('accountText');
        const sidebarTitle = document.querySelector('.sidebar-title');
        
        console.log('user-auth.js: Account text element:', accountText);
        console.log('user-auth.js: Sidebar title element:', sidebarTitle);
        
        // Create full name from first_name and last_name
        const fullName = user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}`.trim()
            : user.first_name || user.username || user.name || user.email || 'User';
        
        console.log('user-auth.js: Full name created:', fullName);
        
        if (accountText) {
            accountText.textContent = 'Profile';
            console.log('user-auth.js: Updated account text to: Profile');
        }
        
        if (sidebarTitle) {
            sidebarTitle.textContent = fullName;
            console.log('user-auth.js: Updated sidebar title to:', fullName);
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

    // Initialize user authentication
    checkUserAuth();

    console.log('User authentication initialized');
    console.log('✅ User Dashboard connected successfully!');
    console.log('📁 CSS files: User-assets folder');
    console.log('📁 JS files: User folder');
}); 