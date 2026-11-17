# RetroChord — Technical Specification

**Live:** https://discord-mockup-woad.vercel.app
**Stack:** React 18 · TypeScript · Vite · Firebase (Auth + Firestore + RTDB) · Cloudinary · WebRTC · Vercel
**Size:** ~5,400 LOC, 99 source files, no backend code. Everything runs client-side.

---

## 1. What it is

A real-time chat application styled after Windows 98. Text channels, direct messages, voice/video calls (P2P WebRTC), custom emojis, per-user themes, presence, notifications, and rich embeds. Authenticated users only. Single serverless backend: Firebase.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (React SPA)               │
│  app/  components/  features/  lib/  types/  styles/ │
└──────┬──────────┬────────────┬──────────┬───────────┘
       │          │            │          │
  Firebase Auth   Firestore   RTDB    Cloudinary
  (email/pw)   (queryable     (presence,  (file uploads,
               data)          signaling)  unsigned preset)
       │          │            │
       └──────────┴────────────┘
        Google STUN + free TURN (openrelay.metered.ca)
                       │
              WebRTC mesh (P2P per peer)
                       │
              Vercel (hosting, SPA rewrite, Permissions-Policy)
```

**Key structural fact:** there is no server code. The Firebase SDKs talk to Google directly from the browser. Security lives entirely in `firestore.rules`. The tradeoff is real: no rate limiting, no server-side validation, no custom backend logic — everything enforceable is enforced at the Firestore rules layer.

**Routing:** React Router v6. `/login`, `/signup`, `/forgot-password` (public); `/app/*` (protected). `/app/channel/:id`, `/app/voice/:id`, `/app/dm/:userId`, `/app/settings/profile`.

---

## 3. Data model

### 3.1 Firestore collections

| Collection | Key fields | Who writes |
|---|---|---|
| `users/{uid}` | `username`, `email`, `avatarUrl`, `bio`, `presence` (online/idle/offline), `isAdmin`, `isDeleted` | owner (any field), admin (any field) |
| `messages/{id}` | `senderId`, `content`, `channelId?`, `dmId?`, `timestamp`, `deleted`, `reactions[]`, `attachments[]`, `editedAt?`, `mentions?` | authenticated user (sender or admin can update/delete) |
| `channels/{id}` | `name`, `description`, `isPermanent`, `createdBy`, `isVoiceChannel` | creator or admin; permanent channels cannot be renamed/deleted |
| `voiceChannels/{id}` | `channelId`, `participants[]` | authenticated (arrayUnion/arrayRemove) |
| `directMessages/{dmId}` | `id`, `userA`, `userB`, `lastSeenBy{}`, `closedBy[]` | authenticated |
| `signaling/{id}` | `from`, `to`, `channelId`, `type` (offer/answer/ice-candidate/kick), `offer?`, `answer?`, `candidate?`, `timestamp` | authenticated; deleted immediately after the recipient reads it |
| `notifications/{id}` | `toUserId`, `fromUserId`, `fromUsername`, `type` (mention/dm), `channelId?`, `channelName?`, `dmId?`, `messageId`, `preview`, `read`, `timestamp` | recipient can read/update; system creates |
| `customEmojis/{id}` | `name`, `url`, `uploadedBy`, `username`, `createdAt` | uploader creates/deletes own; admin can delete any |
| `serverSettings/main` | `name` | admin only |

`directMessages` uses a **deterministic document id**: `getDMId(a, b)` = `[a, b].sort().join('_')`. This lets you compute the DM's doc id without a query. Caveat: if a uid ever contains `_`, ids can collide.

### 3.2 Realtime Database paths

| Path | Content | Purpose |
|---|---|---|
| `presence/{uid}` | `{ online: bool, lastSeen: timestamp }` | Per-user presence with heartbeat + TTL |
| `voicePresence/{channelId}/{uid}` | `true` | Who is actually connected in a voice channel (hard-disconnect detection) |
| `.info/connected` | RTDB connection state | Re-register presence on reconnect |

### 3.3 Other data

- **Typing indicators:** `localStorage` key `retrochord_typing`, shape `{ [contextId]: { [userId]: timestamp } }`. Broadcast cross-tab via a manually-dispatched `StorageEvent`. Not in Firestore — flagged as movable.
- **Theme:** `localStorage` key `retrochord_theme`, a `Theme` object (colors, font, background image + opacity).
- **Offline user cache:** `localStorage` key `currentUser` (last-known user object, used before auth state resolves).
- **Custom background images:** base64 in `localStorage` (capped near the 5MB limit).

---

## 4. Feature surface

### 4.1 Auth (`features/auth/`)
- `signup(username, email, password, bio?, avatarUrl?)` — creates Firebase Auth user + Firestore user doc. Auto-assigns `isAdmin: true` if `username.toLowerCase() === 'lioneltest'`.
- `login(email, password)` — signs in, creates user doc if missing (auth/docstore mismatch), sets presence online.
- `logout()` — sets presence offline in both RTDB and Firestore, then signs out.
- `getUser(id)`, `getAllUsers()`, `updateProfile(id, updates)`, `deleteUser(userId, adminId)` — admin-gated soft delete (sets `isDeleted`, renames to "Deleted User", removes email).
- `useAuth` context: holds `user`, plus a presence system.

### 4.2 Messaging (`features/chat/`)
- `sendMessage(senderId, content, channelId?, dmId?, attachments?, senderUsername?, channelName?)` — writes to `messages`, fire-and-forgets mention notifications.
- `subscribeToChannelMessages(channelId, cb)` / `subscribeToDMMessages(dmId, cb)` — real-time snapshots, filters `deleted`, ordered by timestamp ascending.
- `deleteMessage(messageId, userId)` — sender or admin only.
- `editMessage(messageId, userId, newContent)` — sender only; sets `editedAt`.
- `toggleReaction(messageId, userId, emoji)` — Firestore transaction; toggles the user in/out of a reaction's `userIds`, removing empty reactions.
- `setTyping` / `clearTyping` / `getTypingUsers` — localStorage-based, 3s timeout.
- `searchChannelMessages(query, channels)` — client-side full-text over the last 200 messages per channel, results capped at 50.
- `searchDMMessages(query, userId, dms)` — same pattern for DMs, last 100, capped at 30.
- `createMentionNotifications(...)` — scans `@username` tokens in content, looks up matching users, writes a `notifications` doc for each.
- `subscribeToNotifications(userId, cb)` / `markNotificationRead` / `markAllNotificationsRead` / `markNotificationsReadForChannel`.

### 4.3 DMs (`features/chat/dmApi`)
- `getDMId(a, b)`, `getOrCreateDM(a, b)`, `createDM(a, b)`, `markDMSeen`, `closeDM`, `getActiveDMs(userId)`, `subscribeToActiveDMs(userId, cb)`.
- DMs support "closing" — a user who closed a DM still sees it until the other user reopens it.

### 4.4 Channels (`features/channels/`)
- `initializeDefaultChannels()` — idempotent seed of 3 text + 2 voice channels.
- `getAllChannels()`, `getTextChannels()`, `getVoiceChannels()`.
- `createChannel` — name uniqueness check, slugifies the name.
- `updateChannel` / `deleteChannel` — creator or admin; permanent channels protected.

### 4.5 Voice (`features/voice/`)
- `joinVoiceChannel(channelId, userId)` — writes to Firestore `voiceChannels`, sets RTDB presence, registers `onDisconnect`, and attaches a `.info/connected` handler that re-registers presence on reconnect (RTDB disconnects on every SPA navigation otherwise). Returns a cleanup function.
- `leaveVoiceChannel`, `kickFromVoiceChannel` (admin), `kickFromAllVoiceChannels` (admin, used on user delete).
- `subscribeToVoiceChannel` (Firestore participant list), `subscribeToVoicePresence` (RTDB, fast hard-disconnect detection).
- `sendSignal` / `subscribeToSignals` — WebRTC signaling over Firestore. Signals are deleted immediately after the recipient processes them so they don't replay on reconnect. No `orderBy` — omitted deliberately to avoid a composite index; sorted client-side.
- `WebRTCManager` class (see §7).

### 4.6 Presence (`features/auth/useAuth`, RTDB)
Heartbeat + TTL + multi-signal offline detection:
- Writes `{ online: true, lastSeen: now }` every 30s while connected and visible.
- `onDisconnect.remove()` clears on tab close / crash / network loss.
- `.info/connected` re-registers on reconnect.
- `visibilitychange` pauses the heartbeat when backgrounded.
- Client computes status: `lastSeen < 90s → online`, `90s–5min → idle`, `> 5min → offline`. Mirrored to Firestore `users.presence` for the member list dot.

### 4.7 Media & embeds (`lib/mediaUpload`)
- `validateFile(file)` — 8MB cap, MIME allowlist, extension blocklist (exe, bat, js, ts, py, html, etc.).
- `uploadFile(file, userId, onProgress)` — Cloudinary unsigned upload via `XMLHttpRequest` (progress + error handling).
- `detectEmbeds(text)` — returns `EmbedInfo[]` for YouTube (nocookie), Vimeo, Spotify, GitHub repo/PR/issue/gist, Imgur image/album (gifv→mp4), direct image URLs, GIPHY/Tenor. Dedupes, stops URLs at brackets/quotes.
- `getAttachmentKind(mimeType)`.

### 4.8 Custom emojis (`features/customEmojis`)
- 256KB cap, image-only, 10-per-user limit, Cloudinary upload + Firestore metadata.
- `subscribeToCustomEmojis(cb)` — live list, sorted by username then creation time.
- Custom emoji syntax: `:name:` in messages and reactions.

### 4.9 Theme (`features/theme`)
- `Theme` interface: 5 colors, font family/url/name, background image URL + opacity.
- 8 font presets (incl. Press Start 2P), 6 color presets (Win98, Dark, Rose, Forest, Ocean, Dusk).
- Applied via CSS custom properties on `:root`; persists in `localStorage`.

### 4.10 Server settings (`features/serverSettings`)
- Single doc `serverSettings/main`, `{ name }`. Read by anyone, admin writes.

### 4.11 UI (`components/`, `app/`)
- **Layout:** left rail (server/channel list, user panel, minimized call widget), main section (routes or fullscreen voice panel), right rail (members), mobile bottom nav (Channels/Chat/Members/Call).
- **Chat:** `MessageComposer` (autocomplete, typing indicators, drag-drop/paste file upload, emoji + GIF pickers, mention dropdown with arrow-key nav), `MessageList`, `MessageItem` (edit/delete/reactions/attachments/embeds/mention pills → profile popup), `CustomEmojiRenderer`, `EmojiPicker`, `GifPicker`, `TypingIndicator`, `GlobalUnreadWatcher`.
- **Voice:** `VoicePanel` (participant grid, controls, admin kick context menu), `VoiceMiniPanel` (minimized call), `VoiceParticipantCard`, `VoiceControls`. The voice panel **never unmounts** while a call is active — CSS controls visibility so WebRTC + audio stay alive when minimized or navigating.
- **Auth pages:** login, signup, forgot-password.
- **Settings:** profile (avatar, bio), appearance (theme).

---

## 5. Security model

All enforcement is in `firestore.rules`:

- **Auth required** for every collection read.
- **Ownership or admin** for writes: messages (sender/admin), channels (creator/admin), users (self/admin), notifications (recipient), customEmojis (uploader/admin).
- **Admin** is a boolean field on the user doc. There is no server-side admin check — `isAdmin` is the only gate, and it's set client-side at signup.
- **Soft delete** for users: `isDeleted` flag, username → "Deleted User", email removed. Uid references stay valid, so messages and DMs from deleted users still resolve.
- **File uploads** go to Cloudinary via an unsigned upload preset — size/type validation is client-side only (`validateFile`), with no server enforcement.
- **Voice panel never unmounts** while a call is active — CSS controls visibility so WebRTC + audio stay alive when minimized or navigating.
- **Vercel** sets `Permissions-Policy: camera=*, microphone=*, display-capture=*` and rewrites all routes to `index.html`.

Known weak points: no rate limiting, no server-side validation, admin flag is client-settable in principle (only the hardcoded `lioneltest` signup path grants it today), and file limits are enforced in JS only.

---

## 6. Real-time & presence model

- **Messages:** Firestore `onSnapshot` per channel/DM, ordered ascending. No polling.
- **Presence:** RTDB heartbeat (30s) + TTL (90s online / 5min idle) + `onDisconnect` + `.info/connected` reconnect + `visibilitychange` pause. This survives tab close, power loss, network cuts, mobile backgrounding, crashes, and long idle.
- **Voice participants:** dual source — Firestore `voiceChannels/{id}.participants` (source of truth for the sidebar) and RTDB `voicePresence` (instant hard-disconnect detection). The panel reconciles both.
- **Signaling:** Firestore `signaling` collection, read-then-delete per message. No ordering index; client sorts by timestamp.

---

## 7. Voice: WebRTC mesh + Perfect Negotiation

`src/features/voice/webrtc.ts` — `WebRTCManager`, one instance per voice panel.

- **Topology:** P2P mesh. Every peer connects to every other peer. Each client uploads its stream to every other participant.
- **Scale ceiling:** quality degrades past ~4 participants (bandwidth per client grows linearly). An SFU (LiveKit, etc.) would fix this — explicitly listed as out of scope.
- **Perfect Negotiation:** both peers respond to `onnegotiationneeded` by sending offers. The peer with the **lexicographically smaller userId is "polite"** — on offer collision it rolls back and accepts the other's offer; the "impolite" peer ignores the colliding offer. This removes the glare race without a central server.
- **ICE candidates** are queued when they arrive before `setRemoteDescription`, then drained immediately after.
- **Track management:** `replaceTrack` when a video sender already exists (no renegotiation); `addTrack` + renegotiation otherwise. Screen share is associated with `localStream` (not `screenStream`) so the remote receives video in the same stream as audio — otherwise audio goes silent.
- **ICE servers:** Google STUN + free TURN (openrelay.metered.ca, port 80/443/TCP, no credentials).
- **Auto-restart:** `onconnectionstatechange` calls `restartIce()` on failure.
- **Audio:** Web Audio filter chain for the walkie-talkie/drive-thru effect on incoming voice.

---

## 8. Non-functional characteristics

- **Latency:** Firestore real-time updates are near-instant; WebRTC is direct P2P where NAT allows, TURN-relayed otherwise.
- **Offline:** none. Authenticated, online, same Firebase project.
- **Storage:** client-side only — `localStorage` for theme, typing, cached user, and base64 backgrounds (near the 5MB limit).
- **Build:** `tsc --noEmit` → `vite build`. CI runs typecheck + tests + build on every push (Node 22, `npm ci`).
- **Tests:** Vitest. Currently 3 files covering `mentions`, `unreadStore`, `detectEmbeds`. No React component tests.
- **Deploy:** Vercel, SPA rewrite, `Permissions-Policy` header, `VITE_*` env vars injected at build.

---

## 9. Out of scope (documented, not built)

- Push notifications when the app is closed (needs FCM).
- Invite links with expiry.
- Channel permissions (read-only announcement channels).
- SFU for voice beyond ~4 participants.
- Server-side search indexing (Algolia/Typesense) for larger servers.
- IndexedDB instead of localStorage for custom backgrounds.
- Mobile push / background notification handling beyond the presence heartbeat.
