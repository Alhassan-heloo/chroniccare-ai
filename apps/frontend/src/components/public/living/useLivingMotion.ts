import { useEffect, useRef, useState } from 'react';

export function useReducedMotion() {
  const [reduced,setReduced]=useState(()=>typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  return reduced;
}

/** One-shot, independently observed story beats. No scroll handler or React state. */
export function useStoryMotion(page:string) {
  useEffect(()=>{
    const main=document.querySelector<HTMLElement>('.living-public main'),app=document.querySelector<HTMLElement>('.living-public');
    if(!main||!app)return;
    const beats=Array.from(main.querySelectorAll<HTMLElement>('.scene-copy,.week-lens,.routine-item,.report-sheet,.assistant-composition,.closing-line,.story-bridge'));
    const reveal=(node:Element)=>{node.classList.add('in-view');node.closest('.reveal')?.classList.add('in-view');};
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){reveal(entry.target);observer.unobserve(entry.target);}
    }),{threshold:0,rootMargin:'0px 0px -32px 0px'});
    beats.forEach(node=>{node.classList.add('motion-enter');observer.observe(node);});
    main.setAttribute('data-story-ready','');
    // Keyboard access never waits for an entrance animation, including a skipped scene.
    const focus=(event:FocusEvent)=>{
      if(!(event.target instanceof Element))return;
      const beat=event.target.closest('.motion-enter');if(beat){reveal(beat);observer.unobserve(beat);}
    };
    main.addEventListener('focusin',focus);
    // Ambient motion is useful at the introduction, not while reading later sections.
    let introVisible=false;
    const ambient=()=>{const state=introVisible&&!document.hidden?'active':'rest';if(app.dataset.ambient!==state)app.dataset.ambient=state;};
    const intro=main.querySelector('.intro-copy');
    const ambientObserver=new IntersectionObserver(entries=>{introVisible=entries.some(entry=>entry.isIntersecting);ambient();});
    if(intro)ambientObserver.observe(intro);else ambient();
    document.addEventListener('visibilitychange',ambient);
    return()=>{observer.disconnect();ambientObserver.disconnect();main.removeEventListener('focusin',focus);main.removeAttribute('data-story-ready');document.removeEventListener('visibilitychange',ambient);};
  },[page]);
}

/** One paint per pointer frame, no React renders, no idle JS animation loop. */
export function useCanvasLight() {
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{
    const node=ref.current;if(!node)return;
    // Only this layer consumes the coordinates. Keep inherited custom-property
    // invalidation out of the chart, readouts and accessible data table.
    const light=node.querySelector<HTMLElement>('.canvas-light');if(!light)return;
    const fine=matchMedia('(hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0;
    const move=(event:PointerEvent)=>{
      if(event.pointerType==='touch'||!fine.matches||reduced.matches||node.closest('[data-motion=paused]'))return;
      cancelAnimationFrame(frame);
      const {clientX,clientY}=event;
      frame=requestAnimationFrame(()=>{
        const rect=node.getBoundingClientRect();
        light.style.setProperty('--light-x',`${Math.max(0,Math.min(100,(clientX-rect.left)/rect.width*100))}%`);
        light.style.setProperty('--light-y',`${Math.max(0,Math.min(100,(clientY-rect.top)/rect.height*100))}%`);
      });
    };
    const reset=()=>{cancelAnimationFrame(frame);light.style.removeProperty('--light-x');light.style.removeProperty('--light-y');};
    node.addEventListener('pointermove',move,{passive:true});node.addEventListener('pointerleave',reset);
    return()=>{reset();node.removeEventListener('pointermove',move);node.removeEventListener('pointerleave',reset);};
  },[]);
  return ref;
}
