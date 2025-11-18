// Config page JS

console.log('config.js loaded!');

window.initConfigPage = function() {
  function setupConfigPage() {
    // No tabs needed anymore, just initialize the page
    console.log('Config page initialized without tabs');
  }

  // Modal logic (use modal from HTML inside main-content)
  function showAddFoodModal() {
    console.log('showAddFoodModal called');
    const mainContent = document.getElementById('main-content');
    const modal = mainContent ? mainContent.querySelector('#addFoodItemModal') : null;
    if (!modal) return;
    modal.style.display = 'flex';
    // Attach close logic
    const closeModal = () => { modal.style.display = 'none'; };
    modal.querySelector('.config-modal-close').onclick = closeModal;
    modal.querySelector('.config-modal-cancel').onclick = closeModal;
    modal.querySelector('.config-modal-backdrop').onclick = closeModal;
    const form = modal.querySelector('form');
    const nameInput = modal.querySelector('input[type="text"]');
    // Replace status select with Category select populated from API
    const footer = modal.querySelector('.config-modal-footer');
    let categoryGroup = modal.querySelector('#configFoodCategoryGroup');
    if (!categoryGroup) {
      categoryGroup = document.createElement('div');
      categoryGroup.className = 'config-modal-group';
      categoryGroup.id = 'configFoodCategoryGroup';
      categoryGroup.innerHTML = '<label>Category</label><select id="configFoodCategory"></select>';
      footer.parentNode.insertBefore(categoryGroup, footer);
    }
    const categorySelect = categoryGroup.querySelector('#configFoodCategory');

    // Load categories from API (user-owned categories from existing items)
    fetch('/api/users/food-types', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || ''}` }
    })
      .then(r => r.json())
      .then(j => {
        const types = (j && j.success && Array.isArray(j.types)) ? j.types : [];
        categorySelect.innerHTML = '<option value="">Uncategorized</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
      })
      .catch(() => {
        categorySelect.innerHTML = '<option value="">Uncategorized</option>';
      });

    form.onsubmit = function(e) {
      e.preventDefault();
      const name = (nameInput && nameInput.value || '').trim();
      const category = (categorySelect && categorySelect.value) || '';
      if (!name) {
        window.modalSystem.warning('Please enter a food name', 'Input Required');
        return;
      }
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || '';
      fetch('/api/users/food-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, category })
      })
      .then(r => r.json())
      .then(j => {
        if (j && j.success) {
          closeModal();
          loadFoodItems();
          try {
            document.dispatchEvent(new CustomEvent('food-item-added', { detail: { food_id: j.food_id, name, category } }));
          } catch (_) {}
        } else {
          window.modalSystem.error(j && j.message ? j.message : 'Failed to add food item', 'Add Failed');
        }
      })
      .catch(() => window.modalSystem.error('Failed to add food item', 'Add Failed'));
    };
  }

  function authHeader() {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || '';
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  function ensureFoodListContainer() {
    const configContent = document.querySelector('.config-content');
    if (!configContent) return null;
    let list = configContent.querySelector('#configFoodList');
    if (!list) {
      list = document.createElement('div');
      list.id = 'configFoodList';
      list.style.marginTop = '16px';
      configContent.appendChild(list);
    }
    return list;
  }

  function renderMLPredictions(items) {
    const configContent = document.querySelector('.config-content');
    if (!configContent) return;
    const empty = configContent.querySelector('.config-empty');
    const list = ensureFoodListContainer();
    if (!list) return;

    if (!Array.isArray(items) || items.length === 0) {
      if (empty) empty.style.display = '';
      list.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    const rows = items.map(item => {
      const name = item.name || '';
      const category = item.category || '';
      const predictionCount = item.prediction_count || 0;
      const latestStatus = item.latest_status || 'unknown';
      const avgSpoilage = item.avg_spoilage_probability || '0';
      const latestScan = item.latest_scan ? new Date(item.latest_scan).toLocaleDateString() : 'Never';
      
      // Status color coding
      let statusColor = '#888';
      let statusText = latestStatus;
      if (latestStatus === 'safe') {
        statusColor = '#27ae60';
        statusText = 'Safe';
      } else if (latestStatus === 'caution') {
        statusColor = '#f39c12';
        statusText = 'Caution';
      } else if (latestStatus === 'unsafe') {
        statusColor = '#e74c3c';
        statusText = 'Unsafe';
      }

      return `
        <tr data-name="${name}">
          <td style="padding:8px 12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:500;">${name}</span>
              <span style="font-size:0.8em;color:#888;">(${item.sensor_types ? item.sensor_types.join(', ') : 'Temperature, Humidity, Gas'})</span>
            </div>
          </td>
          <td style="padding:8px 12px;color:#bfc9da;">${category || '<span style="opacity:.6">Uncategorized</span>'}</td>
          <td style="padding:8px 12px;color:#bfc9da;text-align:center;">
            <span style="color:${statusColor};font-weight:500;">${statusText}</span>
            <br><span style="font-size:0.8em;opacity:0.7;">${avgSpoilage}% risk</span>
          </td>
          <td style="padding:8px 12px;color:#bfc9da;text-align:center;">
            ${predictionCount} scans
            <br><span style="font-size:0.8em;opacity:0.7;">Last: ${latestScan}</span>
          </td>
          <td style="padding:8px 12px;text-align:right;">
            <button class="config-delete-btn" data-name="${name}" style="background:#c0392b;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;">Delete</button>
          </td>
        </tr>`;
    }).join('');

    list.innerHTML = `
      <table style="width:100%;border-collapse:separate;border-spacing:0 8px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 12px;color:#bfc9da;font-weight:600;">Food Name</th>
            <th style="text-align:left;padding:8px 12px;color:#bfc9da;font-weight:600;">Category</th>
            <th style="text-align:center;padding:8px 12px;color:#bfc9da;font-weight:600;">Status</th>
            <th style="text-align:center;padding:8px 12px;color:#bfc9da;font-weight:600;">Scans</th>
            <th style="text-align:right;padding:8px 12px;color:#bfc9da;font-weight:600;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    list.querySelectorAll('.config-delete-btn').forEach(btn => {
      btn.onclick = function() {
        const foodName = this.getAttribute('data-name');
        if (!foodName) return;
        if (!confirm(`Delete all AI prediction data for "${foodName}"? This will remove all scan history for this food item.`)) return;
        
        // Delete AI predictions for this food item
        const deleteUrl = typeof buildApiUrl === 'function' 
          ? buildApiUrl(`/api/users/ml-predictions/${encodeURIComponent(foodName)}`)
          : `/api/users/ml-predictions/${encodeURIComponent(foodName)}`;
        fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader()
          }
        })
        .then(r => r.json())
        .then(j => {
          if (j && j.success) {
            window.modalSystem.success(`Successfully deleted ${j.deleted_count} scan records for ${foodName}`, 'Records Deleted');
            loadFoodItems(); // Reload the list
          } else {
            window.modalSystem.error(j && j.message ? j.message : 'Failed to delete AI prediction data', 'Delete Failed');
          }
        })
        .catch(() => window.modalSystem.error('Failed to delete AI prediction data', 'Delete Failed'));
      };
    });
  }

  // Keep the old function for backward compatibility
  function renderFoodItems(items) {
    renderMLPredictions(items);
  }

  function loadFoodItems() {
    // Load AI predictions instead of food items
    const fetchUrl = typeof buildApiUrl === 'function' 
      ? buildApiUrl('/api/users/ml-predictions')
      : '/api/users/ml-predictions';
    fetch(fetchUrl, { headers: { ...authHeader() }})
      .then(r => r.json())
      .then(j => {
        const items = (j && j.success && Array.isArray(j.food_items)) ? j.food_items : [];
        renderMLPredictions(items);
      })
      .catch(() => renderMLPredictions([]));
  }

  setupConfigPage();
  // initial load
  loadFoodItems();

  // Expose for other modules (dashboard)
  window.showAddFoodItemModal = showAddFoodModal;

  // Remove any previous event listener to avoid duplicates
  if (window._configAddBtnHandler) {
    document.body.removeEventListener('click', window._configAddBtnHandler);
  }
  window._configAddBtnHandler = function(e) {
    const btn = e.target.closest('.config-add-btn');
    if (btn && btn.textContent.includes('Food')) {
      console.log('Add Food Item button clicked!');
      showAddFoodModal();
    }
  };
  document.body.addEventListener('click', window._configAddBtnHandler);
};

// If loaded on a full page load, auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initConfigPage);
} else {
  window.initConfigPage();
}
