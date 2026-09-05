import { useState } from "react";
import { useAuth } from "../features/auth/auth-context";
import { SessionManager } from "../features/study/account-session-manager";
import { StatsPage } from "./stats-page";

export function StatsHubPage() {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  return <>
    <div className="page-shell"><SessionManager user={user} onChanged={() => setRevision((value) => value + 1)} /></div>
    <StatsPage key={revision} />
  </>;
}
