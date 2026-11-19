import { useState } from "react";
import { Pause, Play, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { Modal } from "@/components/ui/Modal";
import { Preferences } from "./Preferences";
import { PhoneInstall } from "./PhoneInstall";
export type MotionPreference = { paused: boolean; reduced: boolean; toggle: () => void };
export function PreferencesButton({ motion }: { motion?: MotionPreference }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const title = t("common.preferences.title");
  const motionLabel = t(motion?.reduced ? "public.living.motionReduced" : motion?.paused ? "public.living.motionResume" : "public.living.motionPause");
  return <>
    <button className="icon-button header-preferences-button" type="button" onClick={() => setOpen(true)} aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open}>
      <SlidersHorizontal size={20} strokeWidth={1.8} aria-hidden="true" />
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={title} declarativeTitle>
      <div className="workspace-preferences">
        <Preferences />
        <PhoneInstall />
        {motion && <button type="button" className="btn btn-secondary motion-toggle" disabled={motion.reduced} aria-label={motionLabel} aria-pressed={motion.paused || motion.reduced} onClick={motion.toggle}>
          {motion.paused || motion.reduced ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}{motionLabel}
        </button>}
      </div>
    </Modal>
  </>;
}
