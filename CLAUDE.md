# Agent Instructions

## Project Overview

**AgentLens** is a VS Code sidebar extension that provides real-time visibility into AI agent context window usage, model detection, file tracking, and documentation health. This project uses **zero simulated data** — every metric must come from real telemetry.

## Architecture

The codebase follows a layered architecture:

- **`src/core/`** — Core logic for context window tracking, token counting, and telemetry aggregation.
- **`src/adapters/`** — Adapters for detecting and interfacing with specific AI agents/models (e.g., Copilot, Cursor, Cline).
- **`src/providers/`** — VS Code tree view providers, webview providers, and data providers that supply the UI with real-time metrics.
- **`src/extension.ts`** — Extension entry point; registers commands, providers, and lifecycle hooks.
- **`src/types.ts`** — Shared TypeScript type definitions used across all layers.
- **`src/test/`** — Unit and integration tests.

## Key Principles

1. **No simulated or mock data in production paths.** Every displayed metric must originate from real telemetry. If a data source is unavailable, display "unavailable" — never fabricate values.
2. **Type safety.** Use the shared types in `types.ts`. Do not use `any` without explicit justification.
3. **Separation of concerns.** Adapters should not import from providers. Core modules should not depend on VS Code APIs directly — use dependency injection or interfaces.
4. **Incremental compilation.** Use `npm run watch:ext` and `npm run watch:webview` during development for fast feedback.

## Build & Development

| Command | Purpose |
|---|---|
| `npm run compile` | Full build (extension + webview) |
| `npm run compile:ext` | Compile extension TypeScript only |
| `npm run compile:webview` | Compile webview assets only |
| `npm run watch:ext` | Watch mode for extension source |
| `npm run watch:webview` | Watch mode for webview source |
| `npm run test` | Run all tests |
| `npm run package` | Package the extension as a `.vsix` |

## Coding Guidelines

- Write all new code in **TypeScript**.
- Place adapter implementations in `src/adapters/` with a consistent naming pattern (e.g., `copilot.adapter.ts`).
- Place VS Code-specific providers in `src/providers/`.
- Keep core telemetry logic in `src/core/` free of VS Code API imports.
- Every new module should have corresponding tests in `src/test/`.
- Use descriptive, specific names — avoid generic names like `utils.ts` or `helpers.ts`.

## Testing

- Run tests with `npm run test` before submitting any changes.
- Tests must not rely on network calls or active AI agent sessions. Use dependency injection to supply test doubles for external interfaces.
- Ensure no test introduces simulated telemetry data that could leak into production code paths.

## Adding a New Adapter

1. Create a new file in `src/adapters/` (e.g., `newagent.adapter.ts`).
2. Implement the adapter interface defined in `src/types.ts`.
3. Register the adapter in the detection pipeline within `src/core/`.
4. Add tests in `src/test/` covering detection, data extraction, and unavailability handling.

## Common Pitfalls

- **Do not** hardcode token limits — read them from model metadata via adapters.
- **Do not** display percentages or counts unless backed by a real data source.
- **Do not** add VS Code API calls inside `src/core/` — this breaks testability and separation of concerns.