# zk-geo-offline

**Privacy-preserving location verification using zero-knowledge proofs.**

Prove presence inside a geographic zone without revealing exact coordinates — fully client-side, no trusted third party, offline-capable after initial load.

Built for [GainForest](https://gainforest.app), an NGO that supports indigenous communities to collect environmental data in remote forests. The system enables workers to cryptographically prove they collected data inside a verified project zone, without exposing their GPS coordinates to anyone — including the organization itself.

## Motivation

Indigenous environmental defenders are being targeted and attacked by corporations for protecting forests. Publishing their locations and identities, even indirectly, creates real physical risk. At the same time, public goods funders need accountability: proof that work was actually done, in the right place, at the right time.

Standard approaches force a choice between **transparency** and **safety**. Zero-knowledge proofs dissolve that tradeoff.

## What It Proves

> There exists a private point **P** such that **P** lies strictly inside a defined geographic polygon.

**The verifier learns:**

- Whether the worker was inside the zone (public signal: `1` or `0`)
- The polygon boundary (public input)

**The verifier does _not_ learn:**

- The worker's exact GPS coordinates
- Any location information beyond zone membership

---

## Technical Overview

### Circuit

| Parameter | Value |
|---|---|
| Language | Circom |
| Proof system | Groth16 |
| Curve | BN254 |
| Algorithm | Ray-casting point-in-polygon (even-odd rule) |
| Arithmetic | Exact integer geometry — no floating point in the circuit |
| Constraint count | ~100k (8-vertex polygon) |
| Proving time | 10–30s in browser, <1s native |

Coordinates are scaled by `10,000` before entering the circuit (e.g. `29.0325°N → 290325`), enabling integer arithmetic within the field bounds of BN254.

### Polygon Normalization

Real forest boundaries can have hundreds of vertices. The circuit supports a maximum of **8**. A [Visvalingam–Whyatt](https://en.wikipedia.org/wiki/Visvalingam%E2%80%93Whyatt_algorithm) simplification algorithm reduces arbitrary polygons to 8 vertices while preserving geometric shape.

A [Turf.js](https://turfjs.org/) oracle validates that every normalization preserves inside/outside classification across a comprehensive test fixture set — this is the **critical security invariant**: same geometry must produce the same truth in JavaScript, in the ZK circuit, and in the polygon hash.

### Boundary Hash System

Each polygon is assigned a deterministic **SHA-256 boundary hash** computed over normalized coordinates and algorithm parameters using canonical serialization (alphabetically sorted keys, no `JSON.stringify` variance). The hash is:

- **Time-independent** — same polygon → same hash, always
- **Platform-independent** — Chrome, Node.js, any JS engine
- **Bound to each stored proof** — prevents proof reuse attacks

## Security Properties

| Property | Guarantee |
|---|---|
| Coordinate privacy | Exact GPS coordinates never leave the device |
| Boundary integrity | SHA-256 hash detects any polygon tampering |
| Proof binding | Each proof is cryptographically bound to a specific boundary |
| No false proofs | Circuit constraints make false inside-proofs computationally infeasible |
| Offline-capable | All proving happens client-side after initial asset load |

### Security Hardening Applied

- **Division-by-zero protection** — Degenerate polygons with duplicate vertices handled gracefully
- **Latitude-aware distance conversion** — Fixed ~50% error at high latitudes from incorrect equatorial assumption
- **XSS protection** — All user-provided strings sanitized before DOM insertion; inline `onclick` replaced with DOM event listeners
- **GeoJSON input validation** — 1MB file size limit, 500 vertex limit, strict coordinate range checks, rejection of `NaN`/`Infinity`

## Repository Structure

```
zk-geo-offline/
├── circuits/
│   └── circuits/
│       ├── Main.circom              # Entry point
│       ├── PointInPolygon.circom    # Ray-casting logic
│       └── ...                      # Utility circuits
├── client/
│   ├── src/
│   │   ├── proof.ts                 # ZK proof generation & verification
│   │   ├── polygons.ts              # Coordinate system, normalization, hashing
│   │   ├── db.ts                    # IndexedDB storage
│   │   └── ui/                      # Modular UI components
│   ├── tests/
│   │   ├── unit/                    # Geometry, normalization, hash tests
│   │   ├── integration/             # Oracle parity tests
│   │   └── fixtures/                # 10 deterministic test polygons
│   └── public/circuits/             # Compiled WASM + zkey files
└── examples/                        # Sample GeoJSON polygons
```

## Getting Started

### Run Locally

```bash
cd client
npm install
npm run dev
```

### Run Tests

```bash
# Unit tests (~5s)
npm run test:unit

# Parity tests — verifies JS normalization matches Turf.js oracle (~15s)
npm run test:integration

# ZK circuit parity tests — verifies circuit matches geometric truth (~2-10min)
npm run test:zk:fast

# Full test suite
npm run test:all
```

## Tech Stack

| Layer | Technology |
|---|---|
| Circuit | Circom 2, snarkjs (Groth16) |
| Frontend | Vite + TypeScript |
| Mobile | Capacitor (iOS + Android) |
| Storage | IndexedDB (offline-first) |
| Testing | Vitest, Turf.js (oracle) |
| Deployment | Vercel |

## License

[MIT](LICENSE)
