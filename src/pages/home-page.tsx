import { ArrowRight, BookOpenText, Cloud, Repeat2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { homeCourses, type CourseId } from "../config/site";
import { useAuth } from "../features/auth/auth-context";

const courseVisuals: Record<CourseId, ReactNode> = {
  greek: <span className="course-glyph course-glyph-word greek-course-title">Ἑλληνικά</span>,
  latin: <span className="course-glyph course-glyph-word latin-course-title">LINGVA LATINA</span>,
  reading: <span className="course-icon"><BookOpenText /></span>,
};

export function HomePage() {
  const { user } = useAuth();
  return <main className="page-shell home-page">
    <section className="home-intro">
      <div><p className="eyebrow">Active recall · adaptive review</p><h1>Build a durable memory of Greek and Latin.</h1><p className="home-lede">Greek and Latin each have one study app. Choose exactly what belongs in a session—from several Greek lesson categories to a mixture of Latin vocabulary and grammar—then reveal, rate, and review adaptively.</p></div>
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

function Course({ visual, count, eyebrow, title, description, href, linkLabel }: { visual: ReactNode; count: string; eyebrow: string; title: string; description: string; href: string; linkLabel: string }) {
  return <article className="course-card">
    <div className="course-card-top">{visual}{count && <span className="course-count">{count}</span>}</div>
    <p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p>
    <Link className="course-link" to={href}>{linkLabel} <ArrowRight /></Link>
  </article>;
}
