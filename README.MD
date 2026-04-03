# OpenGuessr

A free, open source GeoGuessr-style multiplayer game. See a Google Street View panorama, guess which country it's from, and compete with friends on a live leaderboard.

## Key Features

- **Completely free** - No hidden costs, no premium tiers
- **No registration** - Pick a username and play instantly
- **Real-time multiplayer** - Live scores and head-to-head competition
- **Privacy first** - No data collection, no tracking
- **Open source** - Fully transparent, self-hostable
- **Any device** - Responsive across desktop, tablet, and mobile

## Quick Start

### Prerequisites

- Node.js 22+
- npm 10.8+
- Firebase CLI 13+ (`npm install -g firebase-tools`)
- Java 21+ (for Firebase emulators)

### Setup

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Start dev server + Firebase emulators
npm start
```

Open http://localhost:5173 in your browser.

### DevContainer

Open in VS Code with the Dev Containers extension, or use GitHub Codespaces. The container includes Node.js 22, Java 21, Firebase CLI, and Claude Code.

## Architecture

### System Overview

```
Firebase Hosting (SPA)  →  Cloud Functions (Node.js 22)  →  Realtime Database
         ↓                          ↓                              ↑
   Google Maps API          Firebase Auth (custom tokens)     Game state
```

See [diagrams/](diagrams/) for detailed Mermaid diagrams:
- [01-system-overview.mmd](diagrams/01-system-overview.mmd) - Infrastructure and services
- [02-component-architecture.mmd](diagrams/02-component-architecture.mmd) - Frontend and backend components
- [03-user-journey.mmd](diagrams/03-user-journey.mmd) - Full game flow sequence diagram

### Component Architecture

**Frontend** - Vanilla JavaScript with Vite bundling. Class-based components managing DOM directly. No framework.

**Backend** - Firebase Cloud Functions (Node.js 22) handling game logic, scoring, and authentication.

**Data** - Firebase Realtime Database for game state with real-time listeners. Firebase Auth with custom tokens for anonymous play.

## Data Model

```
games/
  {roomId}/
    hostId: string              # UID of the game creator
    status: "waiting" | "playing" | "finished"
    currentRound: number        # 0-indexed
    roundStartedAt: number      # timestamp
    roundTime: number           # seconds (default 30)
    totalRounds: number         # default 5
    createdAt: number           # timestamp
    finishedAt: number          # timestamp (when finished)
    rounds/
      {round}/
        lat: number
        lng: number
        country: string         # ISO country code
        revealed: boolean       # true after round ends
    players/
      {uid}/
        name: string
        score: number
        joinedAt: number
        guesses/
          {round}/
            countryCode: string
            timestamp: number
            score: number
            correct: boolean
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES modules), Vite 6 |
| Backend | Cloud Functions (Node.js 22, firebase-functions 6.2) |
| Database | Firebase Realtime Database |
| Auth | Firebase Auth (custom tokens, anonymous) |
| Hosting | Firebase Hosting |
| Maps | Google Maps Street View Embed API |
| Testing | Vitest 3.0, Playwright 1.40, @firebase/rules-unit-testing 4.0 |
| CI/CD | GitHub Actions |
| IaC | Terraform (in firebase-cloud repo) |

## Security

### Database Rules

- Default deny all reads and writes at root
- Game state fields (hostId, status, rounds) are read-only for clients - only Cloud Functions can write
- Players can only write their own guesses (enforced by `auth.uid == $uid`)
- Guesses are write-once (no overwriting via `!data.exists()`)
- Country answers are hidden until the round is revealed (`revealed === true`)
- All reads require authentication (`auth != null`)

### Authentication

- Anonymous auth via Cloud Functions - username validated server-side
- Custom tokens with claims (e.g., `roomHost` for host privileges)
- Host-only actions (startGame, nextRound) enforced in Cloud Functions

## Project Structure

```
openguessr/firebase-src/
├── .devcontainer/           # Dev container (Node.js 22 + Java 21)
│   ├── devcontainer.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── post-create.sh
├── .github/workflows/
│   ├── ci.yml               # Test + build on PRs
│   └── cd.yml               # Deploy staging → production
├── diagrams/
│   ├── 01-system-overview.mmd
│   ├── 02-component-architecture.mmd
│   └── 03-user-journey.mmd
├── functions/               # Cloud Functions
│   ├── index.js             # All 8 functions (login, createGame, etc.)
│   ├── locations.js         # Street View coordinates
│   ├── functions.test.js    # Unit tests
│   └── package.json
├── public/                  # Static assets
├── src/
│   ├── index.js             # Entry point
│   ├── firebase-init.js     # Firebase config + emulator detection
│   ├── component/           # UI components (alert, dialog, landing, etc.)
│   ├── data/                # Countries, maps, timer utilities
│   └── features/
│       ├── auth-dialog/     # Authentication flow
│       ├── database/        # Firebase bridge + rules tests
│       └── game-screen/     # Game orchestrator
├── tests/                   # Playwright E2E tests
├── database.rules.json      # Realtime Database security rules
├── firebase.json            # Firebase configuration
├── vite.config.js           # Vite + Vitest config
└── package.json
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm start` | Vite dev server + Firebase emulators |
| `npm test` | Run all tests (unit + rules) with emulators |
| `npm run test:watch` | Interactive test mode with emulators |
| `npm run serve` | Firebase emulators only |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

## Firebase Setup

### Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Realtime Database | 9001 |
| Cloud Functions | 5001 |
| Hosting | 5002 |
| Emulator UI | 4000 |
| Vite Dev Server | 5173 |

### Production Deployment

The project is deployed via GitHub Actions to Firebase Hosting with Cloud Functions. Infrastructure is managed via Terraform in the `firebase-cloud` repository.

Required GitHub Secrets:
- `WIF_PROVIDER` - Workload Identity Federation provider
- `GCP_SA_EMAIL` - CI/CD service account email

Required GitHub Variables:
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - GCP region (default: us-central1)
- `FIREBASE_SITE_ID` - Firebase Hosting site ID
- `CUSTOM_DOMAIN` - Custom domain (optional)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_USE_EMULATORS` | Enable Firebase emulators | `true` (dev) |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Run `npm test` to verify
5. Submit a pull request

## License

MIT
