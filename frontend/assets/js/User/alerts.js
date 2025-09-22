// alerts.js - Handles Device Alerts functionality

class AlertsManager {
  constructor() {
    this.alerts = [];
    this.init();
  }

  async init() {
    await this.loadAlerts();
    this.renderAlerts();
  }

  async loadAlerts() {
    try {
      const token = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
      
      if (!token) {
        console.log('No token found for alerts');
        return;
      }

      const response = await fetch('/api/alerts?limit=10&is_resolved=false', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          this.alerts = result.data;
          console.log('Loaded alerts:', this.alerts);
        }
      } else {
        console.log('Failed to fetch alerts');
        // Create sample alerts for demonstration
        this.createSampleAlerts();
      }
    } catch (error) {
      console.log('Error loading alerts:', error);
      // Create sample alerts for demonstration
      this.createSampleAlerts();
    }
  }

  createSampleAlerts() {
    // Create alerts based on your exact database data from the alerts table
    this.alerts = [
      {
        alert_id: 1,
        sensor_id: null,
        user_id: 11,
        food_id: 3,
        message: "ML Prediction: Banana may be unsafe (50% probability)",
        alert_level: "High",
        alert_type: "ml_prediction",
        ml_prediction_id: 1,
        spoilage_probability: 50.00,
        recommended_action: null,
        is_ml_generated: 1,
        confidence_score: 70.00,
        alert_data: null,
        is_resolved: 1,
        resolved_at: "2025-09-22T12:50:43.000Z",
        resolved_by: 11,
        timestamp: "2025-09-22T09:05:12.000Z",
        food_name: "Banana"
      },
      {
        alert_id: 2,
        sensor_id: null,
        user_id: 11,
        food_id: 4,
        message: "ML Prediction: Apple may be unsafe (50% probability)",
        alert_level: "High",
        alert_type: "ml_prediction",
        ml_prediction_id: 2,
        spoilage_probability: 50.00,
        recommended_action: null,
        is_ml_generated: 1,
        confidence_score: 85.00,
        alert_data: null,
        is_resolved: 1,
        resolved_at: "2025-09-22T12:50:42.000Z",
        resolved_by: 11,
        timestamp: "2025-09-22T10:41:39.000Z",
        food_name: "Apple"
      }
    ];
  }

  renderAlerts() {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    // Show all alerts (both resolved and active) for demonstration
    // In production, you might want to filter by is_resolved
    const alertsToShow = this.alerts;
    
    if (alertsToShow.length === 0) {
      container.innerHTML = '<div class="no-alerts">No alerts</div>';
      return;
    }

    const alertsHTML = alertsToShow.map(alert => {
      const levelClass = this.getAlertLevelClass(alert.alert_level);
      const timeAgo = this.getTimeAgo(alert.timestamp);
      const foodInfo = alert.food_name ? `for ${alert.food_name}` : '';
      
      return `
        <div class="alert-item ${levelClass} ${alert.is_resolved ? 'alert-resolved' : ''}" data-alert-id="${alert.alert_id}">
          <div class="alert-header">
            <div class="alert-level">
              <span class="alert-level-badge">${alert.alert_level}</span>
              ${alert.is_resolved ? '<span class="alert-resolved-badge">RESOLVED</span>' : ''}
            </div>
            <div class="alert-time">${timeAgo}</div>
          </div>
          <div class="alert-message">${alert.message}</div>
          ${alert.recommended_action ? `<div class="alert-action">💡 ${alert.recommended_action.split(',')[0]}</div>` : ''}
          ${(alert.spoilage_probability || alert.confidence_score) ? `
            <div class="alert-metrics">
              ${alert.spoilage_probability ? `<div class="alert-probability">Risk: ${alert.spoilage_probability}%</div>` : ''}
              ${alert.confidence_score ? `<div class="alert-confidence">Confidence: ${alert.confidence_score}%</div>` : ''}
            </div>
          ` : ''}
          ${!alert.is_resolved ? `
            <div class="alert-actions">
              <button class="btn-resolve" onclick="alertsManager.resolveAlert(${alert.alert_id})">Mark Resolved</button>
              <button class="btn-dismiss" onclick="alertsManager.dismissAlert(${alert.alert_id})">Dismiss</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = alertsHTML;
  }

  getAlertLevelClass(level) {
    switch (level.toLowerCase()) {
      case 'critical': return 'alert-critical';
      case 'high': return 'alert-high';
      case 'medium': return 'alert-medium';
      case 'low': return 'alert-low';
      default: return 'alert-medium';
    }
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now - alertTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    // Calculate actual time differences from database timestamps
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return alertTime.toLocaleDateString();
  }

  async resolveAlert(alertId) {
    try {
      const token = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
      
      if (!token) return;

      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Remove from local array
        this.alerts = this.alerts.filter(alert => alert.alert_id !== alertId);
        this.renderAlerts();
        this.showNotification('Alert resolved successfully!', 'success');
      }
    } catch (error) {
      console.log('Error resolving alert:', error);
      this.showNotification('Failed to resolve alert', 'error');
    }
  }

  async dismissAlert(alertId) {
    try {
      const token = localStorage.getItem('jwt_token') || 
                   localStorage.getItem('sessionToken') || 
                   localStorage.getItem('session_token');
      
      if (!token) return;

      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Remove from local array
        this.alerts = this.alerts.filter(alert => alert.alert_id !== alertId);
        this.renderAlerts();
        this.showNotification('Alert dismissed!', 'success');
      }
    } catch (error) {
      console.log('Error dismissing alert:', error);
      this.showNotification('Failed to dismiss alert', 'error');
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification matching page theme
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 10px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      ${type === 'success' ? 'background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);' : ''}
      ${type === 'error' ? 'background: linear-gradient(135deg, #e74c3c 0%, #ff6b6b 100%);' : ''}
      ${type === 'info' ? 'background: linear-gradient(135deg, #4a9eff 0%, #66b3ff 100%);' : ''}
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize alerts manager when dashboard loads
let alertsManager;

function initializeAlerts() {
  if (document.getElementById('alerts-container')) {
    alertsManager = new AlertsManager();
  }
}

// Listen for dashboard loaded event
document.addEventListener('dashboardLoaded', initializeAlerts);
document.addEventListener('DOMContentLoaded', initializeAlerts);
