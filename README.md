# IDES — Interactive Digital Engagement System
## Donor Summit on MSME Transformation

A real-time interactive platform for summit engagement, enabling live Q&A, feedback, voice notes, and post-event analytics.

## Quick Start

### Prerequisites
- Node.js 18+
- Azure SQL Database (or update Prisma schema for your DB)

### 1. Backend Setup
```bash
cd backend
npm install
# Edit .env with your Azure SQL connection string
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed   # Seeds demo data
npm run dev           # Starts on port 5000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev           # Starts on port 3000
```

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@summit.org | admin123 |
| Moderator | moderator@summit.org | moderator123 |
| Speaker | speaker1@summit.org | speaker123 |
| Participant | *(Guest — just enter your name)* | — |

### Architecture
- **Frontend**: Next.js 15 (App Router, TypeScript)
- **Backend**: Express + Socket.IO (TypeScript)
- **Database**: Azure SQL via Prisma ORM
- **Real-time**: Socket.IO for live Q&A, upvoting, notifications

### Routes
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/join` | Guest participant entry (name only) |
| `/login` | Staff login (speaker/moderator/admin) |
| `/agenda` | Session agenda timeline |
| `/session/:id` | Live session interaction (Q&A, feedback) |
| `/moderator` | Moderator/Speaker dashboard |
| `/admin` | Admin analytics & session management |
