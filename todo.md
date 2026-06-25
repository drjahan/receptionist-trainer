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
