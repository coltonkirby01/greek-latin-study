import { ArrowRight, BookOpenText, Cloud, ExternalLink, Repeat2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { homeCourses, type CourseId } from "../config/site";
import { useAuth } from "../features/auth/auth-context";
import "./home-page.css";

const courseVisuals: Record<CourseId, ReactNode> = {
  greek: <span className="course-glyph course-glyph-word greek-course-title">Ἑλληνικά</span>,
  latin: <span className="course-glyph course-glyph-word latin-course-title">LINGVA LATINA</span>,
  reading: <span className="course-icon"><BookOpenText /></span>,
};

const overlayLinkStyle: CSSProperties = { position: "absolute", inset: 0, zIndex: 1, borderRadius: "inherit" };
const protectedTextStyle: CSSProperties = { position: "relative", zIndex: 2 };
const interactiveStyle: CSSProperties = { position: "relative", zIndex: 3 };
const visualLinkStyle: CSSProperties = { ...interactiveStyle, width: "fit-content", display: "inline-flex", color: "inherit", textDecoration: "none" };
const titleLinkStyle: CSSProperties = { color: "inherit", textDecoration: "none" };

export function HomePage() {
  const { user } = useAuth();
  return <main className="page-shell home-page">
    <section className="home-intro">
      <div><p className="eyebrow">Active recall · adaptive review</p><h1>Build a durable memory of Greek and Latin.</h1><p className="home-lede">Greek and Latin each have one study app. Choose exactly what belongs in a session, from several Greek lesson categories to a mixture of Latin vocabulary and grammar, then reveal, rate, and review adaptively.</p></div>
      <div className="method-note"><Repeat2 /><div><strong>One deliberate cycle</strong><span>Choose · recall · reveal · rate · review</span></div></div>
    </section>
    <section className="course-grid">
      {homeCourses.map((course) => <Course key={course.id} {...course} visual={courseVisuals[course.visual]} />)}
    </section>
    <section className="sign-in-callout panel-surface">
      <div className="callout-icon"><Cloud /></div>
      <div><h2>{user ? "Your progress is connected" : "Keep your place on every device"}</h2><p>{user ? "Forward, reverse, whole-chart, reading, and imported-deck progress can sync to your account." : "Guest study works immediately on this device. Sign in when cloud accounts are configured to sync everywhere."}</p></div>
      <Link className="button-link primary-button" to="/account">{user ? "View account" : "Sign in to sync"}</Link>
    </section>
  </main>;
}

function Course({ id, visual, count, eyebrow, title, description, sourceLinks, href, linkLabel }: { id: CourseId; visual: ReactNode; count: string; eyebrow: string; title: string; description: string; sourceLinks: readonly { label: string; href: string }[]; href: string; linkLabel: string }) {
  const flashcardCourse = id === "greek" || id === "latin";
  return <article className="course-card">
    <Link to={href} aria-hidden="true" tabIndex={-1} style={overlayLinkStyle} />
    <div className="course-card-top">
      {flashcardCourse ? <Link to={href} aria-label={`Open ${eyebrow} flashcards`} style={visualLinkStyle}>{visual}</Link> : visual}
      {count && <span className="course-count" style={protectedTextStyle}>{count}</span>}
    </div>
    <p className="eyebrow" style={protectedTextStyle}>{eyebrow}</p>
    <h2 style={protectedTextStyle}>{id === "reading" ? <Link to={href} style={titleLinkStyle}>{title}</Link> : title}</h2>
    <p style={protectedTextStyle}>{description}</p>
    {sourceLinks.length > 0 && <div className="course-source-links" aria-label={`${eyebrow} sources`} style={interactiveStyle}>
      {sourceLinks.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer">{source.label} <ExternalLink aria-hidden="true" /></a>)}
    </div>}
    <Link className="course-link" to={href} style={interactiveStyle}>{linkLabel} <ArrowRight /></Link>
  </article>;
}
