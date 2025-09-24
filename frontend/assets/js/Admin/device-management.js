// Device Management JavaScript
// Handles device management functionality and data operations

class DeviceManagementManager {
    constructor() {
        this.currentPage = 'device-management';
        this.deviceData = [];
        this.equipmentData = [];
        this.filteredData = [];
        this.filtersActive = false;
        this.pageIndex = 0;
        this.pageSize = 25;
        this.listenersBound = false;
        this.delegatedBound = false;
        this.init();
    }

    applyInlineFilters() {
        const type = (document.getElementById('dfType')?.value || '').trim();
        const status = (document.getElementById('dfStatus')?.value || '').trim();
        const user = (document.getElementById('dfSearch')?.value || '').trim().toLowerCase();
        const filtered = this.deviceData.filter(d => {
            const matchType = !type || d.deviceType === type;
            const matchStatus = !status || (String(d.status || '').toUpperCase() === String(status).toUpperCase());
            const userField = `${d.userUsername || ''} ${d.userEmail || ''} ${d.name || ''}`.toLowerCase();
            const matchUser = !user || userField.includes(user);
            return matchType && matchStatus && matchUser; // Date range removed
        });
        this.filteredData = filtered;
        this.filtersActive = true;
        this.pageIndex = 0;
        this.renderPage();
    }

