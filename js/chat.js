/**
 * Conversational interface — parse natural-language commands and route to actions.
 */
const Chat = (() => {
  const HELP_TEXT = `Here's what I can help with:

**Meal Planning**
• "plan chicken stir fry for Monday dinner"
• "what's for dinner Tuesday?"
• "show this week's plan"
• "clear Wednesday lunch"

**Recipes**
• "add recipe [name]" — start adding a new recipe
• "show recipes" / "search recipes [query]"
• "import recipe [paste text]"
• "show recipe [name]"
• "delete recipe [name]"

**Grocery List**
• "add [item] to grocery list"
• "generate grocery list" — from meal plan
• "show grocery list"
• "check off [item]"
• "clear checked items"
• "show common items"

**Prices & Sales**
• "log price [item] [price] at [store]"
• "add sale [item] [price] at [store] until [date]"
• "show sales" / "check sales"
• "price history [item]"
• "price stats" / "spending summary"

**General**
• "suggest meals" — get recipe suggestions
• "help" — show this message`;

  function process(input) {
    const text = input.trim();
    const lower = text.toLowerCase();

    if (!text) return { reply: "Type something or say 'help' to see what I can do." };

    // Help
    if (lower === 'help' || lower === '?') {
      return { reply: HELP_TEXT };
    }

    // --- Meal Planning ---
    const planMatch = lower.match(/^plan\s+(.+?)\s+for\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(breakfast|lunch|dinner|snack)$/i);
    if (planMatch) {
      return _planMeal(planMatch[1], planMatch[2], planMatch[3]);
    }

    if (lower.match(/^(?:show|view|what'?s?)\s+(?:this\s+)?week'?s?\s*(?:plan|meals?)?$/i) || lower === 'plan') {
      return _showWeekPlan();
    }

    const whatFor = lower.match(/^what'?s?\s+(?:for\s+)?(breakfast|lunch|dinner|snack)\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\??$/i)
      || lower.match(/^what'?s?\s+(?:for\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(breakfast|lunch|dinner|snack)\??$/i);
    if (whatFor) {
      const day = _capitalize(whatFor[2] || whatFor[1]);
      const slot = _capitalize(whatFor[1].match(/day/i) ? whatFor[2] : whatFor[1]);
      return _showMealSlot(day, slot);
    }

    const clearMeal = lower.match(/^(?:clear|remove)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(breakfast|lunch|dinner|snack)$/i);
    if (clearMeal) {
      const day = _capitalize(clearMeal[1]);
      const slot = _capitalize(clearMeal[2]);
      Meals.removeMeal(Meals.currentWeekId(), day, slot);
      return { reply: `Cleared ${day} ${slot}.` };
    }

    // --- Recipes ---
    if (lower.match(/^(?:show|list|view)\s+recipes?$/i) || lower === 'recipes') {
      return _showRecipes();
    }

    const searchRecipe = lower.match(/^search\s+recipes?\s+(.+)$/i);
    if (searchRecipe) {
      return _searchRecipes(searchRecipe[1]);
    }

    const showRecipe = lower.match(/^show\s+recipe\s+(.+)$/i);
    if (showRecipe) {
      return _showRecipeDetail(showRecipe[1]);
    }

    const addRecipeCmd = lower.match(/^add\s+recipe\s+(.+)$/i);
    if (addRecipeCmd) {
      return { reply: `To add "${addRecipeCmd[1]}", use the recipe form in the Recipes tab. You can add ingredients, instructions, and more there.`, action: 'openRecipeForm', data: { name: addRecipeCmd[1] } };
    }

    const deleteRecipe = lower.match(/^delete\s+recipe\s+(.+)$/i);
    if (deleteRecipe) {
      return _deleteRecipe(deleteRecipe[1]);
    }

    const importRecipe = lower.match(/^import\s+recipe\s*([\s\S]*)$/i);
    if (importRecipe && importRecipe[1].trim()) {
      return _importRecipe(importRecipe[1].trim());
    }

    // --- Grocery List ---
    const addGrocery = lower.match(/^add\s+(.+?)(?:\s+to\s+(?:grocery|shopping)\s*(?:list)?)?$/i);
    if (lower.startsWith('add ') && !lower.includes('recipe') && !lower.includes('sale')) {
      const item = text.replace(/^add\s+/i, '').replace(/\s+to\s+(?:grocery|shopping)\s*(?:list)?$/i, '').trim();
      if (item) {
        Groceries.addItem({ item, source: 'chat' });
        return { reply: `Added **${item}** to the grocery list.`, action: 'refreshGroceries' };
      }
    }

    if (lower.match(/^(?:generate|build|create)\s+(?:grocery|shopping)\s*(?:list)?$/i)) {
      const list = Groceries.generateFromMealPlan();
      return { reply: `Generated grocery list from meal plan: **${list.length}** items.`, action: 'refreshGroceries' };
    }

    if (lower.match(/^(?:show|view)\s+(?:grocery|shopping)\s*(?:list)?$/i) || lower === 'groceries') {
      return _showGroceryList();
    }

    const checkOff = lower.match(/^(?:check|tick|done|bought)\s+(?:off\s+)?(.+)$/i);
    if (checkOff) {
      return _checkOffItem(checkOff[1]);
    }

    if (lower.match(/^clear\s+checked/i)) {
      Groceries.clearChecked();
      return { reply: 'Cleared all checked items from the grocery list.', action: 'refreshGroceries' };
    }

    if (lower.match(/^(?:show\s+)?common\s+items?$/i)) {
      return _showCommonItems();
    }

    // --- Prices & Sales ---
    const logPriceCmd = lower.match(/^(?:log\s+)?price\s+(.+?)\s+\$?([\d.]+)\s+(?:at\s+)?(.+)$/i);
    if (logPriceCmd) {
      Prices.logPrice(logPriceCmd[1], logPriceCmd[2], logPriceCmd[3]);
      return { reply: `Logged **${logPriceCmd[1]}** at $${logPriceCmd[2]} (${logPriceCmd[3]}).`, action: 'refreshPrices' };
    }

    const addSaleCmd = lower.match(/^(?:add\s+)?sale\s+(.+?)\s+\$?([\d.]+)\s+(?:at\s+)?(.+?)(?:\s+until\s+(.+))?$/i);
    if (addSaleCmd) {
      Prices.addSale({ item: addSaleCmd[1], salePrice: addSaleCmd[2], store: addSaleCmd[3], validUntil: addSaleCmd[4] || '' });
      return { reply: `Sale added: **${addSaleCmd[1]}** for $${addSaleCmd[2]} at ${addSaleCmd[3]}${addSaleCmd[4] ? ` until ${addSaleCmd[4]}` : ''}.`, action: 'refreshPrices' };
    }

    if (lower.match(/^(?:show\s+|check\s+)?sales?$/i)) {
      return _showSales();
    }

    const priceHist = lower.match(/^price\s+history\s+(.+)$/i);
    if (priceHist) {
      return _showPriceHistory(priceHist[1]);
    }

    if (lower.match(/^(?:price\s+)?stats?$/i) || lower.match(/^spending/i)) {
      return _showPriceStats();
    }

    // --- Suggestions ---
    if (lower.match(/^suggest/i)) {
      return _showSuggestions();
    }

    // Fallback
    return { reply: `I didn't understand that. Type **help** to see what I can do.` };
  }

  /* --- Internal command handlers --- */

  function _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function _planMeal(recipeName, day, slot) {
    day = _capitalize(day);
    slot = _capitalize(slot);
    const results = Recipes.search(recipeName);
    if (results.length > 0) {
      const recipe = results[0];
      Meals.setMeal(Meals.currentWeekId(), day, slot, {
        recipeId: recipe.id, name: recipe.name, servings: recipe.servings
      });
      return { reply: `Planned **${recipe.name}** for ${day} ${slot}.`, action: 'refreshMeals' };
    }
    Meals.setMeal(Meals.currentWeekId(), day, slot, {
      recipeId: null, name: recipeName, servings: 2
    });
    return { reply: `Planned **${recipeName}** for ${day} ${slot}. (No matching recipe found — added as a custom meal.)`, action: 'refreshMeals' };
  }

  function _showWeekPlan() {
    const plan = Meals.getCurrentPlan();
    const summary = Meals.getSummary(Meals.currentWeekId());
    let msg = `**This Week's Meal Plan** (${summary.percentPlanned}% planned)\n\n`;
    for (const day of Meals.DAYS) {
      const dayMeals = [];
      for (const slot of Meals.SLOTS) {
        const m = plan[day]?.[slot];
        if (m) dayMeals.push(`${slot}: ${m.name}`);
      }
      msg += `**${day}**: ${dayMeals.length ? dayMeals.join(' | ') : '_empty_'}\n`;
    }
    return { reply: msg };
  }

  function _showMealSlot(day, slot) {
    const plan = Meals.getCurrentPlan();
    const m = plan[day]?.[slot];
    if (m) return { reply: `${day} ${slot}: **${m.name}**` };
    return { reply: `Nothing planned for ${day} ${slot} yet.` };
  }

  function _showRecipes() {
    const recipes = Recipes.getAll();
    if (recipes.length === 0) return { reply: 'No recipes yet. Add one with the recipe form or say "import recipe [text]".' };
    let msg = `**Recipes** (${recipes.length})\n\n`;
    for (const r of recipes) {
      const stars = r.rating ? ' ' + '★'.repeat(r.rating) : '';
      msg += `• **${r.name}** — ${r.category}${stars} (cooked ${r.timesCooked || 0}x)\n`;
    }
    return { reply: msg };
  }

  function _searchRecipes(query) {
    const results = Recipes.search(query);
    if (results.length === 0) return { reply: `No recipes found for "${query}".` };
    let msg = `**Search results for "${query}"** (${results.length})\n\n`;
    for (const r of results) msg += `• **${r.name}** — ${r.category}\n`;
    return { reply: msg };
  }

  function _showRecipeDetail(name) {
    const results = Recipes.search(name);
    if (results.length === 0) return { reply: `No recipe found matching "${name}".` };
    const r = results[0];
    let msg = `**${r.name}**\nCategory: ${r.category} | Servings: ${r.servings}`;
    if (r.prepTime) msg += ` | Prep: ${r.prepTime}`;
    if (r.cookTime) msg += ` | Cook: ${r.cookTime}`;
    msg += `\n\n**Ingredients:**\n`;
    for (const i of r.ingredients) {
      msg += `• ${i.qty} ${i.unit} ${i.item}\n`;
    }
    if (r.instructions) msg += `\n**Instructions:**\n${r.instructions}\n`;
    if (r.tags.length) msg += `\nTags: ${r.tags.join(', ')}`;
    return { reply: msg };
  }

  function _deleteRecipe(name) {
    const results = Recipes.search(name);
    if (results.length === 0) return { reply: `No recipe found matching "${name}".` };
    Recipes.remove(results[0].id);
    return { reply: `Deleted recipe **${results[0].name}**.`, action: 'refreshRecipes' };
  }

  function _importRecipe(text) {
    const parsed = Recipes.parseRecipeFromText(text);
    if (!parsed.name) parsed.name = 'Imported Recipe ' + new Date().toLocaleDateString();
    const recipe = Recipes.create(parsed);
    return { reply: `Imported recipe **${recipe.name}** with ${recipe.ingredients.length} ingredients.`, action: 'refreshRecipes' };
  }

  function _showGroceryList() {
    const grouped = Groceries.getByAisle();
    const stats = Groceries.getStats();
    if (stats.total === 0) return { reply: 'Grocery list is empty. Say "generate grocery list" to build one from your meal plan.' };
    let msg = `**Grocery List** (${stats.remaining} remaining, ${stats.checked} checked)\n\n`;
    for (const [aisle, items] of Object.entries(grouped)) {
      msg += `**${aisle}**\n`;
      for (const i of items) {
        const check = i.checked ? '~~' : '';
        msg += `• ${check}${i.qty ? i.qty + ' ' : ''}${i.unit ? i.unit + ' ' : ''}${i.item}${check}\n`;
      }
      msg += '\n';
    }
    const alerts = Prices.getSaleAlerts();
    if (alerts.length > 0) {
      msg += `**Sale Alerts!**\n`;
      for (const a of alerts) msg += `• ${a.message}\n`;
    }
    return { reply: msg };
  }

  function _checkOffItem(name) {
    const list = Groceries.getList();
    const item = list.find(i => i.item.toLowerCase().includes(name.toLowerCase()));
    if (!item) return { reply: `"${name}" not found on the grocery list.` };
    Groceries.toggleItem(item.id);
    const state = item.checked ? 'unchecked' : 'checked off';
    return { reply: `${state} **${item.item}**.`, action: 'refreshGroceries' };
  }

  function _showCommonItems() {
    const common = Groceries.getCommonItems();
    if (common.length === 0) return { reply: 'No common items tracked yet. Items you add frequently will appear here.' };
    let msg = '**Frequently Added Items**\n\n';
    for (const c of common) msg += `• ${c.item} (${c.count}x)\n`;
    return { reply: msg };
  }

  function _showSales() {
    const sales = Prices.getActiveSales();
    if (sales.length === 0) return { reply: 'No active sales. Say "add sale [item] [price] at [store]" to add one.' };
    let msg = '**Active Sales**\n\n';
    for (const s of sales) {
      msg += `• **${s.item}** — $${s.salePrice} at ${s.store}`;
      if (s.validUntil) msg += ` (until ${s.validUntil})`;
      msg += '\n';
    }
    return { reply: msg };
  }

  function _showPriceHistory(itemName) {
    const stats = Prices.getStats(itemName);
    if (!stats) return { reply: `No price history for "${itemName}".` };
    let msg = `**Price History: ${stats.item}**\n`;
    msg += `Average: $${stats.average} | Low: $${stats.min} | High: $${stats.max}\n`;
    msg += `Latest: $${stats.latest} | Trend: ${stats.trend}\n`;
    msg += `Best store: ${stats.cheapestStore} | ${stats.entries} price entries`;
    return { reply: msg };
  }

  function _showPriceStats() {
    const summary = Prices.getSpendingSummary();
    const tracked = Prices.getAllTracked();
    let msg = `**Price Stats**\nTotal logged: $${summary.totalSpent} across ${summary.itemCount} entries\n\n`;
    if (tracked.length > 0) {
      msg += '**Tracked Items:**\n';
      for (const t of tracked.slice(0, 10)) {
        msg += `• ${t.item}: avg $${t.average} (${t.trend})\n`;
      }
    }
    return { reply: msg };
  }

  function _showSuggestions() {
    const top = Recipes.getSuggestions();
    if (top.length === 0) return { reply: 'No recipes yet to suggest. Add some recipes first!' };
    let msg = '**Meal Suggestions**\n\n';
    for (const r of top) msg += `• **${r.name}** — ${r.category} (rated ${r.rating || 0}/5, cooked ${r.timesCooked || 0}x)\n`;
    return { reply: msg };
  }

  return { process, HELP_TEXT };
})();

if (typeof module !== 'undefined') module.exports = { Chat };
