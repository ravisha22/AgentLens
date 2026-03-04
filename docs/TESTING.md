# Test Documentation

## Project: AgentLens

**Version:** 3.x
**Description:** Real-time visibility into AI agent context window, model detection, file tracking, and documentation health for VS Code. No simulated data — only real telemetry.

---

## Table of Contents

- [Overview](#overview)
- [Test Environment](#test-environment)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Test Categories](#test-categories)
  - [Unit Tests](#unit-tests)
  - [Integration Tests](#integration-tests)
  - [Extension Tests](#extension-tests)
- [Module Coverage](#module-coverage)
  - [Core](#core)
  - [Adapters](#adapters)
  - [Providers](#providers)
  - [Extension Entry Point](#extension-entry-point)
  - [Types](#types)
- [Test Conventions](#test-conventions)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

AgentLens employs a comprehensive testing strategy to ensure the reliability of all telemetry pipelines, context window calculations, model detection, file tracking, and documentation health scoring. Because the project's core promise is **zero simulated data**, tests rigorously validate that every metric originates from real telemetry sources and that no mock or synthetic values leak into production paths.

---

## Test Environment

| Requirement | Details |
|---|---|
| **Runtime** | Node.js (LTS recommended) |
| **Test Framework** | Located under `src/test/` |
| **IDE** | Visual Studio Code (for extension integration tests) |
| **Build Prerequisites** | Run `npm run compile` (or `npm run compile:ext` and `npm run compile:webview`) before testing |

---

## Running Tests

### Full Test Suite

```bash
npm run test
```

### Development Workflow

1. **Compile the extension and webview:**

   ```bash
   npm run compile
   ```

2. **Run tests:**

   ```bash
   npm run test
   ```

3. **Watch mode (for iterative development):**

   ```bash
   # Terminal 1 — watch extension source
   npm run watch:ext

   # Terminal 2 — watch webview source
   npm run watch:webview
   ```

   Then re-run `npm run test` as needed, or use the VS Code integrated test runner.

### Running Tests in VS Code

1. Open the **Testing** sidebar panel (`Ctrl+Shift+T` / `Cmd+Shift+T`).
2. Discover and run individual tests or the full suite.
3. View results inline in the editor and in the **Output** pane.

---

## Test Structure

```
src/
└── test/
    ├── suite/
    │   ├── core/              # Unit tests for core modules
    │   ├── adapters/          # Tests for adapter implementations
    │   ├── providers/         # Tests for VS Code providers
    │   ├── extension.test.ts  # Extension lifecycle tests
    │   └── index.ts           # Test runner entry point
    └── fixtures/              # Sample data and test fixtures
```

---

## Test Categories

### Unit Tests

**Scope:** Individual functions, classes, and modules in isolation.

| Area | What is Tested |
|---|---|
| Token counting | Accurate token estimation across different model tokenizers |
| Context window calculation | Percentage utilization, boundary conditions ($0\%$, $100\%$, overflow) |
| Model detection | Correct identification of AI model from telemetry signals |
| File tracking | Detection of files entering/leaving the context window |
| Documentation health scoring | Metric computation from real file analysis |
| Type validation | Correctness of shared type definitions in `types.ts` |

**Key invariant:** No test should rely on hardcoded or simulated telemetry values. All test inputs must represent structurally valid telemetry payloads.

### Integration Tests

**Scope:** Interaction between multiple modules (e.g., adapters → core → providers).

| Scenario | Description |
|---|---|
| Adapter-to-core pipeline | Validates that adapter output is correctly consumed by core processing logic |
| Provider data flow | Ensures providers surface accurate data from core computations to the webview |
| End-to-end context tracking | A telemetry event flows from adapter ingestion through to rendered UI state |

### Extension Tests

**Scope:** VS Code extension lifecycle and API integration.

| Scenario | Description |
|---|---|
| Activation | Extension activates without errors on supported VS Code versions |
| Deactivation | Graceful cleanup of subscriptions, watchers, and telemetry listeners |
| Command registration | All contributed commands are registered and executable |
| Sidebar webview | Webview panel loads, receives messages, and renders correctly |

---

## Module Coverage

### Core

The `core/` module contains the primary business logic.

| Component | Tests Cover |
|---|---|
| Context window engine | Token budget tracking, utilization percentage ($\frac{\text{used tokens}}{\text{max tokens}} \times 100$), overflow detection |
| Telemetry processor | Parsing, validation, and routing of raw telemetry events |
| Documentation health analyzer | File-level and project-level health score computation |
| File tracker | Active file set management, add/remove/update operations |

### Adapters

The `adapters/` module provides integrations with different AI agent backends.

| Component | Tests Cover |
|---|---|
| Adapter interface compliance | Each adapter satisfies the shared adapter contract |
| Telemetry extraction | Correct extraction of model name, token counts, and file lists from raw agent data |
| Error resilience | Graceful handling of malformed, missing, or unexpected telemetry payloads |
| Real data integrity | Verification that no adapter injects synthetic or placeholder values |

### Providers

The `providers/` module exposes data to the VS Code UI layer.

| Component | Tests Cover |
|---|---|
| Tree data providers | Correct tree item generation for sidebar views |
| Webview providers | Message serialization/deserialization between extension host and webview |
| Decoration providers | Accurate file decoration based on context window membership |
| Refresh behavior | Providers update when underlying data changes |

### Extension Entry Point

| Component | Tests Cover |
|---|---|
| `extension.ts` — `activate()` | Dependency wiring, subscription registration, provider initialization |
| `extension.ts` — `deactivate()` | Resource disposal, listener teardown |

### Types

| Component | Tests Cover |
|---|---|
| `types.ts` | Type guard functions (if any), enum completeness, serialization round-trips |

---

## Test Conventions

### Naming

- Test files mirror source files: `core/contextEngine.ts` → `test/suite/core/contextEngine.test.ts`
- Test names follow the pattern: `should <expected behavior> when <condition>`

### Assertions

- Use descriptive assertion messages.
- Prefer strict equality checks.
- For floating-point comparisons (e.g., utilization percentages), use an epsilon tolerance:

$$
|actual - expected| < \epsilon \quad \text{where } \epsilon = 0.001
$$

### No Simulated Data

This is the project's **cardinal rule**. Tests must:

1. **Never** inject fake telemetry that mimics a real agent response.
2. Use clearly labeled **fixtures** that represent the *structure* of real telemetry without claiming to be live data.
3. Assert that production code paths have no fallback to generated/placeholder values.

### Isolation

- External dependencies (file system, VS Code API, network) should be stubbed at the boundary.
- Core logic tests must run without a VS Code instance.
- Extension tests may require the VS Code test electron host.

---

## Continuous Integration

| Step | Command | Purpose |
|---|---|---|
| 1. Install | `npm install` | Restore dependencies |
| 2. Compile | `npm run compile` | Build extension and webview |
| 3. Lint | *(project-specific)* | Static analysis |
| 4. Test | `npm run test` | Execute full test suite |
| 5. Package | `npm run package` | Produce `.vsix` artifact (post-test) |

Tests **must pass** before packaging. A failing test suite should block any release artifact from being produced.

---

## Troubleshooting

| Issue | Resolution |
|---|---|
| Tests fail with "Cannot find module" | Run `npm run compile` before `npm run test` |
| Extension tests hang | Ensure no other VS Code instance is running the extension in debug mode |
| Token count mismatches | Verify the correct tokenizer is selected for the model under test |
| Webview tests fail silently | Check the **Output** pane → select the test runner channel for detailed logs |
| Stale build artifacts | Delete `out/` or `dist/` directories and recompile |

---

*This document should be updated whenever new test modules are added, testing conventions change, or the project's module structure evolves.*