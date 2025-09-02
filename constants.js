/**
 * Shared tunable constants for ClipToShow.
 * @module constants
 */

/**
 * Number of decimal places for serializing times.
 * @type {number}
 */
export const SERIAL_DECIMALS = 2;

/**
 * Debounce window for seek requests in milliseconds.
 * @type {number}
 */
export const SEEK_DEBOUNCE_MS = 100;

/**
 * TTL for in-flight seek operations in milliseconds.
 * @type {number}
 */
export const SEEK_INFLIGHT_TTL_MS = 500;

/**
 * Maximum delta in seconds considered the same seek.
 * @type {number}
 */
export const SEEK_EPSILON_S = 0.15;

/**
 * Timeout in milliseconds used to detect autoplay blocking.
 * @type {number}
 */
export const AUTOPLAY_DETECT_MS = 300;

/**
 * Guard window in milliseconds applied around clip bounds.
 * @type {number}
 */
export const CLIP_GUARD_MS = 250;

/**
 * Throttle duration in milliseconds for URL state updates.
 * @type {number}
 */
export const URL_THROTTLE_MS = 500;
