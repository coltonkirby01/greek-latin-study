import { ChevronLeft, ChevronRight, Pause, Play, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../features/auth/auth-context";
import { activeWordAt, sentenceRanges, tokenizeReading, wordAtCharacter } from "../features/reading/reading-model";
import {
  deleteReading,
  listReadings,
  parseTimings,
  saveReading,
  uploadReadingAudio,
  type Reading,
  type ReadingLanguage,
} from "../features/reading/reading-service";

const blankReading = (): Reading => ({
  id: "", title: "", language: "greek", text: "", audioPath: null, audioUrl: null,
  audioProvider: "none", pronunciationSystem: "Not specified", wordTimings: [],
  playbackRate: 1, createdAt: "", updatedAt: "",
});

export function ReadingPage() {
  const { user } = useAuth();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [draft, setDraft] = useState<Reading>(blankReading);
  const [timingText, setTimingText] = useState("");
  const [editing, setEditing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh(preferId?: string) {
    const next = await listReadings(user);
    setReadings(next);
    const selected = next.find((item) => item.id === preferId) ?? next[0];
    if (selected) { setDraft(selected); setTimingText(JSON.stringify(selected.wordTimings, null, 2)); setEditing(false); }
  }

  useEffect(() => { void refresh().catch((reason) => setError(reason.message)); }, [user?.id]);

  async function store(event: React.FormEvent) {
    event.preventDefault(); setWorking(true); setError(null);
    try {
      const wordCount = tokenizeReading(draft.text).filter((token) => token.wordIndex !== null).length;
      const saved = await saveReading({ ...draft, wordTimings: parseTimings(timingText, wordCount) }, user);
      setMessage(user ? "Passage saved to your account." : "Passage saved on this device.");
      await refresh(saved.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  }

  async function attachAudio(file: File | undefined) {
    if (!file) return;
    if (!user) { setError("Sign in to upload durable audio files."); return; }
    setWorking(true); setError(null);
    try {
      const uploaded = await uploadReadingAudio(file, user);
      setDraft((current) => ({ ...current, audioPath: uploaded.path, audioUrl: uploaded.url, audioProvider: "manual-upload" }));
      setMessage("Audio attached. Save the passage to keep the reference.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  }

  function selectReading(reading: Reading) {
    window.speechSynthesis?.cancel(); setDraft(reading); setTimingText(JSON.stringify(reading.wordTimings, null, 2)); setEditing(false);
  }

  return (
    <main className="page-shell reading-page">
      <div className="study-page-heading"><div><p className="eyebrow">Reading &amp; Audio</p><h1>Follow every word.</h1></div><p>Passages, recorded audio, browser TTS, and real timing metadata</p></div>
      {message && <button type="button" className="success-alert dismissible" onClick={() => setMessage(null)}>{message}</button>}
      {error && <div className="inline-alert">{error}</div>}
      <div className="reading-layout">
        <aside className="reading-library panel-surface">
          <div className="section-heading-row"><h2>Saved readings</h2><button className="icon-button" aria-label="New passage" type="button" onClick={() => { setDraft(blankReading()); setTimingText(""); setEditing(true); }}><Plus /></button></div>
          <div className="reading-list">{readings.map((reading) => <button type="button" aria-pressed={reading.id === draft.id} key={reading.id} onClick={() => selectReading(reading)}><strong>{reading.title}</strong><span>{reading.language} · {reading.audioProvider === "none" ? "text only" : reading.audioProvider}</span></button>)}</div>
          {!readings.length && <p className="form-help">No passages saved yet.</p>}
        </aside>
        <section className="reading-workspace panel-surface">
          {editing || !draft.id ? (
            <ReadingEditor {...{ draft, timingText, user, working, setDraft, setTimingText, setEditing, store, attachAudio }} />
          ) : (
            <ReadingPlayer reading={draft} onEdit={() => setEditing(true)} onDelete={() => {
              if (window.confirm(`Delete “${draft.title}”?`)) void deleteReading(draft, user).then(() => { setDraft(blankReading()); setMessage("Passage deleted."); return refresh(); }).catch((reason) => setError(reason.message));
            }} onRate={(playbackRate) => { setDraft((current) => ({ ...current, playbackRate })); void saveReading({ ...draft, playbackRate }, user); }} />
          )}
        </section>
      </div>
    </main>
  );
}

type EditorProps = {
  draft: Reading;
  timingText: string;
  user: ReturnType<typeof useAuth>["user"];
  working: boolean;
  setDraft: React.Dispatch<React.SetStateAction<Reading>>;
  setTimingText(value: string): void;
  setEditing(value: boolean): void;
  store(event: React.FormEvent): Promise<void>;
  attachAudio(file: File | undefined): Promise<void>;
};

function ReadingEditor({ draft, timingText, user, working, setDraft, setTimingText, setEditing, store, attachAudio }: EditorProps) {
  return (
    <form className="reading-editor" onSubmit={store}>
      <div className="section-heading-row"><div><p className="eyebrow">Passage editor</p><h2>{draft.id ? "Edit passage" : "New passage"}</h2></div>{draft.id && <button className="text-button" type="button" onClick={() => setEditing(false)}>Cancel</button>}</div>
      <div className="editor-heading-fields">
        <label><span>Title</span><input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
        <label><span>Language</span><select value={draft.language} onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value as ReadingLanguage }))}><option value="greek">Greek</option><option value="latin">Latin</option></select></label>
      </div>
      <label><span>Greek or Latin text</span><textarea className="passage-input" required rows={12} value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /></label>
      <div className="editor-heading-fields">
        <label><span>Audio provider</span><select value={draft.audioProvider} onChange={(event) => setDraft((current) => ({ ...current, audioProvider: event.target.value }))}><option value="none">Browser TTS / no file</option><option value="manual-upload">Manually uploaded</option><option value="teacher-recorded">Teacher recorded</option><option value="external-tts">External TTS</option></select></label>
        <label><span>Pronunciation system</span><input value={draft.pronunciationSystem} onChange={(event) => setDraft((current) => ({ ...current, pronunciationSystem: event.target.value }))} placeholder="e.g. Erasmian, Koine, Modern Greek" /></label>
      </div>
      <div className="audio-upload-row">
        <label className="file-button secondary-button"><Upload aria-hidden="true" /> Attach audio<input type="file" accept="audio/*" disabled={!user || working} onChange={(event) => void attachAudio(event.target.files?.[0])} /></label>
        <span>{draft.audioPath ? "Audio attached" : user ? "MP3, M4A, WAV, or browser-supported audio" : "Sign in to upload durable audio"}</span>
      </div>
      <details className="timing-editor">
        <summary>Word timing metadata</summary>
        <p className="form-help">Optional JSON array: <code>{`[{"index":0,"startMs":0,"endMs":420}]`}</code>. Highlighting follows these timestamps; no guessed interval is used.</p>
        <textarea rows={7} value={timingText} onChange={(event) => setTimingText(event.target.value)} spellCheck={false} />
      </details>
      <button className="primary-button form-submit" disabled={working}><Save aria-hidden="true" /> {working ? "Saving…" : "Save Passage"}</button>
    </form>
  );
}

function ReadingPlayer({ reading, onEdit, onDelete, onRate }: { reading: Reading; onEdit(): void; onDelete(): void; onRate(rate: number): void }) {
  const tokens = useMemo(() => tokenizeReading(reading.text), [reading.text]);
  const sentences = useMemo(() => sentenceRanges(reading.text, tokens), [reading.text, tokens]);
  const [activeWord, setActiveWord] = useState<number | null>(null);
  const [activeSentence, setActiveSentence] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(reading.playbackRate || 1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeRef = useRef<HTMLElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis?.getVoices() ?? [];
      const language = reading.language === "greek" ? /^el/i : /^la/i;
      const matching = all.filter((voice) => language.test(voice.lang));
      setVoices(matching.length ? matching : all);
      setVoiceUri((current) => current || matching[0]?.voiceURI || all[0]?.voiceURI || "");
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => { window.speechSynthesis?.removeEventListener("voiceschanged", load); window.speechSynthesis?.cancel(); };
  }, [reading.id, reading.language]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (activeWord !== null) {
      const sentence = sentences.findIndex((item) => activeWord >= item.firstWord && activeWord <= item.lastWord);
      if (sentence >= 0) setActiveSentence(sentence);
    }
  }, [activeWord, sentences]);

  function speak(sentenceIndex: number | null = null) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const sentence = sentenceIndex === null ? null : sentences[sentenceIndex];
    const content = sentence ? sentence.text : reading.text;
    const offset = sentence?.start ?? 0;
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = rate;
    utterance.lang = reading.language === "greek" ? "el-GR" : "la";
    utterance.voice = voices.find((voice) => voice.voiceURI === voiceUri) ?? null;
    utterance.onboundary = (event) => {
      if (event.name && event.name !== "word") return;
      const index = wordAtCharacter(tokens, offset + event.charIndex);
      if (index !== null) setActiveWord(index);
    };
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }

  async function play() {
    if (reading.audioUrl && audioRef.current) { audioRef.current.playbackRate = rate; await audioRef.current.play(); setPlaying(true); }
    else if (window.speechSynthesis?.paused) { window.speechSynthesis.resume(); setPlaying(true); }
    else speak();
  }

  function pause() {
    if (reading.audioUrl && audioRef.current) audioRef.current.pause();
    else window.speechSynthesis?.pause();
    setPlaying(false);
  }

  function restart() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    window.speechSynthesis?.cancel(); setActiveWord(null); setActiveSentence(0); setPlaying(false);
  }

  function moveSentence(delta: number) {
    const next = Math.max(0, Math.min(sentences.length - 1, activeSentence + delta));
    setActiveSentence(next);
    setActiveWord(sentences[next]?.firstWord ?? null);
    if (reading.audioUrl && audioRef.current) {
      const timing = reading.wordTimings.find((item) => item.index === sentences[next]?.firstWord);
      if (timing) audioRef.current.currentTime = timing.startMs / 1_000;
    } else if (playing) { window.speechSynthesis?.cancel(); setTimeout(() => speak(next), 0); }
  }

  const selectedVoice = voices.find((voice) => voice.voiceURI === voiceUri);
  const pronunciationNote = reading.audioUrl
    ? `${reading.audioProvider} · ${reading.pronunciationSystem || "pronunciation not specified"}`
    : selectedVoice
      ? `Browser TTS · ${selectedVoice.name} (${selectedVoice.lang}). Device pronunciation; Greek voices are ordinarily Modern Greek unless explicitly labeled otherwise.`
      : "Browser TTS voice availability depends on this device. No Classical Greek pronunciation is implied.";

  return (
    <div className="reading-player">
      <div className="section-heading-row"><div><p className="eyebrow">{reading.language} reading</p><h2>{reading.title}</h2></div><div className="reading-edit-actions"><button className="text-button" type="button" onClick={onEdit}>Edit</button><button className="danger-text-button" type="button" onClick={onDelete}><Trash2 /> Delete</button></div></div>
      {reading.audioUrl && <audio ref={audioRef} src={reading.audioUrl} onTimeUpdate={(event) => setActiveWord(activeWordAt(reading.wordTimings, event.currentTarget.currentTime * 1_000))} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
      <div className={`reading-text ${reading.language === "greek" ? "greek-script" : ""}`} aria-live="polite">
        {tokens.map((token, index) => token.wordIndex === null ? token.value : (
          <mark key={`${index}-${token.start}`} ref={token.wordIndex === activeWord ? activeRef : null} className={token.wordIndex === activeWord ? "active-word" : ""}>{token.value}</mark>
        ))}
      </div>
      <div className="audio-controls" aria-label="Audio controls">
        <button className="icon-text-button" type="button" onClick={playing ? pause : () => void play()}>{playing ? <Pause /> : <Play />}{playing ? "Pause" : "Play"}</button>
        <button className="icon-text-button" type="button" onClick={restart}><RotateCcw /> Restart</button>
        <label><span>Speed</span><select value={rate} onChange={(event) => { const next = Number(event.target.value); setRate(next); if (audioRef.current) audioRef.current.playbackRate = next; onRate(next); }}><option value="0.65">0.65×</option><option value="0.8">0.8×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label>
        {!reading.audioUrl && voices.length > 0 && <label><span>Voice</span><select value={voiceUri} onChange={(event) => setVoiceUri(event.target.value)}>{voices.map((voice) => <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></label>}
      </div>
      <div className="sentence-controls"><button type="button" disabled={activeSentence === 0} onClick={() => moveSentence(-1)}><ChevronLeft /> Previous Sentence</button><span>{sentences.length ? `${activeSentence + 1} / ${sentences.length}` : "—"}</span><button type="button" disabled={activeSentence >= sentences.length - 1} onClick={() => moveSentence(1)}>Next Sentence <ChevronRight /></button></div>
      <p className="pronunciation-note">{pronunciationNote}</p>
      {reading.audioUrl && !reading.wordTimings.length && <p className="setup-note">This audio has no word timestamps yet, so the player deliberately does not guess highlighting intervals.</p>}
    </div>
  );
}
