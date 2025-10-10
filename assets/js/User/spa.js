// js/spa.js
// Handles Single-Page Application content loading

function showDashboard() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('dashboard-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    // Re-initialize the dashboard charts after loading the content.
    initializeDashboardStatCharts();
    
                // Initialize dashboard charts using existing function
                setTimeout(() => {
                  if (typeof loadSensorData === 'function' && typeof initializeActivityChart === 'function') {
                    loadSensorData().then(() => {
                      initializeActivityChart();
                    });
                  } else if (typeof initializeActivityChart === 'function') {
                    initializeActivityChart();
                  }
                  
                  // Dispatch custom event for chart initialization
                  document.dispatchEvent(new CustomEvent('dashboardLoaded'));
                  
                  // Initialize alerts
                  if (typeof initializeAlerts === 'function') {
                    initializeAlerts();
                  }
                }, 100);
    
    // Initialize sensor dashboard
    if (window.SensorDashboard) {
      window.sensorDashboard = new SensorDashboard();
    }
    
    // Initialize latest scan manager (delay to ensure DOM is ready)
    setTimeout(() => {
      if (window.LatestScanManager) {
        console.log('Re-initializing LatestScanManager for dashboard');
        window.latestScanManager = new LatestScanManager();
      }
    }, 150);
    
    // Ensure dashboard content is visible by default
    const dashboardContent = document.getElementById('dashboard-content');
    if (dashboardContent) {
      dashboardContent.classList.remove('hidden');
    }
    
    // Hide other content areas
    const foodSelectionContent = document.getElementById('food-selection-content');
    if (foodSelectionContent) {
      foodSelectionContent.classList.add('hidden');
    }
    
    const devicesContent = document.getElementById('devices-content');
    if (devicesContent) {
      devicesContent.classList.add('hidden');
    }
  }
}

function showSpoilageReport() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('spoilage-report-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    // Initialize spoilage report functionality
    if (window.initSpoilageReport) window.initSpoilageReport();
  }
}

function showDetailedReport() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('detailed-report-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    // Initialize detailed report functionality
    if (window.initDetailedReport) window.initDetailedReport();
  }
}

function showConfig() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('config-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    // Dynamically load config.css if not already loaded
    if (!document.getElementById('config-css')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'CSS/config.css';
      link.id = 'config-css';
      document.head.appendChild(link);
    }

    // Inline tab logic setup (removed, now handled in config.js)

    // Dynamically load config.js if not already loaded
    if (!document.getElementById('config-js')) {
      const script = document.createElement('script');
      script.src = 'JS/config.js';
      script.id = 'config-js';
      script.onload = function() {
        if (window.initConfigPage) window.initConfigPage();
      };
      document.body.appendChild(script);
    } else {
      if (window.initConfigPage) window.initConfigPage();
    }
  }
}

function showReportGenerator() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('report-generator-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    
    // Dynamically load report-generator.css if not already loaded
    if (!document.getElementById('report-generator-css')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'CSS/report-generator.css';
      link.id = 'report-generator-css';
      document.head.appendChild(link);
    }

    // Initialize report generator functionality
    if (window.ReportGenerator) {
      const reportGen = new ReportGenerator();
      reportGen.addNotificationStyles();
    }
  }
}

function showAnalysis() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('analysis-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    // Dynamically load analysis.css if not already loaded
    if (!document.getElementById('analysis-css')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'CSS/analysis.css';
      link.id = 'analysis-css';
      document.head.appendChild(link);
    }
    // Always remove and re-add analysis.js to re-initialize tab logic
    const oldScript = document.getElementById('analysis-js');
    if (oldScript) oldScript.remove();
    const script = document.createElement('script');
    script.src = 'JS/analysis.js';
    script.id = 'analysis-js';
    script.onload = function() {
      if (window.initAnalysisPage) window.initAnalysisPage();
    };
    document.body.appendChild(script);
    // If script is already loaded (from cache), call initAnalysisPage immediately
    if (window.initAnalysisPage) window.initAnalysisPage();
  }
}

function showUserLog() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('user-log-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    
    // Reset initialization flag when navigating to user log
    window.userLogInitialized = false;
    
    // Initialize user log functionality
    if (window.initUserLogPage) {
      window.initUserLogPage();
    } else {
      console.warn('initUserLogPage function not found');
    }
  }
}

