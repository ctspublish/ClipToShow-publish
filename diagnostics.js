/**
 * Diagnostics logger and dev utilities.
 * @module diagnostics
 */

import { store, actions } from './store.js';
import { player } from './player.js';
import { __testing as autoplayTest } from './autoplay.js';

/**
 * @typedef {object} LogEntry
 * @property {number} ts Timestamp in ms
 * @property {import('./store.js').ActionSource} source Origin of the entry
 * @property {string} action Action type
 * @property {number} token Load token snapshot
 * @property {string|null} videoId Video identifier
 * @property {number} pos Playback position
 * @property {number} clipStart Clip start seconds
 * @property {number} clipEnd Clip end seconds
 * @property {string} state Player state summary
 * @property {string} [note] Optional note
 */

const MAX_ENTRIES = 50;
/** @type {LogEntry[]} */
const entries = [];
/** @type {Set<(entries:LogEntry[])=>void>} */
const listeners = new Set();
/** @type {boolean} */
let enabled = false;

/**
 * Initializes diagnostics logging and panel if ?debug=1.
 * @returns {void}
 */
export function initDiagnostics() {
  enabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  if (!enabled) return;

  store.subscribe((state, action) => {
    log({
      source: action.meta.source,
      action: action.type,
      token: state.loadToken,
      videoId: state.videoId,
      pos: state.position,
      clipStart: state.clipStart,
      clipEnd: state.clipEnd,
      state: state.playing ? 'playing' : 'paused',
    });
  });

  if (typeof document !== 'undefined') {
    import('./components/cts-debug-panel.js').then(() => {
      const panel = document.createElement('cts-debug-panel');
      document.body.appendChild(panel);
    });
  }
}

/**
 * Adds an entry to the log.
 * @param {Omit<LogEntry, 'ts'>} entry Entry data without timestamp
 * @returns {void}
 */
export function log(entry) {
  if (!enabled) return;
  entries.push({ ts: Date.now(), ...entry });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  listeners.forEach((fn) => {
    try {
      fn(entries.slice());
    } catch {
      // ignore listener errors
    }
  });
}

/**
 * Subscribes to log changes.
 * @param {(entries:LogEntry[])=>void} fn Callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Fixture list used by debug panel.
 */
export const FIXTURES = [
  { id: 'M7lc1UVf-VE', label: 'Short' },
  { id: 'LXb3EKWsInQ', label: 'Long' },
  { id: 'hY7m5jjJ9mM', label: 'Embed-disabled' },
  { id: '5qap5aO4i9A', label: 'Live' },
];

/**
 * Loads a fixture video via store dispatch.
 * @param {string} id YouTube video ID
 * @returns {void}
 */
export function loadFixture(id) {
  store.dispatch({ type: actions.SET_VIDEO, videoId: id, meta: { source: 'UI' } });
}

/**
 * Triggers the autoplay blocked fallback path.
 * @returns {void}
 */
export function simulateAutoplayBlock() {
  autoplayTest.triggerFallback();
}

/**
 * Dispatches a faux player error event.
 * @param {number} code Error code to surface (default: 150)
 * @returns {void}
 */
export function simulateError(code = 150) {
  const { loadToken } = store.getState();
  store.dispatch({
    type: actions.SET_ERROR,
    error: { code, raw: { forced: true }, token: loadToken },
    meta: { source: 'PLAYER' },
  });
}

/**
 * Delays player CUED gating to exercise coalescing.
 * @param {number} ms Delay in milliseconds (default: 2000)
 * @returns {void}
 */
export function simulateDelayedCued(ms = 2000) {
  const origGate = player.gate;
  player.gate = (token) =>
    new Promise((resolve) => {
      setTimeout(() => {
        origGate(token).then(() => {
          player.gate = origGate;
          resolve();
        });
      }, ms);
    });
}

export const __testing = {
  /**
   * Toggles logger enable state.
   * @param {boolean} val New enabled state
   * @returns {void}
   */
  setEnabled(val) {
    enabled = val;
  },
  /**
   * Returns raw log entries.
   * @returns {LogEntry[]} Current log entries
   */
  getEntries() {
    return entries;
  },
};
