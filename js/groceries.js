/**
 * Grocery list management — auto-generate from meal plan, track common items, manage checklist.
 */
const Groceries = (() => {
  const AISLES = [
    'Produce', 'Dairy', 'Meat & Seafood', 'Bakery', 'Frozen',
    'Canned Goods', 'Grains & Pasta', 'Snacks', 'Beverages',
    'Condiments & Spices', 'Household', 'Other'
  ];

  const AISLE_MAP = {
    // Produce
    apple: 'Produce', banana: 'Produce', lettuce: 'Produce', tomato: 'Produce', tomatoes: 'Produce',
    onion: 'Produce', onions: 'Produce', garlic: 'Produce', potato: 'Produce', potatoes: 'Produce',
    carrot: 'Produce', carrots: 'Produce', broccoli: 'Produce', spinach: 'Produce', pepper: 'Produce',
    peppers: 'Produce', cucumber: 'Produce', avocado: 'Produce', lemon: 'Produce', lime: 'Produce',
    cilantro: 'Produce', parsley: 'Produce', basil: 'Produce', mushroom: 'Produce', mushrooms: 'Produce',
    celery: 'Produce', ginger: 'Produce', corn: 'Produce', zucchini: 'Produce', kale: 'Produce',
    // Dairy
    milk: 'Dairy', cheese: 'Dairy', butter: 'Dairy', yogurt: 'Dairy', cream: 'Dairy',
    'sour cream': 'Dairy', eggs: 'Dairy', 'cream cheese': 'Dairy', 'heavy cream': 'Dairy',
    // Meat
    chicken: 'Meat & Seafood', beef: 'Meat & Seafood', pork: 'Meat & Seafood', salmon: 'Meat & Seafood',
    shrimp: 'Meat & Seafood', turkey: 'Meat & Seafood', bacon: 'Meat & Seafood', sausage: 'Meat & Seafood',
    'ground beef': 'Meat & Seafood', 'chicken breast': 'Meat & Seafood', fish: 'Meat & Seafood',
    // Bakery
    bread: 'Bakery', tortillas: 'Bakery', buns: 'Bakery', rolls: 'Bakery', bagels: 'Bakery',
    // Grains
    rice: 'Grains & Pasta', pasta: 'Grains & Pasta', noodles: 'Grains & Pasta', flour: 'Grains & Pasta',
    oats: 'Grains & Pasta', quinoa: 'Grains & Pasta', cereal: 'Grains & Pasta', couscous: 'Grains & Pasta',
    // Canned
    'tomato sauce': 'Canned Goods', 'diced tomatoes': 'Canned Goods', beans: 'Canned Goods',
    'black beans': 'Canned Goods', 'kidney beans': 'Canned Goods', 'chickpeas': 'Canned Goods',
    'coconut milk': 'Canned Goods', broth: 'Canned Goods', 'chicken broth': 'Canned Goods',
    // Condiments & Spices
    'olive oil': 'Condiments & Spices', 'soy sauce': 'Condiments & Spices', salt: 'Condiments & Spices',
    'black pepper': 'Condiments & Spices', cumin: 'Condiments & Spices', paprika: 'Condiments & Spices',
    oregano: 'Condiments & Spices', 'chili powder': 'Condiments & Spices', vinegar: 'Condiments & Spices',
    mustard: 'Condiments & Spices', ketchup: 'Condiments & Spices', mayo: 'Condiments & Spices',
    honey: 'Condiments & Spices', sugar: 'Condiments & Spices',
    // Frozen
    'frozen peas': 'Frozen', 'ice cream': 'Frozen', 'frozen berries': 'Frozen',
    // Beverages
    coffee: 'Beverages', tea: 'Beverages', juice: 'Beverages', water: 'Beverages',
    // Snacks
    chips: 'Snacks', crackers: 'Snacks', nuts: 'Snacks',
  };

  function guessAisle(itemName) {
    const lower = itemName.toLowerCase().trim();
    if (AISLE_MAP[lower]) return AISLE_MAP[lower];
    for (const [keyword, aisle] of Object.entries(AISLE_MAP)) {
      if (lower.includes(keyword) || keyword.includes(lower)) return aisle;
    }
    return 'Other';
  }

  function getList() {
    return Storage.getGroceryList();
  }

  function saveList(list) {
    Storage.saveGroceryList(list);
  }

  function addItem({ item, qty = '', unit = '', aisle = '', checked = false, source = 'manual', price = null }) {
    const list = getList();
    const normalized = item.toLowerCase().trim();
    const existing = list.find(i => i.item.toLowerCase().trim() === normalized);
    if (existing) {
      const newQty = (parseFloat(existing.qty) || 0) + (parseFloat(qty) || 0);
      existing.qty = newQty || existing.qty;
      if (source && !existing.sources?.includes(source)) {
        existing.sources = existing.sources || [];
        existing.sources.push(source);
      }
    } else {
      list.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        item,
        qty,
        unit,
        aisle: aisle || guessAisle(item),
        checked,
        source,
        sources: [source],
        price,
        addedAt: new Date().toISOString(),
      });
    }
    saveList(list);
    _trackCommonItem(item);
    return list;
  }

  function removeItem(id) {
    const list = getList().filter(i => i.id !== id);
    saveList(list);
  }

  function toggleItem(id) {
    const list = getList();
    const item = list.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      saveList(list);
    }
  }

  function clearChecked() {
    const list = getList().filter(i => !i.checked);
    saveList(list);
  }

  function clearAll() {
    saveList([]);
  }

  function generateFromMealPlan(weekId) {
    const ingredients = Meals.getIngredientsForWeek(weekId || Meals.currentWeekId());
    clearAll();
    for (const ing of ingredients) {
      addItem({
        item: ing.item,
        qty: ing.qty ? String(Math.ceil(ing.qty * 10) / 10) : '',
        unit: ing.unit,
        source: 'meal-plan',
      });
    }
    return getList();
  }

  function getByAisle() {
    const list = getList();
    const grouped = {};
    for (const item of list) {
      const a = item.aisle || 'Other';
      if (!grouped[a]) grouped[a] = [];
      grouped[a].push(item);
    }
    return grouped;
  }

  function _trackCommonItem(itemName) {
    const common = Storage.getCommonItems();
    const lower = itemName.toLowerCase().trim();
    const existing = common.find(c => c.item.toLowerCase() === lower);
    if (existing) {
      existing.count = (existing.count || 0) + 1;
      existing.lastAdded = new Date().toISOString();
    } else {
      common.push({ item: itemName, count: 1, lastAdded: new Date().toISOString() });
    }
    Storage.saveCommonItems(common);
  }

  function getCommonItems(limit = 20) {
    return Storage.getCommonItems()
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, limit);
  }

  function getStats() {
    const list = getList();
    const total = list.length;
    const checked = list.filter(i => i.checked).length;
    const totalCost = list.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
    return { total, checked, remaining: total - checked, totalCost };
  }

  return {
    AISLES,
    getList, saveList, addItem, removeItem, toggleItem,
    clearChecked, clearAll,
    generateFromMealPlan, getByAisle,
    guessAisle, getCommonItems, getStats,
  };
})();

if (typeof module !== 'undefined') module.exports = { Groceries };
