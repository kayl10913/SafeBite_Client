// device-management.js - Device management functionality

class DeviceManagement {
  constructor() {
    console.log('DeviceManagement class initialized');
    this.connectedDevices = [];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadCachedDevices();
    this.renderDeviceList();
    this.fetchDevicesFromApi().then(() => this.populateDeviceTypeOptions());
    this.populateDeviceTypeOptions();
  }

  setupEventListeners() {
    // Connect device button
    const connectBtn = document.getElementById('connectDeviceBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        this.connectDevice();
      });
    }

    // Enter key on device ID input
    const deviceIdInput = document.getElementById('deviceId');
    if (deviceIdInput) {
      deviceIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.connectDevice();
        }
      });
    }
  }

  async connectDevice() {
    const deviceId = document.getElementById('deviceId').value.trim();
    const deviceType = document.getElementById('deviceType').value;

    if (!deviceId) {
      alert('Please enter a device ID');
      return;
    }

    if (!deviceType) {
      alert('Please select a device type');
      return;
    }

    // Check if device already exists
    if (this.connectedDevices.find(device => device.id === deviceId)) {
      alert('Device with this ID is already connected');
      return;
    }

    // Call backend API to register/connect device
    try {
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
      const res = await fetch('/api/sensor/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ type: this.mapTypeName(deviceType), sensor_id: deviceId })
      });
      const j = await res.json();
      if (!res.ok || !j || j.success === false) {
        throw new Error((j && (j.error || j.message)) || `HTTP ${res.status}`);
      }
      await this.fetchDevicesFromApi();
    this.clearForm();
    this.showSuccessMessage(`Device ${deviceId} connected successfully!`);
    } catch (err) {
      console.error('Connect device API error:', err);
      alert('Failed to connect device: ' + (err.message || 'Unknown error'));
    }
  }

  getDeviceTypeName(type) {
    const t = this.normalizeType(type);
    const typeNames = {
      'temperature': 'Temperature Sensor',
      'humidity': 'Humidity Sensor',
      'gas': 'Gas Sensor'
    };
    return typeNames[t] || `${type || 'Unknown'} Sensor`;
  }

  getDeviceIcon(type) {
    const t = this.normalizeType(type);
    const icons = {
      'temperature': 'thermometer',
      'humidity': 'droplet',
      'gas': 'wind'
    };
    return icons[t] || 'cpu';
  }

  renderDeviceList() {
    const deviceList = document.getElementById('deviceSensorList');
    if (!deviceList) return;

    if (this.connectedDevices.length === 0) {
      deviceList.innerHTML = `
        <div class="no-devices">
          <i class="bi bi-wifi-off"></i>
          <p>No devices connected</p>
          <span>Connect a device to get started</span>
        </div>
      `;
      return;
    }

    const devicesHTML = this.connectedDevices.map(device => {
      const timeAgo = this.getTimeAgo(device.lastSeen || device.created_at || new Date().toISOString());
      const isConnected = (device.is_active === 1) || device.status === 'connected';
      
      return `
        <div class="device-sensor-item">
          <div class="device-sensor-info">
            <div class="device-sensor-icon ${isConnected ? '' : 'disconnected'}">
              <i class="bi bi-${this.getDeviceIcon(device.type)}"></i>
            </div>
            <div class="device-sensor-details">
              <h4>${device.sensor_id || device.id}</h4>
              <p>${this.getDeviceTypeName(device.type || device.device_type || device.type_name || deviceType)}</p>
            </div>
          </div>
          <div class="device-sensor-meta">
            <div class="device-sensor-status ${isConnected ? 'connected' : 'disconnected'}">
              <i class="bi bi-wifi${isConnected ? '' : '-off'}"></i>
            </div>
            <div class="device-sensor-time">
              <i class="bi bi-clock"></i>
              <span>${timeAgo}</span>
            </div>
            <button class="device-status-btn ${isConnected ? 'connected' : 'disconnected'}" 
                    onclick="window.deviceManagement.toggleDeviceStatus('${device.sensor_id || device.id}')">
              ${isConnected ? 'Connected' : 'Disconnected'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    deviceList.innerHTML = devicesHTML;
  }


  getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInMinutes = Math.floor((now - past) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }

  toggleDeviceStatus(deviceId) {
    const device = this.connectedDevices.find(d => d.id === deviceId);
    if (device) {
      device.status = device.status === 'connected' ? 'disconnected' : 'connected';
      device.lastSeen = new Date().toISOString();
      this.saveConnectedDevices();
      this.renderDeviceList();
    }
  }

  clearForm() {
    document.getElementById('deviceId').value = '';
    document.getElementById('deviceType').value = '';
  }

  showSuccessMessage(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4ade80;
      color: #000000;
      padding: 15px 20px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }

  loadConnectedDevices() {
    try {
    const devices = localStorage.getItem('connectedDevices');
      this.connectedDevices = devices ? JSON.parse(devices) : [];
    } catch (_) { this.connectedDevices = []; }
  }

  saveConnectedDevices() {
    try { localStorage.setItem('connectedDevices', JSON.stringify(this.connectedDevices)); } catch (_) {}
  }

  // Back-compat alias used by init()
  loadCachedDevices() {
    this.loadConnectedDevices();
  }

  async fetchDevicesFromApi() {
    try {
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
      if (!token) return;
      // Prefer /api/sensor/data?action=get_sensors per sensor.js
      let j;
      try {
        const res = await fetch('/api/sensor/data?action=get_sensors', { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (res.ok) j = await res.json();
      } catch (_) {}
      if (!j || !j.success || !Array.isArray(j.sensors)) {
        const res2 = await fetch('/api/sensor/devices', { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        j = await res2.json();
        if (!j || !j.success || !Array.isArray(j.sensors)) return;
      }
      // Normalize backend sensors
      this.connectedDevices = j.sensors.map(s => ({
        id: String(s.sensor_id),
        sensor_id: String(s.sensor_id),
        type: s.type,
        name: this.getDeviceTypeName(s.type),
        status: s.is_active === 1 ? 'connected' : 'disconnected',
        lastSeen: s.created_at || new Date().toISOString(),
        connectedAt: s.created_at || new Date().toISOString()
      }));
      this.saveConnectedDevices();
      this.renderDeviceList();
      try { document.dispatchEvent(new Event('devices-updated')); } catch (_) {}
    } catch (err) {
      console.warn('Fetch devices API error; using cached devices', err.message || err);
      this.renderDeviceList();
    }
  }

  mapTypeName(type) {
    // Map UI select values to backend expected types (only supported types)
    const map = { temperature: 'Temperature', humidity: 'Humidity', gas: 'Gas' };
    return map[type] || type;
  }

  normalizeType(type) {
    if (!type) return '';
    const v = String(type).toLowerCase();
    if (v.includes('temp')) return 'temperature';
    if (v.includes('humid')) return 'humidity';
    if (v.includes('gas')) return 'gas';
    return v;
  }

  async populateDeviceTypeOptions() {
    const sel = document.getElementById('deviceType') || document.getElementById('dashboardDeviceType');
    if (!sel) return;
    // Build from connected devices list
    const typesSet = new Set();
    (this.connectedDevices || []).forEach(d => typesSet.add(this.normalizeType(d.type)));
    // If empty, try API directly
    if (typesSet.size === 0) {
      try {
        const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || localStorage.getItem('session_token');
        if (token) {
          // Prefer sensor.js action
          let j;
          try {
            const res = await fetch('/api/sensor/data?action=get_sensors', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) j = await res.json();
          } catch (_) {}
          if (!j || !j.success || !Array.isArray(j.sensors)) {
            const res2 = await fetch('/api/sensor/devices', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res2.ok) j = await res2.json();
          }
          if (j && j.success && Array.isArray(j.sensors)) {
            j.sensors.forEach(s => typesSet.add(this.normalizeType(s.type)));
          }
        }
      } catch (_) {}
    }

    // Only allow supported types and hide types already connected for the user
    const allowed = ['temperature','humidity','gas'];
    const existing = Array.from(typesSet).filter(t => allowed.includes(t));
    const available = allowed.filter(t => !existing.includes(t));

    // Render options
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = available.length ? 'Select device type' : 'All supported sensor types connected';
    sel.appendChild(placeholder);
    available.forEach(t => {
      const opt = document.createElement('option');
      opt.value = this.mapTypeName(t.toLowerCase()).toLowerCase();
      opt.textContent = this.getDeviceTypeName(t);
      sel.appendChild(opt);
    });
  }
}

// Make DeviceManagement globally available
window.DeviceManagement = DeviceManagement;

// Global function to initialize device management
window.initDeviceManagement = function() {
    if (!window.deviceManagement) {
        window.deviceManagement = new DeviceManagement();
        console.log('Device management initialized via global function');
    }
};

