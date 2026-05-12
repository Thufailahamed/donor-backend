# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: IDES — Interactive Digital Engagement System

Real-time summit engagement platform for live Q&A, feedback, voice notes, and post-event analytics. Event: Donor Summit on MSME Transformation (May 14 2026, Colombo).

## Commands

### Backend (`cd backend`)
```bash
npm run dev              # ts-node-dev on port 5000, auto-restart
npm run build            # tsc compile to dist/
npx prisma generate      # regenerate client after schema changes
npx prisma migrate dev --name <desc>  # create + apply migration
npm run prisma:seed      # seed demo data (clears existing)
```

### Frontend (`cd frontend`)
```bash
npm run dev              # Next.js dev on port 3000
npm run build            # production build
npm run lint             # eslint
```

## Architecture

**Monorepo with separate backend/frontend.** No shared package — types duplicated in `frontend/src/types/index.ts`.

### Backend — Express + Socket.IO + Prisma (TypeScript)
- **Entry:** `backend/src/server.ts` — Express app, HTTP server, Socket.IO wired together. Exports `prisma` client and `io` instance (imported by routes).
- **Routes:** `backend/src/routes/*.routes.ts` — each resource has its own router. All mounted under `/api/` prefix.
- **Middleware:** `backend/src/middleware/` — `authenticate` (JWT, required), `optionalAuth` (JWT, optional for guests), `requireRole(...roles)` (role-based guard).
- **Socket.IO:** `backend/src/services/socket.service.ts` — manages connection maps, session rooms (`session:<id>`), participant counts. Routes call `broadcastToSession()` to emit real-time events.
- **Auth flow:** JWT tokens. Staff login (email+password). Guest login (name only, auto-creates user with `isGuest: true`). Token stored client-side in localStorage.
- **DB:** SQLite via Prisma (dev). Schema designed for Azure SQL in production (change provider in `schema.prisma`).

### Frontend — Next.js 15 App Router + React 19 (TypeScript)
- **Pages:** `frontend/src/app/` — landing (`/`), join (`/join`), login (`/login`), agenda (`/agenda`), live session (`/session/[sessionId]`), moderator dashboard (`/moderator`), admin analytics (`/admin`), speaker view (`/speaker`).
- **Auth:** `frontend/src/lib/auth-context.tsx` — React context wrapping `guestLogin` and `adminLogin`. Restores session from localStorage. Connects Socket.IO on login.
- **API client:** `frontend/src/lib/api-client.ts` — axios instance, auto-attaches JWT and user-id headers from localStorage.
- **Socket:** `frontend/src/lib/socket.ts` — singleton Socket.IO client, lazy connect, `joinSession`/`leaveSession` helpers.
- **Next.js version:** 16.x — has breaking changes from training data. Check `node_modules/next/dist/docs/` before using unfamiliar APIs.

## Key Real-time Events (Socket.IO)

| Event | Direction | Payload |
|-------|-----------|---------|
| `identify` | Client→Server | `{ userId, name, role }` |
| `join-session` / `leave-session` | Client→Server | `{ sessionId }` |
| `new-question` | Server→Session room | Full question object |
| `question-upvoted` | Server→Session room | `{ questionId, upvoteCount, userId, action }` |
| `question-status-changed` | Server→Session room | `{ questionId, status }` |
| `participant-count` | Server→Session room | `{ sessionId, count }` |

## Data Model (Prisma)

Core entities: `User` (4 roles: PARTICIPANT/SPEAKER/MODERATOR/ADMIN), `Session` (with day/order for agenda timeline), `Question` (status lifecycle: PENDING→ANSWERED/HIGHLIGHTED/DISMISSED), `QuestionUpvote` (unique per user+question), `Feedback` (rating+text), `VoiceNote`, `Content` (session materials), `Notification`. Many-to-many between Session and User via `SessionSpeaker`.

## Env Config

Root `.env` has template with placeholder values. Backend reads `DATABASE_URL`, `JWT_SECRET`, `BACKEND_PORT`, `FRONTEND_URL`. Frontend reads `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`.

## Seed Data

`npm run prisma:seed` creates admin, moderator, 3 speakers, and 14 sessions matching the real summit agenda. Credentials in README.md.
