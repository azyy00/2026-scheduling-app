import React from 'react';

class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module');
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module');

    if (isChunkError) {
      // Reload once to pick up the new chunk URLs
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
      } else {
        sessionStorage.removeItem('chunk_reload');
      }
    }
  }

  render() {
    if (this.state.hasError && !this.state.isChunkError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <p className="text-3xl">⚠️</p>
          <p className="text-gray-600 font-medium">Something went wrong.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="text-sm px-4 py-2 rounded-lg text-white"
            style={{ background: '#7B1C1C' }}
          >
            Reload page
          </button>
        </div>
      );
    }
    // Chunk errors auto-reload; show nothing while reloading
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default ChunkErrorBoundary;
