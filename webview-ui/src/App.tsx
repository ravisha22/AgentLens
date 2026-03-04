import { ExtensionStateProvider } from './hooks/useExtensionState';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ContextPanel } from './components/context/ContextPanel';
import { AgentPanel } from './components/agent/AgentPanel';
import { FilePanel } from './components/files/FilePanel';
import { DocsPanel } from './components/docs/DocsPanel';
import { HealthPanel } from './components/health/HealthPanel';
import { TimelinePanel } from './components/timeline/TimelinePanel';
import { Section } from './components/layout/Section';

export default function App() {
  return (
    <ExtensionStateProvider>
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          <Section
            title="Context Window"
            defaultOpen
            tooltip={
              "AI model context window usage.\n\nZones:\n• Green: ≤59% — plenty of space\n• Amber: 60–79% — approaching limit\n• Red: ≥80% — critically full\n\nTokens used / max: input tokens consumed vs the model's total window size.\n\nOutput limit: max tokens the model can generate in one reply (separate from the input window).\n\nMode (e.g. Edit): the operating mode set in your AI tool."
            }
          >
            <ContextPanel />
          </Section>
          <Section
            title="Agent"
            defaultOpen
            tooltip={
              "Active AI agent sessions.\n\nStatus dot:\n• Green — active session running\n• Grey — installed, no active session\n• Red — agent not found\n\nTurns: conversation exchanges with the model.\nTools: function/tool calls made this session.\nFiles: files read or written by the agent.\nCompactions: times context was auto-compressed to free up space."
            }
          >
            <AgentPanel />
          </Section>
          <Section
            title="Files"
            defaultOpen
            tooltip={
              "Files your agent has read or written.\n\nDot colour (left of filename):\n• Green — in-context: loaded in the model's context window right now\n• Purple — pinned: always re-injected after compaction\n• Red — lost: was pinned but dropped after compaction; hit Re-inject to restore\n• Blue — modified: written or changed this session\n• Grey — watched: on the critical watchlist but not yet in context\n\nOrange ! — file is marked Critical and tracked on the watchlist above.\n\nToken cost — small number shown to the right of the filename; estimated context space the file occupies. Dash means size unknown.\n\nRow actions (always visible, dim until hovered):\n• ♡ / ❤  Pin or unpin the file as always-present — it will be re-injected automatically if lost after compaction.\n• ☆ / ★  Mark or unmark the file as critical — adds it to the watchlist and flags it when out of context."
            }
          >
            <FilePanel />
          </Section>
          <Section
            title="Documentation"
            defaultOpen
            tooltip={
              "Tracks project docs against a required manifest.\n\nScore 0–100 based on doc completeness:\n• Healthy — file exists and has content\n• Needs attention — exists but may be incomplete\n• Missing — file not found on disk\n\nUse 'Create Manifest' to define required docs. Use 'Edit manifest' to customise the list."
            }
          >
            <DocsPanel />
          </Section>
          <Section
            title="Health"
            defaultOpen
            tooltip={
              "Composite session health score (0–100).\n\nComponents:\n• Context Efficiency: how well the context window is used\n• Critical Files: key files present in context\n• Documentation: project doc coverage score\n• Session Stability: compaction frequency\n• Agent Response: session activity level"
            }
          >
            <HealthPanel />
          </Section>
          <Section
            title="Timeline"
            defaultOpen={false}
            tooltip={
              "Chronological log of session events.\n\nEvent types: session start, model changes, context compactions, file loads, and re-injections.\n\nShows the most recent 50 events with timestamps and context usage at the time of each event."
            }
          >
            <TimelinePanel />
          </Section>
        </div>
        <Footer />
      </div>
    </ExtensionStateProvider>
  );
}
