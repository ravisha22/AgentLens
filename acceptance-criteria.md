# Acceptance Criteria

## Project: AgentLens — AI Agent Context Intelligence

---

## 1. Context Window Monitoring

- [ ] The extension **SHALL** display real-time context window utilization as both a percentage and an absolute token count.
- [ ] Token usage metrics **SHALL** be derived exclusively from real telemetry data — no simulated, mocked, or placeholder values in production.
- [ ] The context window display **SHALL** update automatically as the AI agent consumes or releases context.
- [ ] The extension **SHALL** clearly indicate when context window data is unavailable or when no agent session is active.

## 2. Model Detection

- [ ] The extension **SHALL** detect and display the currently active AI model in use by the coding agent.
- [ ] Model detection **SHALL** rely on real adapter signals, not hardcoded or assumed defaults.
- [ ] The extension **SHALL** gracefully handle scenarios where model identification is not possible, displaying an appropriate "unknown" or "undetected" state.

## 3. File Tracking

- [ ] The extension **SHALL** track which files are currently included in the AI agent's context.
- [ ] File tracking data **SHALL** reflect the actual files referenced or ingested by the agent — not inferred from editor state alone unless that is the true telemetry source.
- [ ] The file list **SHALL** update in real time as files enter or leave the context window.

## 4. Documentation Health

- [ ] The extension **SHALL** assess and report documentation health metrics for the active workspace or project.
- [ ] Health indicators **SHALL** be based on real analysis of documentation artifacts (e.g., presence, coverage, staleness).
- [ ] The extension **SHALL** surface actionable signals when documentation quality is degraded or missing.

## 5. VS Code Integration

- [ ] The extension **SHALL** render all information in a VS Code **sidebar panel** (Webview).
- [ ] The sidebar **SHALL** load without errors and render correctly across supported VS Code versions.
- [ ] The extension **SHALL** activate on demand and **SHALL NOT** degrade editor performance when idle.
- [ ] The extension **SHALL** compile and package successfully using the defined scripts: `compile`, `compile:ext`, `compile:webview`, `watch:ext`, `watch:webview`, and `package`.

## 6. Adapter Architecture

- [ ] The extension **SHALL** support a pluggable adapter layer (`adapters/`) for integrating with different AI agent providers.
- [ ] At least one adapter **SHALL** be functional and tested against a real agent workflow.
- [ ] Adding a new adapter **SHALL NOT** require modifications to core telemetry logic (`core/`).

## 7. Data Integrity — Zero Simulated Data

- [ ] **No production code path** SHALL emit, display, or persist fabricated, randomized, or simulated telemetry data.
- [ ] Any test fixtures or mock data **SHALL** be confined exclusively to the `test/` directory and test execution context.
- [ ] The extension **SHALL** clearly distinguish between "no data available" and "data present" — never filling gaps with synthetic values.

## 8. Testing

- [ ] The `test` script **SHALL** execute all unit tests and exit with a non-zero code on any failure.
- [ ] Tests **SHALL** cover core telemetry logic, adapter integration points, and provider resolution.
- [ ] All tests **SHALL** pass before a release build can be packaged.

## 9. Build & Packaging

- [ ] `compile` **SHALL** produce a clean, error-free build of both extension and webview components.
- [ ] `package` **SHALL** generate a valid `.vsix` file installable in VS Code.
- [ ] Watch modes (`watch:ext`, `watch:webview`) **SHALL** support incremental recompilation during development.

## 10. Type Safety

- [ ] All shared types **SHALL** be defined in `types.ts` and consumed consistently across `core/`, `adapters/`, and `providers/`.
- [ ] The project **SHALL** compile with **zero** TypeScript errors under strict mode.

---

## Definition of Done

A feature is considered **done** when:

1. All relevant acceptance criteria above are met.
2. Unit tests are written and passing.
3. The extension builds and packages without errors.
4. No simulated or placeholder data is present in any production code path.
5. The feature is reviewable in the VS Code sidebar with real telemetry.