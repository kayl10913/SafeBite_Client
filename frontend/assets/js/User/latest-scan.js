/**
 * Latest Scan Result Manager
 * Handles fetching and displaying the latest scan result from the database
 */
class LatestScanManager {
    constructor() {
        this.latestScanData = null;
        this.authToken = null;
        this.refreshInterval = null;
        this.isRefreshing = false;
        this.refreshRate = 5000; // 5 seconds default
        this.init();
    }

    /**
     * Get authentication token from localStorage
     */
    getAuthToken() {
        if (!this.authToken) {
            // Check all possible token locations
            const jwtToken = localStorage.getItem('jwt_token');
            const sessionToken = localStorage.getItem('sessionToken');
            const session_token = localStorage.getItem('session_token');
            
            console.log('Available tokens:', {
                jwt_token: jwtToken ? 'Found' : 'Not found',
                sessionToken: sessionToken ? 'Found' : 'Not found',
                session_token: session_token ? 'Found' : 'Not found'
            });
            
            this.authToken = jwtToken || sessionToken || session_token;
        }
        return this.authToken;
    }

    /**
     * Initialize the latest scan manager
     */
    init() {
        // Add CSS styles for real-time controls
        this.addRealTimeStyles();
        
        // Add event listener for manual refresh button
        this.setupManualRefresh();
        
        // Check if user is authenticated before loading data
        if (this.getAuthToken()) {
            this.loadLatestScanResult();
            this.startRealTimeUpdates();
        } else {
            console.warn('User not authenticated, showing no data state');
            this.renderNoData();
        }
    }

