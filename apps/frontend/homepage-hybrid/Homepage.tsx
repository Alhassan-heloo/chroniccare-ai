import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { copy, sections } from './copy';
import type { Language, Text } from './copy';
import Readings from './Readings';
import Showcase from './Showcase';
import CareJourney from './CareJourney';
import HeroHeartbeat from './HeroHeartbeat';
import { BrandIdentity } from '../src/components/ui/BrandIdentity';
import { LanguageSwitch, ThemeToggle } from '../src/components/ui/AppearanceControls';
import hero from './hero.jpg';
import heroMobile from './hero-mobile.jpg';

const icons = {
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
};

function Symbol({ icon, size = 20 }: { icon: keyof typeof icons; size?: number }) {
  return <svg className={icon === 'arrow' ? 'directional' : undefined} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[icon]} /></svg>;
}

function Brand() {
  return <a className="hy-brand" href="#top" lang="en" dir="ltr"><BrandIdentity /></a>;
}
function Join({ children, href = '/register', closing = false }: { children: ReactNode; href?: string; closing?: boolean }) {
  return <a href={href} className={closing ? 'fh-cta closing-cta' : 'fh-cta'}>
    {children}{closing ? <Symbol icon="arrow" size={18} /> : null}
  </a>;
}

type Session = 'loading' | 'guest' | 'patient' | 'doctor' | 'admin';

type HomepageProps = {
  session?: Session;
  workspaceHref?: string;
  language: Language;
  dark: boolean;
  onTheme: () => void;
  onLanguage: (language: Language) => void;
};

function Opening({ t, language, dark, onTheme, onLanguage, session, workspaceHref, primary }: HomepageProps & { t: Text; primary: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [compact, setCompact] = useState(false);
  const navigation = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    let mounted = true;
    const brand = nav.querySelector<HTMLElement>('.hy-brand')!;
    const links = nav.querySelector<HTMLElement>('.nav-links')!;
    const actions = nav.querySelector<HTMLElement>('.nav-actions')!;
    const pixels = (value: string) => Number.parseFloat(value) || 0;

    // Hidden links still contribute to the space required for the full header.
    const naturalWidth = (element: HTMLElement) => {
      if (getComputedStyle(element).display !== 'none') {
        return Math.max(element.getBoundingClientRect().width, element.scrollWidth);
      }
      const previousStyle = element.style.cssText;
      element.style.cssText += ';display:flex;position:absolute;visibility:hidden;inline-size:max-content';
      const width = element.getBoundingClientRect().width;
      element.style.cssText = previousStyle;
      return width;
    };
    const measure = () => {
      if (!mounted) return;
      const navStyle = getComputedStyle(nav);
      const actionStyle = getComputedStyle(actions);
      const buttons = Array.from(actions.children) as HTMLElement[];
      const actionWidth = buttons.reduce((total, element) => {
        const style = getComputedStyle(element);
        return total + naturalWidth(element) + pixels(style.marginLeft) + pixels(style.marginRight);
      }, 0) + pixels(actionStyle.columnGap) * Math.max(0, buttons.length - 1);
      const needed = naturalWidth(brand) + naturalWidth(links) + actionWidth
        + pixels(navStyle.columnGap) * 2 + pixels(navStyle.paddingLeft) + pixels(navStyle.paddingRight);
      const shouldCollapse = needed > nav.clientWidth;
      const focused = document.activeElement;
      if (shouldCollapse && (links.contains(focused) || focused === nav.querySelector('.hy-login'))) {
        nav.querySelector<HTMLButtonElement>('#hy-menu-button')?.focus();
      }
      setCompact(shouldCollapse);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [nav, brand, actions, ...Array.from(actions.children)].forEach(element => observer.observe(element));
    void document.fonts.ready.then(measure);
    return () => { mounted = false; observer.disconnect(); };
  }, [language, session]);
  const alternative = language === 'ar' ? 'en' : 'ar';

  return <>
    <div className="announcement"><a href="#journey">{t.notice} <span>{t.noticeAction} <Symbol icon="arrow" size={13} /></span></a></div>
    <section className="hy-hero" aria-labelledby="hero-title">
      <picture className="hero-photo">
        <source media="(max-width: 700px)" srcSet={heroMobile} />
        <img src={hero} alt="" width="1920" height="1078" fetchPriority="high" />
      </picture>
      <header className="hero-header" onKeyDown={event => {
        if (event.key === 'Escape' && menu) {
          setMenu(false);
          document.getElementById('hy-menu-button')?.focus();
        }
      }}>
        <div className="hy-nav" ref={navigation} data-layout={compact ? 'compact' : 'expanded'}>
          <Brand />
          <nav className="nav-links" aria-label={t.navigation} inert={compact}>{sections.map((id, i) => <a href={`#${id}`} key={id}>{t.links[i]}</a>)}<a href="#assistant">{t.assistant.title}</a></nav>
          <div className="nav-actions">
            {session === 'guest' && <a href="/login" className="hy-login" inert={compact}>{t.workspace.guest}</a>}
            {primary}
            <ThemeToggle className="nav-icon" dark={dark} label={dark ? t.lightMode : t.changeTheme} onClick={onTheme} />
            <button type="button" className="nav-icon" id="hy-menu-button" aria-label={menu ? t.close : t.menu} aria-expanded={menu} aria-controls="hy-menu" onClick={() => setMenu(!menu)}><Symbol icon={menu ? 'close' : 'menu'} size={17} /></button>
          </div>
        </div>
        <nav className="menu-panel" id="hy-menu" aria-label={t.navigation} hidden={!menu}>
          {sections.map((id, i) => <a href={`#${id}`} key={id} onClick={() => {
            document.getElementById(id)?.focus({ preventScroll: true });
            setMenu(false);
          }}>{t.links[i]}</a>)}
          <a href="#assistant" onClick={() => {
            document.getElementById('assistant')?.focus({ preventScroll: true });
            setMenu(false);
          }}>{t.assistant.title}</a>
          {session && session !== 'loading' && <a href={workspaceHref} className="menu-workspace" onClick={() => setMenu(false)}>{t.workspace[session]}</a>}
          {session === 'guest' && <a href="/register" onClick={() => setMenu(false)}>{t.join}</a>}
          <LanguageSwitch className="hy-language" language={language} label={t.language} onClick={() => {
            onLanguage(alternative);
            setMenu(false);
            document.getElementById('hy-menu-button')?.focus();
          }} />
        </nav>
      </header>
      <div className="hero-bottom">
        <div className="hero-copy">
          <h1 id="hero-title">{t.title}</h1><p>{t.intro}</p>
          <div className="hero-actions">{primary}<a href="#readings" className="hinge-cta">{t.sample}<Symbol icon="arrow" size={24} /></a></div>
        </div>
        <nav className="hero-shortcuts" aria-label={t.navigation}>
          {sections.map((id, i) => <a href={`#${id}`} key={id}><strong>{t.shortcuts[i]}</strong><small>{t.shortcutDetails[i]}</small></a>)}
        </nav>
      </div>
      <HeroHeartbeat language={language} />
    </section>
  </>;
}

