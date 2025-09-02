/**
 * cts-player - YouTube iframe API integration
 * Handles video loading, playback control, and clip enforcement
 */

import { store, actions } from '../store.js';

/** @typedef {import("../store.js").AppState} AppState */

/**
 * cts-player Web Component
 */
class CtsPlayer extends HTMLElement {
  constructor() {
    super();
    this.player = null;
    this.unsubscribe = null;
    this.timeUpdateInterval = null;
    this.clipCheckInterval = null;
  }

  /**
   * Called when element is connected to DOM
   * @returns {void}
   */
  connectedCallback() {
    this.render();
    this.loadYouTubeAPI();

    // Subscribe to store changes
    this.unsubscribe = store.subscribe((state) => {
      this.handleStateChange(state);
    });
  }

  /**
   * Called when element is disconnected from DOM
   * @returns {void}
   */
  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.clearIntervals();
    if (this.player) {
      this.player.destroy();
    }
  }

  /**
   * Renders the component
   * @returns {void}
   */
  render() {
    this.innerHTML = `
      <div class="player-container">
        <div class="player-wrapper">
          <div id="youtube-player"></div>
          <div class="player-overlay" style="display: none;">
            <div class="player-message">
              <h3>Enter a YouTube URL to get started</h3>
              <p>Paste any YouTube link in the input above</p>
            </div>
          </div>
        </div>
        <div class="autoplay-banner" style="display: none;">
          Tap to play (autoplay blocked). Playing muted — click to unmute.
        </div>
        <div class="player-controls">
          <button type="button" class="player-control player-control--play" disabled>
            <span class="sr-only">Play</span>
            ▶️
          </button>
          <button type="button" class="player-control player-control--pause" disabled style="display: none;">
            <span class="sr-only">Pause</span>
            ⏸️
          </button>
          <div class="player-time">
            <span class="player-time__current">0:00</span>
            <span class="player-time__separator">/</span>
            <span class="player-time__duration">0:00</span>
          </div>
        </div>
      </div>
    `;

    this.setupControls();
  }

  /**
   * Sets up player controls
   * @returns {void}
   */
  setupControls() {
    this.playBtn = this.querySelector('.player-control--play');
    this.pauseBtn = this.querySelector('.player-control--pause');
    this.currentTimeEl = this.querySelector('.player-time__current');
    this.durationEl = this.querySelector('.player-time__duration');
    this.overlay = this.querySelector('.player-overlay');
    this.autoplayBanner = this.querySelector('.autoplay-banner');

    // Play/pause buttons
    this.playBtn?.addEventListener('click', () => this.play());
    this.pauseBtn?.addEventListener('click', () => this.pause());

    const state = store.getState();
    if (this.autoplayBanner) {
      /** @type {HTMLElement} */ (this.autoplayBanner).style.display = state.autoplayBlocked ? 'block' : 'none';
    }
  }

  /**
   * Loads YouTube iframe API
   * @returns {void}
   */
  loadYouTubeAPI() {
    // Check if API is already loaded
    if (/** @type {any} */ (window).YT && /** @type {any} */ (window).YT.Player) {
      this.initializePlayer();
      return;
    }

    // Load API script
    if (!(/** @type {any} */ (window).onYouTubeIframeAPIReady)) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);

      /** @type {any} */ (window).onYouTubeIframeAPIReady = () => {
        this.initializePlayer();
      };
    }
  }

  /**
   * Initializes YouTube player
   * @returns {void}
   */
  initializePlayer() {
    const state = store.getState();

    this.player = new /** @type {any} */ (window).YT.Player('youtube-player', {
      height: '315',
      width: '560',
      videoId: state.videoId || '',
      playerVars: {
        autoplay: 1,
        controls: 1,
        disablekb: 1, // Disable keyboard controls (we'll handle them)
        fs: 1, // Allow fullscreen
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => this.onPlayerReady(),
        onStateChange: (/** @type {any} */ event) => this.onPlayerStateChange(event),
        onError: (/** @type {any} */ event) => this.onPlayerError(event),
      },
    });
  }

  /**
   * Called when player is ready
   * @returns {void}
   */
  onPlayerReady() {
    store.dispatch({ type: actions.SET_PLAYER_READY, ready: true, meta: { source: 'PLAYER' } });

    const state = store.getState();
    if (state.videoId) {
      this.hideOverlay();
      this.enableControls();

      // Set duration when available
      const duration = this.player.getDuration();
      if (duration > 0) {
        store.dispatch({ type: actions.SET_DURATION, duration, meta: { source: 'PLAYER' } });
      }
    } else {
      this.showOverlay();
    }

    this.startTimeUpdates();
  }

  /**
   * Called when player state changes
   * @param {object} event - YouTube player event
   * @returns {void}
   */
  onPlayerStateChange(event) {
    const eventData = /** @type {any} */ (event).data;
    const isPlaying = eventData === /** @type {any} */ (window).YT.PlayerState.PLAYING;
    const isEnded = eventData === /** @type {any} */ (window).YT.PlayerState.ENDED;
    store.dispatch({ type: actions.SET_PLAY_STATE, playing: isPlaying, meta: { source: 'PLAYER' } });

    this.updatePlayPauseButtons(isPlaying);

    // Handle clip enforcement based on state
    if (isPlaying) {
      this.startClipEnforcement();
    } else if (isEnded) {
      // When video ends, handle looping immediately and keep enforcement active
      this.handleVideoEnd();
    } else {
      // Only stop enforcement for other states (paused, buffering, etc.)
      this.stopClipEnforcement();
    }

    // Update duration for live/DVR detection
    if (
      eventData === /** @type {any} */ (window).YT.PlayerState.PLAYING ||
      eventData === /** @type {any} */ (window).YT.PlayerState.PAUSED ||
      eventData === /** @type {any} */ (window).YT.PlayerState.CUED
    ) {
      const duration = this.player.getDuration();
      store.dispatch({ type: actions.SET_DURATION, duration, meta: { source: 'PLAYER' } });
    }
  }

  /**
   * Called when player encounters an error
   * @param {object} _event - YouTube player event
   * @returns {void}
   */
  onPlayerError(_event) {
    console.error('YouTube player error:', /** @type {any} */ (_event).data);
    this.showOverlay();
    this.disableControls();
  }

  /**
   * Handles store state changes
   * @param {AppState} state - Current app state
   * @returns {void}
   */
  handleStateChange(state) {
    if (!this.player) return;

    // Load new video
    const currentVideoId = /** @type {any} */ (this.player).getVideoData()?.video_id;
    if (state.videoId && currentVideoId !== state.videoId) {
      this.player.loadVideoById({
        videoId: state.videoId,
        startSeconds: state.clipStart || 0,
      });
      this.hideOverlay();
      this.enableControls();
    }

    // Update time display
    this.updateTimeDisplay(state);

    if (this.autoplayBanner) {
      /** @type {HTMLElement} */ (this.autoplayBanner).style.display = state.autoplayBlocked ? 'block' : 'none';
    }
  }

  /**
   * Starts time updates
   * @returns {void}
   */
  startTimeUpdates() {
    this.clearIntervals();

    this.timeUpdateInterval = setInterval(() => {
      if (this.player && this.player.getCurrentTime) {
        const currentTime = this.player.getCurrentTime();
        store.dispatch({ type: actions.SET_POSITION, seconds: currentTime, meta: { source: 'PLAYER' } });
      }
    }, 100); // Update every 100ms for smooth timeline
    this.timeUpdateInterval.unref?.();
  }

  /**
   * Handles video end state for looping
   * @returns {void}
   */
  handleVideoEnd() {
    const state = store.getState();

    if (state.clipEnd > 0 && state.loopEnabled) {
      // Video ended and looping is enabled - seek back to start and resume playback
      console.log(`🔄 Video ended at ${this.player.getCurrentTime()}s, looping back to ${state.clipStart}s`);
      this.seekTo(state.clipStart);

      // Resume playback after a short delay to ensure seek completes
      setTimeout(() => {
        this.play();
        // Keep clip enforcement active for continued looping
        this.startClipEnforcement();
      }, 100);
    } else if (state.clipEnd > 0 && !state.loopEnabled) {
      // Video ended and looping is disabled - just pause
      this.pause();
      this.stopClipEnforcement();
    } else {
      // No clip bounds or other case - stop enforcement
      this.stopClipEnforcement();
    }
  }

  /**
   * Starts clip enforcement
   * @returns {void}
   */
  startClipEnforcement() {
    this.clipCheckInterval = setInterval(() => {
      const state = store.getState();
      const currentTime = this.player.getCurrentTime();

      // Check if we're outside clip bounds
      if (state.clipEnd > 0 && currentTime >= state.clipEnd) {
        if (state.loopEnabled) {
          this.seekTo(state.clipStart);
        } else {
          this.pause();
        }
      } else if (currentTime < state.clipStart) {
        this.seekTo(state.clipStart);
      }
    }, 250); // Check every 250ms
    this.clipCheckInterval.unref?.();
  }

  /**
   * Stops clip enforcement
   * @returns {void}
   */
  stopClipEnforcement() {
    if (this.clipCheckInterval) {
      clearInterval(this.clipCheckInterval);
      this.clipCheckInterval = null;
    }
  }

  /**
   * Clears all intervals
   * @returns {void}
   */
  clearIntervals() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
    this.stopClipEnforcement();
  }

  /**
   * Plays the video
   * @returns {void}
   */
  play() {
    if (this.player && this.player.playVideo) {
      this.player.playVideo();
    }
  }

  /**
   * Pauses the video
   * @returns {void}
   */
  pause() {
    if (this.player && this.player.pauseVideo) {
      this.player.pauseVideo();
    }
  }

  /**
   * Seeks to specific time
   * @param {number} seconds - Time in seconds
   * @returns {void}
   */
  seekTo(seconds) {
    if (this.player && this.player.seekTo) {
      this.player.seekTo(seconds, true);
    }
  }

  /**
   * Updates play/pause button visibility
   * @param {boolean} isPlaying - Whether video is playing
   * @returns {void}
   */
  updatePlayPauseButtons(isPlaying) {
    if (this.playBtn && this.pauseBtn) {
      /** @type {HTMLElement} */ (this.playBtn).style.display = isPlaying ? 'none' : 'inline-flex';
      /** @type {HTMLElement} */ (this.pauseBtn).style.display = isPlaying ? 'inline-flex' : 'none';
    }
  }

  /**
   * Updates time display
   * @param {AppState} state - Current app state
   * @returns {void}
   */
  updateTimeDisplay(state) {
    if (this.currentTimeEl) {
      this.currentTimeEl.textContent = this.formatTime(state.position || 0);
    }
    if (this.durationEl) {
      this.durationEl.textContent = this.formatTime(state.duration || 0);
    }
  }

  /**
   * Formats time in MM:SS format
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Shows overlay
   * @returns {void}
   */
  showOverlay() {
    if (this.overlay) {
      /** @type {HTMLElement} */ (this.overlay).style.display = 'flex';
    }
  }

  /**
   * Hides overlay
   * @returns {void}
   */
  hideOverlay() {
    if (this.overlay) {
      /** @type {HTMLElement} */ (this.overlay).style.display = 'none';
    }
  }

  /**
   * Enables player controls
   * @returns {void}
   */
  enableControls() {
    const controls = this.querySelectorAll('.player-control');
    controls.forEach((control) => {
      /** @type {HTMLButtonElement} */ (control).disabled = false;
    });
  }

  /**
   * Disables player controls
   * @returns {void}
   */
  disableControls() {
    const controls = this.querySelectorAll('.player-control');
    controls.forEach((control) => {
      /** @type {HTMLButtonElement} */ (control).disabled = true;
    });
  }
}

// Define the custom element
customElements.define('cts-player', CtsPlayer);
