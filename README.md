# README

# AgentLens v3 — AI Agent Context Intelligence

Real-time visibility into AI agent context window usage, model detection, file tracking, and documentation health for VS Code. **Zero simulated data** — every metric comes from real telemetry.

---

## Overview

AgentLens is a VS Code sidebar extension that monitors what your AI coding agent is doing with its context window. It tells you:

- **Context window utilization** — how full the context window is (as a percentage and token count)
- **Model detection** — which model is active and what its capabilities and limits are
- **File tracking** — which files are currently loaded into context and how many tokens each consumes
- **Documentation health** — whether your project docs are up to date, complete, and accessible to the agent

AgentLens bridges the gap between you and your AI assistant by surfacing the information that's normally invisible. No mock data, no estimates — only real telemetry captured from actual agent activity.

### Architecture

The project is organized into the following source structure:

| Directory | Purpose |
|-----------|---------|
| `core/` | Core logic for context tracking, token counting, and telemetry aggregation |
| `adapters/` | Integration adapters for different AI agent providers and protocols |
| `providers/` | VS Code tree view and webview data providers |
| `test/` | Unit and integration tests |
| `extension.ts` | Extension entry point and activation logic |
| `types.ts` | Shared TypeScript type definitions |

---

## Getting Started

### Prerequisites

- **VS Code** 1.80 or later
- **Node.js** 16+ and npm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/agentlens.git
   cd agentlens
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the project:

   ```bash
   npm run compile
   ```

4. Press **F5** in VS Code to launch the Extension Development Host.

### Build Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Full build (extension + webview) |
| `npm run compile:ext` | Compile the extension source only |
| `npm run compile:webview` | Compile the webview UI only |
| `npm run watch:ext` | Watch mode for extension source |
| `npm run watch:webview` | Watch mode for webview UI |
| `npm run test` | Run the test suite |
| `npm run package` | Package the extension as a `.vsix` file |

---

## Usage

### Opening the Sidebar

Once installed, click the **AgentLens** icon in the VS Code Activity Bar to open the sidebar panel. The dashboard begins collecting telemetry immediately.

### Context Window Monitor

The primary view shows a real-time gauge of your agent's context window consumption. The display includes:

- **Token count** — current tokens in context vs. the model's maximum
- **Utilization percentage** — a visual progress indicator
- **Warning thresholds** — alerts when context usage exceeds 80% or 95%

### Model Detection

AgentLens automatically detects the active AI model through its adapters and displays:

- Model name and provider
- Maximum context length
- Known capabilities and constraints

### File Tracking

The file tracker lists every file currently loaded into the agent's context, sorted by token cost. Use this to identify files that are consuming disproportionate context space and consider excluding or summarizing them.

### Documentation Health

AgentLens scans your workspace for documentation files and reports:

- Missing or stale docs
- Coverage gaps relevant to agent-loaded source files
- Suggestions for improving agent-readability

---

## Development

For local development, run the extension and webview watchers in parallel:

```bash
npm run watch:ext
npm run watch:webview
```

Then press **F5** to launch the Extension Development Host. Changes to the extension source will recompile automatically.

### Running Tests

```bash
npm run test
```

Tests are located in the `src/test/` directory and cover core logic, adapter integrations, and provider behavior.

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request. Ensure all tests pass and maintain the project's commitment to **real telemetry only** — no simulated or mocked data in production code paths.

---

## License

See [LICENSE](./LICENSE) for details.