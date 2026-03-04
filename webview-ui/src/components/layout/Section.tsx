import { useState } from 'react';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: string;
  tooltip?: string;
  children: React.ReactNode;
}

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={(e) => e.stopPropagation()}
      style={{ cursor: 'help', lineHeight: 0 }}
    >
      <sup style={{ fontSize: '0.7em', lineHeight: 0, verticalAlign: 'super' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '11px',
            height: '11px',
            fontSize: '8px',
            fontWeight: 'bold',
            borderRadius: '50%',
            border: '1px solid currentColor',
            opacity: visible ? 1 : 0.4,
            transition: 'opacity 0.15s',
            userSelect: 'none',
          }}
        >
          i
        </span>
      </sup>
      {visible && (
        <span
          style={{
            position: 'absolute',
            zIndex: 50,
            left: '14px',
            top: '-2px',
            width: '220px',
            padding: '8px 10px',
            fontSize: '10px',
            lineHeight: '1.5',
            borderRadius: '4px',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            fontWeight: 'normal',
            textTransform: 'none',
            letterSpacing: 'normal',
            textAlign: 'justify',
            backgroundColor: 'var(--vscode-editorHoverWidget-background, #252526)',
            color: 'var(--vscode-editorHoverWidget-foreground, #cccccc)',
            border: '1px solid var(--vscode-editorHoverWidget-border, #454545)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function Section({ title, defaultOpen = true, badge, badgeColor, tooltip, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border vsc-border rounded">
      <button
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: 'transparent', border: 'none', color: 'inherit' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px]">{isOpen ? '\u25BC' : '\u25B6'}</span>
          <span>{title}</span>
          {badge !== undefined && (
            <span
              className="vsc-badge"
              style={badgeColor ? { backgroundColor: badgeColor + '22', color: badgeColor } : {}}
            >
              {badge}
            </span>
          )}
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
      </button>
      {isOpen && <div className="px-2.5 pb-2">{children}</div>}
    </div>
  );
}
