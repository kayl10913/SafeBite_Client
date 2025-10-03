// ml-data-upload.js - Smart Training functionality for teaching the AI model

class MLDataUpload {
  constructor() {
    console.log('MLDataUpload class initialized');
    this.mlHistory = this.loadMLHistory();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadExistingFoods();
    this.renderMLHistory();
  }

  setupEventListeners() {
    // ML Upload button
    const uploadBtn = document.getElementById('uploadMLTrainingDataBtn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.handleMLUpload();
      });
    }

    // Batch upload button
    const batchBtn = document.getElementById('batchUploadBtn');
    if (batchBtn) {
      batchBtn.addEventListener('click', () => {
        this.handleBatchUpload();
      });
    }

    // ML History filters
    const historyFilter = document.getElementById('mlHistoryFilter');
    if (historyFilter) {
      historyFilter.addEventListener('change', (e) => {
        this.filterMLHistory(e.target.value);
      });
    }

    const statusFilter = document.getElementById('mlStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filterMLHistoryByStatus(e.target.value);
      });
    }

    // Clear history button
    const clearBtn = document.getElementById('clearMLHistoryBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearMLHistory();
      });
    }
  }

  async loadExistingFoods() {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.error('No session token found');
        return;
      }

      const response = await fetch('/api/users/food-items', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        this.populateFoodDropdown(result.food_items || []);
      }
    } catch (error) {
      console.error('Error loading existing foods:', error);
    }
  }

  populateFoodDropdown(foods) {
    const select = document.getElementById('mlUploadFoodSelect');
    if (!select) return;

    // Clear existing options except the first one
    select.innerHTML = '<option value="">What food are you checking?</option>';

    foods.forEach(food => {
      const option = document.createElement('option');
      option.value = food.food_id;
      option.textContent = `${food.name} (${food.category || 'No category'})`;
      select.appendChild(option);
    });
  }

  async handleMLUpload() {
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
        if (typeof showSuccessToast === 'function') showSuccessToast('AI training data uploaded');
        // Clear form
        foodSelect.value = '';
        statusSelect.value = '';
        if (notesTextarea) notesTextarea.value = '';
        // Add to local history
        this.addToMLHistory(result.data);
        this.renderMLHistory();
      } else {
        if (typeof showErrorToast === 'function') showErrorToast('Upload failed');
      }
    } catch (error) {
      console.error('ML upload error:', error);
      if (typeof showErrorToast === 'function') showErrorToast('Upload error');
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-lightbulb"></i> Teach the AI';
      }
    }
  }

  async uploadMLTrainingData(foodId, status, notes = '') {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
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
        return { success: true, data: trainingData };
      } else {
        console.error('Failed to upload ML training data:', result.error);
        return { success: false, error: result.error || 'Upload failed' };
      }
    } catch (error) {
      console.error('Error uploading ML training data:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentSensorData() {
    try {
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');

      const response = await fetch('/api/sensor/latest-user', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        return result.data || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching current sensor data:', error);
      return null;
    }
  }

  handleBatchUpload() {
    if (typeof showInfoToast === 'function') showInfoToast('Share Multiple coming soon');
  }

  // ML History Methods
  loadMLHistory() {
    const history = localStorage.getItem('mlHistory');
    return history ? JSON.parse(history) : [];
  }

  saveMLHistory() {
    localStorage.setItem('mlHistory', JSON.stringify(this.mlHistory));
  }

  addToMLHistory(data) {
    const historyItem = {
      id: Date.now(),
      food_id: data.food_id,
      food_status: data.food_status,
      temperature: data.temperature,
      humidity: data.humidity,
      gas_level: data.gas_level,
      notes: data.notes,
      timestamp: data.timestamp,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    };
    
    this.mlHistory.unshift(historyItem);
    this.saveMLHistory();
  }

  renderMLHistory() {
    const historyList = document.getElementById('mlHistoryList');
    if (!historyList) return;

    if (this.mlHistory.length === 0) {
      historyList.innerHTML = `
        <div class="no-history">
          <i class="bi bi-lightbulb"></i>
          <p>No teaching data shared yet</p>
          <span>Start by teaching our AI above</span>
        </div>
      `;
      return;
    }

    const historyHTML = this.mlHistory.map(item => `
      <div class="ml-history-item">
        <div class="ml-history-info">
          <div class="ml-history-icon">
            <i class="bi bi-${this.getMLStatusIcon(item.food_status)}"></i>
          </div>
          <div class="ml-history-details">
            <h4>Food ID: ${item.food_id}</h4>
            <p>Status: ${item.food_status} | Temp: ${item.temperature}°C | Humidity: ${item.humidity}% | Gas: ${item.gas_level}ppm</p>
            ${item.notes ? `<small>Notes: ${item.notes}</small>` : ''}
          </div>
        </div>
        <div class="ml-history-meta">
          <div class="ml-history-time">${item.time}</div>
          <div class="ml-history-status ${item.food_status}">${item.food_status}</div>
        </div>
      </div>
    `).join('');

    historyList.innerHTML = historyHTML;
  }

  getMLStatusIcon(status) {
    const iconMap = {
      'fresh': 'check-circle',
      'spoiled': 'exclamation-triangle',
      'expired': 'x-circle'
    };
    return iconMap[status] || 'question-circle';
  }

  filterMLHistory(filter) {
    const historyList = document.getElementById('mlHistoryList');
    if (!historyList) return;

    let filteredHistory = [...this.mlHistory];
    const now = new Date();

    switch (filter) {
      case 'today':
        filteredHistory = this.mlHistory.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate.toDateString() === now.toDateString();
        });
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredHistory = this.mlHistory.filter(item => 
          new Date(item.timestamp) >= weekAgo
        );
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredHistory = this.mlHistory.filter(item => 
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
          <p>No teaching data found for this period</p>
          <span>Try selecting a different time range</span>
        </div>
      `;
      return;
    }

    const historyHTML = filteredHistory.map(item => `
      <div class="ml-history-item">
        <div class="ml-history-info">
          <div class="ml-history-icon">
            <i class="bi bi-${this.getMLStatusIcon(item.food_status)}"></i>
          </div>
          <div class="ml-history-details">
            <h4>Food ID: ${item.food_id}</h4>
            <p>Status: ${item.food_status} | Temp: ${item.temperature}°C | Humidity: ${item.humidity}% | Gas: ${item.gas_level}ppm</p>
            ${item.notes ? `<small>Notes: ${item.notes}</small>` : ''}
          </div>
        </div>
        <div class="ml-history-meta">
          <div class="ml-history-time">${item.time}</div>
          <div class="ml-history-status ${item.food_status}">${item.food_status}</div>
        </div>
      </div>
    `).join('');

    historyList.innerHTML = historyHTML;
  }

  filterMLHistoryByStatus(status) {
    const historyList = document.getElementById('mlHistoryList');
    if (!historyList) return;

    if (status === 'all') {
      this.renderMLHistory();
      return;
    }

    const filteredHistory = this.mlHistory.filter(item => item.food_status === status);

    if (filteredHistory.length === 0) {
      historyList.innerHTML = `
        <div class="no-history">
          <i class="bi bi-search"></i>
          <p>No teaching data found with condition: ${status}</p>
          <span>Try selecting a different condition</span>
        </div>
      `;
      return;
    }

    const historyHTML = filteredHistory.map(item => `
      <div class="ml-history-item">
        <div class="ml-history-info">
          <div class="ml-history-icon">
            <i class="bi bi-${this.getMLStatusIcon(item.food_status)}"></i>
          </div>
          <div class="ml-history-details">
            <h4>Food ID: ${item.food_id}</h4>
            <p>Status: ${item.food_status} | Temp: ${item.temperature}°C | Humidity: ${item.humidity}% | Gas: ${item.gas_level}ppm</p>
            ${item.notes ? `<small>Notes: ${item.notes}</small>` : ''}
          </div>
        </div>
        <div class="ml-history-meta">
          <div class="ml-history-time">${item.time}</div>
          <div class="ml-history-status ${item.food_status}">${item.food_status}</div>
        </div>
      </div>
    `).join('');

    historyList.innerHTML = historyHTML;
  }

  clearMLHistory() {
    if (!Array.isArray(this.mlHistory) || this.mlHistory.length === 0) {
      return;
    }

    const confirmed = confirm('Clear all your teaching history? This cannot be undone.');
    if (!confirmed) return;

    this.mlHistory = [];
    this.saveMLHistory();
    this.renderMLHistory();
  }
}

// Make MLDataUpload globally available
window.MLDataUpload = MLDataUpload;

// Global function to initialize ML data upload
window.initMLDataUpload = function() {
    if (!window.mlDataUpload) {
        window.mlDataUpload = new MLDataUpload();
        console.log('ML data upload initialized via global function');
    }
};

// Initialize ML data upload when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize if ML upload button exists
  if (document.getElementById('uploadMLTrainingDataBtn')) {
    window.mlDataUpload = new MLDataUpload();
  }
});
