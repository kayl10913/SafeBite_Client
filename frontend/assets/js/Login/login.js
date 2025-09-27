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
    let otpData = {
        email: '',
        otp: '',
        resetToken: ''
    };
    let otpTimer = null;
    let otpCountdown = 60;
    
    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const forgotForm = document.getElementById('forgotForm');
    const otpForm = document.getElementById('otpForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    
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
    const sendSignupOtpBtn = document.getElementById('sendSignupOtpBtn');
    const verifySignupOtpBtn = document.getElementById('verifySignupOtpBtn');
    const signupEmailOtpInput = document.getElementById('signupEmailOtp');
    const signupEmailVerifyStatus = document.getElementById('signupEmailVerifyStatus');
    let isSignupEmailVerified = false;
    const signupPasswordInput = document.getElementById('signupPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const toggleSignupPasswordBtn = document.getElementById('toggleSignupPassword');
    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');
    
    // Forgot password form elements
    const forgotEmailInput = document.getElementById('forgotEmail');
    
    // OTP form elements
    const otpCodeInput = document.getElementById('otpCode');
    const otpEmailDisplay = document.getElementById('otpEmailDisplay');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const otpTimerDisplay = document.getElementById('otpTimer');
    
    // Reset password form elements
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const toggleNewPasswordBtn = document.getElementById('toggleNewPassword');
    const toggleConfirmNewPasswordBtn = document.getElementById('toggleConfirmNewPassword');
    
    // View elements
    const loginView = document.getElementById('loginView');
    const signupView = document.getElementById('signupView');
    const forgotView = document.getElementById('forgotView');
    const otpView = document.getElementById('otpView');
    const resetPasswordView = document.getElementById('resetPasswordView');
    
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
        if (currentViewElement) {
            currentViewElement.classList.add('slide-out');
        }
        
        setTimeout(() => {
            // Remove active class from all views
            document.querySelectorAll('.auth-view').forEach(viewElement => {
                viewElement.classList.remove('active');
            });
            
            // Show new view
            const newViewElement = document.getElementById(view + 'View');
            if (newViewElement) {
                newViewElement.classList.add('active', 'slide-in');
            }
            
            // Update current view
            currentView = view;
            
            // Handle view-specific logic
            if (view === 'otp') {
                updateOTPEmailDisplay();
            }
            
            // Reset forms when switching views (except when going to OTP or resetPassword)
            if (view !== 'otp' && view !== 'resetPassword') {
                resetForms();
            }
            
            // Focus on first input of new view
            setTimeout(() => {
                const firstInput = newViewElement ? newViewElement.querySelector('input') : null;
                if (firstInput) firstInput.focus();
            }, 100);
            
        }, 300);
    };

    // Reset all forms
    function resetForms() {
        loginForm.reset();
        signupForm.reset();
        forgotForm.reset();
        if (otpForm) otpForm.reset();
        if (resetPasswordForm) resetPasswordForm.reset();
        
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

        // Reset OTP data
        otpData = {
            email: '',
            otp: '',
            resetToken: ''
        };

        // Clear OTP timer
        if (otpTimer) {
            clearInterval(otpTimer);
            otpTimer = null;
        }
        otpCountdown = 60;
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
            if (!isSignupEmailVerified) {
                ok = false;
                if (signupEmailVerifyStatus) {
                    signupEmailVerifyStatus.textContent = 'Please verify your email to continue';
                    signupEmailVerifyStatus.style.color = '#f97316';
                }
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

    // Signup email verification handlers
    async function sendSignupVerificationCode() {
        try {
            const email = signupEmailInput.value.trim();
            if (!email || !validateEmail(email)) {
                showError(signupEmailInput, 'Enter a valid email first');
                return;
            }
            isSignupEmailVerified = false;
            if (signupEmailVerifyStatus) {
                signupEmailVerifyStatus.textContent = 'Sending verification code...';
                signupEmailVerifyStatus.style.color = '#93c5fd';
            }
            const resp = await makeApiRequest(API_CONFIG.ENDPOINTS.AUTH.SEND_SIGNUP_OTP, {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            showToast(resp.message || 'Verification code sent', 'success');
            if (signupEmailVerifyStatus) {
                signupEmailVerifyStatus.textContent = 'Code sent. Check your email.';
                signupEmailVerifyStatus.style.color = '#10b981';
            }
        } catch (e) {
            showToast(e.message || 'Failed to send verification code', 'error');
            if (signupEmailVerifyStatus) {
                signupEmailVerifyStatus.textContent = 'Failed to send code. Try again';
                signupEmailVerifyStatus.style.color = '#ef4444';
            }
        }
    }

    async function verifySignupCode() {
        try {
            const email = signupEmailInput.value.trim();
            const otp = (signupEmailOtpInput ? signupEmailOtpInput.value.trim() : '').replace(/\D/g, '');
            if (!email || !validateEmail(email)) {
                showError(signupEmailInput, 'Enter a valid email first');
                return;
            }
            if (!/^\d{6}$/.test(otp)) {
                showError(signupEmailOtpInput, 'Enter the 6-digit code');
                return;
            }
            if (signupEmailVerifyStatus) {
                signupEmailVerifyStatus.textContent = 'Verifying code...';
                signupEmailVerifyStatus.style.color = '#93c5fd';
            }
            const resp = await makeApiRequest(API_CONFIG.ENDPOINTS.AUTH.VERIFY_SIGNUP_OTP, {
                method: 'POST',
                body: JSON.stringify({ email, otp })
            });
            if (resp.success) {
                isSignupEmailVerified = true;
                if (signupEmailVerifyStatus) {
                    signupEmailVerifyStatus.textContent = 'Email verified ✓';
                    signupEmailVerifyStatus.style.color = '#10b981';
                }
                if (sendSignupOtpBtn) sendSignupOtpBtn.disabled = true;
                if (verifySignupOtpBtn) verifySignupOtpBtn.disabled = true;
                if (signupEmailOtpInput) signupEmailOtpInput.disabled = true;
            } else {
                showToast(resp.message || 'Invalid code', 'error');
                if (signupEmailVerifyStatus) {
                    signupEmailVerifyStatus.textContent = resp.message || 'Invalid code';
                    signupEmailVerifyStatus.style.color = '#ef4444';
                }
            }
        } catch (e) {
            showToast(e.message || 'Verification failed', 'error');
            if (signupEmailVerifyStatus) {
                signupEmailVerifyStatus.textContent = 'Verification failed';
                signupEmailVerifyStatus.style.color = '#ef4444';
            }
        }
    }

    if (sendSignupOtpBtn) {
        sendSignupOtpBtn.addEventListener('click', async function() {
            await sendSignupVerificationCode();
            if (signupEmailOtpInput) signupEmailOtpInput.focus();
        });
    }
    if (verifySignupOtpBtn) {
        verifySignupOtpBtn.addEventListener('click', verifySignupCode);
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
    if (toggleNewPasswordBtn) {
        setupPasswordToggle('toggleNewPassword', 'newPassword');
    }
    if (toggleConfirmNewPasswordBtn) {
        setupPasswordToggle('toggleConfirmNewPassword', 'confirmNewPassword');
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

    function validateOTP(otp) {
        return /^\d{6}$/.test(otp);
    }

    // OTP Timer functionality
    function startOTPTimer() {
        otpCountdown = 60;
        if (otpTimerDisplay) {
            otpTimerDisplay.textContent = otpCountdown;
        }
        
        if (resendOtpBtn) {
            resendOtpBtn.disabled = true;
            resendOtpBtn.classList.add('disabled');
        }

        otpTimer = setInterval(() => {
            otpCountdown--;
            if (otpTimerDisplay) {
                otpTimerDisplay.textContent = otpCountdown;
            }

            if (otpCountdown <= 0) {
                clearInterval(otpTimer);
                otpTimer = null;
                if (resendOtpBtn) {
                    resendOtpBtn.disabled = false;
                    resendOtpBtn.classList.remove('disabled');
                }
            }
        }, 1000);
    }

    function stopOTPTimer() {
        if (otpTimer) {
            clearInterval(otpTimer);
            otpTimer = null;
        }
        if (resendOtpBtn) {
            resendOtpBtn.disabled = false;
            resendOtpBtn.classList.remove('disabled');
        }
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

    // OTP input formatting
    if (otpCodeInput) {
        otpCodeInput.addEventListener('input', function() {
            // Only allow numbers
            this.value = this.value.replace(/[^0-9]/g, '');
            
            // Auto-focus next input if 6 digits entered
            if (this.value.length === 6) {
                this.blur();
            }
        });

        otpCodeInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
            this.value = pastedData.substring(0, 6);
        });
    }

    // Update OTP email display when navigating to OTP view
    function updateOTPEmailDisplay() {
        if (otpEmailDisplay && otpData.email) {
            otpEmailDisplay.textContent = otpData.email;
        }
    }

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
                submitBtn.querySelector('span').textContent = 'Sending OTP...';
            }
            
            try {
                // Perform user password reset with Node.js backend
                await performPasswordReset(email);
            } catch (error) {
                console.error('User Password reset error:', error);
            } finally {
                // Reset button state
                const submitBtn = this.querySelector('.signin-btn');
                if (submitBtn) {
                    submitBtn.classList.remove('loading');
                    submitBtn.querySelector('span').textContent = 'Send OTP';
                }
            }
        });
    }

    // OTP form submission
    if (otpForm) {
        otpForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const otp = otpCodeInput.value.trim();
            
            // Clear previous errors
            clearError(otpCodeInput);
            
            // Validate form
            if (!otp) {
                showError(otpCodeInput, 'OTP is required');
                return;
            } else if (!validateOTP(otp)) {
                showError(otpCodeInput, 'Please enter a valid 6-digit OTP');
                return;
            }
            
            // Show loading state
            const submitBtn = this.querySelector('.signin-btn');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.querySelector('span').textContent = 'Verifying...';
            }
            
            try {
                // Verify OTP
                await verifyOTP(otpData.email, otp);
            } catch (error) {
                console.error('OTP verification error:', error);
            } finally {
                // Reset button state
                const submitBtn = this.querySelector('.signin-btn');
                if (submitBtn) {
                    submitBtn.classList.remove('loading');
                    submitBtn.querySelector('span').textContent = 'Verify OTP';
                }
            }
        });
    }

    // Reset password form submission
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmNewPasswordInput.value;
            
            // Clear previous errors
            clearError(newPasswordInput);
            clearError(confirmNewPasswordInput);
            
            // Validate form
            if (!newPassword) {
                showError(newPasswordInput, 'New password is required');
                return;
            }
            
            // Check if all password requirements are met
            const hasLength = newPassword.length >= 8;
            const hasUpper = /[A-Z]/.test(newPassword);
            const hasLower = /[a-z]/.test(newPassword);
            const hasNumber = /[0-9]/.test(newPassword);
            const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
            
            if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
                showError(newPasswordInput, 'Password must meet all requirements');
                return;
            }
            
            if (!confirmPassword) {
                showError(confirmNewPasswordInput, 'Please confirm your password');
                return;
            } else if (newPassword !== confirmPassword) {
                showError(confirmNewPasswordInput, 'Passwords do not match');
                return;
            }
            
            // Show loading state
            const submitBtn = this.querySelector('.signin-btn');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.querySelector('span').textContent = 'Resetting...';
            }
            
            try {
                // Reset password
                await resetPassword(otpData.email, otpData.otp, otpData.resetToken, newPassword, confirmPassword);
            } catch (error) {
                console.error('Password reset error:', error);
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
            console.log('Attempting secure user login...');
            
            // Check if SecureAuth is available
            if (typeof SecureAuth === 'undefined') {
                throw new Error('SecureAuth helper not found. Make sure secure-auth.js is loaded.');
            }
            
            // Use the SecureAuth helper for secure cookie-based authentication
            const data = await SecureAuth.login(email, password);

            console.log('User login response data:', data);

            if (data.success) {
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
                // Store email for OTP verification
                otpData.email = email;
                
                // Show OTP in console for development (remove in production)
                if (data.otp) {
                    console.log('OTP for development:', data.otp);
                }
                
                showToast(data.message, 'success');
                
                // Navigate to OTP verification view
                setTimeout(() => {
                    handleNavigation('otp');
                    startOTPTimer();
                }, 1000);
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

    // Verify OTP with Node.js backend
    async function verifyOTP(email, otp) {
        try {
            console.log('Attempting OTP verification to Node.js API...');
            
            const response = await fetch('/api/users/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, otp })
            });

            const data = await response.json();
            console.log('OTP verification response:', data);

            if (data.success) {
                // Store OTP and reset token
                otpData.otp = otp;
                otpData.resetToken = data.reset_token;
                
                showToast(data.message, 'success');
                
                // Stop OTP timer
                stopOTPTimer();
                
                // Navigate to reset password view
                setTimeout(() => {
                    handleNavigation('resetPassword');
                }, 1000);
            } else {
                showToast(data.message || 'OTP verification failed. Please try again.', 'error');
                // Show error state on OTP inputs
                if (typeof window.showOTPError === 'function') {
                    window.showOTPError();
                }
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            
            if (error.message && error.message.includes('Failed to fetch')) {
                showToast('Cannot connect to server. Make sure the Node.js server is running on port 3000', 'error');
            } else {
                showToast(error.message || 'Network error. Please check your connection.', 'error');
            }
            // Show error state on OTP inputs
            if (typeof window.showOTPError === 'function') {
                window.showOTPError();
            }
        }
    }

    // Reset password with Node.js backend
    async function resetPassword(email, otp, resetToken, newPassword, confirmPassword) {
        try {
            console.log('Attempting password reset to Node.js API...');
            
            const response = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    email, 
                    otp, 
                    reset_token: resetToken, 
                    new_password: newPassword, 
                    confirm_password: confirmPassword 
                })
            });

            const data = await response.json();
            console.log('Password reset response:', data);

            if (data.success) {
                showToast(data.message, 'success');
                
                // Navigate back to login
                setTimeout(() => {
                    handleNavigation('login');
                }, 2000);
            } else {
                showToast(data.message || 'Password reset failed. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            
            if (error.message && error.message.includes('Failed to fetch')) {
                showToast('Cannot connect to server. Make sure the Node.js server is running on port 3000', 'error');
            } else {
                showToast(error.message || 'Network error. Please check your connection.', 'error');
            }
        }
    }

    // Resend OTP functionality
    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', async function() {
            if (this.disabled) return;
            
            this.classList.add('loading');
            this.querySelector('span').textContent = 'Resending...';
            
            try {
                const response = await fetch('/api/users/resend-otp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: otpData.email })
                });

                const data = await response.json();
                console.log('Resend OTP response:', data);

                if (data.success) {
                    showToast(data.message, 'success');
                    
                    // Show OTP in console for development (remove in production)
                    if (data.otp) {
                        console.log('New OTP for development:', data.otp);
                    }
                    
                    // Restart timer
                    startOTPTimer();
                } else {
                    showToast(data.message || 'Failed to resend OTP. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Resend OTP error:', error);
                showToast('Network error. Please check your connection.', 'error');
            } finally {
                this.classList.remove('loading');
                this.querySelector('span').textContent = 'Resend OTP';
            }
        });
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

    // Enhanced Modal System for Terms and Privacy Policy
    let modalState = {
        termsRead: false,
        privacyRead: false,
        currentStep: 1
    };

    // Enhanced modal opening with animations
    window.openTermsModal = function() {
        const modal = document.getElementById('termsModal');
        modal.style.display = 'block';
        modal.classList.add('modal-opening');
        
        // Reset scroll position
        modal.querySelector('.modal-content').scrollTop = 0;
        
        // Add body scroll lock
        document.body.style.overflow = 'hidden';
        
        // Focus management
        setTimeout(() => {
            modal.querySelector('.understand-btn').focus();
        }, 300);
    };
    
    window.closeTermsModal = function() {
        const modal = document.getElementById('termsModal');
        modal.classList.add('modal-closing');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('modal-opening', 'modal-closing');
            document.body.style.overflow = 'auto';
        }, 300);
    };
    
    window.openPrivacyModal = function() {
        const modal = document.getElementById('privacyModal');
        modal.style.display = 'block';
        modal.classList.add('modal-opening');
        
        // Reset scroll position
        modal.querySelector('.modal-content').scrollTop = 0;
        
        // Add body scroll lock
        document.body.style.overflow = 'hidden';
        
        // Focus management
        setTimeout(() => {
            modal.querySelector('.understand-btn').focus();
        }, 300);
    };
    
    window.closePrivacyModal = function() {
        const modal = document.getElementById('privacyModal');
        modal.classList.add('modal-closing');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('modal-opening', 'modal-closing');
            document.body.style.overflow = 'auto';
        }, 300);
    };
    
    // Enhanced acceptance functions with validation
    window.acceptTerms = function() {
        // Mark as read
        modalState.termsRead = true;
        
        // Update the terms text to show accepted status
        const termsText = document.querySelector('.terms-privacy-container:first-of-type .terms-text');
        if (termsText) {
            termsText.innerHTML = '✓ I have read and agree to the <a href="#" onclick="openTermsModal()" class="terms-link">Terms and Conditions</a>';
            termsText.classList.add('terms-accepted');
        }
        
        // Close the modal
        closeTermsModal();
        
        // Show success notification
        showEnhancedToast('Terms and Conditions accepted ✓', 'success');
        
        // Update form validation
        validateModalForm();
        
        // Track progress
        updateModalProgress();
    };
    
    window.acceptPrivacy = function() {
        // Mark as read
        modalState.privacyRead = true;
        
        // Update the privacy text to show accepted status
        const privacyText = document.querySelector('.terms-privacy-container:last-of-type .terms-text');
        if (privacyText) {
            privacyText.innerHTML = '✓ I have read and agree to the <a href="#" onclick="openPrivacyModal()" class="terms-link">Privacy Policy</a>';
            privacyText.classList.add('terms-accepted');
        }
        
        // Close the modal
        closePrivacyModal();
        
        // Show success notification
        showEnhancedToast('Privacy Policy accepted ✓', 'success');
        
        // Update form validation
        validateModalForm();
        
        // Track progress
        updateModalProgress();
    };
    
    // Enhanced form validation for modals
    function validateModalForm() {
        const termsAccepted = modalState.termsRead;
        const privacyAccepted = modalState.privacyRead;
        const submitBtn = document.getElementById('signupSubmitBtn');
        
        if (termsAccepted && privacyAccepted) {
            // Enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.add('btn-enabled');
                submitBtn.classList.remove('btn-disabled');
            }
            return true;
        } else {
            // Disable submit button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('btn-disabled');
                submitBtn.classList.remove('btn-enabled');
            }
            return false;
        }
    }
    
    // Progress tracking for modals
    function updateModalProgress() {
        const progress = document.querySelector('.progress-indicator');
        const progressText = document.querySelector('.progress-text');
        
        if (progress && progressText) {
            const total = 2;
            const completed = (modalState.termsRead ? 1 : 0) + (modalState.privacyRead ? 1 : 0);
            const percentage = (completed / total) * 100;
            
            progress.style.width = percentage + '%';
            progressText.textContent = `${completed}/${total} agreements accepted`;
            
            // Add shimmer effect when progress changes
            if (completed > 0) {
                progress.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
            }
        }
    }
    
    // Enhanced click-outside-to-close with animation
    window.addEventListener('click', function(event) {
        const termsModal = document.getElementById('termsModal');
        const privacyModal = document.getElementById('privacyModal');
        
        if (event.target === termsModal) {
            closeTermsModal();
        }
        if (event.target === privacyModal) {
            closePrivacyModal();
        }
    });
    
    // Keyboard navigation support for modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const termsModal = document.getElementById('termsModal');
            const privacyModal = document.getElementById('privacyModal');
            
            if (termsModal && termsModal.style.display === 'block') {
                closeTermsModal();
            }
            if (privacyModal && privacyModal.style.display === 'block') {
                closePrivacyModal();
            }
        }
    });
    
    // Enhanced toast notification system for modals
    function showEnhancedToast(message, type = 'info', duration = 3000) {
        const toaster = document.getElementById('toaster');
        if (!toaster) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Add icon based on type
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
        
        toaster.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toaster.contains(toast)) {
                    toaster.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
    
    // Form submission validation for modals
    window.validateModalSubmission = function() {
        const termsAccepted = modalState.termsRead;
        const privacyAccepted = modalState.privacyRead;
        
        if (!termsAccepted || !privacyAccepted) {
            showEnhancedToast('Please read and accept both Terms and Conditions and Privacy Policy to continue', 'error', 5000);
            return false;
        }
        
        return true;
    };
    
    // Reset functionality when switching views
    window.resetAgreements = function() {
        modalState.termsRead = false;
        modalState.privacyRead = false;
        
        // Reset terms text
        const termsText = document.querySelector('.terms-privacy-container:first-of-type .terms-text');
        if (termsText) {
            termsText.innerHTML = 'I agree to the <a href="#" onclick="openTermsModal()" class="terms-link">Terms and Conditions</a>';
            termsText.classList.remove('terms-accepted');
        }
        
        // Reset privacy text
        const privacyText = document.querySelector('.terms-privacy-container:last-of-type .terms-text');
        if (privacyText) {
            privacyText.innerHTML = 'I agree to the <a href="#" onclick="openPrivacyModal()" class="terms-link">Privacy Policy</a>';
            privacyText.classList.remove('terms-accepted');
        }
        
        // Reset submit button
        const submitBtn = document.getElementById('signupSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('btn-disabled');
            submitBtn.classList.remove('btn-enabled');
        }
        
        // Reset progress
        updateModalProgress();
    };
    
    // Enhanced form submission handler for modals
    window.handleModalFormSubmission = function(event) {
        if (!validateModalSubmission()) {
            event.preventDefault();
            return false;
        }
        
        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        }
        
        return true;
    };

    // Initialize modal system
    function initializeModalSystem() {
        validateModalForm();
        updateModalProgress();
    }

    // Initialize modal system
    initializeModalSystem();

    // ENHANCED OTP AND PASSWORD FUNCTIONALITY

    // Enhanced OTP input formatting with individual boxes
    function setupOTPInput() {
        const otpInputs = document.querySelectorAll('.otp-digit');
        const hiddenInput = document.getElementById('otpCode');
        
        if (otpInputs.length > 0) {
            // Focus first input on load
            otpInputs[0].focus();
            
            otpInputs.forEach((input, index) => {
                // Handle input
                input.addEventListener('input', function(e) {
                    // Only allow numbers
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    
                    // Add filled class
                    if (e.target.value) {
                        e.target.classList.add('filled');
                        e.target.classList.remove('error');
                    } else {
                        e.target.classList.remove('filled');
                    }
                    
                    // Move to next input if current is filled
                    if (e.target.value && index < otpInputs.length - 1) {
                        otpInputs[index + 1].focus();
                    }
                    
                    // Update hidden input
                    updateHiddenOTP();
                });
                
                // Handle backspace
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        otpInputs[index - 1].focus();
                    }
                });
                
                // Handle paste
                input.addEventListener('paste', function(e) {
                    e.preventDefault();
                    const paste = (e.clipboardData || window.clipboardData).getData('text');
                    const numbers = paste.replace(/[^0-9]/g, '').slice(0, 6);
                    
                    // Fill all inputs with pasted numbers
                    numbers.split('').forEach((digit, i) => {
                        if (otpInputs[i]) {
                            otpInputs[i].value = digit;
                            otpInputs[i].classList.add('filled');
                            otpInputs[i].classList.remove('error');
                        }
                    });
                    
                    // Focus the next empty input or the last one
                    const nextEmptyIndex = Math.min(numbers.length, otpInputs.length - 1);
                    otpInputs[nextEmptyIndex].focus();
                    
                    updateHiddenOTP();
                });
                
                // Handle focus
                input.addEventListener('focus', function() {
                    this.select();
                });
            });
        }
        
        function updateHiddenOTP() {
            const otpValue = Array.from(otpInputs).map(input => input.value).join('');
            if (hiddenInput) {
                hiddenInput.value = otpValue;
            }
        }
        
        // Function to show error state on OTP inputs
        window.showOTPError = function() {
            otpInputs.forEach(input => {
                input.classList.add('error');
                input.classList.remove('filled');
            });
            
            // Clear all inputs and focus first one
            setTimeout(() => {
                otpInputs.forEach(input => {
                    input.value = '';
                    input.classList.remove('error');
                });
                otpInputs[0].focus();
                updateHiddenOTP();
            }, 2000);
        };
        
        // Function to clear OTP inputs
        window.clearOTPInputs = function() {
            otpInputs.forEach(input => {
                input.value = '';
                input.classList.remove('filled', 'error');
            });
            updateHiddenOTP();
        };

        // Signup Email Verification OTP (6 individual boxes)
        const signupOtpInputs = document.querySelectorAll('.signup-otp-digit');
        const signupHiddenInput = document.getElementById('signupEmailOtp');
        if (signupOtpInputs.length > 0 && signupHiddenInput) {
            signupOtpInputs[0].focus();
            signupOtpInputs.forEach((input, index) => {
                input.addEventListener('input', function(e) {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    if (e.target.value) {
                        e.target.classList.add('filled');
                        e.target.classList.remove('error');
                    } else {
                        e.target.classList.remove('filled');
                    }
                    if (e.target.value && index < signupOtpInputs.length - 1) {
                        signupOtpInputs[index + 1].focus();
                    }
                    updateSignupHidden();
                });
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        signupOtpInputs[index - 1].focus();
                    }
                });
                input.addEventListener('paste', function(e) {
                    e.preventDefault();
                    const paste = (e.clipboardData || window.clipboardData).getData('text');
                    const numbers = paste.replace(/[^0-9]/g, '').slice(0, 6);
                    numbers.split('').forEach((digit, i) => {
                        if (signupOtpInputs[i]) {
                            signupOtpInputs[i].value = digit;
                            signupOtpInputs[i].classList.add('filled');
                            signupOtpInputs[i].classList.remove('error');
                        }
                    });
                    const nextEmptyIndex = Math.min(numbers.length, signupOtpInputs.length - 1);
                    signupOtpInputs[nextEmptyIndex].focus();
                    updateSignupHidden();
                });
                input.addEventListener('focus', function() { this.select(); });
            });

            function updateSignupHidden() {
                const val = Array.from(signupOtpInputs).map(i => i.value).join('');
                signupHiddenInput.value = val;
            }
        }
    }

    // Password strength indicator
    function setupPasswordStrength() {
        // Setup for signup password
        const signupPasswordInput = document.getElementById('signupPassword');
        const signupStrengthLabel = document.getElementById('passwordStrengthLabel');
        const signupStrengthBar = document.getElementById('passwordStrengthBar');
        
        if (signupPasswordInput && signupStrengthLabel && signupStrengthBar) {
            signupPasswordInput.addEventListener('input', function() {
                updatePasswordStrength(this.value, signupStrengthLabel, signupStrengthBar, 'signup');
            });
        }
        
        // Setup for reset password
        const newPasswordInput = document.getElementById('newPassword');
        const newStrengthLabel = document.getElementById('newPasswordStrengthLabel');
        const newStrengthBar = document.getElementById('newPasswordStrengthBar');
        
        if (newPasswordInput && newStrengthLabel && newStrengthBar) {
            newPasswordInput.addEventListener('input', function() {
                updatePasswordStrength(this.value, newStrengthLabel, newStrengthBar, 'reset');
            });
        }
    }
    
    // Update password strength display
    function updatePasswordStrength(password, strengthLabel, strengthBar, type) {
        const strength = calculatePasswordStrength(password);
        
        // Update strength bar
        strengthBar.style.width = strength.percentage + '%';
        strengthBar.style.backgroundColor = strength.color;
        
        // Update strength label
        strengthLabel.textContent = strength.text;
        strengthLabel.style.color = strength.color;
        
        // Update requirements checklist
        updatePasswordRequirements(password, type);
    }
    
    // Update password requirements checklist
    function updatePasswordRequirements(password, type) {
        const prefix = type === 'signup' ? '' : 'new-';
        
        const lengthReq = document.getElementById(prefix + 'req-length');
        const upperReq = document.getElementById(prefix + 'req-upper');
        const lowerReq = document.getElementById(prefix + 'req-lower');
        const numberReq = document.getElementById(prefix + 'req-number');
        const specialReq = document.getElementById(prefix + 'req-special');
        
        // Check each requirement
        const hasLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^a-zA-Z0-9]/.test(password);
        
        // Update visual state
        updateRequirementItem(lengthReq, hasLength);
        updateRequirementItem(upperReq, hasUpper);
        updateRequirementItem(lowerReq, hasLower);
        updateRequirementItem(numberReq, hasNumber);
        updateRequirementItem(specialReq, hasSpecial);
        
        // Check if all requirements are met
        const allRequirementsMet = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
        
        // Update submit button state
        updateSubmitButtonState(allRequirementsMet, type);
        
        return allRequirementsMet;
    }
    
    // Update submit button state based on password requirements
    function updateSubmitButtonState(requirementsMet, type) {
        let submitButton;
        
        if (type === 'signup') {
            submitButton = document.querySelector('#signupForm .signin-btn');
        } else if (type === 'reset') {
            submitButton = document.querySelector('#resetPasswordForm .signin-btn');
        }
        
        if (submitButton) {
            if (requirementsMet) {
                submitButton.disabled = false;
                submitButton.style.opacity = '1';
                submitButton.style.cursor = 'pointer';
            } else {
                submitButton.disabled = true;
                submitButton.style.opacity = '0.6';
                submitButton.style.cursor = 'not-allowed';
            }
        }
    }
    
    // Update individual requirement item
    function updateRequirementItem(element, isValid) {
        if (element) {
            if (isValid) {
                element.style.color = '#27ae60';
                element.innerHTML = element.innerHTML.replace('•', '✓');
            } else {
                element.style.color = '#b0b0b0';
                element.innerHTML = element.innerHTML.replace('✓', '•');
            }
        }
    }

    // Calculate password strength
    function calculatePasswordStrength(password) {
        let score = 0;

        // Length requirements
        if (password.length >= 8) score += 20;
        if (password.length >= 12) score += 10;
        
        // Character type requirements
        if (password.match(/[a-z]/)) score += 15; // lowercase
        if (password.match(/[A-Z]/)) score += 15; // uppercase
        if (password.match(/[0-9]/)) score += 15; // numbers
        if (password.match(/[^a-zA-Z0-9]/)) score += 15; // special characters
        
        // Bonus for very long passwords
        if (password.length >= 16) score += 10;

        let strength = 'Very Weak';
        let color = '#e74c3c';

        if (score >= 80) {
            strength = 'Very Strong';
            color = '#27ae60';
        } else if (score >= 60) {
            strength = 'Strong';
            color = '#2ecc71';
        } else if (score >= 40) {
            strength = 'Medium';
            color = '#f39c12';
        } else if (score >= 20) {
            strength = 'Weak';
            color = '#e67e22';
        }

        return {
            percentage: Math.min(score, 100),
            text: strength,
            color: color
        };
    }

    // Enhanced resend button functionality
    function setupResendButton() {
        const resendBtn = document.getElementById('resendOtpBtn');
        if (resendBtn) {
            resendBtn.addEventListener('click', function() {
                if (!this.disabled) {
                    // Add loading state
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Resending...</span>';
                    this.disabled = true;
                    
                    // Re-enable after a short delay (the actual resend will be handled by the existing resend logic)
                    setTimeout(() => {
                        this.innerHTML = '<i class="fas fa-redo"></i><span>Resend Code</span>';
                        this.disabled = false;
                    }, 2000);
                }
            });
        }
    }

    // Initialize enhanced functionality
    setupOTPInput();
    setupPasswordStrength();
    setupResendButton();
    
    // Initialize submit buttons as disabled
    function initializeSubmitButtons() {
        // Initialize reset password submit button as disabled
        const resetSubmitBtn = document.querySelector('#resetPasswordForm .signin-btn');
        if (resetSubmitBtn) {
            resetSubmitBtn.disabled = true;
            resetSubmitBtn.style.opacity = '0.6';
            resetSubmitBtn.style.cursor = 'not-allowed';
        }
        
        // Initialize ONLY the final signup submit button as disabled (do not affect verification buttons)
        const signupSubmitBtn = document.getElementById('signupSubmitBtn');
        if (signupSubmitBtn) {
            signupSubmitBtn.disabled = true;
            signupSubmitBtn.style.opacity = '0.6';
            signupSubmitBtn.style.cursor = 'not-allowed';
        }
    }
    
    initializeSubmitButtons();

    console.log('User Authentication app initialized successfully');
}); 