import { useState, useEffect, useRef } from "react";

// ─── INDEXEDDB STORAGE (not localStorage — raw AI responses across many
// cases/runs can exceed localStorage's ~5-10MB shared quota; IndexedDB has
// a much larger practical ceiling and is the correct frontend-only choice
// for this data volume) ──────────────────────────────────────────────────
const DB_NAME = "ynm-qa-runner";
const DB_VERSION = 1;
const STORE = "runs";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "runId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSaveRun(run) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(run);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbLoadAllRuns() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.startedAt - a.startedAt));
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteRun(runId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(runId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ─── SHARED PARSER (duplicated here intentionally — this module is lazy-
// loaded independently and should not import from the main App bundle,
// which would defeat the point of splitting it out) ────────────────────
function parseAISections(text, sectionDefs) {
  const result = {};
  sectionDefs.forEach(d => { result[d.key] = ""; });
  if (!text || typeof text !== "string" || !text.trim()) {
    return { sections: result, raw: text || "", failedSections: sectionDefs.map(d => d.key), fullyFailed: true };
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const allAliases = sectionDefs.flatMap(d => d.aliases.map(a => ({ key: d.key, alias: a })));
  const altPattern = allAliases.map(a => esc(a.alias)).join('|');
  const headerRegex = new RegExp(`(?:^|\\n)\\s*(?:\\d+[.)]\\s*)?(?:\\*\\*|__)?\\s*(${altPattern})\\s*:?\\s*(?:\\*\\*|__)?\\s*:?\\s*(?=\\n|$|—|-)`, 'gi');
  const matches = [...text.matchAll(headerRegex)];
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const def = allAliases.find(a => a.alias.toLowerCase() === m[1].toLowerCase());
      if (!def) continue;
      const startIdx = m.index + m[0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const content = text.slice(startIdx, endIdx).replace(/^[\s:—-]+/, '').trim();
      if (content.length > 2 && !result[def.key]) result[def.key] = content;
    }
  }
  sectionDefs.forEach(d => {
    if (result[d.key]) return;
    for (const alias of d.aliases) {
      const re = new RegExp(`(?:\\*\\*|__)?${esc(alias)}(?:\\*\\*|__)?\\s*:?\\s*\\n?([\\s\\S]{5,600}?)(?=\\n\\s*(?:\\d+[.)]\\s*)?(?:\\*\\*|__)?[A-Z][a-zA-Z' ]{2,40}(?:\\*\\*|__)?\\s*:?\\s*(?:\\n|$)|$)`, 'i');
      const m = text.match(re);
      if (m && m[1] && m[1].trim().length > 4) { result[d.key] = m[1].trim(); break; }
    }
  });
  const anyParsed = sectionDefs.some(d => result[d.key]);
  let failedSections = sectionDefs.filter(d => !result[d.key]).map(d => d.key);
  if (!anyParsed) {
    result[sectionDefs[0].key] = text.replace(/\*\*/g, '').trim();
    failedSections = ['TOTAL_FALLBACK_USED'];
  }
  sectionDefs.forEach(d => {
    if (!result[d.key]) return;
    let content = result[d.key];
    allAliases.forEach(a => {
      if (a.key === d.key) return;
      const idx = content.search(new RegExp(`(?:\\*\\*|__)?\\s*${esc(a.alias)}\\s*:?\\s*(?:\\*\\*|__)?`, 'i'));
      if (idx > -1) content = content.slice(0, idx).trim();
    });
    result[d.key] = content;
  });
  return { sections: result, raw: text, failedSections, fullyFailed: false };
}

const DEV_QA_PERSONAS = [
  { id: "vague-1", feature: "strategy", label: "Vague: 'I need help.'", industry: "Not specified", stage: "Not specified", qa: "Q: What are you trying to accomplish?\nA: I need help.\n\nQ: What's your biggest obstacle?\nA: I don't know." },
  { id: "simple-1", feature: "strategy", label: "Simple: solo consultant, referrals dried up", industry: "Consulting", stage: "Established", qa: "Q: What are you trying to accomplish?\nA: Get new clients, referrals dried up.\n\nQ: What's your biggest obstacle?\nA: No visible pipeline, all past work was word of mouth." },
  { id: "complex-1", feature: "strategy", label: "Complex: 3-business owner, conflicting priorities", industry: "Multi-industry (retail, real estate, consulting)", stage: "Scaling", qa: "Q: What are you trying to accomplish?\nA: I run three businesses and I'm stretched too thin with no clear priority.\n\nQ: What's your biggest obstacle?\nA: I don't know which one deserves my limited time and capital right now." },
  { id: "knowledgeable-1", feature: "strategy", label: "Knowledgeable: MBA-holding VP evaluating a spinout", industry: "SaaS / Enterprise Software", stage: "Established", qa: "Q: What are you trying to accomplish?\nA: I'm evaluating whether to spin our internal analytics tool into a standalone B2B SaaS product.\n\nQ: What's your biggest obstacle?\nA: Internal stakeholder alignment on resourcing." },
  { id: "advisor-vague-1", feature: "advisor", label: "Advisor vague: 'I hate my job.'", question: "I hate my job." },
  { id: "advisor-challenge-1", feature: "advisor", label: "Advisor: 'Challenge my thinking'", question: "I've decided to quit my job with no backup plan to 'force myself' to succeed at my side business. Challenge my thinking on this." },
  { id: "hub-fact-1", feature: "hub", label: "Hub simple fact", query: "What is 2 + 2?" },
  { id: "hub-howto-1", feature: "hub", label: "Hub how-to / depth test", query: "Teach me how commercial real estate lending works." },
];

function flagResponseIssues(text, parsedSections, elapsedMs) {
  const flags = [];
  if (!text || !text.trim()) flags.push({ severity: "critical", issue: "Empty response from API" });
  if (text && text.length < 80) flags.push({ severity: "high", issue: "Suspiciously short response (" + text.length + " chars)" });
  const filledCount = Object.values(parsedSections || {}).filter(v => v && v.trim()).length;
  const totalCount = Object.keys(parsedSections || {}).length;
  if (totalCount > 0 && filledCount === 0) flags.push({ severity: "critical", issue: "Parsed to zero populated sections" });
  else if (totalCount > 0 && filledCount < totalCount) flags.push({ severity: "medium", issue: (totalCount - filledCount) + " of " + totalCount + " sections empty after parsing" });
  if (elapsedMs > 60000) flags.push({ severity: "high", issue: "Response took over 60s" });
  const genericPhrases = ["it's important to", "in today's world", "there are many factors", "it depends on your situation", "consider consulting", "as an ai"];
  const lower = (text || "").toLowerCase();
  const foundGeneric = genericPhrases.filter(p => lower.includes(p));
  if (foundGeneric.length) flags.push({ severity: "medium", issue: "Generic-phrasing markers: " + foundGeneric.join(", ") });
  const absoluteClaims = ["always guaranteed", "will definitely", "100% certain", "never fails", "risk-free"];
  if (absoluteClaims.some(p => lower.includes(p))) flags.push({ severity: "medium", issue: "Possible unsupported absolute claim — needs human check" });
  const highStakes = ["diagnos", "prescri", "lawsuit", "file for", "tax liability", "invest all"];
  const hedges = ["may", "might", "consult", "professional", "verify", "depends", "uncertain", "not certain"];
  if (highStakes.some(t => lower.includes(t)) && !hedges.some(h => lower.includes(h))) {
    flags.push({ severity: "high", issue: "High-stakes topic with no visible caution language — needs human check" });
  }
  return flags;
}

const BLANK_HUMAN_REVIEW = {
  humanPassFail: null, relevance: null, specificity: null, personalization: null,
  strategicDepth: null, factualIntegrity: null, clarity: null, actionability: null,
  wouldPayForIt: null, notes: "", confirmedFactualError: false, genericResponseFlag: false,
  unsafeResponseFlag: false, needsPromptRevision: false, needsCodeRevision: false,
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function QARunner() {
  const [authed, setAuthed] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [secretInput, setSecretInput] = useState("");
  const [authChecking, setAuthChecking] = useState(false);
  const [authError, setAuthError] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [runs, setRuns] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delayMs, setDelayMs] = useState(1500);
  const [startLock, setStartLock] = useState(false);
  const [compareIds, setCompareIds] = useState([null, null]);
  const stopRef = useRef(false);
  const secretRef = useRef(""); // master secret held only transiently, cleared right after login

  useEffect(() => { loadRuns(); }, []);

  // Auto-expire the session client-side too (the server also enforces this independently)
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const t = setInterval(() => {
      if (Date.now() > sessionExpiresAt) { logout(); }
    }, 5000);
    return () => clearInterval(t);
  }, [sessionExpiresAt]);

  async function loadRuns() {
    try { setRuns(await idbLoadAllRuns()); } catch (e) { setRuns([]); }
  }

  async function checkAuth() {
    if (!secretInput.trim()) { setAuthError("Enter the access key."); return; }
    setAuthChecking(true); setAuthError("");
    try {
      const res = await fetch("/api/qa-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-qa-secret": secretInput },
        body: JSON.stringify({ authCheck: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.session) {
        setSessionToken(data.session);
        setSessionExpiresAt(data.expiresAt);
        setAuthed(true);
        secretRef.current = ""; // discard the master secret from memory immediately after login
        setSecretInput("");
      } else if (res.status === 429) {
        setAuthError("Too many failed attempts. Locked out temporarily — try again later.");
      } else if (res.status === 401) {
        setAuthError("Incorrect access key.");
      } else if (res.status === 503) {
        setAuthError("QA runner is disabled or not configured on the server.");
      } else {
        setAuthError("Unexpected error (" + res.status + "). Is /api/qa-generate deployed?");
      }
    } catch (e) {
      setAuthError("Couldn't reach the server — is this running on a deployed environment?");
    } finally { setAuthChecking(false); }
  }

  function logout() {
    setAuthed(false); setSessionToken(null); setSessionExpiresAt(null);
    setResults([]); stopRef.current = false; setRunning(false); setStartLock(false);
  }

  function stopRun() { stopRef.current = true; }

  async function qaFetchWithRetry(prompt, runRequestCount, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (stopRef.current) throw new Error("STOPPED_BY_USER");
      try {
        const res = await fetch("/api/qa-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-qa-session": sessionToken },
          body: JSON.stringify({ prompt, runRequestCount }),
        });
        if (res.status === 401) throw new Error("SESSION_EXPIRED");
        if (res.status === 429 || res.status >= 500) {
          if (attempt === maxRetries) throw new Error("API " + res.status + " after " + maxRetries + " retries");
          await sleep(Math.min(1000 * Math.pow(2, attempt), 15000));
          continue;
        }
        if (!res.ok) throw new Error("API " + res.status);
        const data = await res.json();
        return { text: data.text || "", retries: attempt, model: data.model, usage: data.usage };
      } catch (e) {
        if (e.message === "SESSION_EXPIRED") { logout(); throw e; }
        if (e.message === "STOPPED_BY_USER") throw e;
        if (attempt === maxRetries) throw e;
        await sleep(Math.min(1000 * Math.pow(2, attempt), 15000));
      }
    }
  }

  async function runSuite(rerunFailedOnly = false) {
    if (!authed || running || startLock) return;
    setStartLock(true); stopRef.current = false;
    const personas = rerunFailedOnly
      ? DEV_QA_PERSONAS.filter(p => results.find(r => r.personaId === p.id && r.status !== "pass"))
      : DEV_QA_PERSONAS;
    const runId = "qa_" + Date.now();
    setRunning(true);
    if (!rerunFailedOnly) setResults([]);
    const acc = rerunFailedOnly ? [...results] : [];
    const startedAt = Date.now();
    let requestCount = 0;

    for (const persona of personas) {
      if (stopRef.current) break;
      requestCount++;
      const start = Date.now();
      let prompt = "";
      if (persona.feature === "strategy") {
        prompt = `You are a senior strategist delivering a concise, premium strategy report. Client Profile:\nIndustry: ${persona.industry}\nStage: ${persona.stage}\n\nWhat they shared:\n${persona.qa}\n\nWrite the 8 standard sections: Strategic Assessment, Primary Challenge, Strategic Opportunity, Recommended Actions, 30-Day Priority Plan, Looking Ahead, What Success Looks Like, Your Next Move — using # headers verbatim as section titles.`;
      } else if (persona.feature === "advisor") {
        prompt = `You are a trusted personal advisor. Their question or situation: ${persona.question}\n\nRespond with exactly these four sections: **What I'm hearing**, **Here's what I think**, **What this means for you**, **Your single next move**.`;
      } else {
        prompt = `You are a universal knowledge engine. Request: ${persona.query}\n\nRespond with **Direct Answer** and any of **Why It Matters**, **Practical Example**, **Common Mistakes**, **Related Concepts**, **Next Steps** that genuinely add value. For a trivial factual question, Direct Answer alone is a complete response.`;
      }
      let raw = "", error = null, sections = null, retries = 0, apiStatus = "unknown", model = null, usage = null;
      try {
        const out = await qaFetchWithRetry(prompt, requestCount, 3);
        raw = out.text; retries = out.retries; apiStatus = "ok"; model = out.model; usage = out.usage;
        const defsByFeature = {
          advisor: [
            { key: "hearing", aliases: ["What I'm hearing", "What I am hearing"] },
            { key: "think", aliases: ["Here's what I think", "Here is what I think"] },
            { key: "means", aliases: ["What this means for you", "What this means"] },
            { key: "move", aliases: ["Your single next move", "Next move"] },
          ],
          hub: [
            { key: "direct", aliases: ["Direct Answer"] }, { key: "why", aliases: ["Why It Matters"] },
            { key: "example", aliases: ["Practical Example"] }, { key: "mistakes", aliases: ["Common Mistakes"] },
            { key: "related", aliases: ["Related Concepts"] }, { key: "steps", aliases: ["Next Steps"] },
          ],
          strategy: [
            { key: "strategicAssessment", aliases: ["Strategic Assessment"] },
            { key: "primaryConstraint", aliases: ["Primary Challenge"] },
            { key: "strategicOpportunity", aliases: ["Strategic Opportunity"] },
            { key: "recommendedActions", aliases: ["Recommended Actions"] },
            { key: "priorityPlan", aliases: ["30-Day Priority Plan", "Priority Plan"] },
            { key: "longTermGrowth", aliases: ["Looking Ahead"] },
            { key: "successLooks", aliases: ["What Success Looks Like"] },
            { key: "yourNextMove", aliases: ["Your Next Move"] },
          ],
        };
        sections = parseAISections(raw, defsByFeature[persona.feature]).sections;
      } catch (e) {
        error = e.message;
        apiStatus = e.message === "STOPPED_BY_USER" ? "stopped" : (e.message === "SESSION_EXPIRED" ? "session_expired" : "error");
      }
      const elapsedMs = Date.now() - start;
      const flags = error && apiStatus !== "stopped" ? [{ severity: "critical", issue: "Request failed: " + error }] : (apiStatus === "stopped" ? [] : flagResponseIssues(raw, sections, elapsedMs));
      const hasCritical = flags.some(f => f.severity === "critical");
      const record = {
        personaId: persona.id, persona: persona.label, feature: persona.feature,
        exactInput: persona.qa || persona.question || persona.query,
        elapsedMs, raw, sections, flags, retries, apiStatus, model, usage,
        status: apiStatus === "stopped" ? "stopped" : (hasCritical ? "fail" : "pass"),
        timestamp: new Date().toISOString(),
        humanReview: { ...BLANK_HUMAN_REVIEW },
      };
      const idx = acc.findIndex(r => r.personaId === persona.id);
      if (idx > -1) acc[idx] = record; else acc.push(record);
      setResults([...acc]);
      if (apiStatus === "session_expired" || apiStatus === "stopped") break;
      if (personas.indexOf(persona) < personas.length - 1) await sleep(delayMs);
    }

    const run = { runId, startedAt, finishedAt: Date.now(), results: acc, stoppedEarly: stopRef.current };
    await idbSaveRun(run);
    await loadRuns();
    setRunning(false); setStartLock(false);
  }

  function updateHumanReview(personaId, field, value) {
    setResults(prev => prev.map(r => r.personaId === personaId ? { ...r, humanReview: { ...r.humanReview, [field]: value } } : r));
  }

  async function persistCurrentReview() {
    if (!results.length) return;
    const existing = runs.find(r => r.results.some(res => results.some(cur => cur.personaId === res.personaId)));
    // Save review edits back into whichever run these results belong to (most recent match)
    const target = runs[0];
    if (!target) return;
    const updated = { ...target, results: target.results.map(r => {
      const cur = results.find(x => x.personaId === r.personaId);
      return cur ? { ...r, humanReview: cur.humanReview } : r;
    })};
    await idbSaveRun(updated);
    await loadRuns();
  }

  function exportJSON(run) {
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "qa-run-" + run.runId + ".json"; a.click();
  }

  function exportCSV(run) {
    const headers = ["personaId", "persona", "feature", "status", "elapsedMs", "retries", "apiStatus", "model", "flagCount", "criticalFlags", "humanPassFail", "wouldPayForIt", "exactInput"];
    const rows = run.results.map(r => [
      r.personaId, r.persona, r.feature, r.status, r.elapsedMs, r.retries, r.apiStatus, r.model || "",
      r.flags.length, r.flags.filter(f => f.severity === "critical").map(f => f.issue).join(" | "),
      r.humanReview?.humanPassFail ?? "", r.humanReview?.wouldPayForIt ?? "",
      (r.exactInput || "").replace(/"/g, '""').replace(/\n/g, " "),
    ]);
    const csv = [headers.join(","), ...rows.map(row => row.map(v => `"${String(v)}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "qa-run-" + run.runId + ".csv"; a.click();
  }

  async function deleteRun(runId) { await idbDeleteRun(runId); await loadRuns(); }

  function renderScoreInput(personaId, field, label) {
    const r = results.find(x => x.personaId === personaId);
    const val = r?.humanReview?.[field];
    return (
      <label style={{ fontSize: 10, display: "block", marginBottom: 4 }}>
        {label}:
        <select value={val ?? ""} onChange={e => updateHumanReview(personaId, field, e.target.value ? +e.target.value : null)} style={{ marginLeft: 6, fontSize: 10 }}>
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    );
  }

  // ── Comparison view ──
  function renderComparison() {
    const [idA, idB] = compareIds;
    const runA = runs.find(r => r.runId === idA);
    const runB = runs.find(r => r.runId === idB);
    if (!runA || !runB) return <div style={{ fontSize: 11, color: "#78716C" }}>Select two runs above to compare.</div>;
    const allPersonaIds = [...new Set([...runA.results.map(r => r.personaId), ...runB.results.map(r => r.personaId)])];
    return (
      <div style={{ marginTop: 16 }}>
        {allPersonaIds.map(pid => {
          const a = runA.results.find(r => r.personaId === pid);
          const b = runB.results.find(r => r.personaId === pid);
          const statusChange = a && b ? (a.status === b.status ? "unchanged" : (b.status === "pass" ? "improved" : "regressed")) : "n/a";
          return (
            <div key={pid} style={{ border: "1px solid #E5E5E5", borderRadius: 6, padding: 12, marginBottom: 10, fontSize: 11 }}>
              <div style={{ fontWeight: 600 }}>{pid} — <span style={{ color: statusChange === "improved" ? "#6A9E8A" : statusChange === "regressed" ? "#B0728A" : "#78716C" }}>{statusChange.toUpperCase()}</span></div>
              <div>Status: {a?.status || "missing"} → {b?.status || "missing"}</div>
              <div>Response time: {a?.elapsedMs ?? "—"}ms → {b?.elapsedMs ?? "—"}ms</div>
              <div>Flags: {a?.flags.length ?? "—"} → {b?.flags.length ?? "—"}</div>
              <details><summary style={{ cursor: "pointer" }}>Previous response</summary><pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{a?.raw || "(none)"}</pre></details>
              <details><summary style={{ cursor: "pointer" }}>New response</summary><pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{b?.raw || "(none)"}</pre></details>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Dev QA Runner</h1>
      <p style={{ fontSize: 12, color: "#78716C", marginBottom: 20 }}>
        Internal tool. Loaded only via dynamic import — not part of the main app bundle. Authorization and every generation request are verified server-side.
      </p>

      {!authed && (
        <div style={{ border: "1px solid #E5E5E5", borderRadius: 8, padding: 20, maxWidth: 420 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Access Key Required</div>
          <input type="password" value={secretInput} onChange={e => setSecretInput(e.target.value)}
            placeholder="QA access key" style={{ width: "100%", padding: 10, fontSize: 13, border: "1px solid #DDD8D3", borderRadius: 6, marginBottom: 10, fontFamily: "monospace" }}
            onKeyDown={e => { if (e.key === "Enter") checkAuth(); }} />
          <button onClick={checkAuth} disabled={authChecking} style={{ width: "100%", padding: 10, background: "#1A1916", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            {authChecking ? "Checking…" : "Unlock"}
          </button>
          {authError && <div style={{ fontSize: 12, color: "#B0728A", marginTop: 10 }}>{authError}</div>}
        </div>
      )}

      {authed && (<>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => setConfirmOpen(true)} disabled={running || startLock} style={{ padding: "10px 20px", background: "#1A1916", color: "#fff", border: "none", borderRadius: 100, cursor: "pointer" }}>
            {running ? `Running… (${results.length}/${DEV_QA_PERSONAS.length})` : "Run QA Suite"}
          </button>
          {running && <button onClick={stopRun} style={{ padding: "10px 20px", border: "1px solid #DDD8D3", borderRadius: 100, cursor: "pointer", background: "transparent" }}>Stop</button>}
          {!running && results.some(r => r.status !== "pass") && (
            <button onClick={() => runSuite(true)} style={{ padding: "10px 20px", border: "1px solid #DDD8D3", borderRadius: 100, cursor: "pointer", background: "transparent" }}>Rerun Failed Only</button>
          )}
          <button onClick={logout} style={{ padding: "10px 20px", border: "1px solid #B0728A", color: "#B0728A", borderRadius: 100, cursor: "pointer", background: "transparent" }}>Logout / Lock</button>
          <label style={{ fontSize: 11, color: "#78716C" }}>Delay (ms):
            <input type="number" value={delayMs} onChange={e => setDelayMs(Math.max(0, +e.target.value || 0))} disabled={running} style={{ width: 70, marginLeft: 6, fontFamily: "monospace", fontSize: 11 }} />
          </label>
          {sessionExpiresAt && <span style={{ fontSize: 10, color: "#78716C" }}>Session expires {new Date(sessionExpiresAt).toLocaleTimeString()}</span>}
        </div>

        {confirmOpen && (
          <div style={{ border: "1px solid #B0728A", borderRadius: 8, padding: 16, marginBottom: 20, background: "#FDF4F7" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Confirm test run</div>
            <div style={{ fontSize: 12 }}>• Up to {DEV_QA_PERSONAS.length} real API requests (plus retries).</div>
            <div style={{ fontSize: 12 }}>• Estimated duration: ~{Math.round(DEV_QA_PERSONAS.length * ((delayMs + 8000) / 1000))}–{Math.round(DEV_QA_PERSONAS.length * ((delayMs + 15000) / 1000))}s.</div>
            <div style={{ fontSize: 12, marginBottom: 10 }}>• Uses real API credits. Verify cost against your Anthropic dashboard.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setConfirmOpen(false); runSuite(false); }} style={{ padding: "8px 16px", background: "#1A1916", color: "#fff", border: "none", borderRadius: 100, cursor: "pointer" }}>Start</button>
              <button onClick={() => setConfirmOpen(false)} style={{ padding: "8px 16px", border: "1px solid #DDD8D3", borderRadius: 100, cursor: "pointer", background: "transparent" }}>Cancel</button>
            </div>
          </div>
        )}

        {results.map((r, i) => (
          <div key={i} style={{ border: "1px solid " + (r.status === "fail" ? "#B0728A" : r.status === "stopped" ? "#C08552" : "#E5E5E5"), borderRadius: 6, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {r.persona} <span style={{ color: "#78716C", fontWeight: 400 }}>({r.feature}, {r.elapsedMs}ms{r.retries > 0 ? ", " + r.retries + " retries" : ""}{r.model ? ", " + r.model : ""})</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: r.status === "pass" ? "#6A9E8A" : r.status === "fail" ? "#B0728A" : "#C08552" }}>[{r.status.toUpperCase()}]</span>
            </div>
            <div style={{ fontSize: 11, color: "#78716C", marginTop: 4 }}>Input: {r.exactInput}</div>
            {r.flags.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600 }}>AUTOMATED CHECKS (heuristic — not proof of quality):</div>
                {r.flags.map((f, j) => <div key={j} style={{ fontSize: 11, color: f.severity === "critical" ? "#B0728A" : f.severity === "high" ? "#C08552" : "#78716C" }}>[{f.severity.toUpperCase()}] {f.issue}</div>)}
              </div>
            )}
            <div style={{ fontSize: 10, fontWeight: 600, marginTop: 10 }}>HUMAN REVIEW:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
              {renderScoreInput(r.personaId, "relevance", "Relevance")}
              {renderScoreInput(r.personaId, "specificity", "Specificity")}
              {renderScoreInput(r.personaId, "personalization", "Personalization")}
              {renderScoreInput(r.personaId, "strategicDepth", "Strategic depth")}
              {renderScoreInput(r.personaId, "factualIntegrity", "Factual integrity")}
              {renderScoreInput(r.personaId, "clarity", "Clarity")}
              {renderScoreInput(r.personaId, "actionability", "Actionability")}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap", fontSize: 10 }}>
              <label>Human pass/fail: <select value={r.humanReview.humanPassFail ?? ""} onChange={e => updateHumanReview(r.personaId, "humanPassFail", e.target.value)}><option value="">—</option><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
              <label>Would pay for it: <select value={r.humanReview.wouldPayForIt ?? ""} onChange={e => updateHumanReview(r.personaId, "wouldPayForIt", e.target.value)}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label><input type="checkbox" checked={r.humanReview.confirmedFactualError} onChange={e => updateHumanReview(r.personaId, "confirmedFactualError", e.target.checked)} /> Confirmed factual error</label>
              <label><input type="checkbox" checked={r.humanReview.genericResponseFlag} onChange={e => updateHumanReview(r.personaId, "genericResponseFlag", e.target.checked)} /> Generic response</label>
              <label><input type="checkbox" checked={r.humanReview.unsafeResponseFlag} onChange={e => updateHumanReview(r.personaId, "unsafeResponseFlag", e.target.checked)} /> Unsafe response</label>
              <label><input type="checkbox" checked={r.humanReview.needsPromptRevision} onChange={e => updateHumanReview(r.personaId, "needsPromptRevision", e.target.checked)} /> Needs prompt revision</label>
              <label><input type="checkbox" checked={r.humanReview.needsCodeRevision} onChange={e => updateHumanReview(r.personaId, "needsCodeRevision", e.target.checked)} /> Needs code revision</label>
            </div>
            <textarea placeholder="Reviewer notes…" value={r.humanReview.notes} onChange={e => updateHumanReview(r.personaId, "notes", e.target.value)} style={{ width: "100%", marginTop: 6, fontSize: 11, fontFamily: "monospace" }} rows={2} />
            {r.raw && (<>
              <details style={{ marginTop: 8 }}><summary style={{ fontSize: 11, cursor: "pointer" }}>Raw response ({r.raw.length} chars)</summary><pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{r.raw}</pre></details>
              <details style={{ marginTop: 4 }}><summary style={{ fontSize: 11, cursor: "pointer" }}>Parsed sections</summary><pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{JSON.stringify(r.sections, null, 2)}</pre></details>
            </>)}
          </div>
        ))}
        {results.length > 0 && <button onClick={persistCurrentReview} style={{ padding: "8px 16px", border: "1px solid #DDD8D3", borderRadius: 100, cursor: "pointer", background: "transparent", fontSize: 11 }}>Save Review Notes</button>}

        {runs.length > 0 && (
          <div style={{ marginTop: 32, borderTop: "1px solid #E5E5E5", paddingTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Saved Runs ({runs.length}) — stored in IndexedDB</div>
            {runs.map(run => (
              <div key={run.runId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0EDE9", fontSize: 11 }}>
                <span>{new Date(run.startedAt).toLocaleString()} — {run.results.length} cases{run.stoppedEarly ? " (stopped early)" : ""}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={compareIds.includes(run.runId)} onChange={e => {
                    setCompareIds(prev => e.target.checked ? [prev[1], run.runId] : prev.map(id => id === run.runId ? null : id));
                  }} title="Select for comparison" />
                  <button onClick={() => exportJSON(run)} style={{ padding: "4px 10px", fontSize: 10, border: "1px solid #DDD8D3", borderRadius: 100, background: "transparent", cursor: "pointer" }}>JSON</button>
                  <button onClick={() => exportCSV(run)} style={{ padding: "4px 10px", fontSize: 10, border: "1px solid #DDD8D3", borderRadius: 100, background: "transparent", cursor: "pointer" }}>CSV</button>
                  <button onClick={() => deleteRun(run.runId)} style={{ padding: "4px 10px", fontSize: 10, border: "1px solid #DDD8D3", borderRadius: 100, background: "transparent", cursor: "pointer" }}>Delete</button>
                </span>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Comparison {compareIds[0] && compareIds[1] ? `(${compareIds[0]} vs ${compareIds[1]})` : "(check two runs above)"}</div>
              {compareIds[0] && compareIds[1] && renderComparison()}
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
