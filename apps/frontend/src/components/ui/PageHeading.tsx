import type { ReactNode } from "react";

/** One orientation pattern for account, connection and clinical workspaces. */
export function PageHeading({ title, description, action }: {
  title: string; description: string; action?: ReactNode;
}) {
  return <header className="experience-heading">
    <div><h1>{title}</h1><p>{description}</p></div>
    {action && <div className="experience-heading-action">{action}</div>}
  </header>;
}
