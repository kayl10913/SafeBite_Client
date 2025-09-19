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

class SensorDashboard {
  constructor() {
    this.selectedFoodId = null;
    this.realtimeTimer = null;
    this.lastDataFingerprint = null;
    this._fetchingLatest = false;
    this._latestAbort = null;
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
      const latestResponse = await fetch('/api/sensor/latest', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
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
        window.location.href = '/login';
        return;
      }
      
      const response = await fetch('/api/sensor/latest-user', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        signal: this._latestAbort.signal
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication required - user not logged in');
          window.location.href = '/login';
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
      
      const response = await fetch('/api/sensor/latest', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
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
                status: gaugeData.status || 'offline'
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
          } else {
            // Add default food options if no food items from database
            const defaultFoods = [
              { id: 'apple', name: 'Apple', category: 'Fruits' },
              { id: 'banana', name: 'Banana', category: 'Fruits' },
              { id: 'chicken', name: 'Chicken', category: 'Meat' },
              { id: 'milk', name: 'Milk', category: 'Dairy' },
              { id: 'bread', name: 'Bread', category: 'Grains' }
            ];
            
            defaultFoods.forEach(food => {
              const option = `<option value="${food.id}">${food.name} (${food.category})</option>`;
              if (mlSelect) mlSelect.innerHTML += option;
              if (mlUploadSelect) mlUploadSelect.innerHTML += option;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading existing foods for ML:', error);
      // Fallback to default options
      if (mlSelect) mlSelect.innerHTML = '<option value="">Select from available foods</option>';
      if (mlUploadSelect) mlUploadSelect.innerHTML = '<option value="">Select from available foods</option>';
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

      const response = await fetch('/api/sensor/latest-user', {
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
    document.addEventListener('change', async (e) => {
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
    });
    document.addEventListener('click', (e) => {
      console.log('Click event on:', e.target.id, e.target);
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
    });

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

  // Setup modal event listeners (called from setupEventListeners)
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
      // Remove existing listener to prevent duplicates
      readyScanBtn.removeEventListener('click', this.handleReadyScan);
      readyScanBtn.addEventListener('click', async () => {
        await this.handleReadyScan();
      });
    }

    // Refresh food list button event listener
    const refreshFoodListBtn = document.getElementById('refreshFoodListBtn');
    if (refreshFoodListBtn) {
      // Remove existing listener to prevent duplicates
      refreshFoodListBtn.removeEventListener('click', this.refreshFoodList);
      refreshFoodListBtn.addEventListener('click', async () => {
        console.log('Refreshing food list...');
        await this.populateFoodDropdown();
      });
    }
  }

  // Open ML Scanner Modal
  openMLScannerModal() {
    const modal = document.getElementById('mlFoodScannerModal');
    if (!modal) return;
    
    const closeModal = () => { 
      modal.style.display = 'none';
      // Reset form
      const foodSelect = document.getElementById('mlFoodSelect');
      if (foodSelect) foodSelect.value = '';
      // Hide waiting indicator
      this.hideSensorWaitIndicator();
    };
    
    modal.style.display = 'flex';
    
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
          this.populateFoodDropdown();
        }
      });
    }
    
    // Add global refresh function
    window.refreshMLScannerFoods = () => this.populateFoodDropdown();
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
    
    // Helper to create a fingerprint of sensor data
    const createSensorFingerprint = (data) => {
      if (!data) return '';
      try {
        const t = data.temperature ? `${data.temperature.value}-${data.temperature.timestamp || ''}` : 'null';
        const h = data.humidity ? `${data.humidity.value}-${data.humidity.timestamp || ''}` : 'null';
        const g = data.gas ? `${data.gas.value}-${data.gas.timestamp || ''}` : 'null';
        return [t, h, g].join('|');
      } catch (error) {
        console.error('Error creating sensor fingerprint:', error);
        return '';
      }
    };

    const baselineFingerprint = createSensorFingerprint(baselineData);
    console.log('Baseline sensor fingerprint:', baselineFingerprint);

    // Poll until data changes or timeout
    while (Date.now() - start < maxWaitMs) {
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
        
        const currentFingerprint = createSensorFingerprint(currentData);
        console.log('Current sensor fingerprint:', currentFingerprint);
        
        // Update progress bar
        const elapsed = Date.now() - start;
        const progress = Math.min((elapsed / maxWaitMs) * 100, 100);
        this.updateSensorWaitProgress(progress);
        
        // Check if data has changed
        if (currentFingerprint !== baselineFingerprint) {
          console.log('New sensor data detected!');
          this.hideSensorWaitIndicator();
          return currentData;
        }

        // Also check if timestamps have advanced (indicating new readings)
        const hasNewTimestamps = this.hasNewTimestamps(baselineData, currentData);
        if (hasNewTimestamps) {
          console.log('New sensor timestamps detected!');
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
    if (!modal) return;

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
    }
    if (confidenceElement) confidenceElement.textContent = `${prediction.confidence_score || prediction.confidence || '-'}%`;
    if (recommendationElement) recommendationElement.textContent = prediction.recommendation || '';

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

  // Handle Ready Scan button
  async handleReadyScan() {
    const foodSelect = document.getElementById('mlFoodSelect');
    
    if (!foodSelect) {
      alert('Food selection controls not found');
      return;
    }

    const foodId = foodSelect.value;

    if (!foodId) {
      alert('Please select a food to scan');
      return;
    }

    const scanBtn = document.getElementById('readyScanBtn');
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Waiting for new sensor data...';
    }

    try {
      // Get baseline sensor data first
      const baselineData = await this.getCurrentSensorData();
      if (!baselineData) {
        alert('No sensor data available. Please ensure sensors are connected.');
        return;
      }

      // Get food name from dropdown
      const selectedOption = foodSelect.options[foodSelect.selectedIndex];
      const foodName = selectedOption.textContent.split(' (')[0];
      const foodCategory = selectedOption.textContent.match(/\(([^)]+)\)/)?.[1] || 'Unknown';

      // Wait for new sensor data
      const newSensorData = await this.waitForNewSensorData(baselineData);
      
      if (!newSensorData) {
        alert('No new sensor data detected within timeout. Please try again.');
        return;
      }

      // Update button to show ML processing
      if (scanBtn) {
        scanBtn.innerHTML = '<i class="bi bi-cpu"></i> Analyzing with ML...';
      }

      // Perform ML prediction using new sensor data
      const prediction = await this.performMLPrediction(foodId, foodName, foodCategory, newSensorData);
      
      if (prediction.success) {
        // Show ML prediction results in custom modal
        this.showMLPredictionResults(foodName, prediction.prediction);
        foodSelect.value = '';
        // Close scanner modal after successful prediction
        const modal = document.getElementById('mlFoodScannerModal');
        if (modal) modal.style.display = 'none';
      } else {
        alert(`ML Prediction failed: ${prediction.error}`);
      }
    } catch (error) {
      console.error('ML prediction error:', error);
      alert('Prediction failed: ' + error.message);
    } finally {
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="bi bi-scan"></i> Ready Scan';
      }
    }
  }

