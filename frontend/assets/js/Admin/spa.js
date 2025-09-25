// js/spa.js
// Handles Single-Page Application content loading

function showDashboard() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('dashboard-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    
    // Initialize filter event listeners
    if (window.initializeFilterEventListeners) {
      window.initializeFilterEventListeners();
    }
    
    // Update dashboard display with current filter state
    if (window.updateDashboardDisplay) {
      window.updateDashboardDisplay();
    }
    
    // Re-initialize the dashboard charts after loading the content.
    if (window.initializeDashboardStatCharts) {
      window.initializeDashboardStatCharts();
    }
    if (window.initializeActivityChart) {
      window.initializeActivityChart();
    }
    
    // Load admin activity counts after template is loaded
    if (window.loadAdminActivityCounts) {
      console.log('Loading admin activity counts after template load...');
      window.loadAdminActivityCounts();
    }
    
    // Update stat cards after template is loaded
    if (window.updateStatCard) {
      console.log('Updating stat cards after template load...');
      window.updateStatCard();
    }
    
    // Load recent reviews after template is loaded
    if (window.fetchRecentReviews) {
      console.log('Loading recent reviews after template load...');
      window.fetchRecentReviews();
    }
    
    // Re-bind admin account modal event listeners after SPA navigation
    if (window.bindAdminAccountModalEvents) {
      console.log('Re-binding admin account modal events...');
      window.bindAdminAccountModalEvents();
    }
  }
}

function showAnalyticsSummary() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('analytics-summary-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;

    // Ensure Sensor Analytics summary loads immediately
    if (window.sensorAnalyticsConnector) {
      setTimeout(() => {
        try {
          window.sensorAnalyticsConnector.currentPage = 'analytics-summary';
          window.sensorAnalyticsConnector.loadSummaryData();
        } catch (e) {
          console.error('Failed to load analytics summary:', e);
        }
      }, 100);
    }
  }
}

function showAnalyticsDetail() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('analytics-detail-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    // Load detailed data with proper timing
    if (window.sensorAnalyticsConnector) {
      setTimeout(() => {
        try {
          window.sensorAnalyticsConnector.currentPage = 'analytics-detail';
          window.sensorAnalyticsConnector.setupEventListeners(); // Re-setup event listeners
          window.sensorAnalyticsConnector.loadDetailedData();
        } catch (error) {
          console.error('Error loading Sensor Analytics detail:', error);
        }
      }, 200);
    }
  }
}

function showReportGenerator() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('report-generator-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    if (window.initReportGenerator) {
      window.initReportGenerator();
    }
  }
}

function showMlPredictions() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('ml-predictions-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    
    // Initialize ML modal functionality after content is loaded
    setTimeout(() => {
      initializeMlModal();
    }, 100);
    
    if (window.mlPredictionsManager && window.mlPredictionsManager.loadOverview) {
      window.mlPredictionsManager.loadOverview();
    }
  }
}

function showMlPredictionsDetail() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('ml-predictions-detail-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    if (window.mlPredictionsManager && window.mlPredictionsManager.loadDetail) {
      setTimeout(() => {
        window.mlPredictionsManager.setupEventListeners && window.mlPredictionsManager.setupEventListeners();
        window.mlPredictionsManager.loadDetail();
      }, 150);
    }
  }
}

function showUsers() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('users-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    if (window.initUserManager) {
      window.initUserManager();
    }
  }
}

function showUserActivityLog() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('user-activity-log-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    if (window.initializeUserActivityLog) {
      window.initializeUserActivityLog();
    }
  }
}

function showFeedbacks() {
  console.log('🎯 showFeedbacks() called');
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('feedbacks-template');
  
  console.log('📋 Main content element:', mainContent);
  console.log('📋 Feedbacks template:', template);
  
  if (mainContent && template) {
    console.log('✅ Both elements found, updating content');
    mainContent.innerHTML = template.innerHTML;
    
    // Check if feedbacks container is now in the DOM
    const feedbacksContainer = document.querySelector('.feedbacks-container');
    console.log('🔍 Feedbacks container after update:', feedbacksContainer);
    
    // Initialize feedbacks functionality
    if (window.feedbacksManager) {
      console.log('🔄 Re-initializing existing feedbacks manager');
      window.feedbacksManager.loadFeedbacks();
      window.feedbacksManager.loadStatistics();
    } else {
      console.log('🚀 Creating new feedbacks manager');
      // Wait for DOM to be ready and check if FeedbacksManager class exists
      setTimeout(() => {
        const container = document.querySelector('.feedbacks-container');
        console.log('🔍 Feedbacks container after timeout:', container);
        
        if (container) {
          if (typeof FeedbacksManager !== 'undefined') {
            console.log('✅ FeedbacksManager class found, creating instance');
            window.feedbacksManager = new FeedbacksManager();
          } else {
            console.error('❌ FeedbacksManager class not defined yet, waiting...');
            // Try again after a longer delay
            setTimeout(() => {
              if (typeof FeedbacksManager !== 'undefined') {
                console.log('✅ FeedbacksManager class found on retry, creating instance');
                window.feedbacksManager = new FeedbacksManager();
              } else {
                console.error('❌ FeedbacksManager class still not defined after retry');
              }
            }, 500);
          }
        } else {
          console.error('❌ Feedbacks container still not found after timeout');
        }
      }, 100);
    }
  } else {
    console.error('❌ Missing elements:', { mainContent, template });
  }
}

