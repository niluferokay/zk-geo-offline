// Register service worker for offline support
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js').then(() => {
    // Only reload on first install (no previous controller)
    // This ensures assets get cached through the SW
    if (!hadController) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  });
}

import './ui/main';
