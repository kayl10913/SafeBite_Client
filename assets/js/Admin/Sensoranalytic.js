// Sensor Analytics API - Connected to Database
class SensorAnalyticsAPI {
    constructor() {
        this.baseURL = '/api/sensor-analytics';
        this.currentFilters = {
            nameSearch: '',
            startDate: '',
            endDate: '',
            testerType: 'All Types',
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
            if (window.location.pathname.includes('admin-dashboard') || window.location.pathname.endsWith('/pages/ad-dashboard.html')) {
                window.location.href = '/pages/Admin-Login.html';
            } else {
                window.location.href = '/pages/Login.html';
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
                    window.location.href = '/pages/Admin-Login.html';
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
                    window.location.href = '/pages/Admin-Login.html';
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
                    window.location.href = '/pages/Admin-Login.html';
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
                    window.location.href = '/pages/Admin-Login.html';
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
            // Ensure jsPDF is available (handle UMD: window.jspdf.jsPDF)
            const ensurePdfLib = async () => {
                const loadScript = (src) => new Promise((resolve, reject) => {
                    if ([...document.getElementsByTagName('script')].some(s => s.src === src)) return resolve();
                    const sc = document.createElement('script');
                    sc.src = src; sc.async = true; sc.onload = resolve; sc.onerror = () => reject(new Error('Failed to load '+src));
                    document.head.appendChild(sc);
                });
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
                }
                return !!(window.jspdf && window.jspdf.jsPDF);
            };

            const ok = await ensurePdfLib();
            if (!ok) { alert('PDF export libraries not available. Please try again.'); return; }

            // Ensure autotable for better table layout
            const ensureAutoTable = async () => {
                const has = !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
                if (!has) {
                    await new Promise((resolve, reject) => {
                        const src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js';
                        if ([...document.getElementsByTagName('script')].some(s => s.src === src)) return resolve();
                        const sc = document.createElement('script'); sc.src = src; sc.async = true; sc.onload = resolve; sc.onerror = () => reject(new Error('Failed to load autotable'));
                        document.head.appendChild(sc);
                    });
                }
                return !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
            };
            const autoOk = await ensureAutoTable();
            if (!autoOk) { alert('PDF table plugin not available.'); return; }

            const JsPDFCtor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : (window.jsPDF && window.jsPDF.jsPDF);
            if (!JsPDFCtor) { alert('jsPDF not initialized.'); return; }

			const doc = new JsPDFCtor({ orientation: 'landscape', unit: 'pt', format: 'A4', compress: true });

			// SafeBite-style header bar
			doc.setFillColor(74, 158, 255);
			doc.rect(0, 0, doc.internal.pageSize.width, 80, 'F');
			doc.setTextColor(255, 255, 255);
			doc.setFontSize(24); doc.setFont('helvetica', 'bold');
			doc.text('SafeBite', 40, 35);
			doc.setFontSize(18); doc.setFont('helvetica', 'normal');
			doc.text('Sensor Analytics Report', 40, 55);

			// Metadata box
			doc.setTextColor(0,0,0);
			doc.setFillColor(248, 249, 250);
			doc.rect(40, 100, doc.internal.pageSize.width - 80, 60, 'F');
			doc.setDrawColor(200, 200, 200);
			doc.rect(40, 100, doc.internal.pageSize.width - 80, 60, 'S');
			doc.setFontSize(10); doc.setFont('helvetica', 'bold');
			const genDate = new Date();
			doc.text(`Report Generated: ${genDate.toLocaleDateString()} at ${genDate.toLocaleTimeString()}`, 50, 120);
			doc.text(`Total Records: ${data.length}`, 50, 135);

            // Prepare table data
            const head = [['Food Tester', 'Type', 'Status', 'Last Ping', 'Last Reading', 'Alerts']];
            const body = data.map(item => [
                String(item.foodTester || ''),
                String(item.type || ''),
                String(item.status || ''),
                item.lastPing ? new Date(item.lastPing).toLocaleDateString() : '—',
                String(item.lastReading || '—'),
                String(item.alertsToday || 0)
            ]);

			const pageWidth = doc.internal.pageSize.width;
			const marginLeft = 40;
			const marginRight = 40;
			const availableWidth = pageWidth - marginLeft - marginRight;
			const colWidths = {
				0: Math.floor(availableWidth * 0.22), // Food Tester
				1: Math.floor(availableWidth * 0.12), // Type
				2: Math.floor(availableWidth * 0.12), // Status
				3: Math.floor(availableWidth * 0.18), // Last Ping
				4: Math.floor(availableWidth * 0.26), // Last Reading
				5: Math.floor(availableWidth * 0.10)  // Alerts
			};

            // Render table with autotable
            doc.autoTable({
                head,
                body,
				startY: 180,
                margin: { left: marginLeft, right: marginRight },
				styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'middle', lineColor: [200,200,200], lineWidth: 0.5 },
				headStyles: { fillColor: [74,158,255], textColor: 255, fontStyle: 'bold', halign: 'center' },
				alternateRowStyles: { fillColor: [248, 249, 250] },
                columnStyles: {
                    0: { cellWidth: colWidths[0] },
                    1: { cellWidth: colWidths[1], halign: 'center' },
                    2: { cellWidth: colWidths[2], halign: 'center' },
                    3: { cellWidth: colWidths[3], halign: 'center' },
                    4: { cellWidth: colWidths[4] },
                    5: { cellWidth: colWidths[5], halign: 'center' }
                },
                didDrawPage: function (dataHook) {
                    doc.setFontSize(9); doc.setTextColor(120);
                    doc.text(`Page ${dataHook.pageNumber}`, pageWidth - 80, doc.internal.pageSize.height - 20);
                }
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