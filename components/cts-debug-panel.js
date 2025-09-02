/**
 * Debug panel displaying diagnostics log and dev helpers.
 */

import {
  subscribe,
  loadFixture,
  simulateAutoplayBlock,
  simulateError,
  simulateDelayedCued,
  FIXTURES,
} from '../diagnostics.js';
import { store } from '../store.js';

class CtsDebugPanel extends HTMLElement {
  constructor() {
    super();
    this.unsubscribe = null;
  }

  /**
   * Lifecycle hook when element is added to DOM.
   * @returns {void}
   */
  connectedCallback() {
    this.render();
    this.setup();
    this.unsubscribe = subscribe((entries) => this.renderLog(entries));
  }

  /**
   * Lifecycle hook when element is removed from DOM.
   * @returns {void}
   */
  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  /**
   * Renders panel skeleton.
   * @returns {void}
   */
  render() {
    // Tokens 6657a06 and 2025-09-02T21:43:48Z are stamped during deploy.
    // If stamping fails or during local dev, they remain as literal placeholders.
    const BUILD_SHA = '6657a06';
    const BUILD_TIME = '2025-09-02T21:43:48Z';

    this.innerHTML = `
      <div class="debug-panel">
        <div class="debug-meta">build: ${BUILD_SHA} @ ${BUILD_TIME}</div>
        <div class="debug-fixtures"></div>
        <div class="debug-simulators">
          <button data-sim="autoplay">Sim Autoplay Block</button>
          <button data-sim="error">Emit Error</button>
          <button data-sim="delay">Delay CUED</button>
        </div>
        <div class="debug-log"></div>
      </div>
    `;
  }

  /**
   * Wires fixture and simulator buttons.
   * @returns {void}
   */
  setup() {
    const fixtureWrap = this.querySelector('.debug-fixtures');
    if (fixtureWrap) {
      FIXTURES.forEach((f) => {
        const btn = document.createElement('button');
        btn.textContent = f.label;
        btn.addEventListener('click', () => loadFixture(f.id));
        fixtureWrap.appendChild(btn);
      });
    }
    this.querySelector('[data-sim="autoplay"]')?.addEventListener('click', simulateAutoplayBlock);
    this.querySelector('[data-sim="error"]')?.addEventListener('click', () => simulateError(150));
    this.querySelector('[data-sim="delay"]')?.addEventListener('click', () => simulateDelayedCued());
  }

  /**
   * Renders log entries.
   * @param {import('../diagnostics.js').LogEntry[]} entries Entries to display
   * @returns {void}
   */
  renderLog(entries) {
    const logEl = this.querySelector('.debug-log');
    if (!logEl) return;
    const { loadToken } = store.getState();
    logEl.innerHTML = entries
      .map((e) => {
        const stale = e.token < loadToken ? ' debug-entry--stale' : '';
        return `<div class="debug-entry${stale}">${new Date(e.ts).toLocaleTimeString()} ${e.source} ${e.action} t${e.token} pos${e.pos.toFixed(2)}</div>`;
      })
      .join('');
  }
}

customElements.define('cts-debug-panel', CtsDebugPanel);
