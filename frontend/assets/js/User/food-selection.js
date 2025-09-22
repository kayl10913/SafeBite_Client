// food-selection.js - Food selection functionality for IoT scanning

class FoodSelection {
  constructor() {
    console.log('FoodSelection class initialized');
    this.selectedFood = null;
    this.foodHistory = this.loadFoodHistory();
    this.isScanningInProgress = false; // prevent duplicate scans
    this._pollingActive = false; // reentrancy guard for polling
    this._scanId = null; // idempotency token per scan
    this.init();
  }

  // Ensure we never bind the same DOM listener multiple times
  bindOnce(target, eventName, handler, key) {
    if (!target || !eventName || !handler) return;
    const dataKey = `bound_${key || eventName}`;
    if (target.dataset && target.dataset[dataKey]) return;
    target.addEventListener(eventName, handler);
    if (target.dataset) target.dataset[dataKey] = '1';
  }

  init() {
    this.setupEventListeners();
    this.renderFoodHistory();
  }

  setupEventListeners() {
    // Food selection button
    const selectFoodBtn = document.getElementById('selectFoodBtn');
    console.log('Food selection button found:', selectFoodBtn);
    if (selectFoodBtn) {
      this.bindOnce(selectFoodBtn, 'click', () => {
        console.log('Food selection button clicked');
        this.openFoodSelectionModal();
      }, 'selectFoodBtn');
    } else {
      console.error('Food selection button not found!');
    }

    // AI food name suggestions and category auto-fill on food name input
    const customFoodName = document.getElementById('customFoodName');
    if (customFoodName) {
      let debounceTimer;
      
      // Auto-capitalization function
      const autoCapitalize = (text) => {
        return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
      };
      
      customFoodName.addEventListener('input', (e) => {
        const cursorPosition = e.target.selectionStart;
        const originalValue = e.target.value;
        
        // Apply auto-capitalization
        const capitalizedValue = autoCapitalize(originalValue);
        
        // Only update if the value actually changed
        if (capitalizedValue !== originalValue) {
          e.target.value = capitalizedValue;
          // Restore cursor position
          e.target.setSelectionRange(cursorPosition, cursorPosition);
        }
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const foodName = e.target.value.trim();
          if (foodName.length >= 2) {
            // Generate category recommendation only (no AI suggestions)
            this.generateCategories(foodName);
          } else {
            this.hideFoodNameSuggestions();
            this.resetCategoryDropdown();
          }
        }, 500); // 500ms debounce
      });

