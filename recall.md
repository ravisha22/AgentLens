# AgentLens — Issues & Fix Tracker

> Written to survive context compaction. Update this file as issues are resolved.

---

## Issue 1 — Gauge freezes at historical peak after compaction

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Gauge stuck at 89% / 177K tokens even after context compaction drops the real context to ~109K.

**Root cause:** `Math.max` kept the highest token count ever seen. After compaction, new lower-token entries existed in the JSONL but were ignored.

**Fix applied in** `src/adapters/claudeCodeAdapter.ts` lines 346, 355:
```typescript
// Before:
meta.tokenUsage = Math.max(meta.tokenUsage, inputTokens);
meta.tokenUsage = Math.max(meta.tokenUsage, totalInput);

// After (latest entry wins — reflects actual current context):
meta.tokenUsage = inputTokens;
meta.tokenUsage = totalInput;
```

**Side effect fixed:** Gauge now correctly goes DOWN after compaction rather than freezing.

---

## Issue 2 — Model name displays as "Claude Sonnet 4" instead of "Claude Sonnet 4.6"

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** AgentLens status bar shows "Sonnet 4" when actual model is `claude-sonnet-4-6`.

**Root cause:** Generic regex `^claude-sonnet-4` was listed before specific `4.6`/`4.5` patterns — first match won.

**Fix in** `src/adapters/claudeCodeAdapter.ts` `beautifyModelName()` lines 65–70:
```typescript
{ regex: /^claude-sonnet-4[\.\-]6/i, name: 'Claude Sonnet 4.6' },  // specific first ✓
{ regex: /^claude-sonnet-4[\.\-]5/i, name: 'Claude Sonnet 4.5' },  // specific first ✓
{ regex: /^claude-sonnet-4/i,         name: 'Claude Sonnet 4' },    // generic fallback
```
Same ordering applied for Opus variants.

---

## Issue 3 — Color threshold boundaries

**Status:** ✅ FIXED — compiled 2026-03-03
**Request:** Green 0–59%, Amber 60–79%, Red 80%+.

**Previous:** Green (0–69%), Yellow (70–84%), Orange (85–94%), Red (95%+).

**Files changed:**

| File | Change |
|------|--------|
| `src/core/stateManager.ts:54` | `warning: 60, danger: 60, critical: 80` |
| `package.json:77–81` | All defaults updated to 60/60/80 |
| `src/test/__mocks__/vscode.ts:16` | Mock defaults updated to 60/60/80 |
| `webview-ui/src/index.css:9` | `--zone-orange: #F59E0B` (true amber, was `#f97316`) |

**How it works:** Setting `warning == danger == 60` skips the yellow zone — `classifyZone()` hits the `danger` check first at 60%, returning `'orange'` (amber). `critical: 80` triggers `'red'` at 80%+.

---

## Issue 4 — "Create Missing Docs" button always disabled

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** The "Create Missing Docs" button in the Documentation panel is disabled even when no agent is actively executing tasks. Should only be disabled when the agent is genuinely busy (thinking, executing, tool-calling, etc.).

**Root cause:** `isAgentBusy` in `webview-ui/src/components/docs/DocsPanel.tsx` lines 9–13:
```typescript
const isAgentBusy = agents.some(a =>
  a.sessions.some(s =>
    s.isActive && s.state !== 'idle' && s.state !== 'completed' && s.state !== 'failed' && s.state !== 'cancelled'
  )
);
```
The condition flags as busy whenever `isActive=true` AND state is anything other than terminal states. If a session gets stuck in a non-terminal state (e.g. `'thinking'`, `'executing'`) without transitioning back to `'idle'`, the button stays disabled permanently until extension reload.

**Fix needed in** `webview-ui/src/components/docs/DocsPanel.tsx` line 13 (button):
```typescript
// Current (wrong — always disabled when any session is stuck):
disabled={isAgentBusy}

// Fix option A — only disable on actively-working states:
const BUSY_STATES = ['thinking', 'executing', 'tool-calling', 'reading-files', 'writing-code', 'running-terminal'];
const isAgentBusy = agents.some(a =>
  a.sessions.some(s => s.isActive && BUSY_STATES.includes(s.state))
);
```

**Also investigate:** Whether `isActive` is being cleared correctly when a session ends. A stale `isActive=true` on a dead session would permanently block the button.

---

## Issue 5 — Documentation view does not refresh during poll cycle

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Docs panel shows files as "missing" even when they exist on disk. The view only updates on extension init or when user explicitly triggers "Create Missing Docs" / "Create Manifest". A README that gets created mid-session remains "missing" in the panel until extension reload.

**Root cause:** `poll()` in `src/core/stateManager.ts` does NOT call `docTracker.scan()`. Doc health is only scanned at initialization and on explicit create-doc user actions.

**Fix needed in** `src/core/stateManager.ts` — add `docTracker.scan()` (or equivalent) to the poll cycle, OR watch the manifest file for changes using a `vscode.workspace.createFileSystemWatcher`.

**Files to check:**
- `src/core/stateManager.ts` — `poll()` method, look for missing `docTracker.scan()` call
- `src/core/docHealthTracker.ts` — `scan()` method signature

---

## Issue 6 — Model name beautification: hardcoded patterns, no multi-provider support

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** `beautifyModelName()` used a hardcoded regex list. Any new Claude version (e.g. 4.7, 5.0) or other provider (OpenAI, Gemini, Grok, Mistral) would show the raw model ID.

