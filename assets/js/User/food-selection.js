// food-selection.js - Food selection functionality for IoT scanning

// Helper function to get user ID from JWT token
function getUserIdFromToken() {
  try {
    const token = localStorage.getItem('jwt_token') || 
                  localStorage.getItem('sessionToken') || 
                  localStorage.getItem('session_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'));
    const payload = JSON.parse(payloadJson);
    // Common claim keys
    return payload.user_id || payload.id || payload.uid || null;
  } catch (e) {
    console.warn('Unable to decode JWT payload:', e);
    return null;
  }
}

// Helper function to get current user ID (from token or localStorage)
function getCurrentUserId() {
  // Try JWT token first
  const userIdFromToken = getUserIdFromToken();
  if (userIdFromToken) {
    return userIdFromToken;
  }
  
  // Fallback to localStorage
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      return user.user_id;
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }
  
  return null;
}

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

  /**
   * Get authentication token with fallback to multiple keys
   */
  getAuthToken() {
    return localStorage.getItem('jwt_token') || 
           localStorage.getItem('sessionToken') || 
           localStorage.getItem('session_token');
  }

  /**
   * Get the current logged-in user ID from localStorage
   */
  getCurrentUserId() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        return user.user_id || null;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  // Gas emission threshold analysis function
  analyzeGasEmissionThresholds(gasLevel) {
    if (gasLevel >= 400) {
      // High Risk (400+ ppm) - Severe Spoilage Detected
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 98,
        confidence: 95,
        recommendation: 'CRITICAL: Severe Spoilage Detected (400+ ppm). Do not consume. Dispose immediately to avoid foodborne illness. Sanitize storage area thoroughly.',
        threshold: '400+ ppm'
      };
    } else if (gasLevel >= 200) {
      // High Risk (200-399 ppm) - Advanced Spoilage
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 90,
        confidence: 90,
        recommendation: 'CRITICAL: Advanced Spoilage Detected (200-399 ppm). Do not consume. Dispose immediately. Check for strong odors, discoloration, or slimy texture.',
        threshold: '200-399 ppm'
      };
    } else if (gasLevel >= 100) {
      // High Risk (100-199 ppm) - Spoilage Detected
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 85,
        confidence: 88,
        recommendation: 'CRITICAL: Spoilage Detected (100-199 ppm). Food is unsafe to consume. Dispose immediately. Inspect for off-odors, discoloration, or texture changes.',
        threshold: '100-199 ppm'
      };
    } else if (gasLevel >= 70) {
      // High Risk (70-99 ppm) - Spoilage Detected (Based on observations)
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 80,
        confidence: 85,
        recommendation: 'CRITICAL: Spoilage Detected (70-99 ppm). Food is unsafe to consume. Based on sensor observations, gas levels above 70 ppm indicate spoilage. Dispose immediately if strong smell or rot is observed.',
        threshold: '70-99 ppm'
      };
    } else if (gasLevel >= 50) {
      // Medium Risk (50-69 ppm) - Early Warning Signs
      return {
        riskLevel: 'medium',
        status: 'caution',
        probability: 60,
        confidence: 85,
        recommendation: 'WARNING: Elevated Gas Levels (50-69 ppm). Food may be starting to spoil. Inspect carefully for any signs of spoilage (smell, color, texture). Consume within 3 hours or discard if suspicious.',
        threshold: '50-69 ppm'
      };
    } else if (gasLevel >= 0) {
      // Low Risk (0-49 ppm) - Fresh/Safe
      return {
        riskLevel: 'low',
        status: 'safe',
        probability: 20,
        confidence: 90,
        recommendation: 'Low Risk: Fresh/Safe (0-49 ppm). Food is safe to consume and store. Keep in a cool, dry place or refrigerate if needed.',
        threshold: '0-49 ppm'
      };
    }
    
    // Invalid gas level
    return {
      riskLevel: 'unknown',
      status: 'unknown',
      probability: 0,
      confidence: 0,
      recommendation: 'Invalid gas level reading. Please check sensor.',
      threshold: 'invalid'
    };
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
    
    // Set up periodic check for updating scanned items
    this.startPeriodicHistoryCheck();
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
      
      // Ensure history is updated with final results before closing
      if (this._lastAnalysisResult || this._lastMLResult) {
        console.log('🔄 Modal closing - ensuring history is updated with final results');
        this.updateHistoryWithFinalResults();
      }
      
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
      
      const token = this.getAuthToken();
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
      
      const sessionToken = this.getAuthToken();
      
      // Get current user ID
      const currentUserId = getCurrentUserId();
      
      if (!sessionToken) {
        console.log('🔄 No session token, trying without authentication...');
        if (!currentUserId) {
          throw new Error('User ID is required. Please log in to complete the scan session.');
        }
        
        const response = await fetch('/api/sensor/scan-session', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: currentUserId,
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
          user_id: currentUserId,
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
      
      const sessionToken = this.getAuthToken();
      
      // Get current user ID
      const currentUserId = getCurrentUserId();
      
      if (!sessionToken) {
        console.log('🔄 No session token, trying without authentication...');
        if (!currentUserId) {
          throw new Error('User ID is required. Please log in to create a scan session.');
        }
        
        const response = await fetch('/api/sensor/scan-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: currentUserId,
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
          user_id: currentUserId,
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

  // Create an alert for SmartSense Scanner using AI prediction data
  async createScannerAlert(foodName, mlPredictionData, sensorData) {
    try {
      console.log('🚨 ML-Based Alert Creation Check:');
      console.log('  Food Name:', foodName);
      console.log('  AI Prediction Data:', mlPredictionData);
      
        // Use AI prediction spoilage status instead of table condition
      const spoilageStatus = mlPredictionData?.spoilage_status || mlPredictionData?.status;
      const spoilageProbability = mlPredictionData?.spoilage_probability || mlPredictionData?.probability || 0;
      const confidenceScore = mlPredictionData?.confidence_score || mlPredictionData?.confidence || 0;
      
      console.log('  ML Spoilage Status:', spoilageStatus);
      console.log('  ML Probability:', spoilageProbability);
      console.log('  Should Create Alert:', spoilageStatus && spoilageStatus !== 'safe');
      
      if (!spoilageStatus || spoilageStatus === 'safe') {
        console.log('✅ Skipping alert creation - AI prediction shows safe');
        return;
      }
      
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      if (!sessionToken) {
        console.warn('Skipping alert creation: no auth token');
        return;
      }

      const alertLevel = spoilageStatus === 'unsafe' ? 'High' : 'Medium';
      const recommendedAction = spoilageStatus === 'unsafe'
        ? 'Discard immediately and sanitize storage area.'
        : 'Consume soon or improve storage conditions. Monitor closely for signs of spoilage.';

      // Prepare sensor readings for email
      const sensorReadings = sensorData ? {
        temperature: sensorData.temperature?.value || sensorData.temperature || undefined,
        humidity: sensorData.humidity?.value || sensorData.humidity || undefined,
        gas_level: sensorData.gas?.value || sensorData.gas_level || sensorData.gas || undefined
      } : null;

      const body = {
        food_id: mlPredictionData?.food_id || null,
        message: `AI Prediction: ${foodName} is ${spoilageStatus.toUpperCase()} (${Math.round(spoilageProbability)}% probability)`,
        alert_level: alertLevel,
        alert_type: 'ml_prediction',
        ml_prediction_id: mlPredictionData?.prediction_id || null,
        spoilage_probability: Math.max(0, Math.min(100, Math.round(spoilageProbability))),
        recommended_action: recommendedAction,
        is_ml_generated: true,
        confidence_score: Math.max(0, Math.min(100, Math.round(confidenceScore))),
        alert_data: JSON.stringify({
          source: 'ml_prediction',
          condition: spoilageStatus,
          sensor_readings: sensorReadings,
          spoilage_score: spoilageProbability,
          confidence_score: confidenceScore,
          ml_model: mlPredictionData?.model || 'default',
          timestamp: new Date().toISOString()
        })
      };
      
      console.log(`📧 [Smart Training] Creating alert with email notification for ${spoilageStatus} status:`, {
        foodName,
        alertLevel,
        spoilageStatus,
        probability: Math.round(spoilageProbability)
      });

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      };
      const resp = await fetch('/api/alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        console.warn('Alert creation failed with status:', resp.status);
      }
    } catch (e) {
      console.warn('Non-blocking: failed to create scanner alert:', e.message);
    }
  }

  // Validate food name - basic validation only (numbers and symbols)
  validateFoodName(foodName) {
    if (!foodName || foodName.trim() === '') {
      return { isValid: false, message: 'Food name is required. Please enter a food item name.' };
    }

    const trimmedName = foodName.trim();

    // Basic validation: reject if it's only numbers
    if (/^\d+$/.test(trimmedName)) {
      return { 
        isValid: false, 
        message: 'Numbers alone are not valid food names. Please enter an actual food item (e.g., Banana, Chicken, Salmon).',
        reason: 'Input contains only numbers'
      };
    }

    // Reject if it's too short (less than 2 characters)
    if (trimmedName.length < 2) {
      return { 
        isValid: false, 
        message: 'Food name is too short. Please enter a valid food item name.',
        reason: 'Input too short'
      };
    }

    // Reject if it contains only special characters
    if (/^[^a-zA-Z0-9]+$/.test(trimmedName)) {
      return { 
        isValid: false, 
        message: 'Special characters alone are not valid food names. Please enter an actual food item.',
        reason: 'Input contains only special characters'
      };
    }

    // Basic validation passed
    return { 
      isValid: true, 
      message: 'Food name format is valid'
    };
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

      // Basic validation: check for numbers and symbols only
      console.log('🔍 Validating food name:', customName.value.trim());
      const foodNameValidation = this.validateFoodName(customName.value.trim());
      
      if (!foodNameValidation.isValid) {
        console.warn('❌ Food name validation failed:', foodNameValidation.message);
        // Show toast notification instead of alert
        const errorMsg = `"${customName.value.trim()}" is not a valid food item. ${foodNameValidation.message}`;
        
        // Use toast if available, otherwise fallback to alert
        if (typeof showErrorToast === 'function') {
          showErrorToast(errorMsg);
        } else if (typeof showToast === 'function') {
          showToast('error', errorMsg);
        } else if (typeof window.showToast === 'function') {
          window.showToast('error', errorMsg);
        } else {
          // Fallback to alert if no toast function available
          alert(`❌ Invalid Food Name\n\n${errorMsg}`);
        }
        customName.focus();
        customName.style.borderColor = '#dc3545';
        customName.style.borderWidth = '2px';
        customName.style.boxShadow = '0 0 0 0.2rem rgba(220, 53, 69, 0.25)';
        setTimeout(() => {
          customName.style.borderColor = '';
          customName.style.borderWidth = '';
          customName.style.boxShadow = '';
        }, 5000);
        return; // Stop here - don't show modal or proceed
      }

      console.log('✅ Food name validation passed');

      // Then validate food name against category
      const validationResult = this.validateFoodCategory(customName.value.trim(), finalCategory);
      
      if (!validationResult.isValid) {
        console.warn('❌ Category validation failed:', validationResult.message);
        this.showFoodValidationError(validationResult.message, customName.value.trim(), finalCategory);
        return; // Stop here - don't show modal or proceed
      }

      console.log('✅ All validations passed - proceeding to show modal');

      const selectedFood = {
        id: 'custom',
        name: customName.value.trim(),
        category: finalCategory
      };

      this.selectedFood = selectedFood;
      
      // Add to food history
      this._lastScanHistoryId = this.addToFoodHistory(selectedFood.name, selectedFood.category, 'scanned');
      
      this.closeFoodSelectionModal();
      // Only show modal if validation passed
      this.showFoodSelectedConfirmation(selectedFood);

      // Create scan session for Arduino data reception
      try {
        await this.createScanSession();
      } catch (error) {
        console.error('Failed to create scan session:', error);
        // Continue anyway - the blocking will just prevent Arduino data
      }

      // Start polling sensors and trigger AI prediction → expiry update
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
        okBtn.style.display = 'block'; // Ensure button is visible initially
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
      // Only remove loading class, preserve completed state
      autoTrainingStatus.classList.remove('loading');
      
      // Only reset HTML if not in completed state
      if (!autoTrainingStatus.classList.contains('completed')) {
        autoTrainingStatus.innerHTML = `
        <div class="training-status-header">
          <h3>🧠 Smart Training In Progress...</h3>
          <p>Analyzing your sensor data with AI</p>
        </div>
        <div class="training-status-info">
          <div class="status-item" id="trainingStep1">
            <div class="status-icon loading">
              <i class="bi bi-activity"></i>
            </div>
            <span>Collecting sensor data...</span>
          </div>
          <div class="status-item" id="trainingStep2">
            <div class="status-icon loading">
              <i class="bi bi-robot"></i>
            </div>
            <span>Processing with AI...</span>
          </div>
          <div class="status-item" id="trainingStep3">
            <div class="status-icon loading">
              <i class="bi bi-database"></i>
            </div>
            <span>Uploading training data...</span>
          </div>
          <div class="status-item" id="trainingStep4">
            <div class="status-icon loading">
              <i class="bi bi-check-circle"></i>
            </div>
            <span>Generating prediction...</span>
          </div>
          <div class="status-item" id="trainingStep5">
            <div class="status-icon loading">
              <i class="bi bi-percent"></i>
            </div>
            <span>Calculating confidence...</span>
          </div>
          <div class="status-item" id="trainingStep6">
            <div class="status-icon loading">
              <i class="bi bi-lightbulb"></i>
            </div>
            <span>Finalizing analysis...</span>
          </div>
        </div>
      `;
      }
    }

    // Reset food selected confirmation modal elements
    const waitEl = document.getElementById('sensorWaitIndicator');
    const okBtn = document.getElementById('okFoodSelected');
    const trainingUpload = document.getElementById('smartTrainingUpload');
    
    if (waitEl) waitEl.style.display = 'none';
    if (okBtn) {
      okBtn.disabled = false;
      okBtn.textContent = 'OK';
      okBtn.style.display = 'none'; // Hide button by default
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

  addToFoodHistory(foodName, category, status = 'scanned', analysisResult = null) {
    const historyItem = {
      id: Date.now(),
      foodName,
      category,
      status,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      analysisResult: analysisResult // Store actual analysis results
    };
    
    this.foodHistory.unshift(historyItem);
    this.saveFoodHistory();
    this.renderFoodHistory();
    return historyItem.id;
  }

  updateFoodHistoryStatus(historyId, newStatus, analysisResult = null) {
    if (!historyId) return;
    const idx = this.foodHistory.findIndex(h => String(h.id) === String(historyId));
    if (idx !== -1) {
      this.foodHistory[idx].status = newStatus;
      if (analysisResult) {
        this.foodHistory[idx].analysisResult = analysisResult;
      }
      this.saveFoodHistory();
      this.renderFoodHistory();
    }
  }

  // --- ML + Polling Flow --- (sensor polling logic)
  async startSensorPollingAndPredict() {
    try {
      console.log('🔍 Smart Training system startSensorPollingAndPredict called');
      console.log('🔍 Global flag check - smartSenseScannerActive:', window.smartSenseScannerActive);
      
      // Check if SmartSense Scanner is active - if so, skip this system
      if (window.smartSenseScannerActive) {
        console.log('🔍 SmartSense Scanner is active - skipping Smart Training system');
        return;
      }
      
      console.log('🔍 Smart Training system proceeding with AI prediction');
      
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
      
      const mlResult = await this.autoTrainMLModel(latestData);
      
      // Store the ML result for later use when all steps are completed
      this._lastMLResult = mlResult;
      
      // Don't update history yet - wait for all steps to complete
      console.log('📊 ML result stored, waiting for all steps to complete');

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

      // Store expiry for use in AI prediction
      this.predictedExpiry = expiry;

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
//---fetch latest sensor data---
  async fetchLatestSensorData() {
    try {
      const token = this.getAuthToken();

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
      const r = await fetch((typeof buildApiUrl === 'function' ? buildApiUrl('/api/sensor/latest-user') : '/api/sensor/latest-user'), {
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
//---call ML predict---
  async callMlPredict(latest) {
    try {
      const token = this.getAuthToken();
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
        food_category: this.selectedFood?.category || null
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
//---call AI analyze---
  async callAiAnalyze(latest) {
    try {
      const token = this.getAuthToken();
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
//---derive expiry from AI analysis---
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
    
    // Use the mapped spoilage status for consistent expiry calculation
    const risk = String(analysis.riskLevel || '').toUpperCase();
    const spoilageStatus = this.mapRiskLevelToSpoilageStatus(analysis.riskLevel);
    
    console.log('🔍 Expiry Calculation:');
    console.log('  AI Risk Level:', risk);
    console.log('  Mapped Spoilage Status:', spoilageStatus);
    
    // Map spoilage status directly to expiry days with consistent logic
    const now = new Date();
    let days = 1; // default
    let useHours = false;
    let hoursToAdd = 0;
    
    switch (spoilageStatus.toLowerCase()) {
      case 'safe':
        days = 3; // Safe food lasts 3 days
        break;
      case 'caution':
        // Caution food expires in 3 hours
        useHours = true;
        hoursToAdd = 3;
        break;
      case 'unsafe':
        days = 0; // Unsafe/spoiled food expires TODAY (already spoiled)
        break;
      default:
        days = 1;
    }
    
    console.log('🔍 Expiry Logic Check:');
    console.log('  If spoilage_status is "unsafe" but days > 0, there\'s an inconsistency');
    console.log('  Current spoilage_status:', spoilageStatus);
    console.log('  Calculated days:', days);
    console.log('  Use hours:', useHours);
    console.log('  Hours to add:', hoursToAdd);
    
    let d;
    if (useHours) {
      // Add hours for caution status (3 hours)
      d = new Date(now);
      d.setHours(d.getHours() + hoursToAdd);
    } else {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    
    console.log('  Expiry Days:', days);
    console.log('  Expiry Date:', `${yyyy}-${mm}-${dd}`);
    
    return `${yyyy}-${mm}-${dd}`;
  }
//---derive expiry from AI prediction---
  deriveExpiryDate(prediction) {
    // Heuristic mapping from spoilage status to days remaining
    const now = new Date();
    let days = 0;
    let useHours = false;
    let hoursToAdd = 0;
    switch ((prediction.spoilage_status || '').toUpperCase()) {
      case 'LOW_SPOILAGE_RISK':
        days = 3; break;
      case 'MODERATE_SPOILAGE_RISK':
        // 3 hours for moderate risk (caution)
        useHours = true;
        hoursToAdd = 3;
        break;
      case 'HIGH_SPOILAGE_RISK':
        days = 0; break;
      default:
        days = 1; break;
    }
    let d;
    if (useHours) {
      // Add hours for moderate risk (3 hours)
      d = new Date(now);
      d.setHours(d.getHours() + hoursToAdd);
    } else {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    }
    // Return YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
//---update food expiry---
  async updateFoodExpiry(foodId, expirationDate) {
    try {
      const token = this.getAuthToken();
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
//---update food with expiry---
  async updateFoodWithExpiry(name, category, expirationDate) {
    try {
      // Check if scanning was cancelled
      if (this.isScanningCancelled) {
        console.log('Expiry update cancelled - scanning was stopped by user');
        return false;
      }

      const token = this.getAuthToken();
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
//---resolve preferred sensor id---
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
//---resolve all sensor ids---
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
//---clear food history---
  clearFoodHistory() {
    if (!Array.isArray(this.foodHistory) || this.foodHistory.length === 0) {
      // Nothing to clear; just ensure UI shows empty state
      this.foodHistory = [];
      this.saveFoodHistory();
      this.renderFoodHistory();
      return;
    }

    this.showUserConfirmModal('Confirm', 'Clear all food scanning history? This cannot be undone.')
      .then((confirmed) => {
        if (!confirmed) return;

        this.foodHistory = [];
        this.saveFoodHistory();
        this.renderFoodHistory();
      });
  }

  // Lightweight confirm modal for user actions (e.g., clearing history)
  showUserConfirmModal(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('userConfirmModal');
      const titleEl = document.getElementById('userConfirmTitle');
      const msgEl = document.getElementById('userConfirmMessage');
      const yesBtn = document.getElementById('userConfirmYes');
      const noBtn = document.getElementById('userConfirmNo');

      if (!modal || !titleEl || !msgEl || !yesBtn || !noBtn) {
        // Fallback to native confirm if modal not present
        resolve(window.confirm(message || 'Are you sure?'));
        return;
      }

      // Use innerText for title and innerText for message content
      titleEl.innerText = title || 'Confirm';
      // allow simple text; HTML icons are already in the header
      msgEl.innerText = message || 'Are you sure?';

      const cleanup = () => {
        yesBtn.onclick = null;
        noBtn.onclick = null;
        modal.style.display = 'none';
      };

      noBtn.onclick = () => { cleanup(); resolve(false); };
      yesBtn.onclick = () => { cleanup(); resolve(true); };

      modal.style.display = 'block';
    });
  }

  // Check and update any "scanned" items that might have analysis results available
  checkAndUpdateScannedItems() {
    if (!this._lastAnalysisResult && !this._lastMLResult) return;
    
    const analysisResult = this._lastAnalysisResult || this._lastMLResult;
    let updated = false;
    
    // Check for any items with "scanned" status that should be updated
    this.foodHistory.forEach((item, index) => {
      if (item.status === 'scanned' && !item.analysisResult) {
        // Check if this item was created recently (within last 5 minutes)
        const itemTime = new Date(item.timestamp);
        const now = new Date();
        const timeDiff = (now - itemTime) / (1000 * 60); // minutes
        
        if (timeDiff < 5 && analysisResult.spoilage_status) {
          console.log(`🔄 Updating scanned item "${item.foodName}" with analysis results`);
          
          const historyAnalysisResult = {
            prediction_status: analysisResult.spoilage_status,
            confidence_score: analysisResult.confidence_score,
            spoilage_probability: analysisResult.spoilage_probability,
            training_id: analysisResult.training_id,
            prediction_id: analysisResult.prediction_id,
            status: analysisResult.spoilage_status,
            condition: analysisResult.spoilage_status
          };
          
          this.foodHistory[index].status = analysisResult.spoilage_status;
          this.foodHistory[index].analysisResult = historyAnalysisResult;
          updated = true;
        }
      }
    });
    
    if (updated) {
      console.log('✅ Updated scanned items with analysis results');
      this.saveFoodHistory();
    }
  }

  // Start periodic check for updating history items
  startPeriodicHistoryCheck() {
    // Check every 2 seconds for the first minute, then every 10 seconds
    let checkCount = 0;
    const maxFastChecks = 30; // 30 checks * 2 seconds = 1 minute
//---start periodic history check---
    const periodicCheck = () => {
      this.checkAndUpdateScannedItems();
      checkCount++;
      
      if (checkCount < maxFastChecks) {
        // Fast checks for first minute
        setTimeout(periodicCheck, 2000);
      } else {
        // Slower checks after first minute
        setTimeout(periodicCheck, 10000);
      }
    };
    
    // Start the periodic check
    setTimeout(periodicCheck, 2000);
  }
//---render food history---
  renderFoodHistory() {
    const historyList = document.getElementById('foodHistoryList');
    if (!historyList) return;

    // Check for any "scanned" items that might need updating
    this.checkAndUpdateScannedItems();

    // Get actual scanner results from localStorage
    const scannerResults = this.getScannerResultsFromStorage();
    const recentHistory = this.foodHistory.slice(0, 6);

    if (recentHistory.length === 0 && scannerResults.length === 0) {
      historyList.innerHTML = `
        <div class="no-history">
          <i class="bi bi-clock-history"></i>
          <p>No food scanning history yet</p>
          <span>Start by selecting a food type above</span>
        </div>
      `;
      return;
    }

    // Combine food history with scanner results
    const allResults = [...scannerResults, ...recentHistory].slice(0, 6);
    
    const historyHTML = allResults.map(item => {
      if (item.scannerData) {
        // This is a scanner result
        return this.renderScannerHistoryItem(item);
      } else {
        // This is a regular food history item
        return `
          <div class="food-history-item">
            <div class="food-history-info">
              <div class="food-history-details">
                <h4>${item.foodName}</h4>
                <p>Category: ${item.category || 'Unknown'}</p>
              </div>
            </div>
            <div class="food-history-meta">
              <div class="food-history-time">${item.time}</div>
              <div class="food-history-status ${item.status}">${this.getStatusText(item.status, item.analysisResult)}</div>
            </div>
          </div>
        `;
      }
    }).join('');

    historyList.innerHTML = historyHTML;
    
    // Add scrolling if more than 6 items
    if (this.foodHistory.length > 6 || scannerResults.length > 0) {
      historyList.style.maxHeight = '300px';
      historyList.style.overflowY = 'auto';
      historyList.style.paddingRight = '10px';
      
      // Remove existing scroll indicator if any
      const existingIndicator = historyList.querySelector('.scroll-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      // Add scroll indicator
      const scrollIndicator = document.createElement('div');
      scrollIndicator.className = 'scroll-indicator';
      scrollIndicator.style.cssText = 'text-align: center; padding: 12px; color: #4a9eff; cursor: pointer; transition: opacity 0.3s ease;';
      scrollIndicator.innerHTML = `
        <div class="scroll-indicator-content" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="bi bi-arrow-up"></i>
          <span>Scroll up to see more history</span>
        </div>
      `;
      
      // Make scroll indicator clickable to scroll to top
      scrollIndicator.addEventListener('click', () => {
        historyList.scrollTo({ top: 0, behavior: 'smooth' });
      });
      
      // Add scroll event listener to show/hide indicator
      const updateScrollIndicator = () => {
        const scrollTop = historyList.scrollTop;
        const scrollHeight = historyList.scrollHeight;
        const clientHeight = historyList.clientHeight;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
        
        if (isAtBottom && scrollHeight > clientHeight) {
          scrollIndicator.style.display = 'block';
          scrollIndicator.style.opacity = '1';
        } else {
          scrollIndicator.style.opacity = '0';
          setTimeout(() => {
            if (scrollTop + clientHeight < scrollHeight - 10) {
              scrollIndicator.style.display = 'none';
            }
          }, 300);
        }
      };
      
      // Remove old event listener if exists
      if (historyList._scrollHandler) {
        historyList.removeEventListener('scroll', historyList._scrollHandler);
      }
      
      // Add new scroll event listener
      historyList._scrollHandler = updateScrollIndicator;
      historyList.addEventListener('scroll', updateScrollIndicator);
      
      // Initial check
      setTimeout(updateScrollIndicator, 100);
      
      historyList.appendChild(scrollIndicator);
      
      // Add show all button
      this.addShowAllButton();
    } else {
      historyList.style.maxHeight = 'none';
      historyList.style.overflowY = 'visible';
      historyList.style.paddingRight = '0';
      
      // Remove scroll indicator if exists
      const existingIndicator = historyList.querySelector('.scroll-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
    }
    
    // Update counter to include scanner results
    this.updateHistoryCounter(allResults.length);
  }
//---filter food history---
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
          <div class="food-history-status ${item.status}">${this.getStatusText(item.status, item.analysisResult)}</div>
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
//---get status text---
  getStatusText(status, analysisResult = null) {
    // If we have analysis results, show the actual analysis status
    if (analysisResult) {
      const resultStatus = analysisResult.prediction_status || analysisResult.status || analysisResult.condition;
      if (resultStatus) {
        // Map the status to display text
        const statusMap = {
          'safe': 'SAFE',
          'fresh': 'SAFE',
          'caution': 'CAUTION',
          'moderate': 'CAUTION',
          'getting_old': 'CAUTION',
          'spoiled': 'SPOILED',
          'unsafe': 'SPOILED',
          'high_risk': 'SPOILED'
        };
        return statusMap[resultStatus.toLowerCase()] || resultStatus.toUpperCase();
      }
    }
    
    // Fallback to original status mapping
    const statusMap = {
      'scanned': 'Scanned',
      'analyzed': 'Analyzed',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'pending': 'Pending',
      'error': 'Error',
      'safe': 'SAFE',
      'caution': 'CAUTION',
      'spoiled': 'SPOILED',
      'fresh': 'SAFE',
      'moderate': 'CAUTION',
      'high_risk': 'SPOILED'
    };
    return statusMap[status] || status;
  }
//---update history counter---
  updateHistoryCounter(count) {
    const counter = document.getElementById('historyCount');
    if (counter) {
      counter.textContent = count;
    }
  }

  // Get scanner results from localStorage
  getScannerResultsFromStorage() {
    try {
      const latestSensorData = localStorage.getItem('latest_sensor_payload');
      const mlPredictions = localStorage.getItem('ml_predictions');
      
      const results = [];
      
      // Get latest sensor data
      if (latestSensorData) {
        const sensorData = JSON.parse(latestSensorData);
        if (sensorData && sensorData.sensor_data) {
          results.push({
            id: 'scanner_' + Date.now(),
            scannerData: true,
            foodName: this.selectedFood?.name || 'Scanned Food',
            category: this.selectedFood?.category || 'Unknown',
            status: 'scanned',
            time: this.getTimeAgo(new Date()),
            sensorData: sensorData,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Get AI predictions if available
      if (mlPredictions) {
        const predictions = JSON.parse(mlPredictions);
        if (Array.isArray(predictions)) {
          predictions.slice(0, 3).forEach(prediction => {
            results.push({
              id: 'ml_' + prediction.id,
              scannerData: true,
              foodName: prediction.food_name || 'ML Analyzed Food',
              category: prediction.food_category || 'Unknown',
              status: prediction.prediction_status || 'analyzed',
              time: this.getTimeAgo(new Date(prediction.created_at)),
              mlData: prediction,
              timestamp: new Date(prediction.created_at)
            });
          });
        }
      }
      
      return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Error getting scanner results from storage:', error);
      return [];
    }
  }

  // Render scanner history item with detailed analysis
  renderScannerHistoryItem(item) {
    const sensorData = item.sensorData;
    const mlData = item.mlData;
    
    let statusBadge = '';
    let sensorReadings = '';
    let analysisInfo = '';
    
    if (sensorData && sensorData.sensor_data) {
      // Display sensor readings
      const sensors = sensorData.sensor_data;
      sensorReadings = `
        <div class="scanner-sensors">
          ${sensors.map(sensor => `
            <div class="scanner-sensor-item">
              <span class="sensor-label">${this.getSensorIcon(sensor.sensor_type)}</span>
              <span class="sensor-value">${sensor.value}${sensor.unit || ''}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    if (mlData) {
      // Display ML analysis results
      const confidence = mlData.confidence_score || 0;
      const status = mlData.prediction_status || 'unknown';
      statusBadge = `<span class="scanner-status-badge ${this.getMLStatusClass(status)}">${status}</span>`;
      
      analysisInfo = `
        <div class="scanner-analysis">
          <div class="confidence-score">Confidence: ${confidence}%</div>
          ${mlData.recommendations ? `<div class="recommendations">${mlData.recommendations}</div>` : ''}
        </div>
      `;
    }
    
    return `
      <div class="food-history-item scanner-result">
        <div class="food-history-info">
          <div class="food-history-details">
            <h4>${item.foodName}</h4>
            <p>Category: ${item.category}</p>
            ${statusBadge}
          </div>
        </div>
        ${sensorReadings}
        ${analysisInfo}
        <div class="food-history-meta">
          <div class="food-history-time">${item.time}</div>
          <div class="food-history-source">🧠 Smart Scanner</div>
        </div>
      </div>
    `;
  }

  // Get sensor icon based on sensor type
  getSensorIcon(sensorType) {
    const icons = {
      'temperature': '🌡️',
      'humidity': '💧',
      'gas': '💨',
      'light': '💡',
      'pressure': '📊'
    };
    return icons[sensorType?.toLowerCase()] || '📡';
  }

  // Get ML status class for styling
  getMLStatusClass(status) {
    const statusMap = {
      'fresh': 'status-safe',
      'spoiled': 'status-danger',
      'moderate': 'status-warning',
      'unknown': 'status-unknown'
    };
    return statusMap[status?.toLowerCase()] || 'status-unknown';
  }

  addShowAllButton() {
    // Remove existing show all button if any
    const existingBtn = document.getElementById('showAllHistoryBtn');
    if (existingBtn) {
      existingBtn.remove();
    }

    // Get scanner results to calculate total count
    const scannerResults = this.getScannerResultsFromStorage();
    const totalCount = scannerResults.length + this.foodHistory.length;

    // Add show all button
    const showAllBtn = document.createElement('button');
    showAllBtn.id = 'showAllHistoryBtn';
    showAllBtn.className = 'btn btn-outline-primary btn-sm mt-2';
    showAllBtn.innerHTML = `<i class="bi bi-list-ul"></i> Show All (${totalCount})`;
    showAllBtn.onclick = () => this.showAllHistory();

    const historyContainer = document.getElementById('foodHistoryList').parentElement;
    historyContainer.appendChild(showAllBtn);
  }

  showAllHistory() {
    const historyList = document.getElementById('foodHistoryList');
    if (!historyList) return;

    // Get scanner results from localStorage (same as renderFoodHistory)
    const scannerResults = this.getScannerResultsFromStorage();
    
    // Combine scanner results with all food history items (not just recent 6)
    const allResults = [...scannerResults, ...this.foodHistory];
    
    const allHistoryHTML = allResults.map(item => {
      if (item.scannerData) {
        // This is a scanner result
        return this.renderScannerHistoryItem(item);
      } else {
        // This is a regular food history item
        return `
          <div class="food-history-item">
            <div class="food-history-info">
              <div class="food-history-details">
                <h4>${item.foodName}</h4>
                <p>Category: ${item.category || 'Unknown'}</p>
              </div>
            </div>
            <div class="food-history-meta">
              <div class="food-history-time">${item.time}</div>
              <div class="food-history-status ${item.status}">${this.getStatusText(item.status, item.analysisResult)}</div>
            </div>
          </div>
        `;
      }
    }).join('');

    historyList.innerHTML = allHistoryHTML;
    historyList.style.maxHeight = '500px';
    historyList.style.overflowY = 'auto';

    // Update button to show "Show Recent"
    const showAllBtn = document.getElementById('showAllHistoryBtn');
    if (showAllBtn) {
      showAllBtn.innerHTML = `<i class="bi bi-arrow-up"></i> Show Recent (6)`;
      showAllBtn.onclick = () => this.showRecentHistory();
    }

    // Update counter with total items
    this.updateHistoryCounter(allResults.length);
  }

  showRecentHistory() {
    // Reset to show only recent 5 items
    this.renderFoodHistory();
  }

  // Show analysis loading animation in existing modal
  showAnalysisLoading() {
    const autoTrainingStatus = document.getElementById('autoTrainingStatus');
    const okButton = document.getElementById('okFoodSelected');
    
    if (autoTrainingStatus) {
      autoTrainingStatus.style.display = 'block';
      autoTrainingStatus.classList.add('loading');
      autoTrainingStatus.classList.remove('completed');
    }
    
    if (okButton) {
      okButton.style.display = 'none';
    }
    
    // Reset all steps
    for (let i = 1; i <= 6; i++) {
      const step = document.getElementById(`trainingStep${i}`);
      if (step) {
        step.classList.remove('active', 'completed');
        const icon = step.querySelector('.status-icon');
        if (icon) {
          icon.classList.remove('loading');
        }
      }
    }
    
    // Don't start step progression yet - wait for ML workflow to complete
    // this.progressAnalysisSteps(); // Moved to after ML workflow completion
  }

  // Progress through analysis steps
  progressAnalysisSteps() {
    // Get real analysis results if available
    const analysisResult = this._lastMLResult || this._lastAnalysisResult;
    
    // Debug logging for consistency check
    console.log('🔍 Progress Analysis Steps - Data Check:');
    console.log('  Analysis Result:', analysisResult);
    console.log('  Spoilage Status:', analysisResult?.spoilage_status);
    
    // Wait for validated AI analysis result - don't show steps until we have the final result
    if (!analysisResult || !analysisResult.spoilage_status) {
      console.log('⏳ Waiting for validated AI analysis result...');
      // Show loading state for AI analysis step
      const step2 = document.getElementById('trainingStep2');
      if (step2) {
        const stepText = step2.querySelector('span');
        if (stepText) {
          stepText.textContent = 'Processing with AI... (validating results)';
        }
      }
      return; // Don't progress steps until we have validated results
    }
    
    console.log('✅ Validated analysis result available, proceeding with steps');
    console.log('  Status Text (formatted):', analysisResult ? this.getAnalysisStatusText(analysisResult) : 'Default');
    
    const statusText = analysisResult ? this.getAnalysisStatusText(analysisResult) : 'AI Analysis: Processing...';
    
    // Ensure both AI analysis and prediction show consistent results
    // If AI analysis shows "Fresh & Safe" but spoilage_status is "unsafe", there's a mismatch
    const aiAnalysisStatus = analysisResult ? this.extractStatusFromAnalysisText(statusText) : 'safe';
    const spoilageStatus = analysisResult?.spoilage_status || 'safe';
    
    // Use the spoilage_status as the authoritative source (it comes from validated backend)
    const predictionText = analysisResult ? `Prediction: ${spoilageStatus}` : 'Prediction: Processing...';
    
    // Log any inconsistencies for debugging
    if (aiAnalysisStatus !== spoilageStatus) {
      console.warn('⚠️ INCONSISTENCY DETECTED:');
      console.warn('  AI Analysis shows:', aiAnalysisStatus);
      console.warn('  Spoilage Status shows:', spoilageStatus);
      console.warn('  Using Spoilage Status as authoritative source');
    }
    const confidenceText = analysisResult ? `Confidence: ${analysisResult.confidence_score || 0}%` : 'Confidence: Calculating...';
    
    console.log('🔍 Final Step Texts:');
    console.log('  Status Text:', statusText);
    console.log('  Prediction Text:', predictionText);
    console.log('  Confidence Text:', confidenceText);
    
    const steps = [
      { id: 1, delay: 300, text: 'Sensor data collected' },
      { id: 2, delay: 800, text: statusText },
      { id: 3, delay: 1300, text: 'Sensor Data uploaded to database' },
      { id: 4, delay: 1800, text: predictionText },
      { id: 5, delay: 2300, text: confidenceText },
      { id: 6, delay: 2800, text: 'AI Insight: AI analysis completed' }
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        const stepElement = document.getElementById(`trainingStep${step.id}`);
        if (stepElement) {
          // Mark previous steps as completed
          for (let i = 1; i < step.id; i++) {
            const prevStep = document.getElementById(`trainingStep${i}`);
            if (prevStep) {
              prevStep.classList.add('completed');
              prevStep.classList.remove('active');
              const prevIcon = prevStep.querySelector('.status-icon');
              if (prevIcon) {
                prevIcon.classList.remove('loading');
                // Change icon to checkmark for completed steps
                const iconElement = prevIcon.querySelector('i');
                if (iconElement) {
                  iconElement.className = 'bi bi-check-circle';
                }
              }
            }
          }
          
          // Mark current step as active with loading
          stepElement.classList.add('active');
          stepElement.classList.remove('completed');
          const icon = stepElement.querySelector('.status-icon');
          if (icon) {
            icon.classList.add('loading');
          }
          
          // Update step text if provided
          const stepText = stepElement.querySelector('span');
          if (stepText && step.text) {
            stepText.textContent = step.text;
          }
          
          // If this is the last step, mark it as completed after a delay
          if (index === steps.length - 1) {
            setTimeout(() => {
              stepElement.classList.add('completed');
              stepElement.classList.remove('active');
              if (icon) {
                icon.classList.remove('loading');
                // Change final icon to checkmark
                const iconElement = icon.querySelector('i');
                if (iconElement) {
                  iconElement.className = 'bi bi-check-circle';
                }
              }
              this.hideAnalysisLoading();
            }, 1000);
          }
        }
      }, step.delay);
    });
  }

  // Hide analysis loading and show completion
  hideAnalysisLoading() {
    const autoTrainingStatus = document.getElementById('autoTrainingStatus');
    const okButton = document.getElementById('okFoodSelected');
    
    console.log('🔍 hideAnalysisLoading called');
    console.log('autoTrainingStatus found:', !!autoTrainingStatus);
    console.log('okButton found:', !!okButton);
    
    if (autoTrainingStatus) {
      autoTrainingStatus.classList.remove('loading');
      autoTrainingStatus.classList.add('completed');
      
      // Update header to show completion
      const header = autoTrainingStatus.querySelector('.training-status-header');
      if (header) {
        header.innerHTML = `
          <h3>🎉 Smart Training Complete!</h3>
          <p>New Sensor Data created and uploaded to database</p>
        `;
      }
      
      console.log('✅ Added completed class to autoTrainingStatus');
      console.log('autoTrainingStatus classes:', autoTrainingStatus.className);
    }
    
    // Force complete all steps to ensure OK button shows
    this.forceCompleteAllSteps();
    
    // Always show OK button after analysis is done
    if (okButton) {
      okButton.disabled = false;
      okButton.textContent = 'OK';
      
      // Remove any hiding classes
      okButton.classList.remove('hidden', 'd-none');
      
      // Force show the button with multiple methods and !important overrides
      okButton.style.setProperty('display', 'block', 'important');
      okButton.style.setProperty('visibility', 'visible', 'important');
      okButton.style.setProperty('opacity', '1', 'important');
      okButton.style.setProperty('pointer-events', 'auto', 'important');
      
      console.log('✅ OK button shown - Analysis completed');
      console.log('okButton style.display:', okButton.style.display);
      console.log('okButton computed display:', window.getComputedStyle(okButton).display);
      
      // Also call the nuclear option as backup
      this.forceShowOKButton();
    } else {
      console.error('❌ OK button not found!');
    }
    
    // Update history with final analysis results
    this.updateHistoryWithFinalResults();
    
    console.log('Analysis completion check finished');
  }

  // Force complete all steps to ensure UI consistency
  forceCompleteAllSteps() {
    console.log('🔧 Forcing completion of all training steps');
    
    // Ensure the main autoTrainingStatus has completed class
    const autoTrainingStatus = document.getElementById('autoTrainingStatus');
    if (autoTrainingStatus) {
      autoTrainingStatus.classList.add('completed');
      autoTrainingStatus.classList.remove('loading');
      console.log('✅ Main autoTrainingStatus marked as completed');
    }
    
    // Complete all steps 1-6
    for (let i = 1; i <= 6; i++) {
      const stepElement = document.getElementById(`trainingStep${i}`);
      if (stepElement) {
        stepElement.classList.add('completed');
        stepElement.classList.remove('active', 'loading');
        
        // Update step icon
        const iconElement = stepElement.querySelector('.status-icon');
        if (iconElement) {
          iconElement.classList.remove('loading');
          const iconInner = iconElement.querySelector('i');
          if (iconInner) {
            iconInner.className = 'bi bi-check-circle';
          }
        }
        
        console.log(`✅ Step ${i} forced to completed`);
      }
    }
    
    // Force show OK button after completing all steps
    setTimeout(() => {
      const okButton = document.getElementById('okFoodSelected');
      if (okButton) {
        console.log('🔧 Final OK button force show after step completion');
        okButton.style.setProperty('display', 'block', 'important');
        okButton.style.setProperty('visibility', 'visible', 'important');
        okButton.style.setProperty('opacity', '1', 'important');
      }
    }, 100);
  }

  // Check if all training steps are completed
  checkAllStepsCompleted() {
    const autoTrainingStatus = document.getElementById('autoTrainingStatus');
    if (!autoTrainingStatus) return false;
    
    // Check if modal has completed class
    if (!autoTrainingStatus.classList.contains('completed')) {
      console.log('❌ Modal not marked as completed');
      return false;
    }
    
    // Check if modal is still loading
    if (autoTrainingStatus.classList.contains('loading')) {
      console.log('❌ Modal still loading');
      return false;
    }
    
    // Check all individual steps (1-6)
    for (let i = 1; i <= 6; i++) {
      const stepElement = document.getElementById(`trainingStep${i}`);
      if (stepElement) {
        // Check if step is completed
        if (!stepElement.classList.contains('completed')) {
          console.log(`❌ Step ${i} not completed`);
          return false;
        }
        
        // Check if step is still active or loading
        if (stepElement.classList.contains('active')) {
          console.log(`❌ Step ${i} still active`);
          return false;
        }
        
        // Check if step icon is still loading
        const iconElement = stepElement.querySelector('.status-icon');
        if (iconElement && iconElement.classList.contains('loading')) {
          console.log(`❌ Step ${i} icon still loading`);
          return false;
        }
      } else {
        console.log(`❌ Step ${i} element not found`);
        return false;
      }
    }
    
    console.log('✅ All steps completed');
    return true;
  }

  // Get formatted analysis status text for modal display
  getAnalysisStatusText(analysisResult) {
    if (!analysisResult) return 'AI Analysis: Processing...';
    
    const status = analysisResult.spoilage_status || analysisResult.status || 'safe';
    const confidence = analysisResult.confidence_score || analysisResult.spoilage_probability || 0;
    
    // Debug logging for status interpretation
    console.log('🔍 getAnalysisStatusText Debug:');
    console.log('  Input analysisResult:', analysisResult);
    console.log('  Extracted status:', status);
    console.log('  Extracted confidence:', confidence);
    
    let icon = '🍎';
    let statusText = 'Safe';
    
    // Use the correct mapping: LOW→SAFE, MEDIUM→CAUTION, HIGH→UNSAFE
    switch (status.toLowerCase()) {
      case 'safe':
      case 'fresh':
      case 'low':
        icon = '🍎';
        statusText = 'Safe';
        break;
      case 'caution':
      case 'moderate':
      case 'getting_old':
      case 'medium':
        icon = '⚠️';
        statusText = 'Caution';
        break;
      case 'spoiled':
      case 'unsafe':
      case 'high_risk':
      case 'high':
        icon = '❌';
        statusText = 'Unsafe';
        break;
      default:
        icon = '🍎';
        statusText = 'Safe';
    }
    
    return `AI Analysis: ${icon} ${statusText} (${confidence}% confidence)`;
  }

  // Extract status from AI analysis text for consistency
  extractStatusFromAnalysisText(analysisText) {
    if (analysisText.includes('Safe')) return 'safe';
    if (analysisText.includes('Caution')) return 'caution';
    if (analysisText.includes('Unsafe')) return 'unsafe';
    return 'safe'; // default fallback
  }

  // Update history with final analysis results
  updateHistoryWithFinalResults() {
    console.log('🔄 Updating history with final analysis results');
    
    // Use the same analysis result that's used in the modal
    const analysisResult = this._lastAnalysisResult || this._lastMLResult;
    
    if (analysisResult && this._lastScanHistoryId) {
      const historyAnalysisResult = {
        prediction_status: analysisResult.spoilage_status,
        confidence_score: analysisResult.confidence_score,
        spoilage_probability: analysisResult.spoilage_probability,
        training_id: analysisResult.training_id,
        prediction_id: analysisResult.prediction_id,
        status: analysisResult.spoilage_status, // Add status for getStatusText
        condition: analysisResult.spoilage_status // Add condition for getStatusText
      };
      
      console.log('📊 Updating history with analysis result:', historyAnalysisResult);
      console.log('📊 Modal shows:', this.getAnalysisStatusText(analysisResult));
      // Use the actual spoilage status instead of 'completed'
      const finalHistoryStatus = analysisResult.spoilage_status || 'completed';
      console.log('📊 Final history status:', finalHistoryStatus);
      this.updateFoodHistoryStatus(this._lastScanHistoryId, finalHistoryStatus, historyAnalysisResult);
      
      // Force re-render after a small delay to ensure DOM updates
      setTimeout(() => {
        console.log('🔄 Force re-rendering history after status update');
        this.renderFoodHistory();
      }, 100);
    } else {
      console.log('⚠️ No analysis result or history ID available for update');
      console.log('_lastAnalysisResult:', this._lastAnalysisResult);
      console.log('_lastMLResult:', this._lastMLResult);
      console.log('_lastScanHistoryId:', this._lastScanHistoryId);
      
      // If we don't have a history ID but we have analysis results, try to update the most recent item
      if (analysisResult && this.foodHistory.length > 0) {
        console.log('🔄 Attempting to update most recent history item');
        const mostRecentItem = this.foodHistory[0];
        if (mostRecentItem && mostRecentItem.status === 'scanned') {
          const historyAnalysisResult = {
            prediction_status: analysisResult.spoilage_status,
            confidence_score: analysisResult.confidence_score,
            spoilage_probability: analysisResult.spoilage_probability,
            training_id: analysisResult.training_id,
            prediction_id: analysisResult.prediction_id,
            status: analysisResult.spoilage_status,
            condition: analysisResult.spoilage_status
          };
          
          this.updateFoodHistoryStatus(mostRecentItem.id, analysisResult.spoilage_status, historyAnalysisResult);
          console.log('✅ Updated most recent history item with analysis results');
        }
      }
    }
  }

  // Nuclear option to force show OK button
  forceShowOKButton() {
    console.log('🚀 forceShowOKButton called');
    
    // Add CSS override to head if not already present
    if (!document.getElementById('okButtonForceShow')) {
      const style = document.createElement('style');
      style.id = 'okButtonForceShow';
      style.textContent = `
        #okFoodSelected.force-show {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `;
      document.head.appendChild(style);
      console.log('✅ Added CSS override for OK button');
    }
    
    // Try multiple times with different delays
    [0, 50, 100, 200, 500].forEach(delay => {
      setTimeout(() => {
        const okButton = document.getElementById('okFoodSelected');
        if (okButton) {
          // Force show with all possible methods
          okButton.style.setProperty('display', 'block', 'important');
          okButton.style.setProperty('visibility', 'visible', 'important');
          okButton.style.setProperty('opacity', '1', 'important');
          okButton.style.setProperty('pointer-events', 'auto', 'important');
          
          // Remove any hiding classes
          okButton.classList.remove('hidden', 'd-none', 'invisible');
          
          // Add showing classes and force-show class
          okButton.classList.add('visible', 'show', 'force-show');
          
          // Force reflow
          okButton.offsetHeight;
          
          console.log(`🚀 Force show attempt ${delay}ms:`, {
            display: okButton.style.display,
            computedDisplay: window.getComputedStyle(okButton).display,
            visibility: okButton.style.visibility,
            opacity: okButton.style.opacity,
            classes: okButton.className
          });
        } else {
          console.error(`❌ Force show attempt ${delay}ms: OK button not found`);
        }
      }, delay);
    });
  }

  // Automatically perform AI prediction with scanned data
  async autoTrainMLModel(sensorData) {
    // Check if scanning was cancelled before starting ML workflow
    if (this.isScanningCancelled) {
      console.log('ML workflow cancelled - scanning was stopped by user');
      return;
    }

    // Show loading animation
    this.showAnalysisLoading();

    const trainingStatus = document.getElementById('autoTrainingStatus');

    try {
      console.log('Performing AI prediction with sensor data:', sensorData);
      
      // First check if ML data already exists for this food
      const mlDataExists = await this.checkExistingMLData(this.selectedFood.name, this.selectedFood.category);
      
      if (mlDataExists) {
        // ML data already exists, stop the process
        if (trainingStatus) {
          trainingStatus.innerHTML = `
            <div class="training-status-header">
              <h4>✅ AI Data Already Exists</h4>
              <p>Training data for ${this.selectedFood.name} is already available</p>
            </div>
            <div class="training-status-items">
              <div class="status-item">
                <i class="bi bi-check-circle-fill text-success"></i>
                <span>AI data found for ${this.selectedFood.name}</span>
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
              <span>Sensor data collected</span>
            </div>
            <div class="status-item">
              <div class="circle-loading warning"></div>
              <span>Processing with AI...</span>
            </div>
          </div>
        `;
      }

          // Perform AI prediction using the scanned data
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
                  <span>Sensor Data will not be uploaded</span>
                </div>
              </div>
            `;
          }
          return; // Stop the process completely if food handling fails
        }

        // Use AI analysis from the working analysis endpoint
        console.log('Getting validated AI analysis...');
        const aiAnalysisResult = await this.getValidatedAIAnalysis(
          this.selectedFood.name,
          sensorData
        );
        
        // Check if AI analysis was successful
        if (!aiAnalysisResult.success) {
          console.error('Validated AI analysis failed:', aiAnalysisResult.error);
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
        let aiCondition = aiAnalysisResult.success ? 
          this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe';
        const assessed = this.assessFoodCondition(sensorData) || {};
        const tableCondition = assessed.condition || aiCondition;
        
        // Debug logging to track status mapping
        console.log('🔍 Smart Training status mapping:');
        console.log('  AI Analysis Result:', aiAnalysisResult.success ? aiAnalysisResult.analysis : 'Failed');
        console.log('  AI Risk Level:', aiAnalysisResult.success ? aiAnalysisResult.analysis.riskLevel : 'N/A');
        console.log('  AI Condition (mapped):', aiCondition);
        console.log('  Table Assessment:', assessed);
        console.log('  Final Table Condition:', tableCondition);
        
        // Use AI analysis result as the primary source - no overrides
        // The AI analysis already considers all sensor data and environmental factors
        
        // Use AI condition as primary source for consistency with modal display
        const finalCondition = aiAnalysisResult.success ? aiCondition : tableCondition;

        // Fire alert immediately for caution/unsafe conditions
        if (finalCondition === 'caution' || finalCondition === 'unsafe') {
          console.log('Creating SmartSense alert for condition:', finalCondition, 'score:', assessed.spoilageScore);
          // Create a temporary AI prediction data object for alert creation
          const tempMLData = {
            spoilage_status: finalCondition,
            spoilage_probability: assessed.spoilageScore,
            confidence_score: assessed.spoilageScore || 75,
            food_id: foodId
          };
          await this.createScannerAlert(this.selectedFood.name, tempMLData, sensorData);
        } else {
          console.log('✅ No alert needed - AI analysis shows safe condition:', finalCondition);
        }
        
        // Check if scanning was cancelled before ML workflow
        if (this.isScanningCancelled) {
          console.log('ML workflow cancelled - scanning was stopped by user');
          return;
        }
        
        // Only proceed with ML workflow if food creation was successful
        console.log('Proceeding with ML workflow using food ID:', foodId);
        console.log('Using final condition for ML workflow:', finalCondition);
        // Use AI-assessed condition for consistency with modal display
        const mlWorkflowResult = await this.performMLWorkflow(
          foodId,
          this.selectedFood.name,
          this.selectedFood.category,
          sensorData,
          finalCondition,
          aiAnalysisResult
        );
        
        if (mlWorkflowResult.success) {
          console.log('ML workflow successful:', mlWorkflowResult);
          
          // Store the validated ML workflow result which contains the corrected AI analysis
          this._lastAnalysisResult = {
            spoilage_status: mlWorkflowResult.spoilage_status,
            confidence_score: mlWorkflowResult.confidence_score,
            spoilage_probability: mlWorkflowResult.spoilage_probability,
            training_id: mlWorkflowResult.training_id,
            prediction_id: mlWorkflowResult.prediction_id
          };
          
          console.log('📊 Stored validated analysis result:', this._lastAnalysisResult);
          
          // Create alert using actual AI prediction results by fetching from database
          if (mlWorkflowResult.prediction_id) {
            try {
              const token = this.getAuthToken();
              if (token) {
                const response = await fetch(`/api/ml-prediction/${mlWorkflowResult.prediction_id}`, {
                  method: 'GET',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                  const mlData = await response.json();
                  console.log('📊 Fetched AI prediction data for alert:', mlData);
                  
                  const mlPredictionData = {
                    spoilage_status: mlData.data?.spoilage_status || mlWorkflowResult.spoilage_status,
                    spoilage_probability: mlData.data?.spoilage_probability || mlWorkflowResult.spoilage_probability,
                    confidence_score: mlData.data?.confidence_score || mlWorkflowResult.confidence_score,
                    prediction_id: mlWorkflowResult.prediction_id,
                    food_id: foodId,
                    model: mlData.data?.model || 'ml_workflow'
                  };
                  
                  // Only create alert if AI prediction indicates caution or unsafe
                  if (mlPredictionData.spoilage_status === 'caution' || mlPredictionData.spoilage_status === 'unsafe') {
                    console.log('Creating ML-based alert for spoilage status:', mlPredictionData.spoilage_status);
                    await this.createScannerAlert(this.selectedFood.name, mlPredictionData, sensorData);
                  }
                } else {
                  console.warn('Failed to fetch AI prediction data, using workflow result');
                  // Fallback to workflow result
                  const mlPredictionData = {
                    spoilage_status: mlWorkflowResult.spoilage_status,
                    spoilage_probability: mlWorkflowResult.spoilage_probability,
                    confidence_score: mlWorkflowResult.confidence_score,
                    prediction_id: mlWorkflowResult.prediction_id,
                    food_id: foodId,
                    model: 'ml_workflow'
                  };
                  
                  if (mlWorkflowResult.spoilage_status === 'caution' || mlWorkflowResult.spoilage_status === 'unsafe') {
                    console.log('Creating ML-based alert for spoilage status:', mlWorkflowResult.spoilage_status);
                    await this.createScannerAlert(this.selectedFood.name, mlPredictionData, sensorData);
                  }
                }
              }
            } catch (error) {
              console.warn('Error fetching AI prediction data:', error);
            }
          }
          
          // Now start the step progression with validated results
          this.progressAnalysisSteps();
          
          // Ensure OK button shows after ML workflow completion
          setTimeout(() => {
            console.log('🔧 Ensuring OK button shows after ML workflow success');
            this.hideAnalysisLoading();
          }, 2000);
          
          // Update the training status with ML workflow results
          if (trainingStatus) {
            // Use the ACTUAL training data status from the training data creation response
            const actualStatus = mlWorkflowResult.training_data?.actual_spoilage_status || 
                                 mlWorkflowResult.actual_spoilage_status || 
                                 mlWorkflowResult.spoilage_status || 'safe';
            const actualConfidence = mlWorkflowResult.confidence_score || 75;
            const gasRiskLevel = mlWorkflowResult.training_data?.gas_risk_level || 
                                mlWorkflowResult.gas_risk_level || 'unknown';
            
            console.log('🔍 Modal Display Consistency Check:');
            console.log('  Full ML Workflow Result:', mlWorkflowResult);
            console.log('  Training Data Status:', mlWorkflowResult.training_data?.actual_spoilage_status);
            console.log('  Gas Risk Level:', gasRiskLevel);
            console.log('  AI Analysis Risk Level:', aiAnalysisResult.success ? aiAnalysisResult.analysis.riskLevel : 'N/A');
            console.log('  AI Mapped Status:', aiAnalysisResult.success ? 
              this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe');
            console.log('  ML Workflow Result Status:', actualStatus);
            console.log('  ML Workflow Result Confidence:', actualConfidence);
            console.log('  Using for display:', actualStatus);
            
            const conditionIcon = actualStatus === 'safe' ? '🍎' : 
                                 actualStatus === 'caution' ? '⚠️' : '❌';
            const conditionText = actualStatus === 'safe' ? 'Safe' : 
                                 actualStatus === 'caution' ? 'Caution' : 'Unsafe';
            
            const aiAnalysis = aiAnalysisResult.success ? 
              (aiAnalysisResult.analysis.reasoning || 'AI analysis completed') : 'Fallback analysis used';
            
            trainingStatus.innerHTML = `
              <div class="training-status-header">
                <h4>🤖 Smart Training Complete!</h4>
                <p>New Sensor Data created and uploaded to database</p>
              </div>
              <div class="training-status-items">
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Sensor data collected</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-robot text-primary"></i>
                  <span>AI Analysis: ${conditionIcon} ${conditionText} (${actualConfidence}% confidence)</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Sensor Data uploaded to database</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Prediction: ${actualStatus}</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Confidence: ${actualConfidence}%</span>
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
          
          // Start step progression even if ML workflow failed (with fallback data)
          this.progressAnalysisSteps();
          
          // Ensure OK button shows even if ML workflow failed
          setTimeout(() => {
            console.log('🔧 Ensuring OK button shows after ML workflow failure');
            this.hideAnalysisLoading();
          }, 2000);
          
          // Still show food item was created even if ML workflow failed
          if (trainingStatus) {
            // Use the AI analysis result as fallback when ML workflow fails
            const fallbackStatus = aiAnalysisResult.success ? 
              this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe';
            const fallbackConfidence = aiAnalysisResult.success ? 
              (aiAnalysisResult.analysis.riskScore || 75) : 75;
            
            console.log('🔍 Modal Display (ML Failed) Consistency Check:');
            console.log('  Using fallback AI status:', fallbackStatus);
            console.log('  Using fallback confidence:', fallbackConfidence);
            
            const conditionIcon = fallbackStatus === 'safe' ? '🍎' : 
                                 fallbackStatus === 'caution' ? '⚠️' : '❌';
            const conditionText = fallbackStatus === 'safe' ? 'Safe' : 
                                 fallbackStatus === 'caution' ? 'Caution' : 'Unsafe';
            
            const aiAnalysis = aiAnalysisResult.success ? 
              (aiAnalysisResult.analysis.reasoning || 'AI analysis completed') : 'Fallback analysis used';
            
            trainingStatus.innerHTML = `
              <div class="training-status-header">
                <h4>⚠️ Training Data Created (Prediction Failed)</h4>
                <p>AI data uploaded but prediction failed</p>
              </div>
              <div class="training-status-items">
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Sensor data collected</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-robot text-primary"></i>
                  <span>AI Analysis: ${conditionIcon} ${conditionText} (${fallbackConfidence}% confidence)</span>
                </div>
                <div class="status-item">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Sensor Data uploaded to database</span>
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
      console.error('Error in AI prediction:', error);
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

  // Environmental conditions analysis based on baseline values
  analyzeEnvironmentalConditions(temperature, humidity) {
    // Baseline environmental conditions for room temperature storage
    const baselineTemp = 22; // Room temperature baseline
    const baselineHumidity = 50; // Normal humidity baseline
    
    const tempDeviation = temperature - baselineTemp;
    const humidityDeviation = humidity - baselineHumidity;
    
    let tempRisk = 'normal';
    let humidityRisk = 'normal';
    let overallRisk = 'normal';
    
    // Temperature analysis - more lenient for room temperature storage
    if (temperature > 35) {
      tempRisk = 'high';
    } else if (temperature > 30) {
      tempRisk = 'medium';
    } else if (temperature < 10) {
      tempRisk = 'low'; // Very cold
    }
    
    // Humidity analysis - more lenient for room temperature storage
    if (humidity > 85) {
      humidityRisk = 'high';
    } else if (humidity > 75) {
      humidityRisk = 'medium';
    } else if (humidity < 25) {
      humidityRisk = 'low'; // Very dry
    }
    
    // Overall environmental risk
    if (tempRisk === 'high' || humidityRisk === 'high') {
      overallRisk = 'high';
    } else if (tempRisk === 'medium' || humidityRisk === 'medium') {
      overallRisk = 'medium';
    }
    
    return {
      baselineTemp,
      baselineHumidity,
      tempDeviation,
      humidityDeviation,
      tempRisk,
      humidityRisk,
      overallRisk,
      recommendation: this.getEnvironmentalRecommendation(tempRisk, humidityRisk)
    };
  }

  // Gets environmental recommendation based on risk levels
  getEnvironmentalRecommendation(tempRisk, humidityRisk) {
    if (tempRisk === 'high' && humidityRisk === 'high') {
      return 'High temperature and humidity detected. Consider refrigeration or air conditioning to slow spoilage.';
    } else if (tempRisk === 'high') {
      return 'High temperature detected. Store in cooler location or refrigerate if possible.';
    } else if (humidityRisk === 'high') {
      return 'High humidity detected. Use dehumidifier or store in drier location.';
    } else if (tempRisk === 'medium' || humidityRisk === 'medium') {
      return 'Environmental conditions are slightly elevated. Monitor food closely.';
    } else {
      return 'Environmental conditions are within normal range for your location.';
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

    // Use standardized gas emission thresholds for all foods
    const gasAnalysis = this.analyzeGasEmissionThresholds(gasLevel);
    
    // Analyze environmental conditions
    const envAnalysis = this.analyzeEnvironmentalConditions(temperature, humidity);
    
    // CRITICAL RULE: EITHER high humidity (>90%) OR gas (>70 ppm) triggers unsafe
    // This is based on observations that either condition alone can indicate spoilage
    const isUnsafeByHumidity = humidity > 90;
    const isUnsafeByGas = gasLevel > 70;
    
    if (isUnsafeByHumidity || isUnsafeByGas) {
      let criticalFactor = [];
      let recommendation = 'CRITICAL: ';
      
      if (isUnsafeByHumidity && isUnsafeByGas) {
        criticalFactor.push('humidity', 'gas');
        recommendation += `Both extremely high humidity (${humidity.toFixed(1)}%) and elevated gas levels (${gasLevel.toFixed(1)} ppm) detected. `;
      } else if (isUnsafeByHumidity) {
        criticalFactor.push('humidity');
        recommendation += `Extremely high humidity (${humidity.toFixed(1)}%) detected. `;
      } else {
        criticalFactor.push('gas');
        recommendation += `Elevated gas levels (${gasLevel.toFixed(1)} ppm) detected. `;
      }
      
      recommendation += `Food is unsafe to consume. Inspect immediately - if strong smell or rot is observed, dispose immediately. `;
      recommendation += `This promotes rapid bacterial growth and spoilage.`;
      
      return {
        condition: 'unsafe',
        spoilageScore: isUnsafeByHumidity && isUnsafeByGas ? 95 : 85,
        temperature,
        humidity,
        gasLevel,
        assessment: {
          gasRisk: gasAnalysis.riskLevel,
          gasThreshold: gasAnalysis.threshold,
          recommendation: recommendation,
          environmental: envAnalysis,
          environmentalOverride: isUnsafeByHumidity,
          gasOverride: isUnsafeByGas,
          criticalFactor: criticalFactor.join('_and_')
        }
      };
    }
    
    // If gas analysis indicates high or medium risk (but gas <= 70), combine with environmental factors
    if (gasAnalysis.riskLevel === 'high' || (gasAnalysis.riskLevel === 'medium' && gasAnalysis.status === 'caution')) {
      // Combine with environmental factors
      let finalSpoilageScore = gasAnalysis.probability;
      let finalCondition = gasAnalysis.status;
      
      // Increase probability if environmental conditions are also poor
      if (envAnalysis.overallRisk === 'high') {
        finalSpoilageScore = Math.min(95, finalSpoilageScore + 15);
        if (finalCondition === 'caution') finalCondition = 'unsafe';
      } else if (envAnalysis.overallRisk === 'medium') {
        finalSpoilageScore = Math.min(90, finalSpoilageScore + 10);
      }
      
      return {
        condition: finalCondition,
        spoilageScore: finalSpoilageScore,
        temperature,
        humidity,
        gasLevel,
        assessment: {
          gasRisk: gasAnalysis.riskLevel,
          gasThreshold: gasAnalysis.threshold,
          recommendation: `${gasAnalysis.recommendation} ${envAnalysis.overallRisk !== 'normal' ? envAnalysis.recommendation : ''}`,
          environmental: envAnalysis
        }
      };
    }

    // For low-risk gas levels, analyze environmental conditions
    let spoilageScore = gasAnalysis.probability;
    let condition = gasAnalysis.status;
    
    // Apply environmental adjustments - environmental factors can significantly impact safety
    if (envAnalysis.overallRisk === 'high') {
      // High environmental risk with low gas = elevated caution
      spoilageScore = Math.min(75, spoilageScore + 35);
      condition = 'caution';
    } else if (envAnalysis.overallRisk === 'medium') {
      spoilageScore = Math.min(60, spoilageScore + 25);
      if (condition === 'safe') condition = 'caution';
    }
    
    return {
      condition,
      spoilageScore,
      temperature,
      humidity,
      gasLevel,
      assessment: {
        gasRisk: gasAnalysis.riskLevel,
        gasThreshold: gasAnalysis.threshold,
        recommendation: gasAnalysis.recommendation,
        environmental: envAnalysis,
        tempRisk: envAnalysis.tempRisk,
        humidityRisk: envAnalysis.humidityRisk
      }
    };
  }

  // Create AI-powered training data from Smart Training scan (DEPRECATED - using rule-based prediction)
  async createAITrainingData(foodName, foodCategory, sensorData) {
    // Training model removed - using rule-based prediction instead
    console.log('Training data creation skipped - using rule-based prediction');
    return { success: true, message: 'Using rule-based prediction (training model removed)' };
  }

  // Get validated AI analysis that waits for backend validation to complete
  async getValidatedAIAnalysis(foodName, sensorData) {
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

      console.log('🔍 Calling AI analysis endpoint with validation...');
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
        console.log('🔍 Validated AI Analysis Response Received:');
        console.log('  Full Result:', result);
        console.log('  Analysis Object:', result.analysis);
        console.log('  Risk Level:', result.analysis.riskLevel);
        console.log('  Risk Score:', result.analysis.riskScore);
        console.log('  Notes:', result.analysis.notes);
        console.log('  Mapped Status:', this.mapRiskLevelToSpoilageStatus(result.analysis.riskLevel));
        
        // Check if this result was validated (should have validation note)
        if (result.analysis.notes && result.analysis.notes.includes('Validated against safety analysis')) {
          console.log('✅ Received validated AI analysis result');
        } else {
          console.log('⚠️ AI analysis result may not be validated');
        }
        
        return { success: true, analysis: result.analysis };
      } else {
        console.error('Failed to get validated AI analysis:', result.error);
        return { success: false, error: result.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('Error getting validated AI analysis:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Get AI analysis using the working analysis endpoint (legacy method)
  async getAIAnalysis(foodName, sensorData) {
    // Redirect to validated version
    return await this.getValidatedAIAnalysis(foodName, sensorData);
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

      // Training model removed - using rule-based prediction directly
      console.log('Using rule-based prediction (training model removed)...', {
        food_name: foodName,
        food_category: foodCategory,
        temperature: temp,
        humidity: humidity,
        gas_level: gas,
        spoilage_status: spoilageStatus
      });

      // Step 1: Generate rule-based prediction (no training data step)
      console.log('Generating AI prediction...', {
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
          expiration_date: this.predictedExpiry || null, // Include predicted expiry date
          spoilage_probability: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.riskScore || 75) : 75,
          spoilage_status: (() => {
            const mappedStatus = aiAnalysisResult.success ? 
              this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe';
            
            console.log('🔍 ML Workflow Request Debug:');
            console.log('  AI Analysis Success:', aiAnalysisResult.success);
            console.log('  AI Risk Level:', aiAnalysisResult.success ? aiAnalysisResult.analysis.riskLevel : 'N/A');
            console.log('  AI Risk Score:', aiAnalysisResult.success ? aiAnalysisResult.analysis.riskScore : 'N/A');
            console.log('  Mapped Spoilage Status:', mappedStatus);
            console.log('  Display Override Status:', spoilageStatus);
            console.log('  Sensor Data:', { temp, humidity, gas });
            console.log('  Predicted Expiry:', this.predictedExpiry || 'Not set');
            
            return mappedStatus;
          })(),
          confidence_score: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.riskScore || 75) : 75,
          recommendations: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.recommendations || []) : [],
          // Send both original AI result and display override for comparison
          ai_original_status: aiAnalysisResult.success ? 
            this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe',
          display_override_status: spoilageStatus
        })
      });

      console.log('Prediction response status:', predictionResponse.status);
      const predictionResult = await predictionResponse.json();
      console.log('Prediction response:', predictionResult);
      
      if (!predictionResult.success) {
        throw new Error('Failed to generate AI prediction: ' + predictionResult.error);
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
      
      // Debug the spoilage status mapping
      console.log('🔍 ML Workflow Result Creation:');
      console.log('  Input spoilageStatus parameter (for display):', spoilageStatus);
      console.log('  AI Analysis Result:', aiAnalysisResult);
      console.log('  AI Analysis Success:', aiAnalysisResult.success);
      console.log('  AI Risk Level:', aiAnalysisResult.success ? aiAnalysisResult.analysis?.riskLevel : 'N/A');
      console.log('  AI Original Status (for ML):', aiAnalysisResult.success ? 
        this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe');
      
      // Use the validated AI analysis result if available
      const validatedRiskLevel = aiAnalysisResult.success ? aiAnalysisResult.analysis.riskLevel : 'Low';
      const validatedSpoilageStatus = this.mapRiskLevelToSpoilageStatus(validatedRiskLevel);
      const validatedConfidence = aiAnalysisResult.success ? 
        (aiAnalysisResult.analysis.riskScore || 75) : 75;
      
      console.log('🔍 Creating ML workflow result with validated AI data:');
      console.log('  Validated Risk Level:', validatedRiskLevel);
      console.log('  Validated Spoilage Status:', validatedSpoilageStatus);
      console.log('  Validated Confidence:', validatedConfidence);
      console.log('  Input spoilageStatus (display override):', spoilageStatus);
      
      const result = {
        success: true,
        prediction_id: predictionResult.prediction_id,
        spoilage_status: validatedSpoilageStatus, // Use validated AI result
        spoilage_probability: validatedConfidence,
        confidence_score: validatedConfidence,
        ai_risk_level: validatedRiskLevel, // Include original risk level
        display_override_status: spoilageStatus, // Keep original for comparison
        gas_risk_level: predictionResult.gas_emission_support?.risk_level || 'low' // Gas emission risk level from prediction
      };
      
      // Store the analysis result for use in modal and history
      this._lastAnalysisResult = result;
      console.log('📊 Final validated analysis result stored:', result);
      
      return result;

    } catch (error) {
      console.error('Error in ML workflow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create training data from Smart Training scan (DEPRECATED - using rule-based prediction)
  async createTrainingData(foodName, foodCategory, sensorData, actualCondition) {
    // Training model removed - using rule-based prediction instead
    console.log('Training data creation skipped - using rule-based prediction');
    return { success: true, message: 'Using rule-based prediction (training model removed)' };
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

      // Scanner should NOT insert into food_items. Use existing items only.
      console.warn('Smart Training createMultipleFoodItemsWithAnalyzedStatus is disabled to avoid inserting into food_items via scanner.');
      return [];
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

      // Disable direct insertion from scanner path
      console.warn('createFoodItemWithAnalyzedStatus disabled for SmartSense Scanner to prevent DB insert.');
      return null;
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

      console.warn('createFoodItem disabled for SmartSense Scanner to prevent inserting into food_items.');
      return null;
    } catch (error) {
      console.error('Error creating food item:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  // Perform AI prediction using existing training data
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

      console.log('Performing AI prediction:', predictionData);

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
        console.log('AI prediction successful:', result);
        return { success: true, prediction: result.prediction };
      } else {
        console.error('AI prediction failed:', result.error);
        return { success: false, error: result.error || 'Prediction failed' };
      }
    } catch (error) {
      console.error('Error performing AI prediction:', error);
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
    
    // Cancel/close scan session when scanning is cancelled
    try {
      const sessionToken = this.getAuthToken();
      fetch('/api/sensor/scan-session', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify({ 
          user_id: getCurrentUserId(), 
          session_id: this.currentScanSession?.session_id 
        })
      }).finally(() => { this.currentScanSession = null; });
    } catch (error) {
      console.error('Failed to cancel scan session after cancellation:', error);
      this.currentScanSession = null;
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

// Global debug function to force show OK button
window.forceShowOKButton = function() {
    const okButton = document.getElementById('okFoodSelected');
    const autoTrainingStatus = document.getElementById('autoTrainingStatus');
    
    console.log('🔧 Global forceShowOKButton called');
    console.log('okButton found:', !!okButton);
    console.log('autoTrainingStatus found:', !!autoTrainingStatus);
    
    if (autoTrainingStatus) {
        autoTrainingStatus.classList.add('completed');
        autoTrainingStatus.classList.remove('loading');
        console.log('✅ Added completed class to autoTrainingStatus');
    }
    
    if (okButton) {
        okButton.style.setProperty('display', 'block', 'important');
        okButton.style.setProperty('visibility', 'visible', 'important');
        okButton.style.setProperty('opacity', '1', 'important');
        okButton.disabled = false;
        okButton.textContent = 'OK';
        console.log('✅ OK button forced to be visible via global function');
    } else {
        console.error('❌ OK button not found in global function');
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
