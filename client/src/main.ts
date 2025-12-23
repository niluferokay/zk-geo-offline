if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

const button = document.getElementById('get-location');
const output = document.getElementById('location-output');

if (button && output) {
  button.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      output.textContent = 'Acquiring GNSS/GPS position... (this may take 30-60s for satellite lock)';

      navigator.geolocation.getCurrentPosition(
        (position) => {
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

          // Try to use cached location
          const cached = localStorage.getItem('lastKnownLocation');
          if (cached) {
            const cachedData = JSON.parse(cached);
            errorMsg += `\n\nUsing last known location from ${cachedData.timestamp}:\n${JSON.stringify(cachedData, null, 2)}`;
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
