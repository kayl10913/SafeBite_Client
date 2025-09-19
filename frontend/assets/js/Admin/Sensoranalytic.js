// Sensor Analytics API - Connected to Database
class SensorAnalyticsAPI {
    constructor() {
        this.baseURL = (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '') + '/api/sensor-analytics';
        this.currentFilters = {
            nameSearch: '',
            startDate: '',
            endDate: '',
            testerType: 'All Types',
            sensorType: 'All Types',
            status: 'All Status'
        };
        this.data = {
            summary: null,
            detailed: null
        };
        this.authToken = null;
        
        // Initialize with authentication and real data from database
        this.initializeData();
    }

    // Get authentication token
    getAuthToken() {
        if (!this.authToken) {
            this.authToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
        }
        return this.authToken;
    }

    // Check if user is authenticated
    checkAuth() {
        const token = this.getAuthToken();
        if (!token) {
            console.error('No authentication token found');
            // Redirect to login if no token
            if (window.location.pathname.includes('admin-dashboard')) {
                window.location.href = '/admin-login';
            } else {
                window.location.href = '/login';
            }
            return false;
        }
        return true;
    }

    // Initialize data with real data from database
    async initializeData() {
        try {
            if (!this.checkAuth()) return;
            await this.fetchDetailedData();
            await this.fetchSummaryData();
        } catch (error) {
            console.error('Error initializing data:', error);
            this.data.detailed = [];
            this.data.summary = { summary: { totalSensors: 0, activeTesters: 0, spoilageAlerts: 0, inactiveUsers: 0 }, sensorTypes: [], testerTypes: [] };
        }
    }

    // Get total sensor count
    getSensorCount() {
        return this.data.detailed ? this.data.detailed.length : 0;
    }

    // Get filtered sensor count
    getFilteredSensorCount() {
        const filteredData = this.applyFilters(this.data.detailed, this.currentFilters);
        return filteredData.length;
    }

