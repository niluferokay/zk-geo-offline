// Register service worker for offline support
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Reload once when new SW takes control (for updates)
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
  navigator.serviceWorker.register('/sw.js');
}

import './ui/main';
