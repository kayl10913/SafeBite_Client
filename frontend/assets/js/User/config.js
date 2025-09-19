// Config page JS

console.log('config.js loaded!');

window.initConfigPage = function() {
  function setupConfigTabs() {
    const tabButtons = document.querySelectorAll('.config-tab');
    const foodTab = document.getElementById('config-food-tab');
    const sensorsTab = document.getElementById('config-sensors-tab');
    if (!tabButtons.length || !foodTab || !sensorsTab) return;

    // Force initial state: show food, hide sensors
    foodTab.classList.remove('d-none');
    sensorsTab.classList.add('d-none');
    tabButtons.forEach(b => b.classList.remove('active'));
    tabButtons[0].classList.add('active');

    tabButtons.forEach(btn => {
      btn.onclick = function() {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.tab === 'food') {
          foodTab.classList.remove('d-none');
          sensorsTab.classList.add('d-none');
          loadFoodItems();
        } else {
          sensorsTab.classList.remove('d-none');
          foodTab.classList.add('d-none');
          // TODO: load sensors if needed
        }
      };
    });
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
        alert('Please enter a food name');
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
          alert(j && j.message ? j.message : 'Failed to add food item');
        }
      })
      .catch(() => alert('Failed to add food item'));
    };
  }

  function authHeader() {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('sessionToken') || '';
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  function ensureFoodListContainer() {
    const foodTab = document.getElementById('config-food-tab');
    if (!foodTab) return null;
    let list = foodTab.querySelector('#configFoodList');
    if (!list) {
      list = document.createElement('div');
      list.id = 'configFoodList';
      list.style.marginTop = '16px';
      foodTab.appendChild(list);
    }
    return list;
  }

  function renderFoodItems(items) {
    const foodTab = document.getElementById('config-food-tab');
    if (!foodTab) return;
    const empty = foodTab.querySelector('.config-empty');
    const list = ensureFoodListContainer();
    if (!list) return;

    if (!Array.isArray(items) || items.length === 0) {
      if (empty) empty.style.display = '';
      list.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    const rows = items.map(it => {
      const id = it.food_id || it.id;
      const name = it.name || '';
      const category = it.category || '';
      return `
        <tr data-id="${id}">
          <td style="padding:8px 12px;">${name}</td>
          <td style="padding:8px 12px;color:#bfc9da;">${category || '<span style=\"opacity:.6\">Uncategorized</span>'}</td>
          <td style="padding:8px 12px;text-align:right;">
            <button class="config-delete-btn" data-id="${id}" style="background:#c0392b;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;">Delete</button>
          </td>
        </tr>`;
    }).join('');

    list.innerHTML = `
      <table style="width:100%;border-collapse:separate;border-spacing:0 8px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 12px;color:#bfc9da;font-weight:600;">Food Name</th>
            <th style="text-align:left;padding:8px 12px;color:#bfc9da;font-weight:600;">Category</th>
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
        const id = this.getAttribute('data-id');
        if (!id) return;
        if (!confirm('Delete this food item?')) return;
        fetch(`/api/users/food-items/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader()
          }
        })
        .then(r => r.json())
        .then(j => {
          if (j && j.success) {
            loadFoodItems();
          } else {
            alert(j && j.message ? j.message : 'Failed to delete');
          }
        })
        .catch(() => alert('Failed to delete'));
      };
    });
  }

  function loadFoodItems() {
    fetch('/api/users/food-items', { headers: { ...authHeader() }})
      .then(r => r.json())
      .then(j => {
        const items = (j && j.success && Array.isArray(j.food_items)) ? j.food_items : [];
        renderFoodItems(items);
      })
      .catch(() => renderFoodItems([]));
  }

  setupConfigTabs();
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
