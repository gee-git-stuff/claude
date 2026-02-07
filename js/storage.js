/**
 * Storage layer — all data persisted to localStorage.
 */
const Storage = (() => {
  const KEYS = {
    recipes: 'mgo_recipes',
    mealPlan: 'mgo_mealPlan',
    groceryList: 'mgo_groceryList',
    priceHistory: 'mgo_priceHistory',
    sales: 'mgo_sales',
    commonItems: 'mgo_commonItems',
    chatHistory: 'mgo_chatHistory',
    settings: 'mgo_settings',
  };

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /* ---------- Recipes ---------- */
  function getRecipes() {
    return _get(KEYS.recipes, []);
  }
  function saveRecipes(recipes) {
    _set(KEYS.recipes, recipes);
  }
  function addRecipe(recipe) {
    const recipes = getRecipes();
    recipe.id = recipe.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    recipe.createdAt = recipe.createdAt || new Date().toISOString();
    recipes.push(recipe);
    saveRecipes(recipes);
    return recipe;
  }
  function updateRecipe(id, updates) {
    const recipes = getRecipes();
    const idx = recipes.findIndex(r => r.id === id);
    if (idx === -1) return null;
    Object.assign(recipes[idx], updates);
    saveRecipes(recipes);
    return recipes[idx];
  }
  function deleteRecipe(id) {
    const recipes = getRecipes().filter(r => r.id !== id);
    saveRecipes(recipes);
  }

  /* ---------- Meal Plan ---------- */
  function getMealPlan() {
    return _get(KEYS.mealPlan, {});
  }
  function saveMealPlan(plan) {
    _set(KEYS.mealPlan, plan);
  }

  /* ---------- Grocery List ---------- */
  function getGroceryList() {
    return _get(KEYS.groceryList, []);
  }
  function saveGroceryList(list) {
    _set(KEYS.groceryList, list);
  }

  /* ---------- Common Items ---------- */
  function getCommonItems() {
    return _get(KEYS.commonItems, []);
  }
  function saveCommonItems(items) {
    _set(KEYS.commonItems, items);
  }

  /* ---------- Price History ---------- */
  function getPriceHistory() {
    return _get(KEYS.priceHistory, {});
  }
  function savePriceHistory(history) {
    _set(KEYS.priceHistory, history);
  }

  /* ---------- Sales ---------- */
  function getSales() {
    return _get(KEYS.sales, []);
  }
  function saveSales(sales) {
    _set(KEYS.sales, sales);
  }

  /* ---------- Chat History ---------- */
  function getChatHistory() {
    return _get(KEYS.chatHistory, []);
  }
  function saveChatHistory(history) {
    _set(KEYS.chatHistory, history);
  }

  /* ---------- Settings ---------- */
  function getSettings() {
    return _get(KEYS.settings, { householdSize: 2, budget: 150, currency: '$' });
  }
  function saveSettings(s) {
    _set(KEYS.settings, s);
  }

  /* ---------- Export / Import ---------- */
  function exportAll() {
    const data = {};
    for (const [name, key] of Object.entries(KEYS)) {
      data[name] = _get(key, null);
    }
    return data;
  }
  function importAll(data) {
    for (const [name, key] of Object.entries(KEYS)) {
      if (data[name] !== undefined) _set(key, data[name]);
    }
  }

  return {
    getRecipes, saveRecipes, addRecipe, updateRecipe, deleteRecipe,
    getMealPlan, saveMealPlan,
    getGroceryList, saveGroceryList,
    getCommonItems, saveCommonItems,
    getPriceHistory, savePriceHistory,
    getSales, saveSales,
    getChatHistory, saveChatHistory,
    getSettings, saveSettings,
    exportAll, importAll,
  };
})();

if (typeof module !== 'undefined') module.exports = { Storage };
