import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Provider as TooltipProvider } from "@radix-ui/react-tooltip";
import { ProjectionEngine } from './components/ProjectionEngine';
import type { EuipNode } from './lib/euip';
import type { Theme } from './components/providers/ThemeProvider';
import { SYSTEM_ACTION_IDS } from './lib/protocol';

function App() {
  const [ui, setUi] = useState<EuipNode | null>(null);
  const [hostTheme, setHostTheme] = useState<Theme | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [transportHint, setTransportHint] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  // Called when Projection's exit animation finishes.
  // Invokes finalize_close to let Rust release + hide the window.
  const handleExitComplete = useCallback(() => {
    const win = getCurrentWindow();
    invoke('finalize_close', { windowLabel: win.label }).catch((err) => {
      if (import.meta.env.DEV) {
        console.error('[App] finalize_close IPC failed:', err);
      }
    });
    setClosing(false);
    setUi(null);
  }, []);

  useEffect(() => {
    // Use window-scoped listener to ensure we catch events targeting THIS window
    const setupListener = async () => {
      const win = getCurrentWindow();
      const poolId = win.label;

      setWindowLabel(win.label);
      try {
        const configTransport = window.__EIDOU_CONFIG__?.transport;
        if (configTransport) {
          setTransportHint(configTransport);
        } else {
          const params = new URLSearchParams(window.location.search);
          setTransportHint(params.get('eidou_transport'));
        }
      } catch {
        // ignore
      }

      const unlistenRender = await win.listen<{ target: string; ui: EuipNode }>('eidou:render', (event) => {
        if (event.payload.target === win.label) {
          setUi(event.payload.ui);
        }
      });

      const unlistenReset = await win.listen<{ target: string }>('eidou:reset', (event) => {
        if (event.payload.target === win.label) {
          setClosing(false);
          setUi(null);
        }
      });

      const unlistenDiagnostic = await win.listen<{ kind: string; message: string; context?: unknown }>(SYSTEM_ACTION_IDS.DIAGNOSTIC, (event) => {
        console.warn(`[DIAGNOSTIC] ${event.payload.kind}: ${event.payload.message}`, event.payload.context || '');
      });

      const unlistenHostTheme = await win.listen<{ target: string; theme: Theme | null }>('eidou:host_theme', (event) => {
        if (event.payload.target === win.label) {
          setHostTheme(event.payload.theme ?? undefined);
        }
      });

      const unlistenRequestClose = await win.listen<{ window_label: string }>('eidou:request_close', (event) => {
        if (event.payload.window_label === win.label) {
          setClosing(true);
        }
      });

      // Signal readiness
      invoke('greet', { name: 'Eidou Client' }).then(() => setReady(true));

      // Tell backend this window is ready to receive render events.
      // This allows the backend to avoid showing any placeholder UI.
      await win.emit('eidou:ready', { pool_id: poolId });

      return () => {
        unlistenRender();
        unlistenReset();
        unlistenDiagnostic();
        unlistenHostTheme();
        unlistenRequestClose();
      };
    };

    const cleanupPromise = setupListener();
    return () => {
      cleanupPromise.then(cleanup => cleanup());
    };
  }, []);

  useEffect(() => {
    // Avoid initial "black flash" by delaying the fallback screen.
    // If UI arrives quickly, we remain transparent.
    if (ui) {
      setShowFallback(false);
      return;
    }

    // Toast windows should stay transparent while idle.
    if (windowLabel && windowLabel.startsWith("toast-")) {
      setShowFallback(false);
      return;
    }

    const delayMs = transportHint === 'stdio' ? 1000 : 500;
    const timer = setTimeout(() => {
      if (!ui) {
        setShowFallback(true);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [ui, windowLabel, transportHint]);

  if (!ui) {
    // Toast windows should not flash the default "Signal Lost" screen.
    // When a toast window is shown, it may be visible before its first render payload arrives.
    // Keep the fallback transparent so it doesn't appear as a black block.
    if (windowLabel && windowLabel.startsWith("toast-")) {
      return <div className="h-screen w-screen bg-transparent" />;
    }

    if (!showFallback) {
      return <div className="h-screen w-screen bg-transparent" />;
    }

    return (
      <div className="flex items-center justify-center h-screen w-screen bg-card text-primary font-mono select-none overflow-hidden">
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="animate-pulse text-4xl font-bold tracking-widest text-shadow-neon">
            EIDOU
          </div>
          <div className="text-xs opacity-50 tracking-[0.2em]">
            {ready ? "SIGNAL_LOST // WAITING_FOR_HOST" : "INITIALIZING..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      {/* 
         Main app container. overflow-hidden was removed because the
         Ghost Container (RFC-004 MOUNTING phase) uses absolute + max-content
         to measure content dimensions and must not be clipped.
         Projection handles overflow for real content via phase CSS.
      */}
      <div className="h-screen w-screen bg-transparent text-foreground font-sans relative">
        <ProjectionEngine node={ui} hostTheme={hostTheme} closing={closing} onExitComplete={handleExitComplete} />
      </div>

      {/* Portal Root for Tooltips - sibling to main container to avoid overflow:hidden clipping */}
      <div id="eidou-portal-root" className="fixed top-0 left-0 w-full h-full pointer-events-none z-[9999]" />
    </TooltipProvider>
  );
}

export default App;