**Fix in** `src/adapters/claudeCodeAdapter.ts` — replaced hardcoded patterns with a universal algorithm:
1. Strip 8-digit date suffix (`-20250514`) and 4-digit release tags (`-1219`)
2. Strip noise words (`latest`, `preview`, `stable`, `beta`, `exp`)
3. Vendor prefix table maps to display label (Claude, GPT, Gemini, Grok, Mistral, Llama, DeepSeek, Cohere…)
4. Walk remaining segments, merging consecutive numeric pairs into dotted versions (`4, 6 → 4.6`)
5. OpenAI o-series (`o1`, `o3`, `o4-mini`) handled as special case

Also added:
- `detectVendor()` — replaces hardcoded `'Anthropic'` vendor with auto-detection from model ID
- `beautifyModelFamily()` — extended to cover all providers
- `MODEL_SPECS` table — expanded with OpenAI, Gemini, Grok, Mistral specs + keyword fallback for unknowns

**Examples:**
| Model ID | Display name |
|---|---|
| `claude-sonnet-4-6-20260101` | Claude Sonnet 4.6 |
| `claude-opus-5-20270514` | Claude Opus 5 |
| `gpt-4o` | GPT 4o |
| `gemini-2-0-flash` | Gemini 2.0 Flash |
| `grok-3-mini` | Grok 3 Mini |
| `mistral-large-latest` | Mistral Large |
| `mistral-7b-instruct` | Mistral 7B Instruct |
| `o3-mini` | o3 Mini |
| `llama-3-70b-instruct` | Llama 3 70B Instruct |

---

## Issue 7 — Session mode displayed as bare "Edit" (looked like an edit button)

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Context Window and Agent panels showed `· Edit` next to the model info, which users could mistake for an interactive edit button.

**Fix in** `src/adapters/claudeCodeAdapter.ts` line 464:
```typescript
// Before:
mode = likelyAuto ? 'Edit (auto)' : 'Edit';

// After:
mode = likelyAuto ? 'Edit mode (auto)' : 'Edit mode';
```
Now displays as `· Edit mode` or `· Edit mode (auto)`. Future mode types (Plan mode, Ask mode) should follow the same `'{Name} mode'` pattern.

---

## Issue 8 — Tooltip text is centre-aligned, should be justified

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** All InfoTooltip popups render text centred. Should be left-justified (ragged-right, full-width).

**Fix in** `webview-ui/src/components/layout/Section.tsx` — add `textAlign: 'justify'` to the tooltip span style.

---

## Issue 9 — Files tooltip is inaccurate and incomplete

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Files section tooltip described "Visibility states" by name only. Does not mention:
- What the **colored dots** mean (users have to guess green/blue/purple/red)
- What the orange `!` marker means (critical file indicator)
- Where **token cost** is displayed (right side of each row, small text)
- What the ♡ and ★ action buttons do (introduced in Issue 10)

**Fix in** `webview-ui/src/App.tsx` — rewrote the Files `tooltip` prop to cover all visible UI elements.

---

## Issue 10 — Heart (♡) and star (☆) actions hidden until hover

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Pin (♡/❤) and Critical (☆/★) action buttons only appear on row hover (`opacity-0 group-hover:opacity-100`). Users don't know they exist.

**Fix in** `webview-ui/src/components/files/FileRow.tsx`:
- Removed `opacity-0` from the actions container; always rendered at low opacity (`opacity-20`)
- On hover (`group-hover`) bumps to `opacity-70` so they become clearly interactive
- Individual buttons now use `opacity-60 hover:opacity-100` rather than `opacity-50 hover:opacity-100`
- Re-inject `+` button (lost files only) unchanged — already prominent

---

## Issue 11 — Token cost shown inconsistently (omitted for some files)

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Token cost appeared next to some files but not others. Files with `tokenCost === 0` (size not yet known) showed nothing, making the column ragged and inconsistent.

**Fix in** `webview-ui/src/components/files/FileRow.tsx`:
```tsx
// Before — silent when 0:
{file.tokenCost > 0 && <span ...>{formatTokens(file.tokenCost)}</span>}

// After — always shown; dash when unknown:
<span ...>{file.tokenCost > 0 ? formatTokens(file.tokenCost) : '—'}</span>
```
Every file row now shows either a token count or `—`, keeping the layout consistent.

---

## Issue 12 — In-context files show `—` for token cost; watched files show real sizes

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Files added via agent activity (in-context) always showed `—` for token cost. Files auto-detected at startup (watched) showed real sizes. The more important files had no size data.

**Root cause:** Two different registration paths in `fileTracker.ts`:
- `scanForFiles()` calls `vscode.workspace.fs.stat()` → populates `tokenCost` immediately
- `addAgentFiles()` only has a path from the JSONL log → created entries with `tokenCost: 0`, never fetched size

**Fix in** `src/core/fileTracker.ts`:
- Added private `populateTokenCost(rel, abs)` async method that stats the file and back-fills `tokenCost` when it is still 0
- `addAgentFiles()` fires `populateTokenCost` as a non-blocking fire-and-forget for every newly created entry
- Existing entries with `tokenCost === 0` also get a backfill attempt when seen again
- `addAgentFiles` signature unchanged (still synchronous) — no call-site changes needed

---

## Issue 13 — Session shows inactive while subagent tool calls are running

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Claude Code card dropped to "1 model available" even while the agent was actively making tool calls (Read, Edit, Write, Bash). The session appeared idle.

