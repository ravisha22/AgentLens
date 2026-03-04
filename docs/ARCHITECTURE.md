# Architecture

## Overview

AgentLens is a VS Code extension that provides real-time telemetry and observability into AI agent behavior within the editor. The architecture follows a modular, event-driven design built around three core pillars: **adapters** for external AI agent integration, **core** logic for telemetry processing and state management, and **providers** for rendering data into VS Code's UI (sidebar webview, tree views, etc.).

The system enforces a strict **zero simulated data** policy — all metrics (context window usage, model detection, file tracking, documentation health) are derived from real-time signals captured during actual agent interactions.

## Components

### `extension.ts` — Entry Point

The main activation point for the VS Code extension. Registers commands, initializes core services, wires up adapters and providers, and manages the extension lifecycle.

### `core/`

Contains the central business logic:

- **Context Window Tracker** — Monitors token usage and calculates context window utilization as both raw counts and percentages.
- **Model Detector** — Identifies the active AI model (e.g., GPT-4, Claude, Codex) from real telemetry signals.
- **File Tracker** — Tracks which files the agent reads, references, or modifies during a session.
- **Documentation Health Analyzer** — Evaluates the state of project documentation relative to agent activity.

### `adapters/`

Adapters serve as the integration layer between AgentLens and external AI agents or copilot-style tools. Each adapter normalizes agent-specific telemetry into a common internal format defined in `types.ts`. This abstraction allows AgentLens to support multiple AI agents without coupling core logic to any single provider's API.

### `providers/`

VS Code UI providers that surface processed telemetry to the user:

- **Webview Provider** — Renders the sidebar panel with real-time visualizations (context window gauge, model info, file activity).
- **Tree Data Providers** — Populate tree views for structured data such as tracked files and documentation health status.

### `types.ts`

Shared TypeScript type definitions and interfaces used across all modules. Defines contracts for telemetry events, model metadata, context window state, and adapter output shapes.

### `test/`

Unit and integration tests validating core logic, adapter behavior, and provider rendering. Executed via the `test` script and supported by VS Code's integrated test runner.

## Data Flow

```
┌─────────────────────┐
│   AI Agent / Tool    │
│  (Copilot, Cursor,  │
│   Claude, etc.)      │
└────────┬────────────┘
         │ raw telemetry signals
         ▼
┌─────────────────────┐
│     Adapters        │
│  Normalize events   │
│  into common types  │
└────────┬────────────┘
         │ standardized telemetry events
         ▼
┌─────────────────────┐
│       Core          │
│ ┌─────────────────┐ │
│ │ Context Tracker │ │
│ │ Model Detector  │ │
│ │ File Tracker    │ │
│ │ Doc Health      │ │
│ └─────────────────┘ │
└────────┬────────────┘
         │ processed state
         ▼
┌─────────────────────┐
│     Providers       │
│  Webview (sidebar)  │
│  Tree Views         │
└────────┬────────────┘
         │ rendered UI
         ▼
┌─────────────────────┐
│   VS Code Sidebar   │
│   (User-facing)     │
└─────────────────────┘
```

1. **Capture** — Adapters listen for telemetry signals emitted by the active AI agent or tool within VS Code.
2. **Normalize** — Raw signals are transformed into common event types defined in `types.ts`, decoupling the core from agent-specific formats.
3. **Process** — Core modules consume normalized events to compute derived state: current token usage ($\frac{\text{tokens used}}{\text{context window size}} \times 100\%$), active model identity, file access history, and documentation health scores.
4. **Render** — Providers subscribe to core state changes and push updates to VS Code's webview and tree view APIs, giving users a live dashboard in the sidebar.

## Build & Compilation

The project uses a dual-compilation strategy:

- **`compile:ext`** / **`watch:ext`** — Compiles the extension host code (TypeScript → JavaScript).
- **`compile:webview`** / **`watch:webview`** — Bundles the sidebar webview frontend independently.
- **`compile`** — Runs both compilation targets in sequence.
- **`package`** — Produces a distributable `.vsix` package for installation.

This separation ensures the extension backend and webview frontend can be developed, tested, and iterated on independently.