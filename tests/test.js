/**
 * Tests for MealOrganizer modules.
 * Run with: node tests/test.js
 */

// Minimal localStorage shim for Node
const _store = {};
const localStorage = {
  getItem: (k) => _store[k] || null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
};
global.localStorage = localStorage;

// Minimal document shim for escapeHtml
global.document = { createElement: () => ({ set textContent(v) { this._t = v; }, get innerHTML() { return (this._t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); } }) };

// Load modules — each depends on prior globals
const { Storage } = require('../js/storage.js');
global.Storage = Storage;
const { Recipes } = require('../js/recipes.js');
global.Recipes = Recipes;
const { Meals } = require('../js/meals.js');
global.Meals = Meals;
const { Groceries } = require('../js/groceries.js');
global.Groceries = Groceries;
const { Prices } = require('../js/prices.js');
global.Prices = Prices;
const { Chat } = require('../js/chat.js');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function resetStorage() {
  localStorage.clear();
}

// === Storage Tests ===
console.log('\n--- Storage ---');
resetStorage();
assert(Storage.getRecipes().length === 0, 'starts with empty recipes');
const r1 = Storage.addRecipe({ name: 'Test Recipe', ingredients: [{ item: 'flour', qty: '2', unit: 'cups' }], category: 'Dinner' });
assert(r1.id !== undefined, 'addRecipe returns an object with id');
assert(Storage.getRecipes().length === 1, 'recipe is persisted');
Storage.updateRecipe(r1.id, { name: 'Updated Recipe' });
assert(Storage.getRecipes()[0].name === 'Updated Recipe', 'updateRecipe works');
Storage.deleteRecipe(r1.id);
assert(Storage.getRecipes().length === 0, 'deleteRecipe removes recipe');

assert(Array.isArray(Storage.getGroceryList()), 'getGroceryList returns array');
assert(typeof Storage.getMealPlan() === 'object', 'getMealPlan returns object');
assert(typeof Storage.getSettings() === 'object', 'getSettings returns object with defaults');
assert(Storage.getSettings().budget === 150, 'default budget is 150');

// Export/Import
resetStorage();
Storage.addRecipe({ name: 'Export Test' });
const exported = Storage.exportAll();
assert(exported.recipes.length === 1, 'exportAll includes recipes');
resetStorage();
Storage.importAll(exported);
assert(Storage.getRecipes().length === 1, 'importAll restores recipes');

// === Recipes Tests ===
console.log('\n--- Recipes ---');
resetStorage();
const recipe1 = Recipes.create({ name: 'Pasta Carbonara', ingredients: [{ item: 'pasta', qty: '1', unit: 'lb' }, { item: 'bacon', qty: '4', unit: 'slices' }], category: 'Dinner', tags: ['italian', 'quick'] });
assert(recipe1.name === 'Pasta Carbonara', 'create returns recipe with name');
assert(recipe1.timesCooked === 0, 'new recipe has 0 timesCooked');

const recipe2 = Recipes.create({ name: 'Scrambled Eggs', ingredients: [{ item: 'eggs', qty: '3', unit: '' }], category: 'Breakfast' });
assert(Recipes.getAll().length === 2, 'two recipes exist');
assert(Recipes.getById(recipe1.id).name === 'Pasta Carbonara', 'getById works');

const searchResults = Recipes.search('pasta');
assert(searchResults.length === 1, 'search by name works');
const searchByTag = Recipes.search('italian');
assert(searchByTag.length === 1, 'search by tag works');
const searchByIng = Recipes.search('bacon');
assert(searchByIng.length === 1, 'search by ingredient works');

assert(Recipes.getByCategory('Dinner').length === 1, 'getByCategory works');
assert(Recipes.getByCategory('Breakfast').length === 1, 'getByCategory for Breakfast');

