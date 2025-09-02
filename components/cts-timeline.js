/**
 * cts-timeline - Timeline component with draggable handles
 * Renders bar with draggable start/end handles and emits clip-change events
 */

import { store, actions } from '../store.js';

/** @typedef {import("../store.js").AppState} AppState */

/**
 * cts-timeline Web Component
 */
class CtsTimeline extends HTMLElement {
  constructor() {
    super();
    this.unsubscribe = null;
    this.isDragging = false;
    this.dragHandle = null;
    this.dragStartX = 0;
    this.dragStartValue = 0;
    this.timelineRect = null;
    this.tooltip = null;
  }

  /**
   * Called when element is connected to DOM
   * @returns {void}
   */
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();

    // Subscribe to store changes
    this.unsubscribe = store.subscribe((state) => {
      this.updateFromState(state);
    });

    // Initial update
    this.updateFromState(store.getState());
  }

  /**
   * Called when element is disconnected from DOM
   * @returns {void}
   */
  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.removeKeyboardShortcuts();
    this.removeDocumentListeners();
  }

  /**
   * Renders the component
   * @returns {void}
   */
  render() {
    this.innerHTML = `
      <div class="timeline-container">
        <div class="timeline-header">
          <h3 class="timeline-title">Clip Timeline</h3>
          <div class="timeline-duration">Duration: <span class="timeline-duration-value">0:00</span></div>
        </div>
        
        <div class="timeline-track-container">
          <div class="timeline-track" role="slider" aria-label="Video timeline">
            <div class="timeline-background"></div>
            <div class="timeline-clip-region"></div>
            <div class="timeline-playhead"></div>
            
            <div class="timeline-handle timeline-handle--start" 
                 role="slider" 
                 aria-label="Clip start time"
                 tabindex="0"
                 data-handle="start">
              <span class="timeline-handle-label">Start</span>
            </div>
            
            <div class="timeline-handle timeline-handle--end" 
                 role="slider" 
                 aria-label="Clip end time"
                 tabindex="0"
                 data-handle="end">
              <span class="timeline-handle-label">End</span>
            </div>
          </div>
          
          <div class="timeline-tooltip" style="display: none;">
            <span class="timeline-tooltip-time">0:00</span>
          </div>
        </div>
        
        <div class="timeline-inputs">
          <div class="timeline-input-group">
            <label for="clip-start-input">Clip Start (s)</label>
            <input type="number" 
                   id="clip-start-input" 
                   class="timeline-input" 
                   min="0" 
                   step="0.01" 
                   value="0">
          </div>
          
          <div class="timeline-input-group">
            <label for="clip-end-input">Clip End (s)</label>
            <input type="number" 
                   id="clip-end-input" 
                   class="timeline-input" 
                   min="0" 
                   step="0.01" 
                   value="0">
          </div>
          
          <button type="button" class="timeline-loop-btn" title="Toggle loop (L)">
            <span class="sr-only">Toggle loop</span>
            🔁
          </button>
        </div>
      </div>
    `;

    this.cacheElements();
  }

  /**
   * Caches DOM elements for performance
   * @returns {void}
   */
  cacheElements() {
    this.track = this.querySelector('.timeline-track');
    this.clipRegion = this.querySelector('.timeline-clip-region');
    this.playhead = this.querySelector('.timeline-playhead');
    this.startHandle = this.querySelector('.timeline-handle--start');
    this.endHandle = this.querySelector('.timeline-handle--end');
    this.tooltip = this.querySelector('.timeline-tooltip');
    this.tooltipTime = this.querySelector('.timeline-tooltip-time');
    this.durationValue = this.querySelector('.timeline-duration-value');
    this.startInput = this.querySelector('#clip-start-input');
    this.endInput = this.querySelector('#clip-end-input');
    this.loopBtn = this.querySelector('.timeline-loop-btn');
  }

  /**
   * Sets up event listeners
   * @returns {void}
   */
  setupEventListeners() {
    if (!this.track) return;

    // Handle dragging
    this.startHandle?.addEventListener('pointerdown', (e) =>
      this.handlePointerDown(/** @type {PointerEvent} */ (e), 'start'),
    );
    this.endHandle?.addEventListener('pointerdown', (e) =>
      this.handlePointerDown(/** @type {PointerEvent} */ (e), 'end'),
    );

    // Handle track clicks
    this.track.addEventListener('click', (e) => this.handleTrackClick(/** @type {MouseEvent} */ (e)));

    // Handle input changes
    this.startInput?.addEventListener('input', (e) => this.handleInputChange(e, 'start'));
    this.endInput?.addEventListener('input', (e) => this.handleInputChange(e, 'end'));
    this.startInput?.addEventListener('blur', (e) => this.handleInputBlur(e, 'start'));
    this.endInput?.addEventListener('blur', (e) => this.handleInputBlur(e, 'end'));

    // Handle keyboard nudges on handles
    this.startHandle?.addEventListener('keydown', (e) =>
      this.handleHandleKey(/** @type {KeyboardEvent} */ (e), 'start'),
    );
    this.endHandle?.addEventListener('keydown', (e) => this.handleHandleKey(/** @type {KeyboardEvent} */ (e), 'end'));
    this.startHandle?.addEventListener('keyup', (e) =>
      this.handleHandleKeyUp(/** @type {KeyboardEvent} */ (e), 'start'),
    );
    this.endHandle?.addEventListener('keyup', (e) => this.handleHandleKeyUp(/** @type {KeyboardEvent} */ (e), 'end'));
    this.startHandle?.addEventListener('blur', () => this.commitHandle('start'));
    this.endHandle?.addEventListener('blur', () => this.commitHandle('end'));

    // Handle loop button
    this.loopBtn?.addEventListener('click', () => {
      store.dispatch({ type: actions.TOGGLE_LOOP, meta: { source: 'UI' } });
    });

    // Global pointer events for dragging
    this.handlePointerMove = (/** @type {Event} */ e) => this.onPointerMove(/** @type {PointerEvent} */ (e));
    this.handlePointerUp = (/** @type {Event} */ _e) => this.onPointerUp();
  }

  /**
   * Sets up keyboard shortcuts
   * @returns {void}
   */
  setupKeyboardShortcuts() {
    this.keyboardHandler = (/** @type {KeyboardEvent} */ e) => {
      const state = store.getState();

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (state.playing) {
            store.dispatch({ type: actions.SET_PLAY_STATE, playing: false, meta: { source: 'UI' } });
          } else {
            store.dispatch({ type: actions.SET_PLAY_STATE, playing: true, meta: { source: 'UI' } });
          }
          break;

        case 'i':
        case 'I':
          e.preventDefault();
          store.dispatch({ type: actions.SET_CLIP_START, seconds: state.position, meta: { source: 'UI' } });
          this.flashHandle('start');
          break;

        case 'o':
        case 'O':
          e.preventDefault();
          store.dispatch({ type: actions.SET_CLIP_END, seconds: state.position, meta: { source: 'UI' } });
          this.flashHandle('end');
          break;

        case 'l':
        case 'L':
          e.preventDefault();
          store.dispatch({ type: actions.TOGGLE_LOOP, meta: { source: 'UI' } });
          break;

        case 'ArrowLeft': {
          e.preventDefault();
          const leftStep = e.shiftKey ? 0.1 : 1;
          store.dispatch({
            type: actions.SET_POSITION,
            seconds: Math.max(0, state.position - leftStep),
            meta: { source: 'UI' },
          });
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const rightStep = e.shiftKey ? 0.1 : 1;
          store.dispatch({
            type: actions.SET_POSITION,
            seconds: Math.min(state.duration, state.position + rightStep),
            meta: { source: 'UI' },
          });
          break;
        }
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Removes keyboard shortcuts
   * @returns {void}
   */
  removeKeyboardShortcuts() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }
  }

  /**
   * Handles pointer down on handles
   * @param {PointerEvent} e - Pointer event
   * @param {string} handleType - 'start' or 'end'
   * @returns {void}
   */
  handlePointerDown(e, handleType) {
    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.dragHandle = handleType;
    this.dragStartX = e.clientX;
    this.timelineRect = /** @type {HTMLElement} */ (this.track).getBoundingClientRect();

    const state = store.getState();
    this.dragStartValue = handleType === 'start' ? state.clipStart : state.clipEnd;

    // Pause video during drag
    if (state.playing) {
      store.dispatch({ type: actions.SET_PLAY_STATE, playing: false, meta: { source: 'UI' } });
    }

    store.dispatch({ type: actions.SET_DRAGGING, dragging: true, meta: { source: 'UI' } });

    // Scale up handle
    const handle = handleType === 'start' ? this.startHandle : this.endHandle;
    handle?.classList.add('timeline-handle--dragging');

    // Show tooltip
    this.showTooltip(e.clientX);

    if (this.handlePointerMove && this.handlePointerUp) {
      document.addEventListener('pointermove', this.handlePointerMove);
      document.addEventListener('pointerup', this.handlePointerUp);
    }

    // Capture pointer
    if (handle?.setPointerCapture) {
      handle.setPointerCapture(e.pointerId);
    }
  }

  /**
   * Handles pointer move during drag
   * @param {PointerEvent} e - Pointer event
   * @returns {void}
   */
  onPointerMove(e) {
    if (!this.isDragging || !this.timelineRect) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaPercent = deltaX / this.timelineRect.width;
    const state = store.getState();
    const deltaSeconds = deltaPercent * state.duration;
    const newValue = this.dragStartValue + deltaSeconds;

    // Clamp values
    let clampedValue;
    if (this.dragHandle === 'start') {
      clampedValue = Math.max(0, Math.min(newValue, state.clipEnd));
      store.dispatch({ type: actions.SET_CLIP_START, seconds: clampedValue, meta: { source: 'UI' } });
    } else {
      clampedValue = Math.max(state.clipStart, Math.min(newValue, state.duration));
      store.dispatch({ type: actions.SET_CLIP_END, seconds: clampedValue, meta: { source: 'UI' } });
    }

    // Update tooltip
    this.updateTooltip(e.clientX, clampedValue);

    // Emit timeline pointer move event
    this.dispatchEvent(
      new CustomEvent('timeline-pointer-move', {
        detail: { seconds: clampedValue },
        bubbles: true,
      }),
    );
  }

  /**
   * Handles pointer up to end drag
   * @returns {void}
   */
  onPointerUp() {
    if (!this.isDragging) return;

    this.isDragging = false;
    store.dispatch({ type: actions.SET_DRAGGING, dragging: false, meta: { source: 'UI' } });

    // Remove dragging class
    const handle = this.dragHandle === 'start' ? this.startHandle : this.endHandle;
    handle?.classList.remove('timeline-handle--dragging');

    // Hide tooltip
    this.hideTooltip();

    // Emit clip change event
    const state = store.getState();
    const eventName = this.dragHandle === 'start' ? 'clip-start-change' : 'clip-end-change';
    const seconds = this.dragHandle === 'start' ? state.clipStart : state.clipEnd;

    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { seconds },
        bubbles: true,
      }),
    );

    this.dragHandle = null;
    this.timelineRect = null;

    this.removeDocumentListeners();
  }

  /**
   * Handles track clicks to seek
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   */
  handleTrackClick(e) {
    if (this.isDragging) return;

    const rect = /** @type {HTMLElement} */ (this.track).getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const state = store.getState();
    const seconds = percent * state.duration;

    store.dispatch({
      type: actions.SET_POSITION,
      seconds: Math.max(0, Math.min(seconds, state.duration)),
      meta: { source: 'UI' },
    });
  }

  /**
   * Handles input field changes
   * @param {Event} e - Input event
   * @param {string} type - 'start' or 'end'
   * @returns {void}
   */
  handleInputChange(e, type) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const value = parseFloat(target?.value || '0') || 0;
    const actionType = type === 'start' ? actions.SET_CLIP_START : actions.SET_CLIP_END;
    store.dispatch({ type: actionType, seconds: value, meta: { source: 'UI' } });
  }

  /**
   * Handles input field blur
   * @param {Event} e - Blur event
   * @param {string} type - 'start' or 'end'
   * @returns {void}
   */
  handleInputBlur(e, type) {
    const state = store.getState();
    const seconds = type === 'start' ? state.clipStart : state.clipEnd;

    this.dispatchEvent(
      new CustomEvent(`clip-${type}-change`, {
        detail: { seconds },
        bubbles: true,
      }),
    );
  }

  /**
   * Handles arrow key nudges on clip handles
   * @param {KeyboardEvent} e - Keyboard event
   * @param {string} type - 'start' or 'end'
   * @returns {void}
   */
  handleHandleKey(e, type) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = 0.05;
    const state = store.getState();
    const delta = e.key === 'ArrowLeft' ? -step : step;
    const actionType = type === 'start' ? actions.SET_CLIP_START : actions.SET_CLIP_END;
    const current = type === 'start' ? state.clipStart : state.clipEnd;
    store.dispatch({ type: actionType, seconds: current + delta, meta: { source: 'UI' } });
  }

  /**
   * Commits clip change on keyup
   * @param {KeyboardEvent} e - Keyboard event
   * @param {string} type - 'start' or 'end'
   * @returns {void}
   */
  handleHandleKeyUp(e, type) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    this.commitHandle(type);
  }

  /**
   * Emits clip-change event for a handle
   * @param {string} type - 'start' or 'end'
   * @returns {void}
   */
  commitHandle(type) {
    const state = store.getState();
    const seconds = type === 'start' ? state.clipStart : state.clipEnd;
    this.dispatchEvent(
      new CustomEvent(`clip-${type}-change`, {
        detail: { seconds },
        bubbles: true,
      }),
    );
  }

  /**
   * Updates component from store state
   * @param {AppState} state - Current app state
   * @returns {void}
   */
  updateFromState(state) {
    if (!this.track) return;

    // Update duration display
    if (this.durationValue) {
      this.durationValue.textContent = this.formatTime(state.duration);
    }

    // Update positions
    this.updatePositions(state);


    // Update inputs
    if (this.startInput) {
      /** @type {HTMLInputElement} */ (this.startInput).value = state.clipStart.toFixed(2);
    }
    if (this.endInput) {
      /** @type {HTMLInputElement} */ (this.endInput).value = state.clipEnd.toFixed(2);
    }

    // Update loop button
    this.loopBtn?.classList.toggle('timeline-loop-btn--active', state.loopEnabled);

    this.classList.toggle('timeline--disabled', Boolean(state.error));
    this.classList.toggle('timeline--readonly', state.isLive);
  }

  /**
   * Updates visual positions of elements
   * @param {AppState} state - Current app state
   * @returns {void}
   */
  updatePositions(state) {
    if (state.duration === 0) {
      if (this.playhead) {
        /** @type {HTMLElement} */ (this.playhead).style.left = '0%';
      }
      return;
    }

    const startPercent = (state.clipStart / state.duration) * 100;
    const endPercent = (state.clipEnd / state.duration) * 100;
    const positionPercent = (state.position / state.duration) * 100;

    // Update handles
    if (this.startHandle) {
      /** @type {HTMLElement} */ (this.startHandle).style.left = `${startPercent}%`;
    }
    if (this.endHandle) {
      /** @type {HTMLElement} */ (this.endHandle).style.left = `${endPercent}%`;
    }

    // Update clip region
    if (this.clipRegion) {
      /** @type {HTMLElement} */ (this.clipRegion).style.left = `${startPercent}%`;
      /** @type {HTMLElement} */ (this.clipRegion).style.width = `${endPercent - startPercent}%`;
    }

    // Update playhead
    if (this.playhead) {
      /** @type {HTMLElement} */ (this.playhead).style.left = `${positionPercent}%`;
    }
  }

  /**
   * Shows tooltip at position
   * @param {number} x - X coordinate
   * @returns {void}
   */
  showTooltip(x) {
    if (!this.tooltip) return;

    /** @type {HTMLElement} */ (this.tooltip).style.display = 'block';
    
    // Set initial tooltip content based on current handle value
    const state = store.getState();
    const currentValue = this.dragHandle === 'start' ? state.clipStart : state.clipEnd;
    this.updateTooltip(x, currentValue);
  }

  /**
   * Updates tooltip content and position
   * @param {number} x - X coordinate
   * @param {number} seconds - Time in seconds
   * @returns {void}
   */
  updateTooltip(x, seconds) {
    if (!this.tooltip || !this.tooltipTime) return;

    this.tooltipTime.textContent = this.formatTime(seconds);
    this.updateTooltipPosition(x);
  }

  /**
   * Updates tooltip position
   * @param {number} x - X coordinate
   * @returns {void}
   */
  updateTooltipPosition(x) {
    if (!this.tooltip || !this.timelineRect) return;

    const tooltipRect = this.tooltip.getBoundingClientRect();
    const containerRect = /** @type {HTMLElement} */ (
      this.querySelector('.timeline-track-container')
    ).getBoundingClientRect();

    let left = x - containerRect.left - tooltipRect.width / 2;
    left = Math.max(0, Math.min(left, containerRect.width - tooltipRect.width));

    /** @type {HTMLElement} */ (this.tooltip).style.left = `${left}px`;
  }

  /**
   * Hides tooltip
   * @returns {void}
   */
  hideTooltip() {
    if (this.tooltip) {
      /** @type {HTMLElement} */ (this.tooltip).style.display = 'none';
    }
  }

  /**
   * Flashes handle to indicate programmatic update
   * @param {string} handleType - 'start' or 'end'
   * @returns {void}
   */
  flashHandle(handleType) {
    const handle = handleType === 'start' ? this.startHandle : this.endHandle;
    if (!handle) return;

    handle.classList.add('timeline-handle--flash');
    setTimeout(() => {
      handle.classList.remove('timeline-handle--flash');
    }, 300);
  }

  /**
   * Seeks to specific time (public method)
   * @param {number} seconds - Time in seconds
   * @returns {void}
   */
  seek(seconds) {
    store.dispatch({ type: actions.SET_POSITION, seconds, meta: { source: 'UI' } });
  }

  /**
   * Flashes the timeline (public method)
   * @returns {void}
   */
  flash() {
    this.track?.classList.add('timeline-track--flash');
    setTimeout(() => {
      this.track?.classList.remove('timeline-track--flash');
    }, 300);
  }

  /**
   * Removes document event listeners safely
   * @returns {void}
   */
  removeDocumentListeners() {
    if (this.handlePointerMove) {
      document.removeEventListener('pointermove', this.handlePointerMove);
    }
    if (this.handlePointerUp) {
      document.removeEventListener('pointerup', this.handlePointerUp);
    }
  }

  /**
   * Formats time in MM:SS.ss format with 2 decimal precision
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const wholeSecs = Math.floor(remainingSeconds);
    const decimals = (remainingSeconds - wholeSecs).toFixed(2).slice(1); // Get .XX part
    return `${mins}:${wholeSecs.toString().padStart(2, '0')}${decimals}`;
  }
}

// Define the custom element
customElements.define('cts-timeline', CtsTimeline);
