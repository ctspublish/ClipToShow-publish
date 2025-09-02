/**
 * cts-root - Root component for ClipToShow app
 * Handles URL parsing, routing, and state initialization
 */

import { store, actions } from '../store.js';
import { parseYouTubeUrl } from '../url.js';

/** @typedef {import("../store.js").AppState} AppState */
/** @typedef {import("../store.js").Action} Action */

/** @type {typeof actions} */
const typedActions = actions;

/**
 * cts-root Web Component
 */
class CtsRoot extends HTMLElement {
  constructor() {
    super();
  }

  /**
   * Called when element is connected to DOM
   * @returns {void}
   */
  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Called when element is disconnected from DOM
   * @returns {void}
   */
  disconnectedCallback() {
    // no-op
  }

  /**
   * Renders the component
   * @returns {void}
   */
  render() {
    this.innerHTML = `
      <div class="app-container">
        <header class="app-header">
          <h1 class="app-title">ClipTo.Show</h1>
          <p class="app-subtitle">Share YouTube clips!</p>
        </header>
        
        <main class="app-main">
          <cts-start-box></cts-start-box>
          <cts-error-banner></cts-error-banner>
          <cts-player></cts-player>
          <cts-timeline></cts-timeline>
          <cts-share-box></cts-share-box>
        </main>
      </div>
    `;
  }

  /**
   * Sets up event listeners
   * @returns {void}
   */
  setupEventListeners() {
    // Handle video input from start box
    this.addEventListener('video-input', (event) => {
      const customEvent = /** @type {CustomEvent} */ (event);
      const parsed = parseYouTubeUrl(customEvent.detail.input);
      if (parsed.videoId) {
        // Use atomic SET_VIDEO action with all available parameters
        /** @type {Action} */
        const actionPayload = {
          type: typedActions.SET_VIDEO,
          videoId: parsed.videoId,
          meta: { source: 'UI' },
        };

        // Add clip start if it exists
        if (parsed.clipStart > 0) {
          actionPayload.clipStart = parsed.clipStart;
        }

        store.dispatch(actionPayload);
      }
    });
  }

  // no extra helpers
}

// Define the custom element
customElements.define('cts-root', CtsRoot);