    renderFilteredActivities(list) {
        const tbody = document.getElementById('deviceActivitiesTableBody');
        if (!tbody) return;
        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan=\"6\" style=\"text-align:center;\"><div class=\"no-data-wrap\"><div class=\"no-data-icon\">📄</div><div class=\"no-data-text\">No data available.</div></div></td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(device => `
            <tr>
                <td>${device.id}</td>
                <td>${device.name}</td>
                <td>${device.location}</td>
                <td>${device.deviceType}</td>
                <td><span class="status-badge ${this.getStatusClass(device.status)}">${device.status}</span></td>
                <td><button class="device-action-btn ${device.status === 'OFFLINE' ? 'emergency' : ''}">${this.getActionText(device.status)}</button></td>
            </tr>
        `).join('');
    }

    getMaxPageIndex() {
        const total = (this.filteredData && this.filteredData.length) ? this.filteredData.length : this.deviceData.length;
        return Math.max(0, Math.ceil(total / this.pageSize) - 1);
    }

    renderPage() {
        const data = this.filtersActive ? (this.filteredData || []) : this.deviceData;
        const start = this.pageIndex * this.pageSize;
        const end = start + this.pageSize;
        const page = data.slice(start, end);
        this.renderFilteredActivities(page);
        const total = data.length;
        const maxIndex = this.getMaxPageIndex();
        // Range label
        const rangeInfo = document.getElementById('dpRangeInfo');
        if (rangeInfo) {
            const from = total === 0 ? 0 : (this.pageIndex * this.pageSize) + 1;
            const to = Math.min((this.pageIndex + 1) * this.pageSize, total);
            rangeInfo.textContent = `Showing ${from} to ${to} of ${total} records`;
        }
        // Numeric page buttons
        const numbers = document.getElementById('dpNumbers');
        if (numbers) {
            numbers.innerHTML = '';
            const pages = Math.max(1, maxIndex + 1);
            for (let i = 0; i < pages; i++) {
                const btn = document.createElement('button');
                btn.className = 'page-btn' + (i === this.pageIndex ? ' active' : '');
                btn.textContent = String(i + 1);
                btn.addEventListener('click', () => { this.pageIndex = i; this.renderPage(); });
                numbers.appendChild(btn);
            }
        }
        const next = document.getElementById('dpNext');
        if (next) {
            const noNext = this.pageIndex >= maxIndex;
            next.disabled = noNext;
            next.style.display = noNext ? 'none' : 'inline-block';
        }
    }
    async init() {
        console.log('📱 Device Management Manager initialized');
        this.setupEventListeners();
        
        try {
            await this.loadDeviceData();
            await this.loadEquipmentData();
            await this.updateStatistics();
            this.populateTables();
            // Render pagination UI (range + numbers) after data loads
            this.filteredData = this.deviceData;
            this.pageIndex = 0;
            this.renderPage();
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.showToast('Device Management initialization failed. Check server connection.');
            this.populateTables(); // Still populate tables with empty state
        }
    }

    setupEventListeners() {
        if (this.listenersBound) {
            return; // Avoid rebinding multiple times when SPA swaps pages
        }
        // Export buttons
        const exportBtn = document.querySelector('.device-management-btn-secondary');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDeviceData());
        }

        // Refresh button
        const refreshBtn = document.querySelector('.device-management-btn-primary');
        if (refreshBtn && refreshBtn.textContent.includes('Refresh')) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Add Device button
        const addDeviceBtn = document.getElementById('addDeviceBtn');
        if (addDeviceBtn) {
            addDeviceBtn.addEventListener('click', () => this.showAddDeviceModal());
        }

        // Action buttons in tables
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('device-action-btn')) {
                this.handleActionClick(e.target);
            }
        });

        // Device Details modal close handlers
        document.addEventListener('click', (e) => {
            if (e.target && (e.target.id === 'closeDeviceDetailsModal' || e.target.id === 'deviceDetailsCloseBtn')) {
                this.hideDeviceDetailsModal();
            }
        });

        // Confirm modal buttons
        document.addEventListener('click', (e) => {
            if (e.target && (e.target.id === 'confirmClose' || e.target.id === 'confirmCancel')) {
                this.hideConfirm();
            }
        });
        const confirmOk = document.getElementById('confirmOk');
        if (confirmOk) {
            confirmOk.addEventListener('click', () => {
                if (this._confirmResolve) this._confirmResolve(true);
                this.hideConfirm();
            });
        }

        // Add Device modal close and save
        ['addDeviceClose','addDeviceCancel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => this.hideAddDeviceModal());
        });
        const addSave = document.getElementById('addDeviceSave');
        if (addSave) addSave.addEventListener('click', () => this.saveNewDevice());

        // Removed Generate button; Sensor ID must be entered manually

        // Inline Filters
        const inlineBtn = document.getElementById('inlineApplyFilters');
        if (inlineBtn) inlineBtn.addEventListener('click', (e) => { e.preventDefault(); this.applyInlineFilters(); });
        // Delegated fallback so click still works after SPA swaps
        document.addEventListener('click', (e) => {
            const t = e.target;
            if (t && t.id === 'inlineApplyFilters') {
                e.preventDefault();
                this.applyInlineFilters();
            }
        });

        // Auto-apply disabled; filtering only happens when clicking the Filter button

        // Date range picker behavior
        const dr = document.getElementById('dfDateRange');
        const dvWrap = document.getElementById('dfDateValueWrap');
        const dv = document.getElementById('dfDateValue');
        if (dr && dv && dvWrap) {
            // Hide date range controls (feature removed for device activities)
            dvWrap.style.display = 'none';
            dr.closest('.form-group') && (dr.closest('.form-group').style.display = 'none');
            dv.value = '';
        }

        // Downloads
        const dlCsv = document.getElementById('downloadCsvBtn');
        if (dlCsv) dlCsv.addEventListener('click', () => this.downloadCurrentAsCSV());
        const dlPdf = document.getElementById('downloadPdfBtn');
        if (dlPdf) dlPdf.addEventListener('click', () => this.downloadCurrentAsPDF());

        // Pagination controls (fancy)
        const next = document.getElementById('dpNext');
        const size = document.getElementById('dfPageSize');
        if (next) next.addEventListener('click', () => { this.pageIndex = Math.min(this.getMaxPageIndex(), this.pageIndex + 1); this.renderPage(); });
        if (size) size.addEventListener('change', (e) => { this.pageSize = Number(e.target.value) || 25; this.pageIndex = 0; this.renderPage(); });

        // Header navigation buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('device-management-btn') && e.target.hasAttribute('data-page')) {
                e.preventDefault();
                const page = e.target.getAttribute('data-page');
                this.switchSubPage(page);
            }
        });

        this.listenersBound = true;

        // Global delegated handlers that survive SPA swaps
        if (!this.delegatedBound) {
            document.addEventListener('click', (e) => {
                const target = e.target;

                // Export button
                const exportBtn = target.closest('.device-management-btn-secondary');
                if (exportBtn) {
                    e.preventDefault();
                    this.exportDeviceData();
                    return;
                }

                // Refresh button
                const refreshBtn = target.closest('.device-management-btn-primary');
                if (refreshBtn && /refresh/i.test((refreshBtn.textContent || '').trim())) {
                    e.preventDefault();
                    this.refreshData();
                    return;
                }

                // Add Device open
                if (target.closest('#addDeviceBtn')) {
                    e.preventDefault();
                    this.showAddDeviceModal();
                    return;
                }

                // Add Device save
                if (target.closest('#addDeviceSave')) {
                    e.preventDefault();
                    this.saveNewDevice();
                    return;
                }

                // Add Device close/cancel
                if (target.closest('#addDeviceClose') || target.closest('#addDeviceCancel')) {
                    e.preventDefault();
                    this.hideAddDeviceModal();
                    return;
                }

                // Inline filter apply
                if (target.closest('#inlineApplyFilters')) {
                    e.preventDefault();
                    this.applyInlineFilters();
                    return;
                }

                // Header navigation buttons with data-page
                const navBtn = target.closest('.device-management-btn[data-page]');
                if (navBtn) {
                    e.preventDefault();
                    const page = navBtn.getAttribute('data-page');
                    this.switchSubPage(page);
                    return;
                }
            });
            this.delegatedBound = true;
        }
    }

    // Public helper to rebind UI listeners after SPA swaps the HTML
    rebindUI() {
        this.setupEventListeners();
        // Reset pagination and refresh data when returning to the page
        this.pageIndex = 0;
        this.filtersActive = false;
        this.filteredData = [];
        // Refresh the data and render the page
        this.refreshData();
    }

    async loadDeviceData() {
        try {
            console.log('🔄 Attempting to fetch device data from /api/device-management/devices');
            const response = await fetch('/api/device-management/devices');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📡 API Response:', result);
            
            if (result.success) {
                this.deviceData = result.data.map(device => {
                    const lastUpdateDate = device.last_update ? new Date(device.last_update) : null;
                    const lastUpdateMs = lastUpdateDate ? lastUpdateDate.getTime() : 0;
                    return {
                    id: `DEV-${device.sensor_id}`,
                    name: device.device_name,
                    type: 'IoT Sensor',
                    deviceId: device.sensor_id,
                    location: device.user_username ? `${device.user_username} (${device.user_email || 'N/A'})` : (device.user_email || 'Unassigned'),
                    userEmail: device.user_email || 'N/A',
                    userUsername: device.user_username || 'N/A',
                    userRole: device.user_role || 'N/A',
                    deviceType: device.device_type,
                    status: device.status,
                        timestamp: lastUpdateDate ? lastUpdateDate.toLocaleDateString() : '',
                        time: lastUpdateDate ? lastUpdateDate.toLocaleTimeString() : '',
                        lastUpdateMs
                    };
                });
                console.log('📊 Device data loaded from database:', this.deviceData.length, 'records from all users');
            } else {
                console.error('❌ API returned error:', result.message);
                this.showToast(`Error loading device data: ${result.message}`);
            }
        } catch (error) {
            console.error('❌ Error fetching device data:', error);
            this.showToast(`Error connecting to server: ${error.message}`);
        }
    }

    async loadEquipmentData() {
        try {
            console.log('🔄 Attempting to fetch equipment data from /api/device-management/devices');
            const response = await fetch('/api/device-management/devices');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📡 Equipment API Response:', result);
            
            if (result.success) {
                this.equipmentData = result.data.map(device => ({
                    id: `IoT-${device.sensor_id}`,
                    name: device.device_name,
                    type: 'Sensor',
                    status: device.status,
                    lastCheck: new Date(device.last_check).toLocaleDateString(),
                    nextService: new Date(device.next_service).toLocaleDateString()
                }));
                console.log('🔧 Equipment data loaded from database:', this.equipmentData.length, 'items');
            } else {
                console.error('❌ Equipment API returned error:', result.message);
                this.showToast(`Error loading equipment data: ${result.message}`);
            }
        } catch (error) {
            console.error('❌ Error fetching equipment data:', error);
            this.showToast(`Error connecting to server: ${error.message}`);
        }
    }

    async updateStatistics() {
        try {
            console.log('🔄 Attempting to fetch statistics from /api/device-management/devices/stats');
            const response = await fetch('/api/device-management/devices/stats');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📡 Stats API Response:', result);
            
            if (!result.success) {
                console.error('❌ Stats API returned error:', result.message);
                this.showToast(`Error loading statistics: ${result.message}`);
            }

            // Regardless of backend response, derive device-level stats from sensors so 1 device = 3 sensors
            const derived = this.computeDeviceStatsFromSensors();
            const statCards = document.querySelectorAll('.device-management-stat-card');
            if (statCards.length >= 4) {
                statCards[0].querySelector('.stat-value').textContent = String(derived.totalDevices);
                statCards[1].querySelector('.stat-value').textContent = String(derived.activeDevices);
                statCards[2].querySelector('.stat-value').textContent = `${derived.healthPct.toFixed(2)}%`;
                statCards[3].querySelector('.stat-value').textContent = String(derived.alerts);
                const alertTrend = statCards[3].querySelector('.stat-trend');
                if (alertTrend) alertTrend.textContent = derived.alerts > 1 ? 'device issues' : '↓ No issues';
                // Trends under totals
                const trend1 = statCards[0].querySelector('.stat-trend');
                if (trend1) trend1.textContent = '↑ 3 sensors';
                const trend2 = statCards[1].querySelector('.stat-trend');
                const pctOnline = derived.totalDevices > 0 ? Math.round((derived.activeDevices/derived.totalDevices)*100) : 0;
                if (trend2) trend2.textContent = `↑ ${pctOnline}% online`;
                const trend3 = statCards[2].querySelector('.stat-trend');
                if (trend3) trend3.textContent = derived.healthPct >= 99.5 ? '↑ All operational' : '↓ Needs attention';
                console.log('📈 Derived Statistics applied:', derived);
            } else {
                console.error('❌ Not enough stat cards found:', statCards.length);
            }
        } catch (error) {
            console.error('❌ Error fetching statistics:', error);
            this.showToast(`Error loading statistics: ${error.message}`);
        }
    }

    // Group sensors per user into devices (Temperature, Humidity, Gas)
    computeDeviceStatsFromSensors() {
        try {
            const byUser = new Map();
            (this.deviceData || []).forEach(s => {
                const key = (s.userUsername || s.userEmail || 'unassigned').toLowerCase();
                if (!byUser.has(key)) byUser.set(key, []);
                byUser.get(key).push(s);
            });

            let totalDevices = 0;
            let activeDevices = 0;
            let deviceIssuesActive = 0;
            byUser.forEach(list => {
                // Track presence of each required type per user
                const types = new Set();
                const statusByType = {};
                list.forEach(s => {
                    const t = String(s.deviceType || '').trim();
                    if (t) types.add(t);
                    statusByType[t] = statusByType[t] || [];
                    statusByType[t].push(String(s.status || '').toUpperCase());
                });
                const hasAll = ['Temperature','Humidity','Gas'].every(t => types.has(t));
                if (hasAll) {
                    totalDevices += 1;
                    const allOnline = ['Temperature','Humidity','Gas'].every(t => (statusByType[t]||[]).every(st => st === 'ONLINE'));
                    if (allOnline) activeDevices += 1;
                }
            });

            // Fetch active device issues from feedbacks: type 'Device Issue' AND status 'Active'
            // Note: keep this synchronous-looking via navigator.sendBeacon fallback when fetch fails
            // but we will try to use fetch synchronously in this derived stat path.
            // If the API call fails, default to 0 without breaking UI.
            const updateAlertsFromFeedbacks = async () => {
                try {
                    const resp = await fetch('/api/feedbacks/type/Device%20Issue');
                    if (!resp.ok) return 0;
                    const json = await resp.json();
                    const rows = Array.isArray(json?.data) ? json.data : [];
                    return rows.filter(r => String(r.status || r.STATUS || '').toLowerCase() === 'active').length;
                } catch { return 0; }
            };

            // Return placeholder first; caller updates stat card after promise resolves
            updateAlertsFromFeedbacks().then(count => {
                const statCards = document.querySelectorAll('.device-management-stat-card');
                if (statCards.length >= 4) {
                    const safeCount = Math.max(0, Number(count) || 0);
                    statCards[3].querySelector('.stat-value').textContent = String(safeCount);
                    const trend = statCards[3].querySelector('.stat-trend');
                    if (trend) trend.textContent = safeCount > 1 ? 'device issues' : '↓ No issues';
                }
            });

            const healthPct = totalDevices > 0 ? (activeDevices / totalDevices) * 100 : 0;
            return { totalDevices, activeDevices, healthPct, alerts: deviceIssuesActive };
        } catch (e) {
            console.error('Failed to compute derived device stats:', e);
            return { totalDevices: 0, activeDevices: 0, healthPct: 0, alerts: 0 };
        }
    }

    populateTables() {
        console.log('🔄 Populating tables...');
        console.log('📊 Device data length:', this.deviceData.length);
        console.log('🔧 Equipment data length:', this.equipmentData.length);
        this.populateDeviceActivitiesTable();
        // Only render status table if the element exists (second card may be removed)
        if (document.getElementById('deviceStatusTableBody')) {
            this.populateDeviceStatusTable();
        } else {
            console.log('ℹ️ Skipping Device Status table (container not present)');
        }
    }

    populateDeviceActivitiesTable() {
        const tbody = document.getElementById('deviceActivitiesTableBody');
        if (!tbody) {
            console.error('❌ deviceActivitiesTableBody not found');
            return;
        }

        if (this.deviceData.length === 0) {
            tbody.innerHTML = `<tr><td colspan=\"6\" style=\"text-align:center;\"><div class=\"no-data-wrap\"><div class=\"no-data-icon\">📄</div><div class=\"no-data-text\">No data available.</div></div></td></tr>`;
            console.log('ℹ️ No device data available');
            return;
        }

