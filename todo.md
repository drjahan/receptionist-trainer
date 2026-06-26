# GP Receptionist AI Trainer - TODO

## Database & Backend
- [x] Add scenarios, sessions, messages, scores tables to drizzle/schema.ts
- [x] Run migration and apply SQL
- [x] Add DB helpers in server/db.ts
- [x] Add scenarios router (list, get by id)
- [x] Add sessions router (create, get, list by user, list all for admin)
- [x] Add messages router (add message, get by session)
- [x] Add AI patient chat endpoint (sends message to LLM as patient persona)
- [x] Add scoring engine endpoint (evaluates transcript, returns competency scores)
- [x] Add admin router (all sessions, all users, team stats)

## Frontend Pages
- [x] Update index.css with elegant design tokens (NHS-inspired navy + clean whites)
- [x] Update App.tsx with all routes and DashboardLayout
- [x] Build Home/Landing page with GP Pathfinder Clinics branding
- [x] Build Scenario Library page (browsable cards)
- [x] Build Roleplay Chat Interface page
- [x] Build Scorecard Results page
- [x] Build Session History page (personal)
- [x] Build Admin Dashboard page

## Polish & Testing
- [x] Write vitest tests for scoring engine
- [x] Ensure all 5 competency labels are exact
- [x] Responsive design check
- [x] Save checkpoint

## Standalone Auth (Railway Deployment)
- [ ] Update users table with email/password hash fields in schema
- [ ] Build standalone auth endpoints (register, login, me, logout) using bcrypt + JWT
- [ ] Remove Manus OAuth dependency from server
- [ ] Build standalone Login and Register pages on frontend
- [ ] Update useAuth hook to use standalone JWT auth
- [ ] Update AppLayout navigation for standalone auth
- [ ] Run DB migration on Railway MySQL
- [ ] Redeploy to Railway and verify full flow
- [ ] Test full receptionist training journey end-to-end

## Phase 1 — Graphical Grading & Progress Tracking
- [ ] Recalibrate grading thresholds (A+=4.7+, A=4.3-4.69, B=3.7-4.29, C=3.0-3.69, D=<3.0)
- [ ] Rebuild scorecard page with animated radar/spider chart (5 competencies)
- [ ] Add ring gauge for overall grade display with colour coding
- [ ] Add animated competency progress bars on scorecard
- [ ] Build individual progress dashboard (/history) with line chart of score over time
- [ ] Add bar chart comparing average score per competency across all sessions
- [ ] Add session stats: total sessions, streak counter, most improved competency
- [ ] Push all Phase 1 changes to GitHub and redeploy to Railway

## Clinician Mode
- [x] Ingest 122 NICE clinical guideline chunks into Railway pgvector (DGX Phase 1 complete)
- [x] Add `mode` column to scenarios table (receptionist | clinician)
- [x] Seed 6 clinical consultation scenarios in routers.ts
- [x] Update scenarios list endpoint to return mode field
- [x] Update Scenarios page with Receptionist / Clinician mode tabs
- [x] Update Roleplay page with mode-aware labels (Clinician / Patient, consultation framing)
- [x] Update scoring engine to use clinical RAG context for clinician sessions
- [x] Update scoring prompt for clinician mode (clinical reasoning, NICE adherence, safety-netting)
- [x] Push Clinician Mode to GitHub → Railway auto-deploy (commit e6c0e18)

## RCGP Clinician Mode — Phase 2 (Full Framework)

### Architecture & Design
- [ ] Define scenario taxonomy: 10 clinical systems × 3 complexity tiers = 30 base scenarios
- [ ] Define RCGP scoring domains: ICE, cue detection, comorbidity reasoning, documentation quality
- [ ] Design clinical notes DB schema (session_notes table)

### Scenario Generation Engine
- [ ] Add clinicalSystem and complexityTier fields to scenarios table
- [ ] Seed 30+ scenarios across: UTI, Chest Pain, Abdominal Pain, Respiratory, Mental Health, Cardiovascular, MSK, Dermatology, Neurology, Paediatrics
- [ ] Each system has: Simple / Moderate / Complex tiers with embedded comorbidity traps

### Clinical Documentation Feature
- [ ] Add session_notes table (sessionId, noteText, submittedAt, feedback)
- [ ] Add SOAP notes editor panel in Roleplay UI (alongside chat)
- [ ] Add "Submit Notes" button that saves notes to DB
- [ ] Include submitted notes in scoring evaluation context

### RCGP Scoring Engine Upgrade
- [ ] Expand to 7 scored domains (from 5):
  - Active Listening & Empathy
  - ICE Elicitation (Ideas, Concerns, Expectations — explicitly scored)
  - Cue Detection (verbal/non-verbal patient cues)
  - Clinical Reasoning & Information Gathering
  - NICE Guideline Adherence
  - Communication Clarity & Safety-Netting
  - Documentation Quality (if notes submitted)
- [ ] Update scorecard page to display all 7 domains
- [ ] Update DB scores table with new domain columns

### Push & Deploy
- [ ] Push all Phase 2 changes to GitHub → Railway auto-deploy

## Google OAuth Migration (replace Manus OAuth)
- [x] Receive Google OAuth Client ID and Client Secret from Dr Jahan
- [x] Install googleapis package
- [x] Build /api/oauth/google (redirect) and /api/oauth/google/callback routes
- [x] Update frontend getLoginUrl() to point to /api/oauth/google
- [x] Update ManusDialog login button text to "Sign in with Google"
- [x] Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Railway environment variables
- [x] Push to GitHub (commit 4fc1336) — Railway auto-deploying