Recipes.markCooked(recipe1.id);
assert(Recipes.getById(recipe1.id).timesCooked === 1, 'markCooked increments count');
Recipes.markCooked(recipe1.id);
assert(Recipes.getById(recipe1.id).timesCooked === 2, 'markCooked increments again');

Recipes.rate(recipe1.id, 4);
assert(Recipes.getById(recipe1.id).rating === 4, 'rate sets rating');
Recipes.rate(recipe1.id, 10);
assert(Recipes.getById(recipe1.id).rating === 5, 'rate clamps to 5');

const parsed = Recipes.parseIngredientText('2 cups flour\n1 tsp salt\ngarlic');
assert(parsed.length === 3, 'parseIngredientText parses 3 lines');
assert(parsed[0].qty === '2', 'parsed qty');
assert(parsed[0].unit === 'cups', 'parsed unit');
assert(parsed[0].item === 'flour', 'parsed item');
assert(parsed[2].item === 'garlic', 'item without qty/unit');

const parsedRecipe = Recipes.parseRecipeFromText(`My Great Recipe\nServings: 6\nIngredients\n2 cups rice\n1 can beans\nInstructions\nCook the rice.\nAdd the beans.`);
assert(parsedRecipe.name === 'My Great Recipe', 'parseRecipeFromText extracts name');
assert(parsedRecipe.servings === 6, 'parseRecipeFromText extracts servings');
assert(parsedRecipe.ingredients.length === 2, 'parseRecipeFromText extracts ingredients');

Recipes.remove(recipe2.id);
assert(Recipes.getAll().length === 1, 'remove deletes recipe');

// === Meals Tests ===
console.log('\n--- Meals ---');
resetStorage();
Recipes.create({ name: 'Test Dinner', ingredients: [{ item: 'chicken', qty: '2', unit: 'lbs' }], category: 'Dinner', servings: 4 });
const weekId = Meals.currentWeekId();
assert(typeof weekId === 'string', 'currentWeekId returns string');
assert(weekId.match(/^\d{4}-\d{2}-\d{2}$/), 'weekId is date format');

const plan = Meals.getCurrentPlan();
assert(plan.Monday !== undefined, 'plan has Monday');
assert(plan.Sunday !== undefined, 'plan has Sunday');
assert(plan.Monday.Dinner === null, 'Monday dinner starts null');

Meals.setMeal(weekId, 'Monday', 'Dinner', { recipeId: null, name: 'Tacos', servings: 4 });
const updated = Meals.getPlan(weekId);
assert(updated.Monday.Dinner.name === 'Tacos', 'setMeal works');

Meals.removeMeal(weekId, 'Monday', 'Dinner');
assert(Meals.getPlan(weekId).Monday.Dinner === null, 'removeMeal works');

const summary = Meals.getSummary(weekId);
assert(summary.totalSlots === 28, 'totalSlots is 7 days * 4 slots');
assert(summary.percentPlanned === 0, '0% when nothing planned');

Meals.setMeal(weekId, 'Tuesday', 'Lunch', { recipeId: null, name: 'Salad', servings: 2 });
const summary2 = Meals.getSummary(weekId);
assert(summary2.filledSlots === 1, 'filledSlots counts correctly');

assert(Meals.DAYS.length === 7, 'DAYS has 7 entries');
assert(Meals.SLOTS.length === 4, 'SLOTS has 4 entries');

// Test ingredient aggregation
resetStorage();
const chickenRecipe = Recipes.create({ name: 'Chicken Rice', ingredients: [{ item: 'chicken', qty: '1', unit: 'lb' }, { item: 'rice', qty: '2', unit: 'cups' }], servings: 4 });
const wk = Meals.currentWeekId();
Meals.setMeal(wk, 'Monday', 'Dinner', { recipeId: chickenRecipe.id, name: 'Chicken Rice', servings: 4 });
Meals.setMeal(wk, 'Wednesday', 'Dinner', { recipeId: chickenRecipe.id, name: 'Chicken Rice', servings: 4 });
const ings = Meals.getIngredientsForWeek(wk);
const chickenIng = ings.find(i => i.item === 'chicken');
assert(chickenIng.qty === 2, 'aggregates same ingredient across meals');