  // Handle ML training data upload from ML tab
  async handleMLTrainingDataUpload() {
    const foodSelect = document.getElementById('mlUploadFoodSelect');
    const statusSelect = document.getElementById('mlUploadStatus');
    const notesTextarea = document.getElementById('mlUploadNotes');
    
    if (!foodSelect || !statusSelect) {
      alert('ML upload controls not found');
      return;
    }

    const foodId = foodSelect.value;
    const status = statusSelect.value;
    const notes = notesTextarea ? notesTextarea.value.trim() : '';

    if (!foodId) {
      alert('Please select a food type');
      return;
    }

    if (!status) {
      alert('Please select a food status');
      return;
    }

    const uploadBtn = document.getElementById('uploadMLTrainingDataBtn');
    if (uploadBtn) {
      uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Teaching AI...';
    }

    try {
      const result = await this.uploadMLTrainingData(foodId, status, notes);
      
      if (result.success) {
        alert('Awesome! You just shared your knowledge with our AI! 🎓✨');
        // Clear form
        foodSelect.value = '';
        statusSelect.value = '';
        if (notesTextarea) notesTextarea.value = '';
        // Refresh ML history
        await this.updateMLHistory();
      } else {
        alert(`Oops! Sharing failed: ${result.error}`);
      }
    } catch (error) {
      console.error('ML training upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-lightbulb"></i> Teach the AI';
      }
    }
  }

  // Handle batch upload
  async handleBatchUpload() {
    alert('Share Multiple feature coming soon! This will allow you to teach our AI about multiple foods at once.');
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
    console.log('openDashboardDeviceModal called');
    const modal = document.getElementById('dashboardAddDeviceModal');
    console.log('Modal element:', modal);
    if (!modal) {
      console.error('Modal not found!');
      return;
    }
    const closeModal = () => { modal.style.display = 'none'; };
    modal.style.display = 'flex';
    console.log('Modal should be visible now');
    const typeEl = document.getElementById('dashboardDeviceType');
    const idEl = document.getElementById('dashboardDeviceId');
    const form = document.getElementById('dashboardAddDeviceForm');
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || '';
    
    // Focus on sensor ID input
    if (idEl) {
      idEl.focus();
    }

    // Bind close
    const xBtn = modal.querySelector('.config-modal-close');
    const cancelBtn = modal.querySelector('.config-modal-cancel');
    const backdrop = modal.querySelector('.config-modal-backdrop');
    [xBtn, cancelBtn, backdrop].forEach(btn => btn && (btn.onclick = closeModal));

    const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    form.onsubmit = async (e) => {
      e.preventDefault();
      console.log('Device form submitted');
      const type = typeEl ? typeEl.value : '';
      const sensorId = idEl ? idEl.value.trim() : '';
      console.log('Selected type:', type);
      console.log('Sensor ID:', sensorId);
      if (!type) {
        alert('Please select a sensor type');
        return;
      }
      if (!sensorId) {
        alert('Please enter a sensor ID');
        return;
      }
      const submitBtn = form.querySelector('.config-modal-submit');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Connecting...'; }
      try {
        console.log('Sending request to /api/sensor/devices with type:', type, 'and sensor_id:', sensorId);
        const r = await fetch('/api/sensor/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type, sensor_id: sensorId })
        });
        console.log('Response status:', r.status);
        const j = await r.json();
        console.log('Response data:', j);
        if (j && j.success) {
          alert(`Device "${sensorId}" connected successfully!`);
          closeModal();
          // Clear form
          if (idEl) idEl.value = '';
          if (typeEl) typeEl.selectedIndex = 0;
          await this.fetchSensorDevices();
          this.renderRegisteredDevices();
        } else {
          alert(j && j.error ? j.error : 'Failed to connect device');
        }
      } catch (error) {
        console.error('Error connecting device:', error);
        alert('Failed to connect device: ' + error.message);
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Connect'; }
      }
    };
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
      if (!name) return alert('Please enter a food name');
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
          alert(j && j.message ? j.message : 'Failed to add food');
        }
      } catch (_) {
        alert('Failed to add food');
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
        window.location.href = '/login';
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
    if (!sensorType || !adminSensorTypes.includes(sensorType)) return alert('Invalid sensor type.');
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

  renderSensorStatusList() {
    // Sensor status list removed from UI
    return;
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
