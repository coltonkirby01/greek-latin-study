import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/site-layout";
import { AccountPage } from "./pages/account-page";
import { AdminPage } from "./pages/admin-page";
import { DeckLibraryPage } from "./pages/deck-library-page";
import { DynamicDeckPage } from "./pages/dynamic-deck-page";
import { GreekPage } from "./pages/greek-page";
import { HenlePage } from "./pages/henle-page";
import { HomePage } from "./pages/home-page";
import { LatinPage } from "./pages/latin-page";
import { NotFoundPage } from "./pages/not-found-page";
import { ReadingPage } from "./pages/reading-page";
export function App() { return <Routes><Route element={<SiteLayout />}><Route index element={<HomePage />} /><Route path="greek" element={<GreekPage />} /><Route path="latin" element={<LatinPage />} /><Route path="henle" element={<HenlePage />} /><Route path="decks" element={<DeckLibraryPage />} /><Route path="decks/:slug" element={<DynamicDeckPage />} /><Route path="reading" element={<ReadingPage />} /><Route path="account" element={<AccountPage />} /><Route path="admin" element={<AdminPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes>; }
