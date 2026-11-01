/**
 * Top-level error boundary for rendering errors.
 *
 * @author Kwasi Adabo Boakye
 */

import { Component } from 'react';
import { reportClientError } from '../../lib/api.js';

/**
 * Catches errors thrown while rendering, reports them (without personal data) and shows a message with a reload
 * button instead of a blank page.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  /**
   * Stores the error so the fallback message is rendered.
   *
   * @param {Error} error The rendering error.
   * @returns {{ error: Error }}
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /**
   * Reports the rendering error to the API.
   *
   * @param {Error} error The rendering error.
   */
  componentDidCatch(error) {
    reportClientError(error);
  }

  /**
   * Renders the application, or the fallback message after an error.
   *
   * @returns {import('react').ReactNode}
   */
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-ink-soft">The problem has been reported. Reload the page to continue.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white"
        >
          Reload
        </button>
      </div>
    );
  }
}
