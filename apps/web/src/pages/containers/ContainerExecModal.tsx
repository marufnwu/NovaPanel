import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/icons';
import { Input } from '../../components/ui/Input';
import '@xterm/xterm/css/xterm.css';

interface ContainerExecModalProps {
  isOpen: boolean;
  onClose: () => void;
  containerId: string;
  containerName: string;
}

export function ContainerExecModal({ isOpen, onClose, containerId, containerName }: ContainerExecModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
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
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    const sessionHash = getSessionHash();
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/containers/${containerId}/exec?sessionHash=${sessionHash}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      term.write(`\x1b[32mConnecting to container ${containerName}...\x1b[0m\r\n`);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          term.write(`\x1b[32mConnected to ${msg.data.containerName}\x1b[0m\r\n`);
          term.write(`\x1b[33mContainer ID: ${msg.data.containerId}\x1b[0m\r\n`);
          term.write('\r\n$ ');
        } else if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'error') {
          term.write(`\x1b[31mError: ${msg.data}\x1b[0m\r\n`);
        } else if (msg.type === 'exit') {
          term.write(`\r\n\x1b[33mProcess exited with code ${msg.exitCode}\x1b[0m\r\n`);
          setConnected(false);
        } else if (msg.type === 'shell_started') {
          term.write('\r\n\x1b[32mInteractive shell started\x1b[0m\r\n');
        }
      } catch {
        term.write(event.data);
      }
    };

    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 4004) {
        setError('Container not found');
      } else if (e.code === 4005) {
        setError('Container not running');
      } else if (e.code !== 1000) {
        setError(`Connection closed (code ${e.code})`);
      }
      term.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
      term.write('\r\n\x1b[31mConnection failed\x1b[0m\r\n');
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

    // Ping to keep alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [containerId, containerName]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        initTerminal();
      }, 100);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Modal closed');
        wsRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [isOpen, initTerminal]);

  const handleResize = () => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ type: 'exec', command: command.trim() }));
    setCommand('');
    setIsExecuting(true);

    // Reset executing state after a delay (simple approach)
    setTimeout(() => setIsExecuting(false), 1000);
  };

  const handleClearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.write('\x1b[32mTerminal cleared\x1b[0m\r\n');
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleDisconnect} />
      <div className="relative w-full max-w-4xl mx-4 bg-background-primary border border-border-tertiary rounded-xl overflow-hidden animate-fade-in" style={{ height: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-background-secondary border-b border-border-tertiary">
          <div className="flex items-center gap-3">
            <Icon name="icon-terminal" size={18} className={connected ? 'text-foreground-success' : 'text-foreground-tertiary'} />
            <div>
              <h2 className="text-card-title font-medium">Container Exec</h2>
              <p className="text-meta text-foreground-secondary">{containerName}</p>
            </div>
            {connected ? (
              <span className="px-2 py-0.5 text-meta bg-foreground-success/10 text-foreground-success rounded">Connected</span>
            ) : (
              <span className="px-2 py-0.5 text-meta bg-foreground-tertiary/10 text-foreground-tertiary rounded">Disconnected</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="small" onClick={handleResize} icon={<Icon name="icon-external-link" size={15} />} title="Fit terminal" />
            <Button variant="ghost" size="small" onClick={handleClearTerminal} icon={<Icon name="icon-trash" size={15} />} title="Clear terminal" />
            <button onClick={handleDisconnect} className="p-1.5 hover:bg-background-tertiary rounded-md" aria-label="Close">
              <Icon name="icon-x" size={18} />
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 120px)' }}>
          <div ref={terminalRef} className="h-full w-full bg-black" />
        </div>

        {/* Command Input */}
        <div className="px-4 py-3 bg-background-secondary border-t border-border-tertiary">
          <form onSubmit={handleCommandSubmit} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-background-tertiary rounded-md">
              <span className="text-foreground-tertiary">$</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command to execute..."
                className="flex-1 bg-transparent text-small font-mono text-foreground-primary outline-none placeholder:text-foreground-tertiary"
                disabled={!connected || isExecuting}
              />
            </div>
            <Button type="submit" variant="primary" size="small" loading={isExecuting} disabled={!connected || !command.trim()}>
              Execute
            </Button>
          </form>
          {error && (
            <p className="mt-2 text-small text-foreground-danger">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function getSessionHash(): string {
  const match = document.cookie.match(/(?:^|;\s*)sf_session=([^;]+)/);
  if (!match) return '';
  let hash = 0;
  const sessionId = match[1];
  for (let i = 0; i < sessionId.length; i++) {
    const char = sessionId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}