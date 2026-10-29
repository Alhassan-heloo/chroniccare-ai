import { useEffect } from 'react';
import { focusScrollDelta } from './focusGeometry';

export function useViewportFocus() {
  useEffect(()=>{
    let frame=0;
    const reveal=(event:FocusEvent)=>{
      const target=event.target;
      if(!(target instanceof HTMLElement)||!target.matches(':focus-visible')||!target.closest('main')||target.closest('dialog,.workspace-dock'))return;
      cancelAnimationFrame(frame);
      // Native focus scrolling finishes first; never move focus or start a smooth-scroll loop.
      frame=requestAnimationFrame(()=>{
        if(document.activeElement!==target)return;
        const header=document.querySelector('.topbar')?.getBoundingClientRect();
        const dockNode=document.querySelector('.workspace-dock'),dock=dockNode?.getBoundingClientRect();
        const floating=!!dockNode&&getComputedStyle(dockNode).position==='fixed';
        const rect=target.getBoundingClientRect();
        const delta=focusScrollDelta(rect.top,rect.bottom,(header?.bottom??0)+14,floating&&dock?dock.top-14:innerHeight-14);
        if(Math.abs(delta)>.5)window.scrollBy({top:delta,behavior:'instant'});
      });
    };
    document.addEventListener('focusin',reveal);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('focusin',reveal);};
  },[]);
}
