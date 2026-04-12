### ✅ SESSION 4: Curriculum Content
**Status:** ⬜ Not Started | ⬜ In Progress | ✅ Complete

**Goal:** Write comprehensive lessons and exercises that teach agentic AI concepts through building the task automator.

**Concepts to Cover (7 total):**

#### [x] 1. What is an AI Agent?
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

#### [x] 2. MCP & Tool Calling
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

#### [x] 3. Memory & Context Management
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

#### [x] 4. Multi-step Reasoning
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

#### [x] 5. Error Handling & Retries
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

#### [x] 6. Connecting External Services
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

#### [x] 7. Deployment & Production
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
- [x] Clear explanation with diagrams (use ASCII or Mermaid)
- [x] Real code examples
- [x] 2-3 quiz questions
- [x] Link to specific files in agent template
- [x] Hints for implementation
- [x] "Deep dive" sections for advanced topics

**Exercises Should Have:**
- [x] Clear objective
- [x] Starting point (which file, what to implement)
- [x] Expected outcome
- [x] Test criteria
- [x] Hints (not solutions!)
- [x] Recommendation: "Use Claude Code for this" or "Try yourself first"

**Success Criteria:**
- ✅ All 7 concepts written and polished
- ✅ Each has quizzes and exercises
- ✅ Exercises map to agent template TODOs
- ✅ Progressive difficulty (builds on previous concepts)
- ✅ Engaging and conversational tone
