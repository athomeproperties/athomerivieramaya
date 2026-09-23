import { getStore } from '@netlify/blobs';

// Persistent storage (Netlify Blobs). `globalThis.__TEST_STORE__` lets the local
// test script swap in an in-memory store; it is never set in production.
export function store(name) {
  if (globalThis.__TEST_STORE__) return globalThis.__TEST_STORE__(name);
  return getStore({ name, consistency: 'strong' });
}

// Approved direct bookings, one JSON array per property slug.
export async function getBookings(slug) {
  const list = await store('bookings').get(slug, { type: 'json' });
  return Array.isArray(list) ? list : [];
}

export async function saveBookings(slug, list) {
  await store('bookings').setJSON(slug, list);
}