**Root cause:** When Claude Code runs sub-tasks, tool calls execute inside a **subagent** and write to `~/.claude/projects/{project}/{sessionUUID}/subagents/*.jsonl` — not the main session JSONL. The `isActive` liveness check only tested the main JSONL file's `mtime`. While subagent work was ongoing the main file's `mtime` was not updated, so `isActive` became `false` after 5 minutes of no user-level messages.

**Fix in** `src/adapters/claudeCodeAdapter.ts` — `parseLatestSession()`:
- After finding the latest main JSONL, inspects `{sessionUUID}/subagents/` directory for recent JSONL activity
- Uses `Math.max(mainMtime, latestSubagentMtime)` as the effective mtime for the `isActive` calculation
- Session stays active as long as ANY subagent wrote to disk within the last 5 minutes

---

## Issue 14 — Agent card hides all stats when session is idle; mode and dot label wrong

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:**
- All session stats (turns, tools, files, model, mode) disappeared when the 5-min idle threshold was crossed, even though those counts are cumulative and don't change
- Status dot title said "Installed" when idle — should say "Idle"
- "Edit mode" disappeared when idle, even though the mode hadn't changed

**Fix in** `webview-ui/src/components/agent/AgentCard.tsx`:
- Introduced `displaySession = activeSession || sessions[0]` — falls back to last-known session for stat display
- Session stats, model, and mode now render from `displaySession` (always visible if any session data exists)
- State badge always shown: active state + elapsed time when running; grey "Idle" badge when no active session
- Status dot logic: green = active session, grey = idle/installed, red = not found
- Grey dot title changed from `'Installed'` → `'Idle'` when installed but no active session
- Mode shown from `displaySession?.mode`, persists through idle periods
- Fallback text "N models available" now only renders when there is no session data at all

---

## Issue 15 — `slice(-10)` caused adapter to read stale session, showing permanent Idle

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Agent card stuck in Idle state even during active tool execution. All stats (turns, mode, token count) from hours-old session.

**Root cause:** `parseLatestSession()` in `claudeCodeAdapter.ts` called `jsonlFiles.slice(-10)` before iterating files to find the latest mtime. `readDirectory` returns files in filesystem insertion order — not sorted by mtime. With 13 session files, the current session UUID `19520e35` (alphabetically near the start) was at index 2 and excluded by `slice(-10)`, which takes indices 3–12. The adapter instead found `8ee23b7e` (mtime 13:07, >5 min stale) as the "latest" file, marked `isActive = false`, and served stale token counts and mode from that old session.

**Impact:** Every piece of data on the Agent card was wrong — Idle badge shown even during active work, wrong token counts in context gauge, wrong/missing mode label.

**Fix in** `src/adapters/claudeCodeAdapter.ts` line 412:
```typescript
// Before — skips files not in the last-10 by filesystem order:
for (const file of jsonlFiles.slice(-10)) {

// After — scans ALL files to find true latest mtime:
for (const file of jsonlFiles) {
```

---

## Issue 16 — ContextPanel loses Edit mode label when session goes idle

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** The mode label (`· Edit mode`) in the Context Window panel disappears as soon as the 5-minute idle threshold is crossed, even though the mode hasn't changed.

**Root cause:** `ContextPanel.tsx` derived `sessionMode` from `activeSession?.mode` with no fallback. When `isActive` became false, `activeSession` was undefined and `sessionMode` became undefined — the label vanished. The identical pattern had previously been fixed in `AgentCard.tsx` (Issue 14) but was missed in `ContextPanel.tsx`.

**Fix in** `webview-ui/src/components/context/ContextPanel.tsx` lines 11–15:
```tsx
// Before — loses mode on idle:
const activeSession = agents.flatMap(a => a.sessions).find(s => s.isActive);
const sessionMode = activeSession?.mode;

// After — persists last-known mode:
const allSessions = agents.flatMap(a => a.sessions);
const activeSession = allSessions.find(s => s.isActive);
const displaySession = activeSession ?? allSessions[0];
const sessionMode = displaySession?.mode;
```

---

## Issue 17 — Docs card flashes "No documentation manifest found" mid-scan

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Documentation panel briefly shows the "No documentation manifest found / Create Manifest" screen every few seconds, even though docs exist.

**Root cause:** `scan()` began with `this.items.clear()`, then awaited multiple async operations (findFiles, stat, readFile) for each of the 9 manifest requirements. Any call to `getHealth()` during this window sees `items.size === 0` → `total === 0` → `noDocs: true` → DocsPanel switches to the "no manifest" fallback screen. Triggered reliably when the model-change event fires `emitState()` concurrently with an in-progress scan — which happens on the first correct poll after the Issue 15 fix (model switches from stale session to the real one).

**Fix in** `src/core/docHealthTracker.ts`:
- Build scan results into a local `newItems` map; assign `this.items = newItems` atomically at end of scan
- `getHealth()` always reads a complete prior snapshot — never an empty or partial map

---

## Issue 18 — Docs items flicker and reorder on every poll

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Documentation items appear/disappear and change display order every 5 seconds without any actual doc changes.

**Root cause:** If a scan takes longer than 5 seconds, the next poll fires and starts a second concurrent scan. Both scans shared `this.items`, both called `clear()`, and both interleaved `set()` calls. `Map` insertion order became non-deterministic under concurrent writes → items rendered in different order each frame.

