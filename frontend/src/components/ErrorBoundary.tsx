import React from "react";

interface State {
  error: Error | null;
}

/** Catches JS render errors in whatever it wraps. Without this, React
 * unmounts the ENTIRE app on any uncaught error - which is why a bug on
 * a single page can make the whole site (sidebar included) go blank.
 * With this in place, only the content area shows an error message and
 * the rest of the app (sidebar/nav) keeps working. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Page crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-display text-lg font-bold text-red-800">Something went wrong on this page</h2>
            <p className="mt-2 text-sm text-red-700">{this.state.error.message}</p>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-white p-3 text-xs text-red-600">
              {this.state.error.stack}
            </pre>
            <button
              className="mt-4 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
