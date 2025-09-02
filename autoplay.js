/**
 * Autoplay detection and fallback handling.
 * @module autoplay
 */

import { store, actions } from './store.js';
import { player } from './player.js';
import { AUTOPLAY_DETECT_MS } from './constants.js';

/** @type {ReturnType<typeof setTimeout>|null} */
/** @type {ReturnType<typeof setTimeout>|null} */
let detectTimer = null;
/** @type {number} */
let loadToken = 0;
/** @type {(() => void)|null} */
let pendingFallback = null;

/**
 * Initializes autoplay fallback logic.
 * @returns {void}
 */
export function initAutoplayFallback() {
  store.subscribe((state, action) => {
    // start detection on new loads when player ready
    if (state.loadToken !== loadToken && state.playerReady && state.videoId) {
      loadToken = state.loadToken;
      attemptAutoplay();
    }

    // clear detection when playback starts
    if (action.type === actions.SET_PLAY_STATE && action.playing && detectTimer) {
      clearTimeout(detectTimer);
      detectTimer = null;
      pendingFallback = null;
    }
  });
}

/**
 * Attempts to autoplay and schedules detection.
 * @returns {void}
 */
function attemptAutoplay() {
  player.unMute();
  store.dispatch({ type: actions.SET_MUTED, muted: false, meta: { source: 'SYSTEM' } });
  store.dispatch({ type: actions.SET_AUTOPLAY_BLOCKED, blocked: false, meta: { source: 'SYSTEM' } });
  player.play();

  if (detectTimer) clearTimeout(detectTimer);
  const fallback = () => {
    detectTimer = null;
    store.dispatch({ type: actions.SET_AUTOPLAY_BLOCKED, blocked: true, meta: { source: 'SYSTEM' } });
    store.dispatch({ type: actions.SET_MUTED, muted: true, meta: { source: 'SYSTEM' } });
    player.mute();
    player.play();
    startGestureListener();
  };
  detectTimer = setTimeout(fallback, AUTOPLAY_DETECT_MS);
  pendingFallback = fallback;
}

/**
 * Sets up one-time gesture listener to unmute.
 * @returns {void}
 */
function startGestureListener() {
  const handler = () => {
    player.unMute();
    store.dispatch({ type: actions.SET_MUTED, muted: false, meta: { source: 'UI' } });
    store.dispatch({ type: actions.SET_AUTOPLAY_BLOCKED, blocked: false, meta: { source: 'SYSTEM' } });
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('click', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('click', handler, { once: true });
}

export default { initAutoplayFallback };
export const __testing = {
  triggerFallback: () => {
    if (pendingFallback) {
      player.play();
      pendingFallback();
    }
  },
};
