/**
 * Raw error surfacing module.
 * @module errors
 */

import { store, actions } from './store.js';
import { player } from './player.js';

/**
 * Initializes error handling for player events.
 * @returns {void}
 */
export function initErrorHandling() {
  player.on('error', (/** @type {{code:any, raw:any, token:number}} */ ev) => {
    const { code, raw, token } = ev;
    const { loadToken } = store.getState();
    if (token < loadToken) return;
    store.dispatch({
      type: actions.SET_ERROR,
      error: { code, raw, token },
      meta: { source: 'PLAYER' },
    });
  });

  player.on('statechange', (/** @type {{state:number, token:number}} */ ev) => {
    const { state, token } = ev;
    if (state === 5) {
      const { loadToken } = store.getState();
      if (token === loadToken) {
        store.dispatch({ type: actions.SET_ERROR, error: null, meta: { source: 'PLAYER' } });
      }
    }
  });
}

export default { initErrorHandling };
