import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, Maximize2, Minimize2, Download, Plus, X, ClipboardPaste, Minus, RotateCw, Clock } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import '@xterm/xterm/css/xterm.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TerminalMessage {
  type: 'output' | 'connected' | 'error' | 'exit' | 'pong';
  data?: string;
  exitCode?: number;
  username?: string;
  shell?: string;
  homeDir?: string;
  role?: string;
}

interface TerminalTab {
  id: string;
  name: string;
  createdAt: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FONT_SIZE_KEY = 'np-terminal-font-size';
const SESSION_TIMEOUT_KEY = 'np-terminal-timeout';
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;
const DEFAULT_TIMEOUT_MINUTES = 30;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const WARNING_BEFORE_TIMEOUT_MINUTES = 5;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStoredFontSize(): number {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const size = parseInt(stored, 10);
      if (size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE) return size;
    }
  } catch (e) { console.error("Terminal error:", e); }
  return DEFAULT_FONT_SIZE;
}

function getStoredTimeout(): number {
  try {
    const stored = localStorage.getItem(SESSION_TIMEOUT_KEY);
    if (stored) {
      const val = parseInt(stored, 10);
      if (val >= 5 && val <= 480) return val;
    }
  } catch (e) { console.error("Terminal error:", e); }
  return DEFAULT_TIMEOUT_MINUTES;
}

function getWsUrl(sessionHash?: string | null): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${protocol}//${window.location.host}/ws/terminal`;
  // Use sessionHash query param for hash-based WS auth when available
  // Falls back to cookie-based auth when not provided
  if (sessionHash) {
    return `${base}?sessionHash=${encodeURIComponent(sessionHash)}`;
  }
  return base;
}

// ─── Single Terminal Instance Component ─────────────────────────────────────

interface TerminalInstanceProps {
  tabId: string;
  userId: string;
  fontSize: number;
  fullscreen: boolean;
  onStatusChange: (connected: boolean) => void;
}

