/**
 * cts-start-box - Video URL/ID input component
 * Validates and dispatches setVideo on Enter or Paste
 */

/**
 * cts-start-box Web Component
 */
class CtsStartBox extends HTMLElement {
  constructor() {
    super();
    this.input = null;
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
   * Renders the component
   * @returns {void}
   */
  render() {
    this.innerHTML = `
      <div class="start-box">
        <label for="video-input" class="start-box__label">
          Enter YouTube URL or Video ID
        </label>
        <div class="start-box__input-group">
          <input 
            type="text" 
            id="video-input"
            class="start-box__input"
            placeholder="https://youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="button" class="start-box__button btn-primary">
            Load Video
          </button>
        </div>
        <div class="start-box__help">
          Supports YouTube URLs with timestamps (#t=1m2s or &t=90)
        </div>
      </div>
    `;

    this.input = this.querySelector('.start-box__input');
    this.button = this.querySelector('.start-box__button');
  }

  /**
   * Sets up event listeners
   * @returns {void}
   */
  setupEventListeners() {
    if (!this.input || !this.button) return;

    // Handle Enter key
    this.input.addEventListener('keydown', (event) => {
      const keyEvent = /** @type {KeyboardEvent} */ (event);
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault();
        this.handleSubmit();
      }
    });

    // Handle paste
    this.input.addEventListener('paste', (_event) => {
      // Small delay to let paste complete
      setTimeout(() => {
        this.handleSubmit();
      }, 10);
    });

    // Handle button click
    this.button.addEventListener('click', () => {
      this.handleSubmit();
    });

    // Clear input on focus if it contains placeholder-like text
    this.input.addEventListener('focus', () => {
      const inputEl = /** @type {HTMLInputElement} */ (this.input);
      if (inputEl && inputEl.value.includes('youtube.com') && inputEl.value.includes('dQw4w9WgXcQ')) {
        inputEl.value = '';
      }
    });
  }

  /**
   * Handles form submission
   * @returns {void}
   */
  handleSubmit() {
    if (!this.input) return;
    const inputEl = /** @type {HTMLInputElement} */ (this.input);
    const input = inputEl.value.trim();
    if (!input) return;

    // Validate input
    if (this.isValidInput(input)) {
      // Dispatch custom event with the input
      this.dispatchEvent(
        new CustomEvent('video-input', {
          detail: { input },
          bubbles: true,
        }),
      );

      // Clear input after successful submission
      if (this.input) {
        const inputEl = /** @type {HTMLInputElement} */ (this.input);
        inputEl.value = '';
      }
      this.showSuccess();
    } else {
      this.showError('Please enter a valid YouTube URL or video ID');
    }
  }

  /**
   * Validates YouTube URL or video ID
   * @param {string} input - Input to validate
   * @returns {boolean} Whether input is valid
   */
  isValidInput(input) {
    // Check for 11-character video ID
    if (/^[\w-]{11}$/.test(input)) {
      return true;
    }

    // Check for YouTube URL patterns
    try {
      const url = new URL(input);
      return url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be');
    } catch {
      return false;
    }
  }

  /**
   * Shows success feedback
   * @returns {void}
   */
  showSuccess() {
    if (!this.input) return;
    this.input.classList.add('start-box__input--success');
    setTimeout(() => {
      if (this.input) {
        this.input.classList.remove('start-box__input--success');
      }
    }, 1000);
  }

  /**
   * Shows error feedback
   * @param {string} message - Error message
   * @returns {void}
   */
  showError(message) {
    if (!this.input) return;
    this.input.classList.add('start-box__input--error');

    // Show error message
    let errorEl = this.querySelector('.start-box__error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'start-box__error';
      const startBox = this.querySelector('.start-box');
      if (startBox) {
        startBox.appendChild(errorEl);
      }
    }
    if (errorEl) {
      errorEl.textContent = message;
    }

    // Clear error after 3 seconds
    setTimeout(() => {
      if (this.input) {
        this.input.classList.remove('start-box__input--error');
      }
      if (errorEl) {
        errorEl.remove();
      }
    }, 3000);
  }
}

// Define the custom element
customElements.define('cts-start-box', CtsStartBox);
