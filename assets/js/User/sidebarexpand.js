// Sidebar expand/collapse functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarLogo = document.getElementById('sidebarLogo');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    // Check if we're on mobile (768px and below)
    function isMobile() {
        return window.innerWidth <= 768;
    }
    
    // Toggle sidebar on desktop
    function toggleSidebar() {
        if (sidebar.classList.contains('expanded')) {
            sidebar.classList.remove('expanded');
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('expanded');
        }
    }
    
    // Toggle mobile menu
    function toggleMobileMenu() {
        const isOpen = sidebar.classList.contains('mobile-open');
        
        if (isOpen) {
            // Close mobile menu
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
            hamburgerMenu.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            // Open mobile menu
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('active');
            hamburgerMenu.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    // Handle sidebar logo click
    if (sidebarLogo) {
        sidebarLogo.addEventListener('click', function() {
            if (isMobile()) {
                toggleMobileMenu();
            } else {
                toggleSidebar();
            }
        });
    }
    
    // Handle hamburger menu click
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleMobileMenu();
        });
    }
    
    // Handle overlay click (close mobile menu)
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            if (isMobile()) {
                toggleMobileMenu();
            }
        });
    }
    
    // Handle navigation link clicks on mobile (close menu)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (isMobile()) {
                // Close mobile menu after a short delay to allow page transition
                setTimeout(() => {
                    toggleMobileMenu();
                }, 100);
            }
        });
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (!isMobile()) {
            // On desktop, ensure mobile menu is closed
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
            hamburgerMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Handle escape key to close mobile menu
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isMobile()) {
            if (sidebar.classList.contains('mobile-open')) {
                toggleMobileMenu();
            }
        }
    });
    
    // Initialize sidebar state based on screen size
    function initializeSidebar() {
        if (isMobile()) {
            // On mobile, start with sidebar closed
            sidebar.classList.remove('expanded', 'collapsed');
            sidebar.classList.add('mobile-open');
            toggleMobileMenu(); // This will close it initially
        } else {
            // On desktop, start with sidebar expanded
            sidebar.classList.remove('mobile-open');
            sidebar.classList.add('expanded');
            sidebarOverlay.classList.remove('active');
            hamburgerMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    // Initialize on page load
    initializeSidebar();
});
