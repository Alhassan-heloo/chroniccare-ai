import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { Language, Text } from './copy';
import ExampleRecord, { exampleNumber } from './ExampleRecord';
import type { RecordKind } from './ExampleRecord';

const examples: RecordKind[] = ['pressure', 'dose', 'visit'];

export default function CareJourney({ t, language }: { t: Text; language: Language }) {
  const [active, setActive] = useState(0);
  const selected = useRef<HTMLButtonElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const previousTop = useRef<number | null>(null);

  useLayoutEffect(() => {
    const start = previousTop.current;
    previousTop.current = null;
    if (start === null || !matchMedia('(max-width: 700px)').matches || !selected.current || !preview.current) return;

    const { top } = selected.current.getBoundingClientRect();
    const { bottom } = preview.current.getBoundingClientRect();
    const stackHeight = bottom - top;
    const lastVisibleTop = Math.max(12, window.innerHeight - stackHeight - 12);
    // Keep the tapped heading in place when closing the previous example above it.
    const targetTop = Math.min(Math.max(12, start), lastVisibleTop);
    if (Math.abs(top - targetTop) > 1) window.scrollBy({ top: top - targetTop, behavior: 'instant' });
  }, [active]);

  return <section className="hy-care" id="journey" tabIndex={-1} aria-labelledby="care-title">
    <div className="hy-container">
      <h2 id="care-title">{t.journeyTitle}</h2>
      <div className="journey-layout">
        {t.stepTitles.map((title, index) => {
          const expanded = active === index;
          return <Fragment key={title}>
            <button className="journey-step" type="button" style={{ gridRow: index + 1 }}
              ref={expanded ? selected : undefined} aria-expanded={expanded} aria-controls="journey-example"
              onClick={event => {
                if (expanded) return;
                previousTop.current = event.currentTarget.getBoundingClientRect().top;
                setActive(index);
              }}>
              <span className="step-number" aria-hidden="true">{exampleNumber(index + 1, language)}</span>
              <span className="step-copy">
                <strong id={`step-title-${index}`}>{title}</strong>
                <span>{t.steps[index]}</span>
              </span>
              <svg className="step-chevron" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
            </button>
            {expanded && <div className="journey-example" id="journey-example" role="region"
              aria-labelledby={`step-title-${index}`} aria-live="polite" ref={preview}>
              <ExampleRecord kind={examples[index]!} language={language} t={t} />
            </div>}
          </Fragment>;
        })}
      </div>
    </div>
  </section>;
}

