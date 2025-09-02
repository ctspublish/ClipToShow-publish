/**
 * ClipToShow - Main entry point
 * Imports all web components and initializes the app
 */

import './components/cts-root.js';
import './components/cts-player.js';
import './components/cts-timeline.js';
import './components/cts-start-box.js';
import './components/cts-share-box.js';
import './components/cts-error-banner.js';
import { initPositionSync } from './position.js';
import { initUrlSync } from './url.js';
import { initAutoplayFallback } from './autoplay.js';
import { initErrorHandling } from './errors.js';
import { initPrecision } from './precision.js';
import { initDiagnostics } from './diagnostics.js';

// wire player position sync
initPositionSync();
initUrlSync();
initAutoplayFallback();
initErrorHandling();
initPrecision();
initDiagnostics();
