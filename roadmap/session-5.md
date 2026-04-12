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