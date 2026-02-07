/**
 * Weekly meal planner — assign recipes/meals to days and slots.
 */
const Meals = (() => {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

  function _weekId(date) {
    const d = date ? new Date(date) : new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().slice(0, 10);
  }

  function currentWeekId() {
    return _weekId();
  }

  function getPlan(weekId) {
    const all = Storage.getMealPlan();
    if (!all[weekId]) {
      all[weekId] = {};
      DAYS.forEach(day => {
        all[weekId][day] = {};
        SLOTS.forEach(slot => { all[weekId][day][slot] = null; });
      });
      Storage.saveMealPlan(all);
    }
    return all[weekId];
  }

  function getCurrentPlan() {
    return getPlan(currentWeekId());
  }

  function setMeal(weekId, day, slot, meal) {
    const all = Storage.getMealPlan();
    if (!all[weekId]) {
      all[weekId] = {};
      DAYS.forEach(d => {
        all[weekId][d] = {};
        SLOTS.forEach(s => { all[weekId][d][s] = null; });
      });
    }
    all[weekId][day][slot] = meal; // { recipeId, name, servings }
    Storage.saveMealPlan(all);
  }

  function removeMeal(weekId, day, slot) {
    setMeal(weekId, day, slot, null);
  }

  function getIngredientsForWeek(weekId) {
    const plan = getPlan(weekId);
    const ingredients = {};

    for (const day of DAYS) {
      for (const slot of SLOTS) {
        const meal = plan[day]?.[slot];
        if (!meal || !meal.recipeId) continue;
        const recipe = Recipes.getById(meal.recipeId);
        if (!recipe) continue;
        const scale = (meal.servings || recipe.servings) / recipe.servings;
        for (const ing of recipe.ingredients) {
          const key = ing.item.toLowerCase();
          if (!ingredients[key]) {
            ingredients[key] = { item: ing.item, qty: 0, unit: ing.unit, sources: [] };
          }
          const q = parseFloat(ing.qty) || 0;
          ingredients[key].qty += q * scale;
          ingredients[key].sources.push(`${day} ${slot}`);
        }
      }
    }
    return Object.values(ingredients);
  }

  function getSummary(weekId) {
    const plan = getPlan(weekId);
    let totalMeals = 0;
    let filledSlots = 0;
    const totalSlots = DAYS.length * SLOTS.length;

    for (const day of DAYS) {
      for (const slot of SLOTS) {
        if (plan[day]?.[slot]) {
          filledSlots++;
          totalMeals++;
        }
      }
    }
    return { totalMeals, filledSlots, totalSlots, percentPlanned: Math.round((filledSlots / totalSlots) * 100) };
  }

  return {
    DAYS, SLOTS,
    currentWeekId, getPlan, getCurrentPlan,
    setMeal, removeMeal,
    getIngredientsForWeek, getSummary,
  };
})();

if (typeof module !== 'undefined') module.exports = { Meals };
