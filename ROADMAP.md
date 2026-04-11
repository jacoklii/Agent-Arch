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
agent-academy/
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

## 📋 Development Sessions

### ✅ SESSION 1: Broken Platform Setup
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Goal:** Create the locked initial state that forces users to fix the platform before they can learn.

**Components to Build:**
- [ ] Project scaffold (package.json, tsconfig, vite config)
- [ ] Broken `backend/setup/init.ts` file with intentional errors:
  - [ ] Missing environment variable checks
  - [ ] Incomplete auth initialization
  - [ ] Database connection setup (but connection string is wrong)
  - [ ] API key validation (but validation logic is broken)
- [ ] `.env.example` with placeholder values
- [ ] `frontend/components/LockedScreen.tsx`:
  - [ ] Shows error message from failed init
  - [ ] Displays file path to fix (`backend/setup/init.ts`)
  - [ ] Gives hints about what's broken
  - [ ] Has a "Retry" button
- [ ] `README.md` explaining:
  - [ ] What this project is
  - [ ] How to get started
  - [ ] What you'll learn
  - [ ] First steps to unlock the platform
- [ ] Basic Express server that checks if init is complete
- [ ] Simple React app that shows locked/unlocked state

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

---

### ⬜ SESSION 2: Teaching Assistant Interface
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Goal:** Build a chat interface where the AI teaching assistant can guide users through learning and building.

**Components to Build:**
- [ ] `frontend/components/AssistantChat.tsx`:
  - [ ] Message input box
  - [ ] Chat history display
  - [ ] Streaming response support
  - [ ] Code block rendering
  - [ ] Markdown support
  - [ ] "Choose your agent" selection UI
- [ ] `frontend/components/ConceptViewer.tsx`:
  - [ ] Displays curriculum markdown
  - [ ] Syntax highlighting for code examples
  - [ ] Quiz/question rendering
  - [ ] Navigation between concepts
- [ ] `backend/assistant-service/chat-handler.ts`:
  - [ ] Receives user messages
  - [ ] Calls Claude API with conversation history
  - [ ] Streams responses back to frontend
  - [ ] Maintains conversation context
  - [ ] Has system prompt for teaching assistant personality
- [ ] `backend/assistant-service/curriculum-loader.ts`:
  - [ ] Reads markdown files from `/curriculum`
  - [ ] Parses frontmatter (title, order, prerequisites)
  - [ ] Provides curriculum to assistant context
  - [ ] Tracks which concepts user has viewed
- [ ] WebSocket or SSE for streaming responses
- [ ] Conversation history storage (in-memory for now)

**Teaching Assistant Personality:**
The assistant should:
- Explain concepts clearly with examples
- Ask Socratic questions to check understanding
- Challenge user's architectural decisions
- Adapt pace to user responses
- Provide hints without giving full solutions
- Encourage using Claude Code for complex tasks
- Quiz understanding before moving to next concept

**User Flow:**
1. Platform unlocks → sees welcome message
2. Assistant: "What kind of agent do you want to build?"
   - Task Automator
   - Research Assistant
   - Custom
3. User selects → Assistant explains what they'll learn
4. Assistant guides through curriculum concepts
5. After each concept, offers to move on or deep dive
6. When ready to build, assigns first coding task

**Success Criteria:**
- ✅ Can send messages and get streaming responses
- ✅ Assistant maintains conversation context
- ✅ Can display curriculum markdown with code highlighting
- ✅ Assistant can assign tasks and link to agent files
- ✅ Conversation feels natural and educational

**Technical Details:**
- Use Claude Sonnet 4.5 API
- System prompt defines teaching style
- Stream responses using SSE (Server-Sent Events)
- Store conversation in memory with timestamps
- Use `marked` or `react-markdown` for rendering

---

### ⬜ SESSION 3: Agent Template + Dashboard
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Goal:** Create a starter agent with intentional TODOs and a dashboard to visualize agent activity in real-time.

**Components to Build:**

#### Agent Template (`src/agents/task-automator/`)
- [ ] `index.ts` - Main agent loop:
  - [ ] Receives input (from API or CLI)
  - [ ] Calls intent classifier
  - [ ] Routes to appropriate tool
  - [ ] Saves to memory
  - [ ] Returns response
  - [ ] (Loop has working skeleton but calls incomplete functions)
