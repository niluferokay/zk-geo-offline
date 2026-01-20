/**
 * UI Main Orchestrator
 *
 * Wires together all UI modules and handles proof generation orchestration.
 * This file contains NO UI rendering logic - only event handling and module coordination.
 *
 * SECURITY: Cryptographic operations are delegated to proof.ts and polygons.ts.
 * This module does not make authorization decisions or validate proofs.
 */

import { Capacitor } from '@capacitor/core';
import { saveGNSS, initWebStore, listAllSessions } from '../db';
import { generateLocationProof } from '../proof';
import {
  recomputeBoundaryHash,
  initializeDemoPolygons,
  getCurrentPolygon,
  prepareCircuitInput,
  migrateLegacyPolygonStorage
} from '../polygons';

// UI State Management
import {
  ProofState,
  setCurrentPolygon,
  getCurrentPolygonState,
  getCurrentState,
  setCurrentState,
  startTimer,
  stopTimer,
  announceToScreenReader
} from './state';

// Error Display
import { showError } from './errors';

// Polygon Selector
import {
  initPolygonSelector,
  setupPolygonCollapse,
  setupPolygonUpload,
  autoCollapsePolygonSection
} from './polygon-selector';

// History Panel
import {
  setupHistoryPanel,
  updateHistoryCount,
  updateHistoryList,
  exposeHistoryAPI
} from './history';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * SECURITY: Sanitize user-provided strings for display
 */
function safeLabel(s: string): string {
  return s.replace(/[^\w.\- ]+/g, '_').slice(0, 80);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// DEVELOPER MODE
// ============================================================================

/**
 * Initialize developer mode
 */
function initDeveloperMode(): void {
  document.body.setAttribute('data-dev-mode', 'true');
}

// ============================================================================
// PROOF BUTTON STATE
// ============================================================================

/**
 * Set proof button visual state
 */
function setProofButtonState(state: ProofState, customLabel?: string, customSublabel?: string): void {
  const button = document.getElementById('generate-proof-btn') as HTMLButtonElement;
  if (!button) return;

  setCurrentState(state);

  // Remove all state classes
  button.classList.remove('state-idle', 'state-acquiring', 'state-generating', 'state-success', 'state-failure');
  button.classList.add(`state-${state}`);

  const icon = button.querySelector('.icon') as HTMLElement;
  const label = button.querySelector('.label') as HTMLElement;
  const sublabel = button.querySelector('.sublabel') as HTMLElement;

  // Update button content based on state
  switch (state) {
    case ProofState.IDLE:
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      if (icon) icon.textContent = '📍';
      if (label) label.textContent = 'Generate Proof';
      if (sublabel) sublabel.textContent = 'Requires location access';
      stopTimer();
      break;

    case ProofState.ACQUIRING:
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (icon) icon.textContent = '🛰️';
      if (label) label.textContent = customLabel || 'Acquiring Satellite Signal...';
      if (sublabel) sublabel.textContent = customSublabel || '30-60 seconds · Requires outdoor view';
      announceToScreenReader('Acquiring GPS satellite signal');
      startTimer();
      break;

    case ProofState.GENERATING:
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (icon) icon.textContent = '🔐';
      if (label) label.textContent = customLabel || 'Computing Zero-Knowledge Proof...';
      if (sublabel) sublabel.textContent = customSublabel || '10-30 seconds remaining';
      announceToScreenReader('Generating cryptographic proof');
      break;

    case ProofState.SUCCESS:
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      if (icon) icon.textContent = '✓';
      if (label) label.textContent = customLabel || 'Proof Generated';
      if (sublabel) sublabel.textContent = customSublabel || 'Generate another proof';
      announceToScreenReader('Proof generated successfully');
      stopTimer();
      break;

    case ProofState.FAILURE:
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      if (icon) icon.textContent = '⚠️';
      if (label) label.textContent = customLabel || 'Retry Proof Generation';
      if (sublabel) sublabel.textContent = customSublabel || 'Click to try again';
      announceToScreenReader('Proof generation failed');
      stopTimer();
      break;
  }
}

// ============================================================================
// SUCCESS RESULT DISPLAY
// ============================================================================

/**
 * Display success result card
 */
function showSuccessResult(
  sessionId: string,
  gnssFix: any,
  proof: any,
  publicSignals: string[],
  polygonHash: string,
  provingTimeSeconds?: number
): void {
  const resultSection = document.getElementById('result-section');
  const resultCard = document.getElementById('result-card');
  const errorSection = document.getElementById('error-section');

  if (!resultSection || !resultCard) return;

  if (errorSection) errorSection.style.display = 'none';

  const isInside = publicSignals[0] === '1';
  const currentPolygon = getCurrentPolygonState();
  const safePolygonName = escapeHtml(safeLabel(currentPolygon.name));

  // Build result card HTML
  let html = `
    <div class="result-header">
      <div class="result-title">Proof Generated Successfully</div>
      <div class="result-subtitle">${safePolygonName}</div>
    </div>

    <div class="result-status-badge ${isInside ? 'status-inside' : 'status-outside'}">
      <span class="status-icon">${isInside ? '✓' : '✗'}</span>
      <span>${isInside ? 'Inside project boundary' : 'Outside project boundary'}</span>
      <span class="status-accuracy">±${gnssFix.accuracy.toFixed(1)}m</span>
    </div>

    <div class="result-disclaimer">
      ℹ️ This is a local UI check for demonstration. The project verifies the proof independently.
    </div>

    <div class="result-details-list">
      <div class="detail-row">
        <span class="detail-label">Session ID:</span>
        <span class="detail-value"><code>${sessionId.substring(0, 16)}...</code></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Boundary Hash:</span>
        <span class="detail-value"><code>${polygonHash.substring(0, 16)}...</code></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Proof Size:</span>
        <span class="detail-value">${(JSON.stringify(proof).length / 1024).toFixed(2)} KB</span>
      </div>
      ${provingTimeSeconds !== undefined ? `
      <div class="detail-row">
        <span class="detail-label">Proving Time:</span>
        <span class="detail-value">${provingTimeSeconds}s</span>
      </div>
      ` : ''}
    </div>

    <div class="result-actions">
      <button class="action-btn primary" data-session-id="${sessionId}">
        <span>📥</span> Download Proof
      </button>
    </div>

    <details class="technical-details">
      <summary>
        <span class="summary-icon">▶</span>
        Show Raw Proof Data
      </summary>
      <pre class="code-block">${escapeHtml(JSON.stringify({ proof, publicSignals }, null, 2))}</pre>
    </details>
  `;

  resultCard.className = 'result-card success';
  resultCard.innerHTML = html;

  const downloadBtn = resultCard.querySelector('.action-btn.primary') as HTMLButtonElement;
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      (window as any).downloadProof(sessionId);
    });
  }

  resultSection.style.display = 'block';
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================================
// PROOF GENERATION ORCHESTRATION
// ============================================================================