      // Apply capitalization on blur (when user finishes typing)
      customFoodName.addEventListener('blur', (e) => {
        const capitalizedValue = autoCapitalize(e.target.value);
        if (capitalizedValue !== e.target.value) {
          e.target.value = capitalizedValue;
        }
      });
      
      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.food-name-suggestions') && !e.target.closest('#customFoodName')) {
          this.hideFoodNameSuggestions();
        }
      });
    }

    // Modal controls
    const cancelBtn = document.getElementById('cancelFoodSelection');
    if (cancelBtn) {
      this.bindOnce(cancelBtn, 'click', () => {
        this.closeFoodSelectionModal();
      }, 'cancelFoodSelection');
    }

    // Close button (X)
    const closeBtn = document.querySelector('.food-selection-modal-close');
    if (closeBtn) {
      this.bindOnce(closeBtn, 'click', () => {
        this.closeFoodSelectionModal();
      }, 'foodSelectionModalClose');
    }

    // Backdrop click to close
    const modal = document.getElementById('foodSelectionModal');
    if (modal) {
      const backdrop = modal.querySelector('.food-selection-modal-backdrop');
      if (backdrop) {
        this.bindOnce(backdrop, 'click', () => {
          this.closeFoodSelectionModal();
        }, 'foodSelectionBackdrop');
      }
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('foodSelectionModal');
        if (modal && modal.style.display === 'flex') {
          this.closeFoodSelectionModal();
        }
      }
    });

    const confirmBtn = document.getElementById('confirmFoodSelection');
    if (confirmBtn) {
      this.bindOnce(confirmBtn, 'click', async () => {
        await this.confirmFoodSelection();
      }, 'confirmFoodSelection');
    }

    // Handle custom category input
    const categorySelect = document.getElementById('customFoodCategory');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'Custom') {
          this.showCustomCategoryInput();
        } else {
          this.hideCustomCategoryInput();
        }
      });
    }

    const okBtn = document.getElementById('okFoodSelected');
    if (okBtn) {
      this.bindOnce(okBtn, 'click', () => {
        this.closeFoodSelectedConfirmation();
      }, 'okFoodSelected');
    }

    // Modal backdrop click to close
    const modalBackdrop = document.querySelector('.food-selection-modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', () => {
        this.closeFoodSelectionModal();
      });
    }

    // Food history filters
    const historyFilter = document.getElementById('historyFilter');
    if (historyFilter) {
      historyFilter.addEventListener('change', (e) => {
        this.filterFoodHistory(e.target.value);
      });
    }

    // Clear history button
    const clearBtn = document.getElementById('clearFoodHistoryBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearFoodHistory();
      });
    }


  }



  openFoodSelectionModal() {
    const modal = document.getElementById('foodSelectionModal');
    console.log('Opening modal, modal found:', modal);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      console.log('Modal should be visible now');
    } else {
      console.error('Food selection modal not found!');
    }
  }

  closeFoodSelectionModal() {
    const modal = document.getElementById('foodSelectionModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
      this.clearForm();
    }
  }

  clearForm() {
    const customName = document.getElementById('customFoodName');
    const customCategory = document.getElementById('customFoodCategory');
    
    if (customName) customName.value = '';
    if (customCategory) customCategory.value = '';
    
    // Hide suggestions and custom inputs
    this.hideFoodNameSuggestions();
    this.hideCustomCategoryInput();
    
    // Reset category dropdown to default options
    this.resetCategoryDropdown();
  }

  // Food name suggestions removed (no AI)
  showFoodNameSuggestions(_) {
    const foodNameInput = document.getElementById('customFoodName');
    if (!foodNameInput) return;

    // Remove existing suggestions
    this.hideFoodNameSuggestions();

    // Create suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'food-name-suggestions';
    suggestionsContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #2a3658;
      border: 1px solid #3a4a6b;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
    `;

    // Add suggestions
    suggestions.forEach((suggestion, index) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        color: #e0e6f6;
        border-bottom: 1px solid #3a4a6b;
        transition: background-color 0.2s;
      `;
      suggestionItem.textContent = suggestion;
      
      suggestionItem.addEventListener('mouseenter', () => {
        suggestionItem.style.backgroundColor = '#3a4a6b';
      });
      
      suggestionItem.addEventListener('mouseleave', () => {
        suggestionItem.style.backgroundColor = 'transparent';
      });
      
      suggestionItem.addEventListener('click', () => {
        foodNameInput.value = suggestion;
        this.hideFoodNameSuggestions();
        // With suggestions removed, just keep selected text and no further action
      });
      
      suggestionsContainer.appendChild(suggestionItem);
    });

    // Position the suggestions container
    foodNameInput.parentNode.style.position = 'relative';
    foodNameInput.parentNode.appendChild(suggestionsContainer);
  }

  hideFoodNameSuggestions() {
    const existingSuggestions = document.querySelector('.food-name-suggestions');
    if (existingSuggestions) {
      existingSuggestions.remove();
    }
  }

  // Category recommendation (no AI)
  async generateCategories(foodName) {
    try {
      console.log('Generating category recommendation for:', foodName);
      
      // Show loading state
      this.showCategoryLoading();
      
      const token = localStorage.getItem('jwt_token');
      console.log('Using token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        console.error('No authentication token found. User may not be logged in.');
        this.showCategoryError('Please log in to use AI features');
        return;
      }
      
      const response = await fetch('/api/ai/generate-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ food_name: foodName })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, response.statusText, errorData);
        
        if (response.status === 401) {
          this.showCategoryError('Authentication failed. Please log in again.');
        } else if (response.status === 500) {
          this.showCategoryError('AI service temporarily unavailable');
        } else {
          this.showCategoryError(`API Error: ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.success && data.category) {
        this.populateCategoryDropdown([data.category]);
        console.log('Category recommended:', data.category);
      } else {
        console.error('Invalid response format:', data);
        this.showCategoryError('Invalid response from service');
      }

    } catch (error) {
      console.error('Error generating categories:', error);
      this.showCategoryError('Network error. Please check your connection.');
    }
  }

  populateCategoryDropdown(aiCategory) {
    const categorySelect = document.getElementById('customFoodCategory');
    if (!categorySelect) return;

    // Clear existing options except the first one (Select category)
    const defaultOptions = categorySelect.querySelectorAll('option');
    for (let i = 1; i < defaultOptions.length; i++) {
      defaultOptions[i].remove();
    }

    // Add recommended category first (highlighted)
    if (aiCategory) {
      const aiOption = document.createElement('option');
      aiOption.value = aiCategory;
      aiOption.textContent = `⭐ ${aiCategory} (recommended)`;
      aiOption.style.fontWeight = 'bold';
      categorySelect.appendChild(aiOption);
    }

    // Add all standard food categories
    const standardCategories = ['Fruits', 'Vegetables', 'Meat', 'Seafood', 'Dairy', 'Grains', 'Other'];
    standardCategories.forEach(category => {
      // Skip if it's the same as AI suggestion
      if (category !== aiCategory) {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
      }
    });

    // Add Custom option at the end
    const customOption = document.createElement('option');
    customOption.value = 'Custom';
    customOption.textContent = 'Custom (add your own)';
    categorySelect.appendChild(customOption);
  }

  resetCategoryDropdown() {
    const categorySelect = document.getElementById('customFoodCategory');
    if (!categorySelect) return;

    // Reset to default options
    categorySelect.innerHTML = `
      <option value="">Select category</option>
      <option value="Custom">Custom (add your own)</option>
    `;
  }

  showCategoryLoading() {
    const categorySelect = document.getElementById('customFoodCategory');
    if (!categorySelect) return;

    // Add loading option
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Finding category recommendation...';
    loadingOption.disabled = true;
    loadingOption.selected = true;
    
    // Clear other options except first one
    const defaultOptions = categorySelect.querySelectorAll('option');
    for (let i = 1; i < defaultOptions.length; i++) {
      defaultOptions[i].remove();
    }
    
    categorySelect.appendChild(loadingOption);
  }

  showCategoryError(message = '❌ Service unavailable - using default options') {
    const categorySelect = document.getElementById('customFoodCategory');
    if (!categorySelect) return;

    // Add error option
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = message;
    errorOption.disabled = true;
    errorOption.selected = true;
    
    // Clear other options except first one
    const defaultOptions = categorySelect.querySelectorAll('option');
    for (let i = 1; i < defaultOptions.length; i++) {
      defaultOptions[i].remove();
    }
    
    categorySelect.appendChild(errorOption);
    
    // Reset after 3 seconds
    setTimeout(() => {
      this.resetCategoryDropdown();
    }, 3000);
  }

  showCustomCategoryInput() {
    // Check if custom input already exists
    let customInput = document.getElementById('customCategoryInput');
    if (customInput) return;

    // Create custom input field
    const categoryGroup = document.querySelector('.food-selection-form-group:last-child');
    if (categoryGroup) {
      const customInputGroup = document.createElement('div');
      customInputGroup.className = 'food-selection-form-group';
      customInputGroup.style.marginTop = '10px';
      customInputGroup.innerHTML = `
        <label style="color:#e0e6f6;">Custom Category</label>
        <input type="text" id="customCategoryInput" placeholder="Enter your custom category" style="background:#2a3658;border:1px solid #3a4a6b;color:#fff;">
      `;
      categoryGroup.parentNode.insertBefore(customInputGroup, categoryGroup.nextSibling);
    }
  }

  hideCustomCategoryInput() {
    const customInput = document.getElementById('customCategoryInput');
    if (customInput) {
      customInput.parentNode.remove();
    }
  }

  // Complete scan session
  async completeScanSession() {
    if (!this.currentScanSession) {
      console.log('No active scan session to complete');
      return;
    }

    try {
      console.log('🔍 Completing scan session from food selection:', this.currentScanSession.session_id);
      
      const sessionToken = localStorage.getItem('jwt_token') || 
                          localStorage.getItem('sessionToken') || 
                          localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.log('🔄 No session token, trying without authentication...');
        
        const response = await fetch('/api/sensor/scan-session', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: 11, // Arduino user ID
            session_id: this.currentScanSession.session_id
          })
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Scan session completed (no auth):', result.session_id);
          this.currentScanSession = null;
          return;
        } else {
          throw new Error(result.error || 'Failed to complete scan session');
        }
      }

      console.log('🔑 Using session token for authentication');
      const response = await fetch('/api/sensor/scan-session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          user_id: 11, // Arduino user ID
          session_id: this.currentScanSession.session_id
        })
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📊 Response data:', result);
      
      if (result.success) {
        console.log('✅ Scan session completed:', result.session_id);
        this.currentScanSession = null;
      } else {
        throw new Error(result.error || 'Failed to complete scan session');
      }
    } catch (error) {
      console.error('❌ Error completing scan session:', error);
      // Still clear the session even if completion fails
      this.currentScanSession = null;
      throw error;
    }
  }

  // Create scan session for Arduino data reception
  async createScanSession() {
    try {
      console.log('🔍 Creating scan session from food selection...');
      
      const sessionToken = localStorage.getItem('jwt_token') || 
                          localStorage.getItem('sessionToken') || 
                          localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.log('🔄 No session token, trying without authentication...');
        
        const response = await fetch('/api/sensor/scan-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: 11, // Arduino user ID
            session_data: {
              frontend_initiated: true,
              timestamp: new Date().toISOString(),
              source: 'food_selection'
            }
          })
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Scan session created (no auth):', result.session);
          this.currentScanSession = result.session;
          return result.session;
        } else {
          throw new Error(result.error || 'Failed to create scan session');
        }
      }

      console.log('🔑 Using session token for authentication');
      const response = await fetch('/api/sensor/scan-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          user_id: 11, // Arduino user ID
          session_data: {
            frontend_initiated: true,
            timestamp: new Date().toISOString(),
            source: 'food_selection'
          }
        })
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📊 Response data:', result);
      
      if (result.success) {
        console.log('✅ Scan session created:', result.session);
        this.currentScanSession = result.session;
        return result.session;
      } else {
        throw new Error(result.error || 'Failed to create scan session');
      }
    } catch (error) {
      console.error('❌ Error creating scan session:', error);
      throw error;
    }
  }

  async confirmFoodSelection() {
    const customName = document.getElementById('customFoodName');
    const customCategory = document.getElementById('customFoodCategory');
    const customCategoryInput = document.getElementById('customCategoryInput');

    // Get the final category value
    let finalCategory = '';
    if (customCategory && customCategory.value === 'Custom' && customCategoryInput && customCategoryInput.value.trim()) {
      finalCategory = customCategoryInput.value.trim();
    } else if (customCategory && customCategory.value && customCategory.value !== 'Custom') {
      finalCategory = customCategory.value;
    }

    // Check if custom food is filled
    if (customName && customName.value.trim() && finalCategory) {
      // Guard against double-start when listeners are bound multiple times
      if (this.isScanningInProgress) {
        console.warn('Scan already in progress. Ignoring duplicate confirmation.');
        return;
      }
      // Validate food name against category
      const validationResult = this.validateFoodCategory(customName.value.trim(), finalCategory);
      
      if (!validationResult.isValid) {
        this.showFoodValidationError(validationResult.message, customName.value.trim(), finalCategory);
        return;
      }

      const selectedFood = {
        id: 'custom',
        name: customName.value.trim(),
        category: finalCategory
      };

      this.selectedFood = selectedFood;
      
      // Add to food history
      this._lastScanHistoryId = this.addToFoodHistory(selectedFood.name, selectedFood.category, 'scanned');
      
      this.closeFoodSelectionModal();
      this.showFoodSelectedConfirmation(selectedFood);

      // Create scan session for Arduino data reception
      try {
        await this.createScanSession();
      } catch (error) {
        console.error('Failed to create scan session:', error);
        // Continue anyway - the blocking will just prevent Arduino data
      }

      // Start polling sensors and trigger ML prediction → expiry update
      this.isScanningInProgress = true;
      this.startSensorPollingAndPredict();
    } else {
      console.warn('Missing required fields: food name and category.');
    }
  }

  showFoodSelectedConfirmation(food) {
    const confirmation = document.getElementById('foodSelectedConfirmation');
    const foodInfo = document.getElementById('selectedFoodInfo');
    const waitEl = document.getElementById('sensorWaitIndicator');
    const okBtn = document.getElementById('okFoodSelected');
    const trainingUpload = document.getElementById('smartTrainingUpload');
    const autoTrainingStatus = document.getElementById('autoTrainingStatus');
    
    // Reset modal state for new food selection
    this.resetModalState();
    
    if (confirmation && foodInfo) {
      foodInfo.textContent = `${food.name} from ${food.category} category ready`;
      confirmation.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      // while polling for new sensor data, show spinner and disable OK
      if (waitEl) waitEl.style.display = 'inline-flex';
      if (okBtn) {
        okBtn.disabled = true;
        okBtn.textContent = 'Waiting...';
      }
      // Hide training upload initially
      if (trainingUpload) trainingUpload.style.display = 'none';
    }
  }

  closeFoodSelectedConfirmation() {
    const confirmation = document.getElementById('foodSelectedConfirmation');
    if (confirmation) {
      confirmation.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
    
    // Complete scan session when OK button is clicked
    try {
      this.completeScanSession();
    } catch (error) {
      console.error('Failed to complete scan session when closing confirmation:', error);
    }
    
    // Safety: ensure any ongoing scan is not re-triggered after closing
    const cancelBtn = document.getElementById('cancelScanBtn');
    if (cancelBtn) cancelBtn.remove();
    this.isScanningCancelled = false;
    this.isScanningInProgress = false;
    this._pollingActive = false;
    this._scanId = null;
  }

  resetModalState() {
    // Reset auto training status modal
    const autoTrainingStatus = document.getElementById('autoTrainingStatus');
    if (autoTrainingStatus) {
      autoTrainingStatus.style.display = 'none';
      autoTrainingStatus.innerHTML = `
        <div class="training-status-header">
          <h3>🧠 AI Training Complete!</h3>
          <p>Your sensor data has been automatically used to train our AI</p>
        </div>
        <div class="training-status-info">
          <div class="status-item">
            <i class="bi bi-check-circle"></i>
            <span>Sensor data collected</span>
          </div>
          <div class="status-item">
            <i class="bi bi-check-circle"></i>
            <span>AI model updated</span>
          </div>
          <div class="status-item">
            <i class="bi bi-check-circle"></i>
            <span>Training data saved</span>
          </div>
        </div>
      `;
    }

    // Reset food selected confirmation modal elements
    const waitEl = document.getElementById('sensorWaitIndicator');
    const okBtn = document.getElementById('okFoodSelected');
    const trainingUpload = document.getElementById('smartTrainingUpload');
    
    if (waitEl) waitEl.style.display = 'none';
    if (okBtn) {
      okBtn.disabled = false;
      okBtn.textContent = 'OK';
    }
    if (trainingUpload) trainingUpload.style.display = 'none';
  }
  // Format sensor value for display (accepts primitives or { value })
  formatSensorValue(v) {
    try {
      if (v == null) return '—';
      if (typeof v === 'object') {
        if ('value' in v && v.value != null && v.value !== '') return v.value;
        return '—';
      }
      return v;
    } catch (_) {
      return '—';
    }
  }


  getSelectedFood() {
    return this.selectedFood;
  }

  // Food History Methods
  loadFoodHistory() {
    const history = localStorage.getItem('foodHistory');
    return history ? JSON.parse(history) : [];
  }

  saveFoodHistory() {
    localStorage.setItem('foodHistory', JSON.stringify(this.foodHistory));
  }

  addToFoodHistory(foodName, category, status = 'scanned') {
    const historyItem = {
      id: Date.now(),
      foodName,
      category,
      status,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    };
    
    this.foodHistory.unshift(historyItem);
    this.saveFoodHistory();
    this.renderFoodHistory();
    return historyItem.id;
  }

  updateFoodHistoryStatus(historyId, newStatus) {
    if (!historyId) return;
    const idx = this.foodHistory.findIndex(h => String(h.id) === String(historyId));
    if (idx !== -1) {
      this.foodHistory[idx].status = newStatus;
      this.saveFoodHistory();
      this.renderFoodHistory();
    }
  }

  // --- ML + Polling Flow ---
  async startSensorPollingAndPredict() {
    try {
      console.log('🔍 Smart Training system startSensorPollingAndPredict called');
      console.log('🔍 Global flag check - smartSenseScannerActive:', window.smartSenseScannerActive);
      
      // Check if SmartSense Scanner is active - if so, skip this system
      if (window.smartSenseScannerActive) {
        console.log('🔍 SmartSense Scanner is active - skipping Smart Training system');
        return;
      }
      
      console.log('🔍 Smart Training system proceeding with ML prediction');
      
      // create a new idempotency id for this scan
      this._scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      if (this._pollingActive) {
        console.warn('Sensor polling already active; ignoring duplicate trigger.');
        return;
      }
      this._pollingActive = true;
      const maxWaitMs = 30000; // 30s max
      const intervalMs = 3000; // poll every 3s
      let baselineFingerprint = null;
      const start = Date.now();
      const waitEl = document.getElementById('sensorWaitIndicator');
      const okBtn = document.getElementById('okFoodSelected');
      
      // Add cancel button to the UI
      this.addCancelButton();
      
      // Set up cancellation flag
      this.isScanningCancelled = false;

      // Helpers to normalize and fingerprint readings
      const getVal = (v) => (v && typeof v === 'object' && 'value' in v) ? v.value : v;
      const getTs = (v) => (v && typeof v === 'object' && 'timestamp' in v) ? v.timestamp : '';
      const sensorFingerprint = (data) => {
        if (!data) return '';
        const t = data.temperature != null ? `${getVal(data.temperature)}-${getTs(data.temperature)}` : 'null';
        const h = data.humidity != null ? `${getVal(data.humidity)}-${getTs(data.humidity)}` : 'null';
        const gSrc = data.gas != null ? data.gas : (data.gas_level != null ? data.gas_level : null);
        const g = gSrc != null ? `${getVal(gSrc)}-${getTs(gSrc)}` : 'null';
        return [t, h, g].join('|');
      };

      let latestData = null;

      // Establish baseline first
      const initialSnapshot = await this.fetchLatestSensorData();
      console.log('Initial sensor snapshot:', initialSnapshot);
      baselineFingerprint = sensorFingerprint(initialSnapshot);
      const hadAnyInitial = !!(initialSnapshot && (
        (initialSnapshot.temperature != null && getVal(initialSnapshot.temperature) != null) ||
        (initialSnapshot.humidity != null && getVal(initialSnapshot.humidity) != null) ||
        ((initialSnapshot.gas != null || initialSnapshot.gas_level != null) && getVal(initialSnapshot.gas ?? initialSnapshot.gas_level) != null)
      ));

      // Poll until fingerprint CHANGES from baseline or timestamps advance
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 3;
      
      while (Date.now() - start < maxWaitMs && !this.isScanningCancelled) {
        // Check if cancelled before each iteration
        if (this.isScanningCancelled) {
          console.log('Scanning cancelled by user');
          break;
        }
        
        try {
          const snapshot = await this.fetchLatestSensorData();
          
          // Check if API call was successful
          if (!snapshot) {
            console.warn('No sensor data returned from API');
            consecutiveErrors++;
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.error('Too many consecutive API failures, stopping scan');
              break;
            }
            await new Promise(r => setTimeout(r, intervalMs));
            continue;
          }
          
          // Reset error counter on successful data fetch
          consecutiveErrors = 0;
          
          console.log('Polling sensor snapshot:', snapshot);
          const fp = sensorFingerprint(snapshot);
          
          // If previously no values and now we have any, treat as new
          const hasAnyNow = !!(snapshot && (
            (snapshot.temperature != null && getVal(snapshot.temperature) != null) ||
            (snapshot.humidity != null && getVal(snapshot.humidity) != null) ||
            ((snapshot.gas != null || snapshot.gas_level != null) && getVal(snapshot.gas ?? snapshot.gas_level) != null)
          ));
          if (!hadAnyInitial && hasAnyNow) {
            latestData = snapshot;
            break;
          }
          
          // Also consider timestamp-only changes as new
          const tsBase = initialSnapshot ? [getTs(initialSnapshot.temperature), getTs(initialSnapshot.humidity), getTs(initialSnapshot.gas ?? initialSnapshot.gas_level)].join('|') : '';
          const tsNow = snapshot ? [getTs(snapshot.temperature), getTs(snapshot.humidity), getTs(snapshot.gas ?? snapshot.gas_level)].join('|') : '';
          if (fp !== baselineFingerprint || tsNow !== tsBase) {
            latestData = snapshot;
            break;
          }
          
          await new Promise(r => setTimeout(r, intervalMs));
        } catch (error) {
          console.error('Error polling sensor data:', error);
          consecutiveErrors++;
          
          // If too many consecutive errors, stop scanning
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error('Too many consecutive errors, stopping scan');
            break;
          }
          
          await new Promise(r => setTimeout(r, intervalMs));
        }
      }

      // Stop loading indicator now (regardless of ML outcome)
      if (waitEl) waitEl.style.display = 'none';
      if (okBtn) {
        okBtn.disabled = false;
        okBtn.textContent = 'OK';
      }
      
      // Check if scanning was cancelled
      if (this.isScanningCancelled) {
        console.log('Scanning was cancelled, stopping ML workflow');
        this.showCancelledMessage();
        return;
      }
      
      // Automatically train the ML model with the scanned data
      console.log('Passing sensor data to ML workflow:', latestData);
      
      // If no sensor data is available, show user-friendly message
      if (!latestData || (!latestData.temperature && !latestData.humidity && !latestData.gas)) {
        console.warn('No sensor data available, showing user message');
        const trainingStatus = document.getElementById('trainingStatus');
        if (trainingStatus) {
          trainingStatus.innerHTML = `
            <div class="training-status-header">
              <h4>⚠️ No Sensor Data</h4>
              <p>Please ensure your sensors are connected and sending data</p>
            </div>
            <div class="training-status-items">
              <div class="status-item">
                <i class="bi bi-exclamation-triangle text-warning"></i>
                <span>No sensor readings detected</span>
              </div>
              <div class="status-item">
                <i class="bi bi-info-circle text-info"></i>
                <span>Check sensor connections and try again</span>
              </div>
            </div>
          `;
        }
        // Mark attempt as failed in history
        if (this._lastScanHistoryId) {
          this.updateFoodHistoryStatus(this._lastScanHistoryId, 'failed');
          this._lastScanHistoryId = null;
        } else if (this.selectedFood) {
          this.addToFoodHistory(this.selectedFood.name || 'Unknown', this.selectedFood.category || 'Unknown', 'failed');
        }
        return;
      }
      
      await this.autoTrainMLModel(latestData);

      // If no new data arrived within the timeout, mark as failed and exit
      if (!latestData) {
        console.warn('No new sensor data detected within timeout.');
        if (this._lastScanHistoryId) {
          this.updateFoodHistoryStatus(this._lastScanHistoryId, 'failed');
          this._lastScanHistoryId = null;
        } else if (this.selectedFood) {
          this.addToFoodHistory(this.selectedFood.name || 'Unknown', this.selectedFood.category || 'Unknown', 'failed');
        }
        return;
      }

      // Normalize values before downstream calls
      const normLatest = {
        temperature: getVal(latestData?.temperature),
        humidity: getVal(latestData?.humidity),
        gas_level: getVal((latestData && (latestData.gas_level ?? latestData.gas)))
      };

      // Use AI analysis endpoint (same as analysis.js) to derive expiry
      const aiResult = await this.callAiAnalyze(normLatest);
      if (!aiResult) return;

      // Prefer estimatedShelfLifeHours if provided; otherwise map risk
      const expiry = this.deriveExpiryFromAi(aiResult);

      // Check if scanning was cancelled before updating expiry
      if (this.isScanningCancelled) {
        console.log('Expiry update cancelled - scanning was stopped by user');
        return;
      }

      // Update existing food items with predicted expiry instead of creating new ones
      await this.updateFoodWithExpiry(this.selectedFood?.name || 'Unknown', this.selectedFood?.category || null, expiry);

      // No ai_analysis table: skip storing AI analysis; we only update food_items.expiration_date

      // Update existing history entry instead of adding a duplicate
      const riskStatus = (aiResult.riskLevel || 'predicted').toLowerCase();
      if (this._lastScanHistoryId) {
        this.updateFoodHistoryStatus(this._lastScanHistoryId, riskStatus);
        this._lastScanHistoryId = null;
      } else {
        // Fallback: if no pending id, add a new record
        this.addToFoodHistory(
          this.selectedFood?.name || 'Unknown',
          this.selectedFood?.category || 'Unknown',
          riskStatus
        );
      }

      // Loading state already cleared above
    } catch (err) {
      console.error('Polling/ML flow error:', err);
    } finally {
      // Complete scan session when scanning is finished
      try {
        await this.completeScanSession();
      } catch (error) {
        console.error('Failed to complete scan session after scanning:', error);
      }
      
      // Only now allow subsequent scans
      this.isScanningInProgress = false;
      this._pollingActive = false;
    }
  }

  async fetchLatestSensorData() {
    try {
      const token = localStorage.getItem('jwt_token') || 
                    localStorage.getItem('sessionToken') || 
                    localStorage.getItem('session_token');

      if (!token) {
        console.error('No authentication token found for sensor data fetch');
        return null;
      }

      // If we have a selected food with an id, use gauges endpoint for accurate values/ranges
      if (this.selectedFood && this.selectedFood.id && this.selectedFood.id !== 'custom') {
        try {
          const params = new URLSearchParams();
          params.append('food_id', this.selectedFood.id);
          const r = await fetch(`/api/sensor/gauges?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!r.ok) {
            console.error('Gauges API request failed:', r.status, r.statusText);
            // Fall through to latest-user endpoint
          } else {
            const j = await r.json();
            if (j && j.success && j.gauge_data) {
              const g = j.gauge_data;
              // Update dashboard gauges if available
              if (window.sensorDashboard && typeof window.sensorDashboard.updateSensorCardsForFood === 'function') {
                window.sensorDashboard.updateSensorCardsForFood(this.selectedFood.id);
              }
              return {
                temperature: g.temperature ? { value: g.temperature.value, unit: g.temperature.unit, timestamp: g.temperature.timestamp } : null,
                humidity: g.humidity ? { value: g.humidity.value, unit: g.humidity.unit, timestamp: g.humidity.timestamp } : null,
                gas: g.gas ? { value: g.gas.value, unit: g.gas.unit, timestamp: g.gas.timestamp } : null
              };
            }
          }
        } catch (gaugeError) {
          console.warn('Gauges API failed, falling back to latest-user:', gaugeError);
        }
      }

      // Fallback: latest readings for the user
      const r = await fetch('/api/sensor/latest-user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!r.ok) {
        console.error('Latest-user API request failed:', r.status, r.statusText);
        return null;
      }
      
      const j = await r.json();
      if (!j || !j.success) {
        console.error('API returned error:', j?.error || 'Unknown error');
        return null;
      }
      
      const data = j.data || {};
      console.log('Raw sensor data from API:', data);
      
      // The API already returns the data in the correct format with value, unit, timestamp
      return {
        temperature: data.temperature || null,
        humidity: data.humidity || null,
        gas: data.gas || null
      };
    } catch (error) {
      console.error('Error fetching latest sensor data:', error);
      return null;
    }
  }

  async callMlPredict(latest) {
    try {
      const token = localStorage.getItem('jwt_token') || 
                    localStorage.getItem('sessionToken') || 
                    localStorage.getItem('session_token');
      if (!token) return null;

      const temperature = typeof latest?.temperature === 'object' ? latest?.temperature?.value : latest?.temperature;
      const humidity = typeof latest?.humidity === 'object' ? latest?.humidity?.value : latest?.humidity;
      const gas_level = (typeof latest?.gas === 'object' ? latest?.gas?.value : latest?.gas);

      if (temperature == null || humidity == null || gas_level == null) return null;

      const body = {
        temperature,
        humidity,
        gas_level,
        food_name: this.selectedFood?.name || null,
        food_type_id: null
      };

      const r = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!j || !j.success) return null;
      return j.prediction;
    } catch (e) {
      console.error('ML predict error:', e);
      return null;
    }
  }

  async callAiAnalyze(latest) {
    try {
      const token = localStorage.getItem('jwt_token') || 
                    localStorage.getItem('sessionToken') || 
                    localStorage.getItem('session_token');
      if (!token) return null;

      const temp = typeof latest?.temperature === 'object' ? latest?.temperature?.value : latest?.temperature;
      const humidity = typeof latest?.humidity === 'object' ? latest?.humidity?.value : latest?.humidity;
      const gas = (typeof latest?.gas === 'object' ? latest?.gas?.value : latest?.gas) ?? latest?.gas_level;
      if (temp == null || humidity == null || gas == null) return null;

      const name = this.selectedFood?.name || 'General';
      const r = await fetch('/api/ai/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ foodType: name, temp: Number(temp), humidity: Number(humidity), gas: Number(gas) })
      });
      const j = await r.json();
      if (!j || !j.analysis) return null;
      return j.analysis;
    } catch (e) {
      console.error('AI analyze error:', e);
      return null;
    }
  }

  deriveExpiryFromAi(analysis) {
    // If model provides estimatedShelfLifeHours, convert to date
    const hours = Number(analysis.estimatedShelfLifeHours);
    if (!isNaN(hours) && hours > 0) {
      const d = new Date(Date.now() + hours * 3600 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    // Fallback to risk-based heuristic
    const risk = String(analysis.riskLevel || '').toUpperCase();
    const fakePrediction = { spoilage_status: risk === 'HIGH' ? 'HIGH_SPOILAGE_RISK' : risk === 'MEDIUM' ? 'MODERATE_SPOILAGE_RISK' : 'LOW_SPOILAGE_RISK' };
    return this.deriveExpiryDate(fakePrediction);
  }

  deriveExpiryDate(prediction) {
    // Heuristic mapping from spoilage status to days remaining
    const now = new Date();
    let days = 0;
    switch ((prediction.spoilage_status || '').toUpperCase()) {
      case 'LOW_SPOILAGE_RISK':
        days = 3; break;
      case 'MODERATE_SPOILAGE_RISK':
        days = 1; break;
      case 'HIGH_SPOILAGE_RISK':
        days = 0; break;
      default:
        days = 1; break;
    }
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    // Return YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async updateFoodExpiry(foodId, expirationDate) {
    try {
      const token = localStorage.getItem('jwt_token') || 
                    localStorage.getItem('sessionToken') || 
                    localStorage.getItem('session_token');
      if (!token) return false;
      const r = await fetch(`/api/users/food-items/${foodId}/expiry`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ expiration_date: expirationDate })
      });
      const j = await r.json();
      return !!(j && j.success);
    } catch (e) {
      console.error('Update expiry error:', e);
      return false;
    }
  }

  async updateFoodWithExpiry(name, category, expirationDate) {
    try {
      // Check if scanning was cancelled
      if (this.isScanningCancelled) {
        console.log('Expiry update cancelled - scanning was stopped by user');
        return false;
      }

      const token = localStorage.getItem('jwt_token') || 
                    localStorage.getItem('sessionToken') || 
                    localStorage.getItem('session_token');
      if (!token) return false;

      console.log('Updating existing food items with expiry:', { name, category, expirationDate });

      // Get existing food items for this food
      const response = await fetch(`/api/users/food-items?name=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (!result.success || !result.data || result.data.length === 0) {
        console.log('No existing food items found to update');
        return false;
      }

      // Update each existing food item with the new expiry date
      let anySuccess = false;
      for (const item of result.data) {
        const updateResponse = await fetch(`/api/users/food-items/${item.food_id}/expiry`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ expiration_date: expirationDate })
        });
        
        const updateResult = await updateResponse.json();
        if (updateResult.success) {
          anySuccess = true;
          console.log(`Updated food item ${item.food_id} with expiry: ${expirationDate}`);
        }
      }

      if (anySuccess) {
        try { document.dispatchEvent(new Event('food-item-updated')); } catch (_) {}
        return true;
      }
      return false;
    } catch (e) {
      console.error('Update food with expiry error:', e);
      return false;
    }
  }

  async resolvePreferredSensorId(token) {
    try {
      const res = await fetch('/api/sensor/devices', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.sensors || !Array.isArray(data.sensors)) return null;
      // sensors: [{ sensor_id, type, ... }]
      const byType = {};
      data.sensors.forEach(s => { if (s && s.type) byType[String(s.type).toLowerCase()] = s.sensor_id; });
      return byType['temperature'] || byType['humidity'] || byType['gas'] || null;
    } catch (_) {
      return null;
    }
  }

  async resolveAllSensorIds(token) {
    try {
      const res = await fetch('/api/sensor/devices', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !Array.isArray(data.sensors)) return [];
      // Return unique list of sensor_id values
      const ids = [];
      data.sensors.forEach(s => {
        if (s && typeof s.sensor_id !== 'undefined' && s.sensor_id !== null) ids.push(s.sensor_id);
      });
      return Array.from(new Set(ids));
    } catch (_) {
      return [];
    }
  }

  // Note: Skipped storeAiAnalysis because ai_analysis table does not exist
  clearFoodHistory() {
    if (!Array.isArray(this.foodHistory) || this.foodHistory.length === 0) {
      // Nothing to clear; just ensure UI shows empty state
      this.foodHistory = [];
      this.saveFoodHistory();
      this.renderFoodHistory();
      return;
    }

    const confirmed = confirm('Clear all food scanning history? This cannot be undone.');
    if (!confirmed) return;

    this.foodHistory = [];
    this.saveFoodHistory();
    this.renderFoodHistory();
  }

  renderFoodHistory() {
    const historyList = document.getElementById('foodHistoryList');
    if (!historyList) return;

    // Limit to 6 most recent items
    const recentHistory = this.foodHistory.slice(0, 6);

    if (recentHistory.length === 0) {
      historyList.innerHTML = `
        <div class="no-history">
          <i class="bi bi-clock-history"></i>
          <p>No food scanning history yet</p>
          <span>Start by selecting a food type above</span>
        </div>
      `;
      return;
    }

    const historyHTML = recentHistory.map(item => `
      <div class="food-history-item">
        <div class="food-history-info">
          <div class="food-history-details">
            <h4>${item.foodName}</h4>
            <p>Category: ${item.category || 'Unknown'}</p>
          </div>
        </div>
        <div class="food-history-meta">
          <div class="food-history-time">${item.time}</div>
          <div class="food-history-status ${item.status}">${this.getStatusText(item.status)}</div>
        </div>
      </div>
    `).join('');

    historyList.innerHTML = historyHTML;
    
    // Add scrolling if more than 6 items
    if (this.foodHistory.length > 6) {
      historyList.style.maxHeight = '300px';
      historyList.style.overflowY = 'auto';
      historyList.style.paddingRight = '10px';
      
      // Add scroll indicator
      const scrollIndicator = document.createElement('div');
      scrollIndicator.className = 'scroll-indicator';
      scrollIndicator.innerHTML = `
        <div class="scroll-indicator-content">
          <i class="bi bi-arrow-up"></i>
          <span>Scroll up to see more history</span>
        </div>
      `;
      historyList.appendChild(scrollIndicator);
      
      // Add show all button
      this.addShowAllButton();
    } else {
      historyList.style.maxHeight = 'none';
      historyList.style.overflowY = 'visible';
      historyList.style.paddingRight = '0';
    }
    
    // Update counter
    this.updateHistoryCounter(recentHistory.length);
  }

  filterFoodHistory(filter) {
    const historyList = document.getElementById('foodHistoryList');
    if (!historyList) return;

    let filteredHistory = [...this.foodHistory];
    const now = new Date();

    switch (filter) {
      case 'today':
        filteredHistory = this.foodHistory.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate.toDateString() === now.toDateString();
        });
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredHistory = this.foodHistory.filter(item => 
          new Date(item.timestamp) >= weekAgo
        );
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredHistory = this.foodHistory.filter(item => 
          new Date(item.timestamp) >= monthAgo
        );
        break;
      default:
        // 'all' - show all items
        break;
    }

    if (filteredHistory.length === 0) {
      historyList.innerHTML = `
        <div class="no-history">
          <i class="bi bi-search"></i>
          <p>No food history found for this period</p>
          <span>Try selecting a different time range</span>
        </div>
      `;
      return;
    }

    const historyHTML = filteredHistory.map(item => `
      <div class="food-history-item">
        <div class="food-history-info">
          <div class="food-history-icon">
            <i class="bi bi-${this.getFoodIcon(item.category)}"></i>
          </div>
          <div class="food-history-details">
            <h4>${item.foodName}</h4>
            <p>Category: ${item.category || 'Unknown'}</p>
          </div>
        </div>
        <div class="food-history-meta">
          <div class="food-history-time">${item.time}</div>
          <div class="food-history-status ${item.status}">${item.status}</div>
        </div>
      </div>
    `).join('');

    historyList.innerHTML = historyHTML;
  }


  getFoodIcon(category) {
    const iconMap = {
      'Fruits': 'apple',
      'Vegetables': 'carrot',
      'Meat': 'drumstick',
      'Seafood': 'fish',
      'Dairy': 'cup-hot',
      'Grains': 'wheat',
      'Other': 'egg-fried'
    };
    return iconMap[category] || 'egg-fried';
  }

  getStatusIcon(status) {
    const iconMap = {
      'scanned': 'check-circle-fill',
      'analyzed': 'check-circle-fill',
      'completed': 'check-circle-fill',
      'cancelled': 'x-circle-fill',
      'pending': 'clock-fill',
      'error': 'exclamation-circle-fill'
    };
    return iconMap[status] || 'question-circle-fill';
  }

  getStatusText(status) {
    const statusMap = {
      'scanned': 'Scanned',
      'analyzed': 'Analyzed',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'pending': 'Pending',
      'error': 'Error'
    };
    return statusMap[status] || status;
  }

  updateHistoryCounter(count) {
    const counter = document.getElementById('historyCount');
    if (counter) {
      counter.textContent = count;
    }
  }

  addShowAllButton() {
    // Remove existing show all button if any
    const existingBtn = document.getElementById('showAllHistoryBtn');
    if (existingBtn) {
      existingBtn.remove();
    }

    // Add show all button
    const showAllBtn = document.createElement('button');
    showAllBtn.id = 'showAllHistoryBtn';
    showAllBtn.className = 'btn btn-outline-primary btn-sm mt-2';
    showAllBtn.innerHTML = `<i class="bi bi-list-ul"></i> Show All (${this.foodHistory.length})`;
    showAllBtn.onclick = () => this.showAllHistory();

    const historyContainer = document.getElementById('foodHistoryList').parentElement;
    historyContainer.appendChild(showAllBtn);
  }

  showAllHistory() {
    const historyList = document.getElementById('foodHistoryList');
    if (!historyList) return;

    // Show all items
    const allHistoryHTML = this.foodHistory.map(item => `
      <div class="food-history-item">
        <div class="food-history-info">
          <div class="food-history-details">
            <h4>${item.foodName}</h4>
            <p>Category: ${item.category || 'Unknown'}</p>
          </div>
        </div>
        <div class="food-history-meta">
          <div class="food-history-time">${item.time}</div>
          <div class="food-history-status ${item.status}">${this.getStatusText(item.status)}</div>
        </div>
      </div>
    `).join('');

    historyList.innerHTML = allHistoryHTML;
    historyList.style.maxHeight = '500px';
    historyList.style.overflowY = 'auto';

    // Update button to show "Show Recent"
    const showAllBtn = document.getElementById('showAllHistoryBtn');
    if (showAllBtn) {
      showAllBtn.innerHTML = `<i class="bi bi-arrow-up"></i> Show Recent (5)`;
      showAllBtn.onclick = () => this.showRecentHistory();
    }

    // Update counter
    this.updateHistoryCounter(this.foodHistory.length);
  }

  showRecentHistory() {
    // Reset to show only recent 5 items
    this.renderFoodHistory();
  }

  // Automatically perform ML prediction with scanned data
  async autoTrainMLModel(sensorData) {
    // Check if scanning was cancelled before starting ML workflow
    if (this.isScanningCancelled) {
      console.log('ML workflow cancelled - scanning was stopped by user');
      return;
    }

    const trainingStatus = document.getElementById('autoTrainingStatus');
    
    if (trainingStatus) {
      trainingStatus.style.display = 'block';
      trainingStatus.innerHTML = `
        <div class="training-status-header">
          <h4>🔍 Checking ML Data...</h4>
          <p>Checking if training data already exists for this food</p>
        </div>
        <div class="training-status-items">
          <div class="status-item">
            <i class="bi bi-hourglass-split text-warning"></i>
            <span>Checking existing ML data...</span>
          </div>
        </div>
      `;
    }

    try {
      console.log('Performing ML prediction with sensor data:', sensorData);
      
      // First check if ML data already exists for this food
      const mlDataExists = await this.checkExistingMLData(this.selectedFood.name, this.selectedFood.category);
      
      if (mlDataExists) {
        // ML data already exists, stop the process
        if (trainingStatus) {
          trainingStatus.innerHTML = `
            <div class="training-status-header">
              <h4>✅ ML Data Already Exists</h4>
              <p>Training data for ${this.selectedFood.name} is already available</p>
            </div>
            <div class="training-status-items">
              <div class="status-item">
                <i class="bi bi-check-circle-fill text-success"></i>
                <span>ML data found for ${this.selectedFood.name}</span>
              </div>
              <div class="status-item">
                <i class="bi bi-info-circle text-info"></i>
                <span>No need to scan again - data already trained</span>
              </div>
            </div>
          `;
        }
        return; // Stop here if data already exists
      }

      // No ML data exists, proceed with scan
      if (trainingStatus) {
        const tVal = this.formatSensorValue(sensorData && sensorData.temperature);
        const hVal = this.formatSensorValue(sensorData && sensorData.humidity);
        // Gas may be named gas or gas_level depending on source
        const gRaw = (sensorData && (sensorData.gas_level ?? sensorData.gas));
        const gVal = this.formatSensorValue(gRaw);
        trainingStatus.innerHTML = `
          <div class="training-status-header">
            <h4>📊 Collecting Sensor Data</h4>
            <p>Temperature: ${tVal}°C | Humidity: ${hVal}% | Gas: ${gVal} ppm</p>
          </div>
          <div class="training-status-items">
            <div class="status-item">
              <i class="bi bi-check-circle-fill text-success"></i>
              <span>No existing ML data found</span>
            </div>
            <div class="status-item">
              <i class="bi bi-check-circle-fill text-success"></i>
              <span>Sensor data collected</span>
            </div>
            <div class="status-item">
              <i class="bi bi-hourglass-split text-warning"></i>
              <span>Processing with AI...</span>
            </div>
          </div>
        `;
      }

      // Perform ML prediction using the scanned data
      if (this.selectedFood && sensorData) {
        // Create or find food item for Smart Training
        let foodId = null;
        try {
          console.log('Creating/finding food item:', {
            name: this.selectedFood.name,
            category: this.selectedFood.category
          });
          
          // Update existing pending food items instead of creating new ones
          console.log('Updating existing pending food items to analyzed status...');
          const foodIds = await this.updateAllPendingFoodItems(this.selectedFood.name, this.selectedFood.category);
          console.log('Updated food items with IDs:', foodIds);
          
          // Use the first food item for ML processing
          foodId = foodIds[0];
          
          // Verify food ID is valid
          console.log('Food ID validation:', {
            foodId,
            type: typeof foodId,
            isValid: foodId && typeof foodId === 'number' && foodId > 0
          });
          
          // Validate the food ID
          if (!foodId || typeof foodId !== 'number' || foodId < 1) {
            console.log('No valid food ID returned, skipping ML processing');
            return; // Exit early instead of throwing error
          }
        } catch (error) {
          console.error('Food item handling failed:', error);
          // If food handling fails, we can't proceed with prediction
          if (trainingStatus) {
            trainingStatus.innerHTML = `
              <div class="training-status-header">
                <h4>❌ Food Item Handling Failed</h4>
                <p>Could not create or find food item in database</p>
              </div>
              <div class="training-status-items">
                <div class="status-item">
                  <i class="bi bi-exclamation-triangle text-danger"></i>
                  <span>Error: ${error.message}</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-info-circle text-info"></i>
                  <span>ML training data will not be uploaded</span>
                </div>
              </div>
            `;
          }
          return; // Stop the process completely if food handling fails
        }

        // Use AI analysis from the working analysis endpoint
        console.log('Getting AI analysis...');
        const aiAnalysisResult = await this.getAIAnalysis(
          this.selectedFood.name,
          sensorData
        );
        
        // Check if AI analysis was successful
        if (!aiAnalysisResult.success) {
          console.error('AI analysis failed:', aiAnalysisResult.error);
          if (trainingStatus) {
            trainingStatus.innerHTML = `
              <div class="training-status-header">
                <h4>⚠️ AI Analysis Failed</h4>
                <p>Using fallback analysis</p>
              </div>
              <div class="training-status-items">
                <div class="status-item">
                  <i class="bi bi-exclamation-triangle text-warning"></i>
                  <span>Error: ${aiAnalysisResult.error}</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-info-circle text-info"></i>
                  <span>Using fallback analysis for prediction</span>
                </div>
              </div>
            `;
          }
          // Continue with fallback analysis instead of stopping
        }
        
        // Get AI-assessed condition and table-assessed condition
        const aiCondition = aiAnalysisResult.success ? 
          this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe';
        const tableCondition = (this.assessFoodCondition(sensorData) || {}).condition || aiCondition;
        
        // Check if scanning was cancelled before ML workflow
        if (this.isScanningCancelled) {
          console.log('ML workflow cancelled - scanning was stopped by user');
          return;
        }
        
        // Only proceed with ML workflow if food creation was successful
        console.log('Proceeding with ML workflow using food ID:', foodId);
        // Persist SmartSense status into ML training table by sending tableCondition
        const mlWorkflowResult = await this.performMLWorkflow(
          foodId,
          this.selectedFood.name,
          this.selectedFood.category,
          sensorData,
          tableCondition,
          aiAnalysisResult
        );
        
        if (mlWorkflowResult.success) {
          console.log('ML workflow successful:', mlWorkflowResult);
          // Update the training status with ML workflow results
          if (trainingStatus) {
            const conditionIcon = tableCondition === 'safe' ? '🍎' : 
                                 tableCondition === 'caution' ? '⚠️' : '❌';
            const conditionText = tableCondition === 'safe' ? 'Fresh & Safe' : 
                                 tableCondition === 'caution' ? 'Getting Old' : 'Spoiled';
            
            const aiConfidence = aiAnalysisResult.success ? 
              (aiAnalysisResult.analysis.riskScore || 75) : 75;
            const aiAnalysis = aiAnalysisResult.success ? 
              (aiAnalysisResult.analysis.reasoning || 'AI analysis completed') : 'Fallback analysis used';
            
            trainingStatus.innerHTML = `
              <div class="training-status-header">
                <h4>🤖 Smart Training Complete!</h4>
                <p>New ML training data created and uploaded to database</p>
              </div>
              <div class="training-status-items">
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Sensor data collected</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-robot text-primary"></i>
                  <span>AI Analysis: ${conditionIcon} ${conditionText} (${aiConfidence}% confidence)</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>ML training data uploaded to database</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Prediction: ${mlWorkflowResult.spoilage_status}</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Confidence: ${mlWorkflowResult.confidence_score || aiConfidence}%</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-lightbulb text-warning"></i>
                  <span>AI Insight: ${aiAnalysis}</span>
                </div>
              </div>
            `;
          }
        } else {
          console.error('ML workflow failed:', mlWorkflowResult.error);
          // Still show food item was created even if ML workflow failed
          if (trainingStatus) {
            const conditionIcon = tableCondition === 'safe' ? '🍎' : 
                                 tableCondition === 'caution' ? '⚠️' : '❌';
            const conditionText = tableCondition === 'safe' ? 'Fresh & Safe' : 
                                 tableCondition === 'caution' ? 'Getting Old' : 'Spoiled';
            
            const aiConfidence = aiAnalysisResult.success ? 
              (aiAnalysisResult.analysis.riskScore || 75) : 75;
            const aiAnalysis = aiAnalysisResult.success ? 
              (aiAnalysisResult.analysis.reasoning || 'AI analysis completed') : 'Fallback analysis used';
            
            trainingStatus.innerHTML = `
              <div class="training-status-header">
                <h4>⚠️ Training Data Created (Prediction Failed)</h4>
                <p>ML data uploaded but prediction failed</p>
              </div>
              <div class="training-status-items">
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Sensor data collected</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-robot text-primary"></i>
                  <span>AI Analysis: ${conditionIcon} ${conditionText}</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>ML training data uploaded to database</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-exclamation-triangle text-warning"></i>
                  <span>Prediction failed: ${mlWorkflowResult.error || 'Unknown error'}</span>
                </div>
              </div>
            `;
          }
        }
      }
      
    } catch (error) {
      console.error('Error in ML prediction:', error);
      if (trainingStatus) {
        trainingStatus.innerHTML = `
          <div class="training-status-header">
            <h4>❌ Training Failed</h4>
            <p>Error occurred during ML training process</p>
          </div>
          <div class="training-status-items">
            <div class="status-item">
              <i class="bi bi-exclamation-triangle text-danger"></i>
              <span>Error: ${error.message}</span>
            </div>
          </div>
        `;
      }
    }
  }

  // Assess food condition using table thresholds (image) with DB as source-of-truth when available
  assessFoodCondition(sensorData) {
    const temperature = sensorData.temperature?.value;
    const humidity = sensorData.humidity?.value;
    const gasLevel = sensorData.gas?.value;

    // If any sensor data is missing, return safe condition
    if (temperature === undefined || humidity === undefined || gasLevel === undefined) {
      console.warn('Missing sensor data for condition assessment, defaulting to safe');
      return 'safe';
    }

    // Basis table from provided image (MQ4 = gas)
    const basis = {
      'banana':    { spoiled: { gas:190, temp:25, humidity:83 }, normal: { gas:3,   temp:35, humidity:70 } },
      'carrot':    { spoiled: { gas:161, temp:30, humidity:45 }, normal: { gas:2,   temp:32, humidity:30 } },
      'taro root': { spoiled: { gas:170, temp:30, humidity:60 }, normal: { gas:2,   temp:40, humidity:40 } }
    };

    const lowerName = String(this.selectedFood?.name || '').toLowerCase();
    const key = Object.keys(basis).find(k => lowerName.includes(k)) || null;

    // If matched in table: decide by distance to normal vs spoiled vectors
    if (key) {
      const b = basis[key];
      // Hard safety rules: if readings are at/above spoiled thresholds, mark unsafe
      if (gasLevel >= b.spoiled.gas || humidity >= b.spoiled.humidity) {
        return {
          condition: 'unsafe',
          spoilageScore: 95,
          temperature,
          humidity,
          gasLevel,
          assessment: { basis: key, rule: 'exceeded_spoiled_thresholds' }
        };
      }
      const rng = {
        gas: Math.max(b.spoiled.gas, b.normal.gas) - Math.min(b.spoiled.gas, b.normal.gas) || 1,
        temp: Math.max(b.spoiled.temp, b.normal.temp) - Math.min(b.spoiled.temp, b.normal.temp) || 1,
        humidity: Math.max(b.spoiled.humidity, b.normal.humidity) - Math.min(b.spoiled.humidity, b.normal.humidity) || 1
      };
      const w = { gas: 0.5, temp: 0.25, humidity: 0.25 };
      const dSpoil =
        w.gas * Math.abs(gasLevel - b.spoiled.gas) / rng.gas +
        w.temp * Math.abs(temperature - b.spoiled.temp) / rng.temp +
        w.humidity * Math.abs(humidity - b.spoiled.humidity) / rng.humidity;
      const dNormal =
        w.gas * Math.abs(gasLevel - b.normal.gas) / rng.gas +
        w.temp * Math.abs(temperature - b.normal.temp) / rng.temp +
        w.humidity * Math.abs(humidity - b.normal.humidity) / rng.humidity;

      const ratio = dNormal / (dSpoil + dNormal); // closer to 0 => spoiled, 1 => normal
      let condition = 'safe';
      if (ratio < 0.45) condition = 'unsafe';
      else if (ratio < 0.6) condition = 'caution';

      return {
        condition,
        spoilageScore: Math.round((1 - ratio) * 100),
        temperature,
        humidity,
        gasLevel,
        assessment: {
          basis: key,
          dSpoil: Number(dSpoil.toFixed(3)),
          dNormal: Number(dNormal.toFixed(3))
        }
      };
    }

    // Fallback generic model if food not in table. This is used only when
    // no table row applies; DB-driven analysis still happens elsewhere.
    let spoilageScore = 0;
    if (temperature > 15) spoilageScore += 40; else if (temperature > 10) spoilageScore += 25; else if (temperature > 7) spoilageScore += 10; else if (temperature < 0) spoilageScore += 5;
    if (humidity > 85) spoilageScore += 30; else if (humidity > 75) spoilageScore += 20; else if (humidity > 70) spoilageScore += 10; else if (humidity < 40) spoilageScore += 5;
    if (gasLevel > 60) spoilageScore += 35; else if (gasLevel > 40) spoilageScore += 25; else if (gasLevel > 25) spoilageScore += 15; else if (gasLevel > 15) spoilageScore += 5;

    const condition = spoilageScore >= 70 ? 'unsafe' : spoilageScore >= 40 ? 'caution' : 'safe';
    return {
      condition,
      spoilageScore,
      temperature,
      humidity,
      gasLevel,
      assessment: {
        tempRisk: temperature > 10 ? 'high' : temperature > 7 ? 'medium' : 'low',
        humidityRisk: humidity > 80 ? 'high' : humidity > 70 ? 'medium' : 'low',
        gasRisk: gasLevel > 40 ? 'high' : gasLevel > 25 ? 'medium' : 'low'
      }
    };
  }

  // Create AI-powered training data from Smart Training scan
  async createAITrainingData(foodName, foodCategory, sensorData) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/ai/training-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_name: foodName,
          food_category: foodCategory,
          temperature: sensorData.temperature?.value,
          humidity: sensorData.humidity?.value,
          gas_level: sensorData.gas?.value,
          sensor_data: {
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            gas: sensorData.gas,
            timestamp: new Date().toISOString()
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('AI training data created successfully:', result);
        return result;
      } else {
        console.error('Failed to create AI training data:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error creating AI training data:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Get AI analysis using the working analysis endpoint
  async getAIAnalysis(foodName, sensorData) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      // Validate sensor data
      if (!sensorData) {
        throw new Error('No sensor data available');
      }

      const temp = sensorData.temperature?.value;
      const humidity = sensorData.humidity?.value;
      const gas = sensorData.gas?.value;

      if (temp === undefined || humidity === undefined || gas === undefined) {
        throw new Error('Missing required sensor readings: temperature, humidity, or gas level');
      }

      const response = await fetch('/api/ai/ai-analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          foodType: foodName,
          temp: temp,
          humidity: humidity,
          gas: gas
        })
      });

      const result = await response.json();
      
      if (result.analysis) {
        console.log('AI analysis completed successfully:', result.analysis);
        return { success: true, analysis: result.analysis };
      } else {
        console.error('Failed to get AI analysis:', result.error);
        return { success: false, error: result.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('Error getting AI analysis:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Map risk level from analysis to spoilage status
  mapRiskLevelToSpoilageStatus(riskLevel) {
    switch (riskLevel?.toLowerCase()) {
      case 'high':
        return 'unsafe';
      case 'medium':
        return 'caution';
      case 'low':
        return 'safe';
      default:
        return 'safe';
    }
  }

  // Perform complete ML workflow for Smart Training
  async performMLWorkflow(foodId, foodName, foodCategory, sensorData, spoilageStatus, aiAnalysisResult) {
    try {
      // Check if scanning was cancelled
      if (this.isScanningCancelled) {
        console.log('ML workflow cancelled - scanning was stopped by user');
        return { success: false, error: 'Scanning cancelled by user' };
      }

      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      // Validate sensor data
      if (!sensorData) {
        throw new Error('No sensor data available for ML workflow');
      }

      const temp = sensorData.temperature?.value;
      const humidity = sensorData.humidity?.value;
      const gas = sensorData.gas?.value;

      if (temp === undefined || humidity === undefined || gas === undefined) {
        throw new Error('Missing required sensor readings: temperature, humidity, or gas level');
      }

      // Step 1: Store training data
      console.log('Storing training data...', {
        food_name: foodName,
        food_category: foodCategory,
        temperature: temp,
        humidity: humidity,
        gas_level: gas,
        spoilage_status: spoilageStatus
      });
      
      const trainingResponse = await fetch('/api/ml-workflow/training-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-Scan-Id': this._scanId || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_name: foodName,
          food_category: foodCategory,
          temperature: temp,
          humidity: humidity,
          gas_level: gas,
          spoilage_status: spoilageStatus,
          confidence_score: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.riskScore || 75) : 75,
          storage_conditions: {
            temperature: temp,
            humidity: humidity,
            gas_level: gas,
            timestamp: new Date().toISOString()
          }
        })
      });

      console.log('Training data response status:', trainingResponse.status);
      const trainingResult = await trainingResponse.json();
      console.log('Training data response:', trainingResult);
      
      if (!trainingResult.success) {
        throw new Error('Failed to store training data: ' + trainingResult.error);
      }

      // Step 2: Generate ML prediction
      console.log('Generating ML prediction...', {
        food_id: foodId,
        food_name: foodName,
        food_category: foodCategory,
        spoilage_status: spoilageStatus
      });
      
      const predictionResponse = await fetch('/api/ml-workflow/predict', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-Scan-Id': this._scanId || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_id: foodId,
          food_name: foodName,
          food_category: foodCategory,
          temperature: temp,
          humidity: humidity,
          gas_level: gas,
          spoilage_probability: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.riskScore || 75) : 75,
          spoilage_status: spoilageStatus,
          confidence_score: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.riskScore || 75) : 75,
          recommendations: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.recommendations || []) : []
        })
      });

      console.log('Prediction response status:', predictionResponse.status);
      const predictionResult = await predictionResponse.json();
      console.log('Prediction response:', predictionResult);
      
      if (!predictionResult.success) {
        throw new Error('Failed to generate ML prediction: ' + predictionResult.error);
      }

      // Step 3: Update food item with sensor data and scan status
      console.log('Updating food item with sensor data...', {
        food_id: foodId,
        scan_status: 'analyzed',
        scan_timestamp: new Date().toISOString()
      });
      
      const updateResponse = await fetch('/api/ml-workflow/update-food-item', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-Scan-Id': this._scanId || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_id: foodId,
          scan_status: 'analyzed',
          scan_timestamp: new Date().toISOString(),
          sensor_data: {
            temperature: temp,
            humidity: humidity,
            gas_level: gas,
            timestamp: new Date().toISOString()
          }
        })
      });

      const updateResult = await updateResponse.json();
      console.log('Food item update response:', updateResult);
      
      if (!updateResult.success) {
        console.error('Failed to update food item with sensor data:', updateResult.error);
        throw new Error('Failed to update food item scan status: ' + updateResult.error);
      } else {
        console.log('Food item updated successfully with scan_status: analyzed');
      }

      console.log('ML workflow completed successfully');
      return {
        success: true,
        training_id: trainingResult.training_id,
        prediction_id: predictionResult.prediction_id,
        spoilage_status: spoilageStatus,
        spoilage_probability: aiAnalysisResult.success ? 
          (aiAnalysisResult.analysis.riskScore || 75) : 75,
        confidence_score: aiAnalysisResult.success ? 
          (aiAnalysisResult.analysis.riskScore || 75) : 75
      };

    } catch (error) {
      console.error('Error in ML workflow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create training data from Smart Training scan (fallback)
  async createTrainingData(foodName, foodCategory, sensorData, actualCondition) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      const trainingData = {
        food_name: foodName,
        food_category: foodCategory,
        temperature: temp,
        humidity: humidity,
        gas_level: gas,
        actual_spoilage_status: actualCondition,
        data_source: 'sensor',
        quality_score: 1.0
      };

      const response = await fetch('/api/ml/training-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trainingData)
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Training data created successfully:', result);
      } else {
        console.error('Failed to create training data:', result.error);
      }
    } catch (error) {
      console.error('Error creating training data:', error);
    }
  }

  // Find existing pending food item or create new one
  async findAllPendingFoodItems(foodName, foodCategory) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      // Search for existing food items
      console.log('Searching for all pending food items...');
      const searchResponse = await fetch('/api/users/food-items', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to search for food items');
      }

      const searchResult = await searchResponse.json();
      console.log('Existing food items:', searchResult);
      
      // Find all pending food items with matching name and category
      if (searchResult.success && searchResult.food_items) {
        const pendingItems = searchResult.food_items.filter(item => 
          item.name.toLowerCase() === foodName.toLowerCase() && 
          item.category === foodCategory &&
          item.scan_status === 'pending'
        );
        
        console.log(`Found ${pendingItems.length} pending food items:`, pendingItems);
        return pendingItems;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error finding all pending food items:', error);
      throw error;
    }
  }

  async findPendingFoodItem(foodName, foodCategory) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      // Search for existing food items
      console.log('Searching for pending food items...');
      const searchResponse = await fetch('/api/users/food-items', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to search for food items');
      }

      const searchResult = await searchResponse.json();
      console.log('Existing food items:', searchResult);
      
      // Look for pending food item with matching name and category
      if (searchResult.success && searchResult.food_items) {
        const pendingItem = searchResult.food_items.find(item => 
          item.name.toLowerCase() === foodName.toLowerCase() && 
          item.category === foodCategory &&
          item.scan_status === 'pending'
        );
        
        if (pendingItem) {
          console.log('Found pending food item:', pendingItem);
          return pendingItem.food_id;
        } else {
          throw new Error(`No pending food item found for ${foodName} (${foodCategory})`);
        }
      } else {
        throw new Error('No food items found in database');
      }
    } catch (error) {
      console.error('Error finding pending food item:', error);
      throw error;
    }
  }


  async findExistingFoodItem(foodName, foodCategory) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      // Search for existing food items
      console.log('Searching for existing food items...');
      const searchResponse = await fetch('/api/users/food-items', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to search for food items');
      }

      const searchResult = await searchResponse.json();
      console.log('Existing food items:', searchResult);
      
      // Look for food item with matching name and category
      if (searchResult.success && searchResult.food_items) {
        const existingItem = searchResult.food_items.find(item => 
          item.name.toLowerCase() === foodName.toLowerCase() && 
          item.category === foodCategory
        );
        
        if (existingItem) {
          console.log('Found existing food item:', existingItem);
          return existingItem.food_id;
        } else {
          throw new Error(`No existing food item found for ${foodName} (${foodCategory})`);
        }
      } else {
        throw new Error('No food items found in database');
      }
    } catch (error) {
      console.error('Error finding existing food item:', error);
      throw error;
    }
  }

  // Get user's sensor IDs from the database
  async getUserSensorIds() {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('No authentication token available');
      }

      console.log('Fetching user sensor IDs...');
      const response = await fetch('/api/sensor/devices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sensors');
      }

      const result = await response.json();
      console.log('Sensors response:', result);
      
      if (result.success && result.sensors) {
        const sensorIds = result.sensors.map(sensor => sensor.sensor_id);
        console.log('Extracted sensor IDs:', sensorIds);
        return sensorIds;
      } else {
        console.warn('No sensors found in response');
        return [];
      }
    } catch (error) {
      console.error('Error fetching user sensor IDs:', error);
      return [];
    }
  }

  // Calculate expiration date based on food category
  calculateExpirationDate(foodCategory) {
    const today = new Date();
    let daysToAdd = 7; // Default 7 days
    
    switch (foodCategory.toLowerCase()) {
      case 'meat':
        daysToAdd = 3; // Meat expires in 3 days
        break;
      case 'vegetable':
        daysToAdd = 5; // Vegetables expire in 5 days
        break;
      case 'fruit':
        daysToAdd = 7; // Fruits expire in 7 days
        break;
      case 'dairy':
        daysToAdd = 4; // Dairy expires in 4 days
        break;
      default:
        daysToAdd = 7; // Default 7 days
    }
    
    const expirationDate = new Date(today);
    expirationDate.setDate(today.getDate() + daysToAdd);
    
    return expirationDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }

  // Update all pending food items to analyzed status using existing API
  async updateAllPendingFoodItems(foodName, foodCategory) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('No authentication token available');
      }

      console.log('Updating all pending food items to analyzed status:', { foodName, foodCategory });

      // Use the backend endpoint to handle the logic
      const updateResponse = await fetch('/api/ml-workflow/update-all-pending', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_name: foodName,
          food_category: foodCategory
        })
      });

      const updateResult = await updateResponse.json();
      console.log('Update all pending response:', updateResult);
      
      if (updateResult.success) {
        console.log(`Updated ${updateResult.updated_count} food items to analyzed status`);
        
        // Get the updated food items to return their IDs
        const getResponse = await fetch(`/api/users/food-items?status=analyzed&name=${encodeURIComponent(foodName)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          }
        });

        const getResult = await getResponse.json();
        if (getResult.success && getResult.data && getResult.data.length > 0) {
          const foodIds = getResult.data.map(item => item.food_id);
          console.log('Returning food IDs:', foodIds);
          return foodIds;
        } else {
          // If we can't get the IDs, try to get any food items for this food
          console.log('Could not get updated food IDs, trying to get any food items for this food...');
          const fallbackResponse = await fetch(`/api/users/food-items?name=${encodeURIComponent(foodName)}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          const fallbackResult = await fallbackResponse.json();
          if (fallbackResult.success && fallbackResult.data && fallbackResult.data.length > 0) {
            const foodIds = fallbackResult.data.map(item => item.food_id);
            console.log('Returning fallback food IDs:', foodIds);
            return foodIds;
          } else {
            console.log('No food items found, returning empty array');
            return [];
          }
        }
      } else {
        console.error('Failed to update pending food items:', updateResult.error);
        // Don't create new items, just return empty array
        console.log('Update failed, returning empty array');
        return [];
      }
    } catch (error) {
      console.error('Error updating pending food items:', error);
      // Don't create new items, just return empty array
      console.log('Error occurred, returning empty array');
      return [];
    }
  }

  // Create multiple food items with analyzed status (for multiple sensors)
  async createMultipleFoodItemsWithAnalyzedStatus(foodName, foodCategory, count = 3) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('No authentication token available');
      }

      console.log(`Creating ${count} food items with analyzed status:`, { foodName, foodCategory });

      // Get user's actual sensor IDs first
      const sensorIds = await this.getUserSensorIds();
      console.log('User sensor IDs:', sensorIds);

      if (sensorIds.length === 0) {
        throw new Error('No sensors found for user. Please add sensors first.');
      }

      const foodIds = [];
      const currentTime = new Date().toISOString();

      // Create multiple food items in parallel
      const createPromises = [];
      for (let i = 0; i < count; i++) {
        const sensorId = sensorIds[i] || null; // Use actual sensor ID or null
        createPromises.push(
          fetch('/api/users/food-items', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: foodName,
              category: foodCategory,
              scan_status: 'analyzed',
              scan_timestamp: currentTime,
              expiration_date: this.calculateExpirationDate(foodCategory),
              sensor_id: sensorId // Use actual sensor ID from database
            })
          })
        );
      }

      const responses = await Promise.all(createPromises);
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const result = await response.json();
        
        if (result.success && result.food_id) {
          foodIds.push(result.food_id);
          console.log(`Food item ${i + 1} created successfully with analyzed status, ID:`, result.food_id);
        } else {
          console.error(`Food item ${i + 1} creation failed:`, result);
          throw new Error(`Food item ${i + 1} creation failed: ${result.message || 'Unknown error'}`);
        }
      }

      console.log(`Successfully created ${foodIds.length} food items with analyzed status:`, foodIds);
      return foodIds;
    } catch (error) {
      console.error('Error creating multiple food items with analyzed status:', error);
      throw error;
    }
  }

  // Create food item with analyzed status directly
  async createFoodItemWithAnalyzedStatus(foodName, foodCategory) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('No authentication token available');
      }

      console.log('Creating food item with analyzed status:', { foodName, foodCategory });

      const response = await fetch('/api/users/food-items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: foodName,
          category: foodCategory,
          scan_status: 'analyzed',
          scan_timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();
      console.log('Food creation response:', result);
      
      if (result.success && result.food_id) {
        console.log('Food item created successfully with analyzed status, ID:', result.food_id);
        return result.food_id;
      } else {
        console.error('Food creation failed:', result);
        throw new Error(result.message || 'Food item creation failed');
      }
    } catch (error) {
      console.error('Error creating food item with analyzed status:', error);
      throw error;
    }
  }

  // Create food item in database
  async createFoodItem(foodName, foodCategory, scanTimestamp = null) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/users/food-items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: foodName,
          category: foodCategory,
          scan_timestamp: scanTimestamp
        })
      });

      const result = await response.json();
      
      console.log('Food creation response:', result);
      
      if (result.success && result.food_id) {
        console.log('Food item created successfully with ID:', result.food_id);
        return result.food_id;
      } else {
        console.error('Food creation failed:', result);
        throw new Error(result.message || 'Food item creation failed');
      }
    } catch (error) {
      console.error('Error creating food item:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  // Perform ML prediction using existing training data
  async performMLPrediction(foodId, foodName, foodCategory, sensorData, actualOutcome = null, isTrainingData = false) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        return { success: false, error: 'Authentication required' };
      }

      // Ensure we have a valid foodId
      if (!foodId) {
        console.warn('No foodId provided, using temporary ID');
        foodId = Date.now();
      }

      const predictionData = {
        food_id: foodId,
        food_name: foodName,
        food_category: foodCategory,
        temperature: sensorData.temperature?.value || null,
        humidity: sensorData.humidity?.value || null,
        gas_level: sensorData.gas?.value || null,
        actual_outcome: actualOutcome,
        is_training_data: isTrainingData ? 1 : 0
      };

      console.log('Performing ML prediction:', predictionData);

      const response = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(predictionData)
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('ML prediction successful:', result);
        return { success: true, prediction: result.prediction };
      } else {
        console.error('ML prediction failed:', result.error);
        return { success: false, error: result.error || 'Prediction failed' };
      }
    } catch (error) {
      console.error('Error performing ML prediction:', error);
      return { success: false, error: error.message };
    }
  }

  // Validate food name against category
  validateFoodCategory(foodName, category) {
    const foodNameLower = foodName.toLowerCase();
    
    // Define food keywords for each category
    const categoryKeywords = {
      'Fruits': ['apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'lemon', 'lime', 'peach', 'pear', 'cherry', 'mango', 'pineapple', 'watermelon', 'kiwi', 'avocado', 'berry', 'citrus', 'melon'],
      'Vegetables': ['carrot', 'broccoli', 'spinach', 'lettuce', 'tomato', 'potato', 'onion', 'garlic', 'pepper', 'cucumber', 'cabbage', 'cauliflower', 'celery', 'corn', 'bean', 'pea', 'radish', 'beet', 'squash', 'zucchini', 'eggplant', 'mushroom'],
      'Meat': ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'steak', 'chop', 'rib', 'sausage', 'bacon', 'ham', 'meatball', 'burger', 'patty', 'cutlet', 'tenderloin', 'sirloin', 'breast', 'thigh', 'wing', 'leg', 'roast'],
      'Seafood': ['fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'oyster', 'mussel', 'clam', 'scallop', 'squid', 'octopus', 'cod', 'halibut', 'mackerel', 'sardine', 'anchovy', 'caviar', 'seaweed'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'sour cream', 'cottage cheese', 'mozzarella', 'cheddar', 'parmesan', 'ricotta', 'feta', 'gouda', 'swiss', 'brie', 'camembert', 'ice cream', 'whey'],
      'Grains': ['rice', 'wheat', 'bread', 'pasta', 'noodle', 'cereal', 'oats', 'barley', 'quinoa', 'buckwheat', 'corn', 'flour', 'dough', 'bagel', 'muffin', 'cracker', 'cookie', 'cake', 'pie', 'pancake', 'waffle']
    };

    // Check if food name contains keywords from the selected category
    const categoryWords = categoryKeywords[category] || [];
    const hasCategoryKeyword = categoryWords.some(keyword => foodNameLower.includes(keyword));

    // Check for obvious mismatches
    const mismatchExamples = {
      'Fruits': ['meat', 'chicken', 'beef', 'pork', 'fish', 'milk', 'cheese', 'bread', 'vegetable'],
      'Vegetables': ['meat', 'chicken', 'beef', 'pork', 'fish', 'milk', 'cheese', 'bread', 'fruit'],
      'Meat': ['apple', 'banana', 'carrot', 'broccoli', 'milk', 'cheese', 'bread', 'fruit', 'vegetable'],
      'Seafood': ['chicken', 'beef', 'pork', 'apple', 'carrot', 'milk', 'cheese', 'bread', 'fruit', 'vegetable'],
      'Dairy': ['chicken', 'beef', 'pork', 'fish', 'apple', 'carrot', 'bread', 'fruit', 'vegetable'],
      'Grains': ['chicken', 'beef', 'pork', 'fish', 'apple', 'carrot', 'milk', 'cheese', 'fruit', 'vegetable']
    };

    const mismatchWords = mismatchExamples[category] || [];
    const hasMismatchKeyword = mismatchWords.some(keyword => foodNameLower.includes(keyword));

    if (hasMismatchKeyword && !hasCategoryKeyword) {
      return {
        isValid: false,
        message: `⚠️ Warning: "${foodName}" doesn't seem to match the "${category}" category. Please check if this is correct.`
      };
    }

    return { isValid: true };
  }

  // Show food validation error
  showFoodValidationError(message, foodName, category) {
    // Create validation modal
    const validationModal = document.createElement('div');
    validationModal.className = 'food-validation-modal';
    validationModal.innerHTML = `
      <div class="validation-modal-content">
        <div class="validation-header">
          <h3>🍎 Food Category Mismatch</h3>
        </div>
        <div class="validation-body">
          <p>${message}</p>
          <div class="validation-examples">
            <p><strong>Examples for "${category}" category:</strong></p>
            <ul>
              ${this.getCategoryExamples(category).map(example => `<li>${example}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="validation-actions">
          <button class="validation-cancel-btn" onclick="this.closest('.food-validation-modal').remove()">
            Cancel
          </button>
          <button class="validation-continue-btn" onclick="this.continueWithValidation('${foodName}', '${category}')">
            Continue Anyway
          </button>
        </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(validationModal);
    document.body.style.overflow = 'hidden';

    // Add continue function
    window.continueWithValidation = (name, cat) => {
      if (this.isScanningInProgress) {
        console.warn('Scan already in progress. Ignoring duplicate continue.');
        return;
      }
      validationModal.remove();
      document.body.style.overflow = '';
      
      // Continue with the food selection
      this.selectedFood = {
        id: 'custom',
        name: name,
        category: cat
      };
      
      this.addToFoodHistory(name, cat, 'scanned');
      this.closeFoodSelectionModal();
      this.showFoodSelectedConfirmation(this.selectedFood);
      this.isScanningInProgress = true;
      this.startSensorPollingAndPredict();
    };
  }

  // Add cancel button to the scanning UI
  addCancelButton() {
    const waitEl = document.getElementById('sensorWaitIndicator');
    if (waitEl && !document.getElementById('cancelScanBtn')) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancelScanBtn';
      cancelBtn.className = 'btn btn-outline-danger btn-sm mt-3';
      cancelBtn.innerHTML = '<i class="bi bi-x-circle"></i> Cancel Scanning';
      cancelBtn.onclick = () => this.cancelScanning();
      
      waitEl.appendChild(cancelBtn);
    }
  }

  // Cancel the scanning process
  cancelScanning() {
    console.log('User cancelled scanning');
    this.isScanningCancelled = true;
    
    // Add cancelled item to history
    if (this.selectedFood) {
      this.addToFoodHistory(
        this.selectedFood.name, 
        this.selectedFood.category, 
        'cancelled'
      );
    }
    
    // Remove cancel button
    const cancelBtn = document.getElementById('cancelScanBtn');
    if (cancelBtn) {
      cancelBtn.remove();
    }
    
    // Stop loading state
    const waitEl = document.getElementById('sensorWaitIndicator');
    const okBtn = document.getElementById('okFoodSelected');
    
    if (waitEl) waitEl.style.display = 'none';
    if (okBtn) {
      okBtn.disabled = false;
      okBtn.textContent = 'OK';
    }
    
    // Complete scan session when scanning is cancelled
    try {
      this.completeScanSession();
    } catch (error) {
      console.error('Failed to complete scan session after cancellation:', error);
    }
    
    // Show cancelled message
    this.showCancelledMessage();
  }

  // Show cancelled message
  showCancelledMessage() {
    const trainingStatus = document.getElementById('trainingStatus');
    if (trainingStatus) {
      trainingStatus.innerHTML = `
        <div class="training-status-header">
          <h4>❌ Scanning Cancelled</h4>
          <p>You cancelled the scanning process</p>
        </div>
        <div class="training-status-items">
          <div class="status-item">
            <i class="bi bi-x-circle text-danger"></i>
            <span>Scanning stopped by user</span>
          </div>
          <div class="status-item">
            <i class="bi bi-info-circle text-info"></i>
            <span>No data was processed or saved</span>
          </div>
        </div>
        <div class="mt-3">
          <button class="btn btn-primary btn-sm" onclick="location.reload()">
            <i class="bi bi-arrow-clockwise"></i> Start Over
          </button>
        </div>
      `;
    }
  }

  // Get examples for each category
  getCategoryExamples(category) {
    const examples = {
      'Fruits': ['Apple', 'Banana', 'Orange', 'Strawberry', 'Grape'],
      'Vegetables': ['Carrot', 'Broccoli', 'Tomato', 'Lettuce', 'Onion'],
      'Meat': ['Chicken Breast', 'Beef Steak', 'Pork Chop', 'Ground Beef', 'Turkey'],
      'Seafood': ['Salmon', 'Shrimp', 'Tuna', 'Crab', 'Lobster'],
      'Dairy': ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Cream'],
      'Grains': ['Rice', 'Bread', 'Pasta', 'Oats', 'Quinoa']
    };
    return examples[category] || ['Example 1', 'Example 2', 'Example 3'];
  }

  // Check if ML data already exists for this food
  async checkExistingMLData(foodName, foodCategory) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.warn('No authentication token for ML data check');
        return false;
      }

      // Check if training data exists for this food
      const response = await fetch(`/api/ml/check?food_name=${encodeURIComponent(foodName)}&food_category=${encodeURIComponent(foodCategory)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Safely parse JSON; backend should return JSON, but guard against HTML error pages
      const text = await response.text();
      let result = {};
      try { result = JSON.parse(text); } catch (_) { return false; }
      return result.exists || false;

    } catch (error) {
      console.warn('ML data check failed (non-critical):', error.message);
      return false; // Assume no data exists if check fails
    }
  }

  // Automatically fill missing data with AI (silent background process)
  async autoFillMissingData() {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.warn('No authentication token for auto-fill');
        return;
      }

      // Call AI data filling API silently
      const response = await fetch('/api/ai/fill-food-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          force_update: false // Only fill missing data
        })
      });

      const result = await response.json();
      
      if (result.success && result.processed > 0) {
        console.log(`🤖 AI automatically filled data for ${result.processed} food items`);
      }

    } catch (error) {
      console.warn('Auto-fill data failed (non-critical):', error.message);
    }
  }
}

// Make FoodSelection globally available
window.FoodSelection = FoodSelection;

// Global function to initialize food selection
window.initFoodSelection = function() {
    if (!window.foodSelection) {
        window.foodSelection = new FoodSelection();
        console.log('Food selection initialized via global function');
    }
};

// Initialize food selection when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize if food selection button exists
  if (document.getElementById('selectFoodBtn')) {
    window.foodSelection = new FoodSelection();
  }
});

// Re-bind buttons and refresh history after SPA navigations
window.addEventListener('spa:navigate:after', (e) => {
  const to = (e && e.detail && e.detail.to) || '';
  if (to === 'dashboard') {
    // Ensure instance exists
    if (!window.foodSelection) {
      window.foodSelection = new FoodSelection();
      return;
    }
    // Re-attach essential listeners if DOM re-rendered
    try { window.foodSelection.setupEventListeners(); } catch(_) {}
    // Re-render training history from localStorage
    try { window.foodSelection.renderFoodHistory(); } catch(_) {}
  }
});