- [ ] `core/intent.ts`:
  - [ ] Type definitions for intents
  - [ ] `// TODO: Implement classifyIntent()` function
  - [ ] Stub that returns "UNKNOWN"
  - [ ] Comments explaining what it should do
- [ ] `core/memory.ts`:
  - [ ] Interface for Memory operations
  - [ ] `// TODO: Implement save(), retrieve(), clear()`
  - [ ] Empty functions with type signatures
- [ ] `tools/email.ts`:
  - [ ] `// TODO: Implement sendEmail()`
  - [ ] `// TODO: Implement readEmails()`
  - [ ] MCP tool structure outlined
- [ ] `tools/calendar.ts`:
  - [ ] `// TODO: Implement addEvent()`
  - [ ] `// TODO: Implement listEvents()`
- [ ] `tests/intent.test.ts`:
  - [ ] Tests that currently FAIL
  - [ ] Clear expected behavior
- [ ] `tests/memory.test.ts`:
  - [ ] Tests that currently FAIL

#### Agent Dashboard (`frontend/components/AgentViewer.tsx`)
- [ ] Real-time agent status display:
  - [ ] Current state (idle/thinking/acting)
  - [ ] Last action taken
  - [ ] Memory state viewer
  - [ ] Tool calls log
  - [ ] Error display
- [ ] Agent control panel:
  - [ ] Start/stop agent
  - [ ] Send test input
  - [ ] Clear memory
  - [ ] View logs
- [ ] WebSocket connection for live updates

#### Agent Runtime (`backend/agent-runtime/`)
- [ ] `executor.ts`:
  - [ ] Loads user's agent code
  - [ ] Runs the agent loop
  - [ ] Broadcasts activity to dashboard
  - [ ] Handles errors gracefully
  - [ ] Logs all actions

**Agent Communication:**
- Agent runs in backend process
- Emits events: `agent:thinking`, `agent:tool_call`, `agent:response`, `agent:error`
- Dashboard subscribes via WebSocket
- Users can see exactly what their agent is doing

**Success Criteria:**
- ✅ Agent template has clear TODOs with type signatures
- ✅ Tests fail initially (before user implements)
- ✅ Dashboard shows agent activity in real-time
- ✅ Can start agent and send it test inputs
- ✅ Template is well-commented and educational

**Technical Details:**
- Use TypeScript for strong typing
- Agent runs as a child process or in-memory instance
- WebSocket for real-time updates (use `ws` library)
- Logs stored in SQLite for persistence
- Dashboard uses React hooks for real-time state

---

### ⬜ SESSION 4: Curriculum Content
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Goal:** Write comprehensive lessons and exercises that teach agentic AI concepts through building the task automator.

**Concepts to Cover (7 total):**

#### [ ] 1. What is an AI Agent?
**Content:**
- Definition: Agent vs. chatbot vs. assistant
- The agentic loop: Perceive → Reason → Act
- When to use agents (automation, complex tasks, ongoing processes)
- When NOT to use agents (simple Q&A, one-off tasks)
- Examples of real-world agents
- Architecture overview

**Quiz Questions:**
- "What's the key difference between a chatbot and an agent?"
- "Name a task better suited for an agent than a simple prompt"

**Links to Code:**
- Point to `src/agents/task-automator/index.ts` to see the loop

---

#### [ ] 2. MCP & Tool Calling
**Content:**
- What is Model Context Protocol (MCP)?
- How tools extend agent capabilities
- Tool schema definition
- Tool selection strategies
- Error handling in tool calls
- Building custom tools

**Code Examples:**
```typescript
// Example tool definition
const emailTool = {
  name: "send_email",
  description: "Send an email to a recipient",
  parameters: { ... }
}
```

**Exercise:**
- Implement `tools/email.ts` basic structure
- Test tool calling with a mock

**Quiz:**
- "Why does an agent need tools?"
- "What happens if a tool call fails?"

---

#### [ ] 3. Memory & Context Management
**Content:**
- Short-term vs. long-term memory
- Context window limitations
- Memory storage strategies (SQLite, Redis, vector DBs)
- When to forget vs. when to remember
- Retrieval strategies
- Memory compression techniques

**Exercise:**
- Implement `core/memory.ts` with SQLite
- Create CRUD operations for tasks
- Test memory persistence

