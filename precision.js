/**
 * Precision seeking strategy module.
 * @module precision
 */

import { player } from './player.js';
import { store } from './store.js';

/**
 * @typedef {'none'|'nudgeBackward'|'doubleSeek'} PrecisionMode
 */

/**
 * @typedef {object} PrecisionConfig
 * @property {PrecisionMode} precisionMode Current precision strategy
 * @property {number} preRollSeconds Seconds to pre-roll when nudging
 */

/**
 * Global precision configuration.
 * @type {PrecisionConfig}
 */
export const precisionConfig = {
  precisionMode: 'none',
  preRollSeconds: 0.2,
};

/** @type {number|null} */
let pendingDouble = null;
let loadToken = 0;

/**
 * Initializes precision handling: reads query params and hooks player events.
 * @returns {void}
 */
export function initPrecision() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('precision');
    if (mode === 'nudgeBackward' || mode === 'doubleSeek' || mode === 'none') {
      precisionConfig.precisionMode = mode;
    }
    const preroll = parseFloat(params.get('preroll') || '');
    if (!Number.isNaN(preroll) && preroll >= 0) {
      precisionConfig.preRollSeconds = preroll;
    }
  }
  loadToken = store.getState().loadToken;
  store.subscribe((state) => {
    if (state.loadToken !== loadToken) {
      loadToken = state.loadToken;
      pendingDouble = null;
    }
  });
  player.on('statechange', onStateChange);
}

/**
 * Sets precision mode.
 * @param {PrecisionMode} mode Strategy to use
 * @returns {void}
 */
export function setPrecisionMode(mode) {
  precisionConfig.precisionMode = mode;
}

/**
 * Sets pre-roll seconds.
 * @param {number} seconds Pre-roll duration
 * @returns {void}
 */
export function setPreRollSeconds(seconds) {
  if (!Number.isNaN(seconds) && seconds >= 0) {
    precisionConfig.preRollSeconds = seconds;
  }
}

/**
 * Performs a seek applying the current precision strategy.
 * @param {number} seconds Target time in seconds
 * @param {boolean} allowAhead Whether seeking ahead of buffer is allowed
 * @returns {void}
 */
export function precisionSeek(seconds, allowAhead) {
  const clipStart = store.getState().clipStart;
  const { precisionMode, preRollSeconds } = precisionConfig;
  if (seconds === clipStart && clipStart > 0) {
    if (precisionMode === 'nudgeBackward') {
      player.seek(Math.max(clipStart - preRollSeconds, 0), allowAhead);
      return;
    }
    if (precisionMode === 'doubleSeek') {
      pendingDouble = clipStart;
      player.seek(Math.max(clipStart - preRollSeconds, 0), allowAhead);
      return;
    }
  }
  player.seek(seconds, allowAhead);
}

/**
 * Internal handler for state change events to complete double seek.
 * @param {{state:number, token:number}} ev Player state event
 * @returns {void}
 */
function onStateChange(ev) {
  const { state, token } = ev;
  if (token < loadToken) return;
  if (precisionConfig.precisionMode === 'doubleSeek' && pendingDouble !== null && state === 1) {
    const target = pendingDouble;
    pendingDouble = null;
    player.seek(target, true);
  }
}
