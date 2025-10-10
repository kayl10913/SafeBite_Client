## SafeBite Frontend

A static frontend for the SafeBite system. It provides user and admin authentication flows, a multi-step signup experience with progressive disclosure, reCAPTCHA v3 protection, and cohesive UI styling.

### Tech Stack
- HTML5, CSS3
- Vanilla JavaScript (modularized per feature)
- Font Awesome (icons)
- Google reCAPTCHA v3

### Project Structure
```
SafeBite_Client/
  index.html
  pages/
    Login.html
    Admin-Login.html
    User-Dashboard.html
    ad-dashboard.html
  assets/
    css/
      Login-assets/
        login.css
      Admin-assets/
        ... (admin CSS files)
      User-assets/
        ... (user CSS files)
    js/
      Login/
        login.js           # Auth flows, modals, password strength, progress, toasts
        admin-login.js
      config/
        api-config.js      # API helper (Auth.*), base URLs
        navigation.js      # SPA-like view helpers
      User/
        ... (user dashboards and analytics)
    images/
      ... (static assets)
```

### Key Features
- Authentication UI for users and admins
- Signup stepper (Basic → Details → Security)
- Terms & Privacy modals with “I Understand” acknowledgment
- Progressive disclosure of agreements with visual progress
- Password strength meter and live requirements checklist (items disappear when met)
- reCAPTCHA v3 status indicator with live icon/state updates
- Toast notifications (success, error, info)

### Getting Started
1) Open the site directly as static files (recommended during development):
- Open `SafeBite_Client/index.html` in a browser, or
- Use a lightweight static server to avoid CORS issues:
  - Node: `npx http-server .` (run from `SafeBite_Client/`)
  - Python: `python -m http.server 8080`

2) Configure API endpoints:
- Update `assets/js/config/api-config.js` to match your backend base URL(s) and tokens.

3) reCAPTCHA v3:
- `Login.html` loads reCAPTCHA via a site key. Replace the key with your own in the script tag query string if needed.

### Development Notes
- Most interactivity is implemented in `assets/js/Login/login.js`.
  - Modal functions are globally exposed (via `window.*`) so `Login.html` can invoke them.
  - Password UI logic is automatically initialized on DOMContentLoaded.
- Styling guidelines:
  - Consistent brand colors (blue gradient) across components
  - Glass-morphism effects for cards and modals
  - Responsive breakpoints are defined in `assets/css/responsive-sizes/`

### Common Tasks
- Change API base URL:
  - Edit `assets/js/config/api-config.js`
- Adjust password rules/labels:
  - Edit functions in `assets/js/Login/login.js` (`validatePasswordRequirements`, `updatePasswordStrength`)
- Update Terms/Privacy text:
  - Edit modal content in `pages/Login.html`
- Tweak modal look-and-feel:
  - Edit `assets/css/Login-assets/login.css` (modal, buttons, toasts, progress)

### Troubleshooting
- reCAPTCHA status shows error:
  - Ensure network access to Google, verify the site key, and that `grecaptcha.ready()` is called.
- Submit button disabled on signup:
  - Both Terms and Privacy must be accepted (via modals) on step 3.
- Password requirements not showing:
  - Ensure `#signupPassword` exists in the Security step and `login.js` is loaded after the page content.

### Contributing
- Keep JS logic in feature-specific files (avoid inline scripts where possible).
- Match existing naming conventions and formatting in CSS/JS.
- Prefer small, focused commits with clear messages.

### License
Proprietary – SafeBite Capstone.


