/*
  Quality pass — ErrorBoundary.jsx
  A render error in any page used to blank the entire app. This boundary
  catches it and shows a recoverable screen instead. It sits above the
  providers in main.jsx so even provider failures are contained.
*/
import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Uncaught UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="crash-page">
          <section className="crash-card" role="alert">
            <h1>Something went wrong</h1>
            <p>
              The page hit an unexpected error. Nothing was deleted — try again,
              or reload the page to start fresh.
            </p>
            {import.meta.env.DEV && (
              <pre className="crash-detail">{String(this.state.error)}</pre>
            )}
            <div className="crash-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => this.setState({ error: null })}
              >
                Try again
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
