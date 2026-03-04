# AgentLens - AI Agent Context Intelligence

> Real-time visibility into what your AI coding agent is doing with its context window.

---

## Overview

AgentLens is a VS Code sidebar extension that surfaces the information normally hidden between you and your AI assistant — context usage, active model, files loaded into context, documentation health, and inferred agent behavior. Every metric comes from real telemetry. **No simulated data.**

Whether you're debugging prompt bloat, tracking which files your agent is referencing, or monitoring token consumption in real time, AgentLens gives you a transparent window into the agent's decision-making environment — without leaving your editor.

---

## What It Does

| Card | What You See |
|------|-------------|
| **Context Window** | Token count, utilization percentage, and capacity for the active model |
| **Model Detection** | Automatically identifies the AI model currently in use |
| **File Tracking** | Lists files loaded into the agent's context with size and relevance |
| **Documentation Health** | Scores the quality and coverage of docs referenced by the agent |
| **Agent Behavior** | Inferred activity patterns based on real telemetry signals |

---

## Getting Started

### Prerequisites

- [Visual Studio Code](https://code.visualstudio.com/) v1.80.0 or later
- Node.js v18+

### Installation

#### Option A — Install from VSIX (recommended)

Download the latest pre-built package directly from this repository:

1. Go to the [`VSIX/`](./VSIX/) folder in this repo and download `agentlens-4.3.0.vsix`.
2. Open VS Code → Extensions (`Ctrl+Shift+X`) → `...` → **Install from VSIX...**
3. Select the downloaded file and reload when prompted.

#### Option B — Build from source

```bash
git clone https://github.com/ravisha22/AgentLens.git
cd AgentLens
npm install
```

### Build

Compile the full project (extension + webview):

```bash
npm run compile
```

Or compile individually:

```bash
npm run compile:ext       # Extension host only
npm run compile:webview   # Webview UI only
```

### Run in Development

1. Open the project in VS Code.
2. Start the watchers in separate terminals:

```bash
npm run watch:ext
npm run watch:webview
```

3. Press **F5** to launch the Extension Development Host.
4. Open the **AgentLens** panel from the sidebar.

### Package

```bash
npm run package
```

This produces a `.vsix` file you can install locally or distribute.

---

## Usage

Once the extension is active, the **AgentLens** sidebar panel appears automatically. Each card updates in real time as you interact with your AI coding assistant.

### Viewing Context Usage

Open the sidebar and check the **Context Window** card. It displays current token utilization against the model's maximum capacity, helping you understand when context is getting crowded and performance may degrade.

### Monitoring Files in Context

The **File Tracking** card shows exactly which files have been loaded into the agent's context. Use this to verify the agent is referencing the right sources — or to catch unnecessary files inflating your token budget.

### Checking Documentation Health

The **Documentation Health** card evaluates referenced documentation for completeness and freshness, giving you actionable signals about whether the agent has enough high-quality context to work effectively.

---

## Project Structure

```
src/
├── extension.ts       # Extension entry point
├── types.ts           # Shared type definitions
├── core/              # Core telemetry engine and context tracking
├── adapters/          # Integrations with AI provider APIs
├── providers/         # VS Code tree/webview data providers
└── test/              # Unit and integration tests
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run compile` | Full build (extension + webview) |
| `npm run compile:ext` | Compile extension host code |
| `npm run compile:webview` | Compile webview UI |
| `npm run watch:ext` | Watch mode for extension code |
| `npm run watch:webview` | Watch mode for webview UI |
| `npm test` | Run the test suite |
| `npm run package` | Package as `.vsix` |

---

## Running Tests

```bash
npm test
```

Tests live in `src/test/` and validate core telemetry logic, adapter behavior, and provider output.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes with clear messages.
4. Open a pull request against `main`.

Please ensure `npm test` passes and there are no TypeScript compilation errors before submitting.

---

## License

MIT

---

> **AgentLens** — because you should see what your agent sees.