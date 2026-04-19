import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

type Props = {
  onTerminal: (term: XTerm | null) => void;
  onResize?: (cols: number, rows: number) => void;
};

export function Terminal({ onTerminal, onResize }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new XTerm({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: { background: '#0d1117' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    const runFit = () => {
      if (host.clientWidth === 0 || host.clientHeight === 0) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      onResizeRef.current?.(term.cols, term.rows);
    };

    // Defer until layout: open + immediate fit() often sees 0×0 in flex panels and breaks xterm.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        runFit();
        onTerminalRef.current(term);
      });
    });

    const ro = new ResizeObserver(() => {
      runFit();
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      onTerminalRef.current(null);
      term.dispose();
    };
  }, []);

  return <div className="h-full w-full" ref={hostRef} />;
}
