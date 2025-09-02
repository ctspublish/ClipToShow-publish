/**
 * Flux-style store for ClipToShow app
 * Based on the 60-Second API pattern from AGENTS.md
 */

import { SERIAL_DECIMALS, SEEK_EPSILON_S } from './constants.js';

/**
 * @typedef {object} AppState
 * @property {string|null} videoId YouTube video ID
 * @property {number} position Current playback position in seconds
 * @property {number} duration Video duration in seconds
 * @property {number} clipStart Clip start time in seconds
 * @property {number} clipEnd Clip end time in seconds (0 means “unset”)
 * @property {boolean} loopEnabled Whether loop is enabled
 * @property {boolean} playing Whether video is currently playing
 * @property {boolean} isLive Derived flag; true when duration is 0 after cue
 * @property {boolean} muted Player muted state
 * @property {boolean} autoplayBlocked Autoplay detection flag
 * @property {boolean} playerReady Whether YouTube player is ready
 * @property {boolean} isDragging Whether timeline handle is being dragged
 * @property {null|{code:any,raw:any,token:number}} error Last error payload
 * @property {number} loadToken Monotonic token for loads
 * @property {null|{target:number,expiresAt:number}} seekInFlight Active seek target and expiry
 */

/**
 * @typedef {'URL'|'UI'|'PLAYER'|'SYSTEM'} ActionSource
 */

/**
 * @typedef {object} ActionMeta
 * @property {ActionSource} source Origin of the action
 */

/**
 * @typedef {object} Action
 * @property {string} type Action type
 * @property {ActionMeta} meta Metadata including source
 * @property {string} [videoId] New video ID
 * @property {number} [duration] Video duration
 * @property {number} [clipStart] Desired clip start
 * @property {number} [clipEnd] Desired clip end
 * @property {number} [position] Playback position
 * @property {number} [seconds] Generic seconds payload
 * @property {boolean} [playing] Playing state flag
 * @property {boolean} [loopEnabled] Loop toggle value
 * @property {boolean} [muted] Mute state flag
 * @property {boolean} [blocked] Autoplay blocked flag
 * @property {any} [error] Error payload
 * @property {boolean} [playerReady] Player ready flag
 * @property {boolean} [ready] Generic ready flag
 * @property {boolean} [dragging] Dragging state flag
 * @property {{target:number,expiresAt:number}|null} [seek] Seek inflight payload
 */

/**
 * @typedef {function(AppState, Action): void} StateListener
 */

/**
 * Action types for the store
 */
export const actions = {
  SET_VIDEO: 'SET_VIDEO',
  SET_DURATION: 'SET_DURATION',
  SET_CLIP_START: 'SET_CLIP_START',
  SET_CLIP_END: 'SET_CLIP_END',
  SET_POSITION: 'SET_POSITION',
  SET_PLAY_STATE: 'SET_PLAY_STATE',
  TOGGLE_LOOP: 'TOGGLE_LOOP',
  SET_PLAYER_READY: 'SET_PLAYER_READY',
  SET_DRAGGING: 'SET_DRAGGING',
  SET_MUTED: 'SET_MUTED',
  SET_AUTOPLAY_BLOCKED: 'SET_AUTOPLAY_BLOCKED',
  SET_ERROR: 'SET_ERROR',
  INCREMENT_LOAD_TOKEN: 'INCREMENT_LOAD_TOKEN',
  SET_SEEK_INFLIGHT: 'SET_SEEK_INFLIGHT',
};

