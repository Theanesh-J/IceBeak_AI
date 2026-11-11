import { createContext, useContext, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LaunchStudio } from './views/LaunchStudio';
import { LocalisedContentView } from './views/LocalisedContent';
import { TrustMapView } from './views/TrustMap';
import { SourcesView } from './views/Sources';
import { HistoryView } from './views/History';
import { getStatus, type ServerStatus } from './lib/api';
import { useStore } from './state/store';

export type Route = 'studio' | 'content' | 'trustmap' | 'sources' | 'history';
const ROUTES: Route[] = ['studio', 'content', 'trustmap', 'sources', 'history'];

function readRoute(): Route {
  const r = window.location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'studio';
}

export function navigate(route: Route) {
  window.location.hash = `/${route}`;
}

const ServerCtx = createContext<{ status: ServerStatus | null; refresh: () => void }>({ status: null, refresh: () => {} });
export const useServer = () => useContext(ServerCtx);

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const { state, dispatch } = useStore();

  const refresh = () => {
    getStatus().then(setStatus);
  };

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      setMenuOpen(false);
      document.getElementById('main')?.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    refresh();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Fall back to sample mode if AI was selected but is no longer available.
  useEffect(() => {
    if (status && !status.configured && state.mode === 'ai') dispatch({ type: 'setMode', mode: 'sample' });
  }, [status, state.mode, dispatch]);

  return (
    <ServerCtx.Provider value={{ status, refresh }}>
      <div className="flex h-full">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>

        {/* Desktop sidebar */}
        <div className="hidden w-60 shrink-0 lg:block">
          <Sidebar route={route} />
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-navy/40" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64 fade-in">
              <Sidebar route={route} />
              <button
                onClick={() => setMenuOpen(false)}
                className="absolute right-3 top-4 rounded p-1 text-white/70 hover:text-white"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
            <button onClick={() => setMenuOpen(true)} className="rounded p-1.5 hover:bg-canvas" aria-label="Open navigation">
              <Menu size={18} />
            </button>
            <span className="text-sm font-semibold">ProofLingo</span>
          </div>
          <main id="main" className="min-h-0 flex-1 overflow-y-auto" tabIndex={-1}>
            <Header route={route} />
            <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
              {route === 'studio' && <LaunchStudio />}
              {route === 'content' && <LocalisedContentView />}
              {route === 'trustmap' && <TrustMapView />}
              {route === 'sources' && <SourcesView />}
              {route === 'history' && <HistoryView />}
            </div>
          </main>
        </div>
      </div>
    </ServerCtx.Provider>
  );
}
