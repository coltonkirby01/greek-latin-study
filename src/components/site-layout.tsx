import { BookOpenText, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { primaryNavLinks } from "../config/site";
import { useAuth } from "../features/auth/auth-context";

function accountInitials(email: string | null | undefined, metadata: Record<string, unknown> | undefined) {
  const name = [metadata?.full_name, metadata?.name].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : parts[0]?.[1] ?? ""}`.toUpperCase();
  }
  const local = (email ?? "A").split("@")[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  return local.slice(0, 2).toUpperCase() || "A";
}

export function SiteLayout() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const initials = user ? accountInitials(user.email, user.user_metadata) : null;

  return <>
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="wordmark" to="/" onClick={() => setOpen(false)}><span>Α · A</span><strong>Greek &amp; Latin Study</strong></Link>
        <button type="button" className="mobile-menu-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
        <nav className={`main-nav ${open ? "is-open" : ""}`}>
          {primaryNavLinks.map(({ label, href }) => <NavLink key={href} to={href} end={href === "/"} onClick={() => setOpen(false)}>{label}</NavLink>)}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        {user ? <NavLink className="identity-link identity-avatar" to="/account" title={user.email ?? "Account"} aria-label={`Account${user.email ? ` for ${user.email}` : ""}`}><span aria-hidden="true">{initials}</span></NavLink> : <NavLink className="identity-link header-sign-in" to="/account">Sign in</NavLink>}
      </div>
    </header>
    <Outlet />
    <footer className="site-footer">
      <Link className="footer-mark" to="/"><BookOpenText /> Greek &amp; Latin Study</Link>
      <div className="site-footer-copy">
        <span>Active recall · adaptive review · reading aloud</span>
        <nav className="footer-links" aria-label="Legal"><a href={`${import.meta.env.BASE_URL}privacy/`}>Privacy</a><a href={`${import.meta.env.BASE_URL}terms/`}>Terms</a></nav>
      </div>
    </footer>
  </>;
}
