/**
 * Polygon Selector UI
 *
 * Handles polygon selection, GeoJSON upload, and polygon section collapse/expand.
 *
 * SECURITY: Does not perform cryptographic operations.
 * Delegates polygon creation and hashing to the polygons module.
 */

import {
  getDemoPolygons,
  parseGeoJSON,
  saveSelectedPolygon,
  createCustomPolygon
} from '../polygons';
import { setCurrentPolygon, getCurrentPolygonState } from './state';

// ============================================================================
// POLYGON SELECTOR UI
// ============================================================================

/**
 * Initialize polygon selector UI with demo polygons
 */
export async function initPolygonSelector(): Promise<void> {
  const selectorDiv = document.getElementById('polygon-selector');
  const infoDiv = document.getElementById('polygon-info');

  if (!selectorDiv || !infoDiv) return;

  const demoPolygons = getDemoPolygons();
  const currentPolygon = getCurrentPolygonState();

  // Create radio buttons for each demo polygon
  demoPolygons.forEach((polygon) => {
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
      setCurrentPolygon(polygon);
      saveSelectedPolygon(polygon);
      await updatePolygonInfo();
    });

    selectorDiv.appendChild(option);
  });

  await updatePolygonInfo();
}

/**
 * Update polygon info display with current polygon details
 */
export async function updatePolygonInfo(): Promise<void> {
  const infoDiv = document.getElementById('polygon-info');
  const currentPolygonDisplay = document.getElementById('current-polygon-display');
  const selectedPolygonName = document.getElementById('selected-polygon-name');

  if (!infoDiv) return;

  const currentPolygon = getCurrentPolygonState();

  // Update displays
  if (currentPolygonDisplay) {
    currentPolygonDisplay.textContent = `Currently: ${currentPolygon.name}`;
  }
  if (selectedPolygonName) {
    selectedPolygonName.textContent = currentPolygon.name;
  }
}

// ============================================================================
// POLYGON SECTION COLLAPSE
// ============================================================================

/**
 * Setup polygon section collapse/expand toggle
 */
export function setupPolygonCollapse(): void {
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
export function autoCollapsePolygonSection(): void {
  const polygonSection = document.querySelector('.polygon-section');
  polygonSection?.setAttribute('data-collapsed', 'true');
}

// ============================================================================
// GEOJSON UPLOAD
// ============================================================================

/**
 * Setup GeoJSON paste/upload handlers
 */
export function setupPolygonUpload(): void {
  const loadBtn = document.getElementById('load-geojson');
  const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;

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
      setCurrentPolygon(customPolygon);
      saveSelectedPolygon(customPolygon);

      await updatePolygonInfo();

      const originalVertices = geoCoords.length;
      const finalVertices = customPolygon.coordinates.length;
      let message = `Custom polygon "${name}" loaded successfully!\nOriginal vertices: ${originalVertices}`;

      if (finalVertices > originalVertices) {
        message += `\nPadded to ${finalVertices} vertices (required by circuit)`;
      }

      alert(message);

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
      setCurrentPolygon(customPolygon);
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
