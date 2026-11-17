# RetroChord — Decision Log

This log documents the "why" behind key architectural and implementation choices in the RetroChord codebase.

---

## 1. Core Architecture

### 1.1 Backend: Firebase as a Service
*   **Decision:** No custom backend server. Use Firebase SDKs directly from the browser.
*   **Options:** Node/Express, Serverless functions (Firebase/Vercel), Firebase SDK directly.
*   **Chosen:** Firebase SDK directly.
*   **Tradeoff:** Zero maintenance and hosting cost, but strict limitations on complex data aggregation and security enforcement.
*   **Consequence:** All security logic must reside in `firestore.rules`. There is no custom backend logic possible.

### 1.2 Database Split
*   **Decision:** Use both Firestore and Realtime Database (RTDB).
*   **Options:** Firestore only, RTDB only, split.
*   **Chosen:** Split.
*   **Tradeoff:** Increased complexity of managing two databases.
*   **Consequence:** Firestore provides the queryable data (messages, channels), while RTDB provides the specific primitives needed for presence/voice (`onDisconnect`, `.info/connected`).

### 1.3 Voice Protocol
*   **Decision:** P2P WebRTC mesh.
*   **Options:** SFU (e.g., LiveKit), P2P mesh.
*   **Chosen:** P2P mesh.
*   **Tradeoff:** Zero bandwidth cost (free to operate), but limits call size to ~4 participants before quality degrades.
*   **Consequence:** No server-side audio processing; each client must upload its stream to every other peer in the call.

## 2. Messaging & Features

### 2.1 DM Identification
*   **Decision:** `dmId = [userA, userB].sort().join('_')`.
*   **Chosen:** Deterministic ID calculation.
*   **Tradeoff:** Simplicity over storage schema.
*   **Consequence:** We can open a DM between two users without ever querying Firestore to see if one exists first. Note: Risk of collision if `userIds` ever contain `_`.

### 2.2 Presence System
*   **Decision:** Heartbeat + TTL + `onDisconnect`.
*   **Tradeoff:** Extremely robust (survives tab close, crash, internet drop), but relies on client-side heartbeat logic.
*   **Consequence:** 90-second "online" → "idle" window is hardcoded in the client's status calculation based on the `lastSeen` timestamp in RTDB.

### 2.3 Message Search
*   **Decision:** Client-side filtering of the last 200 messages.
*   **Chosen:** Simple JS filtering.
*   **Tradeoff:** Free and instant for small servers; impossible for large histories.
*   **Consequence:** Search is limited to the local cache and strictly text channels (DMs are limited to 100).

### 2.4 Typing Indicators
*   **Decision:** `localStorage` + `StorageEvent`.
*   **Chosen:** Shared state within a single browser session.
*   **Tradeoff:** Extremely lightweight; no database writes.
*   **Consequence:** Typing indicators don't sync across different browsers or users (only across tabs for the *same* user).

## 3. UI & UX

### 3.1 Voice Panel Mount
*   **Decision:** Never unmount the voice panel during a call.
*   **Chosen:** Always mount, toggle visibility via CSS (`fullscreen` vs `0x0`).
*   **Tradeoff:** Higher DOM complexity.
*   **Consequence:** Preserves the underlying WebRTC connections and audio stream when minimized; otherwise, navigation would kill the call.

### 3.2 Theme System
*   **Decision:** CSS custom properties (`--surface-1`, etc.) applied via JS from a theme store.
*   **Tradeoff:** Extremely flexible (live updates), but requires every component to bind to these variables.

---
