/**
 * Main application controller — wires UI to modules.
 */
const App = (() => {
  let currentTab = 'chat';
  let recipeFormMode = 'add';
  let editingRecipeId = null;

  function init() {
    _setupTabs();
    _setupChat();
    _setupMealPlanner();
    _setupRecipeForm();
    _setupGroceryList();
    _setupPrices();
    _setupSettings();
    _renderAll();
    _showWelcome();
  }

  /* ========== Tab Navigation ========== */
  function _setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
        currentTab = tab;
        if (tab === 'meals') _renderMealPlan();
        if (tab === 'recipes') _renderRecipes();
        if (tab === 'groceries') _renderGroceryList();
        if (tab === 'prices') _renderPrices();
      });
    });
  }

  /* ========== Chat ========== */
  function _setupChat() {
    const form = document.getElementById('chat-form');
    const sendBtn = document.getElementById('chat-send');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      _sendChat();
    });
    sendBtn.addEventListener('click', _sendChat);
  }

  function _sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    _addChatMessage('user', text);
    input.value = '';
    const result = Chat.process(text);
    _addChatMessage('assistant', result.reply);
    if (result.action) _handleAction(result.action, result.data);
    _saveChatHistory();
  }

  function _addChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    div.innerHTML = _renderMarkdown(text);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function _showWelcome() {
    const history = Storage.getChatHistory();
    if (history.length > 0) {
      for (const msg of history.slice(-20)) {
        _addChatMessage(msg.role, msg.text);
      }
    } else {
      _addChatMessage('assistant', `Welcome to **MealOrganizer**! I'm your meal planning assistant.\n\nI can help you plan meals, manage recipes, build grocery lists, and track prices. Type **help** to see everything I can do.`);
    }
  }

  function _saveChatHistory() {
    const msgs = document.querySelectorAll('.chat-msg');
    const history = [];
    msgs.forEach(m => {
      const role = m.classList.contains('chat-msg-user') ? 'user' : 'assistant';
      history.push({ role, text: m.textContent });
    });
    Storage.saveChatHistory(history.slice(-50));
  }

  function _handleAction(action, data) {
    switch (action) {
      case 'refreshMeals': _renderMealPlan(); break;
      case 'refreshRecipes': _renderRecipes(); break;
      case 'refreshGroceries': _renderGroceryList(); break;
      case 'refreshPrices': _renderPrices(); break;
      case 'openRecipeForm':
        document.querySelector('[data-tab="recipes"]').click();
        if (data?.name) document.getElementById('recipe-name').value = data.name;
        break;
    }
  }

  /* ========== Meal Planner ========== */
  function _setupMealPlanner() {}

  function _renderMealPlan() {
    const grid = document.getElementById('meal-grid');
    if (!grid) return;
    const plan = Meals.getCurrentPlan();
    const weekId = Meals.currentWeekId();
    grid.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.className = 'meal-row meal-header';
    headerRow.innerHTML = '<div class="meal-cell meal-label"></div>' +
      Meals.SLOTS.map(s => `<div class="meal-cell meal-slot-header">${s}</div>`).join('');
    grid.appendChild(headerRow);

    for (const day of Meals.DAYS) {
      const row = document.createElement('div');
      row.className = 'meal-row';
      let cells = `<div class="meal-cell meal-label">${day}</div>`;
      for (const slot of Meals.SLOTS) {
        const meal = plan[day]?.[slot];
        cells += `<div class="meal-cell meal-slot" data-day="${day}" data-slot="${slot}">
          ${meal ? `<span class="meal-name">${_escapeHtml(meal.name)}</span><button class="meal-remove" data-day="${day}" data-slot="${slot}" title="Remove">&times;</button>` : '<span class="meal-empty">+</span>'}
        </div>`;
      }
      row.innerHTML = cells;
      grid.appendChild(row);
    }

    grid.querySelectorAll('.meal-slot').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.classList.contains('meal-remove')) {
          Meals.removeMeal(weekId, e.target.dataset.day, e.target.dataset.slot);
          _renderMealPlan();
          return;
        }
        _showMealPicker(cell.dataset.day, cell.dataset.slot);
      });
    });

    const summary = Meals.getSummary(weekId);
    const summaryEl = document.getElementById('meal-summary');
    if (summaryEl) summaryEl.textContent = `${summary.filledSlots}/${summary.totalSlots} meals planned (${summary.percentPlanned}%)`;
  }

  function _showMealPicker(day, slot) {
    const modal = document.getElementById('meal-picker-modal');
    const list = document.getElementById('meal-picker-list');
    const search = document.getElementById('meal-picker-search');
    const customInput = document.getElementById('meal-picker-custom');
    const addCustomBtn = document.getElementById('meal-picker-add-custom');

    modal.classList.add('active');
    search.value = '';
    customInput.value = '';

    const renderList = (query) => {
      const recipes = query ? Recipes.search(query) : Recipes.getAll();
      list.innerHTML = recipes.length === 0
        ? '<p class="muted">No recipes found. Type a custom meal name below.</p>'
        : recipes.map(r => `<div class="picker-item" data-id="${r.id}">${_escapeHtml(r.name)} <span class="muted">- ${r.category}</span></div>`).join('');

      list.querySelectorAll('.picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const recipe = Recipes.getById(item.dataset.id);
          if (recipe) {
            Meals.setMeal(Meals.currentWeekId(), day, slot, {
              recipeId: recipe.id, name: recipe.name, servings: recipe.servings
            });
          }
          modal.classList.remove('active');
          _renderMealPlan();
        });
      });
    };

    renderList('');
    search.oninput = () => renderList(search.value);

    addCustomBtn.onclick = () => {
      const name = customInput.value.trim();
      if (name) {
        Meals.setMeal(Meals.currentWeekId(), day, slot, { recipeId: null, name, servings: 2 });
        modal.classList.remove('active');
        _renderMealPlan();
      }
    };

    document.getElementById('meal-picker-close').onclick = () => modal.classList.remove('active');
  }

  /* ========== Recipes ========== */
  function _setupRecipeForm() {
    const form = document.getElementById('recipe-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      _saveRecipe();
    });

    document.getElementById('recipe-cancel')?.addEventListener('click', () => {
      _resetRecipeForm();
    });

    document.getElementById('recipe-import-btn')?.addEventListener('click', () => {
      const text = document.getElementById('recipe-import-text').value;
      if (text.trim()) {
        const result = Chat.process('import recipe ' + text);
        _addChatMessage('assistant', result.reply);
        document.getElementById('recipe-import-text').value = '';
        _renderRecipes();
      }
    });
  }

  function _saveRecipe() {
    const name = document.getElementById('recipe-name').value.trim();
    if (!name) return;

    const ingredientsText = document.getElementById('recipe-ingredients').value;
    const ingredients = Recipes.parseIngredientText(ingredientsText);

    const data = {
      name,
      ingredients,
      instructions: document.getElementById('recipe-instructions').value,
      servings: parseInt(document.getElementById('recipe-servings').value) || 4,
      prepTime: document.getElementById('recipe-prep').value,
      cookTime: document.getElementById('recipe-cook').value,
      category: document.getElementById('recipe-category').value,
      tags: document.getElementById('recipe-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    };

    if (recipeFormMode === 'edit' && editingRecipeId) {
      Recipes.update(editingRecipeId, data);
    } else {
      Recipes.create(data);
    }
    _resetRecipeForm();
    _renderRecipes();
  }

  function _resetRecipeForm() {
    document.getElementById('recipe-form').reset();
    recipeFormMode = 'add';
    editingRecipeId = null;
    document.getElementById('recipe-form-title').textContent = 'Add Recipe';
    document.getElementById('recipe-submit-btn').textContent = 'Save Recipe';
  }

  function _editRecipe(id) {
    const r = Recipes.getById(id);
    if (!r) return;
    recipeFormMode = 'edit';
    editingRecipeId = id;
    document.getElementById('recipe-name').value = r.name;
    document.getElementById('recipe-ingredients').value = r.ingredients.map(i => `${i.qty} ${i.unit} ${i.item}`.trim()).join('\n');
    document.getElementById('recipe-instructions').value = r.instructions || '';
    document.getElementById('recipe-servings').value = r.servings;
    document.getElementById('recipe-prep').value = r.prepTime || '';
    document.getElementById('recipe-cook').value = r.cookTime || '';
    document.getElementById('recipe-category').value = r.category;
    document.getElementById('recipe-tags').value = (r.tags || []).join(', ');
    document.getElementById('recipe-form-title').textContent = 'Edit Recipe';
    document.getElementById('recipe-submit-btn').textContent = 'Update Recipe';
    document.getElementById('recipe-form').scrollIntoView({ behavior: 'smooth' });
  }

  function _renderRecipes() {
    const container = document.getElementById('recipe-list');
    if (!container) return;
    const recipes = Recipes.getAll();
    if (recipes.length === 0) {
      container.innerHTML = '<p class="muted">No recipes yet. Add one using the form above or import one.</p>';
      return;
    }
    container.innerHTML = recipes.map(r => `
      <div class="recipe-card" data-id="${r.id}">
        <div class="recipe-card-header">
          <h3>${_escapeHtml(r.name)}</h3>
          <span class="badge">${r.category}</span>
        </div>
        <div class="recipe-card-meta">
          ${r.servings ? `<span>Serves ${r.servings}</span>` : ''}
          ${r.prepTime ? `<span>Prep: ${r.prepTime}</span>` : ''}
          ${r.cookTime ? `<span>Cook: ${r.cookTime}</span>` : ''}
          ${r.rating ? `<span>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>` : ''}
          <span>Cooked ${r.timesCooked || 0}x</span>
        </div>
        <div class="recipe-card-ingredients">
          ${r.ingredients.slice(0, 5).map(i => `<span class="ingredient-tag">${_escapeHtml(i.item)}</span>`).join('')}
          ${r.ingredients.length > 5 ? `<span class="muted">+${r.ingredients.length - 5} more</span>` : ''}
        </div>
        <div class="recipe-card-actions">
          <button class="btn-sm btn-edit" data-id="${r.id}">Edit</button>
          <button class="btn-sm btn-cook" data-id="${r.id}">Cooked It</button>
          <button class="btn-sm btn-delete" data-id="${r.id}">Delete</button>
          ${[1,2,3,4,5].map(n => `<button class="btn-star ${n <= (r.rating||0) ? 'active' : ''}" data-id="${r.id}" data-rating="${n}">★</button>`).join('')}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => _editRecipe(b.dataset.id)));
    container.querySelectorAll('.btn-cook').forEach(b => b.addEventListener('click', () => { Recipes.markCooked(b.dataset.id); _renderRecipes(); }));
    container.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => { if (confirm('Delete this recipe?')) { Recipes.remove(b.dataset.id); _renderRecipes(); } }));
    container.querySelectorAll('.btn-star').forEach(b => b.addEventListener('click', () => { Recipes.rate(b.dataset.id, parseInt(b.dataset.rating)); _renderRecipes(); }));
  }

  /* ========== Grocery List ========== */
  function _setupGroceryList() {
    document.getElementById('grocery-add-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('grocery-add-input');
      const item = input.value.trim();
      if (item) {
        Groceries.addItem({ item, source: 'manual' });
        input.value = '';
        _renderGroceryList();
      }
    });

    document.getElementById('grocery-generate')?.addEventListener('click', () => {
      Groceries.generateFromMealPlan();
      _renderGroceryList();
    });

    document.getElementById('grocery-clear-checked')?.addEventListener('click', () => {
      Groceries.clearChecked();
      _renderGroceryList();
    });
  }

  function _renderGroceryList() {
    const container = document.getElementById('grocery-items');
    if (!container) return;
    const grouped = Groceries.getByAisle();
    const stats = Groceries.getStats();

    if (stats.total === 0) {
      container.innerHTML = '<p class="muted">Grocery list is empty. Add items or generate from your meal plan.</p>';
      _renderGroceryStats(stats);
      return;
    }

    let html = '';
    for (const [aisle, items] of Object.entries(grouped)) {
      html += `<div class="aisle-group"><h4 class="aisle-header">${aisle}</h4>`;
      for (const item of items) {
        html += `
          <div class="grocery-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
            <input type="checkbox" ${item.checked ? 'checked' : ''} class="grocery-check" data-id="${item.id}">
            <span class="grocery-item-name">${item.qty ? item.qty + ' ' : ''}${item.unit ? item.unit + ' ' : ''}${_escapeHtml(item.item)}</span>
            ${item.price ? `<span class="grocery-price">$${item.price}</span>` : ''}
            <button class="btn-tiny btn-remove-grocery" data-id="${item.id}" title="Remove">&times;</button>
          </div>`;
      }
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.grocery-check').forEach(cb => {
      cb.addEventListener('change', () => { Groceries.toggleItem(cb.dataset.id); _renderGroceryList(); });
    });
    container.querySelectorAll('.btn-remove-grocery').forEach(b => {
      b.addEventListener('click', () => { Groceries.removeItem(b.dataset.id); _renderGroceryList(); });
    });

    _renderGroceryStats(stats);
    _renderSaleAlerts();
  }

  function _renderGroceryStats(stats) {
    const el = document.getElementById('grocery-stats');
    if (el) el.textContent = `${stats.total} items | ${stats.checked} checked | ${stats.remaining} remaining`;
  }

  function _renderSaleAlerts() {
    const container = document.getElementById('sale-alerts');
    if (!container) return;
    const alerts = Prices.getSaleAlerts();
    if (alerts.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = '<h4>Sale Alerts</h4>' + alerts.map(a => `<div class="sale-alert">${a.message}</div>`).join('');
  }

  /* ========== Prices ========== */
  function _setupPrices() {
    document.getElementById('price-log-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const item = document.getElementById('price-item').value.trim();
      const price = document.getElementById('price-amount').value;
      const store = document.getElementById('price-store').value.trim();
      if (item && price) {
        Prices.logPrice(item, price, store);
        document.getElementById('price-log-form').reset();
        _renderPrices();
      }
    });

    document.getElementById('sale-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const item = document.getElementById('sale-item').value.trim();
      const salePrice = document.getElementById('sale-price').value;
      const store = document.getElementById('sale-store').value.trim();
      const until = document.getElementById('sale-until').value;
      if (item && salePrice) {
        Prices.addSale({ item, salePrice, store, validUntil: until });
        document.getElementById('sale-form').reset();
        _renderPrices();
      }
    });
  }

  function _renderPrices() {
    const trackedEl = document.getElementById('tracked-prices');
    const salesEl = document.getElementById('active-sales');
    if (!trackedEl) return;

    const tracked = Prices.getAllTracked();
    if (tracked.length === 0) {
      trackedEl.innerHTML = '<p class="muted">No price history yet. Log prices to start tracking.</p>';
    } else {
      trackedEl.innerHTML = `<table class="price-table">
        <thead><tr><th>Item</th><th>Avg</th><th>Low</th><th>High</th><th>Latest</th><th>Trend</th><th>Best Store</th></tr></thead>
        <tbody>${tracked.map(t => `<tr>
          <td>${_escapeHtml(t.item)}</td><td>$${t.average}</td><td>$${t.min}</td><td>$${t.max}</td>
          <td>$${t.latest}</td><td class="trend-${t.trend}">${t.trend === 'up' ? '↑' : t.trend === 'down' ? '↓' : '→'}</td>
          <td>${_escapeHtml(t.cheapestStore)}</td>
        </tr>`).join('')}</tbody></table>`;
    }

    const sales = Prices.getActiveSales();
    if (salesEl) {
      salesEl.innerHTML = sales.length === 0
        ? '<p class="muted">No active sales.</p>'
        : sales.map(s => `<div class="sale-card">
            <strong>${_escapeHtml(s.item)}</strong> — $${s.salePrice} at ${_escapeHtml(s.store)}
            ${s.validUntil ? `<span class="muted">(until ${s.validUntil})</span>` : ''}
            <button class="btn-tiny btn-remove-sale" data-id="${s.id}">&times;</button>
          </div>`).join('');
      salesEl.querySelectorAll('.btn-remove-sale').forEach(b => {
        b.addEventListener('click', () => { Prices.removeSale(b.dataset.id); _renderPrices(); });
      });
    }

    const summary = Prices.getSpendingSummary();
    const summaryEl = document.getElementById('spending-summary');
    if (summaryEl) summaryEl.textContent = `Total logged: $${summary.totalSpent} across ${summary.itemCount} entries`;
  }

  /* ========== Settings ========== */
  function _setupSettings() {
    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const settings = {
        householdSize: parseInt(document.getElementById('setting-household').value) || 2,
        budget: parseFloat(document.getElementById('setting-budget').value) || 150,
        currency: document.getElementById('setting-currency').value || '$',
      };
      Storage.saveSettings(settings);
      _addChatMessage('assistant', 'Settings saved.');
    });

    document.getElementById('export-data')?.addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'meal-organizer-backup.json';
      a.click();
    });

    document.getElementById('import-data')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Storage.importAll(data);
          _renderAll();
          _addChatMessage('assistant', 'Data imported successfully.');
        } catch { alert('Invalid file.'); }
      };
      reader.readAsText(file);
    });

    const settings = Storage.getSettings();
    const hEl = document.getElementById('setting-household');
    const bEl = document.getElementById('setting-budget');
    const cEl = document.getElementById('setting-currency');
    if (hEl) hEl.value = settings.householdSize;
    if (bEl) bEl.value = settings.budget;
    if (cEl) cEl.value = settings.currency;
  }

  /* ========== Utilities ========== */
  function _renderAll() {
    _renderMealPlan();
    _renderRecipes();
    _renderGroceryList();
    _renderPrices();
  }

  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function _renderMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/^• (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);

if (typeof module !== 'undefined') module.exports = { App };
