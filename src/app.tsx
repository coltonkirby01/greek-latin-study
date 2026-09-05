import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/site-layout";

const HomePage = lazy(async () => ({ default: (await import("./pages/home-page")).HomePage }));
const GreekPage = lazy(async () => ({ default: (await import("./pages/greek-page")).GreekPage }));
const LatinPage = lazy(async () => ({ default: (await import("./pages/latin-page")).LatinPage }));
const DynamicDeckPage = lazy(async () => ({ default: (await import("./pages/dynamic-deck-page")).DynamicDeckPage }));
const ReadingPage = lazy(async () => ({ default: (await import("./pages/reading-page")).ReadingPage }));
const AccountPage = lazy(async () => ({ default: (await import("./pages/account-page")).AccountPage }));
const AdminPage = lazy(async () => ({ default: (await import("./pages/admin-page")).AdminPage }));
const NotFoundPage = lazy(async () => ({ default: (await import("./pages/not-found-page")).NotFoundPage }));

function RouteLoading() {
  return <main className="page-shell"><div className="study-loading panel-surface" role="status"><span className="loading-mark">Α</span><p>Opening your study materials…</p></div></main>;
}

export function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="greek" element={<GreekPage />} />
          <Route path="latin" element={<LatinPage />} />
          <Route path="henle" element={<Navigate to="/latin" replace />} />
          <Route path="decks/:slug" element={<DynamicDeckPage />} />
          <Route path="reading" element={<ReadingPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
