import { expect, it } from 'vitest';
import { storedCart } from '../utils/storage';
import { response } from './fixtures';

it('restores only valid, unique estimate entries from persisted JSON', () => {
  const card = response().results[0];
  localStorage.setItem('helphunter-cart', JSON.stringify([
    card, { ...card }, null, 'invalid', {},
    { ...card, id: 'negative-price', price_from_kzt: -1 },
    { ...card, id: 'invalid-name', name: {} },
    { ...card, id: 'second', name: 'Другой подрядчик' },
  ]));
  expect(storedCart().map(item => item.id)).toEqual(['TEST-1', 'second']);
});

it.each(['null', '{}', '42', '"hello"', 'invalid json'])('recovers from invalid estimate storage: %s', value => {
  localStorage.setItem('helphunter-cart', value);
  expect(storedCart()).toEqual([]);
});