export default function Homepage({ language, dark, onTheme, onLanguage, session = 'guest', workspaceHref = '/login' }: HomepageProps) {
  const t = copy[language];
  const alternative = language === 'ar' ? 'en' : 'ar';
  const main = useRef<HTMLElement>(null);
  const primaryHref = session === 'guest' ? '/register' : workspaceHref;
  const primaryLabel = session === 'loading' ? null : session === 'guest' ? t.join : t.workspace[session];
  const primary = primaryLabel && <Join href={primaryHref}>{primaryLabel}</Join>;
  const assistantHref = session === 'guest' ? '/login?returnTo=%2Fpatient%2Fassistant'
    : session === 'patient' ? '/patient/assistant'
      : undefined;

  useEffect(() => {
    const content = main.current;
    if (!content || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('hy-arrived');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    content.querySelectorAll('.levels-copy, .showcase-intro, #care-title, .hy-close > .hy-container')
      .forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return <div id="top" className="hybrid" data-i18n="declarative" data-theme={dark ? 'dark' : 'light'}>
    <a className="hy-skip" href="#main">{t.skip}</a>
    <main id="main" tabIndex={-1} ref={main}>
      <Opening t={t} language={language} dark={dark} onTheme={onTheme} onLanguage={onLanguage} session={session} workspaceHref={workspaceHref} primary={primary} />
      <Readings t={t} language={language} />
      <Showcase t={t} language={language} />
      <CareJourney t={t} language={language} />
      <section id="assistant" className="hy-assistant" tabIndex={-1} aria-labelledby="hy-assistant-title">
        <div className="hy-container hy-assistant-layout">
          <div className="hy-assistant-copy">
            <h2 id="hy-assistant-title">{t.assistant.title}</h2>
            <p>{t.assistant.intro}</p>
            <ul>{t.assistant.capabilities.map(capability => <li key={capability}>{capability}</li>)}</ul>
            <p className="hy-assistant-note">{t.assistant.note}</p>
            {assistantHref && <a className="fh-cta" href={assistantHref}>
              {session === 'patient' ? t.assistant.open : t.signIn}<Symbol icon="arrow" size={18} />
            </a>}
          </div>
          <figure className="hy-assistant-example">
            <figcaption>{t.assistant.example}</figcaption>
            <p className="hy-assistant-question">{t.assistant.question}</p>
            <p className="hy-assistant-answer">{t.assistant.answer}</p>
          </figure>
        </div>
      </section>
      <section className="hy-close" aria-labelledby="close-title">
        <div className="hy-container"><h2 id="close-title">{t.closeTitle}</h2><p>{t.closeBody}</p>{primaryLabel && <Join href={primaryHref} closing>{primaryLabel}</Join>}</div>
      </section>
    </main>
    <footer className="hy-footer">
      <div className="hy-container">
        <Brand />
        <nav aria-label={t.footerNav}>{session === 'guest' && <a href="/login">{t.signIn}</a>}<LanguageSwitch className="hy-language" language={language} label={t.language} onClick={() => onLanguage(alternative)} /><a href="#top">{t.top}</a></nav>
      </div>
    </footer>
  </div>;
}
