import { useEffect, useRef, useState } from 'react';
import type { Language } from './copy';
import type { HeartbeatAnimation } from './animateHeartbeat';

const BASELINE_Y = 39;
const PEAK_Y = 5; // Smaller Y values make the peak taller.
const WAVE_HEIGHT = 56;
const BASELINE_PERCENT = `${BASELINE_Y / WAVE_HEIGHT * 100}%`;
const PAUSE_KEY = 'cc-hybrid-pulse-paused';

const waveform = [
  [0, BASELINE_Y], [10, BASELINE_Y], [15, 38], [19, 34], [23, 32],
  [27, 34], [31, 38], [37, BASELINE_Y], [42, 41], [48, PEAK_Y],
  [53, 48], [59, BASELINE_Y], [65, BASELINE_Y], [70, 36], [75, 31],
  [80, 29], [84, 30], [89, 34], [94, 38], [100, BASELINE_Y],
] as const;

const svgPoints = waveform.map(point => point.join(',')).join(' ');

export default function HeroHeartbeat({ language }: { language: Language }) {
  const layer = useRef<HTMLDivElement>(null);
  const beat = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(() => {
    try { return sessionStorage.getItem(PAUSE_KEY) === 'true'; } catch { return false; }
  });
  const manualPause = useRef(paused);
  const sync = useRef<(() => void) | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const host = layer.current;
    const shape = beat.current;
    if (!host || !shape || !('IntersectionObserver' in window)) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let animation: HeartbeatAnimation | undefined;
    let visible = false;
    let loading = false;
    let unavailable = false;
    let disposed = false;

    function stop() {
      animation?.dispose();
      animation = undefined;
    }

    function showFallback() {
      unavailable = true;
      stop();
      if (!disposed) setAvailable(false);
    }

    const syncPlayback = () => {
      if (disposed) return;
      if (reducedMotion.matches) {
        stop();
        setAvailable(false);
        return;
      }

      const inView = visible && !document.hidden;
      if (animation) {
        animation.setPlaying(inView && !manualPause.current);
        return;
      }
      if (!inView || unavailable || loading) return;

      loading = true;
      void import('./animateHeartbeat').then(({ createHeartbeat }) => {
        loading = false;
        if (disposed || reducedMotion.matches || !visible || document.hidden) return;

        animation = createHeartbeat(host, shape, waveform, showFallback);
        if (!animation) {
          showFallback();
          return;
        }
        setAvailable(true);
        animation.setPlaying(!manualPause.current);
      }).catch(showFallback);
    };
    sync.current = syncPlayback;

    const visibility = new IntersectionObserver(([entry]) => {
      visible = (entry?.intersectionRatio ?? 0) >= 0.25;
      syncPlayback();
    }, { threshold: 0.25 });
    visibility.observe(host);

    reducedMotion.addEventListener('change', syncPlayback);
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      disposed = true;
      visibility.disconnect();
      reducedMotion.removeEventListener('change', syncPlayback);
      document.removeEventListener('visibilitychange', syncPlayback);
      sync.current = null;
      stop();
    };
  }, []);

  const label = language === 'ar'
    ? paused ? 'استئناف النبضة' : 'إيقاف النبضة'
    : paused ? 'Resume heartbeat' : 'Pause heartbeat';

  return <div className="hero-pulse">
    <div className="hero-heartbeat" ref={layer} aria-hidden="true">
      <svg focusable="false"><line x2="100%" y1={BASELINE_PERCENT} y2={BASELINE_PERCENT} /></svg>
      <svg ref={beat} viewBox={`0 0 100 ${WAVE_HEIGHT}`} preserveAspectRatio="none" focusable="false">
        <polyline points={svgPoints} vectorEffect="non-scaling-stroke" />
      </svg>
      <svg focusable="false"><line x2="100%" y1={BASELINE_PERCENT} y2={BASELINE_PERCENT} /></svg>
    </div>
    {available && <button type="button" className="heartbeat-toggle" onClick={() => {
      const next = !manualPause.current;
      manualPause.current = next;
      setPaused(next);
      try { sessionStorage.setItem(PAUSE_KEY, String(next)); } catch { /* The control still works in memory. */ }
      sync.current?.();
    }}>
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d={paused ? 'M5 2v12l9-6z' : 'M4 2h3v12H4zm5 0h3v12H9z'} />
      </svg>{label}
    </button>}
  </div>;
}