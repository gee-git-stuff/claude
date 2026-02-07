/**
 * Price tracking, statistics, and sales monitoring.
 */
const Prices = (() => {
  function logPrice(itemName, price, store = '', date = null) {
    const history = Storage.getPriceHistory();
    const key = itemName.toLowerCase().trim();
    if (!history[key]) history[key] = { item: itemName, entries: [] };
    history[key].entries.push({
      price: parseFloat(price),
      store,
      date: date || new Date().toISOString().slice(0, 10),
    });
    Storage.savePriceHistory(history);
  }

  function getHistory(itemName) {
    const history = Storage.getPriceHistory();
    return history[itemName.toLowerCase().trim()] || { item: itemName, entries: [] };
  }

  function getStats(itemName) {
    const h = getHistory(itemName);
    if (h.entries.length === 0) return null;
    const prices = h.entries.map(e => e.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const latest = h.entries[h.entries.length - 1];
    const cheapestStore = h.entries.reduce((best, e) => (!best || e.price < best.price) ? e : best, null);
    return {
      item: h.item,
      average: Math.round(avg * 100) / 100,
      min, max,
      latest: latest.price,
      entries: h.entries.length,
      cheapestStore: cheapestStore?.store || 'N/A',
      trend: prices.length >= 2 ? (prices[prices.length - 1] > avg ? 'up' : 'down') : 'stable',
    };
  }

  function getAllTracked() {
    const history = Storage.getPriceHistory();
    return Object.keys(history).map(key => ({
      item: history[key].item,
      ...getStats(history[key].item),
    })).filter(Boolean);
  }

  /* ---------- Sales ---------- */
  function addSale({ item, salePrice, regularPrice = null, store = '', validUntil = '', notes = '' }) {
    const sales = Storage.getSales();
    sales.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      item,
      salePrice: parseFloat(salePrice),
      regularPrice: regularPrice ? parseFloat(regularPrice) : null,
      store,
      validUntil,
      notes,
      addedAt: new Date().toISOString(),
    });
    Storage.saveSales(sales);
    logPrice(item, salePrice, store);
  }

  function getActiveSales() {
    const today = new Date().toISOString().slice(0, 10);
    return Storage.getSales().filter(s => !s.validUntil || s.validUntil >= today);
  }

  function getAllSales() {
    return Storage.getSales();
  }

  function removeSale(id) {
    const sales = Storage.getSales().filter(s => s.id !== id);
    Storage.saveSales(sales);
  }

  function getSaleAlerts() {
    const activeSales = getActiveSales();
    const groceryList = Groceries.getList();
    const alerts = [];
    for (const sale of activeSales) {
      const saleItem = sale.item.toLowerCase();
      const match = groceryList.find(g => g.item.toLowerCase().includes(saleItem) || saleItem.includes(g.item.toLowerCase()));
      if (match) {
        const savings = sale.regularPrice ? (sale.regularPrice - sale.salePrice) : null;
        alerts.push({
          groceryItem: match.item,
          sale,
          savings,
          message: `${match.item} is on sale at ${sale.store} for $${sale.salePrice}${savings ? ` (save $${savings.toFixed(2)})` : ''}`,
        });
      }
    }
    return alerts;
  }

  function getSpendingSummary() {
    const history = Storage.getPriceHistory();
    let totalSpent = 0;
    let itemCount = 0;
    for (const key of Object.keys(history)) {
      for (const entry of history[key].entries) {
        totalSpent += entry.price;
        itemCount++;
      }
    }
    return { totalSpent: Math.round(totalSpent * 100) / 100, itemCount };
  }

  return {
    logPrice, getHistory, getStats, getAllTracked,
    addSale, getActiveSales, getAllSales, removeSale, getSaleAlerts,
    getSpendingSummary,
  };
})();

if (typeof module !== 'undefined') module.exports = { Prices };