function showFeedback() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('feedback-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    
    // Initialize feedback center functionality
    if (window.FeedbackCenter) {
      try {
        window.feedbackCenter = new FeedbackCenter();
        console.log('SPA: FeedbackCenter initialized successfully');
      } catch (error) {
        console.error('SPA: Error initializing FeedbackCenter:', error);
      }
    } else {
      console.warn('SPA: FeedbackCenter class not found');
    }
    
    // Re-attach feedback event listeners after content is loaded
    setTimeout(() => {
      console.log('SPA: Setting up feedback page...');
      
      // Clean up any existing event listeners first
      if (window.cleanupFeedbackEventListeners) {
        window.cleanupFeedbackEventListeners();
      }
      
      // Keep the default Submit tab active (don't auto-switch to History)
      const submitTab = document.querySelector('[data-tab="submit"]');
      const submitContent = document.getElementById('submitTabContent');
      
      if (submitTab && submitContent) {
        console.log('SPA: Keeping Submit tab active by default...');
        // Ensure submit tab is active by default
        submitTab.classList.add('active');
        submitContent.classList.add('active');
        
        // Remove active class from history tab if it exists
        const historyTab = document.querySelector('[data-tab="history"]');
        const historyContent = document.getElementById('historyTabContent');
        if (historyTab) historyTab.classList.remove('active');
        if (historyContent) historyContent.classList.remove('active');
      }
      
      // Wait for functions to be available before calling them
      let attempts = 0;
      const maxAttempts = 20; // 1 second max wait time
      
      // Let User-Dashboard.html system handle feedback functionality
      console.log('SPA: Feedback page loaded, User-Dashboard.html system will handle initialization');
    }, 100);
  }
}

function removeConfigAssets() {
  const css = document.getElementById('config-css');
  if (css) css.remove();
  const js = document.getElementById('config-js');
  if (js) js.remove();
}

// Track current page and scroll positions to prevent unnecessary re-renders
let __currentPage = null;
const __pageScrollTop = {};

function switchPage(page) {
    console.log('SPA: Switching to page:', page, 'from:', __currentPage);
    
    // Notify listeners before we change the page (for cleanup)
    try {
      window.dispatchEvent(new CustomEvent('spa:navigate:before', { detail: { from: __currentPage, to: page }}));
      if (typeof window.onPageLeave === 'function') {
        window.onPageLeave(__currentPage, page);
      }
    } catch (_) {}

    // Preserve scroll position of the outgoing page
    const mainContentEl = document.getElementById('main-content');
    if (mainContentEl && __currentPage) {
        __pageScrollTop[__currentPage] = mainContentEl.scrollTop || 0;
    }
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    // Treat detailed-report as part of spoilage-report for sidebar highlighting
    let sidebarPage = (page === 'detailed-report') ? 'spoilage-report' : page;
    // Handle plural/singular versions for user logs and feedback
    if (page === 'user-logs') sidebarPage = 'user-logs';
    if (page === 'feedbacks') sidebarPage = 'feedbacks';
    if (page === 'user-log') sidebarPage = 'user-logs';
    if (page === 'feedback') sidebarPage = 'feedbacks';
    
    console.log('SPA: Setting sidebar active state for:', sidebarPage);
    const activeLink = document.querySelector(`.nav-link[data-page="${sidebarPage}"]`);
    if (activeLink) {
        activeLink.closest('.nav-item').classList.add('active');
        console.log('SPA: Sidebar active state set successfully');
    } else {
        console.warn('SPA: No sidebar link found for page:', sidebarPage);
    }

    // Remove config assets if navigating away
    if (page !== 'config') {
      removeConfigAssets();
    }

    // Render page content
    if (page === 'dashboard') {
        showDashboard();
    } else if (page === 'spoilage-report') {
        showSpoilageReport();
    } else if (page === 'detailed-report') {
        showDetailedReport();
    } else if (page === 'config') {
        showConfig();
    } else if (page === 'report-generator') {
        showReportGenerator();
    } else if (page === 'analysis') {
        showAnalysis();
    } else if (page === 'user-log' || page === 'user-logs') {
      showUserLog();
    } else if (page === 'feedback' || page === 'feedbacks') {
      showFeedback();
    }

    // Update header button active state (for spoilage/detailed report views)
    setTimeout(() => {
      document.querySelectorAll('.spoilage-header-buttons .spoilage-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-page') === page) {
          btn.classList.add('active');
        }
      });

      // Restore scroll position of the new page (if any saved)
      if (mainContentEl && __pageScrollTop[page] != null) {
        mainContentEl.scrollTop = __pageScrollTop[page];
      }

      // Notify listeners after we changed the page (for re-bind/init)
      try {
        window.dispatchEvent(new CustomEvent('spa:navigate:after', { detail: { from: __currentPage, to: page }}));
        if (typeof window.onPageEnter === 'function') {
          window.onPageEnter(page, __currentPage);
        }
      } catch (_) {}
    }, 0);

    // Record current page
    __currentPage = page;
}

