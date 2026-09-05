import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
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

type FilterDisclosureProps = {
  title: string;
  summary?: string;
  children: ReactNode;
  nested?: boolean;
  checked?: boolean;
  mixed?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  count?: number;
};

export function FilterDisclosure({ title, summary, children, nested = false, checked, mixed = false, onCheckedChange, count }: FilterDisclosureProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = mixed;
  }, [mixed]);

  return <details className={`filter-disclosure ${nested ? "is-nested" : ""}`}>
    <summary>
      <span className="filter-disclosure-leading">
        {onCheckedChange && <input
          ref={checkboxRef}
          className="filter-disclosure-checkbox"
          type="checkbox"
          checked={Boolean(checked)}
          aria-label={`Select all ${title}`}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />}
        <span className="filter-disclosure-copy"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
      </span>
      <span className="filter-disclosure-trailing">
        {typeof count === "number" && <span className="filter-count">{count.toLocaleString()}</span>}
        <ChevronDown className="filter-disclosure-chevron" aria-hidden="true" />
      </span>
    </summary>
    <div className="filter-disclosure-body">{children}</div>
  </details>;
}

export function FilterCheckbox({ label, checked, mixed = false, onChange, count, disabled = false, nested = false, hint }: { label: string; checked: boolean; mixed?: boolean; onChange: (checked: boolean) => void; count?: number; disabled?: boolean; nested?: boolean; hint?: string }) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = mixed;
  }, [mixed]);

  return <label className={`filter-checkbox ${nested ? "is-nested" : ""} ${disabled ? "is-disabled" : ""}`}>
    <input ref={checkboxRef} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span className="filter-checkbox-copy"><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    {typeof count === "number" && <span className="filter-count">{count.toLocaleString()}</span>}
  </label>;
}
