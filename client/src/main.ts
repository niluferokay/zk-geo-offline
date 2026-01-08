import { saveGNSS, listAllSessions, initWebStore, getAllProofs, getProofBySessionId, clearAllSessions } from './db';
import { generateLocationProof} from './proof';
import {
  DEMO_POLYGONS,
  type Polygon,
  calculatePolygonHash,
  parseGeoJSON,
  saveSelectedPolygon,
  getCurrentPolygon,
  createCustomPolygon,
  prepareCircuitInput
} from './polygons';

// Proof generation states
const ProofState = {
  IDLE: 'idle',
  ACQUIRING: 'acquiring',
  GENERATING: 'generating',
  SUCCESS: 'success',
  FAILURE: 'failure'
} as const;

type ProofState = typeof ProofState[keyof typeof ProofState];

// Global state
let currentPolygon: Polygon = getCurrentPolygon();
let currentState: ProofState = ProofState.IDLE;
let timerInterval: number | null = null;
let startTime: number = 0;

/**
 * Developer mode management
 */
function initDeveloperMode() {
  // Always enable dev mode
  document.body.setAttribute('data-dev-mode', 'true');
}

/**
 * Update screen reader announcements
 */
function announceToScreenReader(message: string) {
  const announcer = document.getElementById('sr-announcements');
  if (announcer) {
    announcer.textContent = message;
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

/**
 * Timer display
 */
function startTimer() {
  startTime = Date.now();
  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) {
    timerDisplay.style.display = 'block';
  }

  timerInterval = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')} elapsed`;

    if (timerDisplay) {
      timerDisplay.textContent = timeStr;
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) {
    timerDisplay.style.display = 'none';
  }
}

/**
 * Set proof button state
 */
function setProofButtonState(state: ProofState, customLabel?: string, customSublabel?: string) {
  const button = document.getElementById('generate-proof-btn') as HTMLButtonElement;
  if (!button) return;

  currentState = state;

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

/**
 * Initialize polygon selector UI with demo polygons
 */
async function initPolygonSelector() {
  const selectorDiv = document.getElementById('polygon-selector');
  const infoDiv = document.getElementById('polygon-info');

  if (!selectorDiv || !infoDiv) return;

  // Create radio buttons for each demo polygon
  DEMO_POLYGONS.forEach((polygon) => {
    const option = document.createElement('div');
    option.className = 'polygon-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'polygon';
    radio.value = polygon.id;
    radio.id = `polygon-${polygon.id}`;
    radio.checked = currentPolygon.id === polygon.id;

    const label = document.createElement('label');
    label.htmlFor = `polygon-${polygon.id}`;
    label.className = 'polygon-label';
    label.style.cursor = 'pointer';

    const nameSpan = document.createElement('div');
    nameSpan.className = 'polygon-name';
    nameSpan.textContent = polygon.name;

    const descSpan = document.createElement('div');
    descSpan.className = 'polygon-description';
    descSpan.textContent = polygon.description;

    label.appendChild(nameSpan);
    label.appendChild(descSpan);

    option.appendChild(radio);
    option.appendChild(label);

    if (radio.checked) {
      option.classList.add('selected');
    }

    // Handle selection
    option.addEventListener('click', async () => {
      radio.checked = true;
      document.querySelectorAll('.polygon-option').forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      currentPolygon = polygon;
      saveSelectedPolygon(polygon);
      await updatePolygonInfo();
    });

    selectorDiv.appendChild(option);
  });

  // Update initial polygon info
  await updatePolygonInfo();
}

/**
 * Update polygon info display with current polygon details and hash
 */
async function updatePolygonInfo() {
  const infoDiv = document.getElementById('polygon-info');
  const currentPolygonDisplay = document.getElementById('current-polygon-display');
  const selectedPolygonName = document.getElementById('selected-polygon-name');

  if (!infoDiv) return;

  // Update displays
  if (currentPolygonDisplay) {
    currentPolygonDisplay.textContent = `Currently: ${currentPolygon.name}`;
  }
  if (selectedPolygonName) {
    selectedPolygonName.textContent = currentPolygon.name;
  }
}

/**
 * Collapse/expand polygon section
 */
function setupPolygonCollapse() {
  const collapseBtn = document.getElementById('polygon-collapse-btn');
  const polygonSection = document.querySelector('.polygon-section');

  collapseBtn?.addEventListener('click', () => {
    const isCollapsed = polygonSection?.getAttribute('data-collapsed') === 'true';
    polygonSection?.setAttribute('data-collapsed', isCollapsed ? 'false' : 'true');
  });
}

/**
 * Auto-collapse polygon section after successful proof generation
 */
function autoCollapsePolygonSection() {
  const polygonSection = document.querySelector('.polygon-section');
  polygonSection?.setAttribute('data-collapsed', 'true');
}

/**
 * Handle GeoJSON paste/upload
 */
function setupPolygonUpload() {
  const loadBtn = document.getElementById('load-geojson');
  const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;

  // Handle paste/load button
  loadBtn?.addEventListener('click', async () => {
    const geojsonText = geojsonInput?.value.trim();
    if (!geojsonText) {
      alert('Please paste GeoJSON data first');
      return;
    }

    try {
      const geojson = JSON.parse(geojsonText);
      const geoCoords = parseGeoJSON(geojson);

      if (geoCoords.length < 3) {
        alert('Invalid polygon: must have at least 3 vertices');
        return;
      }

      const name = prompt('Enter a name for this polygon:', 'Custom Polygon');
      if (!name) return;

      const customPolygon = await createCustomPolygon(name, geoCoords);
      currentPolygon = customPolygon;
      saveSelectedPolygon(customPolygon);

      await updatePolygonInfo();

      const originalVertices = geoCoords.length;
      const finalVertices = customPolygon.coordinates.length;
      let message = `Custom polygon "${name}" loaded successfully!\nOriginal vertices: ${originalVertices}`;

      if (finalVertices > originalVertices) {
        message += `\nPadded to ${finalVertices} vertices (required by circuit)`;
      }

      alert(message);

      // Clear input
      geojsonInput.value = '';
    } catch (error) {
      console.error('Error parsing GeoJSON:', error);
      alert(`Error parsing GeoJSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Handle file upload
  fileInput?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const geojson = JSON.parse(text);
      const geoCoords = parseGeoJSON(geojson);

      if (geoCoords.length < 3) {
        alert('Invalid polygon: must have at least 3 vertices');
        return;
      }

      const name = file.name.replace(/\.(geo)?json$/i, '');
      const customPolygon = await createCustomPolygon(name, geoCoords);
      currentPolygon = customPolygon;
      saveSelectedPolygon(customPolygon);

      await updatePolygonInfo();

      const originalVertices = geoCoords.length;
      const finalVertices = customPolygon.coordinates.length;
      let message = `Custom polygon "${name}" loaded successfully!\nOriginal vertices: ${originalVertices}`;

      if (finalVertices > originalVertices) {
        message += `\nPadded to ${finalVertices} vertices (required by circuit)`;
      }

      alert(message);

      // Reset file input
      fileInput.value = '';
    } catch (error) {
      console.error('Error loading file:', error);
      alert(`Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Display success result card
 */
function showSuccessResult(sessionId: string, gnssFix: any, proof: any, publicSignals: string[], polygonHash: string) {
  const resultSection = document.getElementById('result-section');
  const resultCard = document.getElementById('result-card');
  const errorSection = document.getElementById('error-section');

  if (!resultSection || !resultCard) return;

  // Hide error section
  if (errorSection) errorSection.style.display = 'none';

  const isInside = publicSignals[0] === '1';

  // Build result card HTML
  let html = `
    <div class="result-header">
      <span class="result-title">Proof Generated Locally</span>
    </div>

    <div class="result-section-title">Project Forest:${currentPolygon.name}</div>
    <div class="result-item">
      <span class="label">Status:</span>
      <span class="value" style="font-weight: 600; color: ${isInside ? '#22c55e' : '#ef4444'}">${isInside ? 'Inside project boundary' : 'Outside project boundary'}</span>
    </div>
    <div class="result-item">
      <span class="label">This is a local UI check for demonstration only.
The project verifies the proof independently.
Status: Ready to submit
    </div>
    <div class="result-item">
      <span class="label">Accuracy:</span>
      <span class="value">${gnssFix.accuracy.toFixed(1)}m </span>
    </div>
  `;

  html += `
    <div class="result-section-title">Cryptographic Proof</div>
    <div class="result-item">
      <span class="label">Proof size:</span>
      <span class="value">${(JSON.stringify(proof).length / 1024).toFixed(2)} KB</span>
    </div>
    <div class="result-item">
      <span class="label">Public signals:</span>
      <span class="value">${publicSignals.length} value${publicSignals.length > 1 ? 's' : ''}</span>
    </div>
    <div class="result-item">
      <span class="label">Boundary hash:</span>
      <span class="value" style="font-family: monospace; font-size: 11px; word-break: break-all;">${polygonHash.substring(0, 16)}...${polygonHash.substring(polygonHash.length - 8)}</span>
    </div>
  `;

  html += `
    <div class="result-actions">
      <button class="action-btn primary" onclick="window.downloadProof('${sessionId}')">Download Proof</button>    </div>
  `;

  html += `
    <details style="margin-top: 16px;">
      <summary style="cursor: pointer; opacity: 0.7; font-size: 13px;">Show technical details</summary>
      <div style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.05); border-radius: 4px;">
        <div style="font-size: 12px; margin-bottom: 8px;"><strong>Proof Session ID:</strong><br><code style="word-break: break-all;">${sessionId}</code></div>
        <div style="font-size: 12px; margin-bottom: 8px;"><strong>Full Boundary Hash:</strong><br><code style="word-break: break-all;">${polygonHash}</code></div>
        <div style="font-size: 12px;"><strong>Raw Proof:</strong></div>
        <pre style="font-size: 10px; overflow-x: auto; max-height: 200px;">${JSON.stringify({ proof, publicSignals }, null, 2)}</pre>
      </div>
    </details>
  `;

  resultCard.className = 'result-card success';
  resultCard.innerHTML = html;
  resultSection.style.display = 'block';

  // Scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Display error card
 */
function showError(type: string, title: string, message: string, recommendations: string[] = [], actions: { label: string, callback: () => void }[] = []) {
  const errorSection = document.getElementById('error-section');
  const errorCard = document.getElementById('error-card');
  const resultSection = document.getElementById('result-section');

  if (!errorSection || !errorCard) return;

  // Hide result section
  if (resultSection) resultSection.style.display = 'none';

  let iconMap: Record<string, string> = {
    'permission': '⚠️',
    'accuracy': '⏱️',
    'outside': '❌',
    'timeout': '⏱️',
    'generation': '❌'
  };

  let html = `
    <div class="error-header">
      <span class="error-icon">${iconMap[type] || '⚠️'}</span>
      <span class="error-title">${title}</span>
    </div>
    <div class="error-message">${message}</div>
  `;

  if (recommendations.length > 0) {
    html += `
      <div class="error-recommendations">
        <h3>Recommendations:</h3>
        <ul>
          ${recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (actions.length > 0) {
    html += `<div class="error-actions">`;
    actions.forEach((action, index) => {
      const id = `error-action-${index}`;
      html += `<button class="error-btn ${index === 0 ? 'primary' : ''}" id="${id}">${action.label}</button>`;
    });
    html += `</div>`;
  }

  errorCard.innerHTML = html;
  errorSection.style.display = 'block';

  // Attach event listeners
  actions.forEach((action, index) => {
    const btn = document.getElementById(`error-action-${index}`);
    btn?.addEventListener('click', action.callback);
  });

  // Scroll to error
  errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Setup main proof generation button
 */
function setupProofGeneration() {
  const generateBtn = document.getElementById('generate-proof-btn') as HTMLButtonElement;

  if (!generateBtn) return;

  generateBtn.addEventListener('click', async () => {
    if (currentState !== ProofState.IDLE && currentState !== ProofState.SUCCESS && currentState !== ProofState.FAILURE) {
      return; // Already in progress
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

        switch(error.code) {
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

  async function proceedWithProof(position: GeolocationPosition) {
    const { latitude, longitude, accuracy } = position.coords;

    const gnssFix = {
      lat: latitude,
      lon: longitude,
      accuracy,
      timestamp: position.timestamp
    };

    // Set to generating state
    setProofButtonState(ProofState.GENERATING);

    const sessionId = crypto.randomUUID();

    try {
      // Ensure web store is initialized
      await initWebStore();

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

      // Save with proof
      await saveGNSS(sessionId, {
        ...gnssFix,
        proof,
        publicSignals
      });

      const polygonHash = await calculatePolygonHash(currentPolygon.coordinates);

      // Set success state
      setProofButtonState(ProofState.SUCCESS);

      // Show success result
      showSuccessResult(sessionId, gnssFix, proof, publicSignals, polygonHash);

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

/**
 * Update history count badge
 */
async function updateHistoryCount() {
  const proofs = await getAllProofs();
  const countBadge = document.getElementById('history-count');
  if (countBadge) {
    countBadge.textContent = `(${proofs.length})`;
  }
}

/**
 * Update history list if panel is open
 */
async function updateHistoryList() {
  const historyPanel = document.getElementById('history-panel');
  if (historyPanel && historyPanel.style.display !== 'none') {
    await renderHistoryList();
  }
}

/**
 * Setup history panel
 */
function setupHistoryPanel() {
  const historyBtn = document.getElementById('proof-history-btn');
  const historyPanel = document.getElementById('history-panel');
  const clearHistoryBtn = document.getElementById('clear-history');

  historyBtn?.addEventListener('click', async () => {
    if (!historyPanel) return;

    // Toggle panel
    if (historyPanel.style.display === 'none') {
      await renderHistoryList();
      historyPanel.style.display = 'block';
    } else {
      historyPanel.style.display = 'none';
    }
  });

  clearHistoryBtn?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all proof history? This cannot be undone.')) {
      try {
        // Clear IndexedDB using the proper db function
        await clearAllSessions();
        await renderHistoryList();
        await updateHistoryCount();
      } catch (error) {
        console.error('Error clearing history:', error);
        alert('Failed to clear history. Check console for details.');
      }
    }
  });
}

/**
 * Render history list
 */
async function renderHistoryList() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  const proofs = await getAllProofs();

  if (proofs.length === 0) {
    historyList.innerHTML = `
      <div class="empty-history">
        <div class="empty-icon">📭</div>
        <p>No proofs generated yet.</p>
      </div>
    `;
    return;
  }

  // Sort by timestamp descending (newest first)
  const sorted = proofs.sort((a, b) => b.timestamp - a.timestamp);

  historyList.innerHTML = sorted.map(proof => {
    const timestamp = new Date(proof.timestamp);

    return `
      <div class="history-card success">
        <div class="history-header-row">
          <span class="history-status">✅</span>
          <span class="history-polygon-name">Location Proof</span>
        </div>
        <div class="history-meta">
          <span>${timestamp.toLocaleDateString()}</span>
          <span>·</span>
          <span>${timestamp.toLocaleTimeString()}</span>
          </div>
        <div><strong>Project:</strong> <code>${proof.session_id}</code></div>
        <div><strong>Session ID:</strong> <code>${proof.session_id}</code></div>
        <div><strong>Status:</strong> <code>${proof.session_id}</code></div>
        <div class="history-actions">
          <button class="history-btn" onclick="window.downloadProof('${proof.session_id}')">Download</button>
        </div>
      </div>
    `;
  }).join('');
}

// Expose API functions on window object
(window as any).downloadProof = async (sessionId: string) => {
  const proof = await getProofBySessionId(sessionId);
  if (!proof) {
    console.error('Proof not found');
    return;
  }
  const dataStr = JSON.stringify(proof, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `proof-${sessionId}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.log('Downloaded proof for session:', sessionId);
};

(window as any).downloadAllProofs = async () => {
  const proofs = await getAllProofs();
  const dataStr = JSON.stringify(proofs, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `proofs-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.log(`Downloaded ${proofs.length} proofs`);
};

(window as any).getAllProofs = async () => {
  const proofs = await getAllProofs();
  console.log('All proofs:', proofs);
  return proofs;
};

(window as any).getProof = async (sessionId: string) => {
  const proof = await getProofBySessionId(sessionId);
  console.log('Proof:', proof);
  return proof;
};

(window as any).dumpGNSS = async () => {
  const rows = await listAllSessions();
  console.table(rows);
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// Initialize app
(async () => {
  await initWebStore();
  console.log('SQLite initialized');

  initDeveloperMode();
  initPolygonSelector();
  setupPolygonCollapse();
  setupPolygonUpload();
  setupProofGeneration();
  setupHistoryPanel();
  updateHistoryCount();
})();