/**
 * Setup main proof generation button and orchestrate proof generation flow
 */
function setupProofGeneration(): void {
  const generateBtn = document.getElementById('generate-proof-btn') as HTMLButtonElement;

  if (!generateBtn) return;

  generateBtn.addEventListener('click', async () => {
    const currentState = getCurrentState();
    if (currentState !== ProofState.IDLE && currentState !== ProofState.SUCCESS && currentState !== ProofState.FAILURE) {
      return;
    }

    if (!('geolocation' in navigator)) {
      showError(
        'permission',
        'GEOLOCATION NOT SUPPORTED',
        'Your browser does not support geolocation.',
        ['Use a modern browser like Chrome, Firefox, or Safari'],
        [{ label: 'Dismiss', callback: () => setProofButtonState(ProofState.IDLE) }]
      );
      return;
    }

    // Set to acquiring state
    setProofButtonState(ProofState.ACQUIRING);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { accuracy } = position.coords;

        // Check accuracy
        if (accuracy > 100) {
          setProofButtonState(ProofState.FAILURE);
          showError(
            'accuracy',
            'ACCURACY TOO LOW',
            `Current accuracy: ${accuracy.toFixed(1)} meters\nRequired: < 100 meters`,
            [
              'Move outdoors with clear sky view',
              'Wait 30-60 seconds for satellite lock',
              'Ensure Location Services are enabled'
            ],
            [
              { label: 'Try Again', callback: () => { setProofButtonState(ProofState.IDLE); generateBtn.click(); } },
              { label: 'Continue Anyway', callback: () => proceedWithProof(position) }
            ]
          );
          return;
        }

        await proceedWithProof(position);
      },
      (error) => {
        setProofButtonState(ProofState.FAILURE);

        let title = 'LOCATION ERROR';
        let message = `Error getting location: ${error.message}`;
        let recommendations: string[] = [];

        switch (error.code) {
          case error.PERMISSION_DENIED:
            title = 'LOCATION ACCESS REQUIRED';
            message = 'This app needs your location to generate privacy-preserving proofs.\n\nYour exact coordinates are never stored or shared—only a cryptographic proof.';
            recommendations = [
              'Enable location access in your browser settings',
              'Click the location icon in the address bar'
            ];
            break;
          case error.POSITION_UNAVAILABLE:
            title = 'POSITION UNAVAILABLE';
            message = 'Could not determine your location.';
            recommendations = [
              'Go outdoors with clear sky view',
              'Wait 30-60 seconds for satellite lock',
              'Ensure Location Services are enabled in System Settings'
            ];
            break;
          case error.TIMEOUT:
            title = 'SATELLITE SIGNAL TIMEOUT';
            message = 'Could not acquire GPS signal after 60 seconds.';
            recommendations = [
              'Move to an open outdoor area',
              'Buildings may be blocking satellite view',
              'Check System Settings > Privacy > Location Services'
            ];
            break;
        }

        showError(
          error.code === error.PERMISSION_DENIED ? 'permission' : 'timeout',
          title,
          message,
          recommendations,
          [
            { label: 'Try Again', callback: () => { setProofButtonState(ProofState.IDLE); generateBtn.click(); } }
          ]
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 60000,
        maximumAge: 0
      }
    );
  });

  async function proceedWithProof(position: GeolocationPosition): Promise<void> {
    const { latitude, longitude, accuracy } = position.coords;

    const gnssFix = {
      lat: latitude,
      lon: longitude,
      accuracy,
      timestamp: position.timestamp
    };

    // Set to generating state
    setProofButtonState(ProofState.GENERATING);

    const sessionId = generateUUID();
    const proofStartTime = Date.now();

    try {
      // Ensure web store is initialized
      await initWebStore();

      const currentPolygon = getCurrentPolygonState();

      // Prepare circuit input using the new coordinate conversion system
      const circuitInput = prepareCircuitInput(
        gnssFix.lat,
        gnssFix.lon,
        currentPolygon
      );

      // Generate proof using circuit grid coordinates
      const { proof, publicSignals } = await generateLocationProof(
        circuitInput.point,
        circuitInput.polygon
      );

      const proofEndTime = Date.now();
      const provingTimeSeconds = Math.floor((proofEndTime - proofStartTime) / 1000);

      // Calculate deterministic boundary hash
      // SECURITY: Uses recomputeBoundaryHash to ensure cryptographic stability
      let polygonHash: string;
      try {
        polygonHash = await recomputeBoundaryHash(currentPolygon);
      } catch (error) {
        console.error('Failed to compute polygon hash:', error);
        throw new Error('Selected polygon is missing metadata. Please select a different polygon or re-upload your custom polygon.');
      }

      // Save with proof, polygon name and hash
      await saveGNSS(sessionId, {
        ...gnssFix,
        proof,
        publicSignals,
        polygonName: currentPolygon.name,
        polygonHash
      });

      // Set success state
      setProofButtonState(ProofState.SUCCESS);

      // Show success result
      showSuccessResult(sessionId, gnssFix, proof, publicSignals, polygonHash, provingTimeSeconds);

      // Auto-collapse polygon section
      autoCollapsePolygonSection();

      // Update history count and list
      await updateHistoryCount();
      await updateHistoryList();

    } catch (proofError) {
      console.error('Proof generation failed:', proofError);

      setProofButtonState(ProofState.FAILURE);

      let errorDetails = '';
      let recommendations = [
        'Ensure circuit files are loaded correctly',
        'Check browser console for details'
      ];

      // Check if it's a memory allocation error
      if (proofError instanceof Error &&
        (proofError.message.includes('could not allocate memory') ||
          proofError.message.includes('Memory'))) {
        recommendations = [
          'Try using Chrome or Edge (better WebAssembly support)',
          'Restart your browser and try again',
          'Close other tabs to free up memory',
          'Check that Cross-Origin-Isolation headers are enabled',
          'Consider simplifying the circuit or using a server for proof generation'
        ];
        errorDetails = `\n\nThe browser ran out of memory trying to generate the ZK proof. This circuit requires approximately 2GB of WebAssembly memory.`;
      } else {
        errorDetails = `\n\nTechnical details:\n${String(proofError)}`;
      }

      showError(
        'generation',
        'PROOF GENERATION FAILED',
        `The zero-knowledge proof could not be generated.${errorDetails}`,
        recommendations,
        [
          { label: 'Retry', callback: () => { setProofButtonState(ProofState.IDLE); generateBtn.click(); } }
        ]
      );
    }
  }
}