        tbody.innerHTML = this.deviceData.map(device => `
            <tr>
                <td>${device.id}</td>
                <td>${device.name}</td>
                <td>${device.location}</td>
                <td>${device.deviceType}</td>
                <td><span class="status-badge ${this.getStatusClass(device.status)}">${device.status}</span></td>
                <td><button class="device-action-btn ${device.status === 'OFFLINE' ? 'emergency' : ''}">${this.getActionText(device.status)}</button></td>
            </tr>
        `).join('');
        
        console.log('📊 Device activities table populated with', this.deviceData.length, 'devices');
    }

    populateDeviceStatusTable() {
        const tbody = document.getElementById('deviceStatusTableBody');
        if (!tbody) {
            console.error('❌ deviceStatusTableBody not found');
            return;
        }

        if (this.equipmentData.length === 0) {
            // Show sample data for testing
            tbody.innerHTML = `
                <tr>
                    <td>IoT-1<br><span class="device-info">Temperature Sensor</span></td>
                    <td><span class="device-type">Sensor</span></td>
                    <td><span class="status-badge status-safe">ONLINE</span></td>
                    <td>${new Date().toLocaleDateString()}</td>
                    <td>${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</td>
                    <td><button class="device-action-btn">Details</button></td>
                </tr>
                <tr>
                    <td>IoT-2<br><span class="device-info">Humidity Sensor</span></td>
                    <td><span class="device-type">Sensor</span></td>
                    <td><span class="status-badge status-safe">ONLINE</span></td>
                    <td>${new Date().toLocaleDateString()}</td>
                    <td>${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</td>
                    <td><button class="device-action-btn">Details</button></td>
                </tr>
                <tr>
                    <td>IoT-3<br><span class="device-info">Gas Sensor</span></td>
                    <td><span class="device-type">Sensor</span></td>
                    <td><span class="status-badge status-safe">ONLINE</span></td>
                    <td>${new Date().toLocaleDateString()}</td>
                    <td>${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</td>
                    <td><button class="device-action-btn">Details</button></td>
                </tr>
            `;
            console.log('🔧 Showing sample equipment data for testing');
            return;
        }

        tbody.innerHTML = this.equipmentData.map(device => `
            <tr>
                <td>${device.id}<br><span class="device-info">${device.name}</span></td>
                <td><span class="device-type">${device.type}</span></td>
                <td><span class="status-badge ${this.getStatusClass(device.status)}">${device.status}</span></td>
                <td>${device.lastCheck}</td>
                <td>${device.nextService}</td>
                <td><button class="device-action-btn ${device.status === 'OFFLINE' ? 'emergency' : ''}">${this.getActionText(device.status)}</button></td>
            </tr>
        `).join('');
        
        console.log('📊 Device status table populated with', this.equipmentData.length, 'devices');
    }

    getStatusClass(status) {
        switch (status) {
            case 'ONLINE': return 'status-safe';
            case 'OFFLINE': return 'status-danger';
            case 'ERROR': return 'status-danger';
            default: return 'status-warning';
        }
    }

    getActionText(status) {
        // All rows use Delete action as requested
        return 'Delete';
    }

    async refreshData() {
        console.log('🔄 Refreshing device management data...');
        await this.loadDeviceData();
        await this.loadEquipmentData();
        await this.updateStatistics();
        this.populateTables();
        // Ensure pagination is rendered after data refresh
        this.renderPage();
        this.showToast('Data refreshed successfully');
    }

    async exportDeviceData() {
        try {
            console.log('📊 Exporting device data...');
            const response = await fetch('/api/device-management/devices/export');
            const result = await response.json();
            
            if (result.success) {
                const csvContent = this.generateCSVFromData(result.data);
                this.downloadCSV(csvContent, 'device-management-data.csv');
                this.showToast('Device data exported successfully');
            } else {
                this.showToast('Error exporting data');
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showToast('Error exporting data');
        }
    }

    generateCSV() {
        const headers = ['Device ID', 'Device Name', 'Location', 'Type', 'Status', 'Last Update'];
        const rows = this.deviceData.map(device => [
            device.id,
            device.name,
            device.location,
            device.deviceType,
            device.status,
            `${device.timestamp} ${device.time}`
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    generateCSVFromData(data) {
        const headers = Object.keys(data[0] || {});
        const rows = data.map(device => Object.values(device));
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    downloadCurrentAsCSV() {
        const data = (this.filteredData && this.filteredData.length) ? this.filteredData : this.deviceData;
        if (!data || data.length === 0) { this.showToast('No data to export'); return; }
        const headers = ['Device ID','Device Name','User','Type','Status','Last Update'];
        const rows = data.map(d => [d.id, d.name, d.location, d.deviceType, d.status, `${d.timestamp} ${d.time}`]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        this.downloadCSV(csv, 'devices.csv');
    }

    downloadCurrentAsPDF() {
        const ensureLibs = async () => {
            const load = (src) => new Promise((res, rej) => {
                if ([...document.getElementsByTagName('script')].some(s => s.src === src)) return res();
                const sc = document.createElement('script'); sc.src = src; sc.async = true; sc.onload = res; sc.onerror = () => rej(new Error('load fail '+src));
                document.head.appendChild(sc);
            });
            if (!window.jspdf || !window.jspdf.jsPDF) {
                await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            }
            if (!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) {
                await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js');
            }
            return !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
        };

        (async () => {
            const ok = await ensureLibs().catch(() => false);
            if (!ok) { this.showToast('PDF libraries unavailable'); return; }

            const JsPDFCtor = window.jspdf.jsPDF;
            const doc = new JsPDFCtor({ orientation: 'landscape', unit: 'pt', format: 'A4', compress: true });

            // Header matching other reports
            doc.setFillColor(74,158,255); doc.rect(0,0,doc.internal.pageSize.width,80,'F');
            doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(24); doc.text('SafeBite',40,35);
            doc.setFont('helvetica','normal'); doc.setFontSize(18); doc.text('Device Activities',40,55);

            // Meta box
            const data = (this.filteredData && this.filteredData.length) ? this.filteredData : this.deviceData;
            doc.setTextColor(0,0,0); doc.setFillColor(248,249,250);
            doc.rect(40,100,doc.internal.pageSize.width-80,60,'F');
            doc.setDrawColor(200,200,200); doc.rect(40,100,doc.internal.pageSize.width-80,60,'S');
            doc.setFont('helvetica','bold'); doc.setFontSize(10);
            const now = new Date();
            doc.text(`Report Generated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`,50,120);
            doc.text(`Total Records: ${data.length}`,50,135);

            // Table
            const head = [['Device ID','Device Name','User','Type','Status','Last Update']];
            const body = data.map(d => [d.id, d.name, d.location, d.deviceType, d.status, `${d.timestamp} ${d.time}`]);
            const pageWidth = doc.internal.pageSize.width;
            const ml=40,mr=40; const avail=pageWidth-ml-mr;
            const colW={0:avail*0.12,1:avail*0.22,2:avail*0.22,3:avail*0.12,4:avail*0.12,5:avail*0.20};
            doc.autoTable({
                head, body, startY:180, margin:{left:ml,right:mr},
                styles:{fontSize:9,cellPadding:5,overflow:'linebreak',valign:'middle',lineColor:[200,200,200],lineWidth:0.5},
                headStyles:{fillColor:[74,158,255],textColor:255,fontStyle:'bold',halign:'center'},
                alternateRowStyles:{fillColor:[248,249,250]},
                columnStyles:{
                    0:{cellWidth:colW[0]},1:{cellWidth:colW[1]},2:{cellWidth:colW[2]},
                    3:{cellWidth:colW[3],halign:'center'},4:{cellWidth:colW[4],halign:'center'},5:{cellWidth:colW[5]}
                },
                didDrawPage:(h)=>{ doc.setFontSize(9); doc.setTextColor(120); doc.text(`Page ${h.pageNumber}`, pageWidth-80, doc.internal.pageSize.height-20); }
            });

            doc.save('device-activities.pdf');
        })();
    }

    handleActionClick(button) {
        const action = button.textContent.trim();
        const row = button.closest('tr');
        const deviceId = row.querySelector('td:first-child').textContent;

        console.log(`🎯 Action clicked: ${action} for ${deviceId}`);

        switch (action) {
            case 'Delete':
                this.deleteDevice(deviceId);
                break;
            default:
                console.log('Unknown action:', action);
        }
    }

    async deleteDevice(deviceId) {
        try {
            const numericId = (deviceId || '').toString().replace(/^[^0-9]*/, '');
            const confirmed = await this.confirm(`Delete device ${deviceId}? This cannot be undone.`);
            if (!confirmed) return;
            const res = await fetch(`/api/device-management/devices/${numericId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json();
            if (!result.success) throw new Error(result.message || 'Delete failed');
            this.showToast('Device deleted');
            await this.refreshData();
        } catch (err) {
            console.error('Delete failed:', err);
            this.showToast('Failed to delete device');
        }
    }

    confirm(message) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const messageEl = document.getElementById('confirmMessage');
            if (messageEl) messageEl.textContent = message || 'Are you sure?';
            this._confirmResolve = resolve;
            if (modal) modal.style.display = 'block';
        });
    }

    hideConfirm() {
        const modal = document.getElementById('confirmModal');
        if (modal) modal.style.display = 'none';
        this._confirmResolve = null;
    }

    hideAddDeviceModal() {
        const modal = document.getElementById('addDeviceModal');
        if (modal) modal.style.display = 'none';
    }

    async saveNewDevice() {
        try {
            const tempId = (document.getElementById('tempSensorId')?.value || '').trim();
            const humId  = (document.getElementById('humSensorId')?.value || '').trim();
            const gasId  = (document.getElementById('gasSensorId')?.value || '').trim();
            const userRefRaw = (document.getElementById('adAccount')?.value || '').trim();
            if (!tempId || !humId || !gasId) { this.showToast('All three sensor IDs are required'); return; }
            if (!userRefRaw) { this.showToast('Account is required'); return; }
            const body = {
                user_ref: userRefRaw,
                sensors: [
                    { type: 'Temperature', custom_id: tempId, is_active: 1 },
                    { type: 'Humidity',    custom_id: humId,  is_active: 1 },
                    { type: 'Gas',         custom_id: gasId,  is_active: 1 }
                ]
            };
            const res = await fetch('/api/device-management/devices/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const errJson = await res.json().catch(()=>({message:`HTTP ${res.status}`}));
                const msg = errJson && errJson.message ? errJson.message : `HTTP ${res.status}`;
                throw new Error(msg);
            }
            const result = await res.json();
            if (!result.success) throw new Error(result.message || 'Add failed');
            this.hideAddDeviceModal();
            this.showToast('Device added');
            await this.refreshData();
        } catch (err) {
            console.error('Add device failed:', err);
            const hint = document.getElementById('adDeviceIdHint');
            if (hint) {
                hint.textContent = err.message;
                hint.classList.add('error');
            }
            this.showToast(err.message || 'Failed to add device');
        }
    }

    async generateDeviceId() {
        try {
            const res = await fetch('/api/device-management/devices/next-id');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json();
            console.log('🔑 next-id response:', result);
            if (result && result.success && result.nextId) {
                const el = document.getElementById('adDeviceId');
                if (el) el.value = result.nextId;
                const hint = document.getElementById('adDeviceIdHint');
                if (hint) hint.textContent = 'ID is available.';
            } else {
                throw new Error('No nextId');
            }
        } catch (e) {
            console.error('Generate ID failed:', e);
            // Fallback: compute next ID from currently loaded devices
            const numericIds = (this.deviceData || [])
                .map(d => parseInt(String(d.deviceId || String(d.id).replace(/\D/g,'')), 10))
                .filter(n => !Number.isNaN(n));
            const nextLocal = (numericIds.length ? Math.max(...numericIds) : 0) + 1;
            const el = document.getElementById('adDeviceId');
            if (el) el.value = nextLocal;
            const hint = document.getElementById('adDeviceIdHint');
            if (hint) hint.textContent = 'Using local next ID (server unavailable)';
            this.showToast('Using local next ID');
        }
    }

    async showDeviceDetails(deviceId) {
        try {
            // Extract numeric ID if formatted like DEV-123
            const numericId = (deviceId || '').toString().replace(/^[^0-9]*/,'');
            const modal = document.getElementById('deviceDetailsModal');
            if (!modal) {
                console.error('Device Details modal not found');
                return;
            }

            // Optimistically show modal while fetching
            modal.style.display = 'block';

            const res = await fetch(`/api/device-management/devices/${numericId}`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const result = await res.json();
            if (!result.success) {
                throw new Error(result.message || 'Failed to load device details');
            }
            const d = result.data;

            // Populate fields
            const qs = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || 'N/A'; };
            qs('ddmDeviceId', `DEV-${d.sensor_id}`);
            qs('ddmDeviceName', d.device_name);
            qs('ddmDeviceType', d.device_type);
            qs('ddmDeviceStatus', d.status);
            qs('ddmUserName', d.user_name || 'Unassigned');
            qs('ddmUserEmail', d.user_email || 'N/A');
            qs('ddmCreatedAt', d.created_at ? new Date(d.created_at).toLocaleString() : 'N/A');
            qs('ddmLastUpdate', d.last_update ? new Date(d.last_update).toLocaleString() : 'N/A');
            // Next service removed from compact modal
        } catch (err) {
            console.error('Failed to load device details:', err);
            this.showToast('Failed to load device details');
            this.hideDeviceDetailsModal();
        }
    }

    hideDeviceDetailsModal() {
        const modal = document.getElementById('deviceDetailsModal');
        if (modal) modal.style.display = 'none';
    }

    diagnoseDevice(deviceId) {
        this.showToast(`Diagnosing device ${deviceId}...`);
        // In a real application, this would run diagnostics
    }

    fixDevice(deviceId) {
        const confirmed = confirm(`Fix Device\n\nDevice ID: ${deviceId}\n\nThis will attempt to fix the device. Continue?`);
        if (confirmed) {
            this.showToast(`Attempting to fix device ${deviceId}`);
            // In a real application, this would trigger device repair
        }
    }

    scheduleService(deviceId) {
        this.showToast(`Service scheduled for ${deviceId}`);
        // In a real application, this would open a scheduling interface
    }

    updateDevice(deviceId) {
        const confirmed = confirm(`Update device ${deviceId}?`);
        if (confirmed) {
            this.showToast(`Updating device ${deviceId}`);
        }
    }

    scheduleRepair(deviceId) {
        const confirmed = confirm(`Schedule repair for ${deviceId}?`);
        if (confirmed) {
            this.showToast(`Repair scheduled for ${deviceId}`);
        }
    }

    scheduleInspection(deviceId) {
        this.showToast(`Inspection scheduled for ${deviceId}`);
    }

    showAddDeviceModal() {
        const modal = document.getElementById('addDeviceModal');
        if (modal) {
            // Prefill 4-digit random IDs for each sensor input
            const gen = () => String(Math.floor(1000 + Math.random() * 9000));
            const temp = document.getElementById('tempSensorId');
            const hum  = document.getElementById('humSensorId');
            const gas  = document.getElementById('gasSensorId');
            if (temp) temp.value = gen();
            if (hum)  hum.value  = gen();
            if (gas)  gas.value  = gen();
            modal.style.display = 'block';
        }
    }

    switchSubPage(page) {
        console.log(`🔄 Switching to sub-page: ${page}`);
        
        // Update active button
        document.querySelectorAll('.device-management-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-page="${page}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Handle different sub-pages
        switch (page) {
            case 'device-management':
                this.showOverview();
                break;
            case 'device-monitoring':
                this.showMonitoring();
                break;
            case 'device-maintenance':
                this.showMaintenance();
                break;
        }
    }

    showOverview() {
        console.log('📊 Showing overview page');
        // Overview is the default view, no changes needed
    }

    showMonitoring() {
        console.log('📡 Showing monitoring page');
        this.showToast('Device monitoring view would be implemented here');
    }

    showMaintenance() {
        console.log('🔧 Showing maintenance page');
        this.showToast('Device maintenance view would be implemented here');
    }

    showToast(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3b7bfa;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 300px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// Initialize device management when the page loads
function initializeDeviceManagement() {
    console.log('📱 Initializing Device Management...');
    
    // Wait for DOM to be ready
    setTimeout(() => {
        const container = document.querySelector('.device-management-container');
        if (container) {
            if (typeof DeviceManagementManager !== 'undefined') {
                window.deviceManagementManager = new DeviceManagementManager();
                console.log('✅ Device Management Manager created successfully');
            } else {
                console.error('❌ DeviceManagementManager class not defined');
            }
        } else {
            console.error('❌ Device management container not found');
        }
    }, 100);
}

// Make the initialization function globally available
window.initializeDeviceManagement = initializeDeviceManagement;
