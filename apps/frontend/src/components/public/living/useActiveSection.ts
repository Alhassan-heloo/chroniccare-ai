import { useEffect, useState } from 'react';

/** One measured offset, rather than adding scroll-padding and scroll-margin. */
export function scrollToSection(id:string) {
  requestAnimationFrame(()=>{
    const target=document.getElementById(id);if(!target)return;
    const header=Math.max(0,document.querySelector('.topbar')?.getBoundingClientRect().bottom??0);
    const still=matchMedia('(prefers-reduced-motion: reduce)').matches||!!document.querySelector('.living-public[data-motion=paused]');
    window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-header-24),behavior:still?'instant':'smooth'});
  });
}

/** Observe reading position, never scroll or change the route/focus in response. */
export function useActiveSection<const T extends string>(ids:readonly T[]) {
  const [active,setActive]=useState<T|null>(null);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      frame=0;
      const headerBottom=document.querySelector('.topbar')?.getBoundingClientRect().bottom??0;
      const anchor=Math.min(innerHeight*.45,headerBottom+32);
      let next:T|null=null,nearest=-Infinity;
      for(const id of ids){
        const rect=document.getElementById(id)?.getBoundingClientRect();
        if(rect&&rect.height>0&&rect.top<=anchor&&rect.top>nearest){nearest=rect.top;next=id;}
      }
      setActive(previous=>previous===next?previous:next);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    const observer=new ResizeObserver(schedule),main=document.querySelector('.living-public main');
    if(main)observer.observe(main);
    schedule();
    return()=>{window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer.disconnect();cancelAnimationFrame(frame);};
  },[ids]);
  return active;
}