// ============================================================================
// HOME LINK
// ============================================================================

/**
 * Setup home link on title
 */
function setupHomeLink(): void {
  const appTitle = document.getElementById('app-title');
  if (appTitle) {
    appTitle.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

// ============================================================================
// DEVELOPER CONSOLE API
// ============================================================================

/**
 * Expose debugging functions for developer console
 */
function exposeDevAPI(): void {
  (window as any).dumpGNSS = async () => {
    const rows = await listAllSessions();
    console.table(rows);
  };
}

// ============================================================================
// SERVICE WORKER
// ============================================================================

/**
 * Register service worker for offline support (web only)
 *
 * IMPORTANT: Service workers are skipped on native platforms (iOS/Android).
 * Capacitor apps have assets bundled in the native app package and served
 * directly by WKWebView - they don't need service workers for offline mode.
 * Service workers can actually cause issues on iOS WKWebView.
 */
function registerServiceWorker(): void {
  // Skip on native platforms - assets are already bundled in the app
  if (Capacitor.isNativePlatform()) {
    return;
  }

  // Only register service worker for web browser PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
}

// ============================================================================
// APP INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
(async () => {
  await initWebStore();

  // Migrate legacy polygon storage for privacy
  migrateLegacyPolygonStorage();

  // SECURITY: Initialize demo polygons with deterministic hashes
  await initializeDemoPolygons();

  // Now that demo polygons are initialized, set the current polygon
  const currentPolygon = getCurrentPolygon();
  setCurrentPolygon(currentPolygon);

  initDeveloperMode();

  await initPolygonSelector();

  setupPolygonCollapse();
  setupPolygonUpload();
  setupProofGeneration();
  setupHistoryPanel();
  setupHomeLink();
  updateHistoryCount();

  // Expose APIs
  exposeHistoryAPI();
  exposeDevAPI();

  // Register service worker
  registerServiceWorker();
})();
