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
      initializeUpdateTrainingModal();
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
    // Check if users page is already loaded to prevent unnecessary reload
    const existingUserTable = mainContent.querySelector('#userTableBody');
    if (existingUserTable && window.userManagerInitialized) {
      console.log('🔧 Users page already loaded, skipping reload...');
      return;
    }
    
    console.log('🔧 Loading users page...');
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
    if (window.feedbackCenter) {
      console.log('🔄 Re-initializing existing feedback center');
      // Clean up existing event listeners first
      if (window.feedbackCenter.cleanupEventListeners) {
        window.feedbackCenter.cleanupEventListeners();
      }
      // Re-initialize the feedback center
      window.feedbackCenter.init();
    } else {
      console.log('🚀 Creating new feedback center');
      // Wait for DOM to be ready and check if FeedbacksManager class exists
      setTimeout(() => {
        const container = document.querySelector('.feedbacks-container');
        console.log('🔍 Feedbacks container after timeout:', container);
        
        if (container) {
          if (typeof FeedbacksManager !== 'undefined') {
            console.log('✅ FeedbacksManager class found, creating instance');
            window.feedbackCenter = new FeedbacksManager();
          } else {
            console.error('❌ FeedbacksManager class not defined yet, waiting...');
            // Try again after a longer delay
            setTimeout(() => {
              if (typeof FeedbacksManager !== 'undefined') {
                console.log('✅ FeedbacksManager class found on retry, creating instance');
                window.feedbackCenter = new FeedbacksManager();
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
    
    // Check if action buttons exist in the new DOM
    const actionButtons = document.querySelectorAll('.device-action-btn');
    console.log('🔍 Action buttons found in new DOM:', actionButtons.length);
    actionButtons.forEach((btn, index) => {
      console.log(`🔍 Button ${index}:`, {
        textContent: btn.textContent,
        'data-user-email': btn.getAttribute('data-user-email'),
        'data-sensor-ids': btn.getAttribute('data-sensor-ids')
      });
    });
    
    // Initialize device management functionality
    if (window.deviceManagementManager) {
      console.log('🔄 Re-initializing existing device management manager');
      console.log('🔄 Manager state before rebind:', {
        listenersBound: window.deviceManagementManager.listenersBound,
        deviceDataLength: window.deviceManagementManager.deviceData ? window.deviceManagementManager.deviceData.length : 0
      });
      
      // Rebind event listeners to the newly injected DOM and refresh
      if (window.deviceManagementManager.rebindUI) {
        window.deviceManagementManager.rebindUI();
      }
      
      console.log('🔄 Manager state after rebind:', {
        listenersBound: window.deviceManagementManager.listenersBound,
        deviceDataLength: window.deviceManagementManager.deviceData ? window.deviceManagementManager.deviceData.length : 0
      });
      
      // Check buttons again after rebind
      setTimeout(() => {
        const actionButtonsAfterRebind = document.querySelectorAll('.device-action-btn');
        console.log('🔍 Action buttons after rebind:', actionButtonsAfterRebind.length);
        actionButtonsAfterRebind.forEach((btn, index) => {
          console.log(`🔍 Button ${index} after rebind:`, {
            textContent: btn.textContent,
            'data-user-email': btn.getAttribute('data-user-email'),
            'data-sensor-ids': btn.getAttribute('data-sensor-ids')
          });
        });
      }, 500);
      
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

// Update Training Data Modal functionality
function initializeUpdateTrainingModal() {
  console.log('🔍 Initializing Update Training Modal...');
  
  const updateTrainingDataModal = document.getElementById('updateTrainingDataModal');
  const closeUpdateTrainingModal = document.getElementById('closeUpdateTrainingModal');
  const cancelUpdateTrainingBtn = document.getElementById('cancelUpdateTrainingBtn');
  const updateTrainingDataBtn = document.getElementById('updateTrainingDataBtn');
  const updateTrainingDataForm = document.getElementById('updateTrainingDataForm');
  
  console.log('🔍 Update modal elements found:', { 
    updateTrainingDataModal, closeUpdateTrainingModal, cancelUpdateTrainingBtn, 
    updateTrainingDataBtn, updateTrainingDataForm 
  });

  // Remove existing event listeners to prevent duplicates
  if (closeUpdateTrainingModal) {
    closeUpdateTrainingModal.removeEventListener('click', closeUpdateTrainingModalFunc);
    closeUpdateTrainingModal.addEventListener('click', closeUpdateTrainingModalFunc);
  }
  
  if (cancelUpdateTrainingBtn) {
    cancelUpdateTrainingBtn.removeEventListener('click', closeUpdateTrainingModalFunc);
    cancelUpdateTrainingBtn.addEventListener('click', closeUpdateTrainingModalFunc);
  }

  if (updateTrainingDataModal) {
    updateTrainingDataModal.removeEventListener('click', handleUpdateModalClick);
    updateTrainingDataModal.addEventListener('click', handleUpdateModalClick);
  }

  if (updateTrainingDataBtn) {
    updateTrainingDataBtn.removeEventListener('click', updateTrainingData);
    updateTrainingDataBtn.addEventListener('click', updateTrainingData);
  }

  if (updateTrainingDataForm) {
    updateTrainingDataForm.removeEventListener('submit', handleUpdateFormSubmit);
    updateTrainingDataForm.addEventListener('submit', handleUpdateFormSubmit);
  }
  
  console.log('✅ Update Training Modal initialization completed');
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
  const addMlTrainingDataBtn = document.getElementById('addMlTrainingDataBtn');
  const modalHeader = mlTrainingDataModal?.querySelector('.modal-header h3');
  
  if (mlTrainingDataModal) {
    mlTrainingDataModal.style.display = 'none';
    mlTrainingDataModal.classList.remove('update-mode');
  }
  if (mlTrainingDataForm) {
    mlTrainingDataForm.reset();
  }
  if (addMlTrainingDataBtn) {
    addMlTrainingDataBtn.textContent = 'Add Training Data';
    addMlTrainingDataBtn.removeAttribute('data-training-id');
  }
  if (modalHeader) {
    modalHeader.textContent = 'Add Training Data';
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

// Update Training Data Modal helper functions
function closeUpdateTrainingModalFunc() {
  const updateTrainingDataModal = document.getElementById('updateTrainingDataModal');
  const updateTrainingDataForm = document.getElementById('updateTrainingDataForm');
  const updateTrainingDataBtn = document.getElementById('updateTrainingDataBtn');
  
  if (updateTrainingDataModal) {
    updateTrainingDataModal.style.display = 'none';
  }
  if (updateTrainingDataForm) {
    updateTrainingDataForm.reset();
  }
  if (updateTrainingDataBtn) {
    updateTrainingDataBtn.removeAttribute('data-training-id');
  }
}

function handleUpdateModalClick(e) {
  if (e.target === e.currentTarget) {
    closeUpdateTrainingModalFunc();
  }
}

function handleUpdateFormSubmit(e) {
  e.preventDefault();
  updateTrainingData();
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
    dataQuality: parseInt(document.getElementById('mlDataQuality').value),
    environmentalFactors: document.getElementById('mlEnvironmentalFactors').value
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
  const isUpdateMode = addMlTrainingDataBtn.getAttribute('data-training-id');
  
  // Show loading state
  if (addMlTrainingDataBtn) {
    addMlTrainingDataBtn.disabled = true;
    addMlTrainingDataBtn.textContent = isUpdateMode ? 'Updating...' : 'Adding...';
  }

  // Determine API endpoint and method
  const apiEndpoint = isUpdateMode ? `/api/ml-training/update/${isUpdateMode}` : '/api/ml-training/add';
  const method = isUpdateMode ? 'PUT' : 'POST';

  // Send data to backend
  fetch(apiEndpoint, {
    method: method,
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
      const action = isUpdateMode ? 'updated' : 'added';
      showSuccessMessage(`Training data ${action} successfully!`);
      
      // Explicit admin activity log
      try {
        if (window.logAdminActivity) {
          const food = (formData.foodName || '').toString().trim();
          const logAction = isUpdateMode ? 'UPDATE' : 'ADD';
          window.logAdminActivity(logAction, { page: 'ml', target: food ? `Training data (${food})` : 'Training data' });
        }
      } catch (_) {}
      
      // Refresh ML data if function exists
      if (typeof refreshMlData === 'function') {
        refreshMlData();
      }
    } else {
      throw new Error(data.message || `Failed to ${isUpdateMode ? 'update' : 'add'} training data`);
    }
  })
  .catch(error => {
    console.error(`Error ${isUpdateMode ? 'updating' : 'adding'} training data:`, error);
    alert(`Error ${isUpdateMode ? 'updating' : 'adding'} training data: ` + error.message);
  })
  .finally(() => {
    // Reset button state and modal
    if (addMlTrainingDataBtn) {
      addMlTrainingDataBtn.disabled = false;
      addMlTrainingDataBtn.textContent = 'Add Training Data';
      addMlTrainingDataBtn.removeAttribute('data-training-id');
    }
    
    // Reset modal title and remove update mode class
    const modal = document.getElementById('mlTrainingDataModal');
    const modalHeader = modal.querySelector('.modal-header h3');
    if (modalHeader) modalHeader.textContent = 'Add Training Data';
    if (modal) modal.classList.remove('update-mode');
  });
}

function updateTrainingData() {
  console.log('🔄 updateTrainingData called');
  
  // Try to get form data from the main modal first
  let formData = null;
  let trainingId = null;
  
  // Check if main modal exists and has data
  const updateFoodName = document.getElementById('updateFoodName');
  const updateCategory = document.getElementById('updateCategory');
  const updateTemperature = document.getElementById('updateTemperature');
  const updateHumidity = document.getElementById('updateHumidity');
  const updatePh = document.getElementById('updatePh');
  const updateActualStatus = document.getElementById('updateActualStatus');
  const updateSource = document.getElementById('updateSource');
  const updateDataQuality = document.getElementById('updateDataQuality');
  const updateEnvironmentalFactors = document.getElementById('updateEnvironmentalFactors');
  const updateTrainingDataBtn = document.getElementById('updateTrainingDataBtn');
  
  if (updateFoodName && updateCategory && updateTemperature && updateHumidity && updatePh && 
      updateActualStatus && updateSource && updateDataQuality && updateEnvironmentalFactors && updateTrainingDataBtn) {
    
    console.log('📝 Using main modal form data');
    formData = {
      foodName: updateFoodName.value,
      category: updateCategory.value,
      temperature: parseFloat(updateTemperature.value),
      humidity: parseFloat(updateHumidity.value),
      ph: parseFloat(updatePh.value),
      actualStatus: updateActualStatus.value,
      source: updateSource.value,
      dataQuality: parseInt(updateDataQuality.value),
      environmentalFactors: updateEnvironmentalFactors.value
    };
    trainingId = updateTrainingDataBtn.getAttribute('data-training-id');
  } else {
    // Fallback to temporary modal
    console.log('📝 Using temporary modal form data');
    const tempFoodName = document.getElementById('tempFoodName');
    const tempCategory = document.getElementById('tempCategory');
    const tempTemperature = document.getElementById('tempTemperature');
    const tempHumidity = document.getElementById('tempHumidity');
    const tempPh = document.getElementById('tempPh');
    const tempActualStatus = document.getElementById('tempActualStatus');
    const tempSource = document.getElementById('tempSource');
    const tempDataQuality = document.getElementById('tempDataQuality');
    const tempEnvironmentalFactors = document.getElementById('tempEnvironmentalFactors');
    const tempSaveBtn = document.getElementById('tempSaveBtn');
    
    if (tempFoodName && tempCategory && tempTemperature && tempHumidity && tempPh && 
        tempActualStatus && tempSource && tempDataQuality && tempEnvironmentalFactors && tempSaveBtn) {
      
      formData = {
        foodName: tempFoodName.value,
        category: tempCategory.value,
        temperature: parseFloat(tempTemperature.value),
        humidity: parseFloat(tempHumidity.value),
        ph: parseFloat(tempPh.value),
        actualStatus: tempActualStatus.value,
        source: tempSource.value,
        dataQuality: parseInt(tempDataQuality.value),
        environmentalFactors: tempEnvironmentalFactors.value
      };
      trainingId = tempSaveBtn.getAttribute('data-training-id');
    }
  }
  
  if (!formData || !trainingId) {
    console.error('❌ Could not find form data or training ID');
    alert('Form data or training ID not found');
    return;
  }
  
  console.log('📊 Form data:', formData);
  console.log('🆔 Training ID:', trainingId);

  // Validate form data
  if (!formData.foodName || !formData.category || !formData.actualStatus || !formData.source) {
    alert('Please fill in all required fields');
    return;
  }

  if (isNaN(formData.temperature) || isNaN(formData.humidity) || isNaN(formData.ph) || isNaN(formData.dataQuality)) {
    alert('Please enter valid numeric values for temperature, humidity, pH, and data quality');
    return;
  }
  
  // Show loading state
  const saveBtn = updateTrainingDataBtn || document.getElementById('tempSaveBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Updating...';
  }

  // Send data to backend
  fetch(`/api/ml-training/update/${trainingId}`, {
    method: 'PUT',
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
      if (updateTrainingDataBtn) {
        closeUpdateTrainingModalFunc();
      } else {
        // Close temporary modal
        const tempModal = document.getElementById('tempUpdateModal');
        if (tempModal) tempModal.remove();
      }
      showSuccessMessage('Training data updated successfully!');
      
      // Explicit admin activity log
      try {
        if (window.logAdminActivity) {
          const food = (formData.foodName || '').toString().trim();
          window.logAdminActivity('UPDATE', { page: 'ml', target: food ? `Training data (${food})` : 'Training data' });
        }
      } catch (_) {}
      
      // Refresh ML data if function exists
      if (typeof refreshMlData === 'function') {
        refreshMlData();
      }
    } else {
      throw new Error(data.message || 'Failed to update training data');
    }
  })
  .catch(error => {
    console.error('Error updating training data:', error);
    alert('Error updating training data: ' + error.message);
  })
  .finally(() => {
    // Reset button state
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Update Training Data';
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