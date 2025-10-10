// User Sensor Analytics - Handles real-time sensor analytics for user role
class UserSensorAnalytics {
    constructor() {
        this.analyticsData = null;
        this.isInitialized = false;
    }

    // Initialize the analytics
    async init() {
        try {
            await this.fetchAnalyticsData();
            this.updateAnalyticsDisplay();
            this.isInitialized = true;
            
            // Set up auto-refresh every 30 seconds
            setInterval(() => {
                this.fetchAnalyticsData();
                this.updateAnalyticsDisplay();
            }, 30000);
            
        } catch (error) {
            console.error('Error initializing user sensor analytics:', error);
        }
    }

    // Fetch analytics data from API
    async fetchAnalyticsData() {
        try {
            const sessionToken = localStorage.getItem('jwt_token') || 
                               localStorage.getItem('sessionToken') || 
                               localStorage.getItem('session_token');
            
            if (!sessionToken) {
                console.error('No session token found - redirecting to login');
                window.location.href = '/pages/Login.html';
                return;
            }

            const response = await fetch('/api/users/sensor-analytics', {
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Authentication required - user not logged in');
                    window.location.href = '/pages/Login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                this.analyticsData = result.data;
                console.log('Analytics data fetched:', this.analyticsData);
            } else {
                console.error('Failed to fetch analytics data:', result);
                this.analyticsData = null;
            }
        } catch (error) {
            console.error('Error fetching analytics data:', error);
            this.analyticsData = null;
        }
    }

    // Update the analytics display with real data
    updateAnalyticsDisplay() {
        if (!this.analyticsData) return;

        // Update stat cards
        this.updateStatCard('Total Sensors', this.analyticsData.totalSensors);
        this.updateStatCard('Active Testers', this.analyticsData.activeTesters);
        this.updateStatCard('Spoilage Alert', this.analyticsData.spoilageAlerts);
        this.updateStatCard('Inactive', this.analyticsData.inactive);

        // Update sensor activity summary
        this.updateSensorActivitySummary();
        
        // Update tester type breakdown
        this.updateTesterTypeBreakdown();
    }

    // Update individual stat card
    updateStatCard(label, value) {
        const statCards = document.querySelectorAll('.spoilage-stat-card');
        statCards.forEach(card => {
            const labelElement = card.querySelector('.stat-label');
            const valueElement = card.querySelector('.stat-value');
            
            if (labelElement && labelElement.textContent === label && valueElement) {
                valueElement.textContent = value;
            }
        });
    }

    // Update sensor activity summary
    updateSensorActivitySummary() {
        if (!this.analyticsData.sensorActivity || !this.analyticsData.sensorActivity.length) return;

        const summaryList = document.querySelector('.spoilage-summary-list');
        if (!summaryList) return;

        summaryList.innerHTML = '';

        // Display sensor activity data
        this.analyticsData.sensorActivity.forEach(sensor => {
            const summaryRow = document.createElement('div');
            summaryRow.className = 'summary-row';
            
            const percentageClass = sensor.percentage >= 80 ? 'bar-red' : '';
            
            summaryRow.innerHTML = `
                <span class="summary-label">${sensor.type} Sensors</span>
                <span class="summary-desc">${sensor.active} users actively using</span>
                <span class="summary-rate ${percentageClass}">${sensor.percentage}%</span>
            `;
            
            summaryList.appendChild(summaryRow);
        });

        // Update total overview
        const totalOverview = document.querySelector('.summary-total-right');
        if (totalOverview) {
            const totalActive = this.analyticsData.sensorActivity.reduce((sum, sensor) => sum + sensor.active, 0);
            const totalSensors = this.analyticsData.sensorActivity.reduce((sum, sensor) => sum + sensor.total, 0);
            totalOverview.textContent = `${totalActive} out of ${totalSensors} sensors active`;
        }
    }

    // Update tester type breakdown
    updateTesterTypeBreakdown() {
        if (!this.analyticsData.testerTypeBreakdown || !this.analyticsData.testerTypeBreakdown.length) return;

        const barList = document.querySelector('.spoilage-bar-list');
        if (!barList) return;

        barList.innerHTML = '';

        // Display tester type breakdown
        this.analyticsData.testerTypeBreakdown.forEach(testerType => {
            const barRow = document.createElement('div');
            barRow.className = 'spoilage-bar-row';
            
            const barClass = testerType.percentage >= 50 ? 'bar-red' : '';
            
            barRow.innerHTML = `
                <span class="bar-label">${testerType.type}</span>
                <div class="bar-bg">
                    <div class="bar-fill ${barClass}" style="width:${testerType.percentage}%"></div>
                </div>
                <span class="bar-value">${testerType.count} users (${testerType.percentage}%)</span>
            `;
            
            barList.appendChild(barRow);
        });
    }

    // Get current analytics data
    getCurrentData() {
        return this.analyticsData;
    }

    // Check if analytics is working
    checkStatus() {
        return {
            isInitialized: this.isInitialized,
            hasData: this.analyticsData !== null,
            dataTimestamp: this.analyticsData ? new Date().toISOString() : null
        };
    }
}

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the analytics summary page
    const analyticsTemplate = document.getElementById('analytics-summary-template');
    if (analyticsTemplate) {
        // Create global instance
        window.userSensorAnalytics = new UserSensorAnalytics();
        
        // Initialize when the analytics summary is shown
        const originalShowAnalyticsSummary = window.showAnalyticsSummary;
        window.showAnalyticsSummary = function() {
            const mainContent = document.getElementById('main-content');
            const template = document.getElementById('analytics-summary-template');
            if (mainContent && template) {
                mainContent.innerHTML = template.innerHTML;
                
                // Initialize analytics after content is loaded
                if (window.userSensorAnalytics) {
                    setTimeout(() => {
                        window.userSensorAnalytics.init();
                    }, 100);
                }
            }
        };
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserSensorAnalytics;
} else {
    window.UserSensorAnalytics = UserSensorAnalytics;
}
