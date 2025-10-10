// Authentication App JavaScript (Admin specific)
console.log('Admin login script loaded');
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin login DOM loaded');
    // Global state management (equivalent to React useState)
    let currentView = 'login';
    
    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    // const signupForm = document.getElementById('signupForm'); // Not on admin page
    // const forgotForm = document.getElementById('forgotForm'); // Not on admin page, handled by alert
    
    // Login form elements
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const togglePasswordIcon = togglePasswordBtn ? togglePasswordBtn.querySelector('i') : null; // Made conditional
    const signinBtn = document.querySelector('.signin-btn');
    
    // Signup form elements (not present on admin login page, so these will be null)
    const signupNameInput = document.getElementById('signupName');
    const signupEmailInput = document.getElementById('signupEmail');
    const signupPasswordInput = document.getElementById('signupPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const toggleSignupPasswordBtn = document.getElementById('toggleSignupPassword');
    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');
    
    // Forgot password form elements (not present on admin login page, so these will be null)
    const forgotEmailInput = document.getElementById('forgotEmail');
    
    // View elements (only loginView is active on admin page)
    const loginView = document.getElementById('loginView');
    const signupView = document.getElementById('signupView');
    const forgotView = document.getElementById('forgotView');
    
    // Toaster element
    const toaster = document.getElementById('toaster');

    // Create particle effects
    function createParticles() {
        const particleCount = 15;
        const container = document.querySelector('.App');
        
        if (container) { // Ensure container exists before adding particles
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
            container.appendChild(particle);
            }
        }
    }

    // Navigation function (not directly used on admin login, but kept for structure)
    window.handleNavigation = function(view) {
        // Admin login page typically doesn't navigate between views
        console.warn('handleNavigation called on Admin Login page. This function is typically for user views.');
        // You might want to redirect to a different page or show an error here
        if (view === 'login') {
            window.location.href = 'Admin-Login.html'; // Or self-reload
        }
    };

    // Reset forms (only loginForm is relevant here)
    function resetForms() {
        if (loginForm) loginForm.reset();
        // signupForm and forgotForm are not present on Admin-Login.html
        
        // Clear all errors
        document.querySelectorAll('.input-field').forEach(field => {
            field.classList.remove('error');
        });
        
        document.querySelectorAll('.error-message').forEach(msg => {
            msg.remove();
        });
        
        // Reset password visibility
        resetPasswordVisibility();
    }

    // Reset password visibility toggles
    function resetPasswordVisibility() {
        const passwordToggles = document.querySelectorAll('.toggle-password');
        passwordToggles.forEach(toggle => {
            const icon = toggle.querySelector('i');
            if (icon) { // Check if icon exists
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            }
        });
        
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.setAttribute('type', 'password');
        });
    }

    // Password visibility toggle function
    function setupPasswordToggle(buttonId, inputId) {
        const button = document.getElementById(buttonId);
        const input = document.getElementById(inputId);
        // Only proceed if both button and input exist
        if (!button || !input) {
            console.warn(`Password toggle elements not found for button: ${buttonId}, input: ${inputId}`);
            return;
        }
        const icon = button.querySelector('i');
        
        button.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            
            if (type === 'text') {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } 
        });
    }

    // Setup password toggles conditionally, as not all elements exist on every auth page
    if (togglePasswordBtn) {
        setupPasswordToggle('togglePassword', 'password');
    }
    // No signup or confirm password toggles on admin page
    // if (toggleSignupPasswordBtn) { setupPasswordToggle('toggleSignupPassword', 'signupPassword'); }
    // if (toggleConfirmPasswordBtn) { setupPasswordToggle('toggleConfirmPassword', 'confirmPassword'); }

    // Form validation functions
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validatePassword(password) {
        return password.length >= 6;
    }

    function validateName(name) { // Not used on admin login
        return name.trim().length >= 2;
    }

    function showError(input, message) {
        const inputField = input.closest('.input-field');
        if (!inputField) return; // Prevent error if input field is null
        inputField.classList.add('error');
        
        // Remove existing error message if any
        const existingError = inputField.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        inputField.parentNode.insertBefore(errorDiv, inputField.nextSibling);
    }

    function clearError(input) {
        const inputField = input.closest('.input-field');
        if (!inputField) return; // Prevent error if input field is null
        inputField.classList.remove('error');
        
        const errorMessage = inputField.parentNode.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }

    // Real-time validation for login form
    if (emailInput) {
    emailInput.addEventListener('blur', function() {
        const email = this.value.trim();
        if (email && !validateEmail(email)) {
            showError(this, 'Please enter a valid email address');
        } else {
            clearError(this);
        }
    });
    }

    if (passwordInput) {
    passwordInput.addEventListener('blur', function() {
        const password = this.value;
        if (password && !validatePassword(password)) {
            showError(this, 'Password must be at least 6 characters long');
        } else {
            clearError(this);
        }
    });
    }

    // No real-time validation for signup or forgot on admin page
    // signupNameInput.addEventListener('blur', ...);
    // signupEmailInput.addEventListener('blur', ...);
    // signupPasswordInput.addEventListener('blur', ...);
    // confirmPasswordInput.addEventListener('blur', ...);
    // forgotEmailInput.addEventListener('blur', ...);

    // Clear errors on input
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', function() {
            if (this.value) {
                clearError(this);
            }
        });
    });

    // Login form submission
    if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        // Clear previous errors
        clearError(emailInput);
        clearError(passwordInput);
        
        // Validate form
        let isValid = true;
        
        if (!email) {
            showError(emailInput, 'Email or username is required');
            isValid = false;
        } else if (!validateEmail(email)) {
            showError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }
        
        if (!password) {
            showError(passwordInput, 'Password is required');
            isValid = false;
        } else if (!validatePassword(password)) {
            showError(passwordInput, 'Password must be at least 6 characters long');
            isValid = false;
        }
        
        if (!isValid) return;
        
        // Show loading state
        const submitBtn = this.querySelector('.signin-btn');
            if (submitBtn) { // Ensure button exists
        submitBtn.classList.add('loading');
        submitBtn.querySelector('span').textContent = 'Signing In...';
            }
        
        try {
                // Perform admin login with Node.js backend
                await performAdminLogin(email, password); // Call admin-specific login
        } catch (error) {
                console.error('Admin Login error:', error);
        } finally {
            // Reset button state
                if (submitBtn) { // Ensure button exists
            submitBtn.classList.remove('loading');
                    submitBtn.querySelector('span').textContent = 'Sign In as Admin'; // Admin specific text
                }
            }
        });
    }

    // Signup form submission (not present on admin login page)
    // if (signupForm) { signupForm.addEventListener('submit', async function(e) { /* ... */ }); }

    // Forgot password form submission (not present on admin login page)
    // if (forgotForm) { forgotForm.addEventListener('submit', async function(e) { /* ... */ }); }

    // Admin-specific login process with Node.js backend
    async function performAdminLogin(email, password) {
        try {
            console.log('Attempting admin login to Node.js API...');
            
            // Check if AdminAPI is available
            if (typeof AdminAPI === 'undefined') {
                throw new Error('AdminAPI helper not found. Make sure api-config.js is loaded.');
            }
            
            // Use the AdminAPI helper from api-config.js
            const data = await AdminAPI.login(email, password);
            
            console.log('Admin login response data:', data);
            console.log('Response success:', data.success);
            console.log('Response admin:', data.admin);
            
            if (data.success) {
                // Store admin data and JWT token (use consistent key names)
                localStorage.setItem('currentAdmin', JSON.stringify(data.admin));
                localStorage.setItem('jwt_token', data.jwt_token);
                localStorage.setItem('admin_data', JSON.stringify(data.admin));
                localStorage.setItem('session_token', data.session.token);
                localStorage.setItem('sessionExpires', data.session.expires_at);
                
                showToast(`Welcome back, ${data.admin.full_name || data.admin.first_name}! Redirecting to Admin Dashboard...`, 'success');
                
                console.log('About to redirect to ad-dashboard.html');
                setTimeout(() => {
                    console.log('Executing redirect to ad-dashboard.html');
                    window.location.href = '/pages/ad-dashboard.html';
                }, 1000);
            } else {
                showToast(data.error || 'Admin login failed. Please check credentials and try again.', 'error');
                if (data.details) {
                    console.error("Backend error details:", data.details);
                }
            }
        } catch (error) {
            console.error('Admin Login error:', error);
            // Provide more specific error messages
            if (error.message && error.message.includes('Failed to fetch')) {
                showToast('Cannot connect to server. Make sure the Node.js server is running on port 3000', 'error');
            } else {
                showToast(error.message || 'Network or server error during admin login. Please try again.', 'error');
            }
        }
    }

    // Toast notification system (equivalent to React Toaster)
    function showToast(message, type = 'info') {
        if (!toaster) {
            console.warn('Toaster element not found. Message:', message);
            alert(message); // Fallback to alert if toaster is not present
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' :
                    type === 'error' ? 'fa-exclamation-circle' :
                    type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        
        toaster.appendChild(toast);
        
        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    // Keyboard shortcuts (only for login form on admin page)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            const form = e.target.closest('form');
            if (form && form.id === 'loginForm') { // Ensure it's the login form
                form.dispatchEvent(new Event('submit'));
            }
        }
        
        // No form reset on escape for admin page, as it's a dedicated login
        // if (e.key === 'Escape') { resetForms(); }
    });

    // Focus management (only if elements exist)
    if (emailInput) emailInput.focus();
    
    // Auto-focus password field when email is entered (only if elements exist)
    if (emailInput && passwordInput) {
    emailInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
            passwordInput.focus();
        }
    });
    }

    // Add some interactive effects (only for inputs that exist)
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });
    });

    // Initialize particle effects
    createParticles();

    console.log('Admin Authentication app initialized successfully');
}); 