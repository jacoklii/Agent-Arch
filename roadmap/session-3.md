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
