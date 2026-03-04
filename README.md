# AgentLens - AI Agent Context Intelligence

> Real-time visibility into what your AI coding agent is doing with its context window.

AgentLens is a VS Code sidebar extension that surfaces the information normally hidden between you and your AI assistant — context usage, active model, files loaded into context, documentation health, and inferred agent behavior. Every metric comes from real telemetry. No simulated data.

---

## What It Does

| Card | What You See |
|------|-------------|
| **Context Window** | Token count, utilization percentage, and warning thresholds at 80% and 95% |
| **Active Model** | Detected model name, provider, context limit, and capabilities |
| **Files in Context** | Which files the agent has loaded, their token cost, and status (in-context, modified, pinned, watched, lost) |
| **Documentation Health** | Whether your project docs exist, are up to date, and are accessible to the agent |
| **Agent Mode** | Inferred behavior — Plan mode, Auto-editing, Editing, or Reading |

## Supported Agents

- **Claude Code** (Anthropic)
- **GitHub Copilot** (via VS Code LM API)
- **Cline**
- **Cursor**

---

## Getting Started

See **[docs/INSTALL.md](docs/INSTALL.md)** for full installation instructions.

**Quick start:**

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/ravisha22/AgentLens.git
   cd AgentLens
   npm install
   ```

2. Build the extension:
   ```bash
   npm run compile
   ```

3. Press **F5** in VS Code to launch the Extension Development Host.

4. Click the **AgentLens** icon in the Activity Bar to open the sidebar.

To install from a `.vsix` package:
```
Extensions view (Ctrl+Shift+X) → ⋯ → Install from VSIX…
```

---

## Using the Sidebar

### Context Window Monitor

Shows real-time token consumption for the active agent session. The gauge turns yellow above 80% and red above 95% — a signal to consider summarizing or removing files from context.

### Files in Context

Lists every file the agent has read or edited, sorted by token cost. Each file shows a status indicator:

- **Green** — currently in context
- **Blue** — modified this session
- **Purple** — pinned (always present)
- **Grey** — watched but not yet loaded
- **Red** — was in context, now lost

Use the pin (♡/♥) and critical (☆/★) buttons to manage which files the agent prioritizes.

### Documentation Health

Scans your workspace for documentation files defined in the doc manifest. Reports a health score (0–100), flags missing or stale files, and shows a dismissible warning when any doc has not been updated in over 24 hours.

Use **Create Missing Docs** to scaffold absent files, or **Update Docs** to regenerate existing ones from current project state.

### Agent Mode

Displays the agent's inferred current behavior:

- **Plan mode** — confirmed via plan mode entry signal
- **Auto-editing** — high tool call rate with file edits
- **Editing** — file edits detected
- **Reading** — tool calls without file writes

---

## Build Reference

| Command | Purpose |
|---------|---------|
| `npm run compile` | Full build (extension + webview) |
| `npm run compile:ext` | Extension TypeScript only |
| `npm run compile:webview` | Webview assets only |
| `npm run watch:ext` | Watch mode for extension source |
| `npm run watch:webview` | Watch mode for webview source |
| `npm run test` | Run all tests |
| `npm run package` | Package as `.vsix` |

---

## Documentation

| Document | Contents |
|----------|----------|
| [docs/INSTALL.md](docs/INSTALL.md) | Installation, prerequisites, build from source |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Detailed usage for each sidebar card |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Codebase structure, adapter pattern, data flow |
| [docs/TESTING.md](docs/TESTING.md) | Running tests, writing new tests, test conventions |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history and release notes |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Diagnostics and troubleshooting |

---

## Contributing

Open an issue to discuss proposed changes before submitting a pull request. All contributions must maintain the project's core principle: **real telemetry only** — no simulated or mocked data in production code paths.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for guidance on adding new adapters.

---

## License

See [LICENSE](./LICENSE) for details.