function TerminalInstance({ tabId, userId, fontSize, fullscreen, onStatusChange }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const scrollbackRef = useRef<string[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const timeoutMinutes = getStoredTimeout();
  const sessionHash = useAuthStore((s) => s.sessionHash);

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectCountdown, setReconnectCountdown] = useState(0);
  const [showManualReconnect, setShowManualReconnect] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(timeoutMinutes * 60);

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange(connected);
  }, [connected, onStatusChange]);

  // ─── WebSocket Connection ───────────────────────────────────────────────

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setReconnecting(false);
    setReconnectCountdown(0);
    setShowManualReconnect(false);

    const ws = new WebSocket(getWsUrl(sessionHash));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectCountRef.current = 0;
      sessionStartRef.current = Date.now();
      setSessionTimeRemaining(timeoutMinutes * 60);
      setShowTimeoutWarning(false);

      // Send initial resize
      if (termRef.current && fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims) {
            ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
          }
        } catch (e) { console.error("Terminal error:", e); }
      }
    };

    ws.onclose = () => {
      setConnected(false);
      attemptReconnect();
    };

    ws.onerror = (e) => { console.error("WebSocket error:", e); };

    ws.onmessage = (event) => {
      try {
        const msg: TerminalMessage = JSON.parse(event.data);
        if (msg.type === 'output' && msg.data && termRef.current) {
          termRef.current.write(msg.data);
          // Store in scrollback for download
          scrollbackRef.current.push(msg.data);
          if (scrollbackRef.current.length > 50000) {
            scrollbackRef.current = scrollbackRef.current.slice(-40000);
          }
        } else if (msg.type === 'exit') {
          if (termRef.current) {
            termRef.current.write(`\r\n\x1b[33m[Process exited with code ${msg.exitCode}]\x1b[0m\r\n`);
          }
        } else if (msg.type === 'error' && msg.data && termRef.current) {
          termRef.current.write(`\r\n\x1b[31mError: ${msg.data}\x1b[0m\r\n`);
        }
      } catch (e) { console.error("Terminal error:", e); }
    };
  }, [userId, timeoutMinutes, sessionHash]);

  // ─── Auto-Reconnect ─────────────────────────────────────────────────────

  const attemptReconnect = useCallback(() => {
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setShowManualReconnect(true);
      setReconnecting(false);
      return;
    }

    reconnectCountRef.current++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
    const delayMs = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectCountRef.current - 1),
      MAX_RECONNECT_DELAY_MS
    );
    const delaySec = Math.round(delayMs / 1000);

    setReconnecting(true);
    setReconnectCountdown(delaySec);

    const countdownInterval = setInterval(() => {
      setReconnectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    reconnectTimerRef.current = setTimeout(() => {
      clearInterval(countdownInterval);
      connect();
    }, delayMs);
  }, [connect]);

  // ─── Initialize xterm.js ────────────────────────────────────────────────

  useEffect(() => {
    let terminal: any;
    let fitAddon: any;
    let webLinksAddon: any;

    const initTerminal = async () => {
      if (!containerRef.current) return;

      // Dynamic imports for xterm.js
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');

      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize,
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          cursorAccent: '#0d1117',
          selectionBackground: '#264f78',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        },
        allowProposedApi: true,
        scrollback: 10000,
        convertEol: false,
      });

      fitAddon = new FitAddon();
      webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(containerRef.current);

      // Initial fit
      setTimeout(() => {
        try { fitAddon.fit(); } catch (e) { console.error("Fit failed:", e); }
      }, 50);

      termRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Handle terminal input → WebSocket
      terminal.onData((data: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data }));
        }
      });

      // Welcome message
      terminal.writeln('\x1b[36m╭───────────────────────────────────────╮\x1b[0m');
      terminal.writeln('\x1b[36m│\x1b[0m  \x1b[1mNovaPanel Terminal\x1b[0m');
      terminal.writeln('\x1b[36m│\x1b[0m  \x1b[2mConnecting to server...\x1b[0m');
      terminal.writeln('\x1b[36m╰───────────────────────────────────────╯\x1b[0m');
      terminal.writeln('');

      // Connect WebSocket
      connect();
    };

    initTerminal();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (terminal) {
        terminal.dispose();
      }
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]); // Re-initialize only when tab changes

  // ─── Update font size ───────────────────────────────────────────────────

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      // Refit after font size change
      setTimeout(() => {
        try {
          if (fitAddonRef.current) fitAddonRef.current.fit();
        } catch (e) { console.error("Terminal error:", e); }
      }, 50);
    }
  }, [fontSize]);

  // ─── Window resize handler ──────────────────────────────────────────────

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
          }
        } catch (e) { console.error("Terminal error:", e); }
      }
    };

    window.addEventListener('resize', handleResize);
    // Also observe container for fullscreen changes
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [fullscreen]);

  // ─── Session Timeout Timer ──────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - sessionStartRef.current) / 1000;
      const remaining = Math.max(0, timeoutMinutes * 60 - elapsed);
      setSessionTimeRemaining(Math.floor(remaining));

      if (remaining <= WARNING_BEFORE_TIMEOUT_MINUTES * 60 && remaining > 0) {
        setShowTimeoutWarning(true);
      } else {
        setShowTimeoutWarning(false);
      }

      if (remaining <= 0 && connected) {
        // Session expired
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (termRef.current) {
          termRef.current.write('\r\n\x1b[33m[Session timed out. Reconnect to start a new session.]\x1b[0m\r\n');
        }
        setConnected(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeoutMinutes, connected]);

  // ─── Paste from Clipboard ───────────────────────────────────────────────

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
      }
    } catch (e) { console.error("Clipboard read failed:", e); }
  }, []);

  // ─── Download Log ───────────────────────────────────────────────────────

  const handleDownloadLog = useCallback(() => {
    const logContent = scrollbackRef.current.join('');
    // Strip ANSI escape codes for clean text output
    const cleanContent = logContent.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const blob = new Blob([cleanContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // ─── Extend Session ─────────────────────────────────────────────────────

  const handleExtendSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    setSessionTimeRemaining(timeoutMinutes * 60);
    setShowTimeoutWarning(false);
  }, [timeoutMinutes]);

  // ─── Format remaining time ──────────────────────────────────────────────

  const formatRemaining = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Expose methods via ref pattern ─────────────────────────────────────
  // Store handlers on the container element for parent access
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).__terminalHandlers = {
        paste: handlePaste,
        downloadLog: handleDownloadLog,
        reconnect: connect,
        getConnected: () => connected,
      };
    }
  }, [handlePaste, handleDownloadLog, connect, connected]);

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* xterm.js container */}
      <div ref={containerRef} className="flex-1 min-h-0" style={{ padding: '4px' }} />

      {/* Disconnected Overlay */}
      {!connected && !reconnecting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="h-3 w-3 rounded-full bg-red-500 mx-auto animate-pulse" />
            <p className="text-sm text-gray-400">Disconnected</p>
            {showManualReconnect ? (
              <button
                onClick={() => {
                  reconnectCountRef.current = 0;
                  setShowManualReconnect(false);
                  connect();
                }}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <RotateCw className="h-4 w-4" />
                Reconnect
              </button>
            ) : (
              <p className="text-xs text-gray-500">Attempting to reconnect...</p>
            )}
          </div>
        </div>
      )}

      {/* Reconnecting Overlay */}
      {reconnecting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm">
          <div className="text-center space-y-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500 mx-auto animate-pulse" />
            <p className="text-sm text-gray-400">Reconnecting in {reconnectCountdown}s... (attempt {reconnectCountRef.current}/{MAX_RECONNECT_ATTEMPTS})</p>
          </div>
        </div>
      )}

      {/* Session Timeout Warning */}
      {showTimeoutWarning && connected && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 backdrop-blur-sm">
          <Clock className="h-4 w-4 text-yellow-500" />
          <div>
            <p className="text-xs font-medium text-yellow-600">
              Session expires in {formatRemaining(sessionTimeRemaining)}
            </p>
          </div>
          <button
            onClick={handleExtendSession}
            className="rounded-md bg-yellow-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-yellow-700 transition-colors"
          >
            Extend
          </button>
        </div>
      )}

      {/* Keyboard shortcuts help bar */}
      <div className="border-t border-gray-800 px-4 py-1.5 bg-[#0d1117]">
        <div className="flex flex-wrap gap-4 text-[10px] text-gray-500">
          <span><kbd className="rounded bg-gray-800 px-1">Ctrl+Shift+V</kbd> Paste</span>
          <span><kbd className="rounded bg-gray-800 px-1">Ctrl+C</kbd> Interrupt</span>
          <span><kbd className="rounded bg-gray-800 px-1">Ctrl+L</kbd> Clear</span>
          <span><kbd className="rounded bg-gray-800 px-1">Tab</kbd> Complete</span>
          <span><kbd className="rounded bg-gray-800 px-1">↑↓</kbd> History</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Terminal Page ─────────────────────────────────────────────────────

