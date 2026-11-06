/**
 * One-time move of browser data saved under the old app name ("pdf-lokal:*")
 * to the current prefix. Imported first in main.tsx, before any module reads
 * localStorage.
 */
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('pdf-lokal:')) continue;
    const next = `localkit:${key.slice('pdf-lokal:'.length)}`;
    if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key)!);
    localStorage.removeItem(key);
  }
} catch {
  // storage unavailable (private mode): nothing to migrate
}
export {};
