import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { Language, Text } from './copy';
import ExampleRecord, { exampleNumber } from './ExampleRecord';
import type { RecordKind } from './ExampleRecord';
import holder from './holder.jpg';
import reminder from './reminder.jpg';
import cuff from './cuff.jpg';
import dose from './dose.jpg';
import consultation from './consultation.jpg';

const features = [
  { photo: holder, example: 'glucose', crop: '64% center' },
  { photo: reminder, example: 'dose', crop: 'center 56%' },
  { photo: cuff, example: 'pressure', crop: '62% center' },
  { photo: dose, example: 'schedule', crop: '54% center' },
  { photo: consultation, example: 'visit', crop: 'center' },
] satisfies { photo: string; example: RecordKind; crop: string }[];

function releaseTouchPress(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType === 'touch' && event.isPrimary) delete event.currentTarget.dataset.touchPressed;
}

function Arrow({ previous = false, size = 24 }: { previous?: boolean; size?: number }) {
  return <svg className={previous ? 'back-arrow directional' : 'directional'} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function FeatureDialog({ detail, t, language, onClose }: {
  detail: number | null;
  t: Text;
  language: Language;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const exit = useRef<Animation | null>(null);
  const isOpen = detail !== null;

  useLayoutEffect(() => {
    if (!isOpen) return;
    const panel = dialog.current;
    if (!panel) return;
    panel.showModal();
    dismiss.current?.focus({ preventScroll: true });
    return () => {
      exit.current?.cancel();
      exit.current = null;
      if (panel.open) panel.close();
    };
  }, [isOpen]);

  function requestClose() {
    const panel = dialog.current;
    if (!panel?.open || exit.current) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !panel.animate) {
      panel.close();
      return;
    }
    const animation = panel.animate(
      [{ opacity: getComputedStyle(panel).opacity, transform: getComputedStyle(panel).transform },
        { opacity: 0, transform: 'translateY(6px)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' },
    );
    exit.current = animation;
    void animation.finished.then(() => panel.close()).catch(() => {});
  }

  const feature = detail === null ? null : features[detail];
  return <dialog className="show-dialog" ref={dialog} aria-labelledby="detail-title"
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClose={onClose} onKeyDown={event => {
      const edge = event.shiftKey ? dismiss.current : body.current;
      if (event.key === 'Tab' && event.target === edge) {
        event.preventDefault();
        (event.shiftKey ? body.current : dismiss.current)?.focus();
      }
    }}>
    {detail !== null && feature && <>
      <header className="feature-header">
        <h3 id="detail-title">{t.cardTitles[detail]}</h3>
        <form method="dialog" onSubmit={event => { event.preventDefault(); requestClose(); }}>
          <button type="submit" ref={dismiss} aria-label={t.closeDetails}>
            {t.close}<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </form>
      </header>
      <div className="feature-body" key={detail} ref={body} tabIndex={0} role="region"
        aria-label={language === 'ar' ? 'مثال المتابعة' : 'Tracking example'}>
        <div className="feature-media"><img src={feature.photo} alt="" style={{ objectPosition: feature.crop }} /></div>
        <div className="feature-copy"><p>{t.cardDetails[detail]}</p>
          <ExampleRecord kind={feature.example} language={language} t={t} />
        </div>
      </div>
    </>}
  </dialog>;
}

export default function Showcase({ t, language }: { t: Text; language: Language }) {
  const track = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const offsets = useRef([0]);
  const [position, setPosition] = useState({ index: 0, count: 1 });
  const [detail, setDetail] = useState<number | null>(null);
  const rtl = language === 'ar';

  function updatePosition(offset: number) {
    const index = offsets.current.reduce((closest, candidate, i, all) =>
      Math.abs(candidate - offset) < Math.abs(all[closest]! - offset) ? i : closest, 0);
    const count = offsets.current.length;
    setPosition(previous => previous.index === index && previous.count === count ? previous : { index, count });
  }

  useLayoutEffect(() => {
    const list = track.current;
    if (!list) return;
    function measure() {
      if (!list) return;
      const [first, second] = list.children;
      if (!first || !second) return;
      const stride = Math.abs(second.getBoundingClientRect().left - first.getBoundingClientRect().left);
      const limit = Math.max(0, list.scrollWidth - list.clientWidth);
      const count = stride ? Math.ceil(Math.max(0, limit - 1) / stride) + 1 : 1;
      offsets.current = Array.from({ length: count }, (_, i) => i === count - 1 ? limit : i * stride);
      updatePosition(Math.abs(list.scrollLeft));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [language]);

  function goTo(index: number) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bounded = Math.max(0, Math.min(offsets.current.length - 1, index));
    track.current?.scrollTo({ left: (offsets.current[bounded] ?? 0) * (rtl ? -1 : 1), behavior: reduce ? 'instant' : 'smooth' });
  }

  function handleTrackKeys(event: KeyboardEvent<HTMLDivElement>) {
    const previous = rtl ? 'ArrowRight' : 'ArrowLeft';
    const next = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (![previous, next, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.target instanceof HTMLElement && event.target !== event.currentTarget) {
      const cards = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.show-card'));
      const focused = cards.findIndex(card => card === event.target);
      if (focused < 0) return;
      if (event.key === 'Home') cards[0]?.focus();
      else if (event.key === 'End') cards.at(-1)?.focus();
      else cards[focused + (event.key === next ? 1 : -1)]?.focus();
      return;
    }
    if (event.key === 'Home') goTo(0);
    else if (event.key === 'End') goTo(position.count - 1);
    else goTo(position.index + (event.key === next ? 1 : -1));
  }

  const indexLabel = exampleNumber(position.index + 1, language);
  const countLabel = exampleNumber(position.count, language);
  const progress = rtl ? `${indexLabel} من ${countLabel}` : `${indexLabel} of ${countLabel}`;

  return <section id="showcase" className="hy-showcase" tabIndex={-1} aria-labelledby="showcase-title">
    <div className="hy-container">
      <div className="showcase-intro"><h2 id="showcase-title">{t.showcaseTitle}</h2><p>{t.showcaseBody}</p></div>
      <div className="show-track" ref={track} id="show-track" tabIndex={0} role="group"
        aria-label={rtl ? 'معرض المتابعة اليومية' : 'Everyday tracking gallery'} onKeyDown={handleTrackKeys}
        onScroll={event => updatePosition(Math.abs(event.currentTarget.scrollLeft))}>
        {features.map(({ photo, crop }, index) => <button type="button" className="show-card" key={photo}
          aria-haspopup="dialog" onPointerDown={event => {
            if (event.pointerType === 'touch' && event.isPrimary) event.currentTarget.dataset.touchPressed = '';
          }} onPointerUp={releaseTouchPress} onPointerCancel={releaseTouchPress} onClick={event => {
            trigger.current = event.currentTarget;
            setDetail(index);
          }}>
          <img src={photo} alt="" loading="lazy" style={{ objectPosition: crop }} />
          <span className="show-caption"><span>{t.cardTitles[index]}</span><i aria-hidden="true"><Arrow size={17} /></i></span>
        </button>)}
      </div>
      <div className="show-controls">
        <div className="show-position">
          <span className="progress" aria-hidden="true">{Array.from({ length: position.count }, (_, i) =>
            <i key={i} data-current={i === position.index} />)}</span>
          <span aria-live="polite" aria-atomic="true">{progress}</span>
        </div>
        <div>
          <button type="button" onClick={() => goTo(position.index - 1)} disabled={position.index === 0} aria-label={t.previous} aria-controls="show-track"><Arrow previous /></button>
          <button type="button" onClick={() => goTo(position.index + 1)} disabled={position.index === position.count - 1} aria-label={t.next} aria-controls="show-track"><Arrow /></button>
        </div>
      </div>
    </div>
    <FeatureDialog detail={detail} t={t} language={language} onClose={() => {
      setDetail(null);
      trigger.current?.focus({ preventScroll: true });
      trigger.current = null;
    }} />
  </section>;
}