export function TerminalPage() {
  const { user } = useAuthStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(getStoredFontSize);
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: `term-${Date.now()}`, name: 'Terminal 1', createdAt: Date.now() },
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [tabStatuses, setTabStatuses] = useState<Record<string, boolean>>({});
  const tabContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ─── Font size controls ─────────────────────────────────────────────────

  const increaseFontSize = () => {
    setFontSize(prev => {
      const next = Math.min(prev + 1, MAX_FONT_SIZE);
      localStorage.setItem(FONT_SIZE_KEY, String(next));
      return next;
    });
  };

  const decreaseFontSize = () => {
    setFontSize(prev => {
      const next = Math.max(prev - 1, MIN_FONT_SIZE);
      localStorage.setItem(FONT_SIZE_KEY, String(next));
      return next;
    });
  };

  // ─── Tab management ─────────────────────────────────────────────────────

  const addTab = () => {
    const newTab: TerminalTab = {
      id: `term-${Date.now()}`,
      name: `Terminal ${tabs.length + 1}`,
      createdAt: Date.now(),
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) return; // Don't close last tab
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);

    // If closing the active tab, switch to adjacent
    if (activeTabId === tabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }

    setTabs(newTabs);
    // Clean up status
    setTabStatuses(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  const handleTabStatusChange = useCallback((tabId: string, connected: boolean) => {
    setTabStatuses(prev => ({ ...prev, [tabId]: connected }));
  }, []);

  // ─── Active tab actions ─────────────────────────────────────────────────

  const getActiveHandlers = () => {
    const container = tabContainerRefs.current[activeTabId];
    if (container) {
      return (container as any).__terminalHandlers as {
        paste: () => void;
        downloadLog: () => void;
        reconnect: () => void;
        getConnected: () => boolean;
      } | undefined;
    }
    return undefined;
  };

  const handlePaste = () => getActiveHandlers()?.paste();
  const handleDownloadLog = () => getActiveHandlers()?.downloadLog();
  const handleReconnect = () => getActiveHandlers()?.reconnect();

  return (
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-gray-950' : 'h-[calc(100vh-12rem)]'}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Terminal</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Font size controls */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-background px-1">
            <button
              onClick={decreaseFontSize}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Decrease font size"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-xs text-muted-foreground w-8 text-center">{fontSize}px</span>
            <button
              onClick={increaseFontSize}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Increase font size"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Connection status for active tab */}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${tabStatuses[activeTabId] ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {tabStatuses[activeTabId] ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Action buttons */}
          <button
            onClick={handlePaste}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Paste from clipboard"
          >
            <ClipboardPaste className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownloadLog}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Download terminal log"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={handleReconnect}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Reconnect"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-[#161b22]">
        <div className="flex items-center overflow-x-auto flex-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex items-center gap-2 border-r border-border px-4 py-2 cursor-pointer text-sm whitespace-nowrap transition-colors ${
                activeTabId === tab.id
                  ? 'bg-[#0d1117] text-foreground border-b-2 border-b-blue-500'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-[#0d1117]/50'
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tabStatuses[tab.id] ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="rounded p-0.5 text-gray-500 hover:bg-gray-700 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addTab}
          className="flex items-center gap-1 px-3 py-2 text-xs text-gray-400 hover:text-gray-300 hover:bg-[#0d1117]/50 transition-colors"
          title="Open new terminal tab"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Terminal instances — render all but only show active */}
      <div className="flex-1 min-h-0 bg-[#0d1117] relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => { tabContainerRefs.current[tab.id] = el; }}
            className={`absolute inset-0 flex flex-col ${activeTabId === tab.id ? 'z-0' : 'z-[-1] invisible'}`}
          >
            <TerminalInstance
              tabId={tab.id}
              userId={user?.id || ''}
              fontSize={fontSize}
              fullscreen={fullscreen}
              onStatusChange={(connected) => handleTabStatusChange(tab.id, connected)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}