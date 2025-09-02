/**
 * URL parsing and serialization utilities with store synchronization.
 * @module url
 */

import { store, actions } from './store.js';
import { SERIAL_DECIMALS, URL_THROTTLE_MS } from './constants.js';

/**
 * Parses a time parameter like "1m2s" or "90" into seconds.
 * @param {string} timeParam - Time parameter to parse.
 * @returns {number} Time in seconds.
 */
export function parseTimeParam(timeParam) {
  if (!timeParam) return 0;
  if (/^\d+$/.test(timeParam)) return parseInt(timeParam, 10);
  let seconds = 0;
  const h = timeParam.match(/(\d+)h/);
  const m = timeParam.match(/(\d+)m/);
  const s = timeParam.match(/(\d+)s/);
  if (h && h[1]) seconds += parseInt(h[1], 10) * 3600;
  if (m && m[1]) seconds += parseInt(m[1], 10) * 60;
  if (s && s[1]) seconds += parseInt(s[1], 10);
  return seconds;
}

/**
 * Parses a YouTube URL or direct video ID for the start box input.
 * @param {string} input - Raw user input.
 * @returns {{videoId: string, clipStart: number}} Parsed video ID and optional start.
 */
export function parseYouTubeUrl(input) {
  const result = { videoId: '', clipStart: 0 };
  if (/^[\w-]{11}$/.test(input)) {
    result.videoId = input;
    return result;
  }
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtube.com')) {
      result.videoId = url.searchParams.get('v') || '';
      const t = url.searchParams.get('t');
      if (t) result.clipStart = parseTimeParam(t);
    } else if (url.hostname.includes('youtu.be')) {
      result.videoId = url.pathname.slice(1);
      const t = url.searchParams.get('t');
      if (t) result.clipStart = parseTimeParam(t);
    }
    if (url.hash) {
      const m = url.hash.match(/[#&]t=([^&]+)/);
      if (m && m[1]) result.clipStart = parseTimeParam(m[1]);
    }
  } catch (_e) {
    // ignore invalid URLs
  }
  return result;
}

/**
 * Parses application URL for video and clip parameters.
 * @param {string} href - URL string to parse.
 * @returns {{videoId: string, clipStart: number, clipEnd: number, loopEnabled: boolean}} Parsed data.
 */
export function parseUrl(href) {
  const url = new URL(href, 'https://clipto.show');
  const videoId = url.searchParams.get('v') || '';
  let clipStart = 0;
  let clipEnd = 0;
  const clip = url.searchParams.get('clip');
  if (clip) {
    const [startStr, endStr] = clip.split('-');
    clipStart = parseFloat(startStr) || 0;
    if (endStr && endStr !== '<unset>') clipEnd = parseFloat(endStr) || 0;
  } else {
    const tParam = url.searchParams.get('t') || url.hash.match(/t=([^&]+)/)?.[1];
    if (tParam) clipStart = parseTimeParam(tParam);
  }
  
  // Parse loop parameter - default to true if not specified
  const loopParam = url.searchParams.get('loop');
  const loopEnabled = loopParam === null ? true : loopParam === '1';
  
  return { videoId, clipStart, clipEnd, loopEnabled };
}

/**
 * Serializes application state into a URL string.
 * @param {{videoId: string|null, clipStart: number, clipEnd: number, loopEnabled: boolean}} state - App state.
 * @returns {string} Serialized URL.
 */
export function serializeUrl(state) {
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = new URL(base);
  if (state.videoId) url.searchParams.set('v', state.videoId);
  if (state.clipStart > 0 || state.clipEnd > 0) {
    const start = state.clipStart.toFixed(SERIAL_DECIMALS);
    const end = state.clipEnd > 0 ? state.clipEnd.toFixed(SERIAL_DECIMALS) : '<unset>';
    url.searchParams.set('clip', `${start}-${end}`);
  }
  // Only include loop parameter if it's false (since true is the default)
  if (state.loopEnabled === false) {
    url.searchParams.set('loop', '0');
  }
  return url.toString();
}

/**
 * Initializes URL synchronization: parse on load/popstate and serialize on commits.
 * @returns {void}
 */
export function initUrlSync() {
  const commit = throttle(() => {
    const next = serializeUrl(store.getState());
    window.history.replaceState(null, '', next);
  }, URL_THROTTLE_MS);

  // initial parse
  const initial = parseUrl(window.location.href);
  const state = store.getState();
  if (
    initial.videoId &&
    (initial.videoId !== state.videoId || initial.clipStart !== state.clipStart || initial.clipEnd !== state.clipEnd || initial.loopEnabled !== state.loopEnabled)
  ) {
    /** @type {import('./store.js').Action} */ const action = {
      type: actions.SET_VIDEO,
      videoId: initial.videoId,
      loopEnabled: initial.loopEnabled,
      meta: { source: 'URL' },
    };
    if (initial.clipStart > 0) action.clipStart = initial.clipStart;
    if (initial.clipEnd > 0) action.clipEnd = initial.clipEnd;
    store.dispatch(action);
  }

  // subscribe for video commits and loop changes (ignore URL source)
  store.subscribe((_s, action) => {
    if (action.meta.source === 'URL') return;
    if (action.type === actions.SET_VIDEO || action.type === actions.TOGGLE_LOOP) commit();
  });

  // commit on clip-change events
  window.addEventListener('clip-start-change', /** @type {(e: Event) => void} */ (commit));
  window.addEventListener('clip-end-change', /** @type {(e: Event) => void} */ (commit));

  // popstate handler
  window.addEventListener('popstate', () => {
    const parsed = parseUrl(window.location.href);
    const cur = store.getState();
    if (
      parsed.videoId &&
      (parsed.videoId !== cur.videoId || parsed.clipStart !== cur.clipStart || parsed.clipEnd !== cur.clipEnd || parsed.loopEnabled !== cur.loopEnabled)
    ) {
      /** @type {import('./store.js').Action} */ const action = {
        type: actions.SET_VIDEO,
        videoId: parsed.videoId,
        loopEnabled: parsed.loopEnabled,
        meta: { source: 'URL' },
      };
      if (parsed.clipStart > 0) action.clipStart = parsed.clipStart;
      if (parsed.clipEnd > 0) action.clipEnd = parsed.clipEnd;
      store.dispatch(action);
    }
  });
}

/**
 * Throttles a function call with trailing execution.
 * @param {Function} fn - Function to throttle.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Function} Throttled function.
 */
function throttle(fn, ms) {
  /** @type {ReturnType<typeof setTimeout>|null} */ let timeout = null;
  /** @type {any[]} */ let lastArgs = [];
  return (
    /**
     * @param {...any} args - forwarded arguments
     */
    (...args) => {
      lastArgs = args;
      if (timeout) return;
      timeout = setTimeout(() => {
        timeout = null;
        fn(...lastArgs);
      }, ms);
    }
  );
}
