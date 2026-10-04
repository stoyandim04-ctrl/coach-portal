/**
 * Backend facade. Pages talk only to this module; the concrete adapter is chosen from config.
 *
 * Every adapter implements the same async interface:
 *
 *   kind, photoOptions, init()
 *
 *   Auth
 *   register({ name, email, password, role }) → user { id, name, email, role }
 *   login({ email, password })                → user
 *   logout()
 *   getCurrentUser()                          → user | null
 *
 *   Coach (role 'coach')
 *   listClients()                     → client[] (summary: checkinCount, lastCheckinAt, lastWeight, awaitingReply, claimed…)
 *   createClient({ name, email, goal }) → client (includes `token` for the invite / check-in link)
 *   getClient(id) · deleteClient(id)
 *   listCheckins(clientId)            → checkin[] newest first (photos resolved to displayable URLs)
 *   listCoachCheckins()               → checkin[] newest first (all clients; no photos needed)
 *   updateCoachNote(checkinId, note)  → reply to a check-in (visible to the client)
 *   updateProgram(clientId, program)  → program
 *   getClientNotes(clientId) · saveClientNotes(clientId, text)   (coach-only notes)
 *
 *   Client (role 'client')
 *   getMyClient()      → client record with program + coachName, or null if not linked
 *   claimInvite(token) → links the signed-in client account to the coach's client record
 *   listMyCheckins()   → checkin[] newest first
 *
 *   Public (by token, no login)
 *   getCheckinContext(token) → { clientId, coachId, clientName, coachName, claimed } | null
 *   submitCheckin(token, payload) → checkin
 *
 *   seedDemo?(role) → user   (local adapter only)
 */
import { APP_CONFIG } from '../config.js';

let backendPromise = null;

export function getBackend() {
  if (!backendPromise) {
    backendPromise = (async () => {
      const useFirebase = APP_CONFIG.backend === 'firebase' && Boolean(APP_CONFIG.firebase?.apiKey);
      if (APP_CONFIG.backend === 'firebase' && !useFirebase) {
        console.warn('[Coach Portal] backend is "firebase" but no firebase config was provided — falling back to localStorage.');
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

/** Invite URL the coach shares: the client can create an account or just send a check-in. */
export function inviteUrl(token) {
  return new URL(`index.html?invite=${encodeURIComponent(token)}`, window.location.href).href;
}