// === Groceries Tests ===
console.log('\n--- Groceries ---');
resetStorage();
assert(Groceries.getList().length === 0, 'starts with empty grocery list');

Groceries.addItem({ item: 'Milk', qty: '1', unit: 'gallon' });
assert(Groceries.getList().length === 1, 'addItem adds to list');
assert(Groceries.getList()[0].aisle === 'Dairy', 'auto-assigns Dairy aisle for milk');

Groceries.addItem({ item: 'Chicken Breast', qty: '2', unit: 'lbs' });
assert(Groceries.getList()[1].aisle === 'Meat & Seafood', 'auto-assigns Meat aisle for chicken');

Groceries.addItem({ item: 'Broccoli' });
assert(Groceries.guessAisle('Broccoli') === 'Produce', 'guessAisle for broccoli');

Groceries.addItem({ item: 'Something Random' });
assert(Groceries.guessAisle('Something Random') === 'Other', 'unknown items get Other aisle');

// Duplicate aggregation
Groceries.addItem({ item: 'Milk', qty: '2', unit: 'gallon' });
assert(Groceries.getList().length === 4, 'duplicate does not create new entry — aggregates qty');
const milkItem = Groceries.getList().find(i => i.item === 'Milk');
assert(milkItem.qty === 3, 'aggregated qty is 3');

// Toggle & clear
const firstId = Groceries.getList()[0].id;
Groceries.toggleItem(firstId);
assert(Groceries.getList().find(i => i.id === firstId).checked === true, 'toggleItem checks item');
Groceries.toggleItem(firstId);
assert(Groceries.getList().find(i => i.id === firstId).checked === false, 'toggleItem unchecks item');

Groceries.toggleItem(firstId);
Groceries.clearChecked();
assert(Groceries.getList().find(i => i.id === firstId) === undefined, 'clearChecked removes checked');

// Grouped by aisle
const grouped = Groceries.getByAisle();
assert(typeof grouped === 'object', 'getByAisle returns object');

const stats = Groceries.getStats();
assert(stats.total > 0, 'getStats returns total');

// Common items
const common = Groceries.getCommonItems();
assert(common.length > 0, 'common items tracked');
assert(common[0].count >= 1, 'common items have count');

// Generate from meal plan
resetStorage();
const genRecipe = Recipes.create({ name: 'Gen Test', ingredients: [{ item: 'tomato', qty: '3', unit: '' }], servings: 2 });
Meals.setMeal(Meals.currentWeekId(), 'Monday', 'Dinner', { recipeId: genRecipe.id, name: 'Gen Test', servings: 2 });
const genList = Groceries.generateFromMealPlan();
assert(genList.length === 1, 'generateFromMealPlan creates list');
assert(genList[0].item === 'tomato', 'generated item is correct');

Groceries.clearAll();
assert(Groceries.getList().length === 0, 'clearAll empties list');

// === Prices Tests ===
console.log('\n--- Prices ---');
resetStorage();
Prices.logPrice('Milk', 3.99, 'Walmart');
Prices.logPrice('Milk', 4.49, 'Target');
Prices.logPrice('Milk', 3.79, 'Aldi');

const milkStats = Prices.getStats('Milk');
assert(milkStats !== null, 'getStats returns data');
assert(milkStats.entries === 3, '3 price entries');
assert(milkStats.min === 3.79, 'min price is 3.79');
assert(milkStats.max === 4.49, 'max price is 4.49');
assert(milkStats.cheapestStore === 'Aldi', 'cheapest store is Aldi');
assert(typeof milkStats.average === 'number', 'average is number');

const tracked = Prices.getAllTracked();
assert(tracked.length === 1, 'one tracked item');