**Fix in** `src/core/docHealthTracker.ts`:
- Added `private isScanning: boolean = false` guard
- `scan()` returns the last good result immediately if already running — prevents concurrent scans
- Combined with Issue 17's atomic swap ensures exactly one scan at a time and always a complete result

---

## Issue 19 — Timeline panel shows only "AgentLens initialized" — 7 of 9 event types never emitted

**Status:** ✅ FIXED — compiled 2026-03-04
**Symptom:** Timeline card is permanently static after initial load. Only the startup event ever appears regardless of agent activity.

**Root cause:** `TimelineEvent.type` defines 9 event types. Only 2 are ever emitted:
- `session-start` — fires once at startup ✅
- `compaction` — fires only when token usage drops >30% (rarely, requires valid token data)

The following 7 types are defined in `types.ts` but have **zero call sites** in the entire codebase:
- `tool-call` — never emitted
- `agent-state-change` — never emitted
- `file-lost` — never emitted
- `threshold-crossed` — never emitted
- `doc-change` — never emitted
- `error` — never emitted
- `model-change` — wired but broken (see Issue 20)

`poll()` never compares previous vs current state to detect changes, so no change-driven events are ever fired. The timeline infrastructure (types, panel, renderer) is complete but the emission side is a stub.

**Fix needed in** `src/core/stateManager.ts`:
- Track previous session state, previous context zone, previous doc health, previous files set between polls
- On each poll diff, emit appropriate events for: agent state changes, new files touched, files lost, context zone crossings, doc health changes
- Fix Issue 20 to restore model-change events

---

## Issue 20 — `onModelChanged` event never fires (self-defeating mutation in `adapterRegistry.ts`)

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Timeline never shows model-change events. `contextCalc.setModel()` via model-change event handler is dead code.

**Root cause:** In `adapterRegistry.ts`, `getActiveModel()` **mutates** `this.lastKnownActiveModelId` in Priority 1. `detectAll()` then immediately checks `current.id !== this.lastKnownActiveModelId` — which is guaranteed to be false because `getActiveModel()` just set them equal. The comparison is structurally always false. The `_onModelChanged.fire()` at line 35 can never execute after the very first detection.

Practical impact is limited because `poll()` calls `this.contextCalc.setModel(activeModel)` directly regardless, keeping the context calculator correct. But the model-change timeline event is permanently dead, and any future subscriber to `onModelChanged` would silently receive no events.

**Fix:** `getActiveModel()` must not mutate `lastKnownActiveModelId`. Move all mutation to `detectAll()` only.

---

## Issue 21 — Context budget warning spams `showWarningMessage` every 5 seconds

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** While always-present files exceed context budget, a VS Code warning notification fires on every poll cycle (every 5s) indefinitely. Same problem exists for the compaction re-injection warning.

**Root cause:** No "already warned" guard in `stateManager.ts` lines 171–178. Both `showWarningMessage` calls are issued unconditionally each poll while their condition is true.

