'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getAccessToken } from '@/lib/api-client';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPage() {
  const params = useParams();
  const serverId = params.id as string;
  const termRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(termRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;

    // Connect WebSocket
    const token = getAccessToken();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:4000`;
    const ws = new WebSocket(`${wsUrl}/ws/terminal?serverId=${serverId}&ticket=${token}`);

    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'output':
            term.write(Buffer.from(msg.data, 'base64').toString());
            break;
          case 'connected':
            setConnected(true);
            term.focus();
            break;
          case 'exit':
            term.write('\r\n\x1b[90m— Connection closed —\x1b[0m\r\n');
            setConnected(false);
            break;
          case 'error':
            setError(msg.data);
            setConnected(false);
            break;
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
      setConnected(false);
    };

    // Send terminal input
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          data: Buffer.from(data).toString('base64'),
        }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN && term.cols && term.rows) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        }));
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(termRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [serverId]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Terminal</h2>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-xs text-muted-foreground">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-sm text-destructive">{error}</div>
      )}
      <div ref={termRef} className="flex-1 p-2 bg-[#1e1e2e]" />
    </div>
  );
}