function showAdminLog() {
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('admin-log-template');
  if (mainContent && template) {
    mainContent.innerHTML = template.innerHTML;
    // Initialize admin log functionality
    if (window.initializeAdminLog) {
      window.initializeAdminLog();
    }
  }
}

function showDeviceManagement() {
  console.log('🎯 showDeviceManagement() called');
  const mainContent = document.getElementById('main-content');
  const template = document.getElementById('device-management-template');
  
  console.log('📋 Main content element:', mainContent);
  console.log('📋 Device Management template:', template);
  
  if (mainContent && template) {
    console.log('✅ Both elements found, updating content');
    mainContent.innerHTML = template.innerHTML;
    
    // Check if device management container is now in the DOM
    const deviceManagementContainer = document.querySelector('.device-management-container');
    console.log('🔍 Device Management container after update:', deviceManagementContainer);
    
    // Initialize device management functionality
    if (window.deviceManagementManager) {
      console.log('🔄 Re-initializing existing device management manager');
      // Rebind event listeners to the newly injected DOM and refresh
      if (window.deviceManagementManager.rebindUI) {
        window.deviceManagementManager.rebindUI();
      }
      window.deviceManagementManager.refreshData();
    } else {
      console.log('🚀 Creating new device management manager');
      // Wait for DOM to be ready and check if DeviceManagementManager class exists
      setTimeout(() => {
        const container = document.querySelector('.device-management-container');
        console.log('🔍 Device Management container after timeout:', container);
        
        if (container) {
          if (typeof DeviceManagementManager !== 'undefined') {
            console.log('✅ DeviceManagementManager class found, creating instance');
            window.deviceManagementManager = new DeviceManagementManager();
          } else {
            console.error('❌ DeviceManagementManager class not defined yet, waiting...');
            // Try again after a longer delay
            setTimeout(() => {
              if (typeof DeviceManagementManager !== 'undefined') {
                console.log('✅ DeviceManagementManager class found on retry, creating instance');
                window.deviceManagementManager = new DeviceManagementManager();
              } else {
                console.error('❌ DeviceManagementManager class still not defined after retry');
              }
            }, 500);
          }
        } else {
          console.error('❌ Device Management container still not found after timeout');
        }
      }, 100);
    }
  } else {
    console.error('❌ Missing elements:', { mainContent, template });
  }
}

function switchPage(page) {
    // If the page is a detail view, we want the parent summary item in the sidebar to be active.
    const sidebarPage = page === 'analytics-detail' ? 'analytics-summary' : page;

    // Update sidebar active state (support both main and detail pages)
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${sidebarPage}"]`);
    if (activeLink) {
        activeLink.closest('.nav-item').classList.add('active');
    }

    // Render page content
    if (page === 'dashboard') {
        showDashboard();
    } else if (page === 'analytics-summary') {
        showAnalyticsSummary();
    } else if (page === 'analytics-detail') {
        showAnalyticsDetail();
    } else if (page === 'report-generator') {
        showReportGenerator();
    } else if (page === 'users') {
        showUsers();
    } else if (page === 'user-activity-log') {
        showUserActivityLog();
    } else if (page === 'admin-log') {
        showAdminLog();
    } else if (page === 'feedbacks') {
        showFeedbacks();
    } else if (page === 'device-management') {
        showDeviceManagement();
    } else if (page === 'ml-predictions') {
        showMlPredictions();
    } else if (page === 'ml-predictions-detail') {
        showMlPredictionsDetail();
    }

    // Update header button active state (for summary/detail views)
    setTimeout(() => {
      document.querySelectorAll('.spoilage-header-buttons .spoilage-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-page') === page) {
          btn.classList.add('active');
        }
      });
    }, 0);
}