**Fix:** Track `private contextBudgetWarnedAt = 0` and `private reinjectionWarnedAt = 0`. Only fire each warning if:
1. The condition just became true this poll (wasn't true last poll), OR
2. A minimum cooldown (e.g. 60s) has elapsed since the last warning

---

## Issue 22 — False compaction alerts when model switches between polls

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** When the detected model changes (e.g. after Issue 15 fix, adapter switches from a stale session to the current one), the context percentage halves if the new model has a different context window size. This triggers the compaction detector (`prevPercent * 0.6 > currPercent`) and a spurious `CompactionEvent` is written + re-injection prompt shown.

**Root cause:** `stateManager.ts` lines 137–152 detect compaction by raw percentage drop. No model-change guard. The same token count on a 100k-context model = 50% usage; on a 200k-context model = 25% usage — a 50% drop triggers the false positive.

**Fix:** Record the model ID at time of `previousContextPercent` capture. If the model ID changes this poll, skip the compaction check for this cycle.

---

## Issue 23 — `sessionFileMtime` not updated to `effectiveMtime` (subagent activity invisible to external consumers)

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** `getSessionFileMtime()` returns the main JSONL file mtime, not the effective mtime that includes subagent activity. During active subagent execution the returned mtime is stale, making the session appear older than it is to any consumer of `getSessionFileMtime()`.

**Root cause:** `claudeCodeAdapter.ts` line 426 sets `this.sessionFileMtime = latestMtime` (main file only). `effectiveMtime = Math.max(latestMtime, latestSubagentMtime)` is computed afterwards but never stored.

**Fix:** Set `this.sessionFileMtime = effectiveMtime` after computing it.

---

## Issue 24 — Session start time is fabricated; session duration in AgentCard is always wrong

**Status:** 🔴 OPEN
**Symptom:** Agent card shows an incorrect session duration. The shown time fluctuates with turn count rather than reflecting real elapsed time.

**Root cause:** `claudeCodeAdapter.ts` line 492:
```typescript
startedAt: meta.lastActivity - (meta.turnCount * 30000),
```
`meta.lastActivity` is initialised to `Date.now()` and never updated from JSONL, so it always equals the current poll time. Session start is therefore `now - (turnCount × 30s)` — a made-up value that changes with every poll.

**Fix:** Parse the actual timestamp from the first JSONL entry in the 200-line window rather than fabricating from turn count × constant.

---

## Issue 25 — Default webview state `noDocs: true` causes "No documentation manifest found" flash on every panel open

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Each time the AgentLens panel is opened, it briefly shows "No documentation manifest found / Create Manifest" before the first state update arrives from the extension host.

**Root cause:** `useExtensionState.tsx` default state has `documentationHealth: { noDocs: true, ... }`. Before the first `stateUpdate` message is received via `postMessage`, the DocsPanel renders the false-positive empty state.

**Fix:** Change default state to `noDocs: false, items: [], score: 0`. The DocsPanel should render empty items (loading state) rather than "no manifest found" when `items` is empty but `noDocs` is false.

---

## Issue 26 — Default context thresholds differ between webview and StateManager

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** On initial render, the context gauge uses wrong zone colours (yellow at 70%, orange at 85%, red at 95%) until the first state update arrives. After first update, it correctly uses 60% amber / 80% red.

**Root cause:** `useExtensionState.tsx` line 43 default: `{ warning: 70, danger: 85, critical: 95 }`. `StateManager` line 53 default: `{ warning: 60, danger: 60, critical: 80 }`. They disagree.

**Fix:** Align `useExtensionState.tsx` defaults to `{ warning: 60, danger: 60, critical: 80 }`.

---

## Issue 27 — `noDocs: true` conflates "no manifest file" with "all docs missing"

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** DocsPanel shows "No documentation manifest found — Create Manifest" both when the manifest JSON file is absent AND when the manifest exists but all docs are missing. In the second case, the user is prompted to recreate data that already exists; the right action is to create the documentation files, not the manifest.

**Root cause:** `docHealthTracker.getHealth()` returns `noDocs: true` for both `total === 0` (no scan data) and `items.every(i => i.health === 'missing')` (all items missing). DocsPanel renders the same "create manifest" UI for both cases.

**Fix:** Add a separate `allMissing: boolean` field to `DocumentationHealth`. Render distinct messages:
- `noDocs: true` (no manifest / empty scan) → "No documentation manifest found — Create Manifest"
- `allMissing: true, noDocs: false` → "No documentation files found — use Create Missing Docs to scaffold them"

---

## Issue 28 — `turnCount` undercounts for long sessions (200-line JSONL window)

**Status:** 🟡 KNOWN LIMITATION
**Symptom:** Agent card shows "Turns: 12" for a 200-turn session. The count is accurate only for short/recent sessions.

**Root cause:** `parseClaudeSession` only processes the last 200 JSONL lines in `parseLatestSession`. Each turn generates many lines (assistant message + tool calls + tool results), so 200 lines covers only the last 20–40 turns of a long session.

**Fix consideration:** Read the entire file for counting metadata (turns, tool calls, files touched) but keep the last-200-lines cap only for fields that need recency (state, model, last token usage). Or scan once at session start for totals, then incrementally update on subsequent polls.

---

## Issue 29 — `turnCount` inflated by compaction-generated artificial user messages

**Status:** 🟡 KNOWN LIMITATION
**Symptom:** Minor inflation of turn count on compacted sessions (each compaction adds 1 phantom turn).

**Root cause:** Claude Code writes an artificial `role: user` message during compaction. `parseClaudeSession` line 559 increments `turnCount` for every `role === 'user'` message including these synthetic ones. `compactionCount` is separately incremented but turn count is not corrected.

**Fix:** Detect the compaction marker BEFORE incrementing `turnCount` and skip the increment for that message.

---

## Issue 30 — `inContextFiles` Set is populated but never read (dead state)

**Status:** 🟡 OPEN
**Symptom:** `markInContext()` writes to `this.inContextFiles` but `getTrackedFiles()` never consults it. File visibility is driven entirely by the `trackedFiles` Map values, not by this Set.

**Root cause:** `fileTracker.ts` — `inContextFiles` was likely an earlier architecture that was superseded but not removed. The Set is populated, assigned, and forgotten.

**Fix:** Remove `inContextFiles` and its usages, or wire it into `getTrackedFiles()` visibility logic if it was intended to be the source of truth for in-context classification.

---

## Issue 31 — File watcher `**/*` fires for node_modules, dist, .git (performance + false positives)

**Status:** 🟡 OPEN
**Symptom:** The file watcher in `fileTracker.ts` fires for every file change in the workspace including build artefacts. Build output, node_modules installs, and git operations all trigger the watcher handler.

**Root cause:** `vscode.workspace.createFileSystemWatcher('**/*', false, false, false)` has no exclusion glob.

**Fix:** Use `vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '**/*'))` and add excludes for `node_modules`, `.git`, `dist`, `out`, `build`. Or check in the handler whether the changed file is in one of those directories and return early.

---

## Issue 32 — `checkIfAgentUpdated` is a permanent stub (always returns false)

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** Doc items never show as "last updated by agent", regardless of whether an AI authored the last commit on that file.

**Root cause:** `docHealthTracker.ts` lines 248–262: the function has no implementation. The comment says "can't run git commands from extension without shell" — this is incorrect. VS Code extensions can use either:
1. The built-in **VS Code Git extension API** (`vscode.extensions.getExtension('vscode.git')?.exports`) — no subprocess needed
2. Node.js `child_process.execFile('git', ['log', '-1', '--format=%an', '--', filepath])` — fully supported in extension host

**Fix options:**
- **Option A (preferred):** Use VS Code Git API to read last commit author for the file; match against known AI author patterns ("Claude", "GitHub Copilot", "Co-Authored-By: Claude")
- **Option B:** Use `child_process.execFile` to run `git log` — simpler but spawns a process per doc file per scan cycle
- **Option C:** Skip per-file git; instead check if the current session touched the file (`fileTracker.getFilesTouched()` cross-reference) — approximate but zero dependencies

---

## Issue 33 — Health scorer penalises idle/new sessions (scores 60 for 0% context usage)

**Status:** 🟡 OPEN
**Symptom:** Health score shows ~82 for an idle project with no agent activity, with "Context Efficiency" sub-score of 60 — making it look like there's a problem when there isn't one.

**Root cause:** `healthScorer.ts` `scoreContextEfficiency`: usage ≤10% returns 60 (below "fair"). Idle sessions with 0% usage get the same penalty as sessions barely above 0%.

**Fix:** Score 0% usage as 100 (no waste, nothing loaded). Only begin penalising at genuinely low but non-zero usage that suggests the model is underutilised.

---

## Issue 34 — No timeout/retry for initial `requestRefresh` — UI stuck in defaults if extension host is slow

**Status:** 🟡 OPEN
**Symptom:** If the extension host isn't ready when the webview panel opens (e.g. extension still activating), `requestRefresh` fires and gets no response. The UI stays permanently in default state: no agents, 0 tokens, "no manifest found".

**Root cause:** `useExtensionState.tsx` line 67: `postMessage({ type: 'requestRefresh' })` is fire-and-forget with no timeout, retry, or loading indicator.

**Fix:** Post `requestRefresh` on a short delay after mount AND retry once after a 2-second timeout if no `stateUpdate` has been received yet. Show a "Connecting…" placeholder instead of the false-positive default state.

---

## Issue 35 — System-reminder injection text appears verbatim in the Agent card "current task" line

**Status:** ✅ FIXED — compiled 2026-03-03
**Symptom:** The Claude Code card briefly shows raw `<system-reminder> The user provided the following references: - c:\Users\rananda...` text as the current task label, then disappears on the next poll.

**Root cause:** `AgentCard.tsx` lines 99–104 render `activeSession.currentTask` when the session is active. `currentTask` is extracted in `parseClaudeSession` from the first `role: user` message in the 200-line JSONL window. The VS Code `UserPromptSubmit` hook injects `<system-reminder>...</system-reminder>` blocks into every user message before it is written to JSONL. If the 200-line window starts with such a message, the raw injection XML becomes `currentTask` and is displayed verbatim in the card.

**Fix in** `src/adapters/claudeCodeAdapter.ts` — `parseClaudeSession` `currentTask` extraction:
- After extracting the raw text, strip all `<tag>...</tag>` XML-style injection blocks before using it as the task label
- If the stripped text is empty (the entire message was injected content), skip this message and continue to the next user turn
```typescript
// Strip injected system blocks (UserPromptSubmit hooks, system-reminder, etc.)
const stripped = text.replace(/<[a-z][a-z-]*>[\s\S]*?<\/[a-z][a-z-]*>\s*/gi, '').trim();
if (stripped.length > 0) {
  meta.currentTask = stripped.substring(0, 80) + (stripped.length > 80 ? '...' : '');
}
```

---

## Issue 36 — "Create Missing Docs" button perpetually disabled during agent session

**Status:** ✅ FIXED — compiled 2026-03-04
**Symptom:** "Create Missing Docs" button always appears greyed out and unclickable whenever Claude Code is active.

**Root cause:** `DocsPanel.tsx` checked `isAgentBusy` (session `isActive && state ∈ BUSY_STATES`). `meta.state` is set to the last tool call in the 200-line window and never resets — so `state` is permanently a BUSY_STATE for the entire 5-minute `isActive` window after any agent activity.

**Fix in** `webview-ui/src/components/docs/DocsPanel.tsx`:
- Removed `isAgentBusy` guard entirely
- `createMissingDocs()` only writes new files (health === 'missing') — these files don't exist yet, so no data-loss risk concurrently with agent execution
- Button always enabled when `missingCount > 0`

---

## Issue 37 — "Edit manifest" button throws error when no manifest file exists

**Status:** ✅ FIXED — compiled 2026-03-04
**Symptom:** Clicking "Edit manifest" shows "AgentLens: No manifest found. Create one first." warning even though the Docs panel is already showing doc items (running off DEFAULT_MANIFEST).

**Root cause:** `openDocManifest` handler tried to open `.agentlens/doc-requirements.json` directly. If the user never explicitly created the manifest (extension uses built-in DEFAULT_MANIFEST), the file doesn't exist on disk.

**Fix in** `src/providers/dashboardViewProvider.ts`:
- On file-not-found, auto-call `stateManager.createDocManifest()` which writes the DEFAULT_MANIFEST as a real file and opens it for editing
- User gets a pre-populated file to edit instead of an error

---

## Issue 38 — "Create Missing Docs" generates placeholder content, not project-aware content

**Status:** ✅ FIXED — compiled 2026-03-04
**Symptom:** Created documentation files contain only `# Title` and `## Section\nTODO: Add content.` — no real project information.

**Root cause:** `getDocTemplate()` was a pure template function with no access to project context.

**Fix in** `src/core/docHealthTracker.ts`:
- Added `collectProjectContext()` — reads `package.json`, `pyproject.toml`, `src/` listing, and existing README excerpt
- Added `tryGenerateWithLM()` — calls VS Code LM API (Copilot/Claude) with project context + section hints; generates real prose
- Added `buildStructuredContent()` — fallback for when no LM model is available; inserts project description and sections with TODO markers
- Both `createMissingDocs()` and `updateDocs()` now use `generateDocContent()` = LM with extraction fallback

---

## Issue 39 — No way to refresh/update documentation files once created

**Status:** ✅ FIXED — compiled 2026-03-04
**Symptom:** Once docs are created, there is no way to regenerate them from updated project sources without manually deleting and recreating.

**Fix in** `src/core/docHealthTracker.ts`, `src/core/stateManager.ts`, `src/types.ts`, `webview-ui/src/components/docs/DocsPanel.tsx`, `webview-ui/src/components/docs/DocItem.tsx`:
- Added `updateDocs(docTypes?: string[])` to DocHealthTracker — regenerates existing (non-missing) docs
- Added `updateDocs()` to StateManager — shows overwrite warning dialog before proceeding
- Added `updateDocFiles` and `updateDocFile` message types to WebviewMessage union
- DocsPanel now shows "Update Docs" button when `items.length > missingCount`
- DocItem now shows a hover-reveal ↻ refresh icon per row for single-file updates
- Both paths show a VS Code warning dialog ("Existing content will be overwritten")

---

## Issue 40 — Session continuation summaries and meta-questions appear as current task label

**Status:** ✅ FIXED — compiled 2026-03-04
**Symptom:** Claude Code card shows "This session is being continued from a previous conversation..." or "Are you still executing?" as the current task label.

**Root cause:** `parseClaudeSession` used first-match logic (`firstUserMessage` flag). Two failure modes:
1. After compaction, Claude Code writes a plain-text continuation summary as the first user message in the new window segment — no XML tags to strip, so it passed through as `currentTask`
2. Short meta-questions from earlier in the session also passed through the XML stripper unchanged

**Fix in** `src/adapters/claudeCodeAdapter.ts`:
- Added `scoreTaskCandidate()` helper: scores candidate text on length, action verbs, code terms, meta/noise terms
- `parseClaudeSession` now collects up to 5 user message candidates (post-last-compaction)
- After each compaction, `taskCandidates` is reset (post-compaction anchoring)
- After the loop, picks the highest-scoring candidate (min score > -3 to reject pure noise)
- Replaces the single `firstUserMessage` flag entirely

---

## Issue 41 — Mode not updating when switching between Edit/Plan/Auto-edit in Claude Code

**Status:** ✅ FIXED — compiled 2026-03-04
**Symptom:** After switching from "Edit automatic" mode to "Plan mode" in Claude Code, the AgentCard still shows "Edit mode" indefinitely.

**Root cause:** Mode was derived solely from `meta.hasEditTools` — a flag set if any Write/Edit/MultiEdit tool appeared in the 200-line window, and never cleared. Even after switching to Plan mode (which prevents write tools), past write calls in the window kept `hasEditTools = true`.

**Fix in** `src/adapters/claudeCodeAdapter.ts`:
- Added `detectedMode?: string` to `ClaudeSessionMeta`
- In user message handling: scan `<system-reminder>` XML content BEFORE stripping for mode indicators ("Plan mode is active", "auto-edit mode")
- In `detect()`: `meta.detectedMode` takes precedence over `hasEditTools` heuristic
- Mode reflects the most recent system-reminder in the 200-line window → updates within one poll cycle of switching modes

---

## Compilation steps

Run from workspace root `c:\Users\ranandag\Documents\WorkVSC\agentlens\`:

```bash
npm run compile
```

This rebuilds both `dist/extension.js` (TypeScript) and `dist/webview/` (React/Vite) in one command.

To activate: reload VS Code Extension Development Host (`Ctrl+Shift+P → Developer: Reload Window`).

---

## Issue 42 — Nameless green-dot entry in Files card

**Root cause:** `fileTracker.ts → addAgentFiles()` normalizes incoming paths by stripping the workspace root prefix. When a `filePath` is exactly the workspace root itself (e.g. `c:/Users/.../agentlens`), after stripping the prefix `rel` becomes `''` (empty string). The existing outside-workspace skip check (`rel === filePath && isAbsolute`) does NOT catch this case because `'' !== filePath`. The tracker then adds a `TrackedFile` with `relativePath: ''`, which renders as a blank button via `shortPath('') → ''`.

**Fix:** Added a guard in `addAgentFiles` immediately after path normalization to skip any `rel` that is empty or `'.'`:

```typescript
// Skip empty paths (e.g. when filePath is exactly the workspace root)
if (!rel || rel === '.') continue;
```

**File:** `src/core/fileTracker.ts` (line 212-213)

**Version:** 4.2.1

---

## Issue 43 — Task label in Claude Code card showing user's own messages

**Root cause:** The `currentTask` field (scored candidate from user messages) was still rendered in `AgentCard.tsx`. The scoring system correctly filtered many meta-messages but edge cases (e.g. questions longer than 40 chars referencing files) still scored positively and appeared as task labels.

**Fix:** Removed the task label rendering block entirely from `AgentCard.tsx` (lines 99-104).

**File:** `webview-ui/src/components/agent/AgentCard.tsx`

**Version:** 4.2.2

---

## Issue 44 — Mode label stuck on "Edit mode" regardless of VS Code Claude Code mode toggle

**Root cause (Issue 41 fix was wrong):** The fix in Issue 41 looked for mode text in `<system-reminder>` blocks, but those blocks only contain agent framework context injections (CLAUDE.md references, policy reminders). Claude Code does NOT put mode info in `<system-reminder>`.

**Actual JSONL structure:**
- **Plan mode (agent-initiated)**: When an agent invokes the `EnterPlanMode` tool, Claude Code injects a `tool_result` block containing `"Entered plan mode. You should now focus on exploring..."`. This IS detectable.
- **VS Code UI mode toggles** (Auto-edit ↔ Ask before edit ↔ Plan via the sidebar): These do NOT inject anything into the JSONL conversation and are fundamentally undetectable from JSONL parsing alone.

**Fix:**
1. Replaced `<system-reminder>` scanning with `tool_result` block scanning in user message parsing loop.
2. Detect "Entered plan mode" → set `detectedMode = 'Plan mode'`; "Exited plan mode" → clear it.
3. Removed the heuristic `Edit mode` / `Edit mode (auto)` labels entirely — they were based on "edit tools were used" which is not the same as the VS Code mode setting, causing confusion.
4. Mode is now only shown when positively detected (Plan mode via tool_result).

**Files:**
- `src/adapters/claudeCodeAdapter.ts` (user-message parsing loop, mode assignment block)

**Version:** 4.2.2

---

## Issue 45 — LM model selection triggering local Phi model popup

**Root cause:** `docHealthTracker.ts:tryGenerateWithLM()` called `vscode.lm.selectChatModels({})` with empty criteria. VS Code interprets this as "give me any model" and may offer local downloaded models (e.g. Phi) before cloud models, triggering a download prompt.

**Fix:** Pass `{ vendor: 'copilot' }` to request a Copilot cloud model specifically. Falls back to the structured content generator if no Copilot model is available.

**File:** `src/core/docHealthTracker.ts` (line 451)

**Version:** 4.3.0

---

## Issue 46 — No stale documentation warning for files not updated in 24h

**User request:** Show a dismissible in-card warning in the DocsPanel when any existing doc file has not been updated in more than 24 hours. Must not change the health score or per-doc status.

**Fix:**
1. Add `staleDocCount24h?: number` to `DocumentationHealth` in `types.ts`
2. Compute it in `docHealthTracker.ts:getHealth()` using each item's `daysSinceUpdate >= 1`
3. Show a dismissible warning banner in `DocsPanel.tsx` using `sessionStorage` for dismiss persistence

**Files:** `src/types.ts`, `src/core/docHealthTracker.ts`, `webview-ui/src/components/docs/DocsPanel.tsx`

**Version:** 4.3.0

---

## Issue 47 — Bash command regex capturing regex fragments as file paths

**Root cause:** `claudeCodeAdapter.ts` used `/(?:cat|edit|read|write|vim|nano)\s+(\S+)/` on `input.command` to extract file paths from bash tool calls. The `(\S+)` capture group is excessively broad and captured regex pattern fragments (e.g. `n]{0,200}',`, `mode']:`) that appeared in Python scripts passed to bash. The same bug existed in `agentDetector.ts`.

**Fix:** Removed the bash command regex heuristic entirely. File paths are already reliably captured via `input.file_path` and `input.path` from structured tool inputs (Read, Write, Edit, MultiEdit). The bash heuristic was redundant and fragile.

**File:** `src/adapters/claudeCodeAdapter.ts` (lines 641-644)

**Version:** 4.3.0

---

## Issue 48 — "In ctx" abbreviation in file visibility tooltip

**Fix:** Expanded `'In ctx'` → `'In context'` in `VISIBILITY_LABELS` in `FileRow.tsx`. Audited all other label strings; none were abbreviated.

**File:** `webview-ui/src/components/files/FileRow.tsx`

**Version:** 4.3.0

---

## Issue 49 — Mode label removed in v4.2.2, restoring with behavioral inference

**Background:** v4.2.2 removed all mode labels because the heuristic (`hasEditTools`) was not a reliable indicator of the VS Code UI mode toggle (Auto-edit/Ask-before-edit). However, this left the mode field entirely blank.

**Decision:** Restore with behavioral inference — labels reflect what the agent is *doing*, not what mode is configured in the VS Code UI. These are understood to be inferred approximations.

**Inference rules (claudeCodeAdapter.ts):**
- `detectedMode = 'Plan mode'` if tool_result contained "Entered plan mode" (confirmed, not inferred)
- `toolCallCount / turnCount >= 3 && hasEditTools` → `'Auto-editing'` (high modify rate, likely automated)
- `hasEditTools` → `'Editing'` (edit tools used, manual or semi-manual)
- `toolCallCount > 0 && !hasEditTools` → `'Reading'` (only read tools observed)

**Caveat:** Cross-vendor mode detection is not possible via any published VS Code LM API. These labels are behavioral approximations only. Documented in `AgentLens_Project_History.docx`.

**File:** `src/adapters/claudeCodeAdapter.ts`

**Version:** 4.3.0

---

## Notes

- The adapter reads the **last 200 lines** of the JSONL (`claudeCodeAdapter.ts` line 262). For very long sessions, entries earlier than that window are not considered — acceptable since we want the latest value, not historical max.
- Context compaction creates new JSONL entries within the **same session file** — it does NOT start a new `.jsonl`. The session ID stays unchanged.
- The `yellow` zone still exists in code and CSS but is now unreachable with default thresholds (warning == danger). Custom user configs could still reach it.
