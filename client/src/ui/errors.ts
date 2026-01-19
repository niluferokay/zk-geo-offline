/**
 * Error Rendering and UX Helpers
 *
 * Handles error display, user recommendations, and error recovery actions.
 *
 * SECURITY: Does not make authorization decisions or validate proofs.
 * Only renders user-facing error messages with sanitized content.
 */

// ============================================================================
// HTML SANITIZATION
// ============================================================================

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// ERROR DISPLAY
// ============================================================================

/**
 * Display error card with recommendations and actions
 *
 * @param type - Error type for icon selection
 * @param title - Error title (will be sanitized)
 * @param message - Error message (will be sanitized)
 * @param recommendations - List of user recommendations
 * @param actions - Action buttons with callbacks
 */
export function showError(
  type: string,
  title: string,
  message: string,
  recommendations: string[] = [],
  actions: { label: string; callback: () => void }[] = []
): void {
  const errorSection = document.getElementById('error-section');
  const errorCard = document.getElementById('error-card');
  const resultSection = document.getElementById('result-section');

  if (!errorSection || !errorCard) return;

  if (resultSection) resultSection.style.display = 'none';

  const iconMap: Record<string, string> = {
    'permission': '⚠️',
    'accuracy': '⏱️',
    'outside': '❌',
    'timeout': '⏱️',
    'generation': '❌'
  };

  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  let html = `
    <div class="error-header">
      <span class="error-icon">${iconMap[type] || '⚠️'}</span>
      <span class="error-title">${safeTitle}</span>
    </div>
    <div class="error-message">${safeMessage}</div>
  `;

  if (recommendations.length > 0) {
    html += `
      <div class="error-recommendations">
        <h3>Recommendations:</h3>
        <ul>
          ${recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (actions.length > 0) {
    html += `<div class="error-actions">`;
    actions.forEach((action, index) => {
      const id = `error-action-${index}`;
      html += `<button class="error-btn ${index === 0 ? 'primary' : ''}" id="${id}">${escapeHtml(action.label)}</button>`;
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

  errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
