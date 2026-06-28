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

## Weekend Sprint — Full Roadmap

### Phase 1: DGX Chunking
- [ ] Dispatch DGX chunking for 18 NICE guidelines
- [ ] Dispatch DGX chunking for SIGN (Scottish) guidelines
- [ ] Dispatch DGX chunking for BTS (British Thoracic Society) guidelines
- [ ] Dispatch DGX chunking for RCGP curriculum and MRCGP exam scenarios
- [ ] Ingest all new chunks into pgvector on Railway

### Phase 2: Microphone Fix
- [x] Fix microphone button using Web Speech API (browser-native, works on mobile/slow devices)
- [x] Show live transcript as user speaks
- [x] Auto-send transcript on speech end with manual override
- [x] Graceful fallback if browser does not support Web Speech API

### Phase 3: 100+ New Scenarios
- [x] 30 acute presentation scenarios (NICE, SIGN, BTS)
- [x] 25 chronic disease management scenarios
- [x] 15 multimorbidity/CVRM scenarios
- [x] MRCGP/CSA-style exam scenarios
- [x] Scottish guidelines (SIGN) scenarios
- [x] BTS respiratory scenarios
- [x] Update scenario seeding in routers.ts (105 total scenarios)
- [x] Add mode (receptionist/clinician) and clinicalSystem fields to schema
- [x] Add mode filter tabs to Scenarios page
- [x] Add clinical system filter to Scenarios page

### Phase 4: TTS Patient Voice
- [x] Auto-play patient response audio using browser Web Speech API (speechSynthesis)
- [x] British English voice preference (en-GB)
- [x] Add mute/unmute toggle in roleplay UI
- [ ] DGX XTTS-v2 upgrade (future - requires DGX API endpoint)

### Phase 5: Static Scenario Avatars
- [ ] Generate age/gender-matched avatar per scenario via DGX
- [ ] Store avatar URLs in scenarios table
- [ ] Display avatar in roleplay UI

### Phase 6: Progress Dashboard & Admin Panel
- [x] Learner history page with scores and grades
- [x] Mode filter tabs (Receptionist/Clinician) on History page
- [x] Mode badges on session history items
- [x] Admin panel for Dr Jahan (view all learner scores)
- [x] Mode filter tabs on Admin sessions panel
- [x] Role-based access: admin role for Dr Jahan
- [ ] Domain heatmap showing weakest RCGP domains (future)

### Phase 7: Deploy & Verify
- [x] Push all changes to GitHub
- [ ] Verify Railway deployment
- [ ] Run end-to-end smoke test
- [ ] Deliver final status report

### Google Review Requirement (added 27 Jun 2026)
- [x] Add Google Review as a required competency in the scoring engine (6th competency for all scenarios)
- [x] Update AI patient chat system prompt to expect the trainee to offer a Google Review link at the end
- [x] Update scoring evaluation prompt to mark Google Review offer as required (pass/fail)
- [x] Update Roleplay.tsx to show personalised Google Review link and £5 voucher reminder at session end
- [x] Ensure the Google Review message includes the staff member's name
- [x] Add googleReviewOffer column to scores table (DB migration applied)
- [x] Update Scorecard.tsx to display Google Review Offer as 6th competency
- [x] Google Review URL: https://g.page/r/CemedDs5bp4FEBM/review

### Pharmacist Tier (added 27 Jun 2026)
- [ ] Scrape Flexylen Scribe rule library (all rule IDs, trigger conditions, citations)
- [x] Add 'pharmacist' to mode enum in schema + DB migration (0004_scenarios_mode_pharmacist)
- [x] Add 25 pharmacist roleplay scenarios (structured medication reviews, DMARD, anticoagulation, NMS, STOPP/START, MHRA alerts, Pharmacy First)
- [x] Add GPhC-aligned competency scoring (6 competencies for pharmacist mode: Listening, Medication Review Quality, Clinical Safety, Communication, Deprescribing, Google Review)
- [x] Build pre-consultation crib sheet generator page (/crib-sheet/:scenarioId)
- [x] Add cribSheet.generate tRPC procedure (pharmacist/GP/receptionist mode-specific prompts)
- [x] Add 'Prep Crib Sheet First' button to every scenario card in Scenarios page
- [ ] Implement rule-based engine (STOPP/START v3, MHRA drug safety alerts, NICE monitoring, BNF interactions)
- [ ] Add per-drug review generator (adherence, efficacy, side effects, monitoring)
- [ ] Add deprescribing suggestions (STOPP/START v3 criteria)
- [ ] Add evidence citations (BNF, NICE CKS, SPS, MHRA DSU, emc, Renal Drug DB)
- [ ] Add governance audit log page (/audit-log)
- [ ] Add CPD/revalidation draft generator (GPhC-aligned)
- [x] Update Scenarios page to show Pharmacist tab alongside Receptionist and GP
- [x] Update History page to show Pharmacist mode stats
- [x] Update Admin panel to show Pharmacist sessions
- [x] Rename 'Clinician' mode to 'GP' throughout the codebase (DB migration + frontend)

### Call Audit — Dual Upload Enhancement (added 28 Jun 2026)
- [ ] Add call type selector (Clinical Consultation / Telephone Triage / Admin/Registration) to upload step
- [ ] Add second upload zone for medical record screenshot (PNG, JPG, PDF, max 10 MB)
- [ ] Update callAudit schema to store medicalRecordBase64 and callType fields
- [ ] Update callAudit router: accept base64 image in uploadAndTranscribe, pass to evaluateTranscript
- [ ] Update evaluateTranscript to use vision LLM to read the medical record screenshot and cross-reference with audio transcript
- [ ] Update AI prompt to adapt criteria based on call type (clinical vs admin)
- [ ] Update CallAudit.tsx frontend to show two upload zones and call type selector
- [ ] Add medical record cross-reference section to scorecard
- [ ] Push to GitHub and deploy to Railway