**Code Template:**
```typescript
interface Memory {
  save(key: string, value: any): Promise<void>;
  retrieve(key: string): Promise<any>;
  clear(): Promise<void>;
}
```

---

#### [ ] 4. Multi-step Reasoning
**Content:**
- Breaking complex tasks into steps
- Chain-of-thought prompting
- Planning vs. reacting
- Handling task dependencies
- Self-correction and replanning
- Dealing with ambiguity

**Exercise:**
- Implement task decomposition in agent
- Handle: "Schedule a meeting with John next week about the project"
  - Check calendar
  - Find free slot
  - Send email invite
  - Add to calendar

**Quiz:**
- "How should an agent handle: 'Remind me to do X later'?"

---

#### [ ] 5. Error Handling & Retries
**Content:**
- Graceful failure strategies
- Retry logic (exponential backoff)
- User feedback loops
- Logging and debugging
- Recovery mechanisms
- When to ask for help vs. when to fail

**Exercise:**
- Add error handling to all tools
- Implement retry logic for API calls
- Create user-friendly error messages

**Code Example:**
```typescript
async function withRetry(fn, maxAttempts = 3) {
  // Implement exponential backoff
}
```

---

#### [ ] 6. Connecting External Services
**Content:**
- API authentication patterns
- Rate limiting
- Webhooks and real-time updates
- Security considerations
- API key management
- OAuth flows

**Exercise:**
- Connect to Gmail API
- Connect to Google Calendar API
- Implement webhook receiver for real-time updates

---

#### [ ] 7. Deployment & Production
**Content:**
- Cloud vs. edge deployment
- Environment configuration
- Monitoring and observability
- Scaling considerations
- Cost optimization
- Security hardening

**Exercise:**
- Deploy agent to Railway/Render
- Set up environment variables
- Configure webhooks for local computer access
- Test production agent

---

**Each Concept Should Have:**
- [ ] Clear explanation with diagrams (use ASCII or Mermaid)
- [ ] Real code examples
- [ ] 2-3 quiz questions
- [ ] Link to specific files in agent template
- [ ] Hints for implementation
- [ ] "Deep dive" sections for advanced topics

**Exercises Should Have:**
- [ ] Clear objective
- [ ] Starting point (which file, what to implement)
- [ ] Expected outcome
- [ ] Test criteria
- [ ] Hints (not solutions!)
- [ ] Recommendation: "Use Claude Code for this" or "Try yourself first"

**Success Criteria:**
- ✅ All 7 concepts written and polished
- ✅ Each has quizzes and exercises
- ✅ Exercises map to agent template TODOs
- ✅ Progressive difficulty (builds on previous concepts)
- ✅ Engaging and conversational tone

---

### ⬜ SESSION 5: Code Review + Progress Tracking
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Goal:** Build systems that verify user progress and give meaningful feedback before allowing them to proceed.

**Components to Build:**

#### Test Runner (`backend/reviewer/test-runner.ts`)
- [ ] Execute tests for specific files
- [ ] Parse test results (pass/fail counts)
- [ ] Capture error messages and stack traces
- [ ] Return structured results to assistant
- [ ] Support for both unit and integration tests

**Features:**
```typescript
interface TestResult {
  file: string;
  passed: number;
  failed: number;
  errors: Array<{test: string, message: string}>;
  coverage?: number;
}
```

#### Code Analyzer (`backend/reviewer/code-analyzer.ts`)
- [ ] Read user's implementation files
- [ ] Check for basic patterns:
  - [ ] Proper error handling (try/catch blocks)
  - [ ] Type safety (no `any` types unless necessary)
  - [ ] Comments and documentation
  - [ ] Following project conventions
- [ ] Detect common anti-patterns
- [ ] Compare against optional solution (for hints)
- [ ] Generate feedback for assistant

**Analysis Checks:**
- Does the code have error handling?
- Are TypeScript types properly used?
- Are there obvious bugs or security issues?
- Does it follow the project structure?
- Is it readable and maintainable?

#### Progress Tracker (`backend/reviewer/progress-tracker.ts`)
- [ ] Manage checklist state (stored in SQLite)
- [ ] Mark tasks as complete/incomplete
- [ ] Track which concepts user has viewed
- [ ] Record quiz scores
- [ ] Calculate overall progress percentage
- [ ] Persist progress across sessions

