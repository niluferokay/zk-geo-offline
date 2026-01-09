# ZK Geofencing Demo

Privacy-preserving location verification using zero-knowledge proofs.

## What This Does

Prove your location is inside a polygon **without revealing exact coordinates**.

Example: "I'm in the forest preserve" ✓ (without sharing GPS coordinates)

## Quick Start

```bash
cd client
npm install
npm run dev
```

## Demo Flow

### 1. Select Project
Choose from 3 demo polygons:
- Demo Square A
- Demo Forest B
- Demo Corridor C

Each shows:
- Polygon hash (SHA-256)
- Number of vertices
- Description

### 2. Acquire GNSS
Click **"1. Acquire GNSS"**
- Takes 30-60s for satellite lock
- Requires outdoor location
- High accuracy mode (< 50m)

### 3. Generate ZK Proof
Click **"2. Generate ZK Proof"**
- Takes 10-30s for proof generation
- Uses selected polygon
- Saves to IndexedDB

### 4. Custom Polygons (Optional)

**Paste GeoJSON:**
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

**Or upload `.json` / `.geojson` file**

See [examples/](examples/) for sample GeoJSON files.

## Features

✅ **3 Demo Polygons** - Square, irregular, narrow corridor
✅ **GeoJSON Upload** - Paste or upload custom polygons
✅ **Polygon Hash** - SHA-256 identifier displayed
✅ **Offline-First** - Works completely offline after initial load
✅ **IndexedDB Storage** - All proofs saved locally
✅ **2-Step Process** - Separate GNSS acquisition and proof generation
✅ **Console API** - Download/verify proofs programmatically

## Architecture

```
User → Select Polygon → Acquire GNSS → Generate ZK Proof → Verify
         ↓                  ↓                 ↓
    Polygon Hash      GPS Coords      snarkjs.groth16.fullProve
         ↓                  ↓                 ↓
    SHA-256 hash      Scale×10000      Circom circuit (RayTracing)
                                             ↓
                                       Proof + Public Signals
                                             ↓
                                       IndexedDB storage
```

## Tech Stack

- **Frontend**: Vite + TypeScript
- **ZK Proofs**: Circom + snarkjs (Groth16)
- **Storage**: IndexedDB (offline-capable)
- **Mobile**: Capacitor (iOS + Android)

## File Structure

```
zk-geo-offline/
├── client/                 # Web application
│   ├── src/
│   │   ├── main.ts        # UI and event handlers
│   │   ├── proof.ts       # ZK proof generation/verification
│   │   ├── polygons.ts    # Polygon management (NEW)
│   │   ├── db.ts          # IndexedDB storage
│   │   └── style.css      # Styling
│   ├── public/
│   │   └── circuits/      # Compiled ZK circuits
│   └── index.html         # Demo UI
├── circuits/              # Circom source
│   └── circuits/
│       ├── Main.circom
│       ├── PointInPolygon.circom
│       └── ...
├── examples/              # Sample GeoJSON files (NEW)
│   ├── triangle-sf.geojson
│   ├── square-nyc.geojson
│   └── houston-feature.geojson
└── DEMO_GUIDE.md          # Detailed demo instructions (NEW)
```

## Console API

```javascript
// List all GNSS sessions
dumpGNSS()

// Get all proofs
getAllProofs()

// Get specific proof
getProof('session-id')

// Download all proofs
downloadAllProofs()

// Download specific proof
downloadProof('session-id')

// Verify proof
verifyProof(proof, publicSignals)
```

## GeoJSON Format

Supported types:
- `Polygon`
- `Feature` with Polygon geometry
- `FeatureCollection` (uses first Polygon)

Coordinates: `[longitude, latitude]` in decimal degrees

## How ZK Proofs Work

1. **Public Inputs**: Polygon vertices (known to verifier)
2. **Private Inputs**: Your exact GPS coordinates (hidden)
3. **Circuit Logic**: Ray-tracing point-in-polygon algorithm
4. **Output**: Boolean (1 = inside, 0 = outside) + proof

**Key Property**: Verifier learns if you're inside without learning your exact location.

## Limitations

- Circuit supports max 8 vertices (current compilation)
- Proof generation: 10-30s in browser
- GNSS accuracy: < 50m (high accuracy mode)
- Proving key size: ~18MB (one-time download)

## Development

```bash
# Start dev server
cd client
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Build iOS app
npx cap sync ios
npx cap open ios

# Build Android app
npx cap sync android
npx cap open android
```

## Testing

See [DEMO_GUIDE.md](DEMO_GUIDE.md) for complete testing checklist.

## Circuit Details

- **Algorithm**: Ray-tracing (counts ray-polygon intersections)
- **Proof System**: Groth16 (fast verification)
- **Curve**: BN254 (254-bit)
- **Constraints**: ~100k (depends on polygon vertices)
- **Proving Time**: 10-30s (browser), < 1s (native)

## Privacy Guarantees

✅ Exact coordinates never revealed
✅ Polygon vertices are public
✅ Proof is zero-knowledge (reveals only inside/outside)
✅ No trusted third party required
✅ Cryptographically verifiable

## Use Cases

- Attendance verification without GPS tracking
- Access control for geographic areas
- Location-based NFT claims
- Privacy-preserving check-ins
- Geo-restricted content access

## License

MIT

## Credits

Built with:
- [snarkjs](https://github.com/iden3/snarkjs) - ZK proof library
- [Circom](https://github.com/iden3/circom) - Circuit language
- [Capacitor](https://capacitorjs.com/) - Mobile framework
- [Vite](https://vitejs.dev/) - Build tool
