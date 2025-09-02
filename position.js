/**
 * Position synchronization and seek arbitration.
 * @module position
 */

import { store, actions } from './store.js';
import { player } from './player.js';
import { precisionSeek } from './precision.js';
import { SEEK_DEBOUNCE_MS, SEEK_INFLIGHT_TTL_MS, SEEK_EPSILON_S } from './constants.js';

/** @type {ReturnType<typeof setTimeout>|null} */
let seekTimeout = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let pollTimer = null;
let loadToken = 0;

/**
 * Initializes position synchronization between UI and player.
 * @returns {void}
 */
export function initPositionSync() {
  loadToken = store.getState().loadToken;
  store.subscribe((state, action) => {
    if (state.loadToken !== loadToken) {
      loadToken = state.loadToken;
      if (seekTimeout) {
        clearTimeout(seekTimeout);
        seekTimeout = null;
      }
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      store.dispatch({ type: actions.SET_SEEK_INFLIGHT, seek: null, meta: { source: 'SYSTEM' } });
    }
    if (action.type === actions.SET_POSITION && action.meta.source !== 'PLAYER') {
      scheduleSeek(store.getState().position);
    }
  });
}

/**
 * Schedules a debounced seek request.
 * @param {number} target Target seconds
 * @returns {void}
 */
function scheduleSeek(target) {
  const expiresAt = Date.now() + SEEK_INFLIGHT_TTL_MS;
  store.dispatch({
    type: actions.SET_SEEK_INFLIGHT,
    seek: { target, expiresAt },
    meta: { source: 'SYSTEM' },
  });
  if (seekTimeout) clearTimeout(seekTimeout);
  seekTimeout = setTimeout(() => {
    precisionSeek(target, true);
    pollSettle(target);
  }, SEEK_DEBOUNCE_MS);
}

/**
 * Polls player time until seek settles or TTL expires.
 * @param {number} target Target seconds
 * @returns {void}
 */
function pollSettle(target) {
  const check = () => {
    const inflight = store.getState().seekInFlight;
    if (!inflight || inflight.target !== target) return;
    const diff = Math.abs(player.getCurrentTime() - target);
    if (diff <= SEEK_EPSILON_S || Date.now() > inflight.expiresAt) {
      store.dispatch({ type: actions.SET_SEEK_INFLIGHT, seek: null, meta: { source: 'SYSTEM' } });
      pollTimer = null;
      return;
    }
    pollTimer = setTimeout(check, 50);
    pollTimer?.unref?.();
  };
  pollTimer = setTimeout(check, 50);
  pollTimer?.unref?.();
}

export default { initPositionSync };
