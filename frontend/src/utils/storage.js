export function storedChoice(key, choices, fallback) {
  try {
    const value = localStorage.getItem(key);
    return choices.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function storedCart() {
  try {
    const items = JSON.parse(localStorage.getItem('helphunter-cart') || '[]');
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items.filter(item => {
      if (!item || !['id', 'name', 'category', 'city'].every(key => typeof item[key] === 'string' && item[key].trim())
        || !Number.isSafeInteger(item.price_from_kzt) || item.price_from_kzt < 0 || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function storeValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Matching and the current estimate remain usable when browser storage is unavailable.
  }
}
