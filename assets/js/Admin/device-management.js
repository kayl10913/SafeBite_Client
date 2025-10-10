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
        const status = (document.getElementById('dfStatus')?.value || '').trim();
        const user = (document.getElementById('dfSearch')?.value || '').trim().toLowerCase();
        const filtered = this.deviceData.filter(d => {
            const matchStatus = !status || (String(d.status || '').toUpperCase() === String(status).toUpperCase());
            const userField = `${d.userUsername || ''} ${d.userEmail || ''} ${d.name || ''}`.toLowerCase();
            const matchUser = !user || userField.includes(user);
            return matchStatus && matchUser; // Type filter removed
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
        console.log('🔧 Setting up event listeners...');
        if (this.listenersBound) {
            console.log('⚠️ Event listeners already bound, skipping...');
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
            refreshBtn.addEventListener('click', () => this.refreshData(true));
        }

        // Add Device button
        const addDeviceBtn = document.getElementById('addDeviceBtn');
        if (addDeviceBtn) {
            addDeviceBtn.addEventListener('click', () => this.showAddDeviceModal());
        }

        // Action buttons in tables - use event delegation to handle dynamically created buttons
        document.addEventListener('click', (e) => {
            console.log('🔍 Click event detected on:', e.target);
            if (e.target.classList.contains('device-action-btn')) {
                console.log('✅ Device action button clicked:', e.target.textContent);
                e.preventDefault();
                e.stopPropagation();
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
        // Add Device save button - handled by delegated event listener below
        // const addSave = document.getElementById('addDeviceSave');
        // if (addSave) addSave.addEventListener('click', () => this.saveNewDevice());

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
        console.log('✅ Event listeners setup completed');

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
                    this.refreshData(true);
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
        console.log('🔄 Rebinding UI listeners after SPA content change...');
        console.log('🔄 Current device data length:', this.deviceData ? this.deviceData.length : 0);
        
        // Reset the listeners bound flag to allow re-setup
        this.listenersBound = false;
        this.setupEventListeners();
        
        // Reset pagination and refresh data when returning to the page
        this.pageIndex = 0;
        this.filtersActive = false;
        this.filteredData = [];
        
        // If we already have device data, just re-render the tables
        if (this.deviceData && this.deviceData.length > 0) {
            console.log('🔄 Re-rendering tables with existing data...');
            this.populateTables();
            this.filteredData = this.deviceData;
            this.renderPage();
        } else {
            console.log('🔄 No existing data, refreshing from server...');
            // Refresh the data and render the page
            this.refreshData(false);
        }
    }

    async loadDeviceData() {
        try {
            console.log('🔄 Attempting to fetch device data from /api/device-management/devices');
            const response = await fetch('/api/device-management/devices');
            console.log('📡 Response status:', response.status);
            console.log('📡 Response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📡 API Response:', result);
            console.log('📡 API Response data length:', result.data ? result.data.length : 'no data');
            console.log('📡 First few API data items:', result.data ? result.data.slice(0, 3) : 'no data');
            
            // COMPREHENSIVE DEBUG: Check if we have the expected data structure
            if (result.data && result.data.length > 0) {
                console.log('🔍 DETAILED API DATA ANALYSIS:');
                result.data.forEach((item, index) => {
                    console.log(`🔍 Item ${index}:`, {
                        sensor_id: item.sensor_id,
                        user_email: item.user_email,
                        user_username: item.user_username,
                        device_type: item.device_type,
                        status: item.status,
                        has_user_email: !!item.user_email,
                        user_email_type: typeof item.user_email
                    });
                });
            } else {
                console.error('❌ NO API DATA RECEIVED!');
                console.error('❌ Result object:', result);
            }
            
            if (result.success) {
                // Group sensors by user
                const userGroups = {};
                console.log('🔍 STARTING GROUPING PROCESS...');
                result.data.forEach((device, index) => {
                    console.log(`🔍 Processing device ${index}:`, device);
                    const userKey = device.user_email || 'unassigned';
                    console.log(`🔍 User key for device ${index}: "${userKey}"`);
                    
                    if (!userGroups[userKey]) {
                        console.log(`🔍 Creating new user group for: "${userKey}"`);
                        userGroups[userKey] = {
                            userEmail: device.user_email || 'N/A',
                            userUsername: device.user_username || 'N/A',
                            userRole: device.user_role || 'N/A',
                            sensors: [],
                            lastUpdateMs: 0
                        };
                    } else {
                        console.log(`🔍 Adding to existing user group: "${userKey}"`);
                    }
                    
                    const lastUpdateDate = device.last_update ? new Date(device.last_update) : null;
                    const lastUpdateMs = lastUpdateDate ? lastUpdateDate.getTime() : 0;
                    
                    userGroups[userKey].sensors.push({
                        id: `DEV-${device.sensor_id}`,
                        name: device.device_name,
                        deviceId: device.sensor_id,
                        deviceType: device.device_type,
                        status: device.status,
                        timestamp: lastUpdateDate ? lastUpdateDate.toLocaleDateString() : '',
                        time: lastUpdateDate ? lastUpdateDate.toLocaleTimeString() : '',
                        lastUpdateMs
                    });
                    
                    // Keep track of the most recent update
                    if (lastUpdateMs > userGroups[userKey].lastUpdateMs) {
                        userGroups[userKey].lastUpdateMs = lastUpdateMs;
                    }
                });
                
                // Convert grouped data to device entries (one per user)
                console.log('🔍 User groups before processing:', userGroups);
                console.log('🔍 User groups keys:', Object.keys(userGroups));
                console.log('🔍 User groups values:', Object.values(userGroups));
                
                // DETAILED USER GROUP ANALYSIS
                Object.keys(userGroups).forEach(key => {
                    const group = userGroups[key];
                    console.log(`🔍 User group "${key}":`, {
                        userEmail: group.userEmail,
                        userUsername: group.userUsername,
                        sensorCount: group.sensors ? group.sensors.length : 0,
                        sensors: group.sensors ? group.sensors.map(s => ({deviceId: s.deviceId, deviceType: s.deviceType})) : 'NO SENSORS'
                    });
                });
                
                this.deviceData = Object.values(userGroups).map((userGroup, index) => {
                    console.log(`🔍 Processing user group ${index}:`, userGroup);
                    console.log(`🔍 User group sensors:`, userGroup.sensors);
                    
                    const sensorCount = userGroup.sensors ? userGroup.sensors.length : 0;
                    const onlineCount = userGroup.sensors ? userGroup.sensors.filter(s => s.status === 'ONLINE').length : 0;
                    const overallStatus = onlineCount === sensorCount ? 'ONLINE' : (onlineCount > 0 ? 'PARTIAL' : 'OFFLINE');
                    
                    // Create user-friendly device ID
                    const sensorIdsWithTypes = userGroup.sensors && userGroup.sensors.length > 0
                        ? userGroup.sensors
                            .sort((a, b) => a.deviceId - b.deviceId) // Sort by sensor ID
                            .map(sensor => {
                                const typeAbbr = sensor.deviceType.toLowerCase().substring(0, 3); // temp, hum, gas
                                return `${sensor.deviceId}-${typeAbbr}`;
                            })
                            .join(' • ')
                        : '';
                    
                    const deviceId = sensorIdsWithTypes || `Device-${index + 1}`;
                    
                    const finalDevice = {
                        id: deviceId,
                        name: `${userGroup.userUsername} (${sensorCount} sensors)`,
                        type: 'User Device Set',
                        location: userGroup.userEmail,
                        userEmail: userGroup.userEmail,
                        userUsername: userGroup.userUsername,
                        userRole: userGroup.userRole,
                        deviceType: 'Multi-Sensor Device',
                        status: overallStatus,
                        sensorCount: sensorCount,
                        onlineCount: onlineCount,
                        sensors: userGroup.sensors || [],
                        timestamp: userGroup.lastUpdateMs ? new Date(userGroup.lastUpdateMs).toLocaleDateString() : '',
                        time: userGroup.lastUpdateMs ? new Date(userGroup.lastUpdateMs).toLocaleTimeString() : '',
                        lastUpdateMs: userGroup.lastUpdateMs
                    };
                    
                    console.log(`🔍 Final device ${index}:`, {
                        id: finalDevice.id,
                        userEmail: finalDevice.userEmail,
                        sensorCount: finalDevice.sensorCount,
                        sensors: finalDevice.sensors ? finalDevice.sensors.map(s => s.deviceId) : 'NO SENSORS'
                    });
                    
                    return finalDevice;
                });
                
                console.log('📊 Device data grouped by user:', this.deviceData.length, 'user groups from all users');
                console.log('📊 Final device data:', this.deviceData);
                this.deviceData.forEach((device, index) => {
                    console.log(`📊 Device ${index}:`, device);
                    console.log(`📊 Device ${index} sensors:`, device.sensors);
                });
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
            console.log('📡 Stats API Debug Info:', result.debug);
            
            if (!result.success) {
                console.error('❌ Stats API returned error:', result.message);
                this.showToast(`Error loading statistics: ${result.message}`);
            }

            // Use backend stats if available, otherwise derive from frontend data
            const statCards = document.querySelectorAll('.device-management-stat-card');
            if (statCards.length >= 4) {
                if (result.success && result.data) {
                    // Use backend statistics
                    const stats = result.data;
                    console.log('📊 Using backend statistics:', stats);
                    statCards[0].querySelector('.stat-value').textContent = String(stats.total_devices || 0);
                    statCards[1].querySelector('.stat-value').textContent = String(stats.active_devices || 0);
                    statCards[2].querySelector('.stat-value').textContent = `${stats.device_health || 0}%`;
                    statCards[3].querySelector('.stat-value').textContent = String(stats.alerts || 0);
                    
                    // Update trends
                    const alertTrend = statCards[3].querySelector('.stat-trend');
                    if (alertTrend) alertTrend.textContent = (stats.alerts || 0) > 0 ? 'device issues' : '↓ No issues';
                    
                    const trend1 = statCards[0].querySelector('.stat-trend');
                    if (trend1) trend1.textContent = `↑ ${(stats.total_devices || 0) * 3} sensors`;
                    
                    const trend2 = statCards[1].querySelector('.stat-trend');
                    const pctOnline = (stats.total_devices || 0) > 0 ? Math.round(((stats.active_devices || 0)/(stats.total_devices || 1))*100) : 0;
                    if (trend2) trend2.textContent = `↑ ${pctOnline}% online`;
                    
                    const trend3 = statCards[2].querySelector('.stat-trend');
                    if (trend3) trend3.textContent = (stats.device_health || 0) >= 99.5 ? '↑ All operational' : '↓ Needs attention';
                } else {
                    // Fallback to derived statistics
                    console.log('📊 Using derived statistics (fallback)');
                    const derived = this.computeDeviceStatsFromSensors();
                    statCards[0].querySelector('.stat-value').textContent = String(derived.totalDevices);
                    statCards[1].querySelector('.stat-value').textContent = String(derived.activeDevices);
                    statCards[2].querySelector('.stat-value').textContent = `${derived.healthPct.toFixed(2)}%`;
                    statCards[3].querySelector('.stat-value').textContent = String(derived.alerts);
                    
                    const alertTrend = statCards[3].querySelector('.stat-trend');
                    if (alertTrend) alertTrend.textContent = derived.alerts > 1 ? 'device issues' : '↓ No issues';
                    
                    const trend1 = statCards[0].querySelector('.stat-trend');
                    if (trend1) trend1.textContent = `↑ ${derived.totalDevices * 3} sensors`;
                    
                    const trend2 = statCards[1].querySelector('.stat-trend');
                    const pctOnline = derived.totalDevices > 0 ? Math.round((derived.activeDevices/derived.totalDevices)*100) : 0;
                    if (trend2) trend2.textContent = `↑ ${pctOnline}% online`;
                    
                    const trend3 = statCards[2].querySelector('.stat-trend');
                    if (trend3) trend3.textContent = derived.healthPct >= 99.5 ? '↑ All operational' : '↓ Needs attention';
                    
                    console.log('📈 Derived Statistics applied:', derived);
                }
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
                
                // Only count as a device if user has all 3 sensor types (Temperature, Humidity, Gas)
                const hasAll = ['Temperature','Humidity','Gas'].every(t => types.has(t));
                if (hasAll) {
                    totalDevices += 1;
                    
                    // Device is active only if ALL 3 sensors are ONLINE
                    const allOnline = ['Temperature','Humidity','Gas'].every(t => 
                        (statusByType[t]||[]).every(st => st === 'ONLINE')
                    );
                    if (allOnline) {
                        activeDevices += 1;
                    }
                    
                    // Device has issues if ALL 3 sensors are OFFLINE
                    const allOffline = ['Temperature','Humidity','Gas'].every(t => 
                        (statusByType[t]||[]).every(st => st === 'OFFLINE')
                    );
                    if (allOffline) {
                        deviceIssuesActive += 1;
                    }
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

        tbody.innerHTML = this.deviceData.map(device => {
            console.log('🔍 Processing device for table:', device);
            console.log('🔍 Device ID:', device.id);
            console.log('🔍 Device userEmail:', device.userEmail);
            
            return `
            <tr>
                <td>${device.id}</td>
                <td>${device.name}</td>
                <td>${device.location}</td>
                <td>${device.deviceType}</td>
                <td>
                    <span class="status-badge ${this.getStatusClass(device.status)}">${device.status}</span>
                    <br><small style="color: #bfc9da; font-size: 0.8em;">${device.onlineCount}/${device.sensorCount} sensors online</small>
                </td>
                <td>
                    <button class="device-action-btn ${device.status === 'OFFLINE' ? 'emergency' : ''}" 
                            data-user-email="${device.userEmail}">
                        ${this.getActionText(device.status)}
                    </button>
                </td>
            </tr>
        `;
        }).join('');
        
        console.log('📊 Device activities table populated with', this.deviceData.length, 'user groups');
        
        // DEBUG: Check if buttons were created correctly
        setTimeout(() => {
            const buttons = document.querySelectorAll('.device-action-btn');
            console.log('🔍 Found', buttons.length, 'action buttons in DOM');
            buttons.forEach((btn, index) => {
                const tableRow = btn.closest('tr');
                const deviceIdCell = tableRow ? tableRow.querySelector('td:first-child') : null;
                const deviceIdText = deviceIdCell ? deviceIdCell.textContent.trim() : 'N/A';
                
                console.log(`🔍 Button ${index}:`, {
                    textContent: btn.textContent,
                    'data-user-email': btn.getAttribute('data-user-email'),
                    'device-id-from-table': deviceIdText,
                    outerHTML: btn.outerHTML
                });
            });
        }, 100);
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
            case 'PARTIAL': return 'status-warning';
            case 'ERROR': return 'status-danger';
            default: return 'status-warning';
        }
    }

    getActionText(status) {
        // Show Deactivate for online devices, Reactivate for offline devices
        switch (status) {
            case 'ONLINE':
            case 'PARTIAL':
                return 'Deactivate';
            case 'OFFLINE':
                return 'Reactivate';
            default:
                return 'Deactivate';
        }
    }

    async refreshData(showToast = true) {
        console.log('🔄 Refreshing device management data...');
        await this.loadDeviceData();
        await this.loadEquipmentData();
        await this.updateStatistics();
        this.populateTables();
        // Ensure pagination is rendered after data refresh
        this.renderPage();
        if (showToast) {
            this.showToast('Data refreshed successfully');
        }
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
        console.log('🎯 handleActionClick called with button:', button);
        console.log('🎯 Button HTML:', button.outerHTML);
        
        const action = button.textContent.trim();
        const userEmail = button.getAttribute('data-user-email');
        
        // Get the Device ID from the table row
        const tableRow = button.closest('tr');
        if (!tableRow) {
            console.error('❌ Could not find table row for button');
            this.showToast('Error: Could not find device information');
            return;
        }
        
        const deviceIdCell = tableRow.querySelector('td:first-child'); // First column is Device ID
        if (!deviceIdCell) {
            console.error('❌ Could not find Device ID cell');
            this.showToast('Error: Could not find device ID');
            return;
        }
        
        const deviceIdText = deviceIdCell.textContent.trim();
        console.log(`🎯 Device ID from table: "${deviceIdText}"`);
        
        // Extract the first sensor ID from the Device ID (e.g., "13-tem • 14-hum • 15-gas" -> "13")
        const firstSensorId = this.extractFirstSensorId(deviceIdText);
        console.log(`🎯 Extracted first sensor ID: ${firstSensorId}`);

        if (!firstSensorId) {
            console.error('❌ Could not extract sensor ID from Device ID:', deviceIdText);
            this.showToast('Error: Could not extract sensor ID from device ID');
            return;
        }

        console.log(`🎯 Action clicked: ${action} for user ${userEmail} (sensor: ${firstSensorId})`);

        switch (action) {
            case 'Deactivate':
                console.log('🎯 Calling deactivateDevice...');
                this.deactivateDevice(firstSensorId, userEmail);
                break;
            case 'Reactivate':
                console.log('🎯 Calling reactivateDevice...');
                this.reactivateDevice(firstSensorId, userEmail);
                break;
            default:
                console.log('❌ Unknown action:', action);
        }
    }

    async deactivateDevice(deviceId, userEmail = '') {
        try {
            const numericId = (deviceId || '').toString().replace(/^[^0-9]*/, '');
            const userName = userEmail ? userEmail.split('@')[0] : 'this user';
            
            // Create enhanced confirmation message
            const confirmed = await this.confirm(
                `🔒 Deactivate Device Set?`,
                `This will temporarily disable all sensors for ${userName}.`,
                `📡 Temperature • Humidity • Gas sensors will be disabled\n⚠️ The user will not receive alerts until reactivated\n🔄 This action can be reversed at any time`
            );
            
            if (!confirmed) return;
            
            const res = await fetch(`/api/device-management/devices/${numericId}/deactivate`, { method: 'PUT' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json();
            if (!result.success) throw new Error(result.message || 'Deactivation failed');
            
            // Enhanced success message
            const successMessage = `✅ Device set deactivated successfully!\n\n📡 ${result.affectedRows || 3} sensors disabled for ${userName}\n🔒 User will not receive alerts until reactivated`;
            this.showToast(successMessage);
            await this.refreshData(false);
        } catch (err) {
            console.error('Deactivation failed:', err);
            this.showToast('❌ Failed to deactivate device set. Please try again.');
        }
    }

    async reactivateDevice(deviceId, userEmail = '') {
        try {
            const numericId = (deviceId || '').toString().replace(/^[^0-9]*/, '');
            const userName = userEmail ? userEmail.split('@')[0] : 'this user';
            
            // Create enhanced confirmation message
            const confirmed = await this.confirm(
                `🔄 Reactivate Device Set?`,
                `This will re-enable all sensors for ${userName}.`,
                `📡 Temperature • Humidity • Gas sensors will be enabled\n✅ The user will start receiving alerts again\n🔔 All monitoring features will be restored`
            );
            
            if (!confirmed) return;
            
            const res = await fetch(`/api/device-management/devices/${numericId}/reactivate`, { method: 'PUT' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json();
            if (!result.success) throw new Error(result.message || 'Reactivation failed');
            
            // Enhanced success message
            const successMessage = `✅ Device set reactivated successfully!\n\n📡 ${result.affectedRows || 3} sensors enabled for ${userName}\n🔔 User will now receive alerts again`;
            this.showToast(successMessage);
            await this.refreshData(false);
        } catch (err) {
            console.error('Reactivation failed:', err);
            this.showToast('❌ Failed to reactivate device set. Please try again.');
        }
    }

    confirm(title, message, details = '') {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmTitle');
            const messageEl = document.getElementById('confirmMessage');
            const detailsEl = document.getElementById('confirmActionDetails');
            const iconEl = document.getElementById('confirmIcon');
            
            // Set title
            if (titleEl) titleEl.textContent = title || 'Confirm Action';
            
            // Set main message
            if (messageEl) messageEl.textContent = message || 'Are you sure?';
            
            // Set details if provided
            if (detailsEl) {
                if (details) {
                    detailsEl.textContent = details;
                    detailsEl.parentElement.style.display = 'block';
                } else {
                    detailsEl.parentElement.style.display = 'none';
                }
            }
            
            // Set appropriate icon based on action
            if (iconEl) {
                if (title && title.includes('Deactivate')) {
                    iconEl.textContent = '🔒';
                } else if (title && title.includes('Reactivate')) {
                    iconEl.textContent = '🔄';
                } else {
                    iconEl.textContent = '⚠️';
                }
            }
            
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
        console.log('🚀 saveNewDevice called - preventing duplicate execution');
        if (this.savingDevice) {
            console.log('⚠️ saveNewDevice already in progress, ignoring duplicate call');
            return;
        }
        this.savingDevice = true;
        try {
            const tempId = (document.getElementById('tempSensorId')?.value || '').trim();
            const humId  = (document.getElementById('humSensorId')?.value || '').trim();
            const gasId  = (document.getElementById('gasSensorId')?.value || '').trim();
            const userRefRaw = (document.getElementById('adAccount')?.value || '').trim();
            if (!tempId || !humId || !gasId) { this.showToast('All three sensor IDs are required'); this.savingDevice = false; return; }
            if (!userRefRaw) { this.showToast('Account is required'); this.savingDevice = false; return; }
            
            // Check if user already has devices (active or deactivated)
            console.log('🔍 Checking if user already has devices...');
            const userCheckRes = await fetch(`/api/device-management/devices/check-user-status?user_ref=${encodeURIComponent(userRefRaw)}`);
            if (userCheckRes.ok) {
                const userCheckResult = await userCheckRes.json();
                if (userCheckResult.hasActiveDevices) {
                    this.showToast('❌ User already has devices (active or deactivated). Cannot add new device.');
                    this.savingDevice = false;
                    return;
                }
                console.log('✅ User has no devices, proceeding with device addition...');
            }
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
            await this.refreshData(false);
        } catch (err) {
            console.error('Add device failed:', err);
            const hint = document.getElementById('adDeviceIdHint');
            if (hint) {
                hint.textContent = err.message;
                hint.classList.add('error');
            }
            this.showToast(err.message || 'Failed to add device');
        } finally {
            this.savingDevice = false;
            console.log('✅ saveNewDevice execution completed');
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

    // Helper method to extract the first sensor ID from Device ID text
    extractFirstSensorId(deviceIdText) {
        console.log(`🔍 Extracting sensor ID from: "${deviceIdText}"`);
        
        if (!deviceIdText || deviceIdText.trim() === '') {
            console.error('❌ Device ID text is empty');
            return null;
        }
        
        // Handle different formats:
        // "13-tem • 14-hum • 15-gas" -> "13"
        // "13,14,15" -> "13"
        // "13" -> "13"
        
        let firstId = null;
        
        // Try bullet point separator first (•)
        if (deviceIdText.includes('•')) {
            const parts = deviceIdText.split('•');
            const firstPart = parts[0].trim();
            // Extract number from "13-tem" -> "13"
            const match = firstPart.match(/^(\d+)/);
            if (match) {
                firstId = match[1];
            }
        }
        // Try comma separator
        else if (deviceIdText.includes(',')) {
            const parts = deviceIdText.split(',');
            firstId = parts[0].trim();
        }
        // Try to extract number from single value
        else {
            const match = deviceIdText.match(/^(\d+)/);
            if (match) {
                firstId = match[1];
            }
        }
        
        console.log(`🔍 Extracted sensor ID: "${firstId}"`);
        return firstId;
    }

    showToast(message) {
        // Create toast notification with support for multi-line messages
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3b7bfa;
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            line-height: 1.5;
            white-space: pre-line;
            border-left: 4px solid #2ecc71;
        `;
        
        // Handle different message types with appropriate styling
        if (message.includes('✅')) {
            toast.style.background = '#27ae60';
            toast.style.borderLeftColor = '#2ecc71';
        } else if (message.includes('❌')) {
            toast.style.background = '#e74c3c';
            toast.style.borderLeftColor = '#c0392b';
        } else if (message.includes('⚠️')) {
            toast.style.background = '#f39c12';
            toast.style.borderLeftColor = '#e67e22';
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds for longer messages
        const duration = message.includes('\n') ? 5000 : 3000;
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
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
