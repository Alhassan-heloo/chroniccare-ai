import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Bell, Check, Clock3, Menu, Moon, Pause, Play, Sun, X } from 'lucide-react';
import { copy, type Copy } from './content';
import { applyReading, createLocale, seedReadings, validReading, type Kind, type Language, type Page, type ReadingInput, type Theme } from './model';
import { Home } from './Home';
import { Dashboard } from './Dashboard';
import { ReportPanel } from './Panels';
import { Arrow, Button, Mark, Modal } from './ui';
import { scrollToSection } from './useActiveSection';
import { useViewportFocus } from './useViewportFocus';
import { useReducedMotion, useStoryMotion } from './useLivingMotion';

function preference(key:string) {try{return localStorage.getItem(key);}catch{return null;}}
function remember(key:string,value:string) {try{localStorage.setItem(key,value);}catch{/* Optional preferences must not interrupt the prototype. */}}
function currentPage():Page {return location.hash==='#dashboard'?'dashboard':'home';}

function MeasurementForm({c,initialKind,onSave,onClose}:{c:Copy;initialKind:Kind;onSave:(input:ReadingInput)=>void;onClose:()=>void}) {
  const [kind,setKind]=useState(initialKind),[invalid,setInvalid]=useState<string[]>([]);
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget,values=new FormData(form),input={kind,systolic:Number(values.get('systolic')),diastolic:Number(values.get('diastolic')),glucose:Number(values.get('glucose'))};
    if(!validReading(input)){
      const fields=Array.from(form.querySelectorAll('input'));
      const errors=fields.filter(field=>!field.validity.valid||!Number.isSafeInteger(Number(field.value))).map(field=>field.name);
      // Only the relationship can remain invalid after the native numeric constraints pass.
      if(!errors.length)errors.push('diastolic');
      setInvalid(errors);fields.find(field=>field.name===errors[0])?.focus();return;
    }
    onSave(input);
  }
  const fieldError=(name:string)=>({'aria-invalid':invalid.includes(name)||undefined,'aria-describedby':invalid.includes(name)?'reading-error':undefined});
  return <form className="measurement-form" onSubmit={submit} onInput={()=>{if(invalid.length)setInvalid([]);}} noValidate><p className="form-note">{c.temporary} {c.fictional}</p><label>{c.kind}<select value={kind} onChange={event=>{setKind(event.target.value as Kind);setInvalid([]);}}><option value="pressure">{c.pressure}</option><option value="glucose">{c.glucose}</option></select></label>{kind==='pressure'?<div className="form-columns"><label>{c.pressureTop}<span className="input-unit"><input name="systolic" type="number" inputMode="numeric" dir="ltr" required min="1" max="9999" {...fieldError('systolic')}/><span>mmHg</span></span></label><label>{c.pressureBottom}<span className="input-unit"><input name="diastolic" type="number" inputMode="numeric" dir="ltr" required min="1" max="9999" {...fieldError('diastolic')}/><span>mmHg</span></span></label></div>:<label>{c.glucoseValue}<span className="input-unit"><input name="glucose" type="number" inputMode="numeric" dir="ltr" required min="1" max="9999" {...fieldError('glucose')}/><span>mg/dL</span></span></label>}{invalid.length>0&&<p id="reading-error" className="form-error" role="alert">{c.invalid}</p>}<div className="form-actions"><Button variant="secondary" onClick={onClose}>{c.cancel}</Button><Button type="submit">{c.save}</Button></div></form>;
}