// ML Modal functionality
function initializeMlModal() {
  const mlAddTrainingBtn = document.getElementById('mlAddTraining');
  const mlTrainingDataModal = document.getElementById('mlTrainingDataModal');
  const closeMlTrainingModal = document.getElementById('closeMlTrainingModal');
  const cancelMlTrainingBtn = document.getElementById('cancelMlTrainingBtn');
  const addMlTrainingDataBtn = document.getElementById('addMlTrainingDataBtn');
  const mlTrainingDataForm = document.getElementById('mlTrainingDataForm');

  // Remove existing event listeners to prevent duplicates
  if (mlAddTrainingBtn) {
    mlAddTrainingBtn.removeEventListener('click', openMlTrainingModal);
    mlAddTrainingBtn.addEventListener('click', openMlTrainingModal);
  }

  if (closeMlTrainingModal) {
    closeMlTrainingModal.removeEventListener('click', closeMlTrainingModalFunc);
    closeMlTrainingModal.addEventListener('click', closeMlTrainingModalFunc);
  }
  
  if (cancelMlTrainingBtn) {
    cancelMlTrainingBtn.removeEventListener('click', closeMlTrainingModalFunc);
    cancelMlTrainingBtn.addEventListener('click', closeMlTrainingModalFunc);
  }

  if (mlTrainingDataModal) {
    mlTrainingDataModal.removeEventListener('click', handleModalClick);
    mlTrainingDataModal.addEventListener('click', handleModalClick);
  }

  if (addMlTrainingDataBtn) {
    addMlTrainingDataBtn.removeEventListener('click', addMlTrainingData);
    addMlTrainingDataBtn.addEventListener('click', addMlTrainingData);
  }

  if (mlTrainingDataForm) {
    mlTrainingDataForm.removeEventListener('submit', handleFormSubmit);
    mlTrainingDataForm.addEventListener('submit', handleFormSubmit);
  }
}

// ML Modal helper functions
function openMlTrainingModal() {
  const mlTrainingDataModal = document.getElementById('mlTrainingDataModal');
  if (mlTrainingDataModal) {
    mlTrainingDataModal.style.display = 'block';
    // Focus on first input
    const firstInput = document.getElementById('mlFoodName');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }
}

function closeMlTrainingModalFunc() {
  const mlTrainingDataModal = document.getElementById('mlTrainingDataModal');
  const mlTrainingDataForm = document.getElementById('mlTrainingDataForm');
  if (mlTrainingDataModal) {
    mlTrainingDataModal.style.display = 'none';
  }
  if (mlTrainingDataForm) {
    mlTrainingDataForm.reset();
  }
}

function handleModalClick(e) {
  if (e.target === e.currentTarget) {
    closeMlTrainingModalFunc();
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  addMlTrainingData();
}

function addMlTrainingData() {
  const formData = {
    foodName: document.getElementById('mlFoodName').value,
    category: document.getElementById('mlCategory').value,
    temperature: parseFloat(document.getElementById('mlTemperature').value),
    humidity: parseFloat(document.getElementById('mlHumidity').value),
    ph: parseFloat(document.getElementById('mlPh').value),
    actualStatus: document.getElementById('mlActualStatus').value,
    source: document.getElementById('mlSource').value,
    dataQuality: parseInt(document.getElementById('mlDataQuality').value)
  };

  // Validate form data
  if (!formData.foodName || !formData.category || !formData.actualStatus || !formData.source) {
    alert('Please fill in all required fields');
    return;
  }

  if (isNaN(formData.temperature) || isNaN(formData.humidity) || isNaN(formData.ph) || isNaN(formData.dataQuality)) {
    alert('Please enter valid numeric values for temperature, humidity, pH, and data quality');
    return;
  }

  const addMlTrainingDataBtn = document.getElementById('addMlTrainingDataBtn');
  
  // Show loading state
  if (addMlTrainingDataBtn) {
    addMlTrainingDataBtn.disabled = true;
    addMlTrainingDataBtn.textContent = 'Adding...';
  }

  // Send data to backend
  fetch('/api/ml-training/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token') || ''}`
    },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Success - close modal and refresh data
      closeMlTrainingModalFunc();
      showSuccessMessage('Training data added successfully!');
      // Explicit admin activity log for ADD
      try {
        if (window.logAdminActivity) {
          const food = (formData.foodName || '').toString().trim();
          window.logAdminActivity('ADD', { page: 'ml', target: food ? `Training data (${food})` : 'Training data' });
        }
      } catch (_) {}
      
      // Refresh ML data if function exists
      if (typeof refreshMlData === 'function') {
        refreshMlData();
      }
    } else {
      throw new Error(data.message || 'Failed to add training data');
    }
  })
  .catch(error => {
    console.error('Error adding training data:', error);
    alert('Error adding training data: ' + error.message);
  })
  .finally(() => {
    // Reset button state
    if (addMlTrainingDataBtn) {
      addMlTrainingDataBtn.disabled = false;
      addMlTrainingDataBtn.textContent = 'Add Training Data';
    }
  });
}

function showSuccessMessage(message) {
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
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Use event delegation on the body to handle clicks from static (sidebar) 
    // and dynamic (page content) elements.
    document.body.addEventListener('click', (event) => {
        // Find the closest ancestor with a data-page attribute
        const target = event.target.closest('[data-page]');
        if (target) {
            event.preventDefault(); // Prevent default link behavior
            const page = target.getAttribute('data-page');
            if(page) {
                switchPage(page);
            }
        }
    });

    // Load the initial page
    switchPage('dashboard');
}); 