import { useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { gsap } from 'gsap';
import type { Language, Text } from './copy';

const MORPH_SECONDS = 0.8;
const HOLD_SECONDS = 0.7;
const PLAYBACK_ORDER = [0, 2, 3, 1, 3, 2] as const;
const INITIAL_INDEX = PLAYBACK_ORDER[0];
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const SAMPLE_X = [0, 85, 174, 227, 275, 312, 337, 362, 402, 458, 520, 584] as const;

// The interior points are fictional chart samples. The final sample is the displayed reading.
const days = [
  { day: 12, minute: '50', readings: [111, 112, 112, 114, 114, 115, 116, 115, 113, 109, 112, 115] }, // Nearly flat
  { day: 13, minute: '40', readings: [120, 121, 121, 123, 124, 132, 143, 129, 119, 117, 121, 126] }, // Tall and narrow
  { day: 14, minute: '45', readings: [114, 115, 115, 116, 119, 122, 123, 122, 121, 114, 116, 119] }, // Wide rise
  { day: 15, minute: '45', readings: [111, 110, 111, 113, 115, 122, 128, 123, 113, 105, 107, 108] }, // Medium peak
] as const;

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

function digits(value: string | number, language: Language) {
  return language === 'ar' ? String(value).replace(/[0-9]/g, digit => arabicDigits[Number(digit)]!) : String(value);
}

function label(day: number, language: Language) {
  return language === 'ar' ? `${digits(day, language)} نوفمبر` : `Nov ${day}`;
}

function chartGeometry(readings: readonly number[]) {
  const points = SAMPLE_X.map((x, i) => ({ x, y: 252 - (readings[i]! - 90) * 3.35 }));
  const slopes = points.slice(1).map((end, i) => {
    const start = points[i]!;
    return (end.y - start.y) / (end.x - start.x);
  });
  const tangents = points.map((_, i) => {
    const before = slopes[i - 1];
    const after = slopes[i];
    // Use a flat tangent at local extrema and at the chart edges to avoid overshoot.
    return before && after && before * after > 0 ? 2 * before * after / (before + after) : 0;
  });

  const start = points[0]!;
  const latest = points.at(-1)!;
  const line = points.slice(1).reduce((path, end, i) => {
    const from = points[i]!;
    const handle = (end.x - from.x) / 3;
    const y1 = from.y + tangents[i]! * handle;
    const y2 = end.y - tangents[i + 1]! * handle;
    return `${path} C${from.x + handle},${y1.toFixed(2)} ${end.x - handle},${y2.toFixed(2)} ${end.x},${end.y.toFixed(2)}`;
  }, `M${start.x},${start.y.toFixed(2)}`);
  const peak = points.reduce((highest, point) => point.y < highest.y ? point : highest);
  const fullLine = `${line} L600,${latest.y.toFixed(2)}`;

  return {
    line: fullLine,
    area: `${fullLine} L600,295 L0,295 Z`,
    latest,
    peakX: peak.x,
    peakOpacity: Math.min(1, Math.max(0, (start.y - peak.y - 30) / 55)),
  };
}

type ChartPlot = { paint: (readings: readonly number[]) => void };
type Playback = { select: (index: number) => void; toggle: () => void; dispose: () => void };

const initial = chartGeometry(days[INITIAL_INDEX].readings);

function createPlayback(
  figure: HTMLElement,
  plot: ChartPlot,
  setActive: (index: number) => void,
  setPlaying: (playing: boolean) => void,
  setReduced: (reduced: boolean) => void,
): Playback {
  const motionPreference = matchMedia(reducedMotionQuery);
  let inView = false;
  let playing = !motionPreference.matches;
  let cursor = 0;
  let active = INITIAL_INDEX as number;
  let visibleReadings: readonly number[] = days[INITIAL_INDEX].readings;
  let task: gsap.core.Tween | undefined;
  let manualTask = false;

  function paint(readings: readonly number[]) {
    visibleReadings = readings;
    plot.paint(readings);
  }

  function syncPlayback() {
    const canRun = inView && !document.hidden && (playing || manualTask);
    task?.paused(!canRun);
  }

  function hold() {
    manualTask = false;
    task = gsap.delayedCall(HOLD_SECONDS, () => {
      cursor = (cursor + 1) % PLAYBACK_ORDER.length;
      morph(PLAYBACK_ORDER[cursor]!, false);
    }).pause();
    syncPlayback();
  }

  function morph(index: number, manual: boolean) {
    task?.kill();
    task = undefined;
    active = index;
    setActive(index);
    const target = days[index]!.readings;

    if (motionPreference.matches || visibleReadings === target) {
      paint(target);
      if (playing) hold();
      return;
    }

    const from = visibleReadings;
    const progress = { value: 0 };
    manualTask = manual;
    task = gsap.to(progress, {
      value: 1,
      duration: MORPH_SECONDS,
      ease: 'power2.inOut',
      paused: true,
      onUpdate: () => paint(from.map((sample, i) => sample + (target[i]! - sample) * progress.value)),
      onComplete: () => {
        paint(target);
        task = undefined;
        if (playing) hold();
      },
    });
    syncPlayback();
  }

  function updateMotionPreference() {
    setReduced(motionPreference.matches);
    if (motionPreference.matches) {
      playing = false;
      setPlaying(false);
      task?.kill();
      task = undefined;
      paint(days[active]!.readings);
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    inView = Boolean(entry?.isIntersecting);
    syncPlayback();
  });
  observer.observe(figure.querySelector('.levels-curve') ?? figure);
  document.addEventListener('visibilitychange', syncPlayback);
  motionPreference.addEventListener('change', updateMotionPreference);
  if (playing) hold();

  return {
    select(index) {
      playing = false;
      setPlaying(false);
      cursor = PLAYBACK_ORDER.findIndex(day => day === index);
      morph(index, true);
    },
    toggle() {
      if (motionPreference.matches) return;
      playing = !playing;
      setPlaying(playing);
      if (playing && !task) hold();
      else syncPlayback();
    },
    dispose() {
      task?.kill();
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      motionPreference.removeEventListener('change', updateMotionPreference);
    },
  };
}

function Plot({ plotRef }: { plotRef: Ref<ChartPlot> }) {
  const id = useId();
  const line = useRef<SVGPathElement>(null);
  const area = useRef<SVGPathElement>(null);
  const marker = useRef<SVGCircleElement>(null);
  const peak = useRef<SVGLinearGradientElement>(null);
  const tint = useRef<SVGUseElement>(null);

  // React's SVG props stay stable while GSAP updates the points.
  useImperativeHandle(plotRef, () => ({
    paint(readings) {
      const geometry = chartGeometry(readings);
      line.current?.setAttribute('d', geometry.line);
      area.current?.setAttribute('d', geometry.area);
      marker.current?.setAttribute('cy', geometry.latest.y.toFixed(2));
      peak.current?.setAttribute('x1', String(geometry.peakX - 76));
      peak.current?.setAttribute('x2', String(geometry.peakX + 76));
      tint.current?.setAttribute('opacity', String(geometry.peakOpacity));
    },
  }), []);

  return <svg className="levels-curve" viewBox="0 0 600 295" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <path id={`${id}-curve`} ref={line} d={initial.line} vectorEffect="non-scaling-stroke" />
      <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="var(--accent)" stopOpacity=".22" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-peak`} ref={peak} gradientUnits="userSpaceOnUse"
        x1={initial.peakX - 76} y1="0" x2={initial.peakX + 76} y2="0">
        <stop stopColor="var(--ink)" stopOpacity="0" />
        <stop offset=".5" stopColor="var(--ink)" stopOpacity=".34" />
        <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
      </linearGradient>
      <filter id={`${id}-glow`} x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
    </defs>
    <path className="area" ref={area} d={initial.area} fill={`url(#${id}-wash)`} />
    <use className="glow" href={`#${id}-curve`} filter={`url(#${id}-glow)`} />
    <use className="line" href={`#${id}-curve`} />
    <use className="peak-accent" ref={tint} href={`#${id}-curve`} stroke={`url(#${id}-peak)`} opacity={initial.peakOpacity} />
    <circle className="reading-point" ref={marker} cx={initial.latest.x} cy={initial.latest.y.toFixed(2)} r="8" />
  </svg>;
}

export default function Readings({ t, language }: { t: Text; language: Language }) {
  const [active, setActive] = useState<number>(INITIAL_INDEX);
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(reducedMotionQuery).matches);
  const [playing, setPlaying] = useState(!reduced);
  const figure = useRef<HTMLElement>(null);
  const plot = useRef<ChartPlot>(null);
  const playback = useRef<Playback>(null);

  useLayoutEffect(() => {
    if (!figure.current || !plot.current) return;
    const controller = createPlayback(figure.current, plot.current, setActive, setPlaying, setReduced);
    playback.current = controller;
    return () => {
      controller.dispose();
      playback.current = null;
    };
  }, []);

  const controlLabel = language === 'ar' ? playing ? 'إيقاف' : 'تشغيل' : playing ? 'Pause' : 'Play';
  const controlName = language === 'ar'
    ? reduced ? 'التشغيل التلقائي متوقف حسب إعداد تقليل الحركة' : playing ? 'إيقاف التشغيل التلقائي مؤقتًا' : 'تشغيل الرسم تلقائيًا'
    : reduced ? 'Autoplay is disabled by reduced motion' : playing ? 'Pause chart autoplay' : 'Play chart automatically';
  const reading = days[active]!;
  const value = reading.readings.at(-1)!;
  const time = language === 'ar' ? `${digits(`7:${reading.minute}`, language)} صباحًا` : `7:${reading.minute} AM`;

  return <section id="readings" className="hy-levels" tabIndex={-1} aria-labelledby="level-title">
    <div className="hy-container levels-layout">
      <div className="levels-copy">
        <h2 id="level-title">{t.measureTitle}</h2><p>{t.measureBody}</p><a href="#journey">{t.links[2]} <span className="directional" aria-hidden="true">→</span></a>
      </div>
      <figure className="levels-frame" ref={figure}>
        <figcaption className="reading-caption" aria-live={playing ? 'off' : 'polite'}>
          <span>{t.measurement}</span>
          <p><strong>{digits(value, language)}</strong><span>{t.unit}</span></p>
          <time dateTime={`2026-11-${reading.day}T07:${reading.minute}`}>
            <span>{label(reading.day, language)}</span>{' '}<bdi className="reading-clock">{time}</bdi>
          </time>
        </figcaption>
        <Plot plotRef={plot} />
        <div className="plot-controls">
          <div className="plot-meta">
            <p>{t.example}</p>
            <button type="button" className="plot-playback" aria-label={controlName}
              disabled={reduced} onClick={() => playback.current?.toggle()}>{controlLabel}</button>
          </div>
          <div className="level-select" role="group" aria-label={t.newDay}>
            {days.map(({ day }, index) => <button key={day} type="button" aria-pressed={active === index} onClick={() => playback.current?.select(index)}>{label(day, language)}</button>)}
          </div>
        </div>
      </figure>
    </div>
  </section>;
}