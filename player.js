/**
 * YouTube player wrapper with tokenized events and idempotent loader.
 * @module player
 */

import { CLIP_GUARD_MS } from './constants.js';

/** @type {Promise<void>|null} */
let loaderPromise = null;

/** @type {any} */
let ytPlayer = null;

let activeToken = 0;
let tokenCounter = 0;

let clipStart = 0;
let clipEnd = 0;
let loopEnabled = true;
/** @type {ReturnType<typeof setInterval>|null} */
let guardInterval = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let playKickTimeout = null;

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * Emits an event to all listeners.
 * @param {string} event Event name
 * @param {any} payload Data payload
 * @returns {void}
 */
function emit(event, payload) {
  const set = listeners.get(event);
  if (set) {
    set.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        // ignore listener errors
      }
    });
  }
}

/**
 * Loads the YouTube iframe API if needed.
 * @returns {Promise<void>}
 */
function ready() {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve) => {
    if (typeof window !== 'undefined' && /** @type {any} */ (window).YT && /** @type {any} */ (window).YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    /** @type {any} */ (window).onYouTubeIframeAPIReady = () => resolve();
  });
  return loaderPromise;
}

/**
 * Lazily creates the underlying YT player instance.
 * @returns {void}
 */
function ensurePlayer() {
  if (ytPlayer) return;
  ytPlayer = new /** @type {any} */ (window).YT.Player('youtube-player', {
    events: {
      onReady() {
        emit('ready', { token: activeToken });
      },
      onStateChange(/** @type {any} */ ev) {
        emit('statechange', { state: ev.data, token: activeToken });
        handleStateChange(ev.data);
      },
      onError(/** @type {any} */ ev) {
        emit('error', { code: ev.data, raw: ev, token: activeToken });
      },
    },
  });
  setAllowAttributes();
}

/**
 * Handles player state changes for clip enforcement.
 * @param {number} state YouTube player state
 * @returns {void}
 */
function handleStateChange(state) {
  if (state === 1) {
    // PLAYING
    startGuard();
    if (playKickTimeout) {
      clearTimeout(playKickTimeout);
      playKickTimeout = null;
    }
  } else {
    stopGuard();
  }

  if (state === 0 && clipEnd > 0) {
    // ENDED
    if (loopEnabled) {
      ytPlayer?.seekTo(clipStart, true);
      schedulePlayKick();
    } else {
      ytPlayer?.pauseVideo();
    }
  }
}

/**
 * Starts the periodic guard interval.
 * @returns {void}
 */
function startGuard() {
  stopGuard();
  guardInterval = setInterval(() => {
    const t = ytPlayer?.getCurrentTime() ?? 0;
    if (clipEnd > 0 && t > clipEnd) {
      if (loopEnabled) {
        ytPlayer?.seekTo(clipStart, true);
        schedulePlayKick();
      } else {
        ytPlayer?.pauseVideo();
      }
    } else if (t < clipStart) {
      ytPlayer?.seekTo(clipStart, true);
    }
  }, CLIP_GUARD_MS);
  guardInterval.unref?.();
}

/**
 * Stops the guard interval.
 * @returns {void}
 */
function stopGuard() {
  if (guardInterval) {
    clearInterval(guardInterval);
    guardInterval = null;
  }
}

/**
 * Schedules a play kick if playback doesn't resume after looping.
 * @returns {void}
 */
function schedulePlayKick() {
  ytPlayer?.playVideo();
  if (playKickTimeout) {
    clearTimeout(playKickTimeout);
  }
  playKickTimeout = setTimeout(() => {
    playKickTimeout = null;
    ytPlayer?.playVideo();
  }, 200);
  playKickTimeout.unref?.();
}

/**
 * Updates clip bounds used for enforcement.
 * @param {number} start Clip start in seconds
 * @param {number} end Clip end in seconds
 * @returns {void}
 */
function setClip(start, end) {
  clipStart = start || 0;
  clipEnd = end || 0;
}

/**
 * Toggles loop enforcement.
 * @param {boolean} enabled Whether looping is enabled
 * @returns {void}
 */
function setLoop(enabled) {
  loopEnabled = enabled;
}