    /**
     * Load the latest scan result from the API
     */
    async loadLatestScanResult() {
        try {
            const token = this.getAuthToken();
            
            if (!token) {
                console.error('No authentication token found');
                this.renderNoData();
                return;
            }

            const response = await fetch('/api/users/latest-scan-result', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // Log the response text to see what's being returned
                const responseText = await response.text();
                console.error('API Error Response:', responseText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const responseText = await response.text();
                console.error('Non-JSON response received:', responseText);
                throw new Error('Server returned non-JSON response');
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                this.latestScanData = result.data;
                this.renderLatestScanResult();
            } else {
                this.renderNoData();
            }

        } catch (error) {
            console.error('Error loading latest scan result:', error);
            this.renderError();
        }
    }

    /**
     * Add CSS styles for real-time controls
     */
    addRealTimeStyles() {
        if (document.querySelector('#latest-scan-realtime-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'latest-scan-realtime-styles';
        style.textContent = `
            .scan-card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 1rem;
            }
            
            .scan-card-controls {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .btn-refresh-scan {
                background: none;
                border: 1px solid #007bff;
                color: #007bff;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 12px;
            }
            
            .btn-refresh-scan:hover {
                background: #007bff;
                color: white;
                transform: scale(1.05);
            }
            
            .btn-refresh-scan:active {
                transform: scale(0.95);
            }
            
            .btn-refresh-scan.refreshing {
                animation: spin 1s linear infinite;
                pointer-events: none;
                opacity: 0.7;
            }
            
            .realtime-indicator {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: #28a745;
                font-weight: 500;
            }
            
            .realtime-indicator.paused {
                color: #ffc107;
            }
            
            .realtime-indicator.paused .fa-circle {
                color: #ffc107 !important;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup manual refresh button
     */
    setupManualRefresh() {
        // Use event delegation since the button might not exist yet
        document.addEventListener('click', (e) => {
            if (e.target.closest('#refreshLatestScan')) {
                e.preventDefault();
                this.manualRefresh();
            }
        });
    }

    /**
     * Manual refresh triggered by user
     */
    async manualRefresh() {
        const button = document.querySelector('#refreshLatestScan');
        if (button) {
            button.classList.add('refreshing');
        }
        
        console.log('🔄 Manual refresh triggered');
        await this.refreshLatestScan();
        
        if (button) {
            button.classList.remove('refreshing');
        }
    }

    /**
     * Start real-time updates for latest scan data
     */
    startRealTimeUpdates() {
        // Clear any existing interval
        this.stopRealTimeUpdates();
        
        console.log('🔄 Starting real-time updates for Latest Scan (every', this.refreshRate / 1000, 'seconds)');
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isRefreshing && this.getAuthToken()) {
                await this.refreshLatestScan();
            }
        }, this.refreshRate);
    }

    /**
     * Stop real-time updates
     */
    stopRealTimeUpdates() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('⏹️ Stopped real-time updates for Latest Scan');
        }
    }

    /**
     * Refresh latest scan data (with visual indicator)
     */
    async refreshLatestScan() {
        if (this.isRefreshing) return;
        
        this.isRefreshing = true;
        
        try {
            // Add subtle loading indicator
            this.showRefreshIndicator();
            
            const token = this.getAuthToken();
            if (!token) {
                console.warn('No auth token available for refresh');
                return;
            }

            const response = await fetch('/api/users/latest-scan-result', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                // Check if data has actually changed
                const hasChanged = this.hasDataChanged(result.data);
                
                if (hasChanged) {
                    console.log('📊 Latest scan data updated');
                    this.latestScanData = result.data;
                    this.renderLatestScanResult();
                    this.showUpdateNotification();
                }
            }

        } catch (error) {
            console.error('Error refreshing latest scan:', error);
        } finally {
            this.hideRefreshIndicator();
            this.isRefreshing = false;
        }
    }

    /**
     * Check if the new data is different from current data
     */
    hasDataChanged(newData) {
        if (!this.latestScanData) return true;
        
        // Compare key fields that indicate new scan data
        const currentId = this.latestScanData.id || this.latestScanData.prediction_id;
        const newId = newData.id || newData.prediction_id;
        
        const currentTimestamp = this.latestScanData.created_at || this.latestScanData.timestamp;
        const newTimestamp = newData.created_at || newData.timestamp;
        
        return currentId !== newId || currentTimestamp !== newTimestamp;
    }

    /**
     * Show refresh indicator
     */
    showRefreshIndicator() {
        const container = document.querySelector('.scan-result-card');
        if (!container) return;
        
        // Add a subtle refresh indicator
        let indicator = container.querySelector('.refresh-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'refresh-indicator';
            indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            indicator.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                color: #007bff;
                font-size: 12px;
                opacity: 0.7;
                z-index: 10;
            `;
            container.style.position = 'relative';
            container.appendChild(indicator);
        }
        indicator.style.display = 'block';
    }

    /**
     * Hide refresh indicator
     */
    hideRefreshIndicator() {
        const indicator = document.querySelector('.refresh-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Show brief update notification
     */
    showUpdateNotification() {
        const container = document.querySelector('.scan-result-card');
        if (!container) return;
        
        // Create update notification
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = '<i class="fas fa-check-circle"></i> Updated';
        notification.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #28a745;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            z-index: 10;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        // Add CSS animation if not already present
        if (!document.querySelector('#update-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'update-notification-styles';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-10px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        container.appendChild(notification);
        
        // Remove notification after animation
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    /**
     * Set refresh rate (in milliseconds)
     */
    setRefreshRate(rate) {
        this.refreshRate = rate;
        if (this.refreshInterval) {
            this.stopRealTimeUpdates();
            this.startRealTimeUpdates();
        }
    }

    /**
     * Render the latest scan result in the dashboard
     */
    renderLatestScanResult() {
        const container = document.querySelector('.scan-result-card');
        if (!container || !this.latestScanData) return;

        const data = this.latestScanData;
        
        // Format the scan date
        const scanDate = new Date(data.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Get status badge class
        const statusBadgeClass = this.getStatusBadgeClass(data.statusClass);
        
        // Get expiry badge class
        const expiryBadgeClass = this.getExpiryBadgeClass(data.expiryStatus);

        container.innerHTML = `
            <div class="scan-food-info">
                <div class="scan-food-details">
                    <h3 class="scan-food-name">${data.name}</h3>
                    <span class="scan-category-badge">${data.category}</span>
                </div>
                <div class="scan-status-section">
                    <span class="scan-status-badge ${statusBadgeClass}">${data.status}</span>
                    <div class="scan-risk-score">
                        <span class="risk-label">Risk Score:</span>
                        <span class="risk-value">${data.riskScore}%</span>
                    </div>
                </div>
            </div>
            
            <div class="scan-sensors">
                <div class="scan-sensor-item">
                    <span class="sensor-label">🌡️ Temperature:</span>
                    <span class="sensor-value">${data.sensors.temperature}</span>
                </div>
                <div class="scan-sensor-item">
                    <span class="sensor-label">💧 Humidity:</span>
                    <span class="sensor-value">${data.sensors.humidity}</span>
                </div>
                <div class="scan-sensor-item">
                    <span class="sensor-label">💨 Gas Level:</span>
                    <span class="sensor-value">${data.sensors.gas}</span>
                </div>
            </div>
            
            <div class="scan-expiry">
                <div class="scan-expiry-date">
                    <span class="expiry-label">📅 Expiry Date:</span>
                    <span class="expiry-value">${data.expiryDate || 'Not set'}</span>
                </div>
                <div class="scan-expiry-status">
                    <span class="expiry-badge ${expiryBadgeClass}">${data.expiryStatus}</span>
                    ${data.daysLeft !== undefined ? `<span class="days-left">(${data.daysLeft} days left)</span>` : ''}
                </div>
            </div>
            
            <div class="scan-actions">
                <button class="view-recommendations-btn" onclick="latestScanManager.showRecommendations()">
                    <i class="bi bi-lightbulb"></i>
                    View Recommendations
                </button>
            </div>
            
            <div class="scan-meta">
                <span class="scan-date">Scanned: ${scanDate}</span>
                <span class="scan-confidence">Confidence: ${data.confidenceScore}%</span>
            </div>
        `;
    }

    /**
     * Render no data state
     */
    renderNoData() {
        const container = document.querySelector('.scan-result-card');
        if (!container) return;

        container.innerHTML = `
            <div class="no-scan-data">
                <div class="no-scan-icon">
                    <i class="bi bi-search"></i>
                </div>
                <h3>No Scan Results</h3>
                <p>No food items have been scanned yet. Start by scanning a food item to see results here.</p>
                <button class="scan-food-btn" onclick="window.location.href='../pages/scan-food.html'">
                    <i class="bi bi-camera"></i>
                    Scan Food Item
                </button>
            </div>
        `;
    }

    /**
     * Render error state
     */
    renderError() {
        const container = document.querySelector('.scan-result-card');
        if (!container) return;

        container.innerHTML = `
            <div class="scan-error">
                <div class="error-icon">
                    <i class="bi bi-exclamation-triangle"></i>
                </div>
                <h3>Error Loading Data</h3>
                <p>Unable to load the latest scan result. Please try again later.</p>
                <button class="retry-btn" onclick="latestScanManager.loadLatestScanResult()">
                    <i class="bi bi-arrow-clockwise"></i>
                    Retry
                </button>
            </div>
        `;
    }

    /**
     * Get status badge CSS class
     */
    getStatusBadgeClass(statusClass) {
        switch (statusClass) {
            case 'safe':
                return 'status-safe';
            case 'warning':
                return 'status-warning';
            case 'danger':
                return 'status-danger';
            default:
                return 'status-unknown';
        }
    }

    /**
     * Get expiry badge CSS class
     */
    getExpiryBadgeClass(expiryStatus) {
        switch (expiryStatus) {
            case 'Good':
                return 'expiry-good';
            case 'Expires Soon':
                return 'expiry-warning';
            case 'Expires Today':
                return 'expiry-danger';
            case 'Expired':
                return 'expiry-expired';
            default:
                return 'expiry-unknown';
        }
    }

    /**
     * Show recommendations modal
     */
    showRecommendations() {
        if (!this.latestScanData) {
            alert('No scan data available. Please try refreshing the page.');
            return;
        }

        if (!this.latestScanData.recommendations || this.latestScanData.recommendations.length === 0) {
            alert('No recommendations available for this scan result.');
            return;
        }

        const recommendations = this.latestScanData.recommendations;
        const foodName = this.latestScanData.name || 'Unknown Food';
        
        // Create modal HTML using previous design
        const modalHTML = `
            <div class="config-modal" id="foodRecommendationsModal" style="display: flex;">
                <div class="config-modal-backdrop"></div>
                <div class="config-modal-content" style="background:#212c4d;color:#e0e6f6;border:1px solid #2b3a66;max-width:600px;">
                    <div class="config-modal-header" style="border-bottom:1px solid #2b3a66;">
                        <span class="config-modal-title" style="color:#fff;">
                            <i class="bi bi-clipboard-data" style="color:#4a9eff;"></i> Food Analysis Details
                        </span>
                        <button class="config-modal-close" aria-label="Close" style="color:#bfc9da;" onclick="latestScanManager.closeRecommendations()">&times;</button>
                    </div>
                    <div class="recommendations-body" style="padding:20px;">
                        <div class="food-detail-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #2b3a66;">
                            <div class="food-detail-info" style="flex:1;">
                                <h3 style="color:#fff;margin:0 0 8px 0;font-size:1.5rem;font-weight:600;">${foodName}</h3>
                                <div class="food-detail-meta" style="display:flex;align-items:center;gap:12px;">
                                    <span class="detail-category" style="background:#4a9eff;color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;text-transform:uppercase;">${this.latestScanData.category || 'Unknown'}</span>
                                    <span class="detail-created" style="color:#b8c5e8;font-size:12px;">Created: ${new Date(this.latestScanData.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div class="food-detail-status" style="text-align:right;">
                                <span class="detail-status-badge ${this.getStatusBadgeClass(this.latestScanData.statusClass)}" style="display:inline-block;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:4px;">${this.latestScanData.status}</span>
                                <div class="detail-risk-score" style="color:#b8c5e8;font-size:12px;">Risk: ${this.latestScanData.riskScore}%</div>
                            </div>
                        </div>
                        
                        <div class="recommendations-content">
                            <h4 style="color:#fff;margin:0 0 16px 0;display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:600;">
                                <i class="bi bi-lightbulb" style="color:#4a9eff;font-size:1.2rem;"></i>
                                Recommendations
                            </h4>
                            <div class="recommendations-list" style="margin-bottom:24px;">
                                ${recommendations.map((rec, index) => `
                                    <div class="recommendation-item" style="background:#2a3658;border:1px solid #3a4a6b;border-radius:10px;padding:14px;margin-bottom:10px;transition:all 0.2s ease;">
                                        <div style="display:flex;align-items:flex-start;gap:12px;">
                                            <div style="background:linear-gradient(135deg,#4a9eff 0%,#667eea 100%);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;box-shadow:0 2px 4px rgba(74,158,255,0.3);">${index + 1}</div>
                                            <div style="color:#e0e6f6;font-size:14px;line-height:1.5;flex:1;padding-top:2px;">${rec}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="sensor-details-section">
                                <h4 style="color:#fff;margin:0 0 16px 0;display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:600;">
                                    <i class="bi bi-activity" style="color:#4a9eff;font-size:1.2rem;"></i>
                                    Sensor Readings
                                </h4>
                                <div class="sensor-details-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;">
                                    <div class="sensor-detail-item" style="background:#2a3658;border:1px solid #3a4a6b;border-radius:10px;padding:16px;text-align:center;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                                        <div class="sensor-detail-label" style="color:#b8c5e8;font-size:11px;margin-bottom:6px;text-transform:uppercase;font-weight:500;letter-spacing:0.5px;">Temperature</div>
                                        <div class="sensor-detail-value" style="color:#fff;font-size:18px;font-weight:700;margin-bottom:6px;">${this.latestScanData.sensors.temperature}</div>
                                        <div class="sensor-detail-status good" style="color:#28a745;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Optimal</div>
                                    </div>
                                    <div class="sensor-detail-item" style="background:#2a3658;border:1px solid #3a4a6b;border-radius:10px;padding:16px;text-align:center;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                                        <div class="sensor-detail-label" style="color:#b8c5e8;font-size:11px;margin-bottom:6px;text-transform:uppercase;font-weight:500;letter-spacing:0.5px;">Humidity</div>
                                        <div class="sensor-detail-value" style="color:#fff;font-size:18px;font-weight:700;margin-bottom:6px;">${this.latestScanData.sensors.humidity}</div>
                                        <div class="sensor-detail-status good" style="color:#28a745;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Good</div>
                                    </div>
                                    <div class="sensor-detail-item" style="background:#2a3658;border:1px solid #3a4a6b;border-radius:10px;padding:16px;text-align:center;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                                        <div class="sensor-detail-label" style="color:#b8c5e8;font-size:11px;margin-bottom:6px;text-transform:uppercase;font-weight:500;letter-spacing:0.5px;">Gas Level</div>
                                        <div class="sensor-detail-value" style="color:#fff;font-size:18px;font-weight:700;margin-bottom:6px;">${this.latestScanData.sensors.gas}</div>
                                        <div class="sensor-detail-status good" style="color:#28a745;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Normal</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="recommendations-footer" style="border-top:1px solid #2b3a66;padding:20px;display:flex;justify-content:flex-end;">
                        <button type="button" class="config-modal-submit" style="background:linear-gradient(135deg,#4a9eff 0%,#667eea 100%);color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(74,158,255,0.3);" onclick="latestScanManager.closeRecommendations()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add click handler for backdrop
        const modal = document.getElementById('foodRecommendationsModal');
        const backdrop = modal.querySelector('.config-modal-backdrop');
        
        backdrop.addEventListener('click', () => {
            this.closeRecommendations();
        });
        
        // Add escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeRecommendations();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Close recommendations modal
     */
    closeRecommendations() {
        const modal = document.getElementById('foodRecommendationsModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Cleanup method - stop real-time updates and clear resources
     */
    cleanup() {
        console.log('🧹 Cleaning up LatestScanManager');
        this.stopRealTimeUpdates();
        this.latestScanData = null;
        this.authToken = null;
        this.isRefreshing = false;
        
        // Remove any indicators
        this.hideRefreshIndicator();
        
        // Remove update notification styles
        const styles = document.querySelector('#update-notification-styles');
        if (styles) {
            styles.remove();
        }
    }

    /**
     * Pause real-time updates (when user navigates away)
     */
    pause() {
        console.log('⏸️ Pausing LatestScanManager real-time updates');
        this.stopRealTimeUpdates();
        this.updateRealtimeIndicator(false);
    }

    /**
     * Resume real-time updates (when user navigates back)
     */
    resume() {
        console.log('▶️ Resuming LatestScanManager real-time updates');
        if (this.getAuthToken()) {
            this.startRealTimeUpdates();
            this.updateRealtimeIndicator(true);
        }
    }

    /**
     * Update the real-time indicator status
     */
    updateRealtimeIndicator(isActive) {
        const indicator = document.querySelector('.realtime-indicator');
        if (indicator) {
            if (isActive) {
                indicator.classList.remove('paused');
                indicator.querySelector('span').textContent = 'Live';
            } else {
                indicator.classList.add('paused');
                indicator.querySelector('span').textContent = 'Paused';
            }
        }
    }
}

// Initialize the latest scan manager when the page loads
// Make LatestScanManager globally available
window.LatestScanManager = LatestScanManager;

let latestScanManager;
document.addEventListener('DOMContentLoaded', function() {
    latestScanManager = new LatestScanManager();
    // Make the instance globally available too
    window.latestScanManager = latestScanManager;
});

// Listen for SPA navigation events to manage real-time updates
window.addEventListener('spa:navigate:before', (e) => {
    const from = (e && e.detail && e.detail.from) || '';
    if (from === 'dashboard' && window.latestScanManager) {
        console.log('Leaving dashboard, pausing LatestScanManager');
        window.latestScanManager.pause();
    }
});

window.addEventListener('spa:navigate:after', (e) => {
    const to = (e && e.detail && e.detail.to) || '';
    if (to === 'dashboard') {
        console.log('Dashboard loaded via SPA, managing LatestScanManager');
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            if (window.latestScanManager) {
                // Resume existing instance
                console.log('Resuming existing LatestScanManager');
                window.latestScanManager.resume();
            } else if (window.LatestScanManager) {
                // Create new instance if none exists
                console.log('Creating new LatestScanManager');
                window.latestScanManager = new LatestScanManager();
            }
        }, 100);
    }
});