/**
 * Creates a new store instance
 * @param {AppState} initial Initial state
 * @returns {{getState: () => AppState, subscribe: (fn: StateListener) => () => void, dispatch: (action: Action) => void}}
 * Store with getState, subscribe, and dispatch methods
 */
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    /**
     * Gets current state
     * @returns {AppState} Current state
     */
    getState: () => state,

    /**
     * Subscribes to state changes
     * @param {StateListener} fn Listener function
     * @returns {() => void} Unsubscribe function
     */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Dispatches an action to update state
     * @param {Action} action - Action object with type and payload
     * @returns {void}
     */
    dispatch(action) {
      const source = action?.meta?.source;
      if (!source || !['URL', 'UI', 'PLAYER', 'SYSTEM'].includes(source)) {
        throw new Error('Action missing meta.source');
      }

      const prevState = { ...state };

      switch (action.type) {
        case actions.SET_VIDEO:
          state = {
            ...state,
            videoId: action.videoId ?? null,
            position: action.position ?? 0,
            duration: action.duration ?? 0,
            clipStart: action.clipStart ?? state.clipStart,
            clipEnd: action.clipEnd ?? state.clipEnd,
            loopEnabled: action.loopEnabled ?? state.loopEnabled,
            playing: action.playing ?? false,
            muted: action.muted ?? false,
            autoplayBlocked: false,
            error: null,
            playerReady: action.playerReady ?? state.playerReady,
            loadToken: state.loadToken + 1,
            isLive: (action.duration ?? 0) === 0,
          };
          break;

        case actions.SET_DURATION:
          state = {
            ...state,
            duration: action.duration ?? 0,
            clipEnd: state.clipEnd || action.duration || 0,
            isLive: (action.duration ?? 0) === 0,
          };
          break;

        case actions.SET_CLIP_START: {
          let start = clamp(action.seconds ?? 0, 0, state.duration);
          let end = state.clipEnd;
          if (end > 0 && start > end) [start, end] = [end, start];
          state = { ...state, clipStart: start, clipEnd: end };
          break;
        }

        case actions.SET_CLIP_END: {
          let end = clamp(action.seconds ?? 0, 0, state.duration);
          let start = state.clipStart;
          if (end > 0 && end < start) [start, end] = [end, start];
          state = { ...state, clipStart: start, clipEnd: end };
          break;
        }

        case actions.SET_POSITION: {
          const nextPos = clamp(action.seconds ?? 0, 0, state.duration);
          if (source === 'PLAYER' && state.seekInFlight) {
            const diff = Math.abs(nextPos - state.seekInFlight.target);
            if (diff > SEEK_EPSILON_S) {
              return; // ignore until within epsilon
            }
            state = { ...state, position: nextPos, seekInFlight: null };
          } else {
            state = { ...state, position: nextPos };
          }
          break;
        }

        case actions.SET_PLAY_STATE:
          state = { ...state, playing: action.playing ?? false };
          break;

        case actions.TOGGLE_LOOP:
          state = { ...state, loopEnabled: !state.loopEnabled };
          break;

        case actions.SET_PLAYER_READY:
          state = { ...state, playerReady: action.ready ?? false };
          break;

        case actions.SET_DRAGGING:
          state = { ...state, isDragging: action.dragging ?? false };
          break;

        case actions.SET_MUTED:
          state = { ...state, muted: action.muted ?? false };
          break;

        case actions.SET_AUTOPLAY_BLOCKED:
          state = { ...state, autoplayBlocked: action.blocked ?? false };
          break;

        case actions.SET_ERROR:
          state = { ...state, error: action.error ?? null };
          break;

        case actions.INCREMENT_LOAD_TOKEN:
          state = { ...state, loadToken: state.loadToken + 1 };
          break;

        case actions.SET_SEEK_INFLIGHT:
          state = { ...state, seekInFlight: action.seek || null };
          break;

        default:
          return; // unknown action → no change
      }

      if (JSON.stringify(prevState) !== JSON.stringify(state)) {
        listeners.forEach((fn) => fn(state, action));
      } else {
        listeners.forEach((fn) => fn(state, action));
      }
    },
  };
}

/**
 * Clamps a value between min and max and rounds to SERIAL_DECIMALS
 * @param {number} val Value to clamp
 * @param {number} min Minimum value
 * @param {number} max Maximum value
 * @returns {number} Clamped and rounded value
 */
function clamp(val, min, max) {
  const clamped = Math.min(Math.max(val, min), max);
  const factor = 10 ** SERIAL_DECIMALS;
  return Math.round(clamped * factor) / factor;
}

// Create and export the global store instance
/**
 * @type {{getState: () => AppState, subscribe: (fn: StateListener) => () => void, dispatch: (action: Action) => void}}
 */
export const store = /** @type {any} */ (
  createStore({
    videoId: null,
    position: 0,
    duration: 0,
    clipStart: 0,
    clipEnd: 0,
    loopEnabled: true,
    playing: false,
    isLive: false,
    muted: false,
    autoplayBlocked: false,
    playerReady: false,
    isDragging: false,
    error: null,
    loadToken: 0,
    seekInFlight: null,
  })
);
