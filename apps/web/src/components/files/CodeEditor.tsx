import { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { php } from '@codemirror/lang-php';
import { oneDark } from '@codemirror/theme-one-dark';
import { ArrowLeft, Search, Replace, Settings, Download, Upload, Save, Copy as CopyIcon, Check } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface CodeEditorProps {
  path: string;
  content: string;
  onSave: (content: string) => void;
  onBack: () => void;
}

export function CodeEditor({ path, content: initialContent, onSave, onBack }: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasChanges = content !== initialContent;

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, any> = {
      js: javascript(),
      jsx: javascript({ jsx: true }),
      ts: javascript({ typescript: true }),
      tsx: javascript({ typescript: true, jsx: true }),
      html: html(),
      htm: html(),
      css: css(),
      scss: css(),
      xml: xml(),
      yml: yaml(),
      yaml: yaml(),
      json: json(),
      php: php(),
      phtml: php(),
    };
    return langMap[ext] || javascript();
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(content);
    setSaved(true);
    setIsSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBack = useCallback(() => {
    if (hasChanges) {
      setShowDiscardDialog(true);
    } else {
      onBack();
    }
  }, [hasChanges, onBack]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').pop() || 'file.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text);
    };
    reader.readAsText(file);
  };

  const handleSearch = () => {
    if (!searchQuery) return;
    // CodeMirror handles search internally
    const editor = document.querySelector('.cm-editor') as any;
    if (editor) {
      const searchState = editor.state.search(searchQuery);
      editor.dispatch({ effects: searchState });
    }
  };

  const handleReplace = () => {
    if (!searchQuery || !replaceQuery) return;
    // Simple replace - in production, you'd use CodeMirror's search/replace extensions
    const newContent = content.replace(new RegExp(searchQuery, 'g'), replaceQuery);
    setContent(newContent);
  };

  const handleReplaceAll = () => {
    if (!searchQuery || !replaceQuery) return;
    const newContent = content.split(searchQuery).join(replaceQuery);
    setContent(newContent);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2 bg-muted/50">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="rounded p-1 hover:bg-accent" title="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-medium font-mono text-sm">{path}</span>
          {hasChanges && <span className="text-xs text-orange-500 font-medium">• Modified</span>}
        </div>
        
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-green-500 flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>}
          <button
            onClick={handleCopy}
            className="rounded p-1.5 hover:bg-accent flex items-center gap-1.5"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-500">Copied!</span>
              </>
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </button>
          <button onClick={() => setSearchOpen(!searchOpen)} className={`rounded p-1.5 hover:bg-accent ${searchOpen ? 'bg-accent' : ''}`} title="Find & Replace">
            <Search className="h-4 w-4" />
          </button>
          <button onClick={handleDownload} className="rounded p-1.5 hover:bg-accent" title="Download">
            <Download className="h-4 w-4" />
          </button>
          <label className="rounded p-1.5 hover:bg-accent cursor-pointer" title="Upload">
            <Upload className="h-4 w-4" />
            <input type="file" onChange={handleFileUpload} className="hidden" accept=".txt,.js,.ts,.jsx,.tsx,.html,.css,.json,.xml,.yaml,.yml,.php" />
          </label>
          <button onClick={handleSave} disabled={isSaving || !hasChanges} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Search & Replace Bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-border px-6 py-2 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Find..."
              className="rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm w-40"
            />
          </div>
          <div className="relative">
            <Replace className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm w-40"
            />
          </div>
          <button onClick={handleSearch} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Find
          </button>
          <button onClick={handleReplace} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Replace
          </button>
          <button onClick={handleReplaceAll} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Replace All
          </button>
        </div>
      )}

      {/* Code Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          height="100%"
          theme={oneDark}
          extensions={[getLanguage(path)]}
          onChange={(value: string) => setContent(value)}
          className="text-sm font-mono"
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-border px-6 py-1.5 bg-muted/50 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Lines: {content.split('\n').length}</span>
          <span>Characters: {content.length}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded p-1 hover:bg-accent" title="Editor Settings">
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Unsaved Changes Confirmation */}
      <ConfirmDialog
        open={showDiscardDialog}
        title="Discard Changes?"
        message="You have unsaved changes. Discard changes?"
        confirmText="Discard"
        cancelText="Keep Editing"
        variant="warning"
        onConfirm={() => {
          setShowDiscardDialog(false);
          onBack();
        }}
        onCancel={() => setShowDiscardDialog(false)}
      />
    </div>
  );
}
