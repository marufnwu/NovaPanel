import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface PageErrorBoundaryProps {
  children: ReactNode;
  title?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[PageErrorBoundary] Caught error:', error, errorInfo.componentStack);
  }

  handleGoBack = () => {
    window.history.back();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-sm rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h2 className="mb-2 text-base font-semibold text-red-400">
              {this.props.title ?? 'This section crashed'}
            </h2>
            {this.state.error && (
              <p className="mb-3 text-xs text-muted-foreground font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleGoBack}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}