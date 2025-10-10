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
     * Format date to Philippine time
     */
    formatPhilippineDate(date) {
        if (!date) return new Date().toLocaleDateString('en-PH');
        
        // Convert to Philippine time (UTC+8)
        const phDate = new Date(date);
        const phTime = new Date(phDate.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours for PH time
        
        return phTime.toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Manila'
        });
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
            // First, check localStorage for SmartSense Scanner data (priority)
            console.log('🔍 Checking localStorage first for SmartSense Scanner data');
            const hasSmartScannerData = this.checkForSmartScannerData();
            
            if (hasSmartScannerData) {
                console.log('✅ Found SmartSense Scanner data, using localStorage');
                this.loadFromLocalStorage();
                return;
            }
            
            // If no SmartSense Scanner data, try API
            console.log('🔍 No SmartSense Scanner data, trying API');
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
                console.log('🔍 No API data available');
                this.renderNoData();
            }

        } catch (error) {
            console.error('Error loading latest scan result:', error);
            this.renderError();
        }
    }

    /**
     * Check if SmartSense Scanner data exists in localStorage
     */
    checkForSmartScannerData() {
        try {
            const mlPredictions = localStorage.getItem('ml_predictions');
            if (mlPredictions) {
                const predictions = JSON.parse(mlPredictions);
                if (Array.isArray(predictions) && predictions.length > 0) {
                    console.log('🔍 SmartSense Scanner data found in localStorage:', predictions.length, 'predictions');
                    return true;
                }
            }
            console.log('🔍 No SmartSense Scanner data in localStorage');
            return false;
        } catch (error) {
            console.error('Error checking localStorage:', error);
            return false;
        }
    }

    /**
     * Load SmartSense Scanner data from localStorage
     */
    loadFromLocalStorage() {
        try {
            console.log('🔍 Loading SmartSense Scanner data from localStorage');
            
            // Check for ml_predictions in localStorage
            const mlPredictions = localStorage.getItem('ml_predictions');
            if (mlPredictions) {
                const predictions = JSON.parse(mlPredictions);
                if (Array.isArray(predictions) && predictions.length > 0) {
                    // Get the most recent prediction
                    const latestPrediction = predictions[0];
                    console.log('🔍 Found SmartSense Scanner data:', latestPrediction);
                    
                    // Convert SmartSense Scanner data to latestScanData format
                    const parsedRecommendations = this.parseRecommendations(latestPrediction.recommendations);
                    console.log('🔍 Parsed Smart Scanner recommendations:', parsedRecommendations);
                    
                    this.latestScanData = {
                        id: latestPrediction.id || 'smartscan_' + Date.now(),
                        name: latestPrediction.food_name || 'Scanned Food',
                        category: latestPrediction.food_category || 'Unknown',
                        status: latestPrediction.prediction_status || 'analyzed',
                        statusClass: this.mapStatusToClass(latestPrediction.prediction_status),
                        riskScore: latestPrediction.spoilage_probability || 50,
                        confidenceScore: latestPrediction.confidence_score || 75,
                        sensors: {
                            temperature: `${latestPrediction.temperature || latestPrediction.tempValue || 0}°C`,
                            humidity: `${latestPrediction.humidity || latestPrediction.humidityValue || 0}%`,
                            gas: `${latestPrediction.gas_level || latestPrediction.gasValue || 0} ppm`
                        },
                        expiryDate: latestPrediction.expiration_date || null,
                        expiryStatus: 'Unknown',
                        daysLeft: 0,
                        recommendations: parsedRecommendations,
                        createdAt: latestPrediction.created_at || this.formatPhilippineDate(new Date())
                    };
                    
                    console.log('🔍 Converted SmartSense Scanner data:', this.latestScanData);
                    this.renderLatestScanResult();
                    return;
                }
            }
            
            // If no SmartSense Scanner data, show no data
            console.log('🔍 No SmartSense Scanner data found in localStorage');
            this.renderNoData();
            
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            this.renderError();
        }
    }

    /**
     * Map SmartSense Scanner status to CSS class
     */
    mapStatusToClass(status) {
        if (!status) return 'unknown';
        const statusLower = String(status).toLowerCase();
        console.log('🔍 Mapping status to class:', status, '→', statusLower);
        
        if (statusLower.includes('safe') || statusLower.includes('fresh')) return 'safe';
        if (statusLower.includes('unsafe') || statusLower.includes('spoiled')) return 'danger';
        if (statusLower.includes('caution') || statusLower.includes('risk') || statusLower.includes('at risk')) return 'warning';
        return 'unknown';
    }

    /**
     * Parse recommendations from SmartSense Scanner data
     */
    parseRecommendations(recommendations) {
        if (!recommendations) return ['No recommendations available'];
        
        console.log('🔍 parseRecommendations input:', recommendations);
        console.log('🔍 parseRecommendations type:', typeof recommendations);
        
        try {
            console.log('🔍 Parsing recommendations:', recommendations);
            
            // Handle string format (JSON)
            if (typeof recommendations === 'string') {
                const parsed = JSON.parse(recommendations);
                console.log('🔍 Parsed JSON recommendations:', parsed);
                
                // Smart Scanner format: { main: "...", details: [...] }
                if (parsed && typeof parsed === 'object' && parsed.details && Array.isArray(parsed.details)) {
                    // Return structured format instead of flattening
                    const result = {
                        main: parsed.main,
                        details: parsed.details
                    };
                    console.log('🔍 Smart Scanner format detected (structured):', result);
                    return result;
                }
                
                // Array format
                if (Array.isArray(parsed)) {
                    console.log('🔍 Array format detected:', parsed);
                    return parsed;
                }
            }
            
            // Handle object format directly
            if (typeof recommendations === 'object' && !Array.isArray(recommendations)) {
                console.log('🔍 Object format detected:', recommendations);
                
                // Smart Scanner format: { main: "...", details: [...] }
                if (recommendations.details && Array.isArray(recommendations.details)) {
                    const result = {
                        main: recommendations.main,
                        details: recommendations.details
                    };
                    console.log('🔍 Smart Scanner object format (structured):', result);
                    return result;
                }
                
                // Handle other object formats - convert to string
                if (recommendations.main) {
                    console.log('🔍 Object with main property:', recommendations.main);
                    return [recommendations.main];
                }
                
                // Fallback: convert entire object to string
                console.log('🔍 Converting object to string:', recommendations);
                return [JSON.stringify(recommendations)];
            }
            
            // Handle array format directly
            if (Array.isArray(recommendations)) {
                console.log('🔍 Direct array format:', recommendations);
                return recommendations;
            }
            
            // Fallback to string
            console.log('🔍 Fallback to string:', String(recommendations));
            return [String(recommendations)];
            
        } catch (e) {
            console.error('❌ Error parsing recommendations:', e);
            return [String(recommendations)];
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
        
        // Format the scan date in Philippine time
        const scanDate = this.formatPhilippineDate(data.createdAt);

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
                <button class="view-recommendations-btn" onclick="console.log('🔍 View button clicked'); if (window.latestScanManager) { window.latestScanManager.showRecommendations(); } else { console.error('❌ latestScanManager not available'); alert('System not ready. Please refresh the page.'); }">
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
        console.log('🔍 showRecommendations called');
        console.log('🔍 latestScanData:', this.latestScanData);
        
        if (!this.latestScanData) {
            console.error('❌ No scan data available');
            alert('No scan data available. Please try refreshing the page.');
            return;
        }

        if (!this.latestScanData.recommendations || this.latestScanData.recommendations.length === 0) {
            console.error('❌ No recommendations available');
            console.log('🔍 Recommendations:', this.latestScanData.recommendations);
            alert('No recommendations available for this scan result.');
            return;
        }
        
        console.log('✅ Opening recommendations modal');

        // Use the existing modal instead of creating a new one
        const modal = document.getElementById('foodRecommendationsModal');
        if (!modal) {
            console.error('❌ Recommendations modal not found');
            alert('Modal not found. Please refresh the page.');
            return;
        }

        // Update modal content with current scan data
        this.updateModalContent();
        
        // Show the existing modal
        modal.style.display = 'flex';
        modal.classList.add('show');
        
        // Prevent body scroll when modal is open
        document.body.classList.add('modal-open');
    }

    /**
     * Update modal content with current scan data
     */
    updateModalContent() {
        const recommendations = this.latestScanData.recommendations;
        const foodName = this.latestScanData.name || 'Unknown Food';
        
        console.log('🔍 Recommendations in updateModalContent:', recommendations);
        console.log('🔍 Recommendations type:', typeof recommendations);
        
        // Handle structured format (Smart Scanner) vs array format
        let mainRecommendation = '';
        let detailRecommendations = [];
        
        if (recommendations && typeof recommendations === 'object' && !Array.isArray(recommendations)) {
            // Structured format: { main: "...", details: [...] }
            mainRecommendation = recommendations.main || '';
            detailRecommendations = Array.isArray(recommendations.details) ? recommendations.details : [];
            console.log('🔍 Structured format detected - main:', mainRecommendation, 'details:', detailRecommendations);
        } else if (Array.isArray(recommendations)) {
            // Array format: ["rec1", "rec2", ...]
            mainRecommendation = recommendations[0] || '';
            detailRecommendations = recommendations.slice(1);
            console.log('🔍 Array format detected - main:', mainRecommendation, 'details:', detailRecommendations);
        } else {
            // Fallback
            mainRecommendation = String(recommendations || 'No recommendations available');
            detailRecommendations = [];
        }
        
        // Update the existing modal content
        this.updateExistingModalContent(foodName, mainRecommendation, detailRecommendations);
    }

    /**
     * Update existing modal content
     */
    updateExistingModalContent(foodName, mainRecommendation, detailRecommendations) {
        // Update food name
        const foodNameElement = document.getElementById('detailFoodName');
        if (foodNameElement) {
            foodNameElement.textContent = foodName;
        }

        // Update category
        const categoryElement = document.getElementById('detailCategory');
        if (categoryElement) {
            categoryElement.textContent = this.latestScanData.category || 'Unknown';
        }

        // Update created date
        const createdElement = document.getElementById('detailCreated');
        if (createdElement) {
            createdElement.textContent = `Created: ${this.formatPhilippineDate(this.latestScanData.createdAt)}`;
        }

        // Update status badge
        const statusBadge = document.getElementById('detailStatusBadge');
        if (statusBadge) {
            statusBadge.textContent = this.latestScanData.status;
            statusBadge.className = 'detail-status-badge';
            if (this.latestScanData.status === 'Safe') {
                statusBadge.classList.add('safe');
            } else if (this.latestScanData.status === 'At Risk') {
                statusBadge.classList.add('at-risk');
            } else if (this.latestScanData.status === 'Spoiled') {
                statusBadge.classList.add('spoiled');
            }
        }

        // Update risk score
        const riskScoreElement = document.getElementById('detailRiskScore');
        if (riskScoreElement) {
            riskScoreElement.textContent = `Risk: ${this.latestScanData.riskScore}%`;
        }

        // Update recommendations list
        const recommendationsList = document.getElementById('recommendationsList');
        if (recommendationsList) {
            recommendationsList.innerHTML = '';
            
            // Add main recommendation if available
            if (mainRecommendation) {
                const mainRecItem = document.createElement('div');
                mainRecItem.className = 'recommendation-item';
                mainRecItem.innerHTML = `
                    <div class="recommendation-icon">⚠️</div>
                    <div class="recommendation-content">
                        <div class="recommendation-title">Primary Recommendation</div>
                        <div class="recommendation-text">${mainRecommendation}</div>
                                        </div>
                `;
                recommendationsList.appendChild(mainRecItem);
            }

            // Add detail recommendations
            detailRecommendations.forEach((detail, index) => {
                                                const detailText = typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
                const detailItem = document.createElement('div');
                detailItem.className = 'recommendation-item';
                detailItem.innerHTML = `
                    <div class="recommendation-icon">${index + 1}</div>
                    <div class="recommendation-content">
                        <div class="recommendation-title">Action ${index + 1}</div>
                        <div class="recommendation-text">${detailText}</div>
            </div>
        `;
                recommendationsList.appendChild(detailItem);
            });
        }

        // Update sensor details
        const sensorGrid = document.getElementById('sensorDetailsGrid');
        if (sensorGrid) {
            sensorGrid.innerHTML = '';
            
            const sensors = [
                { label: 'Temperature', value: this.latestScanData.sensors?.temperature || 'N/A', status: 'good', statusText: 'Optimal' },
                { label: 'Humidity', value: this.latestScanData.sensors?.humidity || 'N/A', status: 'good', statusText: 'Good' },
                { label: 'Gas Level', value: this.latestScanData.sensors?.gas || 'N/A', status: 'good', statusText: 'Normal' }
            ];

            sensors.forEach(sensor => {
                const item = document.createElement('div');
                item.className = 'sensor-detail-item';
                item.innerHTML = `
                    <div class="sensor-detail-label">${sensor.label}</div>
                    <div class="sensor-detail-value">${sensor.value}</div>
                    <div class="sensor-detail-status ${sensor.status}">${sensor.statusText}</div>
                `;
                sensorGrid.appendChild(item);
            });
        }
    }

    /**
     * Close recommendations modal
     */
    closeRecommendations() {
        const modal = document.getElementById('foodRecommendationsModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
            
            // Re-enable body scroll when modal is closed
            document.body.classList.remove('modal-open');
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
