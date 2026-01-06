import { saveGNSS, listAllSessions, initWebStore, getAllProofs, getProofBySessionId } from './db';
import { generateLocationProof, verifyLocationProof } from './proof';
import {
  DEMO_POLYGONS,
  type Polygon,
  calculatePolygonHash,
  parseGeoJSON,
  validatePolygon,
  saveSelectedPolygon,
  getCurrentPolygon,
  createCustomPolygon
} from './polygons';

// Global state
let currentPolygon: Polygon = getCurrentPolygon();

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
  if (!infoDiv) return;

  const hash = await calculatePolygonHash(currentPolygon.coordinates);

  infoDiv.innerHTML = `
    <div><strong>Selected:</strong> ${currentPolygon.name}</div>
    <div><strong>Polygon Hash:</strong></div>
    <div class="hash">${hash}</div>
  `;
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
      const coordinates = parseGeoJSON(geojson);

      if (!validatePolygon(coordinates)) {
        alert('Invalid polygon: must have at least 3 vertices');
        return;
      }

      const name = prompt('Enter a name for this polygon:', 'Custom Polygon');
      if (!name) return;

      const customPolygon = await createCustomPolygon(name, coordinates);
      currentPolygon = customPolygon;
      saveSelectedPolygon(customPolygon);

      await updatePolygonInfo();
      alert(`Custom polygon "${name}" loaded successfully!\nVertices: ${coordinates.length}`);

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
      const coordinates = parseGeoJSON(geojson);

      if (!validatePolygon(coordinates)) {
        alert('Invalid polygon: must have at least 3 vertices');
        return;
      }

      const name = file.name.replace(/\.(geo)?json$/i, '');
      const customPolygon = await createCustomPolygon(name, coordinates);
      currentPolygon = customPolygon;
      saveSelectedPolygon(customPolygon);

      await updatePolygonInfo();
      alert(`Custom polygon "${name}" loaded successfully!\nVertices: ${coordinates.length}`);

      // Reset file input
      fileInput.value = '';
    } catch (error) {
      console.error('Error loading file:', error);
      alert(`Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

// Expose API functions on window object
(window as any).dumpGNSS = async () => {
  const rows = await listAllSessions();
  console.table(rows);
};

// Get all proofs
(window as any).getAllProofs = async () => {
  const proofs = await getAllProofs();
  console.log('All proofs:', proofs);
  return proofs;
};

// Get proof by session ID
(window as any).getProof = async (sessionId: string) => {
  const proof = await getProofBySessionId(sessionId);
  console.log('Proof:', proof);
  return proof;
};

// Verify a proof
(window as any).verifyProof = async (proof: any, publicSignals: string[]) => {
  const isValid = await verifyLocationProof(proof, publicSignals);
  console.log('Proof valid:', isValid);
  return isValid;
};

// Verify all proofs and show results
(window as any).verifyAllProofs = async () => {
  const proofs = await getAllProofs();
  console.log(`\n🔍 Verifying ${proofs.length} proofs...\n`);

  const results = [];
  for (const proof of proofs) {
    const isValid = await verifyLocationProof(proof.proof, proof.publicSignals);
    results.push({
      session_id: proof.session_id,
      timestamp: new Date(proof.timestamp).toISOString(),
      location: `${proof.lat}, ${proof.lon}`,
      valid: isValid ? '✅' : '❌',
      publicSignals: proof.publicSignals
    });
    console.log(`${isValid ? '✅' : '❌'} ${proof.session_id.substring(0, 8)}... - ${new Date(proof.timestamp).toLocaleString()}`);
  }

  console.log(`\n📊 Results: ${results.filter(r => r.valid === '✅').length}/${results.length} valid`);
  return results;
};

// Verify a proof by session ID
(window as any).verifyProofById = async (sessionId: string) => {
  const proof = await getProofBySessionId(sessionId);
  if (!proof) {
    console.error('❌ Proof not found for session:', sessionId);
    return false;
  }

  console.log('\n🔍 Verifying proof...');
  console.log('Session ID:', proof.session_id);
  console.log('Location:', proof.lat, proof.lon);
  console.log('Accuracy:', proof.accuracy, 'm');
  console.log('Timestamp:', new Date(proof.timestamp).toISOString());

  const isValid = await verifyLocationProof(proof.proof, proof.publicSignals);

  console.log('\n' + (isValid ? '✅ PROOF VALID' : '❌ PROOF INVALID'));
  console.log('Public Signals:', proof.publicSignals);

  return isValid;
};

// Download all proofs as JSON
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

// Download a single proof by session ID
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

/**
 * Setup all button event listeners
 */
function setupButtons() {
  const acquireAndProveBtn = document.getElementById('acquire-and-prove') as HTMLButtonElement | null;
  const output = document.getElementById('location-output');
  const historyBtn = document.getElementById('show-history');

  // History button
  historyBtn?.addEventListener('click', async () => {
    if (!output) return;

    // Wait for initialization to complete
    await initWebStore();

    const rows = await listAllSessions();

    if (!rows.length) {
      output.textContent = 'No stored sessions yet.';
      return;
    }

    // Sort by created_at ascending (oldest first) and format the data
    const sorted = rows.sort((a, b) => a.created_at - b.created_at);
    const formatted = sorted.map((row, index) => ({
      '#': index + 1,
      session_id: row.session_id,
      latitude: row.lat,
      longitude: row.lon,
      accuracy: `${row.accuracy}m`,
      gnss_timestamp: new Date(row.gnss_timestamp).toISOString(),
      created_at: new Date(row.created_at).toISOString()
    }));

    // Reverse to show highest index first
    output.textContent = JSON.stringify(formatted.reverse(), null, 2);
  });

  // Combined: Acquire GNSS location and generate ZK proof automatically
  if (acquireAndProveBtn && output) {
    acquireAndProveBtn.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        output.textContent = 'Geolocation is not supported by your browser.';
        return;
      }

      output.textContent = 'Acquiring GNSS/GPS position... (this may take 30-60s for satellite lock)';

      // Disable button during acquisition
      acquireAndProveBtn.disabled = true;
      acquireAndProveBtn.textContent = 'Acquiring GNSS...';

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;

          // Store GNSS fix
          const gnssFix = {
            lat: latitude,
            lon: longitude,
            accuracy,
            timestamp: position.timestamp
          };

          const locationData = {
            latitude,
            longitude,
            accuracy,
            altitude,
            altitudeAccuracy,
            heading,
            speed,
            timestamp: new Date(position.timestamp).toISOString(),
            source: accuracy < 50 ? 'GNSS/GPS (high accuracy)' : 'Network/Wi-Fi'
          };

          output.textContent = JSON.stringify(
            {
              message: 'GNSS acquired ✓',
              ...locationData,
              nextStep: 'Generating ZK proof...'
            },
            null,
            2
          );

          // Automatically proceed to proof generation
          acquireAndProveBtn.textContent = 'Generating ZK Proof...';

          const sessionId = crypto.randomUUID();

          try {
            output.textContent = `GNSS acquired ✓\n\nGenerating zero-knowledge proof...\nPolygon: ${currentPolygon.name}\nThis may take 10-30 seconds...`;

            // Ensure web store is initialized
            await initWebStore();

            // Generate proof using selected polygon coordinates
            const { proof, publicSignals } = await generateLocationProof(
              gnssFix.lat,
              gnssFix.lon,
              currentPolygon.coordinates
            );

            // Save with proof
            await saveGNSS(sessionId, {
              ...gnssFix,
              proof,
              publicSignals
            });

            const polygonHash = await calculatePolygonHash(currentPolygon.coordinates);

            output.textContent = JSON.stringify(
              {
                message: 'Complete ✓',
                sessionId,
                polygon: currentPolygon.name,
                polygonHash: polygonHash.substring(0, 16) + '...',
                location: {
                  lat: gnssFix.lat,
                  lon: gnssFix.lon,
                  accuracy: `${gnssFix.accuracy}m`
                },
                proofGenerated: true,
                publicSignals,
                note: 'Proof saved locally. Use console: downloadProof(sessionId) or downloadAllProofs()'
              },
              null,
              2
            );

            // Re-enable button for next proof
            acquireAndProveBtn.disabled = false;
            acquireAndProveBtn.textContent = 'Acquire GNSS & Generate ZK Proof';
          } catch (proofError) {
            console.error('Proof generation failed:', proofError);

            output.textContent = JSON.stringify(
              {
                message: 'Proof generation failed ✗',
                polygon: currentPolygon.name,
                error: String(proofError),
                note: 'Check console for details'
              },
              null,
              2
            );

            // Re-enable button to retry
            acquireAndProveBtn.disabled = false;
            acquireAndProveBtn.textContent = 'Acquire GNSS & Generate ZK Proof (Retry)';
          }
        },
        (error) => {
          let errorMsg = `Error getting location: ${error.message}\n\n`;

          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMsg += 'Permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg += 'Position unavailable. For GNSS/GPS:\n- Go outdoors with clear sky view\n- Wait 30-60 seconds for satellite lock\n- Ensure Location Services are enabled in System Settings';
              break;
            case error.TIMEOUT:
              errorMsg += 'Timeout. GNSS may need more time to acquire satellites.\nTrying cached location...';
              break;
          }

          output.textContent = errorMsg;

          // Re-enable button
          acquireAndProveBtn.disabled = false;
          acquireAndProveBtn.textContent = 'Acquire GNSS & Generate ZK Proof';
        },
        {
          enableHighAccuracy: true,  // Force GNSS/GPS instead of network positioning
          timeout: 60000,            // 60 seconds for satellite acquisition
          maximumAge: 0              // Don't use cached position from browser
        }
      );
    });
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// Initialize SQLite web store and set up event listeners after it's ready
(async () => {
  await initWebStore();
  console.log('SQLite initialized');
  initPolygonSelector();
  setupPolygonUpload();
  setupButtons();
})();

