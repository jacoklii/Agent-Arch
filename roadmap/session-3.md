### ✅ SESSION 3: Agent Template + Dashboard
**Status:** ⬜ Not Started | ⬜ In Progress | ✅ Complete

**Goal:** Create a starter agent with intentional TODOs and a dashboard to visualize agent activity in real-time.

**Components to Build:**

#### Agent Template (`src/agents/task-automator/`)
- [x] `index.ts` - Main agent loop:
  - [x] Receives input (from API or CLI)
  - [x] Calls intent classifier
  - [x] Routes to appropriate tool
  - [x] Saves to memory
  - [x] Returns response
  - [x] (Loop has working skeleton but calls incomplete functions)
- [x] `core/intent.ts`:
  - [x] Type definitions for intents
  - [x] `// TODO: Implement classifyIntent()` function
  - [x] Stub that returns "UNKNOWN"
  - [x] Comments explaining what it should do
- [x] `core/memory.ts`:
  - [x] Interface for Memory operations
  - [x] `// TODO: Implement save(), retrieve(), clear()`
  - [x] Empty functions with type signatures
- [x] `tools/email.ts`:
  - [x] `// TODO: Implement sendEmail()`
  - [x] `// TODO: Implement readEmails()`
  - [x] MCP tool structure outlined
- [x] `tools/calendar.ts`:
  - [x] `// TODO: Implement addEvent()`
  - [x] `// TODO: Implement listEvents()`
- [x] `tests/intent.test.ts`:
  - [x] Tests that currently FAIL
  - [x] Clear expected behavior
- [x] `tests/memory.test.ts`:
  - [x] Tests that currently FAIL

#### Agent Dashboard (`frontend/components/AgentViewer.tsx`)
- [x] Real-time agent status display:
  - [x] Current state (idle/thinking/acting)
  - [x] Last action taken
  - [x] Memory state viewer
  - [x] Tool calls log
  - [x] Error display
- [x] Agent control panel:
  - [x] Start/stop agent
  - [x] Send test input
  - [x] Clear memory
  - [x] View logs
- [x] WebSocket connection for live updates

#### Agent Runtime (`backend/agent-runtime/`)
- [x] `executor.ts`:
  - [x] Loads user's agent code
  - [x] Runs the agent loop
  - [x] Broadcasts activity to dashboard
  - [x] Handles errors gracefully
  - [x] Logs all actions

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
