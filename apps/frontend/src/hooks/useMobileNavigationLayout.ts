import { useEffect, useRef, useState } from "react";

/** Keep enlarged mobile navigation in document flow instead of covering the task. */
export function useMobileNavigationLayout() {
  const ref = useRef<HTMLElement>(null);
  const [expandedText, setExpandedText] = useState(false);
  useEffect(() => {
    const measure = () => setExpandedText(innerWidth < 768 && (parseFloat(getComputedStyle(document.documentElement).fontSize) > 20 || innerWidth < 280));
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener("resize", measure); measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return { ref, expandedText };
}