Prices.addSale({ item: 'Eggs', salePrice: 2.49, store: 'Kroger', validUntil: '2099-12-31' });
const sales = Prices.getActiveSales();
assert(sales.length === 1, 'one active sale');
assert(sales[0].item === 'Eggs', 'sale item is Eggs');

// Sale alerts with matching grocery item
Groceries.addItem({ item: 'Eggs', source: 'test' });
const alerts = Prices.getSaleAlerts();
assert(alerts.length === 1, 'sale alert for matching grocery item');
assert(alerts[0].sale.store === 'Kroger', 'alert has correct store');

Prices.removeSale(sales[0].id);
assert(Prices.getActiveSales().length === 0, 'removeSale works');

const spending = Prices.getSpendingSummary();
assert(spending.itemCount >= 3, 'spending summary counts entries');

assert(Prices.getStats('Nonexistent') === null, 'getStats returns null for unknown');

// === Chat Tests ===
console.log('\n--- Chat ---');
resetStorage();
Recipes.create({ name: 'Grilled Salmon', ingredients: [{ item: 'salmon', qty: '1', unit: 'lb' }], category: 'Dinner', tags: ['healthy'] });

let res = Chat.process('help');
assert(res.reply.includes('Meal Planning'), 'help shows Meal Planning');

res = Chat.process('plan grilled salmon for monday dinner');
assert(res.reply.includes('Grilled Salmon'), 'plan command finds recipe');
assert(res.action === 'refreshMeals', 'plan returns refreshMeals action');

res = Chat.process('show this week\'s plan');
assert(res.reply.includes('Monday'), 'show plan includes Monday');
assert(res.reply.includes('Grilled Salmon'), 'show plan includes planned meal');

res = Chat.process('clear monday dinner');
assert(res.reply.includes('Cleared'), 'clear meal command works');

res = Chat.process('show recipes');
assert(res.reply.includes('Grilled Salmon'), 'show recipes lists recipe');

res = Chat.process('search recipes healthy');
assert(res.reply.includes('Grilled Salmon'), 'search by tag works');

res = Chat.process('show recipe grilled salmon');
assert(res.reply.includes('salmon'), 'show recipe detail works');

res = Chat.process('add bananas to grocery list');
assert(res.reply.includes('bananas'), 'add to grocery list works');
assert(res.action === 'refreshGroceries', 'add returns refreshGroceries action');

res = Chat.process('show grocery list');
assert(res.reply.includes('bananas'), 'show grocery list has added item');

res = Chat.process('check off bananas');
assert(res.reply.includes('checked'), 'check off command works');

res = Chat.process('log price milk 3.99 at walmart');
assert(res.reply.includes('milk'), 'log price command works');

res = Chat.process('sale eggs 1.99 at kroger until 2099-12-31');
assert(res.reply.includes('eggs'), 'add sale command works');

res = Chat.process('show sales');
assert(res.reply.includes('eggs'), 'show sales works');

res = Chat.process('price history milk');
assert(res.reply.includes('3.99'), 'price history shows logged price');

res = Chat.process('stats');
assert(res.reply.includes('Total logged'), 'stats command works');

res = Chat.process('suggest');
assert(res.reply.includes('Grilled Salmon'), 'suggest returns recipes');

res = Chat.process('import recipe Test Import\nIngredients\n2 cups flour\n1 egg\nInstructions\nMix together');
assert(res.reply.includes('Imported'), 'import recipe works');

res = Chat.process('delete recipe test import');
assert(res.reply.includes('Deleted'), 'delete recipe works');

res = Chat.process('');
assert(res.reply.includes('help'), 'empty input prompts help');

res = Chat.process('gibberish xyz');
assert(res.reply.includes("didn't understand"), 'unknown input gets fallback');

res = Chat.process('show common items');
assert(res.reply !== undefined, 'common items command works');

// === Final Summary ===
console.log(`\n========================================`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================`);
process.exit(failed > 0 ? 1 : 0);
