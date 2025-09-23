// alerts.js - Handles Device Alerts functionality

class AlertsManager {
  constructor() {
    this.alerts = [];
    this._pollId = null;
    this.init();
  }

  async init() {
    await this.loadAlerts();
    this.renderAlerts();
    this.startRealtime();
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

      // Fetch all alerts (both resolved and unresolved) to get the latest status
      const response = await fetch('/api/alerts?limit=20', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔍 API Response:', result);
        if (result.success && result.data) {
          // Store all alerts but only show unresolved ones in the UI
          this.alerts = result.data;
          console.log('✅ Loaded all alerts:', this.alerts.length);
          console.log('📊 Alert status breakdown:', {
            total: this.alerts.length,
            resolved: this.alerts.filter(a => a.is_resolved).length,
            unresolved: this.alerts.filter(a => !a.is_resolved).length
          });
          console.log('📋 All alerts details:', this.alerts.map(a => ({
            id: a.alert_id,
            resolved: a.is_resolved,
            message: a.message?.substring(0, 50) + '...'
          })));
        } else {
          console.log('❌ No data in response:', result);
        }
      } else {
        console.log('❌ Failed to fetch alerts, status:', response.status);
        // Create sample alerts for demonstration
        this.createSampleAlerts();
      }
    } catch (error) {
      console.log('Error loading alerts:', error);
      // Create sample alerts for demonstration
      this.createSampleAlerts();
    }
  }

  startRealtime() {
    if (this._pollId) return;
    // Poll every 10s for new alerts; lightweight and avoids full page reload
    this._pollId = setInterval(async () => {
      if (document.hidden) return; // skip when tab hidden
      const beforeIds = new Set(this.alerts.map(a => a.alert_id));
      await this.loadAlerts();
      const afterIds = new Set(this.alerts.map(a => a.alert_id));
      // If there is any change, re-render
      let changed = false;
      if (beforeIds.size !== afterIds.size) changed = true;
      else {
        for (const id of afterIds) { if (!beforeIds.has(id)) { changed = true; break; } }
      }
      if (changed) this.renderAlerts();
    }, 10000);

    // Stop when navigating away from dashboard
    window.addEventListener('spa:navigate:after', (e) => {
      const to = (e && e.detail && e.detail.to) || '';
      if (to !== 'dashboard') this.stopRealtime();
    });
  }

  stopRealtime() {
    if (this._pollId) {
      clearInterval(this._pollId);
      this._pollId = null;
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
    if (!container) {
      console.log('❌ Alerts container not found');
      return;
    }

    // Only show unresolved alerts in the dashboard
    const alertsToShow = this.alerts.filter(alert => !alert.is_resolved);
    
    console.log('🔍 Rendering alerts:');
    console.log('  - Total alerts:', this.alerts.length);
    console.log('  - Unresolved alerts:', alertsToShow.length);
    console.log('  - All alerts:', this.alerts.map(a => ({ id: a.alert_id, resolved: a.is_resolved })));
    
    if (alertsToShow.length === 0) {
      console.log('📭 No active alerts to show');
      container.innerHTML = `
        <div class="no-alerts">
          <div class="no-alerts-icon">🥬</div>
          <div class="no-alerts-title">No Food Spoilage Alerts</div>
          <div class="no-alerts-message">All your food items are fresh and safe to consume. Our SmartSense system is continuously monitoring for any signs of spoilage.</div>
        </div>
      `;
      return;
    }

    const alertsHTML = alertsToShow.map(alert => {
      const levelClass = this.getAlertLevelClass(alert.alert_level);
      const timeAgo = this.getTimeAgo(alert.timestamp);
      const foodInfo = alert.food_name ? `for ${alert.food_name}` : '';
      const typeLabel = this.getAlertTypeLabel(alert.alert_type);
      
      return `
        <div class="alert-item ${levelClass} ${alert.is_resolved ? 'alert-resolved' : ''}" data-alert-id="${alert.alert_id}">
          <div class="alert-header">
            <div class="alert-level">
              <span class="alert-level-badge">${alert.alert_level}</span>
              <span class="alert-type-badge">${typeLabel}</span>
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

  getAlertTypeLabel(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'scanner') return 'Scanner';
    if (t === 'ml_prediction') return 'AI/ML';
    if (t === 'system') return 'System';
    if (t === 'device') return 'Device';
    if (t === 'sensor') return 'Sensor';
    return t || 'Alert';
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
        this.showNotification('Alert resolved successfully!', 'success');
        
        // Immediately update the local alert status
        const alertIndex = this.alerts.findIndex(alert => alert.alert_id === alertId);
        if (alertIndex !== -1) {
          this.alerts[alertIndex].is_resolved = 1;
          this.alerts[alertIndex].resolved_at = new Date().toISOString();
          console.log('✅ Updated local alert status for ID:', alertId);
        }
        
        // Re-render immediately to show the change
        this.renderAlerts();
        
        // Also refresh from server to ensure consistency
        console.log('🔄 Forcing alert refresh after resolution');
        setTimeout(async () => {
          await this.loadAlerts();
          this.renderAlerts();
        }, 1000);
        
        // Dispatch custom event to notify other components
        console.log('🔔 Dispatching alertResolved event for alert ID:', alertId);
        const event = new CustomEvent('alertResolved', {
          detail: { alertId: alertId, timestamp: new Date().toISOString() }
        });
        document.dispatchEvent(event);
        
        // Also dispatch a general data updated event
        const dataEvent = new CustomEvent('dataUpdated', {
          detail: { type: 'alert', action: 'resolved', alertId: alertId }
        });
        document.dispatchEvent(dataEvent);
        
        // Update localStorage to trigger storage event for other tabs
        localStorage.setItem('alertsUpdated', new Date().toISOString());
        localStorage.setItem('userLogsUpdated', new Date().toISOString());
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
