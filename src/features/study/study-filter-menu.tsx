import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import "./study-filter-menu.css";

export function StudyFilterMenu({ summary, detail, children }: { summary: string; detail?: string; children: ReactNode }) {
  return <details className="study-filter-menu panel-surface">
    <summary>
      <span className="filter-summary-label"><SlidersHorizontal aria-hidden="true" /><span>Choose cards</span></span>
      <strong>{summary}</strong>
      <ChevronDown className="filter-chevron" aria-hidden="true" />
    </summary>
    <div className="study-filter-menu-body">
      {detail && <p className="filter-menu-detail">{detail}</p>}
      {children}
    </div>
  </details>;
}

export function FilterSection({ title, description, onAll, onNone, children }: { title: string; description?: string; onAll?: () => void; onNone?: () => void; children: ReactNode }) {
  return <section className="filter-section">
    <div className="filter-section-heading">
      <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
      {(onAll || onNone) && <div className="filter-actions">{onAll && <button type="button" onClick={onAll}>All</button>}{onNone && <button type="button" onClick={onNone}>None</button>}</div>}
    </div>
    <div className="filter-option-grid">{children}</div>
  </section>;
}

export function FilterDisclosure({ title, summary, children, nested = false }: { title: string; summary?: string; children: ReactNode; nested?: boolean }) {
  return <details className={`filter-disclosure ${nested ? "is-nested" : ""}`}>
    <summary>
      <span className="filter-disclosure-copy"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
      <ChevronDown className="filter-disclosure-chevron" aria-hidden="true" />
    </summary>
    <div className="filter-disclosure-body">{children}</div>
  </details>;
}

export function FilterCheckbox({ label, checked, onChange, count, disabled = false, nested = false, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; count?: number; disabled?: boolean; nested?: boolean; hint?: string }) {
  return <label className={`filter-checkbox ${nested ? "is-nested" : ""} ${disabled ? "is-disabled" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span className="filter-checkbox-copy"><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    {typeof count === "number" && <span className="filter-count">{count.toLocaleString()}</span>}
  </label>;
}
