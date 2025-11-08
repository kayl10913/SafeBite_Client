// sensor-dashboard.js - Updated to fetch real Arduino sensor data

// List of registered devices (Arduino sensors) - Will be populated from database
let registeredDevices = [];

// Real-time sensor data storage - will be populated from database
let realTimeSensorData = {
  temperature: { value: 0, unit: '°C', max: 50, status: 'offline' },
  humidity: { value: 0, unit: '%', max: 100, status: 'offline' },
  gas: { value: 0, unit: 'ppm', max: 1000, status: 'offline' }
};

// Gauge ranges (min/max) populated from database gauge_data
let gaugeRanges = {
  temperature: { min: -10, max: 50 },
  humidity: { min: 0, max: 100 },
  gas: { min: 0, max: 1000 }
};

// Food items from database - Will be populated dynamically
let foodItems = [];

// Admin data: available sensor types
const adminSensorTypes = ['temperature', 'humidity', 'gas'];
// Global toggle for realtime auto-reloads
const REALTIME_ENABLED = true;

// Real-time scanning variables
let realTimeScanningActive = false;
let realTimeScanningInterval = null;
let scanningStartTime = null;

class SensorDashboard {
  constructor() {
    const instanceId = Math.random().toString(36).slice(2, 8);
    console.log(`🔍 [${instanceId}] SensorDashboard constructor called`);
    
    this.selectedFoodId = null;
    this.realtimeTimer = null;
    this.lastDataFingerprint = null;
    this._fetchingLatest = false;
    this._latestAbort = null;
    this.currentScanSession = null; // Track current scan session
    this.isScanningInProgress = false; // Prevent multiple simultaneous scans
    this.instanceId = instanceId; // Store instance ID for debugging
    this.scanCancelled = false; // Flag to cancel ongoing scan
    this.scanAbortController = null; // Abort controller for scan cancellation
    this.init();
    if (REALTIME_ENABLED) this.startRealTimeUpdates();
    // Ensure modal compatibility with SPA navigation
    this.ensureModalCompatibility();
  }

  async init() {
    // Load cached devices first to avoid blank state on SPA swaps
    this.loadCachedDevices();
    await this.fetchSensorDevices();
    await this.fetchFoodItems();
    this.populateFoodDropdown();
    this.populateMLFoodDropdown(); // Add ML food dropdown population
    this.setupEventListeners();
    // Load cached latest BEFORE first render to avoid 0/offline flash
    this.loadCachedLatest();
    this.renderRegisteredDevices();
    this.updateSensorCardsWithRealData(true);
    // Then fetch fresh data only if realtime is enabled
    if (REALTIME_ENABLED) {
      this.fetchLatestSensorData();
      this.fetchArduinoLatestData(); // Also fetch Arduino latest data
      this.fetchGaugeData(); // Also fetch gauge data on init
      // Test API connection on startup
      this.testAPIConnection();
    }
  }

