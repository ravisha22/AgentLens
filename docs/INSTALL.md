# AgentLens — Installation Guide

**Current version: 4.3.0**

## What is AgentLens?

AgentLens is a VS Code extension that gives you real-time visibility into what your AI coding agents are doing. It shows you which model is being used, how much of the context window is consumed, which files the agent is working with, and the health of your project documentation.

It works with **GitHub Copilot**, **Claude Code**, **Cursor**, and **Cline**.

---

## Installation

### Option A — Install from pre-built VSIX (recommended)

**Step 1: Download the VSIX**

Download `agentlens-4.3.0.vsix` from the [latest GitHub release](https://github.com/ravisha22/AgentLens/releases/tag/v4.3.0).

Save it anywhere on your computer (e.g., your Downloads folder).

**Step 2: Install in VS Code**

*Drag and drop:*
1. Open VS Code.
2. Open the **Extensions** panel (`Ctrl+Shift+X`).
3. Drag the `agentlens-4.3.0.vsix` file onto the Extensions panel.

*Menu method:*
1. Open the **Extensions** panel (`Ctrl+Shift+X`).
2. Click the **three-dot menu** (`...`) at the top-right.
3. Select **Install from VSIX...**
4. Browse to `agentlens-4.3.0.vsix` and select it.

**Step 3: Confirm installation**

After installation you will see a notification: *"Extension 'AgentLens' has been installed."*

You should now see the **AgentLens icon** in the **Activity Bar** on the left side of VS Code.

If you don't see it, reload VS Code: press `Ctrl+Shift+P`, type `Reload Window`, and press Enter.

---

### Option B — Build from source

**Prerequisites:** Node.js 18+, npm, VS Code

```bash
git clone https://github.com/ravisha22/AgentLens.git
cd AgentLens
npm install
npm run compile
```

Press **F5** in VS Code to open an Extension Development Host with AgentLens loaded.

To package your own VSIX:
```bash
npm run package
# Produces agentlens-4.3.0.vsix in the workspace root
```

---

## Getting Started

### Open the Dashboard

Click the **AgentLens icon** in the Activity Bar (left sidebar). The dashboard opens as a sidebar panel with six collapsible sections:

1. **Context Window** — shows the AI model in use and how much of its memory (context window) is consumed.
2. **Agent** — shows which AI agents are detected and their current status.
3. **Files** — lists the project files that the agent is tracking or has interacted with.
4. **Documentation** — scores the health of your project's documentation.
5. **Health** — an overall health score combining context, files, docs, and session stability.
6. **Timeline** — a chronological log of events during your session.

### Status Bar

At the bottom-right of VS Code you'll see a compact status bar entry showing:
- Context usage percentage
- The active model name
- Health score

Click it to jump to the dashboard.

---

## Understanding the Dashboard

### Context Window Section

This is the most important section. It shows a **circular gauge** with a percentage that tells you how full the AI agent's memory is.

| Color | Meaning | Action needed |
|---|---|---|
| **Green** (0–69%) | Plenty of room | None |
| **Yellow** (70–84%) | Getting full | Be aware — the agent may start forgetting things soon |
| **Orange** (85–94%) | Almost full | Consider wrapping up or starting a new session |
| **Red** (95–100%) | Critical | The agent is likely about to compact (lose older context) |

Below the gauge you'll find:
- **Model name** — which AI model is active (e.g., "Claude Sonnet 4", "GPT-4o")
- **Token count** — exact numbers when available, or "estimated" when the agent doesn't expose them
- **Breakdown bar** — a color-coded bar showing what's consuming the context (system prompt, tools, conversation history, files, etc.)

**Compaction alerts:** When the agent compresses its memory (compaction), an orange banner appears showing how much was freed and which files were lost. You can click **Re-inject** to add pinned files back.

### Agent Section

Shows a card for each detected AI agent:
- **Green dot** = active session in progress
- **Gray dot** = installed but not currently active
- **State badge** = what the agent is doing right now (Thinking, Executing, Writing, Tool Call, etc.)
- **Session stats** = turn count, tool calls, files touched, compaction count

### Files Section

Lists project files that AgentLens is tracking. Each file has:
- **Colored dot** indicating status:
  - Green = currently in the agent's context
  - Purple = pinned (always-present)
  - Blue = recently modified
  - Gray = being watched
  - Red = was in context but has been lost (usually after compaction)
- **Orange `!`** = marked as critical

**Hover over a file** to see action buttons:
- **Heart icon** = pin/unpin the file as "always present" — AgentLens will alert you if it falls out of context
- **Star icon** = mark/unmark as critical
- **`+` button** (on red/lost files) = re-inject the file into the agent's context

**Click a file name** to open it in the editor.

The **Critical File Watchlist** at the top shows a coverage bar: how many of your critical files are still in context.

### Documentation Section

Scores your project's documentation against a configurable checklist. Each doc type shows:
- Green checkmark = healthy (exists, recent, complete)
- Yellow circle = stale or outdated
- Red X = missing

Click **Create Manifest** to generate the checklist file (`.agentlens/doc-requirements.json`), then edit it to match your project's needs.

### Health Section

A composite score (0–100) built from five components:
- **Context Efficiency** — are you using the context window well?
- **Critical Files** — are your important files in context?
- **Documentation** — is project documentation healthy?
- **Session Stability** — fewer compactions = better
- **Agent Response** — is the agent active and responsive?

### Timeline Section

Click to expand. Shows:
- A **line chart** of context usage over time with colored zone bands
- A **chronological event log** (session start, model changes, file loads/losses, compaction events, tool calls)

---

## Key Actions

### Pin important files

If there are files you always want the AI agent to have access to (architecture docs, instructions files, schemas), pin them:

1. Open the **Files section** in the dashboard.
2. Hover over the file and click the **heart icon**.
3. The file is now "always-present." If it falls out of context after compaction, AgentLens will alert you and offer to re-inject it.

### Mark critical files

For your most important files (the ones that would cause problems if the agent forgot about them):

1. Hover over the file and click the **star icon**.
2. The file appears in the Critical File Watchlist with a coverage tracker.

You can also configure critical files in bulk:
1. Press `Ctrl+Shift+P` and type **"AgentLens: Configure Critical Files"**.
2. Enter patterns like `**/ARCHITECTURE.md, **/schema.prisma`.

### Set up documentation tracking

1. Press `Ctrl+Shift+P` and type **"AgentLens: Create Documentation Manifest"**.
2. A JSON file opens with documentation requirements. Edit it to match your project:
   - Which docs are required vs. optional
   - How many days before a doc is considered stale
   - What sections each doc should contain

### Re-inject lost files after compaction

When the agent compresses its memory, some files may be lost. AgentLens detects this and shows:
- An **orange compaction alert** in the Context section
- **Red dots** next to lost files in the Files section
- A **Re-inject** button to add them back

---

## Settings

To customize AgentLens, go to **File > Preferences > Settings** (or `Ctrl+,`) and search for "AgentLens".

| Setting | What it does | Default |
|---|---|---|
| **Poll Interval** | How often AgentLens checks for updates (seconds) | 5 |
| **Critical Files** | File patterns that should always be marked as critical | Empty |
| **Always-Present Files** | File patterns that auto-re-inject after compaction | Empty |
| **Always-Present Max %** | Maximum context budget that pinned files can consume | 50% |
| **Auto Inject on Loss** | Automatically re-inject pinned files when lost | On |
| **Auto Detect Critical** | Automatically identify critical files by name patterns | On |
| **Alert Thresholds** | Context usage percentages for zone colors | 70 / 85 / 95 |
| **Show Status Bar** | Show the compact summary in the bottom status bar | On |
| **Visible File Count** | Number of files shown before "Show more" | 5 |

---

## Supported AI Agents

| Agent | What AgentLens can show | Requirements |
|---|---|---|
| **GitHub Copilot** | Model name, available models, installed status | Copilot extension installed and signed in |
| **Claude Code** | Model, token usage, session state, turns, tool calls, compaction | Claude Code CLI used in the workspace at least once |
| **Cursor** | Installed status | Running inside Cursor IDE |
| **Cline** | Installed status | Cline extension installed |

Claude Code provides the richest data because it writes session logs that AgentLens can read. Other agents provide limited data based on what their APIs expose.

---

## Troubleshooting

**I don't see the AgentLens icon in the sidebar.**
- Reload VS Code: press `Ctrl+Shift+P`, type `Reload Window`, press Enter.
- Check that the extension is installed: open Extensions panel (`Ctrl+Shift+X`) and search for "AgentLens".

**The dashboard shows "No model detected."**
- Make sure at least one AI agent is installed and active. For Copilot, ensure you're signed in. For Claude Code, start a session in the terminal with `claude`.

**Context gauge shows 0% even though I'm using an agent.**
- Only Claude Code provides exact token counts. Copilot, Cursor, and Cline show "estimated" usage because they don't expose this data.
- For Claude Code, you need an active session with at least one exchange in the current workspace.

**A file disappeared from the files list.**
- This usually means the agent compacted its memory. Look for the orange compaction alert and use the Re-inject button.

**The model name keeps changing.**
- This can happen if multiple agents are running simultaneously. AgentLens prioritizes the agent with an active session. Close unused agent sessions to stabilize the display.

---

## Uninstalling

1. Open the **Extensions** panel (`Ctrl+Shift+X`).
2. Search for "AgentLens".
3. Click the gear icon next to AgentLens and select **Uninstall**.
4. Reload VS Code when prompted.

To remove all AgentLens data from a workspace, delete the `.agentlens/` folder in your project root.
