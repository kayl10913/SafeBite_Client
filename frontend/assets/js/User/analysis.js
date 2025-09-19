// analysis.js

window.initAnalysisPage = function() {
  // Only run if analysis page is present
  const main = document.querySelector('.analysis-main');
  if (!main) return;

  // Ensure Analyze tab is visible on load
  const analysisTab = document.getElementById('analysisTabContent');
  const aiChatTab = document.getElementById('aiChatTabContent');
  if (analysisTab) analysisTab.style.display = '';
  if (aiChatTab) aiChatTab.style.display = 'none';

  // Tab switching (UI only)
  document.querySelectorAll('.analysis-nav-btn').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('.analysis-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Tab switching logic
      const tab = btn.dataset.tab;
      const analysisTab = document.getElementById('analysisTabContent');
      const aiChatTab = document.getElementById('aiChatTabContent');
      if (tab === 'analyze') {
        if (analysisTab) analysisTab.style.display = '';
        if (aiChatTab) aiChatTab.style.display = 'none';
      } else if (tab === 'ai-chat') {
        if (analysisTab) analysisTab.style.display = 'none';
        if (aiChatTab) aiChatTab.style.display = '';
      }
    };
  });

  // Analyze button logic
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsEmpty = document.getElementById('analysisResultsEmpty');
  const resultsOutput = document.getElementById('analysisResultsOutput');
  // Ensure loading spinner styles are available (once)
  (function ensureAnalysisLoadingStyles(){
    if (!document.getElementById('analysisLoadingStyles')) {
      const style = document.createElement('style');
      style.id = 'analysisLoadingStyles';
      style.textContent = `@keyframes analysisSpin{to{transform:rotate(360deg)}}`;
      document.head.appendChild(style);
    }
  })();

  const aiChatForm = document.querySelector('.ai-chat-input-row');
  const aiChatInput = document.querySelector('.ai-chat-input');
  const aiChatArea = document.querySelector('.ai-chat-area');
  const aiChatSendBtn = document.querySelector('.ai-chat-send-btn');
  // Create ChatGPT-style messages container if missing
  let chatMessages = aiChatArea ? aiChatArea.querySelector('.chat-messages') : null;
  if (aiChatArea && !chatMessages) {
    chatMessages = document.createElement('div');
    chatMessages.className = 'chat-messages';
    aiChatArea.appendChild(chatMessages);
  }

  // Empty-state instruction (initial)
  if (resultsEmpty && resultsOutput) {
    resultsEmpty.style.display = '';
    resultsOutput.style.display = 'none';
    resultsEmpty.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;color:#9fb8ff;">
        <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f52c.svg" alt="Microscope" style="width:48px;opacity:0.7;" />
        <div style="font-weight:700;">Enter sensor data and click "Analyze" to see results</div>
        <div style="font-size:0.95rem;">Tip: Select Food Type, then provide Temp, Humidity, and Gas values.</div>
      </div>`;
  }

  // Populate Food Type options from DB (actual food items) - using dashboard approach
  async function populateFoodItems() {
    try {
      console.log('Populating food items...');
      const foodTypeSelect = document.getElementById('analysisProductType');
      if (!foodTypeSelect) {
        console.log('Food type select not found');
        return;
      }
      
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      if (!sessionToken) {
        console.log('No session token found');
        return;
      }
      
      console.log('Fetching food items from API...');
      const res = await fetch('/api/users/food-items', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      const data = await res.json();
      console.log('Food items API response:', data);
      
      if (data && data.success && Array.isArray(data.food_items) && data.food_items.length) {
        console.log(`Found ${data.food_items.length} food items`);
        // Clear existing options
        foodTypeSelect.innerHTML = '';
        
        // Add placeholder option
        const placeholder = document.createElement('option');
        placeholder.textContent = 'Select Food';
        placeholder.value = '';
        foodTypeSelect.appendChild(placeholder);
        
        // Add food items from database (using dashboard format)
        data.food_items.forEach(food => {
          const opt = document.createElement('option');
          opt.textContent = `${food.name} (${food.category || 'No Category'})`;
          opt.value = String(food.food_id);
          opt.dataset.name = food.name;
          opt.dataset.category = food.category || '';
          opt.dataset.foodId = food.food_id;
          foodTypeSelect.appendChild(opt);
        });
        
        // Update category info to show count
        const catLabel = document.getElementById('analysisCategoryInfo');
        if (catLabel) {
          catLabel.textContent = `Available Foods: ${data.food_items.length} items`;
        }
        
        console.log('Food items populated successfully');
      } else {
        console.log('No food items found or API error');
        // Show message when no foods available
        const catLabel = document.getElementById('analysisCategoryInfo');
        if (catLabel) {
          catLabel.textContent = 'No foods available. Add some foods first.';
          catLabel.style.color = '#ffc107';
        }
        
        // Disable analyze button if no foods
        if (analyzeBtn) {
          analyzeBtn.disabled = true;
          analyzeBtn.title = 'No foods available for analysis';
        }
      }
    } catch (e) {
      console.error('Error populating food items:', e);
    }
  }

  // Call populateFoodItems when page loads
  populateFoodItems();
  
  // Add refresh button functionality if needed
  const refreshFoodBtn = document.getElementById('refreshFoodBtn');
  if (refreshFoodBtn) {
    refreshFoodBtn.addEventListener('click', populateFoodItems);
  }
  
  // Add manual refresh capability
  window.refreshAnalysisFoods = populateFoodItems;
  
  // Add loading state to food dropdown
  const foodTypeSelect = document.getElementById('analysisProductType');
  if (foodTypeSelect) {
    foodTypeSelect.addEventListener('focus', function() {
      if (this.options.length <= 1) {
        console.log('Refreshing food items on focus...');
        populateFoodItems();
      }
    });
    
    // When selecting a food, attempt to autofill sensor data from dashboard logic (latest readings)
    foodTypeSelect.addEventListener('change', async function() {
      const foodId = this.value ? parseInt(this.value, 10) : 0;
      const nameFromOption = this.selectedOptions && this.selectedOptions[0] ? this.selectedOptions[0].dataset.name : '';
      const catFromOption = this.selectedOptions && this.selectedOptions[0] ? (this.selectedOptions[0].dataset.category || '') : '';
      
      // Update category info
      const catLabel = document.getElementById('analysisCategoryInfo');
      if (catLabel) {
        if (foodId) {
          catLabel.textContent = `Selected: ${nameFromOption} (${catFromOption || 'No Category'})`;
          catLabel.style.color = '#28a745';
        } else {
          catLabel.textContent = 'Available Foods: Select a food to analyze';
          catLabel.style.color = '#9fb8ff';
        }
      }

      if (!foodId) return;

      try {
        console.log(`Fetching sensor data for food ID: ${foodId}`);
        const sessionToken = localStorage.getItem('jwt_token') || 
                             localStorage.getItem('sessionToken') || 
                             localStorage.getItem('session_token');
        
        // Use the same API endpoint as dashboard for consistency
        const url = `/api/sensor/gauges?food_id=${encodeURIComponent(foodId)}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        const data = await res.json();
        console.log('Sensor data response:', data);
        
        if (data && data.success && data.gauge_data) {
          // Auto-fill sensor values from the latest readings
          const tempEl = document.getElementById('analysisTemp');
          const humEl = document.getElementById('analysisHumidity');
          const gasEl = document.getElementById('analysisGas');

          // Map sensor data by type (using dashboard logic)
          if (data.gauge_data.temperature && data.gauge_data.temperature.value !== null) {
            if (tempEl) tempEl.value = data.gauge_data.temperature.value;
            console.log('Auto-filled temperature:', data.gauge_data.temperature.value);
          }
          
          if (data.gauge_data.humidity && data.gauge_data.humidity.value !== null) {
            if (humEl) humEl.value = data.gauge_data.humidity.value;
            console.log('Auto-filled humidity:', data.gauge_data.humidity.value);
          }
          
          if (data.gauge_data.gas && data.gauge_data.gas.value !== null) {
            if (gasEl) gasEl.value = data.gauge_data.gas.value;
            console.log('Auto-filled gas:', data.gauge_data.gas.value);
          }
          
          console.log('Sensor data auto-filled successfully');
        } else {
          console.log('No sensor data available for this food');
        }
      } catch (e) {
        console.error('Error fetching sensor data for food:', e);
        // User can still enter values manually
      }
    });
  }

  if (analyzeBtn) {
    analyzeBtn.onclick = function() {
      // Get input values
      const foodSelect = document.getElementById('analysisProductType');
      const selectedOption = foodSelect && foodSelect.selectedOptions ? foodSelect.selectedOptions[0] : null;
      const foodId = foodSelect ? foodSelect.value : '';
      const foodTypeName = selectedOption ? (selectedOption.dataset.name || selectedOption.textContent || '') : '';
      const foodCategory = selectedOption ? (selectedOption.dataset.category || '') : '';
      const temp = parseFloat(document.getElementById('analysisTemp').value);
      const humidity = parseFloat(document.getElementById('analysisHumidity').value);
      const gas = parseFloat(document.getElementById('analysisGas').value);

      // Validate
      if (!foodId || foodTypeName === '') {
        resultsEmpty.style.display = '';
        resultsOutput.style.display = 'none';
        resultsEmpty.innerHTML = '<div style="color:#dc3545;font-weight:600;">Please select a food type first.</div>';
        return;
      }
      
      if (isNaN(temp) || isNaN(humidity) || isNaN(gas)) {
        resultsEmpty.style.display = '';
        resultsOutput.style.display = 'none';
        resultsEmpty.innerHTML = '<div style="color:#dc3545;font-weight:600;">Please enter all sensor values.</div>';
        return;
      }

      // Call backend AI analysis and show loader inside Analysis Results panel
      resultsEmpty.style.display = 'none';
      resultsOutput.style.display = '';
      resultsOutput.innerHTML = `
        <div class="analysis-loading" style="display:flex;align-items:center;gap:10px;margin:2px 0 12px 0;color:#9fb8ff;">
          <span style="display:inline-block;width:16px;height:16px;border:2px solid #9fb8ff;border-top-color:transparent;border-radius:50%;animation:analysisSpin .9s linear infinite"></span>
          <span>Analyzing...</span>
        </div>
        <div class="results-skeleton">
          <div class="skeleton-line" style="width: 40%"></div>
          <div class="skeleton-line" style="width: 75%"></div>
          <div class="skeleton-line" style="width: 65%"></div>
          <div class="skeleton-line" style="width: 55%"></div>
        </div>
      `;

      // Keep button interactive; show loader only in results panel
      const sessionToken = localStorage.getItem('jwt_token') || 
                           localStorage.getItem('sessionToken') || 
                           localStorage.getItem('session_token');
      
      fetch('/api/ai/ai-analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({ 
          foodType: foodTypeName, 
          temp: temp, 
          humidity: humidity, 
          gas: gas 
        })
      })
      .then(r => r.json())
      .then(data => {
        if (!data || !data.analysis) throw new Error(data && data.error ? data.error : 'Invalid response');
        const a = data.analysis;
        const risk = a.riskLevel || 'Unknown';
        const color = risk === 'High' ? '#dc3545' : (risk === 'Medium' ? '#ffc107' : '#28a745');
        const score = typeof a.riskScore !== 'undefined' ? ` (Score: ${a.riskScore})` : '';
        const shelf = a.estimatedShelfLifeHours ? `${a.estimatedShelfLifeHours}h` : '—';
        const factors = Array.isArray(a.keyFactors) ? a.keyFactors.map(f=>`<li>${escapeHtml(String(f))}</li>`).join('') : '';
        const recs = Array.isArray(a.recommendations) ? a.recommendations.map(f=>`<li>${escapeHtml(String(f))}</li>`).join('') : '';
        resultsOutput.innerHTML = `
          <div style="font-size:1.3rem;font-weight:700;">Spoilage Risk: <span style="color:${color}">${escapeHtml(risk)}</span>${score}</div>
          <div>Food Type: <b>${escapeHtml(foodTypeName || '')}</b></div>
          <div>Category: <b>${escapeHtml(foodCategory || '—')}</b></div>
          <div>Temp: <b>${temp}°C</b> | Humidity: <b>${humidity}%</b> | Gas: <b>${gas}</b></div>
          ${a.summary ? `<div style=\"margin-top:8px;color:#dbe7ff;\">${escapeHtml(String(a.summary))}</div>` : ''}
          <div style="display:flex; gap:24px; margin-top:12px; width:100%;">
            <div style="flex:1;">
              <div style="font-weight:700;margin-bottom:6px;">Key Factors</div>
              <ul style="padding-left:18px; margin:0;">${factors}</ul>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;margin-bottom:6px;">Recommendations</div>
              <ul style="padding-left:18px; margin:0;">${recs}</ul>
            </div>
          </div>
          <div style="margin-top:10px;color:#9fb8ff;">Estimated Shelf Life: <b>${shelf}</b></div>
        `;
        resultsOutput.classList.add('ai-result-fade');
      })
      .catch(err => {
        resultsOutput.innerHTML = `<div style="color:#dc3545;font-weight:600;">AI analysis failed: ${escapeHtml(String(err.message || err))}</div>`;
      })
      .finally(() => {
        // No button state changes
      });
    };
  }

  // AI Chat submit logic
  if (aiChatForm && aiChatInput && aiChatArea) {
    // Ensure form has no navigation side-effects
    aiChatForm.setAttribute('action', '');
    aiChatForm.setAttribute('novalidate', 'true');

    // Stop clicks inside the form from bubbling to SPA router (capture phase)
    aiChatForm.addEventListener('click', function(e){ e.stopPropagation(); }, true);

    // Prevent Enter key from causing navigation
    aiChatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (aiChatForm.requestSubmit) {
          aiChatForm.requestSubmit();
        } else {
          aiChatForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      }
    });

    // Also intercept button click directly
    if (aiChatSendBtn) {
      aiChatSendBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (aiChatForm.requestSubmit) {
          aiChatForm.requestSubmit();
        } else {
          aiChatForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    }

    aiChatForm.onsubmit = async function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const message = aiChatInput.value.trim();
      if (!message) return;

      // Capture current sensor inputs as context
      const foodTypeEl = document.getElementById('analysisProductType');
      const tempEl = document.getElementById('analysisTemp');
      const humidityEl = document.getElementById('analysisHumidity');
      const gasEl = document.getElementById('analysisGas');
      const context = {
        foodType: foodTypeEl ? foodTypeEl.value : '',
        temp: tempEl && tempEl.value !== '' ? parseFloat(tempEl.value) : '',
        humidity: humidityEl && humidityEl.value !== '' ? parseFloat(humidityEl.value) : '',
        gas: gasEl && gasEl.value !== '' ? parseFloat(gasEl.value) : ''
      };

      // Hide empty placeholder once chatting starts
      const empty = aiChatArea.querySelector('.ai-chat-empty');
      if (empty) empty.remove();

      // Append user message row (ChatGPT-style)
      const userRow = document.createElement('div');
      userRow.className = 'chat-message user';
      userRow.innerHTML = `
        <div class="chat-avatar"><img src="/images/user-icon.png" alt="You" /></div>
        <div class="message-bubble"><div class="message-content"></div></div>
      `;
      userRow.querySelector('.message-content').textContent = message;
      chatMessages.appendChild(userRow);
      aiChatArea.scrollTop = aiChatArea.scrollHeight;

      // Show loading row with typing dots and space for suggestion chips
      const loadingRow = document.createElement('div');
      loadingRow.className = 'chat-message bot';
      loadingRow.innerHTML = `
        <div class="chat-avatar"><img src="/images/bot-icon.png" alt="AI" /></div>
        <div class="message-bubble"><div class="message-content"><span class="typing-dots"><span></span><span></span><span></span></span><div class="quick-replies" style="display:none"></div></div></div>
      `;
      loadingRow.classList.add('typing');
      chatMessages.appendChild(loadingRow);
      aiChatArea.scrollTop = aiChatArea.scrollHeight;

      aiChatInput.value = '';
      aiChatInput.disabled = true;
      if (aiChatSendBtn) aiChatSendBtn.classList.add('is-loading');

      try {
        // Get session token for authentication
        const sessionToken = localStorage.getItem('jwt_token') || 
                             localStorage.getItem('sessionToken') || 
                             localStorage.getItem('session_token');
        
        if (!sessionToken) {
          throw new Error('No authentication token found. Please log in again.');
        }
        
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({ message, context })
        });
        const data = await res.json();
        loadingRow.remove();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        const text = data.reply || 'No response received';
        const botRow = document.createElement('div');
        botRow.className = 'chat-message bot';
        botRow.innerHTML = `
          <div class="chat-avatar"><img src="/images/bot-icon.png" alt="AI" /></div>
          <div class="message-bubble"><div class="message-content"></div></div>
        `;
        const content = botRow.querySelector('.message-content');
        await typeText(content, String(text));
        
        // Add suggestion chips based on response
        const suggestions = getSuggestions(String(text));
        if (suggestions.length) {
          const chips = document.createElement('div');
          chips.className = 'quick-replies';
          suggestions.forEach(s => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'quick-reply';
            chip.textContent = s;
            chip.addEventListener('click', () => {
              aiChatInput.value = s;
              if (aiChatForm.requestSubmit) aiChatForm.requestSubmit();
              else aiChatForm.dispatchEvent(new Event('submit', { cancelable: true }));
            });
            chips.appendChild(chip);
          });
          content.parentElement.appendChild(chips);
        }
        chatMessages.appendChild(botRow);
        aiChatArea.scrollTop = aiChatArea.scrollHeight;
      } catch (err) {
        loadingRow.remove();
        const errRow = document.createElement('div');
        errRow.className = 'chat-message bot';
        errRow.innerHTML = `
          <div class="chat-avatar"><img src="/images/bot-icon.png" alt="AI" /></div>
          <div class="message-bubble"><div class="message-content">Error: ${err.message || 'Request failed'}</div></div>
        `;
        chatMessages.appendChild(errRow);
        aiChatArea.scrollTop = aiChatArea.scrollHeight;
      }
      aiChatInput.disabled = false;
      if (aiChatSendBtn) aiChatSendBtn.classList.remove('is-loading');
    };
  }
};

// Auto-initialize if loaded on a full page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initAnalysisPage);
} else {
  window.initAnalysisPage();
} 

// Typewriter effect to simulate streaming
async function typeText(targetEl, fullText) {
  const text = String(fullText);
  const chars = Array.from(text);
  targetEl.textContent = '';
  const step = 3;
  for (let i = 0; i < chars.length; i += step) {
    targetEl.textContent += chars.slice(i, i + step).join('');
    // small delay for smoothness
    await new Promise(r => setTimeout(r, 12));
  }
}

// Basic suggestion generator using simple heuristics
function getSuggestions(replyText) {
  const suggestions = [];
  const lowers = replyText.toLowerCase();
  if (lowers.includes('temperature')) suggestions.push('What temperature is safe?');
  if (lowers.includes('humidity')) suggestions.push('What humidity should I keep?');
  if (lowers.includes('gas') || lowers.includes('ethylene')) suggestions.push('What does high gas level mean?');
  if (!suggestions.length) suggestions.push('Give me actionable steps');
  return suggestions.slice(0, 4);
}

// Escape HTML helper for safe injection
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}