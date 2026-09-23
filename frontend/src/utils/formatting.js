export const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
export const displayDate = iso => iso.split('-').reverse().join('.');
export const elapsed = ms => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(ms / 1000)} с`;
