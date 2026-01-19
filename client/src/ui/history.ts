/**
 * Proof History Panel
 *
 * Manages the proof history UI, including rendering history list,
 * download actions, and delete actions.
 *
 * SECURITY: Read-only IndexedDB access. Does not modify cryptographic data.
 */

import {
  getAllProofs,
  getProofBySessionId,
  clearAllSessions,
  deleteSession
} from '../db';
import { recomputeBoundaryHash } from '../polygons';
import { getCurrentPolygonState } from './state';

// ============================================================================
// HTML SANITIZATION
// ============================================================================

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
// HISTORY COUNT
// ============================================================================

/**
 * Update history count badge
 */
export async function updateHistoryCount(): Promise<void> {
  const proofs = await getAllProofs();
  const countBadge = document.getElementById('history-count');
  if (countBadge) {
    countBadge.textContent = `(${proofs.length})`;
  }
}

/**
 * Update history list if panel is open
 */
export async function updateHistoryList(): Promise<void> {
  const historyPanel = document.getElementById('history-panel');
  if (historyPanel && historyPanel.style.display !== 'none') {
    await renderHistoryList();
  }
}

// ============================================================================
// HISTORY PANEL SETUP
// ============================================================================

/**
 * Setup history panel toggle and clear button
 */
export function setupHistoryPanel(): void {
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

// ============================================================================
// HISTORY LIST RENDERING
// ============================================================================

/**
 * Render history list
 * SECURITY: Uses DOM methods and escapeHtml to prevent XSS attacks via polygon names
 */
export async function renderHistoryList(): Promise<void> {
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

  // SECURITY: Escape all user-provided data to prevent XSS
  historyList.innerHTML = sorted.map(proof => {
    const timestamp = new Date(proof.timestamp);
    const dateStr = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });

    // SECURITY: Sanitize and escape polygon name to prevent XSS
    const polygonName = escapeHtml(safeLabel(proof.polygonName || 'Unknown Location'));

    const shortSessionId = escapeHtml(proof.session_id.substring(0, 8));
    const shortHash = proof.polygonHash ?
      `${escapeHtml(proof.polygonHash.substring(0, 8))}…${escapeHtml(proof.polygonHash.substring(proof.polygonHash.length - 6))}` :
      'N/A';

    // Calculate proof size
    const proofSize = proof.proof ? (JSON.stringify(proof.proof).length / 1024).toFixed(2) : '0';

    return `
      <div class="history-card success">
        <div class="history-header">
          <div class="history-header-left">
            <span class="history-date">${dateStr}, ${timeStr}</span>
            <span class="history-separator">  </span>
            <span class="history-polygon-name">${polygonName}</span>
          </div>
          <button class="history-btn-delete-small" data-session-id="${escapeHtml(proof.session_id)}" title="Delete proof">Delete</button>
        </div>
        <div class="history-info">
          <div><strong>Session ID:</strong> <code>${shortSessionId}…</code></div>
          <div><strong>Boundary hash:</strong> <code>${shortHash}</code></div>
        </div>
        <div class="history-info-row">
          <div><strong>Proof size:</strong> ${proofSize} KB</div>
        </div>
        <div class="history-actions">
          <button class="history-btn-download" data-session-id="${escapeHtml(proof.session_id)}">Download</button>
        </div>
      </div>
    `;
  }).join('');

  // SECURITY: Attach event listeners using DOM instead of inline onclick
  historyList.querySelectorAll('.history-btn-delete-small').forEach(btn => {
    const sessionId = btn.getAttribute('data-session-id');
    if (sessionId) {
      btn.addEventListener('click', () => {
        deleteProof(sessionId);
      });
    }
  });

  historyList.querySelectorAll('.history-btn-download').forEach(btn => {
    const sessionId = btn.getAttribute('data-session-id');
    if (sessionId) {
      btn.addEventListener('click', () => {
        downloadProof(sessionId);
      });
    }
  });
}

// ============================================================================
// PROOF DOWNLOAD
// ============================================================================

/**
 * Format proof data to the project presence proof standard format
 */
async function formatProofForDownload(proof: any, polygonName: string, polygonHash: string) {
  const isInside = proof.publicSignals && proof.publicSignals[0] === '1';
  const timestamp = new Date(proof.timestamp);

  // Convert proof values to hex strings
  const formatProofComponent = (component: any): string | string[] | string[][] => {
    if (Array.isArray(component)) {
      if (Array.isArray(component[0])) {
        // pi_b is 2D array
        return component.map((arr: any[]) => arr.map((val: any) => '0x' + BigInt(val).toString(16)));
      }
      // pi_a and pi_c are 1D arrays
      return component.slice(0, 2).map((val: any) => '0x' + BigInt(val).toString(16));
    }
    return '0x' + BigInt(component).toString(16);
  };

  return {
    version: '1.0',
    proof_type: 'presence_proof',
    generated_at: timestamp.toISOString(),

    project: {
      boundary_name: polygonName,
      boundary_hash: polygonHash
    },

    claim: {
      inside_boundary: isInside,
      timestamp: timestamp.toISOString()
    },

    zk: {
      system: 'groth16',
      curve: 'bn254',
      circuit_version: 'presence_v1',

      proof: {
        pi_a: formatProofComponent(proof.proof.pi_a),
        pi_b: formatProofComponent(proof.proof.pi_b),
        pi_c: formatProofComponent(proof.proof.pi_c)
      },

      public_inputs: {
        boundary_hash: polygonHash,
        timestamp: Math.floor(proof.timestamp / 1000),
      }
    }
  };
}

/**
 * Download a single proof by session ID
 */
async function downloadProof(sessionId: string): Promise<void> {
  const proof = await getProofBySessionId(sessionId);
  if (!proof) {
    console.error('Proof not found');
    return;
  }

  const currentPolygon = getCurrentPolygonState();

  // Use stored polygon name and hash, or fall back to current polygon
  const polygonName = proof.polygonName || currentPolygon.name;
  const polygonHash = proof.polygonHash || await recomputeBoundaryHash(currentPolygon);

  // Format proof to standard format
  const formattedProof = await formatProofForDownload(proof, polygonName, polygonHash);

  const dataStr = JSON.stringify(formattedProof, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `proof-${sessionId}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.info('Downloaded proof for session:', sessionId);
}

/**
 * Delete a proof by session ID
 */
async function deleteProof(sessionId: string): Promise<void> {
  if (confirm('Are you sure you want to delete this proof? This cannot be undone.')) {
    try {
      await deleteSession(sessionId);
      await updateHistoryCount();
      await updateHistoryList();
    } catch (error) {
      alert('Failed to delete proof. Check console for details.');
    }
  }
}

// ============================================================================
// WINDOW API (for backward compatibility)
// ============================================================================

/**
 * Expose download and delete functions on window for backward compatibility
 */
export function exposeHistoryAPI(): void {
  (window as any).downloadProof = downloadProof;
  (window as any).deleteProof = deleteProof;

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
  };

  (window as any).getAllProofs = async () => {
    const proofs = await getAllProofs();
    return proofs;
  };

  (window as any).getProof = async (sessionId: string) => {
    const proof = await getProofBySessionId(sessionId);
    return proof;
  };
}
