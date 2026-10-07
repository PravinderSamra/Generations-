// Picks the storage backend named in config.js. Both backends expose the same
// methods, so the rest of the app never needs to know which one is active.
import { createLocalStore } from './local.js';

export async function createStore(config) {
  const wantsSupabase = config.storage === 'supabase' && config.supabase.url && config.supabase.anonKey;
  const store = wantsSupabase
    ? await (await import('./supabase.js')).createSupabaseStore(config)
    : createLocalStore(config);
  await store.init();
  return store;
}