  // Create scan session for Arduino data reception
  async createScanSession() {
    try {
      if (this.currentScanSession && this.currentScanSession.session_id) {
        console.log('Scan session already active:', this.currentScanSession.session_id);
        return this.currentScanSession;
      }
      console.log('🔍 Creating scan session...');
      
      const sessionToken = localStorage.getItem('jwt_token') || 
                          localStorage.getItem('sessionToken') || 
                          localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.error('❌ No session token found for scan session creation');
        // Try without authentication for testing
        console.log('🔄 Trying without authentication...');
        
        const response = await fetch('/api/sensor/scan-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: 11, // Arduino user ID
            session_data: {
              frontend_initiated: true,
              timestamp: new Date().toISOString()
            }
          })
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Scan session created (no auth):', result.session);
          this.currentScanSession = result.session;
          
          // Set up automatic timeout to ensure session is completed/cancelled
          this.setupSessionTimeout();
          
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
            timestamp: new Date().toISOString()
          }
        })
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📊 Response data:', result);
      
      if (result.success) {
        console.log('✅ Scan session created:', result.session);
        this.currentScanSession = result.session;
        
        // Set up automatic timeout to ensure session is completed/cancelled
        this.setupSessionTimeout();
        
        return result.session;
      } else {
        throw new Error(result.error || 'Failed to create scan session');
      }
    } catch (error) {
      console.error('❌ Error creating scan session:', error);
      throw error;
    }
  }

  // Complete scan session
  async completeScanSession() {
    if (!this.currentScanSession) {
      console.log('❌ No active scan session to complete');
      console.log('🔍 Current scan session state:', this.currentScanSession);
      console.log('🔍 Attempting to check for any active sessions...');
      
      // Try to check if there are any active sessions
      try {
        const response = await fetch('/api/sensor/scan-session-status?user_id=11', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        console.log('🔍 Active session check result:', result);
        
        if (result.success && result.active) {
          console.log('🔍 Found active session, using it:', result.session);
          this.currentScanSession = result.session;
        } else {
          console.log('⚠️ No active sessions found, skipping completion');
          return;
        }
      } catch (error) {
        console.error('❌ Error checking for active sessions:', error);
        return;
      }
    }

    try {
      console.log('🔍 Completing scan session:', this.currentScanSession.session_id);
      console.log('🔍 Session details:', this.currentScanSession);
      
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
          
          // Clear the timeout since session completed successfully
          if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
            console.log('⏰ Session timeout cleared - session completed successfully');
          }
          
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
        
        // Clear the timeout since session completed successfully
        if (this.sessionTimeout) {
          clearTimeout(this.sessionTimeout);
          this.sessionTimeout = null;
          console.log('⏰ Session timeout cleared - session completed successfully');
        }
        
        // Verify that Arduino data is now blocked
        await this.verifyArduinoBlocking();
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

  // Force block Arduino data when session completion fails
  async forceBlockArduinoData() {
    try {
      console.log('🚫 Force blocking Arduino data...');
      
      // Try to complete any active sessions for user 11 (Arduino)
      const response = await fetch('/api/sensor/scan-session', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: 11 // Arduino user ID
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Force blocked Arduino data - all active sessions cancelled');
      } else {
        console.log('⚠️ Force block attempt completed, but may not have found active sessions');
      }
    } catch (error) {
      console.error('❌ Error force blocking Arduino data:', error);
    }
  }

  // Verify that Arduino data is properly blocked
  async verifyArduinoBlocking() {
    try {
      console.log('🔍 Verifying Arduino data blocking...');
      
      const response = await fetch('/api/sensor/scan-session-status?user_id=11', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.active) {
          console.log('⚠️ WARNING: Arduino data is still allowed - active session found:', result.session);
        } else {
          console.log('✅ Arduino data is properly blocked - no active sessions found');
        }
      } else {
        console.log('⚠️ Could not verify Arduino blocking status:', result.error);
      }
    } catch (error) {
      console.error('❌ Error verifying Arduino blocking:', error);
    }
  }

  // Set up automatic timeout for scan session
  setupSessionTimeout() {
    // Clear any existing timeout
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
    
    // Set timeout for 5 minutes (300000ms) to automatically cancel session
    this.sessionTimeout = setTimeout(async () => {
      if (this.currentScanSession) {
        console.log('⏰ Scan session timeout reached - automatically cancelling session');
        try {
          await this.forceBlockArduinoData();
          this.currentScanSession = null;
          console.log('✅ Session automatically cancelled due to timeout');
        } catch (error) {
          console.error('❌ Error auto-cancelling session:', error);
        }
      }
    }, 300000); // 5 minutes
    
    console.log('⏰ Session timeout set for 5 minutes');
  }

  // Fetch sensor devices from database
  async fetchSensorDevices() {
    try {
      console.log('Fetching sensor devices from database...');
      
      // Get session token from localStorage (check multiple locations for compatibility)
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      if (!sessionToken) {
        console.warn('No session token found; skipping device refresh to keep current UI');
        return;
      }
      
      const response = await fetch('/api/sensor/devices', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('401 on devices; keeping current registeredDevices');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Sensor devices response:', result);
      
      if (result.success && result.sensors) {
        // Convert database sensors to registered devices format
        registeredDevices = result.sensors.map(sensor => ({
          name: `${sensor.type} Sensor`,
          sensorType: sensor.type.toLowerCase(),
          id: `SENSOR_${sensor.type.toUpperCase()}_${sensor.sensor_id}`,
          sensor_id: sensor.sensor_id,
          type: sensor.type
        }));
        console.log('Registered devices updated:', registeredDevices);
        try { localStorage.setItem('registered_devices', JSON.stringify(registeredDevices)); } catch (_) {}
      } else {
        console.log('No sensor devices found or API error');
        // Keep current/cached devices; do not overwrite with defaults
      }
    } catch (error) {
      console.error('Error fetching sensor devices:', error);
      // Keep current devices on error to preserve UI
    }
  }

  // Fetch food items from database
  async fetchFoodItems() {
    try {
      console.log('Fetching food items from database...');
      
      // Get session token from localStorage (check multiple locations for compatibility)
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      if (!sessionToken) {
        console.warn('No session token found; skipping food items refresh');
        return;
      }
      
      const response = await fetch('/api/users/food-items', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('401 on food-items; keeping current list');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Food items response:', result);
      
      if (result.success && result.food_items) {
        foodItems = result.food_items;
        console.log('Food items updated:', foodItems);
      } else {
        console.log('No food items found or API error');
        foodItems = [];
      }
    } catch (error) {
      console.error('Error fetching food items:', error);
      // keep current list
    }
  }

  // Test API connection with your actual database data
  async testAPIConnection() {
    try {
      console.log('Testing API connection with your database readings...');
      
      // Test the latest sensor endpoint first
      const token = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
      
      const latestResponse = await fetch('/api/sensor/latest', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Latest sensor API Status:', latestResponse.status);
      
      if (latestResponse.ok) {
        const latestResult = await latestResponse.json();
        console.log('Latest sensor data from your database:', latestResult);
        
        if (latestResult.success && latestResult.data) {
          console.log('✅ Database connection successful!');
          console.log('📊 Your sensor readings:');
          if (latestResult.data.temperature) {
            console.log(`🌡️ Temperature: ${latestResult.data.temperature.value} ${latestResult.data.temperature.unit}`);
          }
          if (latestResult.data.humidity) {
            console.log(`💧 Humidity: ${latestResult.data.humidity.value} ${latestResult.data.humidity.unit}`);
          }
          if (latestResult.data.gas) {
            console.log(`💨 Gas: ${latestResult.data.gas.value} ${latestResult.data.gas.unit}`);
          }
        }
      } else {
        console.log('Latest sensor API not available, testing authenticated endpoint...');
        
        // Fallback to authenticated endpoint
        const sessionToken = localStorage.getItem('jwt_token') || 
                             localStorage.getItem('sessionToken') || 
                             localStorage.getItem('session_token');
        if (sessionToken) {
          const response = await fetch('/api/sensor/data', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Authenticated API Status:', response.status);
          
          if (response.ok) {
            const result = await response.json();
            console.log('Authenticated API Result:', result);
          }
        }
      }
    } catch (error) {
      console.error('API connection test failed:', error);
    }
  }

  // Fetch latest sensor data for the authenticated user (DB-backed)
  async fetchLatestSensorData() {
    try {
      if (this._fetchingLatest) return; // prevent overlapping reloads
      if (this._latestAbort) { try { this._latestAbort.abort(); } catch (_) {} }
      this._latestAbort = new AbortController();
      this._fetchingLatest = true;
      console.log('Fetching latest user sensor data from /api/sensor/latest-user...');
      
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      if (!sessionToken) {
        console.error('No session token found - redirecting to login');
        window.location.href = '/pages/Login.html';
        return;
      }
      
      const response = await fetch((typeof buildApiUrl === 'function' ? buildApiUrl('/api/sensor/latest-user') : '/api/sensor/latest-user'), {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        signal: this._latestAbort.signal
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication required - user not logged in');
          window.location.href = '/pages/Login.html';
        }
        // Do not blank UI on transient errors
        return;
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        // Fingerprint to prevent unnecessary UI work
        const fp = JSON.stringify(result.data);
        if (this.lastDataFingerprint && this.lastDataFingerprint === fp) {
          return; // no change
        }
        this.lastDataFingerprint = fp;

        console.log('Latest sensor data received:', result.data);
        
        // Store the latest sensor data globally for device info bar access
        window.latestSensorData = result;
        // Persist to localStorage to survive SPA template swaps
        try { localStorage.setItem('latest_sensor_payload', JSON.stringify(result)); } catch (_) {}
        
        // Update real-time sensor data from latest sensor readings
        if (result.data) {
          // Update only sensors present; keep previous values for missing ones
          if (result.data.temperature && result.data.temperature.value != null) {
            realTimeSensorData.temperature.value = parseFloat(result.data.temperature.value).toFixed(2);
            realTimeSensorData.temperature.unit = result.data.temperature.unit || realTimeSensorData.temperature.unit;
            realTimeSensorData.temperature.status = result.data.temperature.status || 'online';
          }
          if (result.data.humidity && result.data.humidity.value != null) {
            realTimeSensorData.humidity.value = parseFloat(result.data.humidity.value).toFixed(2);
            realTimeSensorData.humidity.unit = result.data.humidity.unit || realTimeSensorData.humidity.unit;
            realTimeSensorData.humidity.status = result.data.humidity.status || 'online';
          }
          if (result.data.gas && result.data.gas.value != null) {
            realTimeSensorData.gas.value = parseFloat(result.data.gas.value).toFixed(2);
            realTimeSensorData.gas.unit = result.data.gas.unit || realTimeSensorData.gas.unit;
            realTimeSensorData.gas.status = result.data.gas.status || 'online';
          }
        }
        
        // Update gauge ranges from backend gauge_data
        if (result.gauge_data) {
          ['temperature','humidity','gas'].forEach(type => {
            const g = result.gauge_data[type];
            if (g && g.min !== null && g.max !== null && g.min !== undefined && g.max !== undefined) {
              const min = parseFloat(g.min);
              const max = parseFloat(g.max);
              if (!isNaN(min) && !isNaN(max)) {
                gaugeRanges[type] = { min, max };
              }
            }
          });
        }
        
        // Repaint only the sensor cards when new data arrives (always)
        this.updateSensorCardsWithRealData(true);
        this.updateSensorsSummary();
      } else {
        console.log('No latest sensor data available (keeping last known values)');
        // Do not blank existing values; simply skip update
      }
    } catch (error) {
      console.error('Error fetching sensor data from database:', error);
      // Keep last known values on error
    } finally {
      this._fetchingLatest = false;
      this._latestAbort = null;
    }
  }

  loadCachedLatest() {
    try {
      const raw = localStorage.getItem('latest_sensor_payload');
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (!cached || !cached.data) return;
      const d = cached.data;
      if (d.temperature && d.temperature.value != null) {
        realTimeSensorData.temperature.value = parseFloat(d.temperature.value).toFixed(2);
        realTimeSensorData.temperature.unit = d.temperature.unit || realTimeSensorData.temperature.unit;
        realTimeSensorData.temperature.status = d.temperature.status || 'online';
      }
      if (d.humidity && d.humidity.value != null) {
        realTimeSensorData.humidity.value = parseFloat(d.humidity.value).toFixed(2);
        realTimeSensorData.humidity.unit = d.humidity.unit || realTimeSensorData.humidity.unit;
        realTimeSensorData.humidity.status = d.humidity.status || 'online';
      }
      if (d.gas && d.gas.value != null) {
        realTimeSensorData.gas.value = parseFloat(d.gas.value).toFixed(2);
        realTimeSensorData.gas.unit = d.gas.unit || realTimeSensorData.gas.unit;
        realTimeSensorData.gas.status = d.gas.status || 'online';
      }
    } catch (_) {}
  }

  // Fetch latest sensor data from Arduino (user 11) as fallback
  async fetchArduinoLatestData() {
    try {
      console.log('Fetching latest Arduino sensor data...');
      
      // Get authentication token
      const token = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
      
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      const response = await fetch('/api/sensor/latest', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Arduino latest data:', result);
        
        if (result.success && result.data) {
          // Update real-time sensor data with Arduino data (from your database readings)
          if (result.data.temperature) {
            realTimeSensorData.temperature.value = parseFloat(result.data.temperature.value).toFixed(2);
            realTimeSensorData.temperature.unit = result.data.temperature.unit || '°C';
            realTimeSensorData.temperature.status = 'online';
            console.log('Arduino temperature from database:', realTimeSensorData.temperature.value, result.data.temperature.unit);
          }
          
          if (result.data.humidity) {
            realTimeSensorData.humidity.value = parseFloat(result.data.humidity.value).toFixed(2);
            realTimeSensorData.humidity.unit = result.data.humidity.unit || '%';
            realTimeSensorData.humidity.status = 'online';
            console.log('Arduino humidity from database:', realTimeSensorData.humidity.value, result.data.humidity.unit);
          }
          
          if (result.data.gas) {
            realTimeSensorData.gas.value = parseFloat(result.data.gas.value).toFixed(2);
            realTimeSensorData.gas.unit = result.data.gas.unit || 'ppm';
            realTimeSensorData.gas.status = 'online';
            console.log('Arduino gas from database:', realTimeSensorData.gas.value, result.data.gas.unit);
          }
          
          // Update display
          this.updateSensorCardsWithRealData();
        }
      }
    } catch (error) {
      console.error('Error fetching Arduino latest data:', error);
    }
  }

  // Fetch gauge data from your dedicated gauges endpoint
  async fetchGaugeData() {
    try {
      console.log('Fetching gauge data from /api/sensor/gauges...');
      
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      if (!sessionToken) {
        console.error('No session token found');
        return;
      }
      
      const response = await fetch('/api/sensor/gauges', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Gauge data received:', result);
        
        if (result.success && result.gauge_data) {
          // Update gauge ranges with your API data
          Object.keys(result.gauge_data).forEach(sensorType => {
            if (gaugeRanges[sensorType] && result.gauge_data[sensorType]) {
              const gaugeData = result.gauge_data[sensorType];
              if (gaugeData.min !== null && gaugeData.max !== null) {
                gaugeRanges[sensorType] = {
                  min: parseFloat(gaugeData.min),
                  max: parseFloat(gaugeData.max)
                };
              }
            }
          });
          
          // Update real-time sensor data with gauge values
          Object.keys(result.gauge_data).forEach(sensorType => {
            if (realTimeSensorData[sensorType] && result.gauge_data[sensorType]) {
              const gaugeData = result.gauge_data[sensorType];
              realTimeSensorData[sensorType] = {
                value: parseFloat(gaugeData.value || 0).toFixed(2),
                unit: gaugeData.unit || realTimeSensorData[sensorType].unit,
                max: parseFloat(gaugeData.max) || realTimeSensorData[sensorType].max,
                status: gaugeData.status || 'offline',
                timestamp: gaugeData.timestamp || null
              };
            }
          });
          
          // Update display
          this.updateSensorCardsWithRealData();
        }
      }
    } catch (error) {
      console.error('Error fetching gauge data from database:', error);
    }
  }

  // Start real-time updates with visibility-aware polling
  startRealTimeUpdates() {
    const poll = async () => {
      if (document.hidden) return; // pause when tab not visible
      if (this.selectedFoodId) return; // don't override food-specific view
      await this.fetchLatestSensorData();
      // Avoid gauge range fetch here; rely on latest-user for speed
      // After data refresh, update cards but avoid re-rendering SENSOR STATUS
      this.updateSensorCardsWithRealData(true);
    };

    // Initial kick
    poll();

    // Clear any existing timer then start new
    if (this.realtimeTimer) clearInterval(this.realtimeTimer);
    // Faster when visible; you can tune this interval
    this.realtimeTimer = setInterval(poll, 3000);

    // Adjust on visibility change
    const onVis = () => {
      if (document.hidden) return; // will resume on next tick
      poll();
    };
    document.removeEventListener('visibilitychange', onVis);
    document.addEventListener('visibilitychange', onVis);
  }

  async populateFoodDropdown() {
    const select = document.getElementById('device-select');
    if (!select) return;
    select.innerHTML = '<option value="">Select a food...</option>';
    
    if (foodItems && foodItems.length > 0) {
      foodItems.forEach(food => {
        const option = document.createElement('option');
        option.value = food.food_id;
        option.textContent = `${food.name} (${food.category})`;
        select.appendChild(option);
      });
    } else {
      // Populate with available devices from DB/cache
      let devices = [];
      try {
        // 1) Use cached connected devices from Device tab
        const cached = localStorage.getItem('connectedDevices');
        if (cached) {
          const arr = JSON.parse(cached);
          if (Array.isArray(arr)) devices = arr.map(d => ({ sensor_id: d.sensor_id || d.id, type: d.type }));
        }
      } catch (_) {}

      // 2) Fallback to cached registered_devices
      if (devices.length === 0) {
        try {
          const raw = localStorage.getItem('registered_devices');
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) devices = arr.map(d => ({ sensor_id: d.sensor_id, type: d.type }));
          }
        } catch (_) {}
      }

      // 3) Try sensor.js API: /api/sensor/data?action=get_sensors
      if (devices.length === 0) {
        try {
          const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
          if (token) {
            const res = await fetch('/api/sensor/data?action=get_sensors', { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            if (res.ok) {
              const j = await res.json();
              if (j && j.success && Array.isArray(j.sensors)) {
                devices = j.sensors.map(s => ({ sensor_id: s.sensor_id, type: s.type }));
              }
            }
          }
        } catch (_) {}
      }

      // 4) As last resort, fetch from /api/sensor/devices
      if (devices.length === 0) {
        try {
          const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
          if (token) {
            const res = await fetch('/api/sensor/devices', { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            if (res.ok) {
              const j = await res.json();
              if (j && j.success && Array.isArray(j.sensors)) {
                devices = j.sensors.map(s => ({ sensor_id: s.sensor_id, type: s.type }));
              }
            }
          }
        } catch (_) {}
      }

      if (devices.length > 0) {
        const header = document.createElement('option');
        header.value = '';
        header.textContent = 'Select a device...';
        select.appendChild(header);
        devices.forEach(s => {
          const opt = document.createElement('option');
          opt.value = `sensor:${s.sensor_id}`;
          opt.dataset.fallback = 'sensor';
          opt.textContent = `${s.type} (#${s.sensor_id})`;
          select.appendChild(opt);
        });
      } else {
        // No foods and no devices
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No food or devices available';
        option.disabled = true;
        select.appendChild(option);
      }
    }
  }

  // Populate ML food dropdown for data upload
  async populateMLFoodDropdown() {
    const mlSelect = document.getElementById('mlFoodSelect');
    const mlUploadSelect = document.getElementById('mlUploadFoodSelect');
    
    if (!mlSelect && !mlUploadSelect) return;
    
    try {
      // Load existing foods from database
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (sessionToken) {
        const response = await fetch('/api/users/food-items', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          const foodItems = result.food_items || [];
          
          // Clear existing options
          if (mlSelect) mlSelect.innerHTML = '<option value="">Select from available foods</option>';
          if (mlUploadSelect) mlUploadSelect.innerHTML = '<option value="">Select from available foods</option>';
          
          if (foodItems.length > 0) {
            // Remove duplicates by food name and category
            const uniqueFoods = foodItems.reduce((acc, food) => {
              const key = `${food.name}-${food.category}`;
              if (!acc[key]) {
                acc[key] = food;
              }
              return acc;
            }, {});
            
            Object.values(uniqueFoods).forEach(food => {
              const option = `<option value="${food.food_id}">${food.name} (${food.category})</option>`;
              if (mlSelect) mlSelect.innerHTML += option;
              if (mlUploadSelect) mlUploadSelect.innerHTML += option;
            });
            
            // Hide no food notification if it exists
            this.hideNoFoodNotification();
          } else {
            // Show notification when no food items are available
            this.showNoFoodNotification();
            
            // Add disabled option to indicate no food available
            if (mlSelect) {
              mlSelect.innerHTML = '<option value="" disabled>No food items available - Add food first</option>';
            }
            if (mlUploadSelect) {
              mlUploadSelect.innerHTML = '<option value="" disabled>No food items available - Add food first</option>';
            }
          }
        } else {
          // Show notification for API error
          this.showNoFoodNotification('Failed to load food items. Please try again.');
          
          if (mlSelect) {
            mlSelect.innerHTML = '<option value="" disabled>Error loading food items</option>';
          }
          if (mlUploadSelect) {
            mlUploadSelect.innerHTML = '<option value="" disabled>Error loading food items</option>';
          }
        }
      } else {
        // Show notification for no authentication
        this.showNoFoodNotification('Please log in to access food items.');
        
        if (mlSelect) {
          mlSelect.innerHTML = '<option value="" disabled>Please log in first</option>';
        }
        if (mlUploadSelect) {
          mlUploadSelect.innerHTML = '<option value="" disabled>Please log in first</option>';
        }
      }
    } catch (error) {
      console.error('Error loading existing foods for ML:', error);
      // Show notification for error
      this.showNoFoodNotification('Error loading food items. Please try again.');
      
      if (mlSelect) {
        mlSelect.innerHTML = '<option value="" disabled>Error loading food items</option>';
      }
      if (mlUploadSelect) {
        mlUploadSelect.innerHTML = '<option value="" disabled>Error loading food items</option>';
      }
    }
  }

  // Show notification when no food items are available
  showNoFoodNotification(message = 'No food items available for scanning. Please add food items first.') {
    // Remove existing notification if any
    this.hideNoFoodNotification();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'noFoodNotification';
    notification.className = 'alert alert-warning alert-dismissible fade show';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 400px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; padding: 12px 16px;">
        <i class="bi bi-exclamation-triangle-fill" style="margin-right: 8px; font-size: 18px;"></i>
        <div style="flex: 1;">
          <strong>No Food Available</strong>
          <div style="font-size: 14px; margin-top: 4px;">${message}</div>
        </div>
        <button type="button" class="btn-close" style="margin-left: 12px; background: none; border: none; font-size: 18px; color: #856404; cursor: pointer;" onclick="this.parentElement.parentElement.remove()">
          &times;
        </button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 8000);
  }

  // Hide notification when food items are available
  hideNoFoodNotification() {
    const existingNotification = document.getElementById('noFoodNotification');
    if (existingNotification) {
      existingNotification.remove();
    }
  }

  // Upload current sensor data for ML training
  async uploadMLTrainingData(foodId, status, notes = '') {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.error('No session token found');
        return { success: false, error: 'Authentication required' };
      }

      // Get current sensor data
      const sensorData = await this.getCurrentSensorData();
      if (!sensorData) {
        return { success: false, error: 'No sensor data available' };
      }

      // Prepare ML training data
      const trainingData = {
        food_id: foodId,
        food_status: status,
        temperature: sensorData.temperature?.value || null,
        humidity: sensorData.humidity?.value || null,
        gas_level: sensorData.gas?.value || null,
        notes: notes,
        timestamp: new Date().toISOString()
      };

      console.log('Uploading ML training data:', trainingData);

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
        console.log('ML training data uploaded successfully');
        
        // Create alert for ML training completion
        await this.createMLTrainingAlert(foodId, status, sensorData);
        
        // Update ML history
        this.updateMLHistory();
        return { success: true, data: result };
      } else {
        console.error('Failed to upload ML training data:', result.error);
        return { success: false, error: result.error || 'Upload failed' };
      }
    } catch (error) {
      console.error('Error uploading ML training data:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current sensor data for ML upload
  async getCurrentSensorData() {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');

      if (!sessionToken) {
        console.error('No authentication token found');
        return null;
      }

      const response = await fetch((typeof buildApiUrl === 'function' ? buildApiUrl('/api/sensor/latest-user') : '/api/sensor/latest-user'), {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('API request failed:', response.status, response.statusText);
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Error details:', errorText);
        return null;
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('API returned error:', result.error || 'Unknown error');
        return null;
      }

      if (!result.data) {
        console.warn('API returned no data');
        return null;
      }

      console.log('Successfully fetched sensor data:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error fetching current sensor data:', error);
      return null;
    }
  }

  // Update ML training history
  async updateMLHistory() {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');

      const response = await fetch('/api/ml/training-history', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          this.renderMLHistory(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching ML training history:', error);
    }
  }

  // Render ML training history
  renderMLHistory(historyData) {
    const historyList = document.getElementById('mlHistoryList');
    if (!historyList) return;

    if (!historyData || historyData.length === 0) {
      historyList.innerHTML = `
        <div class="no-history">
          <i class="bi bi-cpu"></i>
          <p>No ML training data uploaded yet</p>
          <span>Start by uploading sensor data above</span>
        </div>
      `;
      return;
    }

    const historyHTML = historyData.map(item => `
      <div class="ml-history-item">
        <div class="ml-history-info">
          <div class="ml-history-icon">
            <i class="bi bi-${this.getMLStatusIcon(item.food_status)}"></i>
          </div>
          <div class="ml-history-details">
            <h4>${item.food_name || 'Unknown Food'}</h4>
            <p>Status: ${item.food_status} | Temp: ${item.temperature}°C | Humidity: ${item.humidity}% | Gas: ${item.gas_level}ppm</p>
            ${item.notes ? `<small>Notes: ${item.notes}</small>` : ''}
          </div>
        </div>
        <div class="ml-history-meta">
          <div class="ml-history-time">${new Date(item.timestamp).toLocaleString()}</div>
          <div class="ml-history-status ${item.food_status}">${item.food_status}</div>
        </div>
      </div>
    `).join('');

    historyList.innerHTML = historyHTML;
  }

  // Get icon for ML status
  getMLStatusIcon(status) {
    const iconMap = {
      'fresh': 'check-circle',
      'spoiled': 'exclamation-triangle',
      'expired': 'x-circle'
    };
    return iconMap[status] || 'question-circle';
  }

  // Perform ML prediction using existing training data
  async performMLPrediction(foodId, foodName, foodCategory, sensorData, actualOutcome = null, isTrainingData = false) {
    const callId = Math.random().toString(36).slice(2, 8);
    console.log(`🔍 [${callId}] performMLPrediction called with:`, { foodId, foodName, foodCategory, isTrainingData });
    
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        return { success: false, error: 'Authentication required' };
      }

      const predictionData = {
        food_id: foodId,
        food_name: foodName,
        food_category: foodCategory,
        temperature: sensorData.temperature || null,
        humidity: sensorData.humidity || null,
        gas_level: sensorData.gas || null,
        actual_outcome: actualOutcome,
        is_training_data: isTrainingData ? 1 : 0
      };

      console.log(`🔍 [${callId}] Performing ML prediction:`, predictionData);

      const response = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(predictionData)
      });

      const result = await response.json();
      console.log(`🔍 [${callId}] ML prediction API response:`, result);
      
      if (result.success) {
        console.log(`✅ [${callId}] ML prediction successful:`, result);
        return { success: true, prediction: result.prediction };
      } else {
        console.error(`❌ [${callId}] ML prediction failed:`, result.error);
        return { success: false, error: result.error || 'Prediction failed' };
      }
    } catch (error) {
      console.error('Error performing ML prediction:', error);
      return { success: false, error: error.message };
    }
  }

  // Create alert for ML training completion
  async createMLTrainingAlert(foodId, status, sensorData) {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) return;

      // Get food name from dropdown
      const mlSelect = document.getElementById('mlFoodSelect');
      const selectedOption = mlSelect?.options[mlSelect.selectedIndex];
      const foodName = selectedOption?.textContent?.split(' (')[0] || 'Unknown Food';

      // Determine alert level based on food status
      let alertLevel = 'Low';
      let alertMessage = '';
      let recommendedAction = '';

      switch (status) {
        case 'fresh':
          alertLevel = 'Low';
          alertMessage = `✅ ML Training Complete: ${foodName} marked as fresh and healthy`;
          recommendedAction = 'Continue monitoring with regular scans';
          break;
        case 'spoiled':
          alertLevel = 'Medium';
          alertMessage = `⚠️ ML Training Complete: ${foodName} marked as spoiled - AI learned from this data`;
          recommendedAction = 'Dispose of spoiled food and clean storage area';
          break;
        case 'expired':
          alertLevel = 'High';
          alertMessage = `❌ ML Training Complete: ${foodName} marked as expired - AI learned from this data`;
          recommendedAction = 'Immediately dispose of expired food and check other items';
          break;
      }

      const alertData = {
        food_id: foodId,
        message: alertMessage,
        alert_level: alertLevel,
        alert_type: 'ml_prediction',
        spoilage_probability: status === 'fresh' ? 10 : status === 'spoiled' ? 75 : 95,
        recommended_action: recommendedAction,
        is_ml_generated: true,
        confidence_score: 85,
        alert_data: JSON.stringify({
          training_completed: true,
          food_status: status,
          sensor_readings: {
            temperature: sensorData.temperature?.value || null,
            humidity: sensorData.humidity?.value || null,
            gas_level: sensorData.gas?.value || null
          },
          timestamp: new Date().toISOString()
        })
      };

      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertData)
      });

      if (response.ok) {
        console.log('ML training alert created successfully');
      } else {
        console.error('Failed to create ML training alert');
      }
    } catch (error) {
      console.error('Error creating ML training alert:', error);
    }
  }

  setupEventListeners() {
    // De-duplicate global listeners across SPA re-inits
    if (window.__sd_changeHandler) {
      document.removeEventListener('change', window.__sd_changeHandler);
    }
    if (window.__sd_clickHandler) {
      document.removeEventListener('click', window.__sd_clickHandler);
    }

    const changeHandler = async (e) => {
      if (e.target.id === 'device-select') {
        if (e.target.value) {
          const val = String(e.target.value);
          // Handle fallback device selection like sensor:ID
          if (val.startsWith('sensor:')) {
            this.selectedFoodId = null;
            this.updateSensorCardsWithRealData(true);
          } else {
            this.selectedFoodId = val;
            await this.updateSensorCardsForFood(val);
          }
        } else {
          this.selectedFoodId = null;
          this.updateSensorCardsWithRealData(true);
        }
        this.clearInfoBar();
      }
    };
    window.__sd_changeHandler = changeHandler;
    document.addEventListener('change', changeHandler);

    const clickHandler = (e) => {
      // console.log('Click event on:', e.target.id, e.target);
      if (e.target.id === 'dashboard-add-device') {
        console.log('Opening device modal...');
        e.preventDefault();
        e.stopPropagation();
        this.openDashboardDeviceModal();
      }
      if (e.target && e.target.id === 'dashboard-add-food') {
        console.log('Opening food modal...');
        e.preventDefault();
        e.stopPropagation();
        this.openDashboardFoodModal();
      }
      // If sidebar/tab navigates to dashboard, ensure cards are rendered
      const link = e.target.closest && e.target.closest('[data-page]');
      if (link && link.getAttribute('data-page') === 'dashboard') {
        setTimeout(() => {
          this.ensureDashboardCards();
          // Re-setup modal event listeners for SPA navigation
          this.setupModalEventListeners();
        }, 0);
      }
    };
    window.__sd_clickHandler = clickHandler;
    document.addEventListener('click', clickHandler);

    // Refresh dropdown when a new food is added elsewhere
    document.addEventListener('food-item-added', async () => {
      await this.fetchFoodItems();
      await this.populateFoodDropdown();
    });

    // Refresh dropdown when devices list changes
    document.addEventListener('devices-updated', async () => {
      await this.populateFoodDropdown();
    });

    // Setup modal event listeners
    this.setupModalEventListeners();

    const uploadMLTrainingDataBtn = document.getElementById('uploadMLTrainingDataBtn');
    if (uploadMLTrainingDataBtn) {
      uploadMLTrainingDataBtn.addEventListener('click', async () => {
        await this.handleMLTrainingDataUpload();
      });
    }

    const batchUploadBtn = document.getElementById('batchUploadBtn');
    if (batchUploadBtn) {
      batchUploadBtn.addEventListener('click', async () => {
        await this.handleBatchUpload();
      });
    }

    // ML History filters
    const mlHistoryFilter = document.getElementById('mlHistoryFilter');
    if (mlHistoryFilter) {
      mlHistoryFilter.addEventListener('change', (e) => {
        this.filterMLHistory(e.target.value);
      });
    }

    const mlStatusFilter = document.getElementById('mlStatusFilter');
    if (mlStatusFilter) {
      mlStatusFilter.addEventListener('change', (e) => {
        this.filterMLHistoryByStatus(e.target.value);
      });
    }

    const clearMLHistoryBtn = document.getElementById('clearMLHistoryBtn');
    if (clearMLHistoryBtn) {
      clearMLHistoryBtn.addEventListener('click', () => {
        this.clearMLHistory();
      });
    }
  }

  // Setup modal event listeners (called from setupEventListeners) (EVENTS: SMARTSENSE SCANNER)
  setupModalEventListeners() {
    // Open ML Scanner Modal event listener
    const openMLScannerBtn = document.getElementById('openMLScannerBtn');
    if (openMLScannerBtn) {
      // Remove existing listener to prevent duplicates
      openMLScannerBtn.removeEventListener('click', this.openMLScannerModal);
      openMLScannerBtn.addEventListener('click', () => {
        this.openMLScannerModal();
      });
    }


    // Ready Scan event listener for modal
    const readyScanBtn = document.getElementById('readyScanBtn');
    if (readyScanBtn) {
      console.log('🔍 Setting up Ready Scan event listener');
      // Remove existing listener to prevent duplicates
      readyScanBtn.removeEventListener('click', this.handleReadyScan);
      readyScanBtn.addEventListener('click', async () => {
        console.log('🔍 Ready Scan button clicked - calling handleReadyScan');
        await this.handleReadyScan();
      });
      console.log('🔍 Ready Scan event listener attached');
    } else {
      console.log('⚠️ Ready Scan button not found');
    }

    // Refresh food list button event listener
    const refreshFoodListBtn = document.getElementById('refreshFoodListBtn');
    if (refreshFoodListBtn) {
      // Remove existing listener to prevent duplicates
      const oldHandler = refreshFoodListBtn.onclick;
      if (oldHandler) refreshFoodListBtn.onclick = null;
      refreshFoodListBtn.addEventListener('click', async () => {
        console.log('Refreshing food list from API...');
        await this.populateMLFoodDropdown();
      });
    }
  }

  // Open ML Scanner Modal (ENTRY POINT: SMARTSENSE SCANNER)
  async openMLScannerModal() {
    const modal = document.getElementById('mlFoodScannerModal');
    if (!modal) return;
    
    // Create scan session when modal opens
    try {
      console.log('🔍 Creating scan session when modal opens...');
      const session = await this.createScanSession();
      console.log('✅ Scan session created successfully:', session);
    } catch (error) {
      console.error('❌ Failed to create scan session:', error);
      // Continue anyway - the blocking will just prevent Arduino data
    }
    
    const closeModal = async () => { 
      // Cancel any ongoing scan
      if (this.isScanningInProgress) {
        console.log('🔍 Cancelling ongoing scan...');
        this.scanCancelled = true;
        
        // Abort any ongoing operations
        if (this.scanAbortController) {
          this.scanAbortController.abort();
        }
        
        // Reset scanning flags
        this.isScanningInProgress = false;
        window.smartSenseScanningInProgress = false;
        window.smartSenseScannerActive = false;
        
        // Reset button state
        const scanBtn = document.getElementById('readyScanBtn');
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
        }
        
        // Remove cancel button
        this.removeCancelButton();
        
        // Hide waiting indicator
        this.hideSensorWaitIndicator();
        
        // Complete/cancel scan session
        try {
          if (this.currentScanSession) {
            await this.completeScanSession();
            console.log('✅ Scan session cancelled and completed');
          }
        } catch (error) {
          console.error('❌ Error cancelling scan session:', error);
          await this.forceBlockArduinoData();
        }
      } else {
        // If no scan in progress, just complete the session normally
        try {
          if (this.currentScanSession) {
            await this.completeScanSession();
          }
        } catch (error) {
          console.error('❌ Error completing scan session on modal close:', error);
        }
      }
      
      // Reset form
      const foodSelect = document.getElementById('mlFoodSelect');
      if (foodSelect) foodSelect.value = '';
      
      // Remove cancel button if exists
      this.removeCancelButton();
      
      // Reset wait indicator to default state (clear any cancellation message)
      this.hideSensorWaitIndicator();
      const waitIndicator = document.getElementById('sensorDataWaitIndicator');
      if (waitIndicator) {
        // Reset to default waiting state (not cancelled state)
        waitIndicator.innerHTML = `
          <div class="waiting-content">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <span class="waiting-text">Waiting for new sensor data...</span>
          </div>
          <div class="waiting-progress">
            <div class="progress">
              <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-label="Loading progress"></div>
            </div>
          </div>
        `;
        waitIndicator.style.display = 'none';
      }
      
      // Close modal
      modal.style.display = 'none';
      
      // Reset cancellation flag
      this.scanCancelled = false;
      this.scanAbortController = null;
      
      console.log('🔍 Modal closed - all state reset');
    };
    
    modal.style.display = 'flex';
    
    // Clear any previous cancellation message or wait indicator when modal opens
    this.hideSensorWaitIndicator();
    const waitIndicator = document.getElementById('sensorDataWaitIndicator');
    if (waitIndicator) {
      // Reset to default waiting state (not cancelled state)
      waitIndicator.innerHTML = `
        <div class="waiting-content">
          <div class="spinner-border spinner-border-sm text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="waiting-text">Waiting for new sensor data...</span>
        </div>
        <div class="waiting-progress">
          <div class="progress">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-label="Loading progress"></div>
          </div>
        </div>
      `;
      waitIndicator.style.display = 'none';
    }
    
    // Populate the food dropdown when modal opens with fresh API data
    await this.populateMLFoodDropdown();
    
    // Bind close buttons
    const closeBtn = modal.querySelector('.config-modal-close');
    const cancelBtn = modal.querySelector('.config-modal-cancel');
    const backdrop = modal.querySelector('.config-modal-backdrop');
    [closeBtn, cancelBtn, backdrop].forEach(btn => btn && (btn.onclick = closeModal));
    
    // Close on Escape
    const escHandler = (e) => { 
      if (e.key === 'Escape') { 
        closeModal(); 
        document.removeEventListener('keydown', escHandler); 
      } 
    };
    document.addEventListener('keydown', escHandler);
    
    // Populate food dropdown
    this.populateFoodDropdown();
    
    // Add focus event listener to auto-refresh food items
    const foodSelect = document.getElementById('mlFoodSelect');
    if (foodSelect) {
      foodSelect.addEventListener('focus', () => {
        if (foodSelect.options.length <= 1) {
          console.log('Refreshing food items on focus...');
          this.populateMLFoodDropdown();
        }
      });
    }
    
    // Re-setup Ready Scan button event listener when modal opens
    const readyScanBtn = document.getElementById('readyScanBtn');
    if (readyScanBtn) {
      console.log('🔍 Re-setting up Ready Scan event listener when modal opens');
      // Remove existing listener to prevent duplicates
      readyScanBtn.removeEventListener('click', this.handleReadyScan);
      readyScanBtn.addEventListener('click', async () => {
        console.log('🔍 Ready Scan button clicked - calling handleReadyScan');
        await this.handleReadyScan();
      });
      console.log('🔍 Ready Scan event listener re-attached in modal');
    } else {
      console.log('⚠️ Ready Scan button not found when modal opened');
    }
    
    // Re-setup refresh food list button event listener
    const refreshFoodListBtn = document.getElementById('refreshFoodListBtn');
    if (refreshFoodListBtn) {
      // Remove existing listener to prevent duplicates
      const oldHandler = refreshFoodListBtn.onclick;
      if (oldHandler) refreshFoodListBtn.onclick = null;
      refreshFoodListBtn.addEventListener('click', async () => {
        console.log('Refreshing food list from API...');
        await this.populateMLFoodDropdown();
      });
    }
    
    // Add global refresh function
    window.refreshMLScannerFoods = () => this.populateMLFoodDropdown();
    
    // Load ML history when modal opens to show recent scans
    await this.updateMLHistory();
  }

  // Global method to ensure modal works across SPA navigation
  ensureModalCompatibility() {
    // Re-setup modal event listeners when DOM changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if ML scanner button was added to DOM
          const openBtn = document.getElementById('openMLScannerBtn');
          if (openBtn && !openBtn.hasAttribute('data-listener-added')) {
            openBtn.setAttribute('data-listener-added', 'true');
            openBtn.addEventListener('click', () => {
              this.openMLScannerModal();
            });
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Wait for new sensor data by polling until data changes
  async waitForNewSensorData(baselineData, maxWaitMs = 30000, intervalMs = 2000) {
    const start = Date.now();
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    
    // Show waiting indicator
    this.showSensorWaitIndicator();
    
    // Add cancel button to the waiting indicator (like Smart Training Center)
    this.addCancelButtonToWaitIndicator();
    
    // Get baseline timestamp for comparison
    const baselineTimestamp = this.getLatestTimestamp(baselineData);
    console.log('Baseline timestamp:', baselineTimestamp);

    // Poll until data changes or timeout or cancelled
    while (Date.now() - start < maxWaitMs) {
      // Check if scan was cancelled
      if (this.scanCancelled) {
        console.log('🔍 Scan cancelled during wait for sensor data');
        this.hideSensorWaitIndicator();
        throw new Error('Scan cancelled by user');
      }
      try {
        const currentData = await this.getCurrentSensorData();
        
        // Check if API call was successful
        if (!currentData) {
          console.warn('No sensor data returned from API');
          consecutiveErrors++;
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error('Too many consecutive API failures, stopping wait');
            this.showSensorWaitError('Failed to fetch sensor data. Please check your connection and try again.');
            this.hideSensorWaitIndicator();
            throw new Error('Failed to fetch sensor data after multiple attempts');
          }
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          continue;
        }
        
        // Reset error counter on successful data fetch
        consecutiveErrors = 0;
        
        // Get current timestamp
        const currentTimestamp = this.getLatestTimestamp(currentData);
        console.log('Current timestamp:', currentTimestamp, 'Baseline:', baselineTimestamp);
        
        // Update progress bar
        const elapsed = Date.now() - start;
        const progress = Math.min((elapsed / maxWaitMs) * 100, 100);
        this.updateSensorWaitProgress(progress);
        
        // Check if we have newer data (timestamp-based detection)
        if (currentTimestamp && baselineTimestamp) {
          const currentTime = new Date(currentTimestamp).getTime();
          const baselineTime = new Date(baselineTimestamp).getTime();
          
          if (currentTime > baselineTime) {
            console.log('New sensor data detected by timestamp!');
            this.hideSensorWaitIndicator();
            return currentData;
          }
        }
        
        // Fallback: Check if any sensor has new data (value or timestamp change)
        const hasNewData = this.hasNewSensorData(baselineData, currentData);
        if (hasNewData) {
          console.log('New sensor data detected by value/timestamp comparison!');
          this.hideSensorWaitIndicator();
          return currentData;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error('Error polling sensor data:', error);
        consecutiveErrors++;
        
        // If too many consecutive errors, stop waiting
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error('Too many consecutive errors, stopping wait');
          this.showSensorWaitError('Connection error. Please check your network and try again.');
          this.hideSensorWaitIndicator();
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    console.warn('No new sensor data detected within timeout');
    this.hideSensorWaitIndicator();
    return null;
  }

  // Get the latest timestamp from sensor data
  getLatestTimestamp(sensorData) {
    if (!sensorData) return null;
    
    const sensors = ['temperature', 'humidity', 'gas'];
    let latestTimestamp = null;
    
    for (const sensor of sensors) {
      const data = sensorData[sensor];
      if (data && data.timestamp) {
        const timestamp = new Date(data.timestamp).getTime();
        if (!latestTimestamp || timestamp > latestTimestamp) {
          latestTimestamp = data.timestamp;
        }
      }
    }
    
    return latestTimestamp;
  }

  // Check if sensor data has new data (value or timestamp change)
  hasNewSensorData(baselineData, currentData) {
    if (!baselineData || !currentData) return false;

    const sensors = ['temperature', 'humidity', 'gas'];
    
    for (const sensor of sensors) {
      const baseline = baselineData[sensor];
      const current = currentData[sensor];
      
      if (baseline && current) {
        // Check if value has changed
        if (baseline.value !== current.value) {
          return true;
        }
        
        // Check if timestamp has advanced
        if (baseline.timestamp && current.timestamp) {
          const baselineTime = new Date(baseline.timestamp).getTime();
          const currentTime = new Date(current.timestamp).getTime();
          
          if (currentTime > baselineTime) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  // Check if sensor data has new timestamps
  hasNewTimestamps(baselineData, currentData) {
    if (!baselineData || !currentData) return false;

    const sensors = ['temperature', 'humidity', 'gas'];
    
    for (const sensor of sensors) {
      const baseline = baselineData[sensor];
      const current = currentData[sensor];
      
      if (baseline && current && baseline.timestamp && current.timestamp) {
        if (new Date(current.timestamp) > new Date(baseline.timestamp)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Show sensor waiting indicator
  showSensorWaitIndicator() {
    const indicator = document.getElementById('sensorDataWaitIndicator');
    if (indicator) {
      indicator.style.display = 'block';
      // Reset progress bar
      this.updateSensorWaitProgress(0);
    }
  }

  // Hide sensor waiting indicator
  // Add cancel button to the waiting indicator (like Smart Training Center)
  addCancelButtonToWaitIndicator() {
    const waitEl = document.getElementById('sensorDataWaitIndicator');
    if (waitEl && !document.getElementById('cancelSmartSenseScanBtn')) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancelSmartSenseScanBtn';
      cancelBtn.className = 'btn btn-outline-danger btn-sm mt-3';
      cancelBtn.style.cssText = 'background: #dc3545; color: #fff; border: 1px solid #c82333; padding: 8px 14px; border-radius: 999px; font-weight: 700; margin-left: auto; cursor: pointer;';
      cancelBtn.innerHTML = '<i class="bi bi-x-circle"></i> Cancel Scanning';
      cancelBtn.onclick = () => this.cancelSmartSenseScan();
      
      // Add to waiting content area
      const waitingContent = waitEl.querySelector('.waiting-content');
      if (waitingContent) {
        // Create a container for the cancel button
        const cancelContainer = document.createElement('div');
        cancelContainer.style.cssText = 'display: flex; justify-content: center; margin-top: 12px; width: 100%;';
        cancelContainer.appendChild(cancelBtn);
        waitEl.appendChild(cancelContainer);
      } else {
        waitEl.appendChild(cancelBtn);
      }
    }
  }

  // Remove cancel button
  removeCancelButton() {
    const cancelBtn = document.getElementById('cancelSmartSenseScanBtn');
    if (cancelBtn) {
      // Also remove container if it exists
      const cancelContainer = cancelBtn.parentElement;
      if (cancelContainer && cancelContainer.style.display === 'flex' && cancelContainer.tagName === 'DIV') {
        cancelContainer.remove();
      } else {
        cancelBtn.remove();
      }
    }
  }

  // Cancel SmartSense scan (like Smart Training Center)
  async cancelSmartSenseScan() {
    console.log('🔍 User cancelled SmartSense scanning');
    this.scanCancelled = true;
    
    // Abort any ongoing operations
    if (this.scanAbortController) {
      this.scanAbortController.abort();
    }
    
    // Remove cancel button
    this.removeCancelButton();
    
    // Reset scanning flags
    this.isScanningInProgress = false;
    window.smartSenseScanningInProgress = false;
    window.smartSenseScannerActive = false;
    
    // Reset button state
    const scanBtn = document.getElementById('readyScanBtn');
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
    }
    
    // Cancel/close scan session
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                          localStorage.getItem('sessionToken') || 
                          localStorage.getItem('session_token');
      
      if (this.currentScanSession && this.currentScanSession.session_id) {
        console.log('🔍 Cancelling scan session:', this.currentScanSession.session_id);
        
        const response = await fetch('/api/sensor/scan-session', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
          },
          body: JSON.stringify({ 
            user_id: 11, 
            session_id: this.currentScanSession.session_id 
          })
        });
        
        const result = await response.json();
        if (result.success) {
          console.log('✅ Scan session cancelled successfully');
        } else {
          console.warn('⚠️ Scan session cancellation response:', result);
        }
      }
    } catch (error) {
      console.error('❌ Error cancelling scan session:', error);
    } finally {
      // Always clear the session reference
      this.currentScanSession = null;
      console.log('🔍 Scan session cleared');
    }
    
    // Show cancelled message (like Smart Training Center)
    this.showSmartSenseCancelledMessage();
  }

  // Show cancelled message (like Smart Training Center)
  showSmartSenseCancelledMessage() {
    const waitIndicator = document.getElementById('sensorDataWaitIndicator');
    if (waitIndicator) {
      waitIndicator.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #e0e6f6;">
          <div style="margin-bottom: 12px;">
            <i class="bi bi-x-circle" style="font-size: 2em; color: #dc3545;"></i>
          </div>
          <h4 style="color: #fff; margin-bottom: 8px;">❌ Scanning Cancelled</h4>
          <p style="color: #bfc9da; margin-bottom: 16px;">You cancelled the scanning process</p>
          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px; color: #bfc9da;">
              <i class="bi bi-x-circle" style="color: #dc3545;"></i>
              <span>Scanning stopped by user</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: #bfc9da;">
              <i class="bi bi-info-circle" style="color: #4a9eff;"></i>
              <span>No data was processed or saved</span>
            </div>
          </div>
        </div>
      `;
      waitIndicator.style.display = 'block';
    }
  }

  // Reset cancelled state - clears cancellation message and resets to default
  resetCancelledState() {
    console.log('🔄 Resetting cancelled state...');
    
    // Hide wait indicator
    this.hideSensorWaitIndicator();
    
    // Reset wait indicator to default state
    const waitIndicator = document.getElementById('sensorDataWaitIndicator');
    if (waitIndicator) {
      waitIndicator.innerHTML = `
        <div class="waiting-content">
          <div class="spinner-border spinner-border-sm text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="waiting-text">Waiting for new sensor data...</span>
        </div>
        <div class="waiting-progress">
          <div class="progress">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-label="Loading progress"></div>
          </div>
        </div>
      `;
      waitIndicator.style.display = 'none';
    }
    
    // Reset button state
    const scanBtn = document.getElementById('readyScanBtn');
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
    }
    
    // Reset cancellation flag
    this.scanCancelled = false;
    
    console.log('✅ Cancelled state reset - ready for new scan');
  }

  hideSensorWaitIndicator() {
    const indicator = document.getElementById('sensorDataWaitIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  // Show error message to user
  showSensorWaitError(message) {
    const indicator = document.getElementById('sensorDataWaitIndicator');
    if (indicator) {
      const errorDiv = indicator.querySelector('.error-message') || document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.style.color = '#dc3545';
      errorDiv.style.marginTop = '10px';
      errorDiv.style.fontSize = '14px';
      errorDiv.textContent = message;
      
      if (!indicator.querySelector('.error-message')) {
        indicator.appendChild(errorDiv);
      }
    }
    
    // Also show a toast notification if available
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      console.error('Sensor wait error:', message);
    }
  }

  // Update sensor waiting progress bar
  updateSensorWaitProgress(progress) {
    const progressBar = document.querySelector('#sensorDataWaitIndicator .progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }

  // Show ML prediction results in custom modal (SmartSense-aligned)
  showMLPredictionResults(foodName, prediction) {
    const modal = document.getElementById('mlPredictionResultsModal');
    if (!modal) {
      console.error('ML Prediction Results Modal not found');
      return;
    }

    console.log('Showing ML prediction results:', { foodName, prediction });

    // Populate the modal with prediction data
    const foodElement = document.getElementById('mlResultFood');
    const statusElement = document.getElementById('mlResultStatus');
    const confidenceElement = document.getElementById('mlResultConfidence');
    const recommendationElement = document.getElementById('mlResultRecommendation');

    if (foodElement) foodElement.textContent = foodName;
    if (statusElement) {
      // Prefer SmartSense status if the page has an assessment function
      let statusText = prediction?.smartsense_status || prediction?.spoilage_status || '-';
      try {
        if (window.foodSelection && typeof window.foodSelection.assessFoodCondition === 'function') {
          const assessed = window.foodSelection.assessFoodCondition({
            temperature: { value: prediction.temperature ?? prediction.tempValue },
            humidity: { value: prediction.humidity ?? prediction.humidityValue },
            gas: { value: prediction.gas_level ?? prediction.gasValue }
          });
          if (assessed && assessed.condition) statusText = assessed.condition;
        }
      } catch(_) {}

      statusElement.textContent = statusText;
      // Add status-specific styling
      statusElement.className = 'ml-results-value';
      const status = String(statusText).toLowerCase();
      if (status.includes('fresh') || status.includes('safe')) {
        statusElement.classList.add('status-fresh');
      } else if (status.includes('unsafe') || status.includes('spoiled')) {
        statusElement.classList.add('status-unsafe');
      } else if (status.includes('risk')) {
        statusElement.classList.add('status-at-risk');
      }

      // Create scanner alert for caution/unsafe conditions using ML prediction data
      try {
        const isCaution = status.includes('caution') || status.includes('risk');
        const isUnsafe = status.includes('unsafe') || status.includes('spoiled');
        if (isCaution || isUnsafe) {
          const token = localStorage.getItem('jwt_token') || 
                        localStorage.getItem('sessionToken') || 
                        localStorage.getItem('session_token');
          if (token && prediction?.prediction_id) {
            // Fetch ML prediction data using prediction ID
            const fetchMLPredictionData = async () => {
              try {
                const response = await fetch(`/api/ml-prediction/${prediction.prediction_id}`, {
                  method: 'GET',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                  const mlData = await response.json();
                  console.log('📊 Fetched ML prediction data:', mlData);
                  
                  // Use actual ML prediction data for alert
                  const actualSpoilageStatus = mlData.data?.spoilage_status || prediction?.spoilage_status || status;
                  const actualSpoilageProbability = mlData.data?.spoilage_probability || prediction?.spoilage_probability || 75;
                  const actualConfidenceScore = mlData.data?.confidence_score || prediction?.confidence_score || 75;
                  
                  // Only create alert if ML prediction shows unsafe or caution
                  if (actualSpoilageStatus === 'unsafe' || actualSpoilageStatus === 'caution') {
                    const body = {
                      food_id: prediction?.food_id || null,
                      message: `ML Prediction: ${foodName} is ${actualSpoilageStatus.toUpperCase()} (${Math.round(actualSpoilageProbability)}% probability)`,
                      alert_level: actualSpoilageStatus === 'unsafe' ? 'High' : 'Medium',
                      alert_type: 'ml_prediction',
                      ml_prediction_id: prediction.prediction_id,
                      spoilage_probability: Math.max(0, Math.min(100, Math.round(actualSpoilageProbability))),
                      recommended_action: actualSpoilageStatus === 'unsafe' ? 'Discard immediately and sanitize storage area.' : 'Consume soon or improve storage conditions.',
                      is_ml_generated: true,
                      confidence_score: Math.max(0, Math.min(100, Math.round(actualConfidenceScore))),
                      alert_data: JSON.stringify({
                        source: 'ml_prediction',
                        condition: actualSpoilageStatus,
                        sensor_readings: {
                          temperature: prediction.temperature ?? prediction.tempValue ?? null,
                          humidity: prediction.humidity ?? prediction.humidityValue ?? null,
                          gas_level: prediction.gas_level ?? prediction.gasValue ?? null
                        },
                        spoilage_score: actualSpoilageProbability,
                        confidence_score: actualConfidenceScore,
                        ml_model: mlData.data?.model || prediction?.model || 'default',
                        prediction_id: prediction.prediction_id,
                        timestamp: new Date().toISOString()
                      })
                    };
                    
                    const alertResponse = await fetch('/api/alerts', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify(body)
                    });
                    
                    if (!alertResponse.ok) {
                      console.warn('ML prediction alert insert failed with status:', alertResponse.status);
                    } else {
                      console.log('✅ ML prediction alert created successfully for', actualSpoilageStatus);
                    }
                  } else {
                    console.log('✅ No alert needed - ML prediction shows safe status:', actualSpoilageStatus);
                  }
                } else {
                  console.warn('Failed to fetch ML prediction data, using fallback');
                  // Fallback to original logic if ML prediction fetch fails
                  this.createFallbackAlert(foodName, prediction, token, isUnsafe);
                }
              } catch (error) {
                console.warn('Error fetching ML prediction data:', error);
                // Fallback to original logic
                this.createFallbackAlert(foodName, prediction, token, isUnsafe);
              }
            };
            
            fetchMLPredictionData();
          } else {
            console.warn('Skipping ML prediction alert: no auth token or prediction ID');
          }
        }
      } catch (error) {
        console.warn('Error in ML prediction alert creation:', error);
      }
    }
    
    if (confidenceElement) confidenceElement.textContent = `${prediction.confidence_score || prediction.confidence || '-'}%`;
    if (recommendationElement) {
      // Handle recommendations - could be string, array, or object
      let recommendationText = '';
      
      console.log('🔍 Processing recommendations for display:', {
        recommendation: prediction.recommendation,
        recommendations: prediction.recommendations,
        type: typeof prediction.recommendations
      });
      
      // Priority 1: Direct recommendation string
      if (prediction.recommendation && typeof prediction.recommendation === 'string') {
        recommendationText = prediction.recommendation;
      }
      // Priority 2: Recommendations object with main property
      else if (prediction.recommendations) {
        if (typeof prediction.recommendations === 'string') {
          // Try to parse if it's a JSON string
          try {
            const parsed = JSON.parse(prediction.recommendations);
            if (parsed.main) {
              recommendationText = parsed.main;
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              recommendationText = parsed[0];
            } else if (typeof parsed === 'string') {
              recommendationText = parsed;
            }
          } catch (e) {
            // If parsing fails, use as-is
            recommendationText = prediction.recommendations;
          }
        } else if (typeof prediction.recommendations === 'object') {
          // Handle object format
          if (prediction.recommendations.main) {
            recommendationText = prediction.recommendations.main;
          } else if (prediction.recommendations.recommendation) {
            recommendationText = prediction.recommendations.recommendation;
          } else if (Array.isArray(prediction.recommendations) && prediction.recommendations.length > 0) {
            // If it's an array, use the first item
            recommendationText = prediction.recommendations[0];
          } else if (prediction.recommendations.details && Array.isArray(prediction.recommendations.details)) {
            // If it has a details array, use the first detail
            recommendationText = prediction.recommendations.details[0] || '';
          }
        } else if (Array.isArray(prediction.recommendations) && prediction.recommendations.length > 0) {
          // Handle array format - use first recommendation
          recommendationText = prediction.recommendations[0];
        }
      }
      
      // If still no recommendation, try to get from AI support data
      if (!recommendationText && prediction.ai_support) {
        if (prediction.ai_support.recommendations && Array.isArray(prediction.ai_support.recommendations)) {
          recommendationText = prediction.ai_support.recommendations[0] || '';
        } else if (prediction.ai_support.summary) {
          recommendationText = prediction.ai_support.summary;
        }
      }
      
      // Final fallback
      if (!recommendationText || recommendationText.trim() === '') {
        recommendationText = 'No recommendations available';
      }
      
      console.log('✅ Final recommendation text:', recommendationText);
      recommendationElement.textContent = recommendationText;
    }

    // Show the modal
    modal.style.display = 'flex';

    // Set up close functionality
    const closeModal = () => {
      modal.style.display = 'none';
    };

    // Bind close buttons
    const closeBtn = modal.querySelector('.config-modal-close');
    const okBtn = document.getElementById('mlResultsOkBtn');
    const backdrop = modal.querySelector('.config-modal-backdrop');

    [closeBtn, okBtn, backdrop].forEach(btn => {
      if (btn) {
        btn.onclick = closeModal;
      }
    });

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  // Handle Ready Scan button (CORE FUNCTION: SMARTSENSE SCANNER)
  async handleReadyScan() {
    const scanId = Math.random().toString(36).slice(2, 8);
    console.log(`🔍 [${scanId}] handleReadyScan called by instance [${this.instanceId}]`);
    console.log(`🔍 [${scanId}] Current isScanningInProgress:`, this.isScanningInProgress);
    
    // Get button reference early to update state immediately
    const scanBtn = document.getElementById('readyScanBtn');
    
    // Prevent multiple simultaneous scans - use a more robust check
    if (this.isScanningInProgress) {
      console.log(`⚠️ [${scanId}] Scan already in progress, ignoring duplicate call`);
      return;
    }
    
    // Reset cancellation flag and all state for a fresh scan
    this.scanCancelled = false;
    this.scanAbortController = new AbortController();
    
    // Clear any cancellation message from previous scan attempt
    this.hideSensorWaitIndicator();
    const waitIndicator = document.getElementById('sensorDataWaitIndicator');
    if (waitIndicator) {
      // Reset to default waiting state (not cancelled state)
      waitIndicator.innerHTML = `
        <div class="waiting-content">
          <div class="spinner-border spinner-border-sm text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="waiting-text">Waiting for new sensor data...</span>
        </div>
        <div class="waiting-progress">
          <div class="progress">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-label="Loading progress"></div>
          </div>
        </div>
      `;
      waitIndicator.style.display = 'none';
    }
    
    // Double-check to prevent race conditions (check BEFORE clearing)
    if (window.smartSenseScanningInProgress) {
      console.log(`⚠️ [${scanId}] Global scan flag already set, ignoring duplicate call`);
      this.isScanningInProgress = false;
      // Reset button state if scan was blocked
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
      }
      return;
    }
    
    // Set flag immediately to prevent race conditions
    this.isScanningInProgress = true;
    console.log(`🔍 [${scanId}] Set isScanningInProgress to true`);
    
    // Set global flags
    window.smartSenseScanningInProgress = true;
    console.log(`🔍 [${scanId}] Set global scan flag to true`);
    
    // Set global flag to prevent Smart Training system from running
    window.smartSenseScannerActive = true;
    console.log('🔍 SmartSense Scanner active - blocking Smart Training system');
    console.log('🔍 Global flag set to:', window.smartSenseScannerActive);
    
    // Update button state immediately to show scanning has started
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Scanning...';
      console.log('🔍 Button state updated to "Scanning..."');
    } else {
      console.error('⚠️ readyScanBtn not found in DOM');
    }
    
    const foodSelect = document.getElementById('mlFoodSelect');
    
    if (!foodSelect) {
      if (typeof showErrorToast === 'function') showErrorToast('Food selection controls not found');
      this.isScanningInProgress = false;
      window.smartSenseScanningInProgress = false;
      window.smartSenseScannerActive = false;
      // Reset button state
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
      }
      return;
    }

    const foodId = foodSelect.value;

    if (!foodId) {
      if (typeof showWarningToast === 'function') showWarningToast('Please select a food to scan');
      this.isScanningInProgress = false;
      window.smartSenseScanningInProgress = false;
      window.smartSenseScannerActive = false;
      // Reset button state
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
      }
      return;
    }
    
    console.log('🔍 Starting scan for food ID:', foodId);

    // Update button to show waiting for sensor data
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<div class="circle-loading"></div> Waiting for new sensor data...';
      console.log('🔍 Button state updated to "Waiting for new sensor data..."');
    }

    try {
      // Get baseline sensor data first
      const baselineData = await this.getCurrentSensorData();
      if (!baselineData) {
        if (typeof showErrorToast === 'function') showErrorToast('No sensor data available');
        // Reset button state
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
        }
        // Reset flags
        this.isScanningInProgress = false;
        window.smartSenseScanningInProgress = false;
        window.smartSenseScannerActive = false;
        return;
      }

      // Get food name from dropdown
      const selectedOption = foodSelect.options[foodSelect.selectedIndex];
      const foodName = selectedOption.textContent.split(' (')[0];
      const foodCategory = selectedOption.textContent.match(/\(([^)]+)\)/)?.[1] || 'Unknown';

      // Add cancel button when scanning starts
      this.addCancelButtonToWaitIndicator();
      
      // Wait for new sensor data
      const newSensorData = await this.waitForNewSensorData(baselineData);
      
      // Remove cancel button after waiting completes
      this.removeCancelButton();
      
      // Check if scan was cancelled during wait
      if (this.scanCancelled) {
        console.log('🔍 Scan cancelled during sensor data wait');
        // Reset button state
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
        }
        // Reset all flags when cancelled
        this.isScanningInProgress = false;
        window.smartSenseScanningInProgress = false;
        window.smartSenseScannerActive = false;
        this.scanCancelled = false; // Reset cancellation flag for next scan
        return;
      }
      
      if (!newSensorData) {
        if (typeof showWarningToast === 'function') showWarningToast('No new sensor data detected');
        // Reset button state
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
        }
        // Reset flags
        this.isScanningInProgress = false;
        window.smartSenseScanningInProgress = false;
        window.smartSenseScannerActive = false;
        return;
      }

      // Update button to show AI analysis
      if (scanBtn) {
        scanBtn.innerHTML = '<i class="bi bi-robot"></i> Analyzing with AI...';
      }

      // Ensure sensor data is in the correct format
      const formattedSensorData = {
        temperature: { value: newSensorData.temperature?.value || newSensorData.temperature },
        humidity: { value: newSensorData.humidity?.value || newSensorData.humidity },
        gas: { value: newSensorData.gas?.value || newSensorData.gas }
      };
      
      console.log('🔍 Formatted sensor data for AI analysis:', formattedSensorData);
      
      // Step 1: Get AI analysis with environmental factors (like Smart Training Center)
      console.log('🔍 Step 1: Getting AI analysis with environmental factors...');
      const aiAnalysisResult = await this.getValidatedAIAnalysis(foodName, formattedSensorData);
      
      if (!aiAnalysisResult.success) {
        console.warn('⚠️ AI analysis failed, using fallback:', aiAnalysisResult.error);
        // Continue with fallback analysis
      }
      
      // Step 2: Assess food condition using environmental factors
      console.log('🔍 Step 2: Assessing food condition with environmental factors...');
      const assessed = this.assessFoodCondition(formattedSensorData) || {};
      
      // Map AI risk level to spoilage status
      const aiCondition = aiAnalysisResult.success ? 
        this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe';
      const tableCondition = assessed.condition || aiCondition;
      
      // Use AI condition as primary source (like Smart Training Center)
      const finalCondition = aiAnalysisResult.success ? aiCondition : tableCondition;
      
      console.log('🔍 Environmental analysis results:', {
        aiAnalysis: aiAnalysisResult.success ? aiAnalysisResult.analysis : 'Failed',
        aiCondition,
        tableCondition,
        finalCondition
      });
      
      // Update button to show ML processing
      if (scanBtn) {
        scanBtn.innerHTML = '<i class="bi bi-cpu"></i> Processing with ML...';
      }
      
      // Step 3: Perform ML workflow (like Smart Training Center) - uses environmental factors and ML data
      console.log('🔍 Step 3: Performing ML workflow with environmental factors...');
      const mlWorkflowResult = await this.performMLWorkflow(
        foodId,
        foodName,
        foodCategory,
        formattedSensorData,
        finalCondition,
        aiAnalysisResult
      );
      
      console.log('🔍 ML workflow result:', mlWorkflowResult);
      
      if (!mlWorkflowResult.success) {
        throw new Error(mlWorkflowResult.error || 'ML workflow failed');
      }
      
      // Format prediction result to match expected structure
      // Extract recommendations from ML workflow result
      let recommendationText = '';
      let recommendationsObj = null;
      
      // Try to get recommendations from various possible formats
      if (mlWorkflowResult.recommendations) {
        if (typeof mlWorkflowResult.recommendations === 'string') {
          try {
            recommendationsObj = JSON.parse(mlWorkflowResult.recommendations);
          } catch (e) {
            recommendationText = mlWorkflowResult.recommendations;
          }
        } else if (typeof mlWorkflowResult.recommendations === 'object') {
          recommendationsObj = mlWorkflowResult.recommendations;
        }
      }
      
      // Extract main recommendation text
      if (recommendationsObj) {
        if (recommendationsObj.main) {
          recommendationText = recommendationsObj.main;
        } else if (Array.isArray(recommendationsObj) && recommendationsObj.length > 0) {
          recommendationText = recommendationsObj[0];
        } else if (recommendationsObj.recommendation) {
          recommendationText = recommendationsObj.recommendation;
        }
      }
      
      // Try AI support recommendations if available
      if (!recommendationText && mlWorkflowResult.ai_support) {
        if (mlWorkflowResult.ai_support.recommendations && Array.isArray(mlWorkflowResult.ai_support.recommendations)) {
          recommendationText = mlWorkflowResult.ai_support.recommendations[0] || '';
        } else if (mlWorkflowResult.ai_support.summary) {
          recommendationText = mlWorkflowResult.ai_support.summary;
        }
      }
      
      // Fallback to recommendation field
      if (!recommendationText && mlWorkflowResult.recommendation) {
        recommendationText = mlWorkflowResult.recommendation;
      }
      
      console.log('🔍 Extracted recommendations:', {
        recommendationText,
        recommendationsObj,
        ai_support: mlWorkflowResult.ai_support
      });
      
      const prediction = {
        success: true,
        prediction: {
          prediction_id: mlWorkflowResult.prediction_id,
          food_id: foodId,
          food_name: foodName,
          food_category: foodCategory,
          spoilage_status: mlWorkflowResult.spoilage_status,
          spoilage_probability: mlWorkflowResult.spoilage_probability,
          confidence_score: mlWorkflowResult.confidence_score,
          recommendation: recommendationText || 'No recommendations available',
          recommendations: recommendationsObj || { main: recommendationText || 'No recommendations available' },
          ai_support: mlWorkflowResult.ai_support || null,
          gas_emission_support: mlWorkflowResult.gas_emission_support || null
        }
      };
      
      console.log('🔍 Formatted prediction result:', prediction);
      
      if (prediction.success) {
        // Show ML prediction results in custom modal
        this.showMLPredictionResults(foodName, prediction.prediction);
        foodSelect.value = '';
        
        // Update ML history to show the new scan
        await this.updateMLHistory();
        
        // Refresh latest scan result display on dashboard
        if (window.latestScanManager && typeof window.latestScanManager.refreshLatestScan === 'function') {
          console.log('🔄 Refreshing latest scan result display...');
          setTimeout(() => {
            window.latestScanManager.refreshLatestScan();
          }, 500); // Small delay to ensure API has processed the new scan
        }
        
        // Complete scan session when scanning is finished - this will block Arduino data
        try {
          console.log('🔍 Completing scan session to block Arduino data...');
          console.log('🔍 Current session before completion:', this.currentScanSession);
          await this.completeScanSession();
          console.log('✅ Scan session completed successfully - Arduino data is now blocked');
        } catch (error) {
          console.error('❌ Failed to complete scan session after successful prediction:', error);
          // Even if completion fails, we should still try to block Arduino data
          console.log('⚠️ Attempting to force block Arduino data...');
          await this.forceBlockArduinoData();
        }
        
        // Close scanner modal after successful prediction
        const modal = document.getElementById('mlFoodScannerModal');
        if (modal) modal.style.display = 'none';
      } else {
        if (typeof showErrorToast === 'function') showErrorToast('Prediction failed');
        // Complete scan session even on prediction failure
        try {
          console.log('🔍 Completing scan session after prediction failure...');
          console.log('🔍 Current session before completion:', this.currentScanSession);
          await this.completeScanSession();
          console.log('✅ Scan session completed after prediction failure - Arduino data is now blocked');
        } catch (error) {
          console.error('❌ Failed to complete scan session after prediction failure:', error);
          await this.forceBlockArduinoData();
        }
      }
    } catch (error) {
      // Check if error is due to cancellation
      if (this.scanCancelled || error.message === 'Scan cancelled by user') {
        console.log('🔍 Scan was cancelled by user');
        // Don't show error toast for user cancellation
        // Reset flags are handled in closeModal
        return;
      }
      
      console.error('ML prediction error:', error);
      if (typeof showErrorToast === 'function') showErrorToast('Prediction error');
      // Complete scan session even on error
      try {
        console.log('🔍 Completing scan session after error...');
        console.log('🔍 Current session before completion:', this.currentScanSession);
        await this.completeScanSession();
        console.log('✅ Scan session completed after error - Arduino data is now blocked');
      } catch (sessionError) {
        console.error('❌ Failed to complete scan session after error:', sessionError);
        await this.forceBlockArduinoData();
      }
    } finally {
      // Always reset flags regardless of cancellation status
      // This ensures the system is ready for the next scan
      this.isScanningInProgress = false;
      
      // Clear global scan flag
      window.smartSenseScanningInProgress = false;
      console.log('🔍 Global scan flag cleared');
      
      // Clear global flag to allow Smart Training system to run again
      window.smartSenseScannerActive = false;
      console.log('🔍 SmartSense Scanner finished - allowing Smart Training system');
      
      // Reset cancellation flag for next scan attempt
      this.scanCancelled = false;
      
      // Reset button state
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="bi bi-scan"></i> Start Scanning';
      }
      
      // Remove cancel button if still exists
      this.removeCancelButton();
      
      // Reset abort controller
      this.scanAbortController = null;
    }
  }

  // Handle ML training data upload from ML tab
  async handleMLTrainingDataUpload() {
    const foodSelect = document.getElementById('mlUploadFoodSelect');
    const statusSelect = document.getElementById('mlUploadStatus');
    const notesTextarea = document.getElementById('mlUploadNotes');
    
    if (!foodSelect || !statusSelect) {
      if (typeof showErrorToast === 'function') showErrorToast('ML upload controls not found');
      return;
    }

    const foodId = foodSelect.value;
    const status = statusSelect.value;
    const notes = notesTextarea ? notesTextarea.value.trim() : '';

    if (!foodId) {
      if (typeof showWarningToast === 'function') showWarningToast('Please select a food type');
      return;
    }

    if (!status) {
      if (typeof showWarningToast === 'function') showWarningToast('Please select a food status');
      return;
    }

    const uploadBtn = document.getElementById('uploadMLTrainingDataBtn');
    if (uploadBtn) {
      uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<div class="circle-loading"></div> Teaching AI...';
    }

    try {
      const result = await this.uploadMLTrainingData(foodId, status, notes);
      
      if (result.success) {
        if (typeof showSuccessToast === 'function') showSuccessToast('Shared with AI');
        // Clear form
        foodSelect.value = '';
        statusSelect.value = '';
        if (notesTextarea) notesTextarea.value = '';
        // Refresh ML history
        await this.updateMLHistory();
      } else {
        if (typeof showErrorToast === 'function') showErrorToast('Upload failed');
      }
    } catch (error) {
      console.error('ML training upload error:', error);
      if (typeof showErrorToast === 'function') showErrorToast('Upload error');
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-lightbulb"></i> Teach the AI';
      }
    }
  }

  // Handle batch upload
  async handleBatchUpload() {
    if (typeof showInfoToast === 'function') showInfoToast('Share Multiple coming soon');
  }

  // Filter ML history by date
  filterMLHistory(filter) {
    // Implementation for filtering ML history by date
    console.log('Filtering ML history by:', filter);
  }

  // Filter ML history by status
  filterMLHistoryByStatus(status) {
    // Implementation for filtering ML history by status
    console.log('Filtering ML history by status:', status);
  }

  // Clear ML history
  clearMLHistory() {
    const confirmed = confirm('Clear all your teaching history? This cannot be undone.');
    if (!confirmed) return;

    // Clear local history display
    const historyList = document.getElementById('mlHistoryList');
    if (historyList) {
      historyList.innerHTML = `
        <div class="no-history">
          <i class="bi bi-lightbulb"></i>
          <p>No teaching data shared yet</p>
          <span>Start by teaching our AI above</span>
        </div>
      `;
    }
  }

  openDashboardDeviceModal() {
    // Device connection is now handled by admin - show info modal instead
    window.modalSystem.info(
      'All devices are automatically connected when registered by the admin. Your sensors will appear in the status list once they start sending data.',
      'Device Information'
    );
  }

  openDashboardFoodModal() {
    const modal = document.getElementById('dashboardAddFoodModal');
    if (!modal) return;
    const closeModal = () => { modal.style.display = 'none'; };
    modal.style.display = 'flex';
    // Match existing modal visual style
    const content = modal.querySelector('.config-modal-content');
    if (content) {
      content.style.maxWidth = '520px';
      content.style.border = '1px solid #2b3a66';
    }

    const nameEl = document.getElementById('dashboardFoodName');
    const catEl = document.getElementById('dashboardFoodCategory');
    const form = document.getElementById('dashboardAddFoodForm');
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || '';

    // Reset form values and focus for better UX
    if (nameEl) nameEl.value = '';
    if (catEl) catEl.value = '';
    setTimeout(() => { if (nameEl) nameEl.focus(); }, 0);

    // Populate categories
    fetch('/api/users/food-types', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(r => r.json())
      .then(j => {
        const types = (j && j.success && Array.isArray(j.types)) ? j.types : [];
        if (catEl) catEl.innerHTML = '<option value="">Uncategorized</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
      })
      .catch(() => { if (catEl) catEl.innerHTML = '<option value="">Uncategorized</option>'; });

    // Bind close buttons
    const xBtn = modal.querySelector('.config-modal-close');
    const cancelBtn = modal.querySelector('.config-modal-cancel');
    const backdrop = modal.querySelector('.config-modal-backdrop');
    [xBtn, cancelBtn, backdrop].forEach(btn => btn && (btn.onclick = closeModal));

    // Close on Escape
    const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = (nameEl && nameEl.value || '').trim();
      const category = (catEl && catEl.value) || '';
      if (!name) {
        if (typeof showWarningToast === 'function') showWarningToast('Please enter a food name');
        return;
      }

      // Validate if it's a real food name using AI
      try {
        const validationResponse = await fetch('/api/ai/validate-food-name', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ food_name: name })
        });

        if (validationResponse.ok) {
          const validationResult = await validationResponse.json();
          if (validationResult.success && validationResult.is_food === false) {
            const errorMsg = `"${name}" is not a valid food name. Please enter an actual food item (e.g., Banana, Chicken, Salmon).`;
            if (typeof showWarningToast === 'function') {
              showWarningToast(errorMsg);
            } else {
              alert(errorMsg);
            }
            if (nameEl) {
              nameEl.focus();
              nameEl.style.borderColor = '#dc3545';
              setTimeout(() => {
                nameEl.style.borderColor = '';
              }, 3000);
            }
            return;
          }
        }
      } catch (validationError) {
        console.warn('Food name validation failed, proceeding anyway:', validationError);
        // Continue with submission if validation fails
      }

      const submitBtn = form.querySelector('.config-modal-submit');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Adding...'; }
      try {
        const r = await fetch('/api/users/food-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ name, category })
        });
        const j = await r.json();
        if (j && j.success) {
          closeModal();
          await this.fetchFoodItems();
          this.populateFoodDropdown();
          // Preselect newly added item by name/category match
          const select = document.getElementById('device-select');
          if (select) {
            const added = foodItems.find(f => f.name === name && (f.category || '') === (category || ''));
            if (added) {
              select.value = added.food_id || added.id;
              this.selectedFoodId = select.value;
              await this.updateSensorCardsForFood(this.selectedFoodId);
            }
          }
        } else {
          if (typeof showErrorToast === 'function') showErrorToast('Failed to add food');
        }
      } catch (_) {
        if (typeof showErrorToast === 'function') showErrorToast('Failed to add food');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Add'; }
      }
    };
  }

  renderRegisteredDevices() {
    const container = document.querySelector('.sensor-cards-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Only render sensors that exist in the database
    if (registeredDevices.length === 0) {
      // Try cached devices if not already loaded
      this.loadCachedDevices();
      if (registeredDevices.length === 0) {
        const noDataCard = document.createElement('div');
        noDataCard.className = 'sensor-card offline';
        noDataCard.innerHTML = `
          <div class="sensor-card-title">No Sensors</div>
          <div class="sensor-gauge">
            <div class="gauge" data-label="none" data-value="0" data-unit=""></div>
          </div>
          <div class="sensor-info">
            <div class="sensor-label">No sensors found in database</div>
            <div class="sensor-value">Connect sensors to see data</div>
          </div>
        `;
        container.appendChild(noDataCard);
        this.renderSensorStatusList();
        return;
      }
    }
    
    // Render only sensors from database
    registeredDevices.forEach(device => {
      const sensorType = device.type ? device.type.toLowerCase() : 'unknown';
      const sensorConfig = this.getSensorConfig(sensorType);
      
      const card = document.createElement('div');
      card.className = 'sensor-card';
      card.setAttribute('data-sensor-type', sensorType);
      card.innerHTML = `
        <div class="sensor-card-title">${sensorConfig.title}</div>
        <div class="sensor-gauge">
          <div class="gauge" data-label="${sensorType}" data-value="0" data-unit="${sensorConfig.unit}"></div>
        </div>
      `;
      container.appendChild(card);
    });
    
    this.setupSensorCardClicks();
    this.clearInfoBar();
    
    // Show real-time data by default (no food selected)
    this.updateSensorCardsWithRealData();
    
    // Update summary values
    this.updateSensorsSummary();
    
    // Do not render status list here to avoid showing disconnected during initial paint
  }

  loadCachedDevices() {
    try {
      const raw = localStorage.getItem('registered_devices');
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length) {
        registeredDevices = cached;
      }
    } catch (_) {}
  }
  
  // Get sensor configuration based on type
  getSensorConfig(sensorType) {
    const configs = {
      temperature: { title: 'Temperature', max: 50, unit: '°C' },
      humidity: { title: 'Humidity', max: 100, unit: '%' },
      gas: { title: 'Gas Level', max: 1000, unit: 'ppm' }
    };
    return configs[sensorType] || { title: 'Unknown', max: 100, unit: '' };
  }

  // Helper: drive gauge fill from the numeric text on the card
  updateGaugeFromCard(card, sensorType) {
    const valueDiv = card.querySelector('.sensor-value');
    const gauge = card.querySelector('.gauge');
    if (!gauge || !window.setGaugeValue) return;
    const text = (valueDiv && valueDiv.textContent) ? valueDiv.textContent : '0';
    // Extract leading number from text like "0.07ppm" or "35.2°C"
    const match = text.toString().match(/-?\d+(?:\.\d+)?/);
    const value = match ? parseFloat(match[0]).toFixed(2) : '0.00';
    const unitMatch = text.toString().match(/[a-zA-Z°%]+$/);
    const unit = unitMatch ? unitMatch[0] : '';
    const r = gaugeRanges[sensorType] || {};
    window.setGaugeValue(gauge, value, unit, r.min, r.max);
  }

  updateSensorCardsWithRealData(skipStatus = false) {
    // If a food is selected, preserve food-specific gauges
    if (this.selectedFoodId) return;
    
    // Only update sensors that exist in the database
    registeredDevices.forEach(device => {
      const sensorType = device.type ? device.type.toLowerCase() : 'unknown';
      const card = document.querySelector(`.sensor-card[data-sensor-type="${sensorType}"]`);
      
      if (card) {
        const sensorData = realTimeSensorData[sensorType];
        const gauge = card.querySelector('.gauge');
        const sensorConfig = this.getSensorConfig(sensorType);
        
        if (sensorData && sensorData.status === 'online') {
          const value = parseFloat(sensorData.value || 0).toFixed(2);
          if (gauge && window.setGaugeValue) {
            window.setGaugeValue(gauge, value, sensorConfig.unit);
          }
          card.classList.remove('offline');
        } else {
          // Keep last known value to avoid 0 flash when API temporarily empty
          if (gauge && window.setGaugeValue) {
            const prev = (gauge.getAttribute('data-value') || '0.00');
            const unit = gauge.getAttribute('data-unit') || sensorConfig.unit;
            window.setGaugeValue(gauge, prev, unit);
          }
          // Do not toggle offline unless explicitly told by API repeatedly
          // card.classList.add('offline');
        }
      }
    });
    
    // Optionally skip SENSOR STATUS rerender during realtime updates
    if (!skipStatus) {
      this.renderSensorStatusList();
    }
  }

  // Ensure sensor cards exist in the DOM after SPA swaps
  ensureDashboardCards() {
    const container = document.querySelector('.sensor-cards-container');
    if (!container) return;
    const hasCards = container.children && container.children.length > 0;
    if (!hasCards) {
      this.renderRegisteredDevices();
      this.updateSensorCardsWithRealData(true);
    }
  }

  setupSensorCardClicks() {
    const container = document.querySelector('.sensor-cards-container');
    if (!container) return;
    container.onclick = null;
    container.ondblclick = null;
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.sensor-card');
      if (!card) return;
      const deviceId = card.getAttribute('data-device-id');
      const sensorType = card.getAttribute('data-sensor-type');
      if (deviceId && sensorType) {
        this.showDeviceInfoBar(deviceId, sensorType);
        container.querySelectorAll('.sensor-card').forEach(c => {
          c.classList.remove('sensor-card-highlight-online', 'sensor-card-highlight-offline');
        });
        card.classList.add('sensor-card-highlight-online');
      }
    });
    container.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.sensor-card');
      if (!card) return;
      container.querySelectorAll('.sensor-card').forEach(c => {
        c.classList.remove('sensor-card-highlight-online', 'sensor-card-highlight-offline');
      });
      this.clearInfoBar();
    });
  }

  showDeviceInfoBar(deviceId, sensorType) {
    // Device info bar removed from UI
    return;
  }

  clearInfoBar() {
    // Device info bar removed from UI
    return;
  }

  async   updateSensorCardsForFood(foodId) {
    const cards = document.querySelectorAll('.sensor-card');
    if (!foodId) {
      // No food selected: show real-time data
      this.updateSensorCardsWithRealData();
      return;
    }

    try {
      // Get selected food name for backend SQL by name
      const selectEl = document.getElementById('device-select');
      const selectedText = selectEl && selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex].text : '';
      const foodName = selectedText ? selectedText.split(' (')[0] : '';

      // Get session token from localStorage (check multiple locations for compatibility)
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      if (!sessionToken) {
        console.error('No session token found - redirecting to login');
        window.location.href = '/pages/Login.html';
        return;
      }
      
      // Prefer the gauges endpoint to get values + min/max for proper fill
      let result;
      try {
        const params = new URLSearchParams();
        params.append('food_id', foodId);
        const responseG = await fetch(`/api/sensor/gauges?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (responseG.ok) {
          result = await responseG.json();
        } else {
          throw new Error(`Gauge fetch failed ${responseG.status}`);
        }
      } catch (e) {
        console.warn('Falling back to /sensor/data for food due to gauge fetch error:', e.message);
        const resp = await fetch(`/api/sensor/data?food_id=${foodId}`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        result = await resp.json();
      }
      
      // Update using gauge_data if present
      if (result && result.gauge_data) {
        const gd = result.gauge_data;
        console.log('Gauge data for selected food:', gd);
        
        const types = ['temperature','humidity','gas'];
        types.forEach(type => {
          const g = gd[type];
          const card = document.querySelector(`.sensor-card[data-sensor-type="${type}"]`);
          if (!card) return;
          const valueDiv = card.querySelector('.sensor-value');

          if (g && g.value != null) {
            // Update ranges
            let min = g.min != null ? parseFloat(g.min) : (gaugeRanges[type] ? gaugeRanges[type].min : undefined);
            let max = g.max != null ? parseFloat(g.max) : (gaugeRanges[type] ? gaugeRanges[type].max : undefined);
            const value = parseFloat(g.value);

            // Frontend fallback for any sensor type when range is missing/flat
            const defaults = {
              temperature: { min: -10, max: 50 },
              humidity: { min: 0, max: 100 },
              gas: { min: 0, max: 1000 }
            };
            if (min == null || max == null || isNaN(min) || isNaN(max) || min === max) {
              const d = defaults[type] || { min: 0, max: 100 };
              min = d.min;
              max = d.max;
            }
            // If value is tiny relative to span, ensure visible arc by widening range around value
            const span = Math.abs(max - min);
            if (!isNaN(value) && span > 0 && (value - min) / span < 0.01) {
              min = Math.min(min, 0);
              max = Math.max(max, value * 2 || max);
            }

            if (!isNaN(min) && !isNaN(max)) gaugeRanges[type] = { min, max };

            console.log(`Apply gauge ${type}: value=${value}, unit=${g.unit}, min=${min}, max=${max}`);
            if (valueDiv) valueDiv.textContent = `${value}${g.unit || ''}`;
            // Drive gauge from text
            this.updateGaugeFromCard(card, type);
          } else {
            // No data for this type
            console.log(`Clear gauge ${type}`);
            if (valueDiv) valueDiv.textContent = '0';
            // Force clear range 0..0 so no arc renders
            const gauge = card.querySelector('.gauge');
            gaugeRanges[type] = { min: 0, max: 0 };
            if (gauge && window.setGaugeValue) window.setGaugeValue(gauge, 0, '', 0, 0);
          }
        });
        return;
      }

      // Fallback: update using sensor_data (no ranges update)
      if (result.success && result.sensor_data) {
        registeredDevices.forEach(device => {
          const card = document.querySelector(`.sensor-card[data-device-id="${device.id}"][data-sensor-type="${device.sensorType}"]`);
          if (card) {
            const sensorType = device.sensorType;
            const sensorData = result.sensor_data.find(data => 
              data.sensor_type.toLowerCase() === sensorType
            );
            
            const valueDiv = card.querySelector('.sensor-value');
            const r = gaugeRanges[sensorType] || {};
            if (sensorData && sensorData.value !== null) {
              if (valueDiv) valueDiv.textContent = `${sensorData.value}${sensorData.unit}`;
              const gauge = card.querySelector('.gauge');
              if (gauge && window.setGaugeValue) {
                window.setGaugeValue(gauge, sensorData.value, sensorData.unit, r.min, r.max);
              }
              card.classList.add('sensor-card-highlight-online');
            } else {
              if (valueDiv) valueDiv.textContent = 'N/A';
              const gauge = card.querySelector('.gauge');
              if (gauge && window.setGaugeValue) {
                window.setGaugeValue(gauge, 0, '', r.min, r.max);
              }
              card.classList.add('sensor-card-highlight-offline');
            }
          }
        });
      } else {
        // Fallback to real-time data if no food-specific data
        this.updateSensorCardsWithRealData();
      }
    } catch (error) {
      console.error('Error fetching food sensor data:', error);
      // Fallback to real-time data on error
      this.updateSensorCardsWithRealData();
    }
    
    // Update sensor status list
    this.renderSensorStatusList();
    
    // Update summary values
    this.updateSensorsSummary();
  }

  showAddDeviceModal() {
    // Use adminSensorTypes for allowed sensor types
    const sensorType = prompt('Enter sensor type (' + adminSensorTypes.join(', ') + '):');
    if (!sensorType || !adminSensorTypes.includes(sensorType)) {
      if (typeof showErrorToast === 'function') showErrorToast('Invalid sensor type');
      return;
    }
    const name = prompt('Enter device name:');
    if (!name) return;
    const id = prompt('Enter device ID:');
    if (!id) return;
    registeredDevices.push({ name, sensorType, id });
    this.renderRegisteredDevices();
  }

  getSensorIcon(sensorType) {
    const icons = {
      temperature: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 1 5 0v11.26a4.5 4.5 0 1 1-5 0z"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>',
      humidity: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 2v20"/><path d="m2 12 10-10 10 10"/></svg>',
      gas: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
    };
    return icons[sensorType] || '';
  }

  getDeviceIcon(type) {
    const icons = {
      'temperature': 'thermometer',
      'humidity': 'droplet',
      'gas': 'wind'
    };
    return icons[type] || 'cpu';
  }

  getBatteryLevel(device) {
    // Get battery level from device data or generate a realistic value
    if (device.battery_level !== undefined) {
      return Math.round(device.battery_level);
    }
    
    // Generate a realistic battery level based on device age and status
    const typeKey = (device.type || device.sensorType || '').toLowerCase();
    const rt = realTimeSensorData[typeKey] || {};
    const recentEnough = rt.timestamp ? (Date.now() - new Date(rt.timestamp).getTime()) <= 120000 : (rt.status === 'online');
    const isConnected = rt.status === 'online' && recentEnough;
    if (!isConnected) return 0;
    
    // Simulate battery level based on device age
    const createdDate = new Date(device.created_at || device.lastSeen || new Date());
    const daysSinceCreated = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
    
    // Battery decreases over time, but stays between 20-100% for connected devices
    const baseLevel = Math.max(20, 100 - (daysSinceCreated * 2));
    const randomVariation = Math.floor(Math.random() * 20) - 10; // ±10% variation
    return Math.max(0, Math.min(100, baseLevel + randomVariation));
  }

  getBatteryIcon(batteryLevel) {
    if (batteryLevel === 0) return 'bi-battery';
    if (batteryLevel <= 20) return 'bi-battery';
    if (batteryLevel <= 40) return 'bi-battery-half';
    if (batteryLevel <= 60) return 'bi-battery-half';
    if (batteryLevel <= 80) return 'bi-battery-full';
    return 'bi-battery-charging';
  }

  getBatteryStatusClass(batteryLevel) {
    if (batteryLevel === 0) return 'battery-critical';
    if (batteryLevel <= 20) return 'battery-low';
    if (batteryLevel <= 50) return 'battery-medium';
    return 'battery-good';
  }

  getDeviceTypeName(type) {
    const typeNames = {
      'temperature': 'Temperature Sensor',
      'humidity': 'Humidity Sensor',
      'gas': 'Gas Sensor'
    };
    return typeNames[type] || 'Unknown Sensor';
  }

  toggleDeviceStatus(deviceId) {
    const device = registeredDevices.find(d => d.sensor_id === deviceId || d.id === deviceId);
    if (device) {
      // Toggle real-time connection state using online/offline values
      device.status = device.status === 'online' ? 'offline' : 'online';
      device.lastSeen = new Date().toISOString();
      this.renderSensorStatusList();
    }
  }

  renderSensorStatusList() {
    const deviceList = document.getElementById('deviceSensorList');
    if (!deviceList) return;

    if (registeredDevices.length === 0) {
      deviceList.innerHTML = `
        <div class="no-devices">
          <i class="bi bi-battery"></i>
          <p>No devices connected</p>
          <span>Connect a device to get started</span>
        </div>
      `;
    return;
    }

    const devicesHTML = registeredDevices.map(device => {
      // Determine connection from latest real-time data for this sensor type
      const typeKey = (device.type || device.sensorType || '').toLowerCase();
      const rt = realTimeSensorData[typeKey] || {};
      const recentEnough = rt.timestamp ? (Date.now() - new Date(rt.timestamp).getTime()) <= 120000 : (rt.status === 'online');
      const isConnected = rt.status === 'online' && recentEnough;
      
      return `
        <div class="device-sensor-item">
          <div class="device-sensor-info">
            <div class="device-sensor-icon ${isConnected ? '' : 'disconnected'}">
              <i class="bi bi-${this.getDeviceIcon(device.type)}"></i>
            </div>
            <div class="device-sensor-details">
              <h4>${device.sensor_id || device.id}</h4>
              <p>${this.getDeviceTypeName(device.type || device.device_type || device.type_name)}</p>
            </div>
          </div>
          <div class="device-sensor-meta">
            <div class="device-sensor-status ${isConnected ? 'connected' : 'disconnected'}">
              <span>${isConnected ? 'Online' : 'Offline'}</span>
            </div>
            <button class="device-status-btn ${isConnected ? 'connected' : 'disconnected'}" 
                    onclick="window.sensorDashboard.toggleDeviceStatus('${device.sensor_id || device.id}')">
              ${isConnected ? 'Connected' : 'Disconnected'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    deviceList.innerHTML = devicesHTML;
  }

  updateSensorsSummary() {
    // Update summary values in the sensors footer
    const totalSensorsEl = document.getElementById('totalSensors');
    const activeSensorsEl = document.getElementById('activeSensors');
    const lastUpdateEl = document.getElementById('lastUpdate');

    if (totalSensorsEl) {
      totalSensorsEl.textContent = registeredDevices.length;
    }

    if (activeSensorsEl) {
      const activeCount = Object.values(realTimeSensorData).filter(data => 
        data.status === 'online' || (data.value != null && data.value !== '')
      ).length;
      activeSensorsEl.textContent = activeCount;
    }

    if (lastUpdateEl) {
      const now = new Date();
      lastUpdateEl.textContent = now.toLocaleTimeString();
    }
  }

  // Fallback alert creation method
  createFallbackAlert(foodName, prediction, token, isUnsafe) {
    // Only create alert if status is unsafe or caution
    if (!isUnsafe && prediction?.spoilage_status !== 'caution' && prediction?.spoilage_status !== 'unsafe') {
      console.log('✅ No fallback alert needed - status is safe');
      return;
    }
    
    const spoilageScore = prediction?.spoilage_probability || prediction?.riskScore || prediction?.confidence_score || 75;
    const spoilageStatus = prediction?.spoilage_status || (isUnsafe ? 'unsafe' : 'caution');
    
    const body = {
      food_id: prediction?.food_id || null,
      message: `ML Prediction: ${foodName} is ${spoilageStatus.toUpperCase()} (${Math.round(spoilageScore)}% probability)`,
      alert_level: spoilageStatus === 'unsafe' ? 'High' : 'Medium',
      alert_type: 'ml_prediction',
      ml_prediction_id: prediction?.prediction_id || null,
      spoilage_probability: Math.max(0, Math.min(100, Math.round(spoilageScore))),
      recommended_action: spoilageStatus === 'unsafe' ? 'Discard immediately and sanitize storage area.' : 'Consume soon or improve storage conditions.',
      is_ml_generated: true,
      confidence_score: Math.max(0, Math.min(100, Math.round(spoilageScore))),
      alert_data: JSON.stringify({
        source: 'ml_prediction',
        condition: spoilageStatus,
        sensor_readings: {
          temperature: prediction.temperature ?? prediction.tempValue ?? null,
          humidity: prediction.humidity ?? prediction.humidityValue ?? null,
          gas_level: prediction.gas_level ?? prediction.gasValue ?? null
        },
        spoilage_score: spoilageScore,
        confidence_score: prediction?.confidence_score || prediction?.confidence || spoilageScore,
        ml_model: prediction?.model || 'default',
        timestamp: new Date().toISOString()
      })
    };
    
    fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => {
      if (!r.ok) console.warn('Fallback alert insert failed with status:', r.status);
      return null;
    }).catch(err => console.warn('Fallback alert insert error:', err.message));
  }

  // ===== Methods for SmartSense Scanner (matching Smart Training Center logic) =====
  
  // Get validated AI analysis with environmental factors
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

  // Analyze gas emission thresholds
  analyzeGasEmissionThresholds(gasLevel) {
    if (gasLevel >= 400) {
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 98,
        confidence: 95,
        recommendation: 'CRITICAL: Severe Spoilage Detected (400+ ppm). Do not consume. Dispose immediately to avoid foodborne illness. Sanitize storage area thoroughly.',
        threshold: '400+ ppm'
      };
    } else if (gasLevel >= 200) {
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 90,
        confidence: 90,
        recommendation: 'CRITICAL: Advanced Spoilage Detected (200-399 ppm). Do not consume. Dispose immediately. Check for strong odors, discoloration, or slimy texture.',
        threshold: '200-399 ppm'
      };
    } else if (gasLevel >= 100) {
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 85,
        confidence: 85,
        recommendation: 'CRITICAL: Spoilage Detected (100-199 ppm). Do not consume. Dispose immediately. Inspect for signs of spoilage.',
        threshold: '100-199 ppm'
      };
    } else if (gasLevel >= 70) {
      return {
        riskLevel: 'high',
        status: 'unsafe',
        probability: 80,
        confidence: 80,
        recommendation: 'CRITICAL: Spoilage Detected (70-99 ppm). Do not consume. Dispose immediately. Based on sensor observations, this level indicates spoilage.',
        threshold: '70-99 ppm'
      };
    } else if (gasLevel >= 50) {
      return {
        riskLevel: 'medium',
        status: 'caution',
        probability: 60,
        confidence: 75,
        recommendation: 'CAUTION: Early Warning Signs (50-69 ppm). Monitor closely. Inspect food before consuming. Consider consuming soon or improving storage conditions.',
        threshold: '50-69 ppm'
      };
    } else {
      return {
        riskLevel: 'low',
        status: 'safe',
        probability: 20,
        confidence: 90,
        recommendation: 'SAFE: Fresh/Safe (0-49 ppm). Food appears safe to consume. Continue monitoring and maintain proper storage conditions.',
        threshold: '0-49 ppm'
      };
    }
  }

  // Analyze environmental conditions
  analyzeEnvironmentalConditions(temperature, humidity) {
    const baselineTemp = 22;
    const baselineHumidity = 50;
    
    const tempDeviation = temperature - baselineTemp;
    const humidityDeviation = humidity - baselineHumidity;
    
    let tempRisk = 'normal';
    let humidityRisk = 'normal';
    let overallRisk = 'normal';
    
    if (temperature > 35) {
      tempRisk = 'high';
    } else if (temperature > 30) {
      tempRisk = 'medium';
    } else if (temperature < 10) {
      tempRisk = 'low';
    }
    
    if (humidity > 85) {
      humidityRisk = 'high';
    } else if (humidity > 75) {
      humidityRisk = 'medium';
    } else if (humidity < 25) {
      humidityRisk = 'low';
    }
    
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

  // Get environmental recommendation
  getEnvironmentalRecommendation(tempRisk, humidityRisk) {
    if (tempRisk === 'high' && humidityRisk === 'high') {
      return 'CRITICAL: Both temperature and humidity are too high. This creates ideal conditions for bacterial growth. Move food to cooler, drier storage immediately.';
    } else if (tempRisk === 'high') {
      return 'WARNING: Temperature is too high. Move food to cooler storage (below 4°C for perishables) to prevent spoilage.';
    } else if (humidityRisk === 'high') {
      return 'WARNING: Humidity is too high. This promotes mold growth and bacterial activity. Improve ventilation or use dehumidifier.';
    } else if (tempRisk === 'medium' || humidityRisk === 'medium') {
      return 'CAUTION: Storage conditions are suboptimal. Monitor closely and consider improving storage conditions.';
    }
    return 'Storage conditions are within acceptable ranges.';
  }

  // Assess food condition using environmental factors
  assessFoodCondition(sensorData) {
    const temperature = sensorData.temperature?.value;
    const humidity = sensorData.humidity?.value;
    const gasLevel = sensorData.gas?.value;

    if (temperature === undefined || humidity === undefined || gasLevel === undefined) {
      console.warn('Missing sensor data for condition assessment, defaulting to safe');
      return { condition: 'safe', spoilageScore: 20 };
    }

    const gasAnalysis = this.analyzeGasEmissionThresholds(gasLevel);
    const envAnalysis = this.analyzeEnvironmentalConditions(temperature, humidity);
    
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
    
    if (gasAnalysis.riskLevel === 'high' || (gasAnalysis.riskLevel === 'medium' && gasAnalysis.status === 'caution')) {
      let finalSpoilageScore = gasAnalysis.probability;
      let finalCondition = gasAnalysis.status;
      
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

    let spoilageScore = gasAnalysis.probability;
    let condition = gasAnalysis.status;
    
    if (envAnalysis.overallRisk === 'high') {
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

  // Perform complete ML workflow (like Smart Training Center)
  async performMLWorkflow(foodId, foodName, foodCategory, sensorData, spoilageStatus, aiAnalysisResult) {
    try {
      if (this.scanCancelled) {
        console.log('ML workflow cancelled - scanning was stopped by user');
        return { success: false, error: 'Scanning cancelled by user' };
      }

      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        throw new Error('Authentication required');
      }

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
      console.log('Storing training data...');
      const trainingResponse = await fetch('/api/ml-workflow/training-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
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

      const trainingResult = await trainingResponse.json();
      if (!trainingResult.success) {
        throw new Error('Failed to store training data: ' + trainingResult.error);
      }
      
      // Step 2: Generate ML prediction
      console.log('Generating ML prediction...');
      const predictionResponse = await fetch('/api/ml-workflow/predict', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_id: foodId,
          food_name: foodName,
          food_category: foodCategory,
          temperature: temp,
          humidity: humidity,
          gas_level: gas,
          expiration_date: null,
          spoilage_probability: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.riskScore || 75) : 75,
          spoilage_status: aiAnalysisResult.success ? 
            this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe',
          confidence_score: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.riskScore || 75) : 75,
          recommendations: aiAnalysisResult.success ? 
            (aiAnalysisResult.analysis.recommendations || []) : [],
          ai_original_status: aiAnalysisResult.success ? 
            this.mapRiskLevelToSpoilageStatus(aiAnalysisResult.analysis.riskLevel) : 'safe',
          display_override_status: spoilageStatus
        })
      });

      const predictionResult = await predictionResponse.json();
      if (!predictionResult.success) {
        throw new Error('Failed to generate ML prediction: ' + predictionResult.error);
      }

      // Step 3: Update food item with sensor data
      console.log('Updating food item with sensor data...');
      const updateResponse = await fetch('/api/ml-workflow/update-food-item', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
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
      if (!updateResult.success) {
        console.error('Failed to update food item with sensor data:', updateResult.error);
      }

      return {
        success: true,
        training_id: trainingResult.training_id,
        prediction_id: predictionResult.prediction_id,
        spoilage_status: predictionResult.spoilage_status,
        spoilage_probability: predictionResult.spoilage_probability,
        confidence_score: predictionResult.confidence_score,
        recommendations: predictionResult.recommendations || { main: 'No recommendations available' },
        recommendation: predictionResult.recommendations?.main || 'No recommendations available'
      };
    } catch (error) {
      console.error('Error in ML workflow:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard-template')) {
    window.sensorDashboard = new SensorDashboard();
  }
});

// Export for use in other scripts
window.SensorDashboard = SensorDashboard;

// Global event listener for SPA navigation compatibility
document.addEventListener('click', (e) => {
  // Handle ML Scanner button clicks even if event listeners weren't properly attached
  if (e.target && e.target.id === 'openMLScannerBtn') {
    e.preventDefault();
    e.stopPropagation();
    if (window.sensorDashboard) {
      window.sensorDashboard.openMLScannerModal();
    }
  }
});

// Real-time scanning functionality for Arduino integration
class RealTimeScanner {
  constructor() {
    this.isScanning = false;
    this.scanningInterval = null;
    this.scanningStartTime = null;
  }

  // Start real-time scanning mode (called when Arduino scanning begins)
  startScanning() {
    if (this.isScanning) {
      console.log('Real-time scanning already active');
      return;
    }

    console.log('Starting real-time scanning mode...');
    this.isScanning = true;
    this.scanningStartTime = Date.now();
    
    // Poll every 500ms during scanning for smooth gauge movement
    this.scanningInterval = setInterval(() => {
      this.fetchAndUpdateRealTimeData();
    }, 500);

    // Auto-stop after 6 seconds (slightly longer than Arduino's 5-second scan)
    setTimeout(() => {
      this.stopScanning();
    }, 6000);
  }

  // Stop real-time scanning mode
  stopScanning() {
    if (!this.isScanning) {
      return;
    }

    console.log('Stopping real-time scanning mode...');
    this.isScanning = false;
    
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval);
      this.scanningInterval = null;
    }

    // Remove scanning visual effects
    this.removeScanningEffects();

    // Final update to ensure we have the latest data
    this.fetchAndUpdateRealTimeData();
  }

  // Remove scanning visual effects
  removeScanningEffects() {
    const gauges = document.querySelectorAll('.gauge');
    gauges.forEach(gauge => {
      gauge.classList.remove('animating', 'realtime-active');
      gauge.style.transform = '';
      gauge.style.filter = '';
      
      // Reset SVG paths
      const paths = gauge.querySelectorAll('svg path');
      paths.forEach(path => {
        path.classList.remove('active', 'bouncing', 'filling');
        path.style.strokeWidth = '';
        path.style.opacity = '';
        path.style.filter = '';
        path.style.transform = '';
        path.style.stroke = '';
        path.style.strokeDasharray = '';
      });
      
      // Reset gauge elements
      const valueElement = gauge.querySelector('.gauge-value');
      if (valueElement) {
        valueElement.classList.remove('updating');
        valueElement.style.color = '';
        valueElement.style.textShadow = '';
        valueElement.style.transform = '';
      }
      
      const labelElement = gauge.querySelector('.gauge-label');
      if (labelElement) {
        labelElement.classList.remove('updating');
        labelElement.style.color = '';
        labelElement.style.transform = '';
      }
    });
  }

  // Fetch and update real-time data with smooth gauge animations
  async fetchAndUpdateRealTimeData() {
    try {
      const token = localStorage.getItem('jwt_token') || 
                    localStorage.getItem('sessionToken') || 
                    localStorage.getItem('session_token');

      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Fetch latest sensor data
      const response = await fetch('/api/sensor/gauges', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error('Failed to fetch sensor data:', response.status);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.gauge_data) {
        this.updateGaugesWithAnimation(data.gauge_data);
      }
    } catch (error) {
      console.error('Error fetching real-time data:', error);
    }
  }

  // Update gauges with smooth animation
  updateGaugesWithAnimation(gaugeData) {
    // Update each sensor gauge with smooth animation
    Object.keys(gaugeData).forEach(sensorType => {
      const sensorData = gaugeData[sensorType];
      const card = document.querySelector(`.sensor-card[data-sensor-type="${sensorType}"]`);
      
      if (card && sensorData && sensorData.value !== null) {
        const gauge = card.querySelector('.gauge');
        
        if (gauge && window.setGaugeValue) {
          // Get current value for smooth transition
          const currentValue = parseFloat(gauge.getAttribute('data-value') || '0');
          const newValue = parseFloat(sensorData.value);
          
          // Add real-time active class to gauge
          gauge.classList.add('realtime-active');
          
          // Animate the gauge value change
          this.animateGaugeValue(gauge, currentValue, newValue, sensorData.unit);
          
          // Update card status
          if (sensorData.status === 'online') {
            card.classList.remove('offline');
            card.classList.add('online');
          } else {
            card.classList.remove('online');
            card.classList.add('offline');
          }
        }
      }
    });
  }

  // Animate gauge value change for smooth movement with enhanced effects
  animateGaugeValue(gauge, fromValue, toValue, unit) {
    const duration = 800; // Longer duration for smoother animation
    const startTime = Date.now();
    
    // Add visual feedback during animation
    gauge.classList.add('animating');
    gauge.style.transition = 'all 0.3s ease';
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use multiple easing functions for more natural movement
      let easeProgress;
      if (progress < 0.5) {
        // Ease-in for first half
        easeProgress = 2 * progress * progress;
      } else {
        // Ease-out for second half
        easeProgress = 1 - 2 * (1 - progress) * (1 - progress);
      }
      
      const currentValue = fromValue + (toValue - fromValue) * easeProgress;
      
      // Update gauge with enhanced visual effects
      this.updateGaugeWithEffects(gauge, currentValue, unit, progress);
      
      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - remove visual effects
        gauge.classList.remove('animating');
        setTimeout(() => {
          gauge.style.transition = '';
          // Remove real-time active class after animation
          gauge.classList.remove('realtime-active');
        }, 300);
      }
    };
    
    animate();
  }

  // Enhanced gauge update with filling animation
  updateGaugeWithEffects(gauge, value, unit, progress) {
    // Update the gauge value
    window.setGaugeValue(gauge, value.toFixed(2), unit);
    
    // Get the gauge arc element (the progress arc)
    const gaugeArc = gauge.querySelector('svg path[stroke-dasharray]');
    if (gaugeArc) {
      // Add filling class for CSS animation
      gaugeArc.classList.add('filling');
      // Animate the arc filling from 0 to current value
      this.animateGaugeArcFilling(gaugeArc, value, progress);
    }
    
    // Background arc remains static (no glow effects)
    
    // Number animation - smooth counting up effect
    const valueElement = gauge.querySelector('.gauge-value');
    if (valueElement) {
      this.animateGaugeValueCounting(valueElement, value, progress);
    }
    
    // Gauge label subtle animation
    const labelElement = gauge.querySelector('.gauge-label');
    if (labelElement) {
      const labelOpacity = 0.7 + progress * 0.3;
      labelElement.style.opacity = labelOpacity;
      labelElement.style.color = `hsl(${200 + progress * 60}, 70%, 70%)`;
    }
  }

  // Animate gauge arc filling from empty to full
  animateGaugeArcFilling(gaugeArc, targetValue, progress) {
    // Get gauge range from the gauge element
    const gauge = gaugeArc.closest('.gauge');
    const min = parseFloat(gauge.getAttribute('data-min')) || 0;
    const max = parseFloat(gauge.getAttribute('data-max')) || 100;
    
    // Calculate the target percentage
    const targetPercentage = Math.min((targetValue - min) / (max - min), 1);
    
    // Animate from 0 to target percentage
    const currentPercentage = targetPercentage * progress;
    
    // Get the arc's circumference
    const radius = 45; // Assuming radius of 45
    const circumference = 2 * Math.PI * radius;
    
    // Calculate stroke-dasharray for the filling effect
    const strokeDasharray = `${circumference * currentPercentage} ${circumference}`;
    
    // Apply the filling animation
    gaugeArc.style.strokeDasharray = strokeDasharray;
    
    // Add color transition during filling
    const hue = 120 + (currentPercentage * 240); // Green to purple as it fills
    gaugeArc.style.stroke = `hsl(${hue}, 70%, 60%)`;
    
    // No glow effects - clean animation
    
    // Add stroke width animation for emphasis
    const strokeWidth = 4 + Math.sin(progress * Math.PI * 2) * 1;
    gaugeArc.style.strokeWidth = strokeWidth;
  }

  // Animate gauge value counting up
  animateGaugeValueCounting(valueElement, targetValue, progress) {
    // Get current displayed value
    const currentDisplayValue = parseFloat(valueElement.textContent) || 0;
    const targetValueNum = parseFloat(targetValue);
    
    // Calculate intermediate value for smooth counting
    const intermediateValue = currentDisplayValue + (targetValueNum - currentDisplayValue) * progress;
    
    // Update the display with smooth counting
    valueElement.textContent = intermediateValue.toFixed(2);
    
    // Color transition from green to purple
    const hue = 120 + (progress * 240);
    valueElement.style.color = `hsl(${hue}, 80%, 60%)`;
    
    // Scale effect during counting
    const scale = 1 + Math.sin(progress * Math.PI * 3) * 0.05;
    valueElement.style.transform = `scale(${scale})`;
  }
}

// Initialize real-time scanner
const realTimeScanner = new RealTimeScanner();

// Global functions for external control
window.startRealTimeScanning = function() {
  realTimeScanner.startScanning();
};

window.stopRealTimeScanning = function() {
  realTimeScanner.stopScanning();
};

// Auto-detect Arduino scanning by monitoring for rapid data changes
let lastSensorValues = { temperature: 0, humidity: 0, gas: 0 };
let rapidChangeDetected = false;
let rapidChangeTimeout = null;

// Enhanced gauge update function that detects rapid changes
const originalSetGaugeValue = window.setGaugeValue;
window.setGaugeValue = function(gauge, value, unit) {
  // Call original function
  originalSetGaugeValue(gauge, value, unit);
  
  // Detect rapid changes that indicate Arduino scanning
  const sensorType = gauge.closest('.sensor-card')?.getAttribute('data-sensor-type');
  if (sensorType && sensorType in lastSensorValues) {
    const currentValue = parseFloat(value);
    const lastValue = lastSensorValues[sensorType];
    const change = Math.abs(currentValue - lastValue);
    
    // If change is significant (> 5% of range), consider it rapid
    const ranges = { temperature: 60, humidity: 100, gas: 1000 };
    const threshold = ranges[sensorType] * 0.05;
    
    if (change > threshold) {
      rapidChangeDetected = true;
      
      // Clear existing timeout
      if (rapidChangeTimeout) {
        clearTimeout(rapidChangeTimeout);
      }
      
      // Set timeout to detect end of scanning
      rapidChangeTimeout = setTimeout(() => {
        if (rapidChangeDetected) {
          console.log('Rapid changes detected - Arduino scanning detected');
          realTimeScanner.startScanning();
          rapidChangeDetected = false;
        }
      }, 1000); // Wait 1 second to confirm scanning
    }
    
    lastSensorValues[sensorType] = currentValue;
  }
};

