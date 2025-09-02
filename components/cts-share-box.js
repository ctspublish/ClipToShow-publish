/**
 * cts-share-box - Share URL component with clipboard functionality
 * Displays current URL and provides copy functionality
 */

import { store } from '../store.js';
import { serializeUrl } from '../url.js';

/** @typedef {import("../store.js").AppState} AppState */

/**
 * cts-share-box Web Component
 */
class CtsShareBox extends HTMLElement {
  constructor() {
    super();
    this.unsubscribe = null;
    this.input = null;
    this.button = null;
  }

  /**
   * Called when element is connected to DOM
   * @returns {void}
   */
  connectedCallback() {
    this.render();
    this.setupEventListeners();

    // Subscribe to store changes to update URL
    this.unsubscribe = store.subscribe((/** @type {AppState} */ state) => {
      this.updateUrl(state);
    });

    // Initial update
    this.updateUrl(store.getState());
  }

  /**
   * Called when element is disconnected from DOM
   * @returns {void}
   */
  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  /**
   * Renders the component
   * @returns {void}
   */
  render() {
    this.innerHTML = `
      <div class="share-box">
        <label for="share-url" class="share-box__label">
          Share this clip
        </label>
        <div class="share-box__input-group">
          <input 
            type="text" 
            id="share-url"
            class="share-box__input"
            readonly
            placeholder="Load a video to get shareable URL"
          />
          <button type="button" class="share-box__button btn-secondary" disabled>
            Copy
          </button>
        </div>
        <div class="share-box__status" aria-live="polite"></div>
      </div>
    `;

    this.input = this.querySelector('.share-box__input');
    this.button = this.querySelector('.share-box__button');
    this.status = this.querySelector('.share-box__status');
  }

  /**
   * Sets up event listeners
   * @returns {void}
   */
  setupEventListeners() {
    if (!this.button) return;

    // Handle copy button click
    this.button.addEventListener('click', () => {
      this.copyToClipboard();
    });

    // Handle input click (select all)
    if (this.input) {
      this.input.addEventListener('click', () => {
        const inputEl = /** @type {HTMLInputElement} */ (this.input);
        inputEl.select();
      });
    }
  }

  /**
   * Updates the URL display based on current state
   * @param {AppState} state - Current app state
   * @returns {void}
   */
  updateUrl(state) {
    if (!this.input || !this.button) return;
    const inputEl = /** @type {HTMLInputElement} */ (this.input);
    const buttonEl = /** @type {HTMLButtonElement} */ (this.button);

    if (state.error || state.isLive) {
      buttonEl.disabled = true;
      inputEl.disabled = true;
      inputEl.value = state.isLive ? '' : inputEl.value;
      return;
    }

    inputEl.disabled = false;

    if (state.videoId) {
      inputEl.value = serializeUrl(state);
      buttonEl.disabled = false;
    } else {
      inputEl.value = '';
      buttonEl.disabled = true;
    }
  }

  /**
   * Copies URL to clipboard
   * @returns {Promise<void>}
   */
  async copyToClipboard() {
    if (!this.input || store.getState().isLive) return;
    const inputEl = /** @type {HTMLInputElement} */ (this.input);
    if (!inputEl.value) return;

    try {
      await navigator.clipboard.writeText(inputEl.value);
      this.showStatus('✓ Copied to clipboard', 'success');
    } catch (_error) {
      // Fallback for older browsers
      this.fallbackCopy();
    }
  }

  /**
   * Fallback copy method for older browsers
   * @returns {void}
   */
  fallbackCopy() {
    if (!this.input) return;
    try {
      const inputEl = /** @type {HTMLInputElement} */ (this.input);
      inputEl.select();
      inputEl.setSelectionRange(0, 99999); // For mobile devices

      const successful = document.execCommand('copy');
      if (successful) {
        this.showStatus('✓ Copied to clipboard', 'success');
      } else {
        this.showStatus('Copy failed - please select and copy manually', 'error');
      }
    } catch (_error) {
      this.showStatus('Copy not supported - please select and copy manually', 'error');
    }
  }

  /**
   * Shows status message
   * @param {string} message - Status message
   * @param {string} type - Status type ('success' or 'error')
   * @returns {void}
   */
  showStatus(message, type) {
    if (!this.status) return;

    this.status.textContent = message;
    this.status.className = `share-box__status share-box__status--${type}`;

    // Clear status after 3 seconds
    setTimeout(() => {
      if (this.status) {
        this.status.textContent = '';
        this.status.className = 'share-box__status';
      }
    }, 3000);
  }
}

// Define the custom element
customElements.define('cts-share-box', CtsShareBox);