/**
 * Loads and plays a video.
 * @param {{videoId: string, start?: number, end?: number}} opts Load options
 * @returns {number} Load token for this request
 */
function load(opts) {
  activeToken = ++tokenCounter;
  stopGuard();
  if (playKickTimeout) {
    clearTimeout(playKickTimeout);
    playKickTimeout = null;
  }
  if (!ytPlayer) ensurePlayer();
  clipStart = opts.start || 0;
  clipEnd = opts.end || 0;
  ytPlayer.loadVideoById({
    videoId: opts.videoId,
    startSeconds: clipStart,
  });
  return activeToken;
}

/**
 * Cues a video without autoplay.
 * @param {{videoId: string, start?: number, end?: number}} opts Cue options
 * @returns {number} Load token for this request
 */
function cue(opts) {
  activeToken = ++tokenCounter;
  stopGuard();
  if (playKickTimeout) {
    clearTimeout(playKickTimeout);
    playKickTimeout = null;
  }
  if (!ytPlayer) ensurePlayer();
  clipStart = opts.start || 0;
  clipEnd = opts.end || 0;
  ytPlayer.cueVideoById({
    videoId: opts.videoId,
    startSeconds: clipStart,
  });
  return activeToken;
}

/**
 * Resolves when the player reports CUED or PLAYING for the given token.
 * @param {number} token Load token to match
 * @returns {Promise<void>}
 */
function gate(token) {
  return new Promise((resolve) => {
    const handler = (/** @type {{state:number, token:number}} */ ev) => {
      if (ev.token === token && (ev.state === 5 || ev.state === 1)) {
        off('statechange', handler);
        resolve();
      }
    };
    on('statechange', handler);
  });
}

/**
 * Seeks to a position.
 * @param {number} seconds Target time in seconds
 * @param {boolean} allowAhead Whether seeking ahead of buffer is allowed
 * @returns {void}
 */
function seek(seconds, allowAhead) {
  ytPlayer?.seekTo(seconds, allowAhead);
}

/**
 * Starts playback.
 * @returns {void}
 */
function play() {
  ytPlayer?.playVideo();
}

/**
 * Pauses playback.
 * @returns {void}
 */
function pause() {
  ytPlayer?.pauseVideo();
}

/**
 * Mutes the player.
 * @returns {void}
 */
function mute() {
  ytPlayer?.mute();
}

/**
 * Unmutes the player.
 * @returns {void}
 */
function unMute() {
  ytPlayer?.unMute();
}

/**
 * Gets the current playback time.
 * @returns {number} Current time in seconds
 */
function getCurrentTime() {
  return ytPlayer?.getCurrentTime() ?? 0;
}

/**
 * Gets the current video's duration.
 * @returns {number} Duration in seconds
 */
function getDuration() {
  return ytPlayer?.getDuration() ?? 0;
}

/**
 * Adds an event listener.
 * @param {string} event Event name
 * @param {Function} handler Callback to invoke
 * @returns {void}
 */
function on(event, handler) {
  const set = listeners.get(event) ?? new Set();
  set.add(handler);
  listeners.set(event, set);
}

/**
 * Removes an event listener.
 * @param {string} event Event name
 * @param {Function} handler Callback to remove
 * @returns {void}
 */
function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

/**
 * Destroys the player instance.
 * @returns {void}
 */
function destroy() {
  stopGuard();
  if (playKickTimeout) {
    clearTimeout(playKickTimeout);
    playKickTimeout = null;
  }
  if (ytPlayer) {
    ytPlayer.destroy();
    ytPlayer = null;
  }
}

/**
 * Ensures iframe has autoplay/fullscreen permissions.
 * @returns {void}
 */
function setAllowAttributes() {
  const iframe = ytPlayer?.getIframe();
  if (iframe) {
    iframe.setAttribute('allow', 'autoplay; fullscreen');
  }
}

/**
 * Returns the currently active load token.
 * @returns {number} Active token
 */
function currentToken() {
  return activeToken;
}

export const player = {
  ready,
  load,
  cue,
  seek,
  play,
  pause,
  mute,
  unMute,
  getCurrentTime,
  getDuration,
  on,
  off,
  destroy,
  setAllowAttributes,
  currentToken,
  setClip,
  setLoop,
  gate,
};

export default player;
