# RetroChord

**Live:** [discord-mockup-woad.vercel.app](https://discord-mockup-woad.vercel.app)

A real-time, peer-to-peer chat application styled after Windows 98. RetroChord is a full-stack, serverless clone built for performance and low-latency interaction.

## Documentation
*   [Technical Specification](docs/SPEC.md) — Architecture, protocols, and data models.
*   [Decision Log](docs/DECISIONS.md) — Engineering tradeoffs and rationale.
*   [AI Disclosure](docs/AI_DISCLOSURE.md)

## Capabilities
- **Real-Time Communication:** Messaging, DMs, and presence using Firebase Firestore/RTDB.
- **Voice & Video:** Low-latency P2P mesh via WebRTC with screen sharing.
- **Enterprise-Grade Features:** Role-based access, custom emojis, rich media embeds, and typing indicators.
- **Highly Performant:** Entirely client-side architecture; zero server-side logic reduces latency and infrastructure costs.
- **Customizable:** Dynamic theme engine (colors, fonts, backgrounds) with live persistence.

## Tech Stack
*   **Frontend:** React 18, TypeScript, Vite, React Router v6.
*   **Backend:** Firebase (Firestore, Auth, Realtime Database) — Serverless architecture.
*   **Media:** Cloudinary (secure file uploads), WebRTC (P2P audio/video).
*   **Hosting:** Vercel.

## Engineering Highlights
*   **Presence System:** Hybrid RTDB/Firestore model with heartbeat, `onDisconnect` listeners, and cross-tab sync ensuring presence accuracy.
*   **Voice Engineering:** Implemented "Perfect Negotiation" WebRTC pattern to handle call collisions and NAT traversal via STUN/TURN relays.
*   **Optimized UX:** CSS-based windowing prevents component unmounting during call transitions, ensuring seamless voice persistence during navigation.
