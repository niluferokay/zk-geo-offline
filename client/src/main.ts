import { saveGNSS, listAllSessions, initWebStore } from './db';

// Initialize SQLite web store and set up event listeners after it's ready
(async () => {
  await initWebStore();
  console.log('SQLite initialized');
})();

(window as any).dumpGNSS = async () => {
  const rows = await listAllSessions();
  console.table(rows);
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

const button = document.getElementById('get-location');
const output = document.getElementById('location-output');
const historyBtn = document.getElementById('show-history');

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

const sessionId = crypto.randomUUID();

if (button && output) {
  button.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      output.textContent = 'Acquiring GNSS/GPS position... (this may take 30-60s for satellite lock)';

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;
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

          output.textContent = JSON.stringify(locationData, null, 2);

          // Cache location for offline use
          localStorage.setItem('lastKnownLocation', JSON.stringify(locationData));
          
          // ✅ SAVE TO SQLITE HERE
          const gnssFix = {
            lat: latitude,
            lon: longitude,
            accuracy,
            timestamp: position.timestamp
        };

          // Ensure web store is initialized before saving
          await initWebStore();
          await saveGNSS(sessionId, gnssFix);

        output.textContent = JSON.stringify(
          {
            message: 'GNSS saved locally (offline)',
            sessionId,
            gnssFix
          },
          null,
          2
        );
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
        },
        {
          enableHighAccuracy: true,  // Force GNSS/GPS instead of network positioning
          timeout: 60000,            // 60 seconds for satellite acquisition
          maximumAge: 0              // Don't use cached position from browser
        }
      );
    } else {
      output.textContent = 'Geolocation is not supported by your browser.';
    }
  });
}

