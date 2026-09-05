import { BookOpenText, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { primaryNavLinks } from "../config/site";
import { useAuth } from "../features/auth/auth-context";

export function SiteLayout() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  return <>
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="wordmark" to="/" onClick={() => setOpen(false)}><span>Α · A</span><strong>Greek &amp; Latin Study</strong></Link>
        <button type="button" className="mobile-menu-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
        <nav className={`main-nav ${open ? "is-open" : ""}`}>
          {primaryNavLinks.map(({ label, href }) => <NavLink key={href} to={href} end={href === "/"} onClick={() => setOpen(false)}>{label}</NavLink>)}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <NavLink className="identity-link" to="/account">{user ? user.email ?? "Account" : "Sign in"}</NavLink>
      </div>
    </header>
    <Outlet />
    <footer className="site-footer"><Link className="footer-mark" to="/"><BookOpenText /> Greek &amp; Latin Study</Link><span>Active recall · adaptive review · reading aloud</span></footer>
  </>;
}
