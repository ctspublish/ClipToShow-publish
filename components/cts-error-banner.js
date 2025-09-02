/**
 * cts-error-banner - Slim dismissible banner for player errors
 */

import { store } from '../store.js';

/** @typedef {import('../store.js').AppState} AppState */

/**
 * Error banner component
 * @augments HTMLElement
 */
class CtsErrorBanner extends HTMLElement {
  constructor() {
    super();
    this.unsubscribe = null;
    this.banner = null;
    this.msgEl = null;
    this.linkEl = null;
    this.closeBtn = null;
    this.dismissed = false;
  }

  /** @returns {void} */
  connectedCallback() {
    this.innerHTML = `
      <div class="error-banner" style="display: none;">
        <span class="error-banner__msg"></span>
        <a class="error-banner__link" target="_blank" rel="noopener"></a>
        <button type="button" class="error-banner__close" aria-label="Dismiss">×</button>
      </div>`;
    this.banner = /** @type {HTMLElement|null} */ (this.querySelector('.error-banner'));
    this.msgEl = /** @type {HTMLElement|null} */ (this.querySelector('.error-banner__msg'));
    this.linkEl = /** @type {HTMLElement|null} */ (this.querySelector('.error-banner__link'));
    this.closeBtn = /** @type {HTMLElement|null} */ (this.querySelector('.error-banner__close'));
    this.closeBtn?.addEventListener('click', () => {
      if (this.banner) /** @type {HTMLElement} */ (this.banner).style.display = 'none';
      this.dismissed = true;
    });
    this.unsubscribe = store.subscribe((/** @type {AppState} */ s) => this.update(s));
    this.update(store.getState());
  }

  /** @returns {void} */
  disconnectedCallback() {
    this.unsubscribe?.();
  }

  /**
   * Updates banner based on state
   * @param {AppState} state App state
   * @returns {void}
   */
  update(state) {
    if (!this.banner || !this.msgEl || !this.linkEl || !this.closeBtn) return;
    if (state.error && !this.dismissed) {
      const { code, raw } = state.error;
      let msg = `Player error ${code}`;
      if (raw !== undefined) {
        try {
          const rawStr = JSON.stringify(raw);
          if (rawStr && rawStr !== '{}') {
            msg += ` ${rawStr.slice(0, 60)}`;
          }
        } catch {
          // ignore stringify errors
        }
      }
      this.msgEl.textContent = msg;
      this.closeBtn.style.display = 'inline';
      if (state.videoId) {
        const url = `https://youtube.com/watch?v=${state.videoId}&t=${state.clipStart}s`;
        this.linkEl.textContent = 'Open on YouTube';
        this.linkEl.setAttribute('href', url);
      } else {
        this.linkEl.textContent = '';
        this.linkEl.removeAttribute('href');
      }
      /** @type {HTMLElement} */ (this.banner).style.display = 'block';
    } else if (state.isLive) {
      this.dismissed = false;
      this.msgEl.textContent = 'Live — clipping disabled';
      this.closeBtn.style.display = 'none';
      if (state.videoId) {
        const url = `https://youtube.com/watch?v=${state.videoId}`;
        this.linkEl.textContent = 'Open on YouTube';
        this.linkEl.setAttribute('href', url);
      } else {
        this.linkEl.textContent = '';
        this.linkEl.removeAttribute('href');
      }
      /** @type {HTMLElement} */ (this.banner).style.display = 'block';
    } else {
      /** @type {HTMLElement} */ (this.banner).style.display = 'none';
      this.dismissed = false;
    }
  }
}

customElements.define('cts-error-banner', CtsErrorBanner);
