import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/icons';
import '@xterm/xterm/css/xterm.css';

export function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
      fontSize: 14,
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        cursorAccent: '#0a0a0a',
        black: '#1a1a1a',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    const sessionHash = getSessionHash();
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/terminal?sessionHash=${sessionHash}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' || msg.type === 'connected') {
          const data = msg.type === 'connected' ? msg.data : msg.data;
          if (msg.type === 'connected' && data && !connected) {
            term.write(`\x1b[32mConnected to ${data.shell}\x1b[0m\r\n`);
          } else if (msg.type === 'output') {
            term.write(msg.data);
          }
        } else if (msg.type === 'error') {
          setError(msg.data || 'Terminal error');
        } else if (msg.type === 'exit') {
          term.write(`\r\n\x1b[33mProcess exited with code ${msg.exitCode}\x1b[0m\r\n`);
          setConnected(false);
        }
      } catch {
        // binary or plain text — write as-is
        term.write(event.data);
      }
    };

    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 4001) {
        setError('Authentication required');
      } else if (e.code !== 1000) {
        setError(`Connection closed (code ${e.code})`);
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    wsRef.current = ws;

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Ping to keep alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(pingInterval);
      ws.close(1000, 'Component unmounted');
      term.dispose();
    };
  }, []);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => fitAddonRef.current?.fit(), 0);
  };

  const baseHeight = 'h-[calc(100vh-48px-36px-48px)]';
  const fullscreenHeight = 'h-screen';

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}>
      <div className={isFullscreen ? 'flex flex-col h-full' : baseHeight + ' bg-black flex flex-col'}>
        <div className="flex items-center justify-between bg-background-secondary border-b border-border-tertiary px-4 py-2">
          <div className="flex items-center gap-2">
            <Icon name="icon-terminal" size={16} className={connected ? 'text-foreground-success' : 'text-foreground-tertiary'} />
            <span className="text-small font-medium">Terminal</span>
            {connected && <span className="text-meta text-foreground-success">● connected</span>}
            {error && <span className="text-meta text-foreground-danger">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="small" onClick={() => fitAddonRef.current?.fit()}>
              <Icon name="icon-external-link" size={15} />
            </Button>
            <Button variant="ghost" size="small" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 overflow-hidden" />

        <div className="bg-background-tertiary border-t border-border-tertiary px-4 py-2">
          <div className="flex items-center gap-4 text-meta text-foreground-tertiary">
            <span>xterm.js + WebSocket terminal</span>
            <span>•</span>
            <span>Press ESC to exit fullscreen</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSessionHash(): string {
  const match = document.cookie.match(/(?:^|;\s*)sf_session=([^;]+)/);
  if (!match) return '';
  // Simple hash simulation — in production this would be SHA-256 of the session ID
  // The server validates this hash server-side
  let hash = 0;
  const sessionId = match[1];
  for (let i = 0; i < sessionId.length; i++) {
    const char = sessionId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}