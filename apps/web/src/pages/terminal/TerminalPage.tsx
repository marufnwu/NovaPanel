import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/icons';

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: Date;
}

export function TerminalPage() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      type: 'output',
      content: 'NovaPanel Terminal v1.0.0',
      timestamp: new Date(),
    },
    {
      type: 'output',
      content: 'Type "help" for available commands. Press ESC to exit fullscreen.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      const command = input.trim();
      setLines((prev) => [
        ...prev,
        { type: 'input', content: `$ ${command}`, timestamp: new Date() },
      ]);

      if (command.toLowerCase() === 'clear') {
        setLines([]);
      } else if (command.toLowerCase() === 'help') {
        setLines((prev) => [
          ...prev,
          {
            type: 'output',
            content: 'Available commands: help, clear, date, whoami, pwd',
            timestamp: new Date(),
          },
        ]);
      } else if (command.toLowerCase() === 'date') {
        setLines((prev) => [
          ...prev,
          { type: 'output', content: new Date().toString(), timestamp: new Date() },
        ]);
      } else if (command.toLowerCase() === 'whoami') {
        setLines((prev) => [
          ...prev,
          { type: 'output', content: 'admin', timestamp: new Date() },
        ]);
      } else if (command.toLowerCase() === 'pwd') {
        setLines((prev) => [
          ...prev,
          { type: 'output', content: '/home/admin', timestamp: new Date() },
        ]);
      } else {
        setLines((prev) => [
          ...prev,
          {
            type: 'error',
            content: `command not found: ${command}`,
            timestamp: new Date(),
          },
        ]);
      }

      setInput('');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const baseHeight = 'h-[calc(100vh-48px-36px-48px)]';
  const fullscreenHeight = 'h-screen';

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}>
      <div className={isFullscreen ? 'flex flex-col h-full' : baseHeight + ' bg-black flex flex-col'}>
        <div className="flex items-center justify-between bg-background-secondary border-b border-border-tertiary px-4 py-2">
          <div className="flex items-center gap-2">
            <Icon name="icon-terminal" size={16} className="text-foreground-info" />
            <span className="text-small font-medium">Terminal</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="small" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        </div>

        <div
          ref={terminalRef}
          className="flex-1 overflow-auto p-4 font-mono text-meta"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          <div className="space-y-1">
            {lines.map((line, index) => (
              <div
                key={index}
                className={
                  line.type === 'input'
                    ? 'text-foreground-info'
                    : line.type === 'error'
                    ? 'text-foreground-danger'
                    : 'text-foreground-secondary'
                }
              >
                {line.content}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-background-secondary border-t border-border-tertiary p-4">
          <div className="flex items-center gap-2">
            <span className="text-foreground-info font-mono text-meta">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleCommand}
              className="flex-1 bg-transparent outline-none text-foreground-primary font-mono text-meta"
              placeholder="Enter command..."
              autoFocus
            />
          </div>
        </div>

        <div className="bg-background-tertiary border-t border-border-tertiary px-4 py-2">
          <div className="flex items-center gap-4 text-meta text-foreground-tertiary">
            <span>xterm.js terminal emulation</span>
            <span>•</span>
            <span>Press ESC to exit fullscreen</span>
          </div>
        </div>
      </div>
    </div>
  );
}