/**
 * Backend facade. Pages talk only to this module; the concrete adapter is chosen from config.
 *
 * Every adapter implements the same async interface:
 *
 *   kind                                  'local' | 'firebase'
 *   photoOptions                          { maxSize, quality } used to compress uploads
 *   init()
 *   register({ name, email, password })   → coach
 *   login({ email, password })            → coach
 *   logout()
 *   getCurrentCoach()                     → coach | null
 *   listClients()                         → client[] (with checkinCount, lastCheckinAt, firstWeight, lastWeight)
 *   createClient({ name, email, goal })   → client (includes `token` for the check-in link)
 *   getClient(clientId)                   → client
 *   deleteClient(clientId)
 *   listCheckins(clientId)                → checkin[] newest first (photos resolved to displayable URLs)
 *   updateCoachNote(checkinId, note)
 *   getCheckinContext(token)              → { clientId, coachId, clientName, coachName } | null   (public)
 *   submitCheckin(token, payload)         → checkin                                          (public)
 *   seedDemo?()                           → coach   (local adapter only)
 */
import { APP_CONFIG } from '../config.js';

let backendPromise = null;

export function getBackend() {
  if (!backendPromise) {
    backendPromise = (async () => {
      const useFirebase = APP_CONFIG.backend === 'firebase' && Boolean(APP_CONFIG.firebase?.apiKey);
      if (APP_CONFIG.backend === 'firebase' && !useFirebase) {
        console.warn('[FitCheck] backend is "firebase" but no firebase config was provided — falling back to localStorage.');
      }
      const mod = useFirebase ? await import('./firebase-adapter.js') : await import('./local-adapter.js');
      const adapter = mod.createAdapter(APP_CONFIG);
      await adapter.init();
      return adapter;
    })();
  }
  return backendPromise;
}

/** Public check-in URL for a client token (works from any page depth / sub-folder deploy). */
export function checkinUrl(token) {
  return new URL(`checkin.html?t=${encodeURIComponent(token)}`, window.location.href).href;
}
