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
        this.alerts = [];
      }
    } catch (error) {
      console.log('Error loading alerts:', error);
      this.alerts = [];
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
      const severityClass = this.getSeverityClass(alert.alert_level);
      const timeAgo = this.getTimeAgo(alert.timestamp);
      const foodInfo = alert.food_name ? `for ${alert.food_name}` : '';
      const typeLabel = this.getAlertTypeLabel(alert.alert_type);
      const iconClass = this.getIconClass(alert.alert_type, alert.alert_level);
      
      return `
        <div class="alert-item ${severityClass} ${alert.is_resolved ? 'alert-resolved' : ''}" data-alert-id="${alert.alert_id}">
          <div class="alert-icon">
            <i class="bi ${iconClass}"></i>
          </div>
          <div class="alert-content">
            <h5 class="alert-title">${alert.message}</h5>
            <p class="alert-description">${typeLabel} Alert ${foodInfo}</p>
            <p class="alert-time">${timeAgo}</p>
          </div>
          <div class="alert-actions">
            <button class="alert-action-btn dismiss" onclick="alertsManager.showAlertDetails(${alert.alert_id})">READ</button>
          </div>
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

  getSeverityClass(level) {
    switch (level.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'critical';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'warning';
    }
  }

  getIconClass(type, level) {
    const severity = level.toLowerCase();
    const alertType = type.toLowerCase();
    
    if (severity === 'critical' || severity === 'high') {
      return 'bi-shield-exclamation';
    } else if (severity === 'medium') {
      return 'bi-thermometer-half';
    } else if (alertType === 'ml_prediction') {
      return 'bi-cpu';
    } else if (alertType === 'sensor') {
      return 'bi-activity';
    } else {
      return 'bi-info-circle';
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

  async markAsRead(alertId) {
    try {
      // Just mark as read locally without resolving
      const alertIndex = this.alerts.findIndex(alert => alert.alert_id === alertId);
      if (alertIndex !== -1) {
        // Add a visual indicator that it's been read
        const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
        if (alertElement) {
          alertElement.classList.add('alert-read');
          alertElement.style.opacity = '0.7';
          
          // Update the button to show it's been read
          const readButton = alertElement.querySelector('.alert-action-btn.dismiss');
          if (readButton) {
            readButton.textContent = 'READ ✓';
            readButton.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            readButton.disabled = true;
          }
        }
        
        this.showNotification('Alert marked as read!', 'success');
        console.log('✅ Alert marked as read:', alertId);
      }
    } catch (error) {
      console.log('Error marking alert as read:', error);
      this.showNotification('Failed to mark alert as read', 'error');
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

  showAlertDetails(alertId) {
    const alert = this.alerts.find(a => a.alert_id === alertId);
    if (!alert) {
      console.log('Alert not found:', alertId);
      return;
    }

    // Create modal HTML
    const modalHTML = `
      <div class="alert-details-modal" id="alertDetailsModal" style="display: flex;">
        <div class="alert-details-backdrop"></div>
        <div class="alert-details-content">
          <div class="alert-details-header">
            <span class="alert-details-title">
              <i class="bi bi-exclamation-triangle" style="color: #ffc107;"></i>
              Alert Details
            </span>
            <button class="alert-details-close" onclick="alertsManager.closeAlertDetails()">&times;</button>
          </div>
          <div class="alert-details-body">
            <div class="alert-detail-section">
              <h4>Alert Information</h4>
              <div class="alert-detail-item">
                <span class="detail-label">Message:</span>
                <span class="detail-value">${alert.message}</span>
              </div>
              <div class="alert-detail-item">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${this.getAlertTypeLabel(alert.alert_type)}</span>
              </div>
              <div class="alert-detail-item">
                <span class="detail-label">Timestamp:</span>
                <span class="detail-value">${new Date(alert.timestamp).toLocaleString()}</span>
              </div>
              ${alert.food_name ? `
                <div class="alert-detail-item">
                  <span class="detail-label">Food Item:</span>
                  <span class="detail-value">${alert.food_name}</span>
                </div>
              ` : ''}
              ${alert.food_category ? `
                <div class="alert-detail-item">
                  <span class="detail-label">Category:</span>
                  <span class="detail-value">${alert.food_category}</span>
                </div>
              ` : ''}
            </div>
            
            <!-- Severity Badge Section -->
            <div class="alert-detail-section">
              <h4>Alert Severity</h4>
              <div class="severity-badge-modal">
                <span class="alert-severity-badge ${this.getSeverityClass(alert.alert_level)}">${alert.alert_level}</span>
              </div>
            </div>
            
            ${alert.recommended_action ? `
              <div class="alert-detail-section">
                <h4>Recommendations</h4>
                <div class="alert-recommendations">
                  ${alert.recommended_action.split(',').map(rec => `
                    <div class="recommendation-item">
                      <i class="bi bi-lightbulb"></i>
                      <span>${rec.trim()}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            
            ${(alert.spoilage_probability || alert.confidence_score) ? `
              <div class="alert-detail-section">
                <h4>Analysis Results</h4>
                <div class="alert-metrics-detail">
                  ${alert.spoilage_probability ? `
                    <div class="metric-item">
                      <span class="metric-label">Risk:</span>
                      <span class="metric-value risk-${alert.spoilage_probability > 70 ? 'high' : alert.spoilage_probability > 40 ? 'medium' : 'low'}">${alert.spoilage_probability}%</span>
                    </div>
                  ` : ''}
                  ${alert.confidence_score ? `
                    <div class="metric-item">
                      <span class="metric-label">Confidence:</span>
                      <span class="metric-value confidence-${alert.confidence_score > 80 ? 'high' : alert.confidence_score > 60 ? 'medium' : 'low'}">${alert.confidence_score}%</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>
          <div class="alert-details-footer">
            <button class="alert-details-btn secondary" onclick="alertsManager.closeAlertDetails()">Close</button>
            <button class="alert-details-btn primary" onclick="alertsManager.resolveAlert(${alertId}); alertsManager.closeAlertDetails();">Mark as Done</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  closeAlertDetails() {
    const modal = document.getElementById('alertDetailsModal');
    if (modal) {
      modal.remove();
    }
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
