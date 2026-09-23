const common = { city: 'Алматы', date: '2026-10-10', eventType: 'корпоратив', category: 'Ведущий', budget: '1500000', duration: '6', language: 'русский' };
export const demoPresets = [
  { id: 'A', label: 'A · Плотная категория', fields: { ...common } },
  { id: 'B', label: 'B · Редкая категория', fields: { ...common, date: '2026-10-11', eventType: 'свадьба', category: 'Флорист', budget: '400000', duration: '8' } },
  { id: 'C', label: 'C · Маленький бюджет', fields: { ...common, budget: '1000' } },
  { id: 'D', label: 'D · Нет категории', fields: { ...common, city: 'Астана', date: '2026-10-15', category: 'Инструменталист', budget: '1000000', duration: '', language: '' } },
  { id: 'E1', label: 'E1 · Астана, 15 октября', fields: { ...common, city: 'Астана', date: '2026-10-15', eventType: 'свадьба', budget: '1000000', duration: '', language: '' } },
  { id: 'E2', label: 'E2 · Астана, 16 октября', fields: { ...common, city: 'Астана', date: '2026-10-16', eventType: 'свадьба', budget: '1000000', duration: '', language: '' } },
  { id: 'F', label: 'F · Площадка', fields: { ...common, date: '2026-11-14', eventType: 'свадьба', category: 'Банкетный зал', budget: '6500000' } },
];
export const initialFields = { ...common };
