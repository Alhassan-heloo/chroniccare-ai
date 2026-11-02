import type { ReactNode } from "react";
import { SignatureArtwork } from "@/components/public/living/ui";

/** One orientation pattern for account, connection and clinical workspaces. */
export function PageHeading({ title, description, eyebrow, action }: {
  title: string; description: string; eyebrow?: string; action?: ReactNode;
}) {
  return <header className="experience-heading">
    <SignatureArtwork />
    <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>
    {action && <div className="experience-heading-action">{action}</div>}
  </header>;
}