    // Fetch summary data from database
    async fetchSummaryData() {
        try {
            if (!this.checkAuth()) return { summary: { totalSensors: 0, activeTesters: 0, spoilageAlerts: 0, inactiveUsers: 0 }, sensorTypes: [], testerTypes: [] };
            
            const response = await fetch(`${this.baseURL}/summary`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Authentication failed - redirecting to login');
                    window.location.href = '/admin-login';
                    return { summary: { totalSensors: 0, activeTesters: 0, spoilageAlerts: 0, inactiveUsers: 0 }, sensorTypes: [], testerTypes: [] };
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success && result.data) {
                this.data.summary = result.data;
                console.log('Summary data fetched from database:', this.data.summary);
                return this.data.summary;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching summary data:', error);
            return { summary: { totalSensors: 0, activeTesters: 0, spoilageAlerts: 0, inactiveUsers: 0 }, sensorTypes: [], testerTypes: [] };
        }
    }

    // Fetch detailed data from database
    async fetchDetailedData(filters = {}) {
        try {
            if (!this.checkAuth()) return [];
            
            const queryParams = new URLSearchParams(filters);
            const response = await fetch(`${this.baseURL}/detailed?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Authentication failed - redirecting to login');
                    window.location.href = '/admin-login';
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success && result.data) {
                this.data.detailed = result.data;
                console.log('Detailed data fetched from database:', this.data.detailed);
                return this.data.detailed;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching detailed data:', error);
            return [];
        }
    }

    // Get current data (for compatibility)
    async getCurrentData() {
        if (!this.data.detailed) {
            await this.fetchDetailedData();
        }
        return this.data.detailed || [];
    }

    // Search food testers by name in database
    async searchFoodTesters(searchTerm) {
        try {
            if (!this.checkAuth()) return [];
            
            const response = await fetch(`${this.baseURL}/search?name=${encodeURIComponent(searchTerm)}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Authentication failed - redirecting to login');
                    window.location.href = '/admin-login';
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success && result.data) {
                return result.data;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error searching food testers:', error);
            return [];
        }
    }

    // Handle name search (for compatibility with connector)
    async handleNameSearch(searchTerm) {
        try {
            if (!searchTerm || searchTerm.trim() === '') {
                return await this.getCurrentData();
            }
            
            return await this.searchFoodTesters(searchTerm);
        } catch (error) {
            console.error('Error searching food testers:', error);
            // Fallback to local search
            return this.searchMockData(searchTerm);
        }
    }

    // Handle filter changes (for compatibility with connector)
    async handleFilterChange(filterType, value) {
        try {
            this.currentFilters[filterType] = value;
            const filteredData = this.applyFilters(this.data.detailed, this.currentFilters);
            return filteredData;
        } catch (error) {
            console.error('Error applying filter:', error);
            return this.data.detailed || [];
        }
    }

    // Handle clear filters (for compatibility with connector)
    async handleClearFilters() {
        try {
            this.currentFilters = {
                nameSearch: '',
                startDate: '',
                endDate: '',
                testerType: 'All Types',
                sensorType: 'All Types',
                status: 'All Status'
            };
            return await this.getCurrentData();
        } catch (error) {
            console.error('Error clearing filters:', error);
            return this.data.detailed || [];
        }
    }

    // Get sensor statistics from database
    async getSensorStats() {
        try {
            if (!this.checkAuth()) return { totalSensors: 0, activeSensors: 0, averageReadings: 0, lastUpdate: new Date().toISOString() };
            
            const response = await fetch(`${this.baseURL}/stats`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Authentication failed - redirecting to login');
                    window.location.href = '/admin-login';
                    return { totalSensors: 0, activeSensors: 0, averageReadings: 0, lastUpdate: new Date().toISOString() };
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success && result.data) {
                return result.data;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching sensor stats:', error);
            return { totalSensors: 0, activeSensors: 0, averageReadings: 0, lastUpdate: new Date().toISOString() };
        }
    }

    // Update filters
    updateFilters(newFilters) {
        this.currentFilters = { ...this.currentFilters, ...newFilters };
        return this.currentFilters;
    }

    // Apply filters to data
    applyFilters(data, filters) {
        if (!data) return [];
        
        return data.filter(item => {
            // Name search filter
            if (filters.nameSearch && filters.nameSearch.trim() !== '') {
                const searchTerm = filters.nameSearch.toLowerCase();
                const fullName = `${item.foodTester || ''}`.toLowerCase();
                if (!fullName.includes(searchTerm)) {
                    return false;
                }
            }

            // Date range filters
            if (filters.startDate && item.lastPing) {
                const startDate = new Date(filters.startDate);
                const itemDate = new Date(item.lastPing);
                if (itemDate < startDate) {
                    return false;
                }
            }

            if (filters.endDate && item.lastPing) {
                const endDate = new Date(filters.endDate);
                const itemDate = new Date(item.lastPing);
                if (itemDate > endDate) {
                    return false;
                }
            }

            // Tester type filter
            if (filters.testerType && filters.testerType !== 'All Types' && item.type !== filters.testerType) {
                return false;
            }

            // Status filter
            if (filters.status && filters.status !== 'All Status' && item.status !== filters.status) {
                return false;
            }

            return true;
        });
    }

    // Export to CSV
    exportToCSV(data) {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = ['Food Tester', 'Type', 'Status', 'Last Ping', 'Last Reading', 'Alerts Today'];
        const csvContent = [
            headers.join(','),
            ...data.map(item => [
                `"${item.foodTester || ''}"`,
                `"${item.type || ''}"`,
                `"${item.status || ''}"`,
                `"${item.lastPing || ''}"`,
                `"${item.lastReading || ''}"`,
                item.alertsToday || 0
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `food_tester_analytics_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Export to PDF
    async exportToPDF(data) {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }

        try {
            // Simple PDF generation using jsPDF
            if (typeof jsPDF === 'undefined') {
                alert('PDF export requires jsPDF library. Please install it first.');
                return;
            }

            const { jsPDF } = window.jsPDF;
            const doc = new jsPDF();

            // Add title
            doc.setFontSize(18);
            doc.text('Food Tester Analytics Report', 20, 20);

            // Add date
            doc.setFontSize(12);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);

            // Add table headers
            const headers = ['Food Tester', 'Type', 'Status', 'Last Ping', 'Last Reading', 'Alerts'];
            let yPosition = 50;

            doc.setFontSize(10);
            headers.forEach((header, index) => {
                doc.text(header, 20 + (index * 30), yPosition);
            });

            // Add data rows
            yPosition += 10;
            data.forEach((item, rowIndex) => {
                if (yPosition > 280) {
                    doc.addPage();
                    yPosition = 20;
                }

                const rowData = [
                    item.foodTester || '',
                    item.type || '',
                    item.status || '',
                    item.lastPing ? new Date(item.lastPing).toLocaleDateString() : '',
                    item.lastReading || '',
                    item.alertsToday || 0
                ];

                rowData.forEach((cellData, colIndex) => {
                    const text = String(cellData).substring(0, 15); // Limit text length
                    doc.text(text, 20 + (colIndex * 30), yPosition);
                });

                yPosition += 7;
            });

            // Save the PDF
            doc.save(`food_tester_analytics_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    // Mock data removed
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SensorAnalyticsAPI;
} else {
    window.SensorAnalyticsAPI = SensorAnalyticsAPI;
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (startDateInput) {
        startDateInput.addEventListener('change', function() {
            const startDate = startDateInput.value;
            if (window.sensorAnalyticsAPI) {
                sensorAnalyticsAPI.handleFilterChange('startDate', startDate).then(filteredData => {
                    // Call your function to update the table/display with filteredData
                    if (typeof renderSensorAnalyticsTable === 'function') {
                        renderSensorAnalyticsTable(filteredData);
                    }
                });
            }
        });
    }

    if (endDateInput) {
        endDateInput.addEventListener('change', function() {
            const endDate = endDateInput.value;
            if (window.sensorAnalyticsAPI) {
                sensorAnalyticsAPI.handleFilterChange('endDate', endDate).then(filteredData => {
                    // Call your function to update the table/display with filteredData
                    if (typeof renderSensorAnalyticsTable === 'function') {
                        renderSensorAnalyticsTable(filteredData);
                    }
                });
            }
        });
    }
}); 