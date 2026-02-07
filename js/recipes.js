/**
 * Recipe management — create, edit, import from URL, tag, search.
 */
const Recipes = (() => {
  const CATEGORIES = [
    'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Side', 'Drink', 'Other'
  ];

  function create({ name, ingredients = [], instructions = '', servings = 4, prepTime = '', cookTime = '', category = 'Dinner', tags = [], source = 'manual', sourceUrl = '' }) {
    return Storage.addRecipe({
      name,
      ingredients,   // [{ item, qty, unit }]
      instructions,
      servings,
      prepTime,
      cookTime,
      category,
      tags,
      source,
      sourceUrl,
      timesCooked: 0,
      rating: 0,
    });
  }

  function getAll() {
    return Storage.getRecipes();
  }

  function getById(id) {
    return Storage.getRecipes().find(r => r.id === id) || null;
  }

  function search(query) {
    const q = query.toLowerCase();
    return getAll().filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.category.toLowerCase().includes(q) ||
      r.ingredients.some(i => i.item.toLowerCase().includes(q))
    );
  }

  function getByCategory(cat) {
    return getAll().filter(r => r.category === cat);
  }

  function remove(id) {
    Storage.deleteRecipe(id);
  }

  function update(id, changes) {
    return Storage.updateRecipe(id, changes);
  }

  function markCooked(id) {
    const recipe = getById(id);
    if (recipe) update(id, { timesCooked: (recipe.timesCooked || 0) + 1 });
  }

  function rate(id, rating) {
    update(id, { rating: Math.max(0, Math.min(5, rating)) });
  }

  function parseIngredientText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.map(line => {
      const match = line.match(/^([\d./]+)\s*(cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l|cans?|bunch|cloves?|slices?|pieces?|whole|pinch|dash|large|medium|small|pkg|package|bags?)\s+(?:of\s+)?(.+)/i);
      if (match) {
        return { qty: match[1], unit: (match[2] || '').toLowerCase(), item: match[3].trim() };
      }
      return { qty: '', unit: '', item: line };
    });
  }

  function parseRecipeFromText(text) {
    const recipe = {
      name: '',
      ingredients: [],
      instructions: '',
      servings: 4,
      prepTime: '',
      cookTime: '',
      category: 'Dinner',
      tags: [],
      source: 'imported',
      sourceUrl: '',
    };

    const nameMatch = text.match(/^#?\s*(.+?)(?:\n|$)/);
    if (nameMatch) recipe.name = nameMatch[1].trim();

    const ingStart = text.search(/ingredients?/i);
    const instrStart = text.search(/(?:instructions?|directions?|method|steps?|preparation)/i);

    if (ingStart !== -1) {
      const end = instrStart !== -1 ? instrStart : text.length;
      const ingSection = text.slice(ingStart, end);
      const ingLines = ingSection.split('\n').slice(1).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
      recipe.ingredients = ingLines.map(line => {
        const m = line.match(/^([\d./]+)\s*(cup|cups|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|can|cans|bunch|clove|cloves)?\s*(?:of\s+)?(.+)/i);
        if (m) return { qty: m[1], unit: (m[2] || ''), item: m[3].trim() };
        return { qty: '', unit: '', item: line };
      });
    }

    if (instrStart !== -1) {
      recipe.instructions = text.slice(instrStart).split('\n').slice(1).map(l => l.trim()).filter(Boolean).join('\n');
    }

    const servMatch = text.match(/serves?\s*:?\s*(\d+)/i) || text.match(/servings?\s*:?\s*(\d+)/i);
    if (servMatch) recipe.servings = parseInt(servMatch[1]);

    const prepMatch = text.match(/prep(?:\s*time)?\s*:?\s*([\d]+\s*(?:min|minutes?|hrs?|hours?))/i);
    if (prepMatch) recipe.prepTime = prepMatch[1];

    const cookMatch = text.match(/cook(?:\s*time)?\s*:?\s*([\d]+\s*(?:min|minutes?|hrs?|hours?))/i);
    if (cookMatch) recipe.cookTime = cookMatch[1];

    return recipe;
  }

  function getSuggestions(dayOfWeek) {
    const all = getAll();
    if (all.length === 0) return [];
    const sorted = [...all].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return sorted.slice(0, 5);
  }

  function getFrequentlyCooked(limit = 5) {
    return getAll().sort((a, b) => (b.timesCooked || 0) - (a.timesCooked || 0)).slice(0, limit);
  }

  return {
    CATEGORIES,
    create, getAll, getById, search, getByCategory,
    remove, update, markCooked, rate,
    parseIngredientText, parseRecipeFromText,
    getSuggestions, getFrequentlyCooked,
  };
})();

if (typeof module !== 'undefined') module.exports = { Recipes };
