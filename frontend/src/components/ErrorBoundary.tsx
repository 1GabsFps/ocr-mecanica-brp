import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React UI Component Tree:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 selection:bg-rose-600/30 selection:text-rose-200">
          <div className="max-w-md w-full bg-[#111827] border border-rose-900/60 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center shadow-lg shadow-rose-950/50">
              <AlertTriangle className="w-7 h-7 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                {this.props.fallbackTitle || 'Ocorreu um erro no módulo visual'}
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-mono leading-relaxed bg-[#080d1a] border border-[#1e293b] p-3 rounded-xl break-words">
                {this.state.error?.message || 'Falha inesperada de renderização da interface.'}
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg shadow-rose-900/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recarregar Sistema</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
