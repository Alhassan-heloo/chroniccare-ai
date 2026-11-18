import { useId, type ButtonHTMLAttributes, type ReactNode, type SyntheticEvent } from 'react';
import { ArrowUpLeft, ArrowUpRight, CircleHelp, type LucideIcon } from 'lucide-react';
import type { Copy } from './presentation';
import { Button as AppButton } from '@/components/ui/Button';

export { BrandMark as Mark } from "@/components/ui/BrandIdentity";
export function Arrow({rtl}:{rtl:boolean}) { const Icon=rtl?ArrowUpLeft:ArrowUpRight; return <Icon size={19} aria-hidden="true"/>; }
export function Button({children,className='',variant='primary',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'quiet';children:ReactNode}) {
  return <AppButton {...props} variant={variant === "quiet" ? "ghost" : variant} className={`button ${variant} ${className}`}>{children}</AppButton>;
}
export function Sample({c}:{c:Copy}) { return <span className="sample-label"><i aria-hidden="true"/>{c.sample}</span>; }
export function ReadingSignature() {
  return <svg className="reading-signature" viewBox="0 0 280 44" aria-hidden="true" focusable="false"><path d="M2 30C28 30 28 12 54 12S80 33 106 33S132 18 158 18S184 25 210 25S244 9 278 9"/><circle cx="278" cy="9" r="3"/></svg>;
}
/** Static information-flow artwork. Decorative only: not a plotted health series. */
export function SignatureArtwork() {
  const id=useId().replace(/:/g,'');
  return <svg className="signature-artwork" viewBox="0 0 1440 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-weave`} x1="0" y1="0" x2="1" y2=".7"><stop stopColor="var(--aqua)" stopOpacity=".18"/><stop offset=".55" stopColor="var(--glucose)" stopOpacity=".02"/><stop offset="1" stopColor="var(--pressure)" stopOpacity=".16"/></linearGradient></defs>
    <path className="weave-surface" fill={`url(#${id}-weave)`} d="M-80 360C100 390 100 50 340 92S570 428 790 333 1050 35 1250 90 1420 318 1530 190L1530 280C1340 402 1290 150 1130 177S970 420 740 415 510 178 330 170 150 470-80 438Z"/>
    {[0,1,2,3,4,5].map(index=><path className="weave-thread" key={index} transform={`translate(0 ${index*13})`} d="M-70 330C110 378 112 14 350 68S552 392 780 302 1038 4 1244 63 1400 285 1520 150"/>)}
    <path className="weave-guide" d="M50 424V122H220M1220 38H1374V346"/>
    <g className="weave-nodes"><circle cx="220" cy="122" r="5"/><circle cx="1374" cy="346" r="5"/><circle cx="50" cy="424" r="3"/><path d="m1214 38 6-6 6 6-6 6Z"/></g>
  </svg>;
}
/** A transfer ribbon, not a heartbeat or an additional medical data series. */
export function LivingPulse({cue}:{cue:string}) {
  const id=useId().replace(/:/g,'');
  return <svg className="living-pulse" viewBox="0 0 1000 46" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-pulse`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="var(--aqua)" stopOpacity="0"/><stop offset=".3" stopColor="var(--aqua)"/><stop offset=".72" stopColor="var(--glucose)"/><stop offset="1" stopColor="var(--glucose)" stopOpacity="0"/></linearGradient></defs>
    <path className="pulse-track" d="M0 30C150 30 170 10 340 10S560 38 720 24S880 14 1000 14"/>
    <path key={cue} className="pulse-transfer" d="M0 30C150 30 170 10 340 10S560 38 720 24S880 14 1000 14" pathLength="1" stroke={`url(#${id}-pulse)`}/>
  </svg>;
}
/** A quiet visual link between chapters; it encodes no health information. */
export function StoryBridge() {
  return <div className="story-bridge" aria-hidden="true"><LivingPulse cue="chapter"/></div>;
}
/** Animate the arrival of the exact value, never count through fabricated readings. */
export function ValueArrival({value}:{value:string}) {
  return <span className="value-arrival" key={value}>{value}</span>;
}
export function SectionMarker({label,icon:Icon}:{label:string;icon:LucideIcon}) {
  return <span className="eyebrow section-marker"><Icon size={17} aria-hidden="true"/><span>{label}</span><svg className="chapter-thread" viewBox="0 0 64 20" aria-hidden="true"><path d="M1 15C14 15 16 5 30 5S47 15 63 5"/><circle cx="63" cy="5" r="2"/></svg><i aria-hidden="true"/></span>;
}
export function ContextHelp({label,children}:{label:string;children:ReactNode}) {
  function place(event:SyntheticEvent<HTMLDetailsElement>) {
    const node=event.currentTarget,bubble=node.querySelector<HTMLElement>('.help-bubble');if(!node.open||!bubble)return;
    bubble.style.removeProperty('transform');
    const rect=node.getBoundingClientRect();node.dataset.side=rect.bottom+bubble.offsetHeight+12>innerHeight-24?'above':'below';
    // One local adjustment on opening, in physical coordinates for both RTL/LTR.
    // No pointer loop, observer or inherited custom property is introduced.
    const bounds=bubble.getBoundingClientRect(),shift=Math.max(12-bounds.left,Math.min(0,innerWidth-12-bounds.right));
    if(shift)bubble.style.transform=`translateX(${shift}px)`;
  }
  return <details className="context-help" onToggle={place} onKeyDown={event=>{if(event.key==='Escape'&&event.currentTarget.open){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label={label} title={label}><CircleHelp size={18} aria-hidden="true"/></summary><div className="help-bubble"><strong>{label}</strong><p>{children}</p></div></details>;
}