// Make switchPage globally available
window.switchPage = switchPage;

document.addEventListener('DOMContentLoaded', function() {
  var menuBtn = document.getElementById('menu-toggle');
  if (menuBtn) {
    menuBtn.addEventListener('click', function() {
      document.body.classList.toggle('sidebar-open');
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
    // Use event delegation on the body to handle clicks from static (sidebar) 
    // and dynamic (page content) elements.
    document.body.addEventListener('click', (event) => {
        // Handle sidebar navigation
        const sidebarTarget = event.target.closest('[data-page]');
        if (sidebarTarget) {
            event.preventDefault(); // Prevent default link behavior
            const page = sidebarTarget.getAttribute('data-page');
            console.log('Sidebar navigation clicked:', page);
            if(page) {
                switchPage(page);
            }
        }

        // Handle dashboard tab switching
        const tabTarget = event.target.closest('.dashboard-tab');
        if (tabTarget) {
            event.preventDefault();
            const tab = tabTarget.getAttribute('data-tab');
            if (tab) {
                switchDashboardTab(tab);
            }
        }
    });

    // Initialize sidebar date range controls (persisted across pages)
    try { initSidebarDateRangeControls(); } catch (e) { console.error('Sidebar date range init failed', e); }

    // Load the initial page
    switchPage('dashboard');
    
    // Initialize food selection for the dashboard button
    setTimeout(() => {
        if (window.initFoodSelection) {
            window.initFoodSelection();
        }
    }, 100);
});

// Dashboard tab switching function
function switchDashboardTab(tabName) {
    // Hide all dashboard content areas
    const contents = document.querySelectorAll('.dashboard-content');
    contents.forEach(content => {
        content.classList.add('hidden');
    });

    // Show selected content
    const selectedContent = document.getElementById(`${tabName}-content`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
    }

    // Update tab states
    const tabs = document.querySelectorAll('.dashboard-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });

    // Initialize specific tab functionality
    if (tabName === 'dashboard') {
                // Re-initialize dashboard charts if needed
                setTimeout(() => {
                  if (typeof loadSensorData === 'function' && typeof initializeActivityChart === 'function') {
                    loadSensorData().then(() => {
                      initializeActivityChart();
                    });
                  } else if (typeof initializeActivityChart === 'function') {
                    initializeActivityChart();
                  }
                  
                  // Dispatch custom event for chart initialization
                  document.dispatchEvent(new CustomEvent('dashboardLoaded'));
                  
                  // Initialize alerts
                  if (typeof initializeAlerts === 'function') {
                    initializeAlerts();
                  }
                }, 100);
        // Re-initialize sensor dashboard if needed
        if (window.SensorDashboard && !window.sensorDashboard) {
            window.sensorDashboard = new SensorDashboard();
        }
        // Re-setup modal event listeners for ML Scanner
        if (window.sensorDashboard && window.sensorDashboard.setupModalEventListeners) {
            window.sensorDashboard.setupModalEventListeners();
        }
        // Also initialize food selection for the button in dashboard
        if (window.initFoodSelection) {
            window.initFoodSelection();
        }
    } else if (tabName === 'food-selection') {
        // Initialize food selection if needed
        if (window.initFoodSelection) {
            window.initFoodSelection();
        }
    } else if (tabName === 'devices') {
        // Initialize device management if needed
        if (window.initDeviceManagement) {
            window.initDeviceManagement();
        }
    }
}

// Make switchDashboardTab globally available
window.switchDashboardTab = switchDashboardTab; 

// ---- Sidebar Date Range Controls ----
function initSidebarDateRangeControls() {
  const rangeSel = document.getElementById('sidebarDateRange');
  const weekGrp = document.getElementById('sidebarWeekPickerGroup');
  const monthGrp = document.getElementById('sidebarMonthPickerGroup');
  const yearGrp = document.getElementById('sidebarYearPickerGroup');
  const weekInput = document.getElementById('sidebarWeekPicker');
  const monthInput = document.getElementById('sidebarMonthPicker');
  const yearInput = document.getElementById('sidebarYearPicker');
  if (!rangeSel) return;

  const saved = safeParseJSON(localStorage.getItem('userSidebarDateRange')) || {};
  if (saved.range) rangeSel.value = saved.range;
  togglePickers(rangeSel.value);
  if (saved.week && weekInput) weekInput.value = saved.week;
  if (saved.month && monthInput) monthInput.value = saved.month;
  if (saved.year && yearInput) yearInput.value = saved.year;

  rangeSel.addEventListener('change', () => {
    togglePickers(rangeSel.value);
    emitChange();
  });
  if (weekInput) weekInput.addEventListener('change', emitChange);
  if (monthInput) monthInput.addEventListener('change', emitChange);
  if (yearInput) yearInput.addEventListener('change', emitChange);

  // Emit initial selection
  emitChange();

  function togglePickers(range) {
    if (weekGrp) weekGrp.style.display = 'none';
    if (monthGrp) monthGrp.style.display = 'none';
    if (yearGrp) yearGrp.style.display = 'none';
    if (range === 'weekly' && weekGrp) weekGrp.style.display = 'block';
    if (range === 'monthly' && monthGrp) monthGrp.style.display = 'block';
    if (range === 'yearly' && yearGrp) yearGrp.style.display = 'block';
    if (range === 'weekly' && weekInput && !weekInput.value) weekInput.value = getCurrentISOWeekString();
    if (range === 'monthly' && monthInput && !monthInput.value) monthInput.value = getCurrentMonthString();
    if (range === 'yearly' && yearInput && !yearInput.value) yearInput.value = String(new Date().getFullYear());
  }

  function emitChange() {
    const selection = { range: rangeSel.value };
    if (selection.range === 'weekly' && weekInput && weekInput.value) selection.week = weekInput.value;
    if (selection.range === 'monthly' && monthInput && monthInput.value) selection.month = monthInput.value;
    if (selection.range === 'yearly' && yearInput && yearInput.value) selection.year = yearInput.value;
    localStorage.setItem('userSidebarDateRange', JSON.stringify(selection));
    const period = computeSidebarPeriod(selection);
    document.dispatchEvent(new CustomEvent('userDateRangeChanged', { detail: { selection, period } }));
  }
}

function computeSidebarPeriod(selection) {
  const today = new Date();
  switch (selection.range) {
    case 'alltime':
      return { startDate: null, endDate: null, type: 'alltime' };
    case 'daily':
      return { startDate: toDateStr(today), endDate: toDateStr(today), type: 'daily' };
    case 'weekly': {
      const val = selection.week || getCurrentISOWeekString();
      const parts = val.split('-W');
      const y = parseInt(parts[0]);
      const w = parseInt(parts[1]);
      const start = getWeekStartFromWeekNumber(y, w);
      const end = getWeekEndFromWeekNumber(y, w);
      return { startDate: toDateStr(start), endDate: toDateStr(end), type: 'weekly' };
    }
    case 'monthly': {
      const val = selection.month || getCurrentMonthString();
      const ms = val.split('-');
      const y = parseInt(ms[0]);
      const m = parseInt(ms[1]);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { startDate: toDateStr(start), endDate: toDateStr(end), type: 'monthly' };
    }
    case 'yearly': {
      const y = parseInt(selection.year || String(today.getFullYear()));
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      return { startDate: toDateStr(start), endDate: toDateStr(end), type: 'yearly' };
    }
    default:
      return { startDate: toDateStr(today), endDate: toDateStr(today), type: 'daily' };
  }
}

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch (_) { return null; }
}

function toDateStr(d) { return d.toISOString().split('T')[0]; }
function getCurrentISOWeekString() {
  const today = new Date();
  const week = getISOWeekNumber(today);
  return `${today.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function getCurrentMonthString() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}
function getISOWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  return 1 + Math.round(diff / 604800000);
}
function getWeekStartFromWeekNumber(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = new Date(simple);
  const diff = (dow <= 4 ? 1 : 8) - dow;
  ISOweekStart.setDate(simple.getDate() + diff);
  return ISOweekStart;
}
function getWeekEndFromWeekNumber(year, week) {
  const start = getWeekStartFromWeekNumber(year, week);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

