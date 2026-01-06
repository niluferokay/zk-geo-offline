# Demo Flow Guide

## Overview
This guide walks through the complete demo flow for the ZK geofencing application.

## Demo Flow

### 1. Select Project Polygon
Choose one of the three demo polygons:
- **Demo Square A**: Small square geofence (Houston area)
- **Demo Forest B**: Irregular forest-like geofence
- **Demo Corridor C**: Narrow corridor edge case

Each selection displays:
- Polygon name and description
- Number of vertices
- SHA-256 hash of polygon coordinates

### 2. Acquire GNSS Location
Click "1. Acquire GNSS" to get your GPS coordinates
- Takes 30-60 seconds for satellite lock
- Requires outdoor location with clear sky view
- High accuracy mode enabled (< 50m)

### 3. Generate ZK Proof
Click "2. Generate ZK Proof" (enabled after GNSS acquisition)
- Generates zero-knowledge proof using selected polygon
- Takes 10-30 seconds for proof generation
- Proof saved to IndexedDB with session ID

### 4. View History
Click "Show History" to see all stored proofs with:
- Session ID
- Coordinates (for verification)
- Accuracy
- Timestamps
- Proof data

## Custom Polygon Upload

### Option 1: Paste GeoJSON
1. Expand "Upload Custom Polygon" section
2. Paste GeoJSON in the textarea
3. Click "Load GeoJSON"
4. Enter a name for your polygon

### Option 2: Upload File
1. Expand "Upload Custom Polygon" section
2. Click "Choose File"
3. Select a `.json` or `.geojson` file

## Example GeoJSON Polygons

### Example 1: Simple Triangle (San Francisco)
```json
{
  "type": "Polygon",
  "coordinates": [[
    [-122.4194, 37.7749],
    [-122.4000, 37.7749],
    [-122.4097, 37.7900],
    [-122.4194, 37.7749]
  ]]
}
```

### Example 2: Square (New York)
```json
{
  "type": "Polygon",
  "coordinates": [[
    [-74.0060, 40.7128],
    [-74.0060, 40.7228],
    [-73.9960, 40.7228],
    [-73.9960, 40.7128],
    [-74.0060, 40.7128]
  ]]
}
```

### Example 3: Feature (Houston - matches Demo Forest B)
```json
{
  "type": "Feature",
  "properties": {
    "name": "Houston Geofence"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-95.411, 29.020],
      [-95.4115, 29.026],
      [-95.413, 29.032],
      [-95.413, 29.045],
      [-95.4115, 29.052],
      [-95.410, 29.048],
      [-95.409, 29.038],
      [-95.409, 29.026],
      [-95.411, 29.020]
    ]]
  }
}
```

### Example 4: FeatureCollection (Austin)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {"name": "Austin Zone"},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-97.7431, 30.2672],
          [-97.7431, 30.2772],
          [-97.7331, 30.2772],
          [-97.7331, 30.2672],
          [-97.7431, 30.2672]
        ]]
      }
    }
  ]
}
```

## Console API

Open browser console for additional commands:

```javascript
// List all sessions
dumpGNSS()

// Get all proofs
getAllProofs()

// Get specific proof by session ID
getProof('session-id-here')

// Download all proofs as JSON
downloadAllProofs()

// Download specific proof
downloadProof('session-id-here')

// Verify a proof
verifyProof(proofObject, publicSignals)
```

## Technical Notes

### Coordinate Scaling
- GeoJSON coordinates are in decimal degrees (e.g., 29.0325°N)
- Internally scaled by 10,000 for circuit (290325)
- Allows integer arithmetic in zero-knowledge circuits

### Polygon Hash
- SHA-256 hash of JSON-stringified coordinates
- Provides unique identifier for each polygon
- Can be shared publicly without revealing polygon shape

### Proof Structure
- **Proof**: Groth16 proof object (pi_a, pi_b, pi_c)
- **Public Signals**: Circuit outputs (visible to verifier)
- **Private Inputs**: Exact coordinates (hidden in ZK proof)

### Storage
- All data stored in IndexedDB (offline-capable)
- Database name: `gainforest`
- Object store: `gnss_sessions`
- Persists across browser sessions

## Testing Checklist

- [ ] Select Demo Square A → Generate proof
- [ ] Select Demo Forest B → Generate proof
- [ ] Select Demo Corridor C → Generate proof
- [ ] Upload custom GeoJSON (paste) → Generate proof
- [ ] Upload custom GeoJSON (file) → Generate proof
- [ ] View history shows all proofs
- [ ] Download single proof works
- [ ] Download all proofs works
- [ ] Proof verification in console works
- [ ] Polygon hash changes with selection
- [ ] Step 2 button disabled until GNSS acquired
- [ ] GNSS coordinates displayed correctly
- [ ] Offline mode works (after initial load)

## Known Limitations

- Circuit supports max 8 vertices (current compilation)
- Proof generation takes 10-30s (browser limitation)
- GNSS requires outdoor location for high accuracy
- File size: ~18MB for proving key (one-time download)
