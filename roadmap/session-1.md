### ✅ SESSION 1: Broken Platform Setup
**Status:** ⬜ Not Started | ⬜ In Progress | ✅ Complete

**Goal:** Create the locked initial state that forces users to fix the platform before they can learn.

**Components to Build:**
- [x] Project scaffold (package.json, tsconfig, vite config)
- [x] Broken `backend/src/setup/init.ts` file with intentional errors:
  - [x] Missing environment variable checks (=== null vs undefined bug)
  - [x] Incomplete auth initialization (accepts 1-char secret instead of 32+)
  - [x] Database connection setup (missing fs.mkdirSync before SQLite open)
  - [x] API key validation (inverted startsWith logic with === false)
- [x] `.env.example` with placeholder values
- [x] `frontend/src/components/LockedScreen.tsx`:
  - [x] Shows error message from failed init
  - [x] Displays file path to fix (`backend/src/setup/init.ts`)
  - [x] Gives hints about what's broken (expandable per-error hints)
  - [x] Has a "Retry" button (calls /api/retry-init, no restart needed)
- [x] `README.md` explaining:
  - [x] What this project is
  - [x] How to get started
  - [x] What you'll learn
  - [x] First steps to unlock the platform
- [x] Basic Express server that checks if init is complete
- [x] Simple React app that shows locked/unlocked state

**What Users Fix:**
1. Read the error messages
2. Open `backend/setup/init.ts`
3. Fix TODO blocks:
   - Add proper environment variable validation
   - Complete auth setup
   - Fix database connection
   - Implement API key check
4. Create `.env` from `.env.example`
5. Add their Claude API key
6. Restart server → platform unlocks

**What Users Learn:**
- How to read error messages
- Environment variable configuration
- Basic debugging
- Project structure navigation
- Development environment setup

**Success Criteria:**
- Running `npm install && npm start` shows locked screen
- Platform displays clear error about what's broken
- After fixing `init.ts` and adding `.env`, platform unlocks
- User sees success message and can access main interface

**Technical Details:**
- Use Vite for fast frontend dev
- Express serves both API and frontend in dev
- Simple health check endpoint: `/api/status`
- Frontend polls `/api/status` to check if unlocked