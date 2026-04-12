# Agent Arch - Project Development Roadmap

## Project Overview

**AGENT ARCH** is a learn-by-building platform where you teach yourself agentic AI concepts by building a real AI agent. The platform intentionally starts broken - you must fix it to unlock the teaching assistant, who then guides you through building your own personal AI agent (research assistant, task automator, or custom).

### Core Philosophy
- **Learning IS building** - No separation between theory and practice
- **Start locked** - Platform forces engagement from the first moment
- **Socratic teaching** - AI assistant challenges your decisions and asks YOU questions
- **Real utility** - Build an agent you'll actually use
- **Claude Code integration** - Learn when to code yourself vs. when to use AI assistance

---

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (simple, no setup)
- **Agent Runtime:** Node.js
- **AI:** Claude API (Sonnet 4.5)
- **Deployment:** Agent runs on cloud (Railway/Render/Fly.io), accesses local computer via webhooks + API

### Project Structure
```
agent-arch/
├── README.md                           # Project explanation
├── ROADMAP.md                          # This file
├── package.json
├── .env.example
│
├── frontend/                           # React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── LockedScreen.tsx       # Initial "Fix Me First" screen
│   │   │   ├── AssistantChat.tsx      # Teaching assistant interface
│   │   │   ├── AgentViewer.tsx        # Dashboard to watch agent
│   │   │   ├── ConceptViewer.tsx      # Displays lessons
│   │   │   └── ProgressTracker.tsx    # Checklist UI
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── backend/                            # Express server
│   ├── setup/
│   │   └── init.ts                    # BROKEN - user must fix
│   ├── assistant-service/
│   │   ├── chat-handler.ts            # Routes messages to Claude
│   │   └── curriculum-loader.ts       # Loads lesson content
│   ├── agent-runtime/
│   │   └── executor.ts                # Runs the user's agent
│   ├── reviewer/
│   │   ├── test-runner.ts             # Executes tests
│   │   ├── code-analyzer.ts           # Reviews code quality
│   │   └── progress-tracker.ts        # Manages completion state
│   └── server.ts
│
├── src/agents/                         # Agent templates
│   ├── task-automator/
│   │   ├── index.ts                   # Main agent loop (with TODOs)
│   │   ├── core/
│   │   │   ├── intent.ts              # TODO: Intent classification
│   │   │   └── memory.ts              # TODO: Memory system
│   │   ├── tools/
│   │   │   ├── email.ts               # TODO: Email integration
│   │   │   └── calendar.ts            # TODO: Calendar integration
│   │   └── tests/
│   │       ├── intent.test.ts
│   │       └── memory.test.ts
│   ├── research-assistant/             # Future template
│   └── custom/                         # Blank canvas
│
├── curriculum/                         # Learning content
│   ├── concepts/
│   │   ├── 01-what-is-an-agent.md
│   │   ├── 02-mcp-and-tools.md
│   │   ├── 03-memory-context.md
│   │   ├── 04-multi-step-reasoning.md
│   │   ├── 05-error-handling.md
│   │   ├── 06-external-services.md
│   │   └── 07-deployment.md
│   └── exercises/
│       ├── intent-classification.md
│       ├── memory-system.md
│       ├── email-integration.md
│       └── multi-step-task.md
│
└── docs/
    ├── claude-code-guide.md            # When/how to use Claude Code
    └── architecture.md                 # System design docs
```

---

## Development Sessions

- ✅ **SESSION 1**: Broken Platform Setup - /roadmap/session-1.md
- ✅ **SESSION 2**: Teaching Assistant Interface - /roadmap/session-2.md
- **SESSION 3**: Agent Template + Dashboard - /roadmap/session-3.md
- **SESSION 4**: Curriculum Content - /roadmap/session-4.md
- **SESSION 5**: Code Review + Progress Tracking - /roadmap/session-5.md
- **SESSION 6**: Polish & Final Integration - /roadmap/session-6.md

## Overall Success Metrics

**Project is complete when:**
- ✅ All 6 sessions are checked off
- ✅ A user can clone, unlock, and build a working agent
- ✅ All 7 curriculum concepts are taught
- ✅ Teaching assistant provides meaningful guidance
- ✅ Code review system works reliably
- ✅ Agent can perform real tasks (send emails, manage calendar, etc.)
- ✅ Documentation is clear and complete
- ✅ Project is on GitHub with proper README

**Personal Learning Goals:**
- ✅ Understand agentic AI architecture deeply
- ✅ Master Claude Code workflow
- ✅ Build something you'll actually use
- ✅ Have a portfolio piece to showcase

---

## 📝 Notes & Decisions

### Key Design Decisions:
- **Why SQLite?** Simple, embedded, no setup required
- **Why Node/Express?** Consistency across stack, familiar to most developers
- **Why cloud deployment?** Easier than local server, webhooks work better
- **Why webhooks + API?** Secure way for cloud agent to interact with local machine

### Future Enhancements (Post-MVP):
- [ ] More agent templates (research assistant, code reviewer, etc.)
- [ ] Community-shared agents
- [ ] Advanced curriculum (RAG, fine-tuning, etc.)
- [ ] Video walkthroughs
- [ ] Collaboration features (pair programming mode?)
- [ ] Analytics dashboard (time spent, concepts mastered, etc.)

### Open Questions:
- Should progress be shareable? (leaderboard, badges, etc.)
- Should there be a "guided mode" vs "free exploration mode"?
- How to handle updates to curriculum without breaking user progress?

---

## 🔄 Session Progress Tracker

- [x] **SESSION 1:** Broken Platform Setup
- [x] **SESSION 2:** Teaching Assistant Interface
- [ ] **SESSION 3:** Agent Template + Dashboard
- [ ] **SESSION 4:** Curriculum Content
- [ ] **SESSION 5:** Code Review + Progress Tracking
- [ ] **SESSION 6:** Polish & Final Integration

**Current Session:** SESSION 3
**Started:** 2026-04-11
**Session 1 Completed:** 2026-04-12
**Session 2 Completed:** 2026-04-12

---

*Last Updated: 2026-04-12 (Session 3 complete)*
*Next Review: After each session completion*