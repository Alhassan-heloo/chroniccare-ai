import { useState } from "react";
import { useNavigate } from "react-router";
import { PublicLayout } from "@/components/public/PublicLayout";
import { LivingHome } from "@/components/public/living/LivingHome";
import { useLivingPresentation } from "@/components/public/living/presentation";
import { previewReadings, type Kind } from "@/components/public/living/model";
import { useAuth } from "@/auth/context";
import { roleHome } from "@/auth/api";
import { useI18n } from "@/i18n/context";

export default function HomePage() {
  const { user } = useAuth();
  const { language } = useI18n(), { c, l } = useLivingPresentation();
  const navigate = useNavigate();
  const [readings] = useState(previewReadings), [kind, setKind] = useState<Kind>("pressure");
  const [doses, setDoses] = useState([false, true]), [water, setWater] = useState(6), [steps, setSteps] = useState(4500);
  const [waterUndo, setWaterUndo] = useState<number | null>(null), [stepsUndo, setStepsUndo] = useState<number | null>(null);
  function explore() {
    navigate(user ? roleHome(user.role) : "/login?returnTo=%2Fpatient%2Fdashboard");
  }
  return <PublicLayout><main id="public-content" className="route-content" tabIndex={-1}>
    <LivingHome c={c} l={l} readings={readings} kind={kind} onKind={setKind} language={language} onDashboard={explore} onAccount={() => navigate(user ? roleHome(user.role) : "/register")}
      doses={doses} onDose={index => setDoses(previous => previous.map((value, i) => i === index ? !value : value))}
      water={water} onWater={() => { if (water < 8) { setWaterUndo(water); setWater(Math.min(8, water + 1)); } }} canUndoWater={waterUndo !== null} onUndoWater={() => { if (waterUndo !== null) { setWater(waterUndo); setWaterUndo(null); } }}
      steps={steps} onSteps={() => { if (steps < 10000) { setStepsUndo(steps); setSteps(Math.min(10000, steps + 500)); } }} canUndoSteps={stepsUndo !== null} onUndoSteps={() => { if (stepsUndo !== null) { setSteps(stepsUndo); setStepsUndo(null); } }} />
  </main></PublicLayout>;
}