export function App() {
  const [language,setLanguage]=useState<Language>(()=>preference('cc-living-language')==='en'?'en':'ar'),[theme,setTheme]=useState<Theme>(()=>preference('cc-living-theme')==='light'?'light':'dark'),[page,setPage]=useState<Page>(currentPage);
  const [menu,setMenu]=useState(false),[readings,setReadings]=useState(seedReadings),[kind,setKind]=useState<Kind>('pressure'),[doses,setDoses]=useState([false,true]),[water,setWater]=useState(6),[steps,setSteps]=useState(4500);
  const [waterUndo,setWaterUndo]=useState<number|null>(null),[stepsUndo,setStepsUndo]=useState<number|null>(null);
  const [modal,setModal]=useState<'reading'|'notifications'|'report'|'login'|'register'|null>(null),[reviewed,setReviewed]=useState(false),[saved,setSaved]=useState(false);
  const menuRef=useRef<HTMLButtonElement>(null),c=copy[language],l=useMemo(()=>createLocale(language),[language]);
  const reducedMotion=useReducedMotion();
  const [pauseMotion,setPauseMotion]=useState(()=>preference('cc-living-motion')==='paused');
  useViewportFocus();
  useStoryMotion(page);
  useEffect(()=>remember('cc-living-motion',pauseMotion?'paused':'running'),[pauseMotion]);
  useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';remember('cc-living-language',language);},[language]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#0b1320':'#f1f5f9');remember('cc-living-theme',theme);},[theme]);
  useEffect(()=>{document.title=`ChronicCare AI — ${page==='home'?c.home:c.dashboard}`;},[page,c.home,c.dashboard]);
  useEffect(()=>{const onHash=()=>{setPage(currentPage());setMenu(false);};window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash);},[]);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true});},[page]);
  function go(next:Page) {setModal(null);setMenu(false);if(location.hash===`#${next}`){window.scrollTo({top:0,behavior:pauseMotion||reducedMotion?'instant':'auto'});return;}location.hash=next;}
  function scrollStory() {setMenu(false);scrollToSection('weekly-scene');}
  const closeModal=()=>setModal(null);
  const routine={c,l,doses,onDose:(index:number)=>setDoses(previous=>previous.map((value,i)=>i===index?!value:value)),
    water,onWater:()=>{if(water<8){setWaterUndo(water);setWater(Math.min(8,water+1));}},canUndoWater:waterUndo!==null,onUndoWater:()=>{if(waterUndo!==null){setWater(waterUndo);setWaterUndo(null);}},
    steps,onSteps:()=>{if(steps<10000){setStepsUndo(steps);setSteps(Math.min(10000,steps+500));}},canUndoSteps:stepsUndo!==null,onUndoSteps:()=>{if(stepsUndo!==null){setSteps(stepsUndo);setStepsUndo(null);}}};
  const canvas={c,l,readings,kind,onKind:setKind};
  return <div className={`living-app page-${page}`} data-motion={pauseMotion||reducedMotion?'paused':'running'}><div className="atmosphere" aria-hidden="true"><span className="aurora aurora-blue"/><span className="aurora aurora-aqua"/><div className="atmosphere-grain"/></div><a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();document.getElementById('main-content')?.focus();}}>{c.skip}</a>
    <header className="topbar glass" onKeyDown={event=>{if(event.key==='Escape'&&menu){event.preventDefault();setMenu(false);menuRef.current?.focus();}}}><button type="button" className="brand" onClick={()=>go('home')} aria-label={`ChronicCare AI / ${c.home}`}><Mark/><span dir="ltr">ChronicCare <b>AI</b><small dir={language==='ar'?'rtl':'ltr'}>{c.interfaceLabel}</small></span></button>
      <button ref={menuRef} type="button" className="icon-button menu-toggle" aria-label={menu?c.close:c.menu} aria-expanded={menu} aria-controls="navigation-panel" onClick={()=>setMenu(value=>!value)}>{menu?<X size={21} aria-hidden="true"/>:<Menu size={21} aria-hidden="true"/>}</button>
      <nav id="navigation-panel" className={`navigation-panel ${menu?'open':''}`} aria-label={c.navigation}><div className="route-links"><button type="button" aria-current={page==='home'?'page':undefined} onClick={()=>go('home')}>{c.home}</button>{page==='home'&&<button type="button" onClick={scrollStory}>{c.explore}</button>}<button type="button" aria-current={page==='dashboard'?'page':undefined} onClick={()=>go('dashboard')}>{c.dashboard}</button></div><div className="account-links">{page==='home'?<><button type="button" className="login-action" onClick={()=>{setModal('login');}}>{c.login}</button><Button variant="secondary" className="register-action" onClick={()=>{setModal('register');}}>{c.register}<Arrow rtl={language==='ar'}/></Button></>:<span className="demo-session">{c.prototype}</span>}</div></nav>
      <div className="topbar-controls"><button type="button" className="icon-button language-toggle" lang={language==='ar'?'en':'ar'} title={language==='ar'?c.toEnglish:c.toArabic} aria-label={language==='ar'?c.toEnglish:c.toArabic} onClick={()=>setLanguage(language==='ar'?'en':'ar')}>{language==='ar'?'EN':'ع'}</button><button type="button" className="icon-button theme-toggle" title={theme==='dark'?c.toLight:c.toDark} aria-label={theme==='dark'?c.toLight:c.toDark} aria-pressed={theme==='dark'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18} aria-hidden="true"/>:<Moon size={18} aria-hidden="true"/>}</button><button type="button" className="icon-button motion-toggle" disabled={reducedMotion} aria-label={reducedMotion?c.motionReduced:pauseMotion?c.motionResume:c.motionPause} title={reducedMotion?c.motionReduced:pauseMotion?c.motionResume:c.motionPause} aria-pressed={pauseMotion||reducedMotion} onClick={()=>setPauseMotion(value=>!value)}>{pauseMotion||reducedMotion?<Play size={16} aria-hidden="true"/>:<Pause size={16} aria-hidden="true"/>}</button>{page==='dashboard'&&<button type="button" className="icon-button notification-trigger" title={c.notificationsLabel} aria-label={c.notificationsLabel} onClick={()=>setModal('notifications')}><Bell size={19} aria-hidden="true"/>{!reviewed&&<span className="notification-dot" aria-hidden="true"/>}</button>}</div>
    </header>
    <main id="main-content" tabIndex={-1} className="route-content" key={page}>{page==='home'?<Home {...canvas} {...routine} language={language} onDashboard={()=>go('dashboard')} onAccount={()=>setModal('register')}/>:<Dashboard {...canvas} {...routine} onAdd={()=>setModal('reading')} onReport={()=>setModal('report')}/>}</main>
    <footer className="site-footer"><div><Mark/><span>{c.footer}</span></div><p>{c.footerNote}<small>{c.footerPrivacy}</small></p><button type="button" className="icon-button" aria-label={c.backTop} onClick={()=>window.scrollTo({top:0,behavior:pauseMotion||reducedMotion?'instant':'smooth'})}><ArrowUp size={19} aria-hidden="true"/></button></footer>
    <div className="toast" role="status">{saved&&<><Check size={19} aria-hidden="true"/><span>{c.saved}</span><button type="button" className="icon-button" aria-label={c.close} onClick={()=>setSaved(false)}><X size={18} aria-hidden="true"/></button></>}</div>
    <Modal open={modal!==null} onClose={closeModal} c={c} title={modal==='reading'?c.newReading:modal==='report'?c.reports:modal==='notifications'?c.notifications:modal==='login'?c.login:c.register} className={modal==='report'?'report-modal':''}>
      {modal==='reading'&&<MeasurementForm c={c} initialKind={kind} onClose={closeModal} onSave={input=>{setReadings(previous=>applyReading(previous,input));setKind(input.kind);setSaved(true);setModal(null);}}/>}
      {modal==='report'&&<ReportPanel c={c} l={l} readings={readings}/>}
      {modal==='notifications'&&<div className="notification-preview"><p>{c.notificationsBody}</p><ul><li><Bell size={18} aria-hidden="true"/>{c.reminder}</li><li><ActivityIcon/>{c.unsavedReminder}</li></ul><Button className="mark-read" disabled={reviewed} onClick={()=>setReviewed(true)}>{reviewed?c.read:c.markRead}</Button></div>}
      {(modal==='login'||modal==='register')&&<div className="access-preview"><span className="eyebrow">{c.accessTitle}</span><p>{c.accessBody}</p><Button className="access-demo" onClick={()=>go('dashboard')}>{c.openSpace}<Arrow rtl={language==='ar'}/></Button><Button variant="quiet" onClick={closeModal}>{c.cancel}</Button></div>}
    </Modal>
  </div>;
}

function ActivityIcon() {return <Clock3 size={18} aria-hidden="true"/>;}