**Progress Data:**
```typescript
interface Progress {
  userId: string;
  conceptsViewed: string[];
  tasksCompleted: string[];
  quizScores: Record<string, number>;
  currentTask: string | null;
  overallProgress: number;
}
```

#### Progress UI (`frontend/components/ProgressTracker.tsx`)
- [ ] Visual checklist of all tasks
- [ ] Progress bar (% complete)
- [ ] Current task highlighted
- [ ] Completed tasks marked with ✅
- [ ] Locked tasks shown as 🔒
- [ ] Expandable details for each task

**Verification Flow:**
1. User completes implementation
2. User clicks "Done" in chat or UI
3. Backend runs tests
4. Backend analyzes code
5. Backend generates feedback
6. Assistant receives results
7. Assistant decides: approve or request changes
8. If approved → mark task complete, unlock next
9. If not → give specific feedback, user tries again

**Assistant Integration:**
The assistant can call these functions:
- `runTests(file: string)` → Get test results
- `analyzeCode(file: string)` → Get code quality report
- `markComplete(task: string)` → Update progress
- `getProgress()` → See current state

**Success Criteria:**
- ✅ Tests run automatically when user claims completion
- ✅ Code analyzer catches common mistakes
- ✅ Assistant won't proceed without passing tests
- ✅ Progress persists across browser refreshes
- ✅ User can see clear checklist of what's done/remaining
- ✅ Feedback is specific and actionable

**Technical Details:**
- Use `child_process.exec()` to run npm test
- Parse Jest/Mocha output (JSON reporter)
- Store progress in SQLite with timestamps
- Use AST parsing for code analysis (optional, or regex patterns)
- Progress UI updates in real-time via WebSocket

---

### ⬜ SESSION 6: Polish & Final Integration
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Goal:** Fix rough edges, improve UX, handle edge cases, and make the platform production-ready for personal use.

**Polish Tasks:**
- [ ] Better error messages throughout
- [ ] Loading states and spinners
- [ ] Smooth transitions between screens
- [ ] Mobile responsiveness (nice to have)
- [ ] Dark mode support (optional)
- [ ] Improved code syntax highlighting
- [ ] Copy-to-clipboard for code blocks
- [ ] Keyboard shortcuts (e.g., Ctrl+Enter to send)

**Edge Cases to Handle:**
- [ ] What if user skips a lesson?
- [ ] What if tests fail but user insists on moving on?
- [ ] What if Claude API is down?
- [ ] What if user's code breaks the agent runtime?
- [ ] What if user deletes important files?
- [ ] Session timeout handling
- [ ] Network errors during streaming

**Small Features:**
- [ ] Export conversation history
- [ ] Reset progress (start over)
- [ ] Hint system (progressive hints, not full solution)
- [ ] "I'm stuck" button → assistant gives targeted help
- [ ] Link to Claude Code docs in relevant places
- [ ] Example of completed task (optional reference)

**Documentation:**
- [ ] Update README with screenshots
- [ ] Add troubleshooting section
- [ ] Document environment variables
- [ ] Create contribution guide (if open source)
- [ ] Add architecture diagram
- [ ] Write deployment guide

**Testing:**
- [ ] Manual QA of full user journey
- [ ] Test all exercises can be completed
- [ ] Verify progress tracking works correctly
- [ ] Check all error states display properly
- [ ] Test with different agent types
- [ ] Performance check (is it fast enough?)

**Success Criteria:**
- ✅ Platform feels polished and professional
- ✅ No major bugs or broken flows
- ✅ Clear documentation for setup
- ✅ Handles common errors gracefully
- ✅ Ready to share as open-source project

---

## 🎯 Overall Success Metrics

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

- [ ] **SESSION 1:** Broken Platform Setup
- [ ] **SESSION 2:** Teaching Assistant Interface
- [ ] **SESSION 3:** Agent Template + Dashboard
- [ ] **SESSION 4:** Curriculum Content
- [ ] **SESSION 5:** Code Review + Progress Tracking
- [ ] **SESSION 6:** Polish & Final Integration

**Current Session:** SESSION 1
**Started:** [Date]
**Estimated Completion:** [Date]

---

*Last Updated: [Current Date]*
*Next Review: After each session completion*