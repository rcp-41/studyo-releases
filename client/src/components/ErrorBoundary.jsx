import { Component } from 'react';
import { AlertTriangle, RefreshCw, Copy, ChevronDown } from 'lucide-react';

/**
 * Global Error Boundary
 * Catches unhandled React errors and displays a recovery UI.
 * Also logs errors to the audit system.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });

        // Log to console
        console.error('[ErrorBoundary]', error, errorInfo);

        // Log to local storage for debugging
        try {
            const errorLogs = JSON.parse(localStorage.getItem('studyo-error-log') || '[]');
            errorLogs.unshift({
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo?.componentStack,
                timestamp: new Date().toISOString(),
                url: window.location.href
            });
            if (errorLogs.length > 50) errorLogs.length = 50;
            localStorage.setItem('studyo-error-log', JSON.stringify(errorLogs));
        } catch (e) {
            // Ignore storage errors
        }
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleCopyError = () => {
        const { error, errorInfo } = this.state;
        const text = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;
        navigator.clipboard.writeText(text).then(() => {
            // Brief visual feedback
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>

                        <div>
                            <h1 className="text-xl font-bold">Bir şeyler ters gitti</h1>
                            <p className="text-sm text-muted-foreground mt-2">
                                Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi deneyin.
                            </p>
                        </div>

                        <div className="flex justify-center gap-3">
                            <button onClick={this.handleReload}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
                                <RefreshCw className="w-4 h-4" /> Yeniden Dene
                            </button>
                            <button onClick={() => window.location.href = '/dashboard'}
                                className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm">
                                Ana Sayfa
                            </button>
                        </div>

                        {/* Error details (collapsible) */}
                        <div className="text-left">
                            <button onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mx-auto">
                                <ChevronDown className={`w-3 h-3 transition-transform ${this.state.showDetails ? 'rotate-180' : ''}`} />
                                Hata Detayları
                            </button>

                            {this.state.showDetails && (
                                <div className="mt-3 relative">
                                    <button onClick={this.handleCopyError}
                                        className="absolute top-2 right-2 p-1.5 hover:bg-muted rounded text-muted-foreground" title="Kopyala">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <pre className="p-3 bg-muted/50 border border-border rounded-lg text-[11px] text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
                                        {this.state.error?.message}
                                        {'\n\n'}
                                        {this.state.error?.stack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
