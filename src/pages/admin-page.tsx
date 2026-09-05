import { ArrowDown, ArrowUp, FileSpreadsheet, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import {
  addCategory,
  createDeck,
  deleteCard,
  importCards,
  listAdminDecks,
  listCategories,
  loadCards,
  saveCard,
  slugify,
  swapCardPositions,
  updateDeck,
  type CloudCard,
  type CloudDeck,
  type ImportCard,
} from "../features/decks/deck-service";
import { parseDeckImport } from "../features/decks/import-parser";

export function AdminPage() {
  const auth = useAuth();
  if (auth.loading) return <main className="page-shell"><p>Checking administrator access…</p></main>;
  if (!auth.configured) return <main className="page-shell article-page"><section className="prose-panel panel-surface"><p className="eyebrow">Administrator setup</p><h1>Connect Supabase to enable deck administration.</h1><p>The database migration, importer, editor, and row-level security are included in this repository.</p></section></main>;
  if (!auth.user) return <main className="page-shell article-page"><section className="prose-panel panel-surface"><h1>Administrator access is private.</h1><Link to="/account">Go to sign in</Link></section></main>;
  if (!auth.isAdmin) return <main className="page-shell article-page"><section className="prose-panel panel-surface"><h1>Access denied.</h1><p>Visiting this URL directly does not grant deck-management permissions.</p></section></main>;
  return <AdminWorkspace />;
}

function AdminWorkspace() {
  const [decks, setDecks] = useState<CloudDeck[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [cards, setCards] = useState<CloudCard[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [preview, setPreview] = useState<ImportCard[]>([]);
  const [replace, setReplace] = useState(false);
  const [editing, setEditing] = useState<CloudCard | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const selected = decks.find((deck) => deck.id === selectedId) ?? null;

  const refreshDecks = useCallback(async () => {
    const next = await listAdminDecks();
    setDecks(next);
    setSelectedId((current) => current || next[0]?.id || "");
  }, []);

  const refreshSelected = useCallback(async (deckId: string) => {
    if (!deckId) return;
    const [nextCards, nextCategories] = await Promise.all([loadCards(deckId), listCategories(deckId)]);
    setCards(nextCards);
    setCategories(nextCategories as Array<{ id: string; name: string }>);
  }, []);

  useEffect(() => { void refreshDecks().catch((reason) => setError(reason.message)); }, [refreshDecks]);
  useEffect(() => { void refreshSelected(selectedId).catch((reason) => setError(reason.message)); }, [refreshSelected, selectedId]);

  async function act(action: () => Promise<void>, success: string) {
    setWorking(true); setError(null); setMessage(null);
    try { await action(); setMessage(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    await act(async () => {
      const deck = await createDeck({
        title,
        slug: slugify(String(data.get("slug") || title)),
        description: String(data.get("description") ?? "").trim(),
        subject: String(data.get("subject") ?? "").trim(),
        language: String(data.get("language")) as CloudDeck["language"],
        supportsReverse: data.get("supportsReverse") === "on",
      });
      form.reset();
      await refreshDecks();
      setSelectedId(deck.id);
    }, `Created “${title}”.`);
  }

  async function chooseImport(file: File | undefined) {
    if (!file) return;
    try { setError(null); setPreview(await parseDeckImport(file)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function publishImport() {
    if (!selected || !preview.length) return;
    const count = preview.length;
    await act(async () => {
      setCards(await importCards(selected.id, preview, replace));
      setPreview([]);
    }, `${replace ? "Replaced the deck with" : "Added"} ${count} cards.`);
  }

  async function storeCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    await act(async () => {
      await saveCard({
        ...(editing ?? {}),
        deck_id: selected.id,
        front: String(data.get("front") ?? "").trim(),
        back: String(data.get("back") ?? "").trim(),
        reverse_prompt: String(data.get("reversePrompt") ?? "").trim() || null,
        category: String(data.get("category") ?? "").trim() || null,
        rank: String(data.get("rank") ?? "").trim() ? Number(data.get("rank")) : null,
        source: String(data.get("source") ?? "").trim() || null,
        notes: String(data.get("notes") ?? "").trim() || null,
      });
      setEditing(null);
      form.reset();
      await refreshSelected(selected.id);
    }, editing ? "Card updated." : "Card added.");
  }

  return (
    <main className="page-shell admin-page">
      <div className="study-page-heading">
        <div><p className="eyebrow">Authorized administrator</p><h1>Deck Administration</h1></div>
        <p>CSV, XLSX, or JSON · preview before import</p>
      </div>
      {message && <div className="success-alert">{message}</div>}
      {error && <div className="inline-alert">{error}</div>}
      <div className="admin-grid">
        <aside className="admin-sidebar panel-surface">
          <h2>Decks</h2>
          <div className="admin-deck-list">
            {decks.map((deck) => (
              <button type="button" aria-pressed={deck.id === selectedId} key={deck.id} onClick={() => { setSelectedId(deck.id); setPreview([]); setEditing(null); }}>
                <strong>{deck.title}</strong><span>{deck.published ? "Published" : "Draft"}</span>
              </button>
            ))}
          </div>
          <details>
            <summary><Plus aria-hidden="true" /> New deck</summary>
            <form className="stack-form" onSubmit={create}>
              <label><span>Title</span><input name="title" required /></label>
              <label><span>Slug (optional)</span><input name="slug" placeholder="generated-from-title" /></label>
              <label><span>Subject</span><input name="subject" placeholder="Latin vocabulary" /></label>
              <label><span>Language</span><select name="language" defaultValue="latin"><option value="greek">Greek</option><option value="latin">Latin</option><option value="other">Other</option></select></label>
              <label><span>Description</span><textarea name="description" rows={3} /></label>
              <label className="check-label"><input type="checkbox" name="supportsReverse" defaultChecked /><span>Enable logical reverse study</span></label>
              <button className="primary-button form-submit" disabled={working}>Create deck</button>
            </form>
          </details>
        </aside>
        <div className="admin-main">
          {!selected ? <section className="empty-state panel-surface"><h2>Create or select a deck.</h2></section> : (
            <>
              <DeckSettings deck={selected} cardCount={cards.length} working={working} act={act} refresh={refreshDecks} />
              <section className="import-panel panel-surface">
                <div className="section-heading-row"><div><p className="eyebrow">Bulk import</p><h2>Upload cards</h2></div><FileSpreadsheet aria-hidden="true" /></div>
                <p className="form-help">Required: Front, Back. Optional: Category, Rank, Source, Notes, Reverse Prompt. <a href={`${import.meta.env.BASE_URL}sample-deck.csv`} download>Download sample CSV</a>.</p>
                <div className="import-actions">
                  <label className="file-button secondary-button">Choose CSV, XLSX, or JSON<input type="file" accept=".csv,.xlsx,.xls,.json,text/csv,application/json" onChange={(event) => void chooseImport(event.target.files?.[0])} /></label>
                  <label className="check-label"><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /><span>Replace existing cards</span></label>
                  <button className="primary-button" type="button" disabled={!preview.length || working} onClick={() => void publishImport()}>Import {preview.length || "previewed"} cards</button>
                </div>
                {preview.length > 0 && <ImportPreview cards={preview} />}
              </section>
              <CardEditor {...{ selected, editing, categories, newCategory, working, setEditing, setNewCategory, storeCard, act, refreshSelected }} />
              <CardTable {...{ selected, cards, working, setEditing, act, refreshSelected }} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function ImportPreview({ cards }: { cards: ImportCard[] }) {
  return (
    <div className="table-wrap">
      <table>
        <caption>Import preview · first 10 of {cards.length}</caption>
        <thead><tr><th>Front</th><th>Back</th><th>Category</th><th>Rank</th><th>Reverse prompt</th></tr></thead>
        <tbody>{cards.slice(0, 10).map((card, index) => (
          <tr key={`${card.front}-${index}`}><td>{card.front}</td><td>{card.back}</td><td>{card.category || "—"}</td><td>{card.rank ?? "—"}</td><td>{card.reversePrompt || "Uses Back"}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function DeckSettings({ deck, cardCount, working, act, refresh }: { deck: CloudDeck; cardCount: number; working: boolean; act(action: () => Promise<void>, success: string): Promise<void>; refresh(): Promise<void> }) {
  return <section className="deck-settings panel-surface"><div className="deck-settings-heading"><div><p className="eyebrow">Deck settings</p><h2>{deck.title}</h2><p>{cardCount} cards · /decks/{deck.slug}</p></div><div className="settings-actions"><label className="check-label"><input type="checkbox" checked={deck.supports_reverse} onChange={(event) => void act(async () => { await updateDeck(deck.id, { supports_reverse: event.target.checked }); await refresh(); }, "Reverse-study setting saved.")} /><span>Reverse</span></label><button className={deck.published ? "warning-button" : "primary-button"} disabled={working} type="button" onClick={() => void act(async () => { await updateDeck(deck.id, { published: !deck.published }); await refresh(); }, deck.published ? "Deck unpublished." : "Deck published.")}>{deck.published ? "Unpublish" : "Publish"}</button></div></div><details className="metadata-editor"><summary>Edit metadata and staged introduction</summary><form className="card-form" key={deck.updated_at} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act(async () => { await updateDeck(deck.id, { title: String(data.get("title")), slug: slugify(String(data.get("slug"))), description: String(data.get("description")), subject: String(data.get("subject")), language: String(data.get("language")) as CloudDeck["language"], staged_config: data.get("staged") === "on" ? { enabled: true, initialCount: Number(data.get("initialCount")) || 100, batchSize: Number(data.get("batchSize")) || 25 } : null }); await refresh(); }, "Deck metadata saved."); }}><label><span>Title</span><input name="title" required defaultValue={deck.title} /></label><label><span>Slug</span><input name="slug" required defaultValue={deck.slug} /></label><label><span>Subject</span><input name="subject" defaultValue={deck.subject} /></label><label><span>Language</span><select name="language" defaultValue={deck.language}><option value="greek">Greek</option><option value="latin">Latin</option><option value="other">Other</option></select></label><label className="wide-field"><span>Description</span><textarea name="description" rows={3} defaultValue={deck.description} /></label><label className="check-label"><input type="checkbox" name="staged" defaultChecked={Boolean(deck.staged_config?.enabled)} /><span>Staged frequency introduction</span></label><label><span>Initial cards</span><input name="initialCount" type="number" min="1" defaultValue={deck.staged_config?.initialCount ?? 100} /></label><label><span>Batch size</span><input name="batchSize" type="number" min="1" defaultValue={deck.staged_config?.batchSize ?? 25} /></label><button className="primary-button form-submit" disabled={working}>Save metadata</button></form></details></section>;
}

type CardEditorProps = {
  selected: CloudDeck;
  editing: CloudCard | null;
  categories: Array<{ id: string; name: string }>;
  newCategory: string;
  working: boolean;
  setEditing(value: CloudCard | null): void;
  setNewCategory(value: string): void;
  storeCard(event: React.FormEvent<HTMLFormElement>): Promise<void>;
  act(action: () => Promise<void>, success: string): Promise<void>;
  refreshSelected(deckId: string): Promise<void>;
};

function CardEditor({ selected, editing, categories, newCategory, working, setEditing, setNewCategory, storeCard, act, refreshSelected }: CardEditorProps) {
  return (
    <section className="card-editor panel-surface">
      <div className="section-heading-row">
        <div><p className="eyebrow">Individual editing</p><h2>{editing ? "Edit card" : "Add a card"}</h2></div>
        {editing && <button className="text-button" type="button" onClick={() => setEditing(null)}>Cancel edit</button>}
      </div>
      <form className="card-form" key={editing?.id ?? "new"} onSubmit={storeCard}>
        <label><span>Front</span><textarea name="front" rows={2} required defaultValue={editing?.front} /></label>
        <label><span>Back</span><textarea name="back" rows={2} required defaultValue={editing?.back} /></label>
        <label><span>Reverse prompt</span><input name="reversePrompt" defaultValue={editing?.reverse_prompt ?? ""} /></label>
        <label><span>Category</span><input name="category" list="category-options" defaultValue={editing?.category ?? ""} /><datalist id="category-options">{categories.map((category) => <option key={category.id}>{category.name}</option>)}</datalist></label>
        <label><span>Rank</span><input name="rank" type="number" defaultValue={editing?.rank ?? ""} /></label>
        <label><span>Source</span><input name="source" defaultValue={editing?.source ?? ""} /></label>
        <label className="wide-field"><span>Notes</span><textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} /></label>
        <button className="primary-button form-submit" disabled={working}>{editing ? "Save card" : "Add card"}</button>
      </form>
      <form className="category-form" onSubmit={(event) => {
        event.preventDefault();
        if (!newCategory.trim()) return;
        void act(async () => { await addCategory(selected.id, newCategory.trim()); setNewCategory(""); await refreshSelected(selected.id); }, "Category added.");
      }}>
        <label><span>New category</span><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /></label>
        <button className="secondary-button" disabled={!newCategory.trim()}>Add category</button>
      </form>
    </section>
  );
}

type CardTableProps = {
  selected: CloudDeck;
  cards: CloudCard[];
  working: boolean;
  setEditing(value: CloudCard): void;
  act(action: () => Promise<void>, success: string): Promise<void>;
  refreshSelected(deckId: string): Promise<void>;
};

function CardTable({ selected, cards, working, setEditing, act, refreshSelected }: CardTableProps) {
  return (
    <section className="cards-table-panel panel-surface">
      <div className="section-heading-row"><div><p className="eyebrow">Deck contents</p><h2>Cards</h2></div><span className="source-count">{cards.length}</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Order</th><th>Front</th><th>Back</th><th>Category</th><th>Actions</th></tr></thead>
          <tbody>{cards.map((card, index) => (
            <tr key={card.id}>
              <td>{card.position}</td><td>{card.front}</td><td>{card.back}</td><td>{card.category || "—"}</td>
              <td><div className="row-actions">
                <button aria-label="Move card up" disabled={index === 0 || working} type="button" onClick={() => void act(async () => { await swapCardPositions(card, cards[index - 1]); await refreshSelected(selected.id); }, "Card moved.")}><ArrowUp /></button>
                <button aria-label="Move card down" disabled={index === cards.length - 1 || working} type="button" onClick={() => void act(async () => { await swapCardPositions(card, cards[index + 1]); await refreshSelected(selected.id); }, "Card moved.")}><ArrowDown /></button>
                <button aria-label="Edit card" type="button" onClick={() => { setEditing(card); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /></button>
                <button className="danger-icon" aria-label="Delete card" type="button" disabled={working} onClick={() => {
                  if (window.confirm(`Delete “${card.front}”?`)) void act(async () => { await deleteCard(card.id); await refreshSelected(selected.id); }, "Card deleted.");
                }}><Trash2 /></button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
