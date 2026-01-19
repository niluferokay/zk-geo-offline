/**
 * UI State Management
 *
 * Manages global UI state, proof generation states, and timer logic.
 * This module contains shared mutable state and state transition logic.
 *
 * SECURITY: Does not contain cryptographic logic or authorization decisions.
 */

import type { Polygon } from '../polygons';

// ============================================================================
// PROOF STATE ENUM
// ============================================================================

/**
 * Proof generation states
 */
export const ProofState = {
  IDLE: 'idle',
  ACQUIRING: 'acquiring',
  GENERATING: 'generating',
  SUCCESS: 'success',
  FAILURE: 'failure'
} as const;

export type ProofState = typeof ProofState[keyof typeof ProofState];

// ============================================================================
// GLOBAL UI STATE
// ============================================================================

/**
 * Current polygon selection
 * Modified by polygon selector UI
 */
export let currentPolygon: Polygon;

/**
 * Set current polygon (called by polygon selector)
 */
export function setCurrentPolygon(polygon: Polygon): void {
  currentPolygon = polygon;
}

/**
 * Get current polygon
 */
export function getCurrentPolygonState(): Polygon {
  return currentPolygon;
}

/**
 * Current proof generation state
 */
let currentState: ProofState = ProofState.IDLE;

/**
 * Get current proof state
 */
export function getCurrentState(): ProofState {
  return currentState;
}

/**
 * Set current proof state
 */
export function setCurrentState(state: ProofState): void {
  currentState = state;
}

// ============================================================================
// TIMER STATE
// ============================================================================

/**
 * Timer interval handle
 */
let timerInterval: number | null = null;

/**
 * Timer start timestamp
 */
let startTime: number = 0;

/**
 * Start the proof generation timer
 */
export function startTimer(): void {
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

/**
 * Stop the proof generation timer
 */
export function stopTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) {
    timerDisplay.style.display = 'none';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Update screen reader announcements for accessibility
 */
export function announceToScreenReader(message: string): void {
  const announcer = document.getElementById('sr-announcements');
  if (announcer) {
    announcer.textContent = message;
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}
