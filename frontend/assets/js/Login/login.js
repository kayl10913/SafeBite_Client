// Authentication App JavaScript (User specific)

// reCAPTCHA v3 Status Management
function updateRecaptchaStatus(message, status) {
    const statusElement = document.getElementById('recaptcha-status');
    const iconElement = document.getElementById('recaptcha-icon');
    const scoreElement = document.getElementById('recaptcha-score');
    
    if (statusElement) {
        statusElement.textContent = message;
    }
    
    if (iconElement) {
        // Update icon based on status
        switch (status) {
            case 'loading':
                iconElement.style.background = '#f59e0b';
                iconElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                break;
            case 'success':
                iconElement.style.background = '#10b981';
                iconElement.innerHTML = '<i class="fas fa-check"></i>';
                break;
            case 'error':
                iconElement.style.background = '#ef4444';
                iconElement.innerHTML = '<i class="fas fa-times"></i>';
                break;
            case 'warning':
                iconElement.style.background = '#f59e0b';
                iconElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            default:
                iconElement.style.background = '#6b7280';
                iconElement.innerHTML = '<i class="fas fa-shield-alt"></i>';
        }
    }
}

// Initialize reCAPTCHA v3 status
function initializeRecaptcha() {
    updateRecaptchaStatus('Initializing reCAPTCHA v3...', 'loading');
    
    // Check if reCAPTCHA is loaded
    if (window.grecaptcha && grecaptcha.ready) {
        grecaptcha.ready(function() {
            updateRecaptchaStatus('reCAPTCHA v3 ready - Security protection active', 'success');
        });
    } else {
        // Wait for reCAPTCHA to load
        setTimeout(() => {
            if (window.grecaptcha && grecaptcha.ready) {
                grecaptcha.ready(function() {
                    updateRecaptchaStatus('reCAPTCHA v3 ready - Security protection active', 'success');
                });
            } else {
                updateRecaptchaStatus('reCAPTCHA v3 failed to load', 'error');
            }
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Global state management (equivalent to React useState)
    let currentView = 'login';
    
    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const forgotForm = document.getElementById('forgotForm');
    
    // Login form elements
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const togglePasswordIcon = togglePasswordBtn ? togglePasswordBtn.querySelector('i') : null;
    const signinBtn = document.querySelector('.signin-btn');
    
    // Signup form elements
    const signupFirstNameInput = document.getElementById('signupFirstName');
    const signupLastNameInput = document.getElementById('signupLastName');
    const signupContactNumberInput = document.getElementById('signupContactNumber');
    const signupTesterTypeInput = document.getElementById('signupTesterType');
    const signupPrevBtn = document.getElementById('signupPrevBtn');
    const signupNextBtn = document.getElementById('signupNextBtn');
    const signupSubmitBtn = document.getElementById('signupSubmitBtn');
    const signupSteps = document.querySelectorAll('#signupForm .signup-steps .step');
    const stepperItems = document.querySelectorAll('#signupForm .stepper .stepper-item');
    let currentSignupStep = 1;
    const signupEmailInput = document.getElementById('signupEmail');
    const signupPasswordInput = document.getElementById('signupPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const toggleSignupPasswordBtn = document.getElementById('toggleSignupPassword');
    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');
    
    // Forgot password form elements
    const forgotEmailInput = document.getElementById('forgotEmail');
    
    // View elements
    const loginView = document.getElementById('loginView');
    const signupView = document.getElementById('signupView');
    const forgotView = document.getElementById('forgotView');
    
    // Toaster element
    const toaster = document.getElementById('toaster');

    // Create particle effects
    function createParticles() {
        const particleCount = 15;
        const container = document.querySelector('.App');
        
        if (container) {
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

    // Navigation function (equivalent to React handleNavigation)
    window.handleNavigation = function(view) {
        if (view === currentView) return;
        
        // Hide current view
        const currentViewElement = document.getElementById(currentView + 'View');
        currentViewElement.classList.add('slide-out');
        
        setTimeout(() => {
            // Remove active class from all views
            document.querySelectorAll('.auth-view').forEach(view => {
                view.classList.remove('active');
            });
            
            // Show new view
            const newViewElement = document.getElementById(view + 'View');
            newViewElement.classList.add('active', 'slide-in');
            
            // Update current view
            currentView = view;
            
            // Reset forms when switching views
            resetForms();
            
            // Focus on first input of new view
            setTimeout(() => {
                const firstInput = newViewElement.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
            
        }, 300);
    };

    // Reset all forms
    function resetForms() {
        loginForm.reset();
        signupForm.reset();
        forgotForm.reset();
        
        // Clear all errors
        document.querySelectorAll('.input-field').forEach(field => {
            field.classList.remove('error');
        });
        
        document.querySelectorAll('.error-message').forEach(msg => {
            msg.remove();
        });
        
        // Reset password visibility
        resetPasswordVisibility();

        // Reset signup steps
        if (signupSteps && signupSteps.length) {
            currentSignupStep = 1;
            updateSignupStepUI();
        }
    }

    // Reset password visibility toggles
    function resetPasswordVisibility() {
        const passwordToggles = document.querySelectorAll('.toggle-password');
        passwordToggles.forEach(toggle => {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
        
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.setAttribute('type', 'password');
        });
    }
    // Signup step navigation and validation
    function updateSignupStepUI(direction = 'forward') {
        signupSteps.forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'), 10);
            const isActive = stepNum === currentSignupStep;
            step.classList.remove('slide-in-right','slide-out-left','slide-in-left','slide-out-right');
            if (isActive) {
                step.classList.add('active', direction === 'forward' ? 'slide-in-right' : 'slide-in-left');
            } else {
                const wasActive = step.classList.contains('active');
                if (wasActive) {
                    step.classList.add(direction === 'forward' ? 'slide-out-left' : 'slide-out-right');
                    setTimeout(() => step.classList.remove('active'), 250);
                }
            }
        });

        // Update stepper
        if (stepperItems && stepperItems.length) {
            stepperItems.forEach(item => {
                const s = parseInt(item.getAttribute('data-step'), 10);
                item.classList.toggle('active', s === currentSignupStep);
                item.classList.toggle('completed', s < currentSignupStep);
            });
        }

        if (signupPrevBtn) signupPrevBtn.style.display = currentSignupStep > 1 ? 'inline-block' : 'none';
        if (signupNextBtn) signupNextBtn.style.display = currentSignupStep < 3 ? 'inline-block' : 'none';
        if (signupSubmitBtn) signupSubmitBtn.style.display = currentSignupStep === 3 ? 'inline-block' : 'none';
    }

    function validateSignupStep(stepNum) {
        let ok = true;
        if (stepNum === 1) {
            if (!signupFirstNameInput.value.trim() || !validateName(signupFirstNameInput.value.trim())) {
                showError(signupFirstNameInput, 'First name must be at least 2 characters long');
                ok = false;
            }
            if (!signupLastNameInput.value.trim() || !validateName(signupLastNameInput.value.trim())) {
                showError(signupLastNameInput, 'Last name must be at least 2 characters long');
                ok = false;
            }
            const email = signupEmailInput.value.trim();
            if (!email || !validateEmail(email)) {
                showError(signupEmailInput, 'Please enter a valid email address');
                ok = false;
            }
        } else if (stepNum === 2) {
            // Optional fields; no strict validation
        } else if (stepNum === 3) {
            const password = signupPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            if (!password || !validatePassword(password)) {
                // showError(signupPasswordInput, 'Password must be at least 8 characters with upper, lower, number, and special');
                ok = false;
            }
            if (!confirmPassword || password !== confirmPassword) {
                // showError(confirmPasswordInput, 'Passwords do not match');
                ok = false;
            }
        }
        return ok;
    }

    if (signupNextBtn) {
        signupNextBtn.addEventListener('click', function() {
            if (!validateSignupStep(currentSignupStep)) return;
            if (currentSignupStep < 3) {
                currentSignupStep += 1;
                updateSignupStepUI('forward');
            }
        });
    }

    if (signupPrevBtn) {
        signupPrevBtn.addEventListener('click', function() {
            if (currentSignupStep > 1) {
                currentSignupStep -= 1;
                updateSignupStepUI('back');
            }
        });
    }

    // Initialize step UI on load if signup view is present
    if (signupSteps && signupSteps.length) {
        updateSignupStepUI();
    }

    // Password visibility toggle function
    function setupPasswordToggle(buttonId, inputId) {
        const button = document.getElementById(buttonId);
        const input = document.getElementById(inputId);
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
    if (toggleSignupPasswordBtn) {
        setupPasswordToggle('toggleSignupPassword', 'signupPassword');
    }
    if (toggleConfirmPasswordBtn) {
        setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');
    }

    // Form validation functions
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validatePassword(password) {
        // Temporarily relaxed password validation for debugging: min 6 characters
        const lengthOk = password.length >= 6;
        // const upperOk = /[A-Z]/.test(password);
        // const lowerOk = /[a-z]/.test(password);
        // const numberOk = /[0-9]/.test(password);
        // const specialOk = /[^A-Za-z0-9]/.test(password);
        // return lengthOk && upperOk && lowerOk && numberOk && specialOk;
        return lengthOk;
    }

    function validateName(name) {
        return name.trim().length >= 2;
    }

    function showError(input, message) {
        const inputField = input.closest('.input-field');
        if (!inputField) return;
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
        if (!inputField) return;
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
                // showError(this, 'Password must be at least 8 characters long, with uppercase, lowercase, numbers, and special characters.');
            } else {
                clearError(this);
            }
        });
    }

    // Real-time validation for signup form
    if (signupFirstNameInput) {
        signupFirstNameInput.addEventListener('blur', function() {
            const name = this.value.trim();
            if (name && !validateName(name)) {
                showError(this, 'First name must be at least 2 characters long');
            } else {
                clearError(this);
            }
        });
    }

    if (signupLastNameInput) {
        signupLastNameInput.addEventListener('blur', function() {
            const name = this.value.trim();
            if (name && !validateName(name)) {
                showError(this, 'Last name must be at least 2 characters long');
            } else {
                clearError(this);
            }
        });
    }

    if (signupEmailInput) {
        signupEmailInput.addEventListener('blur', function() {
            const email = this.value.trim();
            if (email && !validateEmail(email)) {
                showError(this, 'Please enter a valid email address');
            } else {
                clearError(this);
            }
        });
    }

    if (signupPasswordInput) {
        const req = {
            length: document.getElementById('req-length'),
            upper: document.getElementById('req-upper'),
            lower: document.getElementById('req-lower'),
            number: document.getElementById('req-number'),
            special: document.getElementById('req-special')
        };
        const strengthBar = document.getElementById('passwordStrengthBar');
        const strengthLabel = document.getElementById('passwordStrengthLabel');
        function updatePasswordChecklist(pw) {
            const checks = {
                length: pw.length >= 8,
                upper: /[A-Z]/.test(pw),
                lower: /[a-z]/.test(pw),
                number: /[0-9]/.test(pw),
                special: /[^A-Za-z0-9]/.test(pw)
            };
            Object.keys(checks).forEach(k => {
                if (req[k]) {
                    req[k].classList.remove('req-ok','req-bad','req-animate');
                    req[k].classList.add('req-animate');
                    if (checks[k]) req[k].classList.add('req-ok'); else req[k].classList.add('req-bad');
                }
            });

            // Strength score: count satisfied requirements (0..5)
            const score = Object.values(checks).filter(Boolean).length;
            if (strengthBar && strengthLabel) {
                let pct = (score / 5) * 100;
                strengthBar.style.width = pct + '%';
                if (score <= 2) {
                    strengthBar.style.background = '#f44336';
                    strengthLabel.textContent = 'Weak';
                } else if (score === 3 || score === 4) {
                    strengthBar.style.background = '#ff9800';
                    strengthLabel.textContent = 'Medium';
                } else {
                    strengthBar.style.background = '#4caf50';
                    strengthLabel.textContent = 'Strong';
                }
            }
        }
        signupPasswordInput.addEventListener('input', function() {
            updatePasswordChecklist(this.value);
        });
        signupPasswordInput.addEventListener('blur', function() {
            const password = this.value;
            updatePasswordChecklist(password);
            if (password && !validatePassword(password)) {
                // showError(this, 'Password must be at least 8 characters with upper, lower, number, and special');
            } else {
                clearError(this);
            }
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('blur', function() {
            const password = signupPasswordInput.value;
            const confirmPassword = this.value;
            if (confirmPassword && password !== confirmPassword) {
                // showError(this, 'Passwords do not match');
            } else {
                clearError(this);
            }
        });
    }

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
                // showError(passwordInput, 'Password must be at least 6 characters long');
                isValid = false;
            }
            
            console.log('Validation Result (isValid):', isValid);
            if (!isValid) return;
            
            console.log('Attempting to call performUserLogin...');
            // Show loading state
            const submitBtn = this.querySelector('.signin-btn');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.querySelector('span').textContent = 'Signing In...';
            }
            
            try {
                // Perform user login with PHP backend
                await performUserLogin(email, password);
            } catch (error) {
                console.error('User Login error:', error);
            } finally {
                // Reset button state
                if (submitBtn) {
                    submitBtn.classList.remove('loading');
                    submitBtn.querySelector('span').textContent = 'Sign In';
                }
            }
        });
    }

    // Signup form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const firstName = signupFirstNameInput.value.trim();
            const lastName = signupLastNameInput.value.trim();
            const email = signupEmailInput.value.trim();
            const password = signupPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const contactNumber = signupContactNumberInput ? signupContactNumberInput.value.trim() : '';
            const testerTypeId = signupTesterTypeInput ? signupTesterTypeInput.value : '';
            
            // Clear previous errors
            clearError(signupFirstNameInput);
            clearError(signupLastNameInput);
            clearError(signupEmailInput);
            clearError(signupPasswordInput);
            clearError(confirmPasswordInput);
            
            // Validate all steps before final submit
            let isValid = true;
            if (!firstName) {
                showError(signupFirstNameInput, 'First name is required');
                isValid = false;
            } else if (!validateName(firstName)) {
                showError(signupFirstNameInput, 'First name must be at least 2 characters long');
                isValid = false;
            }

            if (!lastName) {
                showError(signupLastNameInput, 'Last name is required');
                isValid = false;
            } else if (!validateName(lastName)) {
                showError(signupLastNameInput, 'Last name must be at least 2 characters long');
                isValid = false;
            }
            
            if (!email) {
                showError(signupEmailInput, 'Email is required');
                isValid = false;
            } else if (!validateEmail(email)) {
                showError(signupEmailInput, 'Please enter a valid email address');
                isValid = false;
            }
            
            if (!password) {
                showError(signupPasswordInput, 'Password is required');
                isValid = false;
            } else if (!validatePassword(password)) {
                // showError(signupPasswordInput, 'Password must be at least 8 characters with upper, lower, number, and special');
                isValid = false;
            }
            
            if (!confirmPassword) {
                showError(confirmPasswordInput, 'Please confirm your password');
                isValid = false;
            } else if (password !== confirmPassword) {
                // showError(confirmPasswordInput, 'Passwords do not match');
                isValid = false;
            }
            
            if (!isValid) return;

            // Get reCAPTCHA v3 token
            let recaptchaToken = '';
            if (window.grecaptcha && grecaptcha.execute) {
                try {
                    updateRecaptchaStatus('Generating security token...', 'loading');
                    recaptchaToken = await grecaptcha.execute('6LehsL4rAAAAAJoPPIbOzI_M7vWu-bt1NoKq22Js', { action: 'register' });
                    updateRecaptchaStatus('Security token generated successfully', 'success');
                } catch (error) {
                    console.warn('reCAPTCHA v3 failed:', error);
                    updateRecaptchaStatus('Security verification failed', 'error');
                    // Continue without reCAPTCHA for development
                }
            } else {
                updateRecaptchaStatus('Security protection not available', 'warning');
            }
            
            // Show loading state
            const submitBtn = this.querySelector('.signin-btn');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.querySelector('span').textContent = 'Creating Account...';
            }
            
            try {
                // Perform user signup with PHP backend
                await performSignup({ firstName, lastName, email, password, contactNumber, testerTypeId, recaptchaToken });
            } catch (error) {
                console.error('User Signup error:', error);
            } finally {
                // Reset button state
                const submitBtn = this.querySelector('.signin-btn');
                if (submitBtn) {
                    submitBtn.classList.remove('loading');
                    submitBtn.querySelector('span').textContent = 'Create Account';
                }
            }
        });
    }

    // Forgot password form submission
    if (forgotForm) {
        forgotForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = forgotEmailInput.value.trim();
            
            // Clear previous errors
            clearError(forgotEmailInput);
            
            // Validate form
            if (!email) {
                showError(forgotEmailInput, 'Email is required');
                return;
            } else if (!validateEmail(email)) {
                showError(forgotEmailInput, 'Please enter a valid email address');
                return;
            }
            
            // Show loading state
            const submitBtn = this.querySelector('.signin-btn');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.querySelector('span').textContent = 'Sending Reset...';
            }
            
            try {
                // Perform user password reset with PHP backend
                await performPasswordReset(email);
            } catch (error) {
                console.error('User Password reset error:', error);
            } finally {
                // Reset button state
                const submitBtn = this.querySelector('.signin-btn');
                if (submitBtn) {
                    submitBtn.classList.remove('loading');
                    submitBtn.querySelector('span').textContent = 'Reset Password';
                }
            }
        });
    }

    // Real user login process with Node.js backend
    async function performUserLogin(email, password) {
        try {
            console.log('Attempting user login to Node.js API...');
            
            // Check if Auth is available
            if (typeof Auth === 'undefined') {
                throw new Error('Auth helper not found. Make sure api-config.js is loaded.');
            }
            
            // Use the Auth helper from api-config.js
            const data = await Auth.login(email, password);

            console.log('User login response data:', data);

            if (data.success) {
                // Store user data and JWT token (use consistent key names)
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('jwt_token', data.jwt_token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                localStorage.setItem('session_token', data.session.token);
                localStorage.setItem('sessionExpires', data.session.expires_at);
                
                showToast(`Welcome back, ${data.user.full_name || data.user.first_name}! Redirecting to User Dashboard...`, 'success');
                
                setTimeout(() => {
                    window.location.href = '/user-dashboard'; // Use Express route
                }, 1000);
            } else {
                // Show backend error message if present
                showToast(data.error || 'User login failed. Please try again.', 'error');
                if (data.details) {
                    console.error("Backend error details:", data.details);
                }
            }
        } catch (error) {
            console.error('User Login error:', error);
            // Provide more specific error messages
            if (error.message && error.message.includes('Failed to fetch')) {
                showToast('Cannot connect to server. Make sure the Node.js server is running on port 3000', 'error');
            } else {
                showToast(error.message || 'Network or server error during user login. Please try again.', 'error');
            }
        }
    }

    // Real signup process with Node.js backend
    async function performSignup({ firstName, lastName, email, password, contactNumber, testerTypeId, recaptchaToken }) {
        try {
            console.log('Attempting signup to Node.js API...');
            
            const userData = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                password: password,
                contact_number: contactNumber || null,
                tester_type_id: testerTypeId ? parseInt(testerTypeId, 10) : null,
                recaptcha_token: recaptchaToken
            };
            
            // Use the Auth helper from api-config.js
            const data = await Auth.register(userData);
            console.log('Signup response:', data);

            if (data.success) {
                showToast(`Account created successfully for ${data.user.full_name}! Please sign in.`, 'success');
                
                setTimeout(() => {
                    handleNavigation('login');
                }, 2000);
            } else {
                showToast(data.error || 'Registration failed. Please try again.', 'error');
                if (data.details) {
                    console.error("Backend error details:", data.details);
                }
            }
        } catch (error) {
            console.error('User Signup error:', error);
            
            if (error.message.includes('Failed to fetch')) {
                showToast('Cannot connect to server. Make sure the Node.js server is running on port 3000', 'error');
            } else if (error.message.includes('HTTP error')) {
                showToast('Server error. Please check if the backend is working.', 'error');
            } else {
                showToast(error.message || 'Network error. Please check your connection.', 'error');
            }
        }
    }

    // Real password reset with Node.js backend
    async function performPasswordReset(email) {
        try {
            console.log('Attempting password reset to Node.js API...');
            
            // Use the Auth helper from api-config.js
            const data = await Auth.forgotPassword(email);
            console.log('Password reset response:', data);

            if (data.success) {
                showToast(data.message, 'info');
                
                setTimeout(() => {
                    handleNavigation('login');
                }, 2000);
            } else {
                showToast(data.error || 'Password reset failed. Please try again.', 'error');
                if (data.details) {
                    console.error("Backend error details:", data.details);
                }
            }
        } catch (error) {
            console.error('User Password reset error:', error);
            
            if (error.message && error.message.includes('Failed to fetch')) {
                showToast('Cannot connect to server. Make sure the Node.js server is running on port 3000', 'error');
            } else if (error.message && error.message.includes('HTTP error')) {
                showToast('Server error. Please check if the backend is working.', 'error');
            } else {
                showToast(error.message || 'Network error. Please check your connection.', 'error');
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

        console.log('Showing toast:', message, 'Type:', type);
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

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Enter key to submit form
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            const form = e.target.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit'));
            }
        }
        
        // Escape key to clear form
        if (e.key === 'Escape') {
            resetForms();
        }
    });

    // Focus management
    if (emailInput) emailInput.focus();
    
    // Auto-focus password field when email is entered
    if (emailInput && passwordInput) {
        emailInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && this.value.trim()) {
                passwordInput.focus();
            }
        });
    }

    // Add some interactive effects
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

    // Initialize reCAPTCHA v3 status
    initializeRecaptcha();

    // Enhanced Password Validation Functions
    function validatePasswordRequirements(password) {
        const requirements = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };
        
        return requirements;
    }
    
    function updatePasswordStrength(password) {
        const requirements = validatePasswordRequirements(password);
        const strengthBar = document.getElementById('passwordStrengthBar');
        const strengthLabel = document.getElementById('passwordStrengthLabel');
        const requirementsList = document.getElementById('passwordRequirements');
        
        // Calculate strength score
        const score = Object.values(requirements).filter(Boolean).length;
        const percentage = (score / 5) * 100;
        
        // Update strength bar
        if (strengthBar) {
            strengthBar.style.width = percentage + '%';
            
            // Update color based on strength
            if (score <= 2) {
                strengthBar.style.background = '#ef4444'; // Red
            } else if (score <= 3) {
                strengthBar.style.background = '#f59e0b'; // Orange
            } else if (score <= 4) {
                strengthBar.style.background = '#3b82f6'; // Blue
            } else {
                strengthBar.style.background = '#10b981'; // Green
            }
        }
        
        // Update strength label
        if (strengthLabel) {
            if (score <= 2) {
                strengthLabel.textContent = 'Weak';
                strengthLabel.style.color = '#ef4444';
            } else if (score <= 3) {
                strengthLabel.textContent = 'Fair';
                strengthLabel.style.color = '#f59e0b';
            } else if (score <= 4) {
                strengthLabel.textContent = 'Good';
                strengthLabel.style.color = '#3b82f6';
            } else {
                strengthLabel.textContent = 'Strong';
                strengthLabel.style.color = '#10b981';
            }
        }
        
        // Update requirements checklist - remove met requirements
        if (requirementsList) {
            const items = requirementsList.querySelectorAll('li');
            const requirementKeys = ['length', 'upper', 'lower', 'number', 'special'];
            
            items.forEach((item, index) => {
                const key = requirementKeys[index];
                
                if (requirements[key]) {
                    // Requirement is met - remove it with animation
                    item.style.transform = 'translateX(-100%)';
                    item.style.opacity = '0';
                    setTimeout(() => {
                        if (item.parentNode) {
                            item.parentNode.removeChild(item);
                        }
                    }, 300);
                } else {
                    // Requirement not met - ensure it's visible
                    item.style.color = '#b0b0b0';
                    item.style.transform = 'translateX(0)';
                    item.style.opacity = '1';
                    item.innerHTML = item.innerHTML.replace('✓', '•');
                }
            });
        }
    }
    
    function showPasswordRequirements() {
        const requirementsDiv = document.getElementById('passwordRequirements');
        const strengthDiv = document.querySelector('.password-strength');
        
        if (requirementsDiv) {
            requirementsDiv.style.display = 'block';
            requirementsDiv.style.opacity = '1';
        }
        
        if (strengthDiv) {
            strengthDiv.style.display = 'block';
            strengthDiv.style.opacity = '1';
        }
    }
    
    function hidePasswordRequirements() {
        const requirementsDiv = document.getElementById('passwordRequirements');
        const strengthDiv = document.querySelector('.password-strength');
        
        if (requirementsDiv) {
            requirementsDiv.style.display = 'none';
            requirementsDiv.style.opacity = '0';
        }
        
        if (strengthDiv) {
            strengthDiv.style.display = 'none';
            strengthDiv.style.opacity = '0';
        }
    }
    
    function restorePasswordRequirements() {
        const requirementsDiv = document.getElementById('passwordRequirements');
        if (requirementsDiv) {
            // Restore the original requirements list
            requirementsDiv.innerHTML = `
                <ul style="list-style:none; padding-left:0; margin:0;">
                    <li id="req-length">• At least 8 characters</li>
                    <li id="req-upper">• One uppercase letter (A-Z)</li>
                    <li id="req-lower">• One lowercase letter (a-z)</li>
                    <li id="req-number">• One number (0-9)</li>
                    <li id="req-special">• One special character (!@#$%^&* etc.)</li>
                </ul>
            `;
        }
    }

    // Enhanced Password Validation Event Listeners
    function initializePasswordValidation() {
        const passwordInput = document.getElementById('signupPassword');
        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                const password = this.value;
                if (password.length > 0) {
                    showPasswordRequirements();
                    updatePasswordStrength(password);
                } else {
                    // Password field is empty - restore requirements and hide
                    restorePasswordRequirements();
                    hidePasswordRequirements();
                }
            });
            
            passwordInput.addEventListener('focus', function() {
                if (this.value.length > 0) {
                    showPasswordRequirements();
                    updatePasswordStrength(this.value);
                } else {
                    // Show requirements when focusing on empty field
                    restorePasswordRequirements();
                    showPasswordRequirements();
                }
            });
            
            passwordInput.addEventListener('blur', function() {
                // Keep requirements visible if password has content
                if (this.value.length === 0) {
                    hidePasswordRequirements();
                }
            });
        }
    }

    // Initialize password validation
    initializePasswordValidation();

    console.log('User Authentication app initialized successfully');
}); 