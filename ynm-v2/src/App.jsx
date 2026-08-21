import { useState, useEffect, useRef, Suspense, lazy, Fragment } from "react";
import {
  CATEGORIES, INDUSTRIES, STAGES, WEEK_THEMES,
  STRIPE_MONTHLY, STRIPE_ANNUAL, FREE_PLAN_LIMIT,
  HUB_CATEGORIES, getQuestions
} from "./data.js";
import { LEARNING_HUB, findLearningTopic } from "./learningHub.js";
const QARunner = lazy(() => import("./qa-runner.jsx"));
// ─── PARSERS ─────────────────────────────────────────────────────────────────
function clean(s){ return (s||"").replace(/\*\*/g,"").replace(/^[-•*✓✗\d\.]+\s*/,"").trim(); }
function lines(t){ return (t||"").split("\n").map(l=>l.trim()).filter(Boolean).filter(l=>!l.match(/^#+/)); }
function bullets(t){
  const ls=lines(t); const bs=ls.filter(l=>l.match(/^[-•*\d\.]/));
  return (bs.length>1?bs:ls).map(clean).filter(Boolean);
}
function parseOpps(text){
  const ls=lines(text); const res=[]; let cur=null;
  for(const l of ls){
    const b=l.match(/^\*\*(.+?)\*\*[:\s]*(.*)/)||l.match(/^\d+\.\s*\*\*(.+?)\*\*[:\s]*(.*)/);
    if(b){if(cur)res.push(cur);cur={title:b[1],body:(b[2]||"").replace(/\*\*/g,"")};}
    else if(cur){cur.body=(cur.body?cur.body+" ":"")+l.replace(/\*\*/g,"");}
    else{res.push({title:"",body:clean(l)});}
  }
  if(cur)res.push(cur);
  return res.length?res.slice(0,3):bullets(text).map(b=>({title:"",body:b}));
}
function parseActions(text){
  const ls=lines(text);const res=[];let cur=null;
  for(const l of ls){
    const b=l.match(/^\*\*(.+?)\*\*[:\s]*(.*)/)||l.match(/^\d+\.\s*\*\*(.+?)\*\*[:\s]*(.*)/);
    const why=l.match(/\*Why this matters:?\*?\s*(.*)/i);
    const dep=l.match(/\*\*What to set aside/i);
    if(dep){if(cur){res.push(cur);cur=null;}break;}
    if(b){if(cur)res.push(cur);cur={title:b[1],body:(b[2]||"").replace(/\*\*/g,""),why:""};}
    else if(why&&cur){cur.why=why[1].replace(/\*\*/g,"");}
    else if(cur){cur.body=(cur.body?cur.body+" ":"")+l.replace(/\*\*/g,"");}
  }
  if(cur)res.push(cur);
  const dm=text.match(/\*\*What to set aside[^:]*:\*\*\s*(.+)/i);
  return{actions:res.slice(0,5),deprioritize:dm?dm[1].replace(/\*\*/g,"").trim():""};
}
function parseRoadmap(text){
  const weeks=["","","",""];
  const hits=[...(text||"").matchAll(/week\s*([1-4])[:\s\-–—]*([\s\S]*?)(?=week\s*[1-4]|$)/gi)];
  hits.forEach(m=>{const i=parseInt(m[1])-1;if(i>=0&&i<4)weeks[i]=m[2].trim();});
  if(!weeks.some(Boolean)){const ls=lines(text);const c=Math.ceil(ls.length/4);for(let i=0;i<4;i++)weeks[i]=ls.slice(i*c,(i+1)*c).join("\n");}
  return weeks.map(w=>{
    const ls=lines(w);
    return ls.filter(l=>l.match(/^[-•*\/\d]/)).map(clean).filter(Boolean)
      .concat(ls.filter(l=>!l.match(/^[-•*\/\d]/)).map(clean).filter(Boolean)).slice(0,5);
  });
}
function parseLooking(text){
  const ls=lines(text);const res=[];let cur=null;
  for(const l of ls){
    const b=l.match(/^\*\*(.+?)\*\*[:\s]*(.*)/)||l.match(/^\d+\.\s*\*\*(.+?)\*\*[:\s]*(.*)/);
    if(b){if(cur)res.push(cur);cur={title:b[1],body:(b[2]||"").replace(/\*\*/g,"")};}
    else if(cur){cur.body=(cur.body?cur.body+" ":"")+l.replace(/\*\*/g,"");}
    else{res.push({title:"",body:clean(l)});}
  }
  if(cur)res.push(cur);
  return res.length?res:bullets(text).map(b=>({title:"",body:b}));
}
function parseResult(raw){
  const s={strategicAssessment:"",primaryConstraint:"",strategicOpportunity:"",recommendedActions:"",priorityPlan:"",longTermGrowth:"",successLooks:"",yourNextMove:""};
  if(!raw||typeof raw!=="string")return s;

  // STRATEGY 1: Split by markdown headers — most reliable
  // Handles # Header, ## Header, ### Header
  const headerSplit=raw.split(/\n(?=#+\s)/);
  const sectionMap={};
  headerSplit.forEach(section=>{
    const headerMatch=section.match(/^#+\s+(.+?)\n/);
    if(headerMatch){
      const header=headerMatch[1].toLowerCase().trim();
      const content=section.replace(/^#+\s+.+?\n/,"").trim();
      // Map header text to field names
      if(header.match(/strategic assessment|current position|assessment/))sectionMap.strategicAssessment=content;
      else if(header.match(/primary challenge|primary constraint|challenge|constraint/))sectionMap.primaryConstraint=content;
      else if(header.match(/strategic opportunit|best opportunit|opportunit/))sectionMap.strategicOpportunity=content;
      else if(header.match(/recommended action|action/))sectionMap.recommendedActions=content;
      else if(header.match(/30.day|priority plan|roadmap|plan/))sectionMap.priorityPlan=content;
      else if(header.match(/looking ahead|long.term|ahead/))sectionMap.longTermGrowth=content;
      else if(header.match(/success/))sectionMap.successLooks=content;
      else if(header.match(/your next move|next move/))sectionMap.yourNextMove=content;
    }
  });

  // Apply header-based results
  Object.keys(sectionMap).forEach(k=>{if(sectionMap[k])s[k]=sectionMap[k];});

  // STRATEGY 2: Fallback regex for sections that weren't found by headers
  // More permissive — doesn't require lookahead to next section
  const tryFill=(key,patterns)=>{
    if(s[key]&&s[key].length>10)return; // already filled
    for(const re of patterns){
      const m=raw.match(re);
      if(m&&m[1]&&m[1].trim().length>5){s[key]=m[1].trim();return;}
    }
  };

  tryFill("strategicAssessment",[
    /(?:strategic assessment|assessment)[^\n]*\n([\s\S]{50,}?)(?=\n#|\n\*\*Primary|\n##|$)/i,
    /^([\s\S]{30,200}?)(?=\n#+)/,
  ]);
  tryFill("primaryConstraint",[
    /(?:primary challenge|primary constraint|challenge)[^\n]*\n([\s\S]{30,}?)(?=\n#|\n\*\*Strategic|\n##|$)/i,
  ]);
  tryFill("strategicOpportunity",[
    /(?:strategic opportunit|opportunit)[^\n]*\n([\s\S]{30,}?)(?=\n#|\n\*\*Recommended|\n##|$)/i,
  ]);
  tryFill("recommendedActions",[
    /(?:recommended action|actions)[^\n]*\n([\s\S]{30,}?)(?=\n#|\n\*\*30|\n##|$)/i,
  ]);
  tryFill("priorityPlan",[
    /(?:30.day|priority plan|roadmap)[^\n]*\n([\s\S]{30,}?)(?=\n#|\n\*\*Looking|\n##|$)/i,
  ]);
  tryFill("longTermGrowth",[
    /(?:looking ahead|long.term)[^\n]*\n([\s\S]{30,}?)(?=\n#|\n\*\*What Success|\n##|$)/i,
  ]);
  tryFill("successLooks",[
    /(?:what success|success looks)[^\n]*\n([\s\S]{20,}?)(?=\n#|\n\*\*Your Next|\n##|$)/i,
  ]);
  tryFill("yourNextMove",[
    /(?:your next move|next move)[^\n]*\n([\s\S]{20,}?)(?=\n#+|$)/i,
    /Based on everything[^.]+\.([\s\S]{0,400}?)$/i,
  ]);

  // STRATEGY 3: If yourNextMove still empty, extract from end of document
  if(!s.yourNextMove||s.yourNextMove.length<20){
    const lines=raw.split("\n").reverse();
    for(const line of lines){
      const clean=line.replace(/\*\*/g,"").trim();
      if(clean.length>30&&!clean.startsWith("#")){
        s.yourNextMove=clean;
        break;
      }
    }
  }

  return s;
}

// ─── SHARED AI RESPONSE PARSER ───────────────────────────────────────────────
// Models the Strategy Generator's 3-tier resilience (header-split → permissive
// fallback → total-response fallback) so a minor AI formatting choice (a colon,
// missing bold markers, reordered sections, etc.) can never produce a blank
// card for the user. Validated against 16 adversarial input variations.
function parseAISections(text, sectionDefs) {
  const result = {};
  sectionDefs.forEach(d => { result[d.key] = ""; });

  if (!text || typeof text !== "string" || !text.trim()) {
    return { sections: result, raw: text || "", failedSections: sectionDefs.map(d => d.key), fullyFailed: true };
  }

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Tier 1: tolerant sequential header split. Tolerates optional bold/underline
  // markers, a colon either inside or after them, extra whitespace, case
  // differences, and numbered-list prefixes ("1. Header").
  const allAliases = sectionDefs.flatMap(d => d.aliases.map(a => ({ key: d.key, alias: a })));
  const altPattern = allAliases.map(a => esc(a.alias)).join('|');
  const headerRegex = new RegExp(`(?:^|\\n)\\s*(?:\\d+[.)]\\s*)?(?:\\*\\*|__)?\\s*(${altPattern})\\s*:?\\s*(?:\\*\\*|__)?\\s*:?\\s*(?=\\n|$|—|-)`, 'gi');

  const matches = [...text.matchAll(headerRegex)];
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const matchedAliasText = m[1].toLowerCase();
      const def = allAliases.find(a => a.alias.toLowerCase() === matchedAliasText);
      if (!def) continue;
      const startIdx = m.index + m[0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const content = text.slice(startIdx, endIdx).replace(/^[\s:—-]+/, '').trim();
      if (content.length > 2 && !result[def.key]) result[def.key] = content;
    }
  }

  // Tier 2: permissive per-section fallback for anything Tier 1 still missed.
  sectionDefs.forEach(d => {
    if (result[d.key]) return;
    for (const alias of d.aliases) {
      const re = new RegExp(
        `(?:\\*\\*|__)?${esc(alias)}(?:\\*\\*|__)?\\s*:?\\s*\\n?([\\s\\S]{5,600}?)(?=\\n\\s*(?:\\d+[.)]\\s*)?(?:\\*\\*|__)?[A-Z][a-zA-Z' ]{2,40}(?:\\*\\*|__)?\\s*:?\\s*(?:\\n|$)|$)`,
        'i'
      );
      const m = text.match(re);
      if (m && m[1] && m[1].trim().length > 4) { result[d.key] = m[1].trim(); break; }
    }
  });

  // Tier 3: total-response fallback. If NOTHING parsed at all, never show a
  // blank card — put the cleaned raw text into the first (primary) section.
  const anyParsed = sectionDefs.some(d => result[d.key]);
  let failedSections = sectionDefs.filter(d => !result[d.key]).map(d => d.key);
  if (!anyParsed) {
    const cleaned = text.replace(/\*\*/g, '').trim();
    if (sectionDefs[0]) result[sectionDefs[0].key] = cleaned;
    failedSections = ['TOTAL_FALLBACK_USED'];
  }

  // Final safety pass: if a section's captured content accidentally swallowed
  // the start of a DIFFERENT section's header (bleed-through from a fallback
  // capture spanning an empty section), truncate it there.
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
  failedSections = sectionDefs.filter(d => !result[d.key]).map(d => d.key);

  if (failedSections.length > 0) {
    console.warn('[AI Parser] fallback/missing sections:', failedSections, '— response length:', text.length);
  }

  return { sections: result, raw: text, failedSections, fullyFailed: false };
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1A1916;-webkit-font-smoothing:antialiased;overflow-x:hidden;max-width:100vw;}

.nav{position:sticky;top:0;z-index:200;height:60px;padding:0 40px;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);border-bottom:1px solid #F0EDEB;}
.nav-brand{display:flex;align-items:center;cursor:pointer;}
.nav-name{font-family:'Cormorant',serif;font-size:24px;font-weight:600;color:#1C1917;line-height:1;letter-spacing:-0.01em;}
.nav-actions{display:flex;align-items:center;gap:6px;}
.nav-link{display:flex;align-items:center;gap:5px;padding:7px 14px;background:transparent;color:#78716C;font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;transition:all 0.2s;white-space:nowrap;}
.nav-link:hover{background:#FAFAF8;color:#1C1917;}
.nav-badge{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 4px;background:#B0728A;color:#fff;font-size:11px;font-weight:500;border-radius:100px;}
.nav-btn{padding:7px 18px;background:transparent;color:#1C1917;font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;border:1px solid #D4CECC;cursor:pointer;border-radius:100px;transition:all 0.2s;white-space:nowrap;}
.nav-btn:hover{background:#1A1916;color:#fff;border-color:#1A1916;}
.sub-badge{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#6A9E8A;padding:5px 12px;border-radius:100px;border:1px solid rgba(106,158,138,0.25);background:rgba(106,158,138,0.05);}
.sub-dot{width:6px;height:6px;border-radius:50%;background:#6A9E8A;}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:8px;background:none;border:none;}
.hamburger span{display:block;width:22px;height:2px;background:#1A1916;border-radius:2px;transition:all 0.25s;}
.mobile-menu{display:none;position:fixed;top:60px;left:0;right:0;bottom:0;background:rgba(255,255,255,0.98);backdrop-filter:blur(20px);z-index:199;flex-direction:column;padding:32px 24px;gap:4px;border-top:1px solid #F0EDEB;}
.mobile-menu.open{display:flex;}
.mobile-menu-link{display:flex;align-items:center;justify-content:space-between;padding:18px 0;font-size:22px;font-family:'Cormorant',serif;font-weight:600;color:#1C1917;border-bottom:1px solid #F0EDEB;cursor:pointer;letter-spacing:-0.01em;background:none;border-left:none;border-right:none;border-top:none;text-align:left;width:100%;}
.mobile-menu-link:last-of-type{border-bottom:none;}
.mobile-menu-link:hover{color:#B0728A;}
.mobile-menu-link span{font-size:20px;color:#C4B5AD;}
.mobile-menu-cta{margin-top:24px;width:100%;padding:16px;background:#1A1916;color:#fff;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;font-family:'Plus Jakarta Sans',sans-serif;}
.mobile-menu-cta:hover{background:#B0728A;}

.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;background:#1A1916;color:#fff;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;transition:all 0.2s;white-space:nowrap;font-family:'Plus Jakarta Sans',sans-serif;}
.btn:hover{background:#B0728A;}
.btn:active{transform:scale(0.98);}
.btn:disabled{background:#D4CEC9;cursor:not-allowed;transform:none;}
.btn-out{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;background:transparent;color:#78716C;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;border:1px solid #DDD8D3;cursor:pointer;border-radius:100px;transition:all 0.2s;white-space:nowrap;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-out:hover{border-color:#B0728A;color:#1C1917;}
.brow{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}

/* HOME */
.hero{padding:80px 32px 64px;max-width:780px;margin:0 auto;text-align:center;width:100%;}
.hero-eye{font-size:11px;font-weight:600;letter-spacing:0.38em;text-transform:uppercase;color:#B0728A;margin-bottom:32px;display:block;}
.hero-h1{font-family:'Cormorant',serif;font-size:clamp(52px,8vw,100px);font-weight:600;line-height:0.96;color:#1C1917;margin-bottom:24px;letter-spacing:-0.03em;}
.hero-h1 em{font-style:italic;color:#B0728A;}
.hero-sub{font-size:16px;line-height:1.8;color:#6A6560;font-weight:300;max-width:460px;margin:0 auto 44px;}
.hero-cta{display:inline-flex;align-items:center;gap:12px;padding:16px 40px;background:#1A1916;color:#fff;font-size:12px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;transition:all 0.25s;font-family:'Plus Jakarta Sans',sans-serif;}
.hero-cta:hover{background:#B0728A;}
.hero-arr{transition:transform 0.2s;display:inline-block;}
.hero-cta:hover .hero-arr{transform:translateX(4px);}

/* FEATURE STRIP */
.feature-strip{display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;align-items:stretch;border-top:1px solid #F0EDEB;border-bottom:1px solid #F0EDEB;margin-bottom:0;}
.feat{display:flex;flex-direction:column;justify-content:center;cursor:pointer;padding:24px 32px;transition:background 0.15s;}
.feat:hover{background:#FAFAF8;}
.feat-icon{font-size:18px;color:#B0728A;}
.feat-label{font-size:12px;font-weight:500;color:#57534E;letter-spacing:0.04em;}
.feat-label span{font-size:11px;color:#A8A29E;font-weight:300;margin-left:4px;}

/* CATEGORIES */
.cats{padding:36px 24px 64px;max-width:1080px;margin:0 auto;width:100%;}
.cats-top{margin-bottom:44px;}
.cats-h2{font-family:'Cormorant',serif;font-size:clamp(28px,4vw,48px);font-weight:600;color:#1C1917;margin-bottom:8px;letter-spacing:-0.02em;}
.cats-h2 em{font-style:italic;color:#B0728A;}
.cats-sub{font-size:14px;color:#78716C;font-weight:300;line-height:1.7;}
.cats-row1{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:2px;}
.cats-row2{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;max-width:66.7%;margin:0 auto;width:100%;}
.cat-card{padding:28px 24px 24px;cursor:pointer;border:1px solid #EEEAE7;background:#FAFAF8;position:relative;overflow:hidden;transition:background 0.2s;display:flex;flex-direction:column;}
.cat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform 0.28s ease;}
.cat-card:hover{background:#fff;}
.cat-card:hover::before{transform:scaleX(1);}
.cat-card:hover .cat-go{opacity:1;}
.cat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.cat-num{font-family:'Cormorant',serif;font-size:14px;font-weight:500;color:#C4B5AD;letter-spacing:0.06em;}
.cat-rec{font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;background:rgba(176,114,138,0.1);color:#B0728A;border:1px solid rgba(176,114,138,0.2);padding:2px 9px;border-radius:100px;}
.cat-label{font-family:'Cormorant',serif;font-size:24px;font-weight:600;color:#1C1917;margin-bottom:5px;letter-spacing:-0.01em;}
.cat-tag{font-size:12px;color:#78716C;line-height:1.55;margin-bottom:8px;font-weight:300;}
.cat-detail{font-size:11px;color:#A8A29E;line-height:1.6;font-weight:300;flex:1;margin-bottom:12px;}
.cat-go{font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:var(--acc);opacity:0;transition:opacity 0.2s;margin-top:auto;}

/* WELCOME */
.welcome{min-height:78vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 40px;text-align:center;}
.welcome-rule{width:1px;height:48px;background:linear-gradient(to bottom,transparent,#D4C8C0);margin:0 auto 32px;}
.welcome-eye{font-size:11px;font-weight:600;letter-spacing:0.36em;text-transform:uppercase;color:#B0728A;margin-bottom:18px;display:block;}
.welcome-h{font-family:'Cormorant',serif;font-size:clamp(26px,5vw,44px);font-weight:600;color:#1A1916;line-height:1.1;margin-bottom:14px;letter-spacing:-0.02em;}
.welcome-h em{font-style:italic;color:#B0728A;}
.welcome-sub{font-size:15px;color:#6A6560;line-height:1.75;font-weight:300;max-width:420px;margin:0 auto 28px;}
.welcome-name-wrap{width:100%;max-width:340px;margin:0 auto 24px;}
.welcome-name-label{font-size:11px;font-weight:500;color:#A8A29E;letter-spacing:0.06em;text-align:left;margin-bottom:7px;display:block;}
.welcome-name-input{width:100%;padding:13px 18px;border:1.5px solid #EEEAE7;border-radius:100px;font-size:15px;font-family:'Plus Jakarta Sans',sans-serif;color:#1A1916;outline:none;background:#fff;transition:border-color 0.15s;}
.welcome-name-input:focus{border-color:#B0728A;}
.welcome-name-input::placeholder{color:#C4B5AD;}
.welcome-steps{display:flex;flex-direction:column;gap:7px;width:100%;max-width:380px;margin:0 auto 22px;}
.welcome-step{display:flex;align-items:flex-start;gap:12px;text-align:left;padding:12px 16px;background:#FAFAF8;border:1px solid #EEEAE7;border-radius:4px;}
.welcome-step-num{font-family:'Cormorant',serif;font-size:17px;font-weight:600;color:#C4B5AD;flex-shrink:0;margin-top:1px;}
.welcome-step-text{font-size:13px;color:#57534E;font-weight:300;line-height:1.45;}
.welcome-step-text strong{font-weight:500;color:#1A1916;}
.welcome-time{font-size:12px;color:#B8AFA8;letter-spacing:0.04em;margin-bottom:24px;}

/* FLOW */
.page{max-width:600px;margin:0 auto;padding:48px 24px 72px;}
.bc{display:flex;align-items:center;gap:6px;margin-bottom:24px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#C4B5AD;flex-wrap:wrap;}
.bc span{cursor:pointer;transition:color 0.15s;}
.bc span:hover{color:#B0728A;}
.bc-sep{color:#DDD8D3;}
.pg-h1{font-family:'Cormorant',serif;font-size:clamp(26px,5vw,36px);font-weight:400;color:#1C1917;line-height:1.2;margin-bottom:8px;}
.pg-sub{font-size:14px;color:#78716C;line-height:1.72;margin-bottom:32px;font-weight:300;}
.prog{display:flex;align-items:center;gap:12px;margin-bottom:36px;}
.prog-bars{display:flex;gap:5px;}
.prog-bar{height:2px;border-radius:2px;background:#EDE9E6;transition:all 0.3s;width:22px;}
.prog-bar.done{background:#D8D0D4;}
.prog-bar.active{background:#B0728A;width:32px;}
.prog-label{font-size:12px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#C4B5AD;}
.igrid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:32px;}
.ipill{padding:11px 8px;border:1px solid #EDE9E6;background:#fff;cursor:pointer;font-size:12px;color:#57534E;border-radius:3px;transition:all 0.15s;text-align:center;line-height:1.3;font-family:'Plus Jakarta Sans',sans-serif;}
.ipill:hover{border-color:#E8A898;background:#FDF7F9;}
.ipill.on{border-color:#B0728A;background:#FAF0F4;color:#1C1917;font-weight:500;}
.custom-ind-wrap{margin-bottom:24px;}
.custom-ind-label{font-size:11px;font-weight:500;color:#A8A29E;letter-spacing:0.06em;display:block;margin-bottom:7px;}
.custom-ind-input{width:100%;padding:12px 15px;border:1.5px solid #B0728A;border-radius:4px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;color:#1A1916;outline:none;background:#fff;}
.custom-ind-input::placeholder{color:#C4B5AD;}
.stage-btn{width:100%;padding:18px 22px;text-align:left;border:1.5px solid #EEEAE7;border-radius:4px;cursor:pointer;transition:all 0.15s;display:block;margin-bottom:7px;background:#fff;font-family:'Plus Jakarta Sans',sans-serif;}
.stage-btn:hover{border-color:#E8C4D4;background:#FDF7F9;}
.stage-btn.on{background:#1A1916;border-color:#1A1916;}
.stage-label{font-family:'Cormorant',serif;font-size:19px;font-weight:600;color:#1A1916;margin-bottom:3px;letter-spacing:-0.01em;}
.stage-btn.on .stage-label{color:#fff;}
.stage-sub{font-size:12px;font-weight:300;color:#78716C;line-height:1.4;}
.stage-btn.on .stage-sub{color:#A8A29E;}
.q-shell{min-height:300px;}
.q-in{animation:rise 0.32s cubic-bezier(0.22,0.61,0.36,1) both;}
@keyframes rise{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
.q-eye{font-size:12px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#C4B5AD;margin-bottom:12px;}
.q-text{font-family:'Cormorant',serif;font-size:clamp(22px,4vw,34px);font-weight:500;color:#1C1917;margin-bottom:10px;line-height:1.25;letter-spacing:-0.01em;}
.q-hint-block{background:#FAFAF8;border:1px solid #EEEAE7;border-radius:4px;padding:12px 14px;margin-bottom:14px;}
.q-hint-label{font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#C4B5AD;margin-bottom:6px;}
.q-hint-text{font-size:12px;color:#78716C;font-weight:300;line-height:1.6;}
.q-hint-example{font-size:11px;color:#A8A29E;font-style:italic;margin-top:6px;line-height:1.5;}
.q-multi-hint{font-size:11px;color:#A8A29E;margin-bottom:8px;}
.pills{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:24px;}
.qp{padding:10px 18px;border:1px solid #EDE9E6;background:#fff;cursor:pointer;font-size:12px;color:#57534E;border-radius:100px;transition:all 0.15s;display:flex;align-items:center;gap:6px;font-family:'Plus Jakarta Sans',sans-serif;}
.qp:hover{border-color:#E8A898;background:#FDF7F9;color:#1C1917;}
.qp.on{border-color:#B0728A;background:#FAF0F4;color:#8B4A35;font-weight:500;}
.qp-dot{width:6px;height:6px;border-radius:50%;background:#EDE9E6;flex-shrink:0;transition:background 0.15s;}
.qp.on .qp-dot{background:#B0728A;}
.q-ta{width:100%;padding:14px 16px;border:1px solid #EDE9E6;border-radius:3px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;color:#1C1917;line-height:1.7;resize:none;min-height:110px;outline:none;background:#FAFAF8;transition:border-color 0.15s;}
.q-ta:focus{border-color:#B0728A;background:#fff;}
.q-ta::placeholder{color:#C4B5AD;}
.q-specific{font-size:11px;color:#B8AFA8;margin-top:6px;font-style:italic;}
.q-short-warn{font-size:11px;color:#B0728A;margin-top:6px;display:none;}
.q-short-warn.show{display:block;}
.q-nav{display:flex;align-items:center;justify-content:space-between;margin-top:18px;gap:12px;}
.q-back{background:none;border:none;cursor:pointer;font-size:12px;color:#A8A29E;display:flex;align-items:center;gap:4px;transition:color 0.15s;padding:0;white-space:nowrap;flex-shrink:0;font-family:'Plus Jakarta Sans',sans-serif;}
.q-back:hover{color:#1C1917;}
.q-autosave{font-size:11px;color:#6A9E8A;opacity:0;transition:opacity 0.4s;}
.q-autosave.show{opacity:1;}
.err{background:#FEF2F2;border:1px solid #FECACA;padding:14px 16px;border-radius:3px;color:#7F1D1D;font-size:13px;margin-bottom:18px;line-height:1.6;}

/* LOADING */
.loading{min-height:72vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 24px;text-align:center;}
.load-ring{width:52px;height:52px;border-radius:50%;border:1.5px solid #EDE9E6;border-top-color:#B0728A;animation:spin 1.2s linear infinite;margin-bottom:40px;}
@keyframes spin{to{transform:rotate(360deg);}}
.load-h{font-family:'Cormorant',serif;font-size:clamp(26px,4vw,38px);font-weight:500;letter-spacing:-0.01em;color:#1C1917;margin-bottom:10px;}
.load-msg{font-size:13px;color:#78716C;min-height:20px;}
.load-sub{font-size:11px;color:#C4B5AD;margin-top:6px;letter-spacing:0.04em;}
.load-steps{display:flex;gap:8px;margin-top:24px;justify-content:center;}
.load-step{width:7px;height:7px;border-radius:50%;background:#EEEAE7;transition:background 0.4s,transform 0.3s;}
.load-step.active{background:#B0728A;transform:scale(1.4);}
.load-step.done{background:#6A9E8A;}

/* RESULTS — CLEAN & CONCISE */
.res{max-width:860px;margin:0 auto;width:100%;}
.res-cover{background:#1A1916;padding:56px 52px 48px;animation:coverReveal 0.4s ease both;}
@keyframes coverReveal{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
.res-eye{font-size:11px;font-weight:600;letter-spacing:0.4em;text-transform:uppercase;color:#5A5350;margin-bottom:16px;display:block;}
.res-h1{font-family:'Cormorant',serif;font-size:clamp(32px,5vw,56px);font-weight:600;color:#fff;line-height:1.05;margin-bottom:10px;letter-spacing:-0.02em;}
.res-h1 em{font-style:italic;color:#E8C4D4;}
.res-meta{font-size:12px;color:#5A5350;margin-bottom:12px;letter-spacing:0.04em;}
.res-tags{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:20px;}
.res-tag{font-size:12px;color:#6A6060;border:1px solid #2E2926;padding:4px 12px;border-radius:100px;}
.res-tag-saved{color:#8FBFA8;border-color:#2A3A33;}
.res-btns{display:flex;gap:7px;flex-wrap:wrap;}
.res-btn{padding:9px 20px;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;border-radius:100px;cursor:pointer;transition:all 0.2s;background:transparent;color:#7A6E68;border:1px solid #2E2926;font-family:'Plus Jakarta Sans',sans-serif;}
.res-btn:hover{border-color:#B0728A;color:#E8C4D4;}

.sec{padding:44px 52px;border-bottom:1px solid #EEEAE7;}
.sec:last-of-type{border-bottom:none;}
.sec-dark{background:#1A1916;padding:52px;}
.sec-light{background:#FAFAF8;}
.sec-green{background:linear-gradient(135deg,#EFF7F3,#E6F2EC);border-top:2px solid #6A9E8A;}
.sec-kicker{font-size:11px;font-weight:600;letter-spacing:0.36em;text-transform:uppercase;color:#C4B5AD;margin-bottom:6px;display:flex;align-items:center;gap:12px;}
.sec-kicker-num{font-family:'Cormorant',serif;font-size:26px;font-weight:600;color:#DDD8D4;letter-spacing:-0.02em;line-height:1;}
.sec-kicker-dark{color:#6A5A52;}
.sec-kicker-num-dark{color:#3A3330;}
.sec-purpose{font-size:11px;color:#B8AFA8;margin-bottom:20px;font-style:italic;}
.sec-purpose-dark{color:#5A5350;}
.sec-body{font-size:15px;line-height:1.8;color:#3A3530;font-weight:300;}
.sec-body-dark{font-size:15px;line-height:1.8;color:#8A7E78;font-weight:300;max-width:580px;}
.cards-2{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:16px;}
.card-sm{padding:20px 22px;background:#fff;border:1px solid #EEEAE7;}
.card-sm-gap{border-left:2px solid #E8C4D4;}
.card-sm-label{font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#B8AFA8;margin-bottom:8px;}
.card-sm-text{font-size:13px;color:#57534E;line-height:1.65;font-weight:300;}
.opp-list{display:flex;flex-direction:column;gap:2px;margin-top:4px;}
.opp-row{display:flex;overflow:hidden;border:1px solid #EEEAE7;}
.opp-num{width:52px;flex-shrink:0;background:#1A1916;display:flex;align-items:center;justify-content:center;font-family:'Cormorant',serif;font-size:22px;font-weight:600;color:#B0728A;}
.opp-body{padding:16px 22px;flex:1;}
.opp-title{font-family:'Cormorant',serif;font-size:18px;font-weight:600;color:#1C1917;margin-bottom:4px;line-height:1.2;}
.opp-text{font-size:13px;color:#57534E;line-height:1.65;font-weight:300;}
.action-list{display:flex;flex-direction:column;margin-top:4px;}
.action-row{display:flex;gap:14px;padding:16px 0;border-bottom:1px solid #F5F4F2;align-items:flex-start;}
.action-row:last-child{border-bottom:none;}
.action-num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#B0728A;flex-shrink:0;font-family:'Cormorant',serif;border:1.5px solid #E8C4D4;background:#F5E6EC;}
.action-num.first{background:#B0728A;border-color:#B0728A;color:#fff;}
.action-content{flex:1;}
.action-priority{font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:3px;}
.action-title{font-size:14px;font-weight:500;color:#1C1917;margin-bottom:3px;line-height:1.35;}
.action-body{font-size:13px;color:#57534E;line-height:1.65;font-weight:300;}
.action-why{margin-top:6px;padding-top:6px;border-top:1px solid #F0EDEB;font-size:12px;color:#B0728A;font-style:italic;line-height:1.55;}
.deprioritize{margin-top:18px;padding:14px 18px;background:#FAFAF8;border:1px solid #EEEAE7;border-radius:4px;}
.dep-label{font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#C4B5AD;margin-bottom:5px;}
.dep-text{font-size:13px;color:#78716C;font-weight:300;line-height:1.55;}
.roadmap-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-top:16px;}
.wk{background:#201918;border:1px solid #2A2522;overflow:hidden;}
.wk-head{padding:14px 16px 12px;border-bottom:1px solid #2E2926;}
.wk-n{font-family:'Cormorant',serif;font-size:34px;font-weight:700;color:#2E2926;line-height:1;margin-bottom:5px;}
.wk-theme-lbl{font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#5A5350;margin-bottom:2px;}
.wk-theme{font-family:'Cormorant',serif;font-size:14px;font-weight:600;color:#C4A0B0;line-height:1.2;}
.wk-body{padding:12px 16px 14px;}
.wk-items{list-style:none;}
.wk-item{font-size:12px;color:#7A6E68;line-height:1.6;padding:4px 0 4px 12px;border-bottom:1px solid #2A2522;position:relative;}
.wk-item:last-child{border-bottom:none;}
.wk-item::before{content:'›';position:absolute;left:0;color:#B0728A;font-size:12px;top:4px;}
.look-list{display:flex;flex-direction:column;margin-top:4px;}
.look-row{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid rgba(0,0,0,0.05);align-items:flex-start;}
.look-row:last-child{border-bottom:none;}
.look-arr{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px;background:rgba(176,114,138,0.08);border:1.5px solid rgba(176,114,138,0.2);color:#B0728A;}
.look-content{flex:1;}
.look-title{font-family:'Cormorant',serif;font-size:16px;font-weight:600;color:#1C1917;margin-bottom:2px;}
.look-body{font-size:13px;color:#78716C;line-height:1.6;font-weight:300;}
.insight-block{margin-top:22px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);}
.insight-label{font-size:11px;font-weight:600;letter-spacing:0.3em;text-transform:uppercase;color:#C4A0B0;margin-bottom:12px;}
.insight-text{font-family:'Cormorant',serif;font-size:clamp(18px,3vw,26px);font-weight:600;font-style:italic;color:#fff;line-height:1.28;letter-spacing:-0.01em;}
.insight-copy{margin-top:16px;padding:7px 18px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:100px;font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#C4A0B0;cursor:pointer;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.insight-copy:hover{background:rgba(255,255,255,0.1);color:#fff;}
.nextmove-kicker{font-size:11px;font-weight:600;letter-spacing:0.36em;text-transform:uppercase;color:#C4A0B0;margin-bottom:16px;display:block;}
.nextmove-sub{font-family:'Cormorant',serif;font-size:13px;font-style:italic;color:#5A5350;margin-bottom:28px;display:block;line-height:1.65;}
.nextmove-text{font-family:'Cormorant',serif;font-size:clamp(20px,3.5vw,36px);font-weight:500;font-style:italic;color:#fff;line-height:1.35;max-width:680px;margin:0 auto 36px;letter-spacing:-0.01em;text-align:center;}
.nextmove-rule{width:40px;height:1px;background:#3A3330;margin:0 auto 18px;}
.nextmove-footer{font-size:11px;color:#5A5350;letter-spacing:0.08em;text-transform:uppercase;font-weight:500;display:block;text-align:center;}
.res-footer{display:flex;gap:8px;padding:28px 52px 52px;flex-wrap:wrap;border-top:1px solid #F0EDEB;}
.edit-btn{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#B8AFA8;background:none;border:1px solid #EEEAE7;padding:5px 12px;border-radius:100px;cursor:pointer;transition:all 0.15s;margin-top:16px;font-family:'Plus Jakarta Sans',sans-serif;}
.edit-btn:hover{border-color:#B0728A;color:#B0728A;}
.edit-ta{width:100%;min-height:120px;padding:12px 14px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:300;color:#1A1916;line-height:1.75;border:1.5px solid #B0728A;border-radius:4px;background:#FDFCFC;resize:vertical;outline:none;margin-top:12px;}
.edit-acts{display:flex;gap:7px;margin-top:8px;}
.edit-save{padding:7px 18px;background:#1A1916;color:#fff;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;font-family:'Plus Jakarta Sans',sans-serif;}
.edit-save:hover{background:#B0728A;}
.edit-cancel{padding:7px 18px;background:transparent;color:#A8A29E;font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid #EEEAE7;cursor:pointer;border-radius:100px;font-family:'Plus Jakarta Sans',sans-serif;}

/* FEEDBACK */
.fb-wrap{background:#FAFAF8;border-top:1px solid #EEEAE7;padding:36px 52px;}
.fb-h{font-family:'Cormorant',serif;font-size:22px;font-weight:600;color:#1A1916;margin-bottom:6px;}
.fb-sub{font-size:13px;color:#78716C;font-weight:300;margin-bottom:26px;}
.fb-q{margin-bottom:18px;}
.fb-q-lbl{font-size:12px;font-weight:500;color:#1A1916;margin-bottom:8px;}
.fb-pills{display:flex;gap:6px;flex-wrap:wrap;}
.fb-pill{padding:6px 14px;border-radius:100px;border:1px solid #EEEAE7;background:#fff;color:#57534E;font-size:11px;cursor:pointer;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.fb-pill.on{border-color:#1A1916;background:#1A1916;color:#fff;}
.fb-nums{display:flex;gap:5px;flex-wrap:wrap;}
.fb-num{width:34px;height:34px;border-radius:4px;border:1px solid #EEEAE7;background:#fff;color:#57534E;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.fb-num.on{border-color:#1A1916;background:#1A1916;color:#fff;}
.fb-ta{width:100%;padding:10px 12px;border:1px solid #EEEAE7;border-radius:4px;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;color:#1A1916;resize:vertical;outline:none;line-height:1.6;min-height:70px;}

/* PLANS */
.plans-empty{text-align:center;padding:48px 24px;border:1px dashed #E0DAD5;border-radius:4px;background:#FAFAF8;}
.plans-empty-icon{font-size:24px;color:#D8D0D4;margin-bottom:14px;}
.plans-empty-title{font-family:'Cormorant',serif;font-size:24px;font-weight:600;color:#1C1917;margin-bottom:8px;}
.plans-empty-text{font-size:13px;color:#78716C;line-height:1.7;max-width:320px;margin:0 auto 24px;}
.plans-list{display:flex;flex-direction:column;gap:8px;}
.plan-card{display:flex;align-items:stretch;border:1px solid #EEEAE7;border-radius:4px;background:#fff;cursor:pointer;overflow:hidden;transition:border-color 0.15s,box-shadow 0.15s;}
.plan-card:hover{border-color:#E8C4D4;box-shadow:0 2px 10px rgba(176,114,138,0.08);}
.plan-accent{width:3px;flex-shrink:0;}
.plan-body{flex:1;padding:16px 20px;min-width:0;}
.plan-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
.plan-tags{display:flex;gap:5px;flex-wrap:wrap;}
.plan-tag{font-size:11px;color:#78716C;background:#F5F4F2;padding:3px 9px;border-radius:100px;}
.plan-date{font-size:12px;color:#C4B5AD;flex-shrink:0;}
.plan-title{font-family:'Cormorant',serif;font-size:18px;font-weight:600;color:#1C1917;margin-bottom:4px;}
.plan-preview{font-size:12px;color:#78716C;line-height:1.55;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.plan-actions-col{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;padding:14px 16px;flex-shrink:0;gap:6px;}
.plan-open{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#B0728A;background:none;border:none;cursor:pointer;white-space:nowrap;font-family:'Plus Jakarta Sans',sans-serif;}
.plan-del{width:24px;height:24px;border-radius:50%;background:transparent;border:1px solid #EEEAE7;color:#C4B5AD;font-size:10px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;}
.plan-del:hover{border-color:#E0A898;color:#B0728A;}
.checkin-banner{background:linear-gradient(135deg,#1C1917,#2A2420);border-radius:6px;padding:22px 26px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.checkin-eye{font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#C4A0B0;margin-bottom:6px;}
.checkin-title{font-family:'Cormorant',serif;font-size:22px;font-weight:600;color:#fff;margin-bottom:3px;}
.checkin-sub{font-size:12px;color:#78716C;}
.checkin-btn{padding:9px 20px;background:#fff;color:#1C1917;font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;white-space:nowrap;flex-shrink:0;font-family:'Plus Jakarta Sans',sans-serif;}

/* PAYWALL */
.paywall{position:fixed;inset:0;z-index:250;background:#fff;overflow-y:auto;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 24px;text-align:center;}
.paywall-eye{font-size:10px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#C4B5AD;margin-bottom:14px;}
.paywall-h{font-family:'Cormorant',serif;font-size:clamp(26px,5vw,44px);font-weight:600;color:#1A1916;line-height:1.1;margin-bottom:12px;}
.paywall-h em{font-style:italic;color:#B0728A;}
.paywall-sub{font-size:15px;color:#78716C;max-width:380px;line-height:1.7;margin-bottom:40px;font-weight:300;}
.pw-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:560px;width:100%;margin-bottom:20px;}
.pw-card{border:1px solid #EEEAE7;border-radius:6px;padding:24px 20px;background:#FAFAF8;position:relative;}
.pw-card.pop{border-color:#B0728A;background:#fff;}
.pw-pop-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;background:#B0728A;color:#fff;padding:3px 12px;border-radius:100px;white-space:nowrap;}
.pw-label{font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#A8A29E;margin-bottom:7px;}
.pw-price{font-family:'Cormorant',serif;font-size:44px;font-weight:600;letter-spacing:-0.02em;color:#1C1917;line-height:1;margin-bottom:3px;}
.pw-price span{font-size:16px;vertical-align:top;margin-top:5px;display:inline-block;}
.pw-period{font-size:11px;color:#A8A29E;margin-bottom:8px;}
.pw-save{font-size:11px;color:#6A9E8A;font-weight:500;margin-bottom:12px;}
.pw-features{display:flex;flex-direction:column;gap:5px;margin-bottom:16px;}
.pw-feature{font-size:12px;color:#57534E;display:flex;align-items:flex-start;gap:7px;line-height:1.5;}
.pw-check{color:#B0728A;flex-shrink:0;}
.pw-btn{width:100%;padding:11px;background:#1A1916;color:#fff;font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;transition:background 0.2s;font-family:'Plus Jakarta Sans',sans-serif;}
.pw-card.pop .pw-btn{background:#B0728A;}
.pw-btn:hover{background:#B0728A;}
.pw-card.pop .pw-btn:hover{background:#8A5068;}
.pw-free{font-size:12px;color:#A8A29E;}
.pw-free button{background:none;border:none;color:#B0728A;font-size:12px;cursor:pointer;text-decoration:underline;font-family:'Plus Jakarta Sans',sans-serif;}

/* STRIPE SUCCESS */
.stripe-success{min-height:78vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 40px;text-align:center;}
.stripe-check{width:52px;height:52px;border-radius:50%;background:#EFF7F3;border:1.5px solid #6A9E8A;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:20px;}

/* INDUSTRY HUB */
.hub-page{max-width:900px;margin:0 auto;padding:52px 32px 80px;}
.hub-h1{font-family:'Cormorant',serif;font-size:clamp(32px,5vw,52px);font-weight:600;color:#1C1917;line-height:1.1;margin-bottom:10px;letter-spacing:-0.02em;}
.hub-h1 em{font-style:italic;color:#B0728A;}
.hub-sub{font-size:15px;color:#78716C;font-weight:300;line-height:1.7;margin-bottom:44px;max-width:520px;}
.hub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.hub-card{padding:24px 22px;border:1px solid #EEEAE7;background:#FAFAF8;cursor:pointer;border-radius:4px;transition:all 0.2s;}
.hub-card:hover{background:#fff;border-color:#E8C4D4;box-shadow:0 2px 12px rgba(176,114,138,0.08);}
.hub-card-icon{font-size:22px;color:#B0728A;margin-bottom:12px;}
.hub-card-label{font-family:'Cormorant',serif;font-size:18px;font-weight:600;color:#1C1917;margin-bottom:5px;line-height:1.2;}
.hub-card-desc{font-size:13px;color:#A8A29E;font-weight:300;line-height:1.55;margin-bottom:14px;}
.hub-card-cta{font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#B0728A;}

/* INDUSTRY QUESTIONS PAGE */
.hub-q-page{max-width:1000px;margin:0 auto;padding:48px 32px 80px;}
.hub-q-h1{font-family:'Cormorant',serif;font-size:clamp(28px,4vw,40px);font-weight:600;color:#1C1917;margin-bottom:6px;letter-spacing:-0.01em;}
.hub-q-sub{font-size:14px;color:#78716C;font-weight:300;line-height:1.7;margin-bottom:28px;}
.hub-search{width:100%;padding:13px 18px 13px 44px;border:1px solid #EEEAE7;border-radius:6px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;color:#1A1916;outline:none;background:#FAFAF8;margin-bottom:24px;transition:border-color 0.15s;}
.hub-search:focus{border-color:#B0728A;background:#fff;}
.hub-search::placeholder{color:#C4B5AD;}
.hub-q-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.hub-q-card{padding:22px 20px;border:1px solid #EEEAE7;background:#fff;border-radius:6px;cursor:pointer;transition:all 0.18s;display:flex;flex-direction:column;gap:0;min-height:140px;}
.hub-q-card:hover{border-color:#E8C4D4;background:#FDF7F9;box-shadow:0 2px 12px rgba(176,114,138,0.08);transform:translateY(-1px);}
.hub-q-card-tag{font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#B0728A;background:rgba(176,114,138,0.08);border:1px solid rgba(176,114,138,0.15);padding:3px 10px;border-radius:100px;display:inline-block;margin-bottom:12px;align-self:flex-start;}
.hub-q-card-title{font-family:'Cormorant',serif;font-size:16px;font-weight:600;color:#1C1917;margin-bottom:0;line-height:1.45;letter-spacing:-0.005em;flex:1;}
.hub-q-card-desc{font-size:12px;color:#78716C;font-weight:300;line-height:1.6;flex:1;margin-bottom:16px;}
.hub-q-card-cta{font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#B0728A;margin-top:auto;}

/* ASK YOUR ADVISOR */
.advisor-page{max-width:640px;margin:0 auto;padding:56px 28px 96px;}

/* A quiet mood-setting moment before the interaction — not a full cover, just tone */
.advisor-mood{background:#1A1916;padding:34px 36px;border-radius:6px;text-align:center;margin-bottom:48px;}
.advisor-mood-kicker{font-size:10px;font-weight:600;letter-spacing:0.3em;text-transform:uppercase;color:#8A7E78;margin-bottom:13px;display:block;}
.advisor-mood-line{font-family:'Cormorant',serif;font-style:italic;font-size:19px;color:#fff;line-height:1.5;max-width:420px;margin:0 auto;}

/* THE HERO — one focal point, everything centered around the act of asking */
.advisor-hero{text-align:center;margin-bottom:6px;}
.advisor-h1{font-family:'Cormorant',serif;font-size:clamp(28px,4.6vw,42px);font-weight:600;color:#1C1917;line-height:1.12;margin-bottom:14px;letter-spacing:-0.02em;}
.advisor-h1 em{font-style:italic;color:#B0728A;}
.advisor-sub{font-size:14.5px;color:#78716C;font-weight:300;line-height:1.72;max-width:420px;margin:0 auto 40px;}

.advisor-input-wrap{margin-bottom:18px;}
.advisor-input-label{font-family:'Cormorant',serif;font-style:italic;font-size:16px;color:#8A5068;margin-bottom:14px;display:block;letter-spacing:-0.005em;text-align:center;}
.advisor-ta{width:100%;padding:24px 26px;border:1.5px solid #EEEAE7;border-radius:8px;font-size:15px;font-family:'Plus Jakarta Sans',sans-serif;color:#1A1916;line-height:1.75;resize:none;min-height:150px;outline:none;background:#FAFAF8;transition:border-color 0.2s,background 0.2s;text-align:left;}
.advisor-ta:focus{border-color:#B0728A;background:#fff;}
.advisor-ta::placeholder{color:#C4B5AD;}
.advisor-hint{font-size:12px;color:#B8AFA8;margin-top:8px;font-style:italic;}

/* Suggestions recede — quiet inline text, not competing buttons */
.advisor-suggestions{display:flex;flex-wrap:wrap;gap:11px 12px;justify-content:center;max-width:570px;margin:18px auto 30px;}
.advisor-sugg{background:#fff;border:1px solid rgba(176,114,138,0.32);border-radius:100px;padding:10px 20px;cursor:pointer;font-size:12.5px;color:#57534E;font-family:'Plus Jakarta Sans',sans-serif;line-height:1.4;transition:all 0.18s;}
.advisor-sugg:hover{background:#FDF4F7;border-color:#B0728A;color:#1C1917;}
.advisor-sugg:hover{color:#B0728A;text-decoration-color:#B0728A;}

.advisor-cta-row{display:flex;justify-content:center;margin-bottom:4px;}
.advisor-cta-row .btn{padding:16px 40px;font-size:12px;letter-spacing:0.14em;}

/* ASKED — quiet recap once a question has been submitted, replaces the hero */
.advisor-asked{text-align:center;margin-bottom:8px;}
.advisor-asked-eye{font-size:10px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#C4B5AD;margin-bottom:14px;display:block;}
.advisor-asked-q{font-family:'Cormorant',serif;font-style:italic;font-size:19px;color:#57534E;line-height:1.45;max-width:520px;margin:0 auto;}

.advisor-result{margin-top:36px;border:1px solid #EEEAE7;border-radius:8px;overflow:hidden;}
.advisor-result-header{background:#1A1916;padding:22px 26px;}
.advisor-result-eye{font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#C4A0B0;}
.advisor-result-section{padding:24px 26px;border-bottom:1px solid #EEEAE7;}
.advisor-result-section:last-child{border-bottom:none;}
.advisor-result-label{font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#C4B5AD;margin-bottom:11px;}
.advisor-result-text{font-size:14px;color:#3A3530;line-height:1.8;font-weight:300;}

/* ── ADVISOR RECOMMENDATION BLOCKS — premium report, not a chatbot dump ── */
.advisor-reco-list{display:flex;flex-direction:column;gap:0;margin-top:4px;}
.advisor-reco{display:flex;gap:18px;padding:20px 0;border-bottom:1px solid #F0EDEB;}
.advisor-reco:last-child{border-bottom:none;padding-bottom:0;}
.advisor-reco:first-child{padding-top:0;}
.advisor-reco-num{font-family:'Cormorant',serif;font-size:20px;font-weight:600;color:#B0728A;flex-shrink:0;width:28px;line-height:1.4;}
.advisor-reco-title{font-family:'Cormorant',serif;font-size:18px;font-weight:600;color:#1A1916;margin-bottom:6px;line-height:1.3;letter-spacing:-0.005em;}
.advisor-reco-text{font-size:14px;color:#57534E;line-height:1.75;font-weight:300;}
.advisor-result-steps{display:flex;flex-direction:column;gap:8px;}
.advisor-result-step{display:flex;gap:10px;align-items:flex-start;}
.advisor-result-step-num{width:22px;height:22px;border-radius:50%;background:#B0728A;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.advisor-result-step-text{font-size:13px;color:#57534E;line-height:1.65;font-weight:300;}
.advisor-ask-again{display:block;margin:32px auto 0;background:none;border:none;color:#B0728A;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;text-align:center;}
.advisor-ask-again:hover{color:#8A5068;}

/* PREVIOUS SESSIONS — present, but quiet; never competes with the hero */
.advisor-history{margin-top:64px;padding-top:32px;border-top:1px solid #F0EDEB;}
.advisor-history-label{font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#C4B5AD;margin-bottom:16px;}
.advisor-history-item{padding:18px 20px;border:1px solid #EEEAE7;border-radius:6px;margin-bottom:8px;cursor:pointer;transition:all 0.18s;}
.advisor-history-item:hover{border-color:#E8C4D4;background:#FDF7F9;}
.advisor-history-date{font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#C4B5AD;margin-bottom:7px;}
.advisor-history-q{font-family:'Cormorant',serif;font-size:15.5px;font-style:italic;color:#1A1916;font-weight:500;line-height:1.4;}

/* GUIDANCE — collapsed by default; a footnote, not a section competing at the top */
.advisor-disclosure{margin-top:40px;padding-top:24px;border-top:1px solid #F0EDEB;}
.advisor-disclosure summary{cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#A8A29E;list-style:none;}
.advisor-disclosure summary::-webkit-details-marker{display:none;}
.advisor-disclosure summary:hover{color:#78716C;}
.advisor-disclosure summary::after{content:'+';float:right;font-weight:400;}
.advisor-disclosure[open] summary::after{content:'−';}
.advisor-guidance{display:flex;gap:36px;flex-wrap:wrap;margin-top:22px;}
.advisor-guidance-col{flex:1;min-width:200px;}
.advisor-guidance-label{font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:10px;}
.advisor-guidance-item{font-size:12.5px;color:#78716C;font-weight:300;line-height:1.65;padding-left:12px;margin-bottom:7px;}

/* ── LEARNING GUIDE — 5-STEP MICROLESSON ─────────────────────────────── */
.lesson-progress{display:flex;align-items:center;gap:6px;margin-bottom:36px;}
.lesson-dot{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px solid #EEEAE7;background:#fff;font-family:'Cormorant',serif;font-size:13px;font-weight:600;color:#C4B5AD;cursor:pointer;flex-shrink:0;transition:all 0.15s;}
.lesson-dot:hover{border-color:#E8C4D4;}
.lesson-dot.active{border-color:#B0728A;background:#B0728A;color:#fff;}
.lesson-dot.done{border-color:#B0728A;color:#B0728A;background:#FAF0F4;}
.lesson-dot-line{flex:1;height:1px;background:#EEEAE7;min-width:8px;}
.lesson-step-label{font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#B0728A;margin-bottom:10px;display:block;}
.lesson-step-count{font-size:11px;color:#C4B5AD;margin-bottom:2px;display:block;}
.lesson-body{min-height:280px;animation:rise 0.32s cubic-bezier(0.22,0.61,0.36,1) both;}
.lesson-explain{font-size:16px;color:#3A3530;line-height:1.75;font-weight:300;margin-bottom:20px;}
.lesson-analogy{background:#FAFAF8;border-left:2px solid #B0728A;padding:14px 18px;margin-bottom:20px;font-family:'Cormorant',serif;font-style:italic;font-size:16px;color:#57534E;line-height:1.5;}
.lesson-why{font-size:14px;color:#78716C;line-height:1.7;font-weight:300;margin-bottom:24px;}
.lesson-takeaway-box{background:#1A1916;padding:20px 24px;border-radius:6px;}
.lesson-takeaway-label{font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#C4A0B0;margin-bottom:8px;}
.lesson-takeaway-text{font-family:'Cormorant',serif;font-size:19px;font-style:italic;color:#fff;line-height:1.4;}
.lesson-how-list{display:flex;flex-direction:column;gap:0;}
.lesson-how-row{display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #F5F4F2;align-items:flex-start;}
.lesson-how-row:last-child{border-bottom:none;}
.lesson-how-num{font-family:'Cormorant',serif;font-size:22px;font-weight:600;color:#B0728A;flex-shrink:0;width:28px;}
.lesson-how-title{font-size:14px;font-weight:600;color:#1A1916;margin-bottom:3px;}
.lesson-how-text{font-size:13px;color:#57534E;line-height:1.6;font-weight:300;}
.lesson-example-box{background:#FAFAF8;border:1px solid #EEEAE7;border-radius:6px;padding:24px;margin-bottom:18px;}
.lesson-example-label{font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#C4B5AD;margin-bottom:12px;}
.lesson-example-text{font-size:14px;color:#3A3530;line-height:1.75;font-weight:300;}
.lesson-example-lesson{font-size:13px;color:#B0728A;font-style:italic;line-height:1.6;}
.lesson-takeaways-list{display:flex;flex-direction:column;gap:12px;margin-bottom:28px;}
.lesson-takeaway-row{display:flex;gap:14px;align-items:flex-start;}
.lesson-takeaway-n{font-family:'Cormorant',serif;font-size:18px;font-weight:600;color:#C4B5AD;flex-shrink:0;}
.lesson-takeaway-line{font-size:14px;color:#1A1916;line-height:1.6;}
.lesson-terms-label{font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#C4B5AD;margin-bottom:10px;}
.lesson-terms{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;}
.lesson-term-chip{padding:8px 16px;border-radius:100px;border:1px solid rgba(176,114,138,0.32);background:#fff;font-size:12.5px;color:#8A5068;cursor:pointer;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.lesson-term-chip:hover{background:#FDF4F7;}
.lesson-term-chip.open{background:#1A1916;border-color:#1A1916;color:#fff;}
.lesson-term-def{font-size:13px;color:#57534E;line-height:1.6;font-weight:300;background:#FAFAF8;border-radius:6px;padding:12px 16px;margin-top:8px;}
.lesson-deeper-label{font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#A8A29E;margin-bottom:10px;margin-top:28px;}
.lesson-deeper-list{display:flex;flex-wrap:wrap;gap:8px;}
.lesson-deeper-chip{padding:6px 14px;border-radius:100px;background:#F5F4F2;font-size:12px;color:#78716C;}
.lesson-check-q{font-family:'Cormorant',serif;font-size:20px;font-weight:600;color:#1A1916;line-height:1.4;margin-bottom:22px;}
.lesson-check-opt{width:100%;text-align:left;padding:14px 18px;border:1.5px solid #EEEAE7;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;color:#3A3530;margin-bottom:8px;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.lesson-check-opt:hover{border-color:#E8C4D4;background:#FDF7F9;}
.lesson-check-opt.picked{border-color:#B0728A;background:#FAF0F4;}
.lesson-check-opt.correct{border-color:#6A9E8A;background:#EFF7F3;}
.lesson-check-opt.incorrect{border-color:#D4A8B0;background:#FDF2F2;}
.lesson-check-opt:disabled{cursor:default;}
.lesson-check-feedback{margin-top:18px;padding:16px 20px;border-radius:6px;background:#FAFAF8;}
.lesson-check-feedback-label{font-family:'Cormorant',serif;font-size:17px;font-weight:600;margin-bottom:6px;}
.lesson-check-feedback-text{font-size:13px;color:#57534E;line-height:1.6;font-weight:300;}
.lesson-nav{display:flex;align-items:center;justify-content:space-between;margin-top:32px;gap:12px;}
.lesson-nav-back{background:none;border:none;cursor:pointer;font-size:12px;color:#A8A29E;font-family:'Plus Jakarta Sans',sans-serif;}
.lesson-nav-back:hover{color:#1C1917;}
.lesson-end-actions{display:flex;flex-direction:column;gap:8px;margin-top:24px;}
.lesson-skeleton{padding:20px 0;}
.lesson-skeleton-line{height:14px;border-radius:4px;background:linear-gradient(90deg,#F5F4F2 25%,#EEEAE7 37%,#F5F4F2 63%);background-size:400% 100%;animation:lessonShimmer 1.4s ease infinite;margin-bottom:12px;}
@keyframes lessonShimmer{0%{background-position:100% 50%;}100%{background-position:0 50%;}}


/* HAMBURGER + MOBILE MENU */
.hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:8px;z-index:300;}
.hamburger span{display:block;width:22px;height:2px;background:#1A1916;border-radius:2px;transition:all 0.25s ease;}
.mobile-menu{position:fixed;top:54px;left:0;right:0;bottom:0;background:#fff;z-index:190;padding:24px 24px 40px;display:flex;flex-direction:column;gap:4px;transform:translateX(100%);transition:transform 0.28s cubic-bezier(0.22,0.61,0.36,1);overflow-y:auto;border-top:1px solid #F0EDEB;}
.mobile-menu.open{transform:translateX(0);}
.mobile-menu-link{display:flex;align-items:center;justify-content:space-between;width:100%;padding:18px 0;background:none;border:none;border-bottom:1px solid #F5F4F2;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:400;color:#1A1916;cursor:pointer;text-align:left;}
.mobile-menu-link span{color:#C4B5AD;font-size:16px;}
.mobile-menu-link:hover{color:#B0728A;}
.mobile-menu-cta{margin-top:20px;width:100%;padding:16px;background:#1A1916;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;border:none;cursor:pointer;border-radius:100px;transition:background 0.2s;}
.mobile-menu-cta:hover{background:#B0728A;}

/* THREE WAYS */
.three-ways-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.three-way-card{padding:28px 24px;border:1px solid #EEEAE7;background:#FAFAF8;border-radius:6px;cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;gap:0;}
.three-way-card:hover{background:#fff;border-color:#E8C4D4;box-shadow:0 4px 20px rgba(176,114,138,0.08);transform:translateY(-2px);}
.three-way-card.featured{background:#1A1916;border-color:#1A1916;}
.three-way-card.featured:hover{background:#2A2420;border-color:#2A2420;}
.three-way-icon{font-size:24px;margin-bottom:14px;}
.three-way-title{font-family:'Cormorant',serif;font-size:22px;font-weight:600;color:#1C1917;margin-bottom:4px;letter-spacing:-0.01em;}
.three-way-card.featured .three-way-title{color:#fff;}
.three-way-sub{font-size:12px;font-weight:500;color:#B0728A;margin-bottom:10px;letter-spacing:0.04em;}
.three-way-card.featured .three-way-sub{color:#C4A0B0;}
.three-way-desc{font-size:13px;color:#78716C;font-weight:300;line-height:1.7;flex:1;margin-bottom:14px;}
.three-way-card.featured .three-way-desc{color:#8A7E78;}
.three-way-tag{font-size:11px;color:#A8A29E;font-style:italic;}
.three-way-card.featured .three-way-tag{color:#5A5350;}

/* ═══════════════════════════════════════════════════════════════
   STRATEGY REPORT — FINAL DESIGN SYSTEM
   Creative Direction: Apple × McKinsey × Stripe
   ═══════════════════════════════════════════════════════════════ */

/* DESIGN TOKENS */
:root{
  --r-bg:#FAFAF8;
  --r-bg-dark:#141210;
  --r-ink:#1A1916;
  --r-ink-2:#4A4540;
  --r-ink-3:#736C65;
  --r-rule:#E8E4E0;
  --r-rule-dark:#232120;
  --r-accent:#B0728A;
  --r-accent-dk:#8A5068;
  --r-accent-soft:rgba(176,114,138,0.14);
  --r-sage:#6A9E8A;
  --r-dark-label:#9C948C;
  --r-dark-body:#B0AAA3;
  --r-dark-meta:#8C8479;
  --r-pad:64px;
  --r-pad-v:80px;
}

/* ── REPORT SHELL ──────────────────────────────────────────── */
.rpt{max-width:860px;margin:0 auto;background:#fff;}

/* ── COVER ─────────────────────────────────────────────────── */
.rpt-cover{background:var(--r-bg-dark);padding:92px var(--r-pad) 56px;}
.rpt-cover-eyebrow{font-size:10px;font-weight:500;letter-spacing:0.38em;text-transform:uppercase;color:var(--r-dark-meta);margin-bottom:32px;display:block;}
.rpt-cover-title{font-family:'Cormorant',serif;font-size:clamp(46px,7.2vw,80px);font-weight:600;color:#fff;line-height:0.98;letter-spacing:-0.03em;margin-bottom:22px;}
.rpt-cover-title em{font-style:italic;color:var(--r-accent);}
.rpt-cover-forname{font-family:'Cormorant',serif;font-style:italic;font-size:19px;font-weight:500;color:var(--r-dark-label);letter-spacing:0.01em;margin-bottom:44px;}
.rpt-cover-forname strong{font-style:normal;font-weight:600;color:#fff;}
.rpt-cover-meta{font-size:12px;color:#4A4540;letter-spacing:0.06em;line-height:2;margin-bottom:36px;}
.rpt-cover-meta span{margin:0 12px 0 0;}
.rpt-cover-meta span:not(:last-child)::after{content:'·';margin-left:12px;color:#2A2520;}
.rpt-cover-tags{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding-top:28px;border-top:1px solid var(--r-rule-dark);}
.rpt-cover-tag{font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--r-dark-meta);border:1px solid rgba(176,114,138,0.32);border-radius:100px;padding:7px 16px;background:rgba(255,255,255,0.02);}
.rpt-cover-saved{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:var(--r-sage);margin-top:16px;}

/* ── SECTION ANATOMY — identical every time ────────────────── */
.rpt-sec{padding:var(--r-pad-v) var(--r-pad);}
.rpt-sec-alt{background:var(--r-bg);}
.rpt-sec-dark{background:var(--r-bg-dark);}
.rpt-sec-rule{height:1px;background:var(--r-rule);margin-bottom:var(--r-pad-v);}

/* SECTION HEADER — the one consistent element across all 9 sections */
.rpt-sec-hd{margin-bottom:48px;}
.rpt-sec-num{font-size:10px;font-weight:600;letter-spacing:0.36em;text-transform:uppercase;color:var(--r-accent);margin-bottom:10px;display:block;}
.rpt-sec-dark .rpt-sec-num{color:var(--r-accent);}
.rpt-sec-title{font-family:'Cormorant',serif;font-size:clamp(26px,3.5vw,36px);font-weight:600;color:var(--r-ink);line-height:1.1;letter-spacing:-0.02em;margin-bottom:6px;}
.rpt-sec-dark .rpt-sec-title{color:#fff;}
.rpt-sec-desc{font-size:13px;color:var(--r-ink-3);font-weight:300;line-height:1.6;}
.rpt-sec-dark .rpt-sec-desc{color:var(--r-dark-meta);}
.rpt-sec-div{width:32px;height:1px;background:var(--r-accent);margin-top:20px;}
.rpt-sec-dark .rpt-sec-div{background:var(--r-accent-dk);}

/* ── EXECUTIVE SUMMARY — ONE UNIFIED BRIEFING ──────────────── */
.rpt-exec-break{display:flex;justify-content:center;}
.rpt-exec-break-rule{width:36px;height:1px;background:var(--r-rule);}
.rpt-exec-unified{border:1px solid rgba(176,114,138,0.26);border-radius:14px;overflow:hidden;background:#fff;}
.rpt-exec-hero{background:var(--r-bg-dark);padding:46px 44px 42px;}
.rpt-exec-hero-label{font-size:10px;font-weight:600;letter-spacing:0.34em;text-transform:uppercase;color:var(--r-accent);margin-bottom:26px;display:block;}
.rpt-exec-hero-headline{font-family:'Cormorant',serif;font-size:clamp(30px,5.2vw,50px);font-weight:600;font-style:italic;color:#fff;line-height:1.18;letter-spacing:-0.015em;max-width:720px;margin-bottom:20px;}
.rpt-exec-hero-sub{font-size:14px;color:var(--r-dark-body);font-weight:300;line-height:1.75;max-width:500px;}

.rpt-exec-glance{display:flex;flex-wrap:wrap;padding:34px 44px;border-bottom:1px solid var(--r-rule);}
.rpt-exec-glance-item{flex:1;min-width:180px;padding:0 26px;border-left:1px solid var(--r-rule);}
.rpt-exec-glance-item:first-child{border-left:none;padding-left:0;}
.rpt-exec-glance-label{font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:var(--r-accent);margin-bottom:10px;}
.rpt-exec-glance-value{font-size:13px;color:var(--r-ink-2);line-height:1.6;font-weight:300;}

.rpt-exec-nextmove{padding:38px 44px 44px;}
.rpt-exec-nextmove-label{font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:var(--r-accent);margin-bottom:14px;display:block;}
.rpt-exec-nextmove-text{font-family:'Cormorant',serif;font-style:italic;font-size:21px;color:var(--r-ink);line-height:1.52;max-width:600px;}

/* ── ASSESSMENT ─────────────────────────────────────────────── */
.rpt-body{font-size:15px;color:var(--r-ink);line-height:1.9;font-weight:300;margin-bottom:32px;}
.rpt-str-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--r-rule);}
.rpt-str-cell{padding:24px 28px;background:#fff;}
.rpt-str-label{font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:10px;}
.rpt-str-label-s{color:var(--r-sage);}
.rpt-str-label-t{color:var(--r-accent);}
.rpt-str-text{font-size:14px;color:var(--r-ink);line-height:1.7;font-weight:300;}

/* ── CHALLENGE (DARK) ───────────────────────────────────────── */
.rpt-chal-name{font-family:'Cormorant',serif;font-size:clamp(22px,3.5vw,36px);font-weight:600;font-style:italic;color:#fff;line-height:1.2;letter-spacing:-0.02em;margin-bottom:22px;}
.rpt-chal-body{font-size:15px;color:var(--r-dark-body);line-height:1.9;font-weight:300;margin-bottom:40px;}
.rpt-insight-block{border:1px solid #332E2A;background:rgba(255,255,255,0.02);padding:32px;}
.rpt-insight-label{font-size:10px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--r-accent);margin-bottom:16px;}
.rpt-insight-quote{font-family:'Cormorant',serif;font-size:clamp(19px,2.8vw,27px);font-weight:500;font-style:italic;color:#fff;line-height:1.4;letter-spacing:-0.01em;margin-bottom:22px;}
.rpt-insight-share{padding:7px 18px;background:transparent;border:1px solid #3A3430;color:var(--r-dark-meta);font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.rpt-insight-share:hover{border-color:#5A544E;color:#E8C4D4;}

/* ── OPPORTUNITIES ──────────────────────────────────────────── */
.rpt-opps-stack{display:flex;flex-direction:column;gap:1px;background:var(--r-rule);}
.rpt-opps-stack-start{border-top:1px solid var(--r-rule);}
.rpt-opp-row{display:grid;grid-template-columns:64px 1fr;background:#fff;}
.rpt-opp-idx{display:flex;align-items:flex-start;justify-content:center;padding:32px 0;border-right:1px solid var(--r-rule);}
.rpt-opp-idx-n{font-size:10px;font-weight:600;letter-spacing:0.14em;color:var(--r-accent);padding-top:3px;}
.rpt-opp-content{padding:28px 32px;}
.rpt-opp-title{font-family:'Cormorant',serif;font-size:19px;font-weight:600;color:var(--r-ink);margin-bottom:8px;line-height:1.3;letter-spacing:-0.01em;}
.rpt-opp-body{font-size:13px;color:var(--r-ink-2);line-height:1.75;font-weight:300;}

/* ── ACTIONS ────────────────────────────────────────────────── */
.rpt-actions-stack{display:flex;flex-direction:column;gap:0;}
.rpt-actions-stack-start{border-top:1px solid var(--r-rule);}
.rpt-action-row{display:grid;grid-template-columns:132px 1fr;border-bottom:1px solid var(--r-rule);}
.rpt-action-row:last-child{border-bottom:none;}
.rpt-action-row.is-first{background:var(--r-bg-dark);}
.rpt-action-row.is-first .rpt-action-rule{border-right-color:var(--r-rule-dark);}
.rpt-action-rule{border-right:1px solid var(--r-rule);padding:28px 24px 28px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;justify-content:flex-start;}
.rpt-action-num{font-family:'Cormorant',serif;font-size:27px;font-weight:600;color:var(--r-accent);line-height:1;letter-spacing:-0.01em;}
.rpt-action-cap{font-size:10px;font-weight:500;letter-spacing:0.09em;text-transform:uppercase;color:var(--r-ink-3);margin-top:auto;}
.rpt-action-row.is-first .rpt-action-cap{color:var(--r-dark-meta);}
.rpt-action-body{padding:28px 32px;}
.rpt-action-title{font-size:15px;font-weight:600;color:var(--r-ink);line-height:1.4;margin-bottom:8px;letter-spacing:-0.01em;}
.rpt-action-row.is-first .rpt-action-title{color:#fff;}
.rpt-action-desc{font-size:13px;color:var(--r-ink-2);line-height:1.75;font-weight:300;}
.rpt-action-row.is-first .rpt-action-desc{color:var(--r-dark-body);}
.rpt-action-why{margin-top:12px;padding-top:12px;border-top:1px solid var(--r-rule);font-size:12px;color:var(--r-accent);font-style:italic;line-height:1.6;}
.rpt-action-row.is-first .rpt-action-why{border-top-color:var(--r-rule-dark);color:#D4A8BA;}
.rpt-deprio-row{padding:20px 32px;background:var(--r-bg);display:flex;gap:16px;align-items:baseline;border-top:1px solid var(--r-rule);}
.rpt-deprio-label{font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--r-ink-3);flex-shrink:0;}
.rpt-deprio-text{font-size:13px;color:var(--r-ink-2);line-height:1.65;font-weight:300;}

/* ── 30-DAY PLAN ────────────────────────────────────────────── */
.rpt-weeks{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--r-rule-dark);}
.rpt-week-col{border-right:1px solid var(--r-rule-dark);}
.rpt-week-col:last-child{border-right:none;}
.rpt-week-hd{padding:24px 20px 18px;border-bottom:1px solid var(--r-rule-dark);}
.rpt-week-n{font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:var(--r-accent);margin-bottom:8px;}
.rpt-week-theme{font-family:'Cormorant',serif;font-size:21px;font-weight:600;color:#fff;line-height:1.15;margin-bottom:5px;letter-spacing:-0.01em;}
.rpt-week-goal{font-size:11px;color:var(--r-dark-meta);font-weight:300;line-height:1.55;}

/* ── 30-DAY PLAN PROGRESS RING — clean, no gamification ── */
.plan-progress-wrap{display:flex;flex-direction:column;align-items:center;margin-bottom:36px;}
.plan-progress-ring{width:88px;height:88px;transform:rotate(-90deg);}
.plan-progress-track{fill:none;stroke:#2A2522;stroke-width:6;}
.plan-progress-fill{fill:none;stroke:var(--r-accent);stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset 0.4s ease;}
.plan-progress-text{margin-top:-58px;display:flex;align-items:center;justify-content:center;height:88px;}
.plan-progress-pct{font-family:'Cormorant',serif;font-size:22px;font-weight:600;color:#fff;letter-spacing:-0.01em;}
.plan-progress-label{font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--r-dark-meta);margin-top:14px;}
.plan-week-check{width:22px;height:22px;flex-shrink:0;border-radius:50%;border:1.5px solid var(--r-rule-dark);background:transparent;color:var(--r-accent);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.plan-week-check:hover{border-color:var(--r-accent);}
.plan-week-check.done{background:var(--r-accent);border-color:var(--r-accent);color:#fff;}
.rpt-week-bd{padding:16px 20px 22px;}
.rpt-week-task{font-size:11.5px;color:var(--r-dark-body);line-height:1.7;padding:6px 0;border-bottom:1px solid var(--r-rule-dark);display:flex;gap:8px;align-items:flex-start;}
.rpt-week-task:last-child{border-bottom:none;}
.rpt-week-dot{width:3px;height:3px;border-radius:50%;background:var(--r-accent);flex-shrink:0;margin-top:8px;opacity:0.8;}

/* ── LOOKING AHEAD ──────────────────────────────────────────── */
.rpt-ahead-list{display:flex;flex-direction:column;}
.rpt-ahead-list-start{border-top:1px solid var(--r-rule);}
.rpt-ahead-row{display:grid;grid-template-columns:64px 1fr;padding:32px 0;border-bottom:1px solid var(--r-rule);}
.rpt-ahead-row:last-child{border-bottom:none;}
.rpt-ahead-idx{font-size:10px;font-weight:600;letter-spacing:0.18em;color:var(--r-accent);padding-top:3px;}
.rpt-ahead-content{}
.rpt-ahead-title{font-family:'Cormorant',serif;font-size:20px;font-weight:600;color:var(--r-ink);margin-bottom:8px;line-height:1.3;letter-spacing:-0.01em;}
.rpt-ahead-body{font-size:13px;color:var(--r-ink-2);line-height:1.78;font-weight:300;}

/* ── SUCCESS ────────────────────────────────────────────────── */
.rpt-success-list{display:flex;flex-direction:column;gap:0;}
.rpt-success-row{display:flex;gap:20px;align-items:flex-start;padding:24px 0;border-bottom:1px solid var(--r-rule);}
.rpt-success-row:last-child{border-bottom:none;}
.rpt-success-mark{width:20px;height:20px;border:1px solid var(--r-accent);border-radius:50%;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;}
.rpt-success-dot{width:6px;height:6px;background:var(--r-accent);border-radius:50%;}
.rpt-success-text{font-size:14px;color:var(--r-ink);line-height:1.7;font-weight:300;}

/* ── YOUR NEXT MOVE ─────────────────────────────────────────── */
.rpt-nm{background:var(--r-bg-dark);padding:108px var(--r-pad);text-align:center;}
.rpt-nm-eyebrow{font-size:10px;font-weight:600;letter-spacing:0.38em;text-transform:uppercase;color:var(--r-dark-meta);margin-bottom:22px;display:block;}
.rpt-nm-label{font-size:13px;color:var(--r-accent);font-style:italic;margin-bottom:52px;display:block;letter-spacing:0.02em;}
.rpt-nm-text{font-family:'Cormorant',serif;font-size:clamp(28px,4.2vw,48px);font-weight:500;font-style:italic;color:#fff;line-height:1.3;max-width:640px;margin:0 auto;letter-spacing:-0.02em;}
.rpt-nm-meta{display:flex;gap:0;justify-content:center;margin-top:56px;padding-top:40px;border-top:1px solid var(--r-rule-dark);}
.rpt-nm-meta-col{padding:0 44px;text-align:center;border-right:1px solid var(--r-rule-dark);}
.rpt-nm-meta-col:first-child{padding-left:0;}
.rpt-nm-meta-col:last-child{border-right:none;padding-right:0;}
.rpt-nm-meta-lbl{font-size:9px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:var(--r-dark-meta);margin-bottom:6px;}
.rpt-nm-meta-val{font-size:14px;color:var(--r-dark-label);font-weight:400;}

/* ── CONCLUSION ─────────────────────────────────────────────── */
.rpt-end{padding:88px var(--r-pad);text-align:center;}
.rpt-end-rule{width:28px;height:1px;background:var(--r-accent);margin:0 auto 32px;}
.rpt-end-eyebrow{font-size:10px;font-weight:600;letter-spacing:0.36em;text-transform:uppercase;color:var(--r-accent);margin-bottom:16px;display:block;}
.rpt-end-h{font-family:'Cormorant',serif;font-size:clamp(28px,4vw,44px);font-weight:600;color:var(--r-ink);line-height:1.1;margin-bottom:14px;letter-spacing:-0.02em;}
.rpt-end-sub{font-size:14px;color:var(--r-ink-2);font-weight:300;line-height:1.75;max-width:380px;margin:0 auto 40px;}

/* ── FLOW PAGES ─────────────────────────────────────────────── */
.rpt-flow{min-height:82vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 32px;text-align:center;max-width:480px;margin:0 auto;}
.rpt-flow-mark{width:52px;height:52px;border:1px solid var(--r-rule);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;font-family:'Cormorant',serif;font-size:22px;color:var(--r-accent);}
.rpt-flow-eyebrow{font-size:10px;font-weight:600;letter-spacing:0.36em;text-transform:uppercase;color:var(--r-accent);margin-bottom:14px;display:block;}
.rpt-flow-h{font-family:'Cormorant',serif;font-size:clamp(26px,4vw,38px);font-weight:600;color:var(--r-ink);margin-bottom:12px;letter-spacing:-0.02em;line-height:1.1;}
.rpt-flow-sub{font-size:14px;color:var(--r-ink-2);font-weight:300;line-height:1.78;margin-bottom:10px;}
.rpt-flow-note{font-size:12px;color:var(--r-ink-3);line-height:1.65;margin-bottom:36px;}
.rpt-flow-btns{display:flex;flex-direction:column;gap:8px;width:100%;max-width:280px;}
.rpt-flow-primary{width:100%;padding:15px 28px;background:var(--r-ink);color:#fff;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;border:none;cursor:pointer;transition:background 0.2s;font-family:'Plus Jakarta Sans',sans-serif;}
.rpt-flow-primary:hover{background:var(--r-accent);}

/* ── PDF DOWNLOAD PAGE ──────────────────────────────────────── */
.rpt-pdf-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;max-width:280px;margin-top:8px;}
.rpt-pdf-link{padding:12px 16px;background:var(--r-bg);border:1px solid var(--r-rule);font-size:11px;font-weight:500;color:var(--r-ink-2);cursor:pointer;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;text-align:center;}
.rpt-pdf-link:hover{border-color:var(--r-accent);color:var(--r-ink);}

/* ── FEEDBACK PAGE ──────────────────────────────────────────── */
.rpt-fb{max-width:600px;margin:0 auto;padding:64px 28px 80px;}
.rpt-fb-eyebrow{font-size:10px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:var(--r-accent);margin-bottom:14px;display:block;}
.rpt-fb-h{font-family:'Cormorant',serif;font-size:clamp(24px,4vw,36px);font-weight:600;color:var(--r-ink);margin-bottom:10px;letter-spacing:-0.02em;line-height:1.1;}
.rpt-fb-sub{font-size:14px;color:var(--r-ink-2);font-weight:300;line-height:1.72;margin-bottom:36px;}
.rpt-fb-rule{height:1px;background:var(--r-rule);margin:24px 0;}

/* ── EDIT ───────────────────────────────────────────────────── */
.rpt-edit{display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--r-ink-3);background:none;border:1px solid var(--r-rule);padding:5px 12px;cursor:pointer;transition:all 0.15s;margin-top:20px;font-family:'Plus Jakarta Sans',sans-serif;}
.rpt-edit:hover{border-color:var(--r-accent);color:var(--r-accent);}
.rpt-edit-ta{width:100%;min-height:120px;padding:12px 14px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:var(--r-ink);line-height:1.75;border:1px solid var(--r-accent);background:#fff;resize:vertical;outline:none;margin-top:12px;font-weight:300;}
.rpt-edit-row{display:flex;gap:7px;margin-top:8px;}
.rpt-edit-save{padding:7px 18px;background:var(--r-ink);color:#fff;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.rpt-edit-save:hover{background:var(--r-accent);}
.rpt-edit-cancel{padding:7px 18px;background:transparent;color:var(--r-ink-3);font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid var(--r-rule);cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}

/* ── PRINT / PDF ────────────────────────────────────────────── */
@media print{
  @page{margin:0.5in;size:letter portrait;}
  @page :first{margin:0;}
  html,body{width:auto!important;height:auto!important;min-height:0!important;overflow:visible!important;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;}
  .nav,.rpt-end,.rpt-edit,.rpt-cover-actions,body>*:not(.rpt){display:none!important;}

  /* Reset every screen-only sizing convention that has no meaning on a fixed page */
  .rpt-flow,.hero,.mobile-menu{min-height:0!important;height:auto!important;}
  .rpt{max-width:none;height:auto!important;min-height:0!important;overflow:visible!important;}
  .rpt-sec,.rpt-exec-unified,.rpt-weeks,.rpt-opps-stack,.rpt-actions-stack{
    height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;
    position:static!important;transform:none!important;
  }
  .rpt-cover,.rpt-nm{height:auto!important;max-height:none!important;overflow:visible!important;position:static!important;transform:none!important;}

  /* Text safety for unpredictable AI-generated content: long compound words, industries, or URLs
     wrap safely instead of overflowing or being clipped */
  .rpt-sec,.rpt-cover,.rpt-nm{overflow-wrap:anywhere;word-break:normal;hyphens:auto;}

  .rpt-sec{padding:15px 40px;}
  .rpt-nm{padding:40px 56px;}
  .rpt-cover{padding:0.85in 0.75in;}

  /* ── COVER: true edge-to-edge bleed via @page:first (verified with pixel sampling —
     all four corners render pure black, confirming no margin gap remains). Internal
     padding compensates for the lost page margin so text stays comfortably inset. ── */
  .rpt-cover{
    background:#141210!important;
    display:flex;flex-direction:column;justify-content:center;
    min-height:10.5in;
    break-after:page;page-break-after:always;
  }
  .rpt-cover-title{font-size:64px!important;line-height:0.96!important;}

  /* Fix: "Scale & Review" (the longest week theme) wraps to 2 lines while
     shorter themes don't, pushing that column's tasks down and misaligning
     every row across the 4-column grid. A consistent min-height makes all
     four columns start their task list at the same vertical position
     regardless of which theme name happens to wrap. */
  .rpt-week-hd{min-height:86px!important;}
  .rpt-weeks-header{border-bottom:none!important;}
  .rpt-weeks-body{border-top:none!important;}

  /* Adaptive Executive Summary spacing — tier is chosen in JS from real measured
     content length (see the render code), not a fixed guess. This is the
     structural fix: padding responds to actual content instead of being tuned
     to one example and breaking on the next. */
  .rpt-exec-hero{padding:26px 40px 20px!important;}
  .rpt-exec-glance{padding:20px 40px!important;}
  .rpt-exec-nextmove{padding:20px 40px 26px;border-top:2px solid var(--r-accent);}
  .rpt-exec-nextmove-label{font-size:11px;letter-spacing:0.26em;margin-top:10px;}
  .rpt-exec-nextmove-text{font-size:22px!important;line-height:1.4!important;}

  /* DENSE: long content (>950 chars combined) — compress further so a detailed
     strategy still has the best possible chance of fitting on one page. */
  .rpt-exec-dense .rpt-exec-hero{padding:18px 40px 14px!important;}
  .rpt-exec-dense .rpt-exec-hero-headline{font-size:22px!important;line-height:1.15!important;}
  .rpt-exec-dense .rpt-exec-glance{padding:14px 40px!important;}
  .rpt-exec-dense .rpt-exec-glance-value{font-size:12.5px!important;line-height:1.5!important;}
  .rpt-exec-dense .rpt-exec-nextmove{padding:14px 40px 18px!important;}
  .rpt-exec-dense .rpt-exec-nextmove-text{font-size:18px!important;line-height:1.35!important;}

  /* AIRY: short content (<400 chars combined) — use the extra room
     intentionally so it reads as composed, not sparse. */
  .rpt-exec-airy .rpt-exec-hero{padding:40px 44px 32px!important;}
  .rpt-exec-airy .rpt-exec-hero-headline{font-size:32px!important;}
  .rpt-exec-airy .rpt-exec-glance{padding:32px 44px!important;}
  .rpt-exec-airy .rpt-exec-nextmove{padding:32px 44px 40px!important;}
  .rpt-exec-airy .rpt-exec-nextmove-text{font-size:26px!important;line-height:1.45!important;}

  /* ── CLOSING PAGE: same full-page treatment, forced to start fresh, nothing after it ── */
  .rpt-nm{
    background:#141210!important;
    display:flex;flex-direction:column;justify-content:center;
    min-height:8.2in;
    break-before:page;page-break-before:always;
  }

  .rpt-sec-dark,.rpt-weeks,.rpt-exec-hero{background:#141210!important;}
  .rpt-weeks{grid-template-columns:repeat(4,1fr)!important;}
  /* Adaptive roadmap: when task volume is substantially higher than the typical 4-per-week
     baseline (computed from real data, not guessed), switch to 2 columns instead of shrinking
     text or hiding tasks */
  .rpt-weeks-compact{grid-template-columns:repeat(2,1fr)!important;}
  .rpt-action-row.is-first{background:#141210!important;}
  .rpt-str-grid{grid-template-columns:1fr 1fr!important;}

  /* Fix: the hairline-divider technique (colored parent background peeking through 1px gaps)
     rendered as an orphaned gray block whenever a page break landed inside that flex container.
     Neutralize the parent background for print and draw the divider on each row instead. */
  .rpt-opps-stack{background:transparent!important;border-top:1px solid var(--r-rule);}
  .rpt-opp-row{border-bottom:1px solid var(--r-rule);}
  .rpt-str-grid{background:transparent!important;}
  .rpt-str-cell:first-child{border-right:1px solid var(--r-rule);}

  /* Force block flow instead of flex for print — flex-column fragmentation proved unreliable
     during pagination testing (confirmed via isolated reproduction), affecting every list that
     uses flex-direction:column for its rows */
  .rpt-exec-glance,.rpt-opps-stack,.rpt-actions-stack,.rpt-ahead-list,.rpt-success-list{display:block!important;}
  .rpt-exec-glance-item{display:block;width:100%;border-left:none!important;border-bottom:1px solid var(--r-rule);padding-bottom:16px;margin-bottom:16px;}
  .rpt-exec-glance-item:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}

  /* Section 07 (Measurable Milestones) gets its own dedicated page */
  /* Sections flow continuously — content of unpredictable length (sometimes
     vague and short, sometimes exhaustively detailed) cannot be reliably
     forced into "one section = one page" without creating either awkward
     empty space (short content) or overflow (long content). Strong visual
     section markers (numerals, dark/light alternation, dividers) create the
     sense of distinct chapters without wasting space on artificial breaks. */

  /* Every section heading stays attached to what follows it — never orphaned alone at a page bottom */
  .rpt-sec-hd,.rpt-week-hd{break-after:avoid;page-break-after:avoid;}

  /* Hard guarantee for heading+first-item: break-after:avoid is only a hint and can still lose
     when the browser judges there's no better option. rpt-heading-lock wraps the heading and its
     first content row in one shared parent with break-inside:avoid, which is a real DOM-level
     guarantee — they physically cannot be separated by pagination. */
  .rpt-heading-lock{break-inside:avoid;page-break-inside:avoid;}

  /* Sections flow naturally one after another — no forced break-per-section.
     Only Cover and Closing (above) force a fresh page. */

  /* Atomic units only: small, bounded pieces that must never split internally.
     Deliberately NOT applied to whole multi-item containers (rpt-exec-unified, rpt-sec-dark,
     rpt-weeks, rpt-opps-stack, rpt-actions-stack, rpt-ahead-list, rpt-success-list) since those
     can legitimately exceed one page with enough content — forcing them whole would push an
     oversized block onto a fresh page and leave the previous page mostly blank. The Strengths/
     What-Needs-Attention pair is the one exception: it's inherently two short paragraphs and
     genuinely is a single atomic comparison, not a growable list. */
  .rpt-exec-hero,.rpt-exec-glance-item,.rpt-exec-nextmove,
  .rpt-opp-row,.rpt-action-row,.rpt-deprio-row,.rpt-ahead-row,.rpt-success-row,
  .rpt-str-grid,.rpt-insight-block,.rpt-week-task{
    break-inside:avoid;page-break-inside:avoid;
  }

  /* 30-Day Plan: a real checkable box for print, instead of the small screen dot */
  .rpt-week-dot{
    width:10px;height:10px;border-radius:2px;flex-shrink:0;margin-top:2px;
    background:transparent!important;border:1.3px solid var(--r-dark-body);opacity:1;
  }

  /* Prevent a single stray line stranded at the top or bottom of a page */
  .rpt-body,.rpt-chal-body,.rpt-opp-body,.rpt-action-desc,.rpt-ahead-body,
  .rpt-str-text,.rpt-success-text,.rpt-exec-glance-value{
    orphans:3;widows:3;
  }
}

/* Screen fallback for browsers that don't fully support break-inside in flex/grid contexts */
.rpt-sec-hd,.rpt-exec-hero,.rpt-opp-row,.rpt-action-row,.rpt-ahead-row{break-inside:avoid;}

/* RESPONSIVE — STRATEGY REPORT (.rpt-*), real on-screen mobile coverage.
   The rules that previously lived here targeted an older class scheme
   (.rpt-action, .rpt-nextmove, .rpt-conclusion, etc.) that no longer exists
   in the component — dead CSS that did nothing on-screen. Replaced with
   rules against the classes actually rendered today, using the same
   reduced-padding values already proven in the @media print block above. */
@media(max-width:860px){
  .rpt-sec{padding:56px 32px;}
  .rpt-nm{padding:72px 32px;}
  .rpt-end{padding:64px 32px;}
  .rpt-exec-hero{padding:36px 32px 30px;}
  .rpt-exec-glance{padding:26px 32px;}
  .rpt-exec-nextmove{padding:28px 32px 32px;}
  .rpt-weeks{grid-template-columns:repeat(2,1fr);}
  .rpt-week-hd{padding:20px 16px 14px;}
  .rpt-week-bd{padding:12px 16px 16px;}
}
@media(max-width:640px){
  .rpt-cover{padding:48px 16px 40px;}
  .rpt-sec{padding:44px 20px;}
  .rpt-nm{padding:52px 20px;}
  .rpt-nm-text{font-size:clamp(20px,5.5vw,28px);}
  .rpt-end{padding:48px 20px;}
  .rpt-end-h{font-size:clamp(24px,7vw,32px);}
  .rpt-exec-hero{padding:26px 20px 22px;}
  .rpt-exec-hero-headline{font-size:clamp(24px,6.5vw,32px);}
  .rpt-exec-glance{padding:20px 20px;flex-direction:column;gap:18px;}
  .rpt-exec-glance-item{border-left:none!important;padding-left:0!important;}
  .rpt-exec-nextmove{padding:20px 20px 26px;}

  /* Recommended Actions — stack the numeral/label column above the content
     instead of squeezing a 132px-wide desktop rail into a 375px screen. */
  .rpt-action-row{grid-template-columns:1fr;}
  .rpt-action-rule{border-right:none;border-bottom:1px solid var(--r-rule);flex-direction:row;align-items:center;gap:10px;padding:14px 20px;}
  .rpt-action-row.is-first .rpt-action-rule{border-bottom-color:var(--r-rule-dark);}
  .rpt-action-body{padding:18px 20px;}

  /* Best Opportunity / Looking Ahead — narrow the index rail instead of
     removing it, so the numbering stays visible without eating the width
     a two-line title needs. */
  .rpt-opp-row{grid-template-columns:36px 1fr;}
  .rpt-opp-content{padding:20px 16px;}
  .rpt-ahead-row{grid-template-columns:36px 1fr;padding:22px 0;}

  .rpt-str-grid{grid-template-columns:1fr;}
  .rpt-str-cell{padding:18px 20px;}

  /* 30-Day Plan — full stack on phones. Four fixed columns at this width
     left roughly 90px per week; one column per row is what's readable. */
  .rpt-weeks{grid-template-columns:1fr;}
  .rpt-week-col{border-right:none!important;border-bottom:1px solid var(--r-rule-dark);}
  .rpt-week-col:last-child{border-bottom:none;}
  .rpt-week-hd{padding:18px 20px 12px;}
  .rpt-week-bd{padding:10px 20px 16px;}

  .rpt-deprio-row{flex-direction:column;gap:6px;padding:16px 20px;}
  .rpt-success-row{padding:18px 0;}
  .rpt-nm-meta{flex-direction:column;gap:20px;padding-top:28px;}
  .rpt-nm-meta-col{border-right:none!important;padding:0!important;}
}

/* RESPONSIVE */
@media(max-width:860px){
  .res-cover,.sec,.sec-dark,.res-footer,.fb-wrap{padding-left:28px;padding-right:28px;}
  .hub-q-grid{grid-template-columns:repeat(2,1fr);}
  .nav-link{font-size:10px;padding:6px 8px;letter-spacing:0.06em;}
  .cards-2{grid-template-columns:1fr;}
  .roadmap-grid{grid-template-columns:1fr 1fr;}
  .hub-grid{grid-template-columns:repeat(2,1fr);}
}
@media(max-width:640px){
  .nav{padding:0 16px;height:54px;}
  .nav-by{display:none;}
  .nav-link{display:none;}
  .nav-btn{display:none;}
  .sub-badge{display:none;}
  .nav-name{font-size:18px;}
  .hamburger{display:flex;}
  .feature-strip{grid-template-columns:1fr;}
  .feature-strip>div[style]{display:none;}
  .feat{padding:18px 20px;border-bottom:1px solid #F0EDEB;}
  .feature-cards-grid{grid-template-columns:1fr!important;}
  [style*="repeat(3,1fr)"]{grid-template-columns:1fr!important;}
  .feature-cards-grid{grid-template-columns:1fr!important;}
  .nav-name{font-size:16px;}
  .nav-by{font-size:11px;}
  .nav-btn{padding:6px 12px;font-size:10px;}
  .nav-link{font-size:10px;padding:6px 10px;}
  .hero{padding:56px 16px 44px;}
  .hero-h1{font-size:clamp(36px,11vw,52px);}
  .hero-sub{font-size:14px;margin-bottom:28px;}
  .hero-cta{padding:13px 26px;font-size:11px;width:100%;justify-content:center;}
  .feature-strip{padding:20px 16px;gap:16px;}
  .cats{padding:36px 16px 52px;}
  .cats-row1{grid-template-columns:1fr;}
  .cats-row2{grid-template-columns:1fr;max-width:100%;}
  .cat-detail{display:none;}
  .page{padding:28px 16px 52px;}
  .pg-h1{font-size:clamp(22px,7vw,30px);}
  .igrid{grid-template-columns:repeat(2,1fr);}
  .q-text{font-size:clamp(19px,6vw,25px);}
  .q-nav{flex-direction:column-reverse;gap:8px;align-items:stretch;}
  .q-nav .btn{width:100%;justify-content:center;}
  .q-back{justify-content:center;padding:5px 0;}
  .brow{flex-direction:column;align-items:stretch;}
  .brow .btn,.brow .btn-out{width:100%;justify-content:center;}
  .pw-cards{grid-template-columns:1fr;max-width:320px;}
  .res-cover{padding:20px 16px 18px;}
  .res-h1{font-size:clamp(22px,7vw,30px);}
  .sec{padding:24px 16px;}
  .sec-dark{padding:36px 16px;}
  .res-footer{padding:16px 16px 36px;flex-direction:column;}
  .res-footer .btn,.res-footer .btn-out{width:100%;justify-content:center;}
  .fb-wrap{padding:24px 16px;}
  .roadmap-grid{grid-template-columns:1fr 1fr;}
  .opp-num{width:40px;font-size:18px;}
  .opp-body{padding:12px 14px;}
  .checkin-banner{flex-direction:column;gap:12px;}
  .checkin-btn{width:100%;text-align:center;}
  .hub-grid{grid-template-columns:1fr;}
  .three-ways-grid{grid-template-columns:1fr;}
  .hub-q-grid{grid-template-columns:1fr;}
  .hub-page,.hub-q-page,.advisor-page{padding:32px 16px 60px;}
}
`;



// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,       setScreen]       = useState("home");
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [stripeSuccess,setStripeSuccess]= useState(false);
  const [catId,        setCatId]        = useState(null);
  const [industry,     setIndustry]     = useState(null);
  const [customInd,    setCustomInd]    = useState("");
  const [journeyStage, setJourneyStage] = useState(null);
  const [answers,      setAnswers]      = useState({});
  const [qIdx,         setQIdx]         = useState(0);
  const [result,       setResult]       = useState(null);
  const [loadMsg,      setLoadMsg]      = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [savedPlans,   setSavedPlans]   = useState([]);


  const [viewingPlanId,setViewingPlanId]= useState(null);
  const [firstName,    setFirstName]    = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPaywall,  setShowPaywall]  = useState(false);
  const [paywallContext, setPaywallContext] = useState('strategy'); // strategy | advisor | hub — which free entitlement was hit
  const [notesText,    setNotesText]    = useState("");
  const [completedWeeks, setCompletedWeeks] = useState([false,false,false,false]); // 30-Day Plan week-level completion, per saved strategy
  const [notesSaveStatus, setNotesSaveStatus] = useState(null); // 'saving'|'saved'|'error'|null
  const [fbDone,       setFbDone]       = useState(false);
  const [pdfUnlocked,  setPdfUnlocked]  = useState(false);
  const [strategyStage, setStrategyStage] = useState('reading'); // reading | saved | feedback | complete
  const [pendingPrint, setPendingPrint] = useState(false);
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [fbRating,     setFbRating]     = useState(null);
  const [fbAns,        setFbAns]        = useState({});
  const [autoSaved,    setAutoSaved]    = useState(false);
  const [shortWarn,    setShortWarn]    = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lifetime free-entitlement flags — persisted separately from content so
  // deleting a strategy/plan can never restore free eligibility. "One means
  // one" per the product spec: each flips true on first successful use and
  // never resets except by an administrator clearing the stored key directly.
  const [freeStrategyUsed, setFreeStrategyUsed] = useState(false);
  const [freeAdvisorUsed,  setFreeAdvisorUsed]  = useState(false);
  const [freeHubUsed,      setFreeHubUsed]      = useState(false);
  const [freeHubTopicId,   setFreeHubTopicId]   = useState(null); // which topic the free Hub use was spent on — revisiting/completing it again never re-consumes
  // Synchronous mirror of freeHubUsed. React state updates are async/batched,
  // which leaves a window where two topics clicked in quick succession can
  // both see the entitlement as unused. This ref updates in the same tick as
  // the check, closing that race — the state above stays the source of truth
  // for rendering, this ref is only for the atomic guard.
  const freeHubUsedRef = useRef(false);
  const freeStrategyUsedRef = useRef(false); // same synchronous-lock pattern, applied to Strategy
  const freeAdvisorUsedRef  = useRef(false); // same synchronous-lock pattern, applied to Advisor
  const hubGenerationInFlightRef = useRef(false); // blocks duplicate /api/generate calls from rapid re-clicks on the same Hub topic

  // Industry Hub state
  const [hubCatId,     setHubCatId]     = useState(null);
  const [hubSearchResult, setHubSearchResult] = useState(null);
  const [hubSearchLoading, setHubSearchLoading] = useState(false);
  const [hubSearchQuery, setHubSearchQuery] = useState("");
  const [hubSearch,    setHubSearch]    = useState("");
  const [hubTopicId,   setHubTopicId]   = useState(null);
  const [hubGuide,     setHubGuide]     = useState(null);
  const [hubGuideLoading, setHubGuideLoading] = useState(false);
  const [hubStep,      setHubStep]      = useState(0);
  const [hubQuickAnswer, setHubQuickAnswer] = useState(null);
  const [hubQuickSubmitted, setHubQuickSubmitted] = useState(false);
  const [hubExpandedTerm, setHubExpandedTerm] = useState(null);
  const [hubCompletedIds, setHubCompletedIds] = useState([]); // topic ids the user has finished a Quick Check for

  // Ask Your Advisor state
  const [advisorQ,     setAdvisorQ]     = useState("");
  const [advisorResult,setAdvisorResult]= useState(null);
  const [advisorLoading,setAdvisorLoading]=useState(false);
  const [advisorHistory,setAdvisorHistory]=useState([]);

  const cat = CATEGORIES.find(c=>c.id===catId);
  const effectiveIndustry = industry==="Other"?(customInd||"Other"):industry;
  const qs  = (catId&&industry&&journeyStage)?getQuestions(catId,effectiveIndustry,journeyStage):[];
  const curQ= qs[qIdx];
  const today = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  const stageLabel = {starting:"Just Getting Started",growing:"Growing & Building Momentum",established:"Established & Looking to Scale",optimizing:"Experienced & Optimizing"}[journeyStage]||"";

  const loadMsgs = [
    `${firstName?firstName+", we":"We"}'re reviewing everything you shared…`,
    `Analyzing your ${effectiveIndustry||"industry"} context…`,
    "Identifying your most important opportunity…",
    "Building your 30-day action plan…",
    "Writing your personalized strategy…",
    "Almost ready — adding your final recommendations…",
  ];

  useEffect(()=>{
    if(!loading)return;
    const t=setInterval(()=>setLoadMsg(m=>(m+1)%loadMsgs.length),2800);
    return()=>clearInterval(t);
  },[loading]);

  useEffect(()=>{
    if(pendingPrint && strategyStage==='reading'){
      const t=setTimeout(()=>{window.print();setPendingPrint(false);},50);
      return()=>clearTimeout(t);
    }
  },[pendingPrint,strategyStage]);

  useEffect(()=>{
    loadUserState();loadSavedPlans();
    const p=new URLSearchParams(window.location.search);
    if(p.get("subscribed")==="1"){setStripeSuccess(true);saveSubState(true);window.history.replaceState({},"",window.location.pathname);}
    if(p.get("devqa")==="1"){go("devqa");}
    // Load advisor history
    try{const h=localStorage.getItem("advisor-history");if(h)setAdvisorHistory(JSON.parse(h));}catch(e){}
  },[]);

  // Autosave answers
  useEffect(()=>{
    if(!Object.keys(answers).length)return;
    const t=setTimeout(async()=>{
      try{await window.storage.set("draft-answers",JSON.stringify({catId,industry,customInd,journeyStage,answers,qIdx}));setAutoSaved(true);setTimeout(()=>setAutoSaved(false),2000);}catch(e){}
    },800);
    return()=>clearTimeout(t);
  },[answers,catId,industry,journeyStage,qIdx]);

  async function loadUserState(){
    try{
      const sub=await window.storage.get("subscription-status");
      if(sub&&JSON.parse(sub.value).isSubscribed)setIsSubscribed(true);
      const fn=await window.storage.get("user-firstname");
      if(fn)setFirstName(fn.value);
      const ob=await window.storage.get("has-onboarded");
      if(ob)setHasOnboarded(true);
      const draft=await window.storage.get("draft-answers");
      if(draft){const d=JSON.parse(draft.value);if(d.catId&&d.industry){setCatId(d.catId);setIndustry(d.industry);setCustomInd(d.customInd||"");setJourneyStage(d.journeyStage);setAnswers(d.answers||{});setQIdx(d.qIdx||0);}}
    }catch(e){}
    // Lifetime entitlement flags — read independently of any content state,
    // so a deleted strategy/plan can never make a consumed free use reappear.
    try{
      const es=await window.storage.get("entitlement-strategy-used");
      if(es&&JSON.parse(es.value).used){setFreeStrategyUsed(true);freeStrategyUsedRef.current=true;}
    }catch(e){}
    try{
      const ea=await window.storage.get("entitlement-advisor-used");
      if(ea&&JSON.parse(ea.value).used){setFreeAdvisorUsed(true);freeAdvisorUsedRef.current=true;}
    }catch(e){}
    try{
      const eh=await window.storage.get("entitlement-hub-used");
      if(eh){const d=JSON.parse(eh.value);setFreeHubUsed(!!d.used);setFreeHubTopicId(d.topicId||null);freeHubUsedRef.current=!!d.used;}
    }catch(e){}
    try{
      const hc=await window.storage.get("hub-completed-topics");
      if(hc)setHubCompletedIds(JSON.parse(hc.value)||[]);
    }catch(e){}
  }

  async function markFreeStrategyUsed(){
    try{await window.storage.set("entitlement-strategy-used",JSON.stringify({used:true,at:Date.now()}));}catch(e){}
    freeStrategyUsedRef.current=true;setFreeStrategyUsed(true);
  }
  async function markFreeAdvisorUsed(){
    try{await window.storage.set("entitlement-advisor-used",JSON.stringify({used:true,at:Date.now()}));}catch(e){}
    freeAdvisorUsedRef.current=true;setFreeAdvisorUsed(true);
  }
  async function markFreeHubUsed(topicId){
    try{await window.storage.set("entitlement-hub-used",JSON.stringify({used:true,topicId,at:Date.now()}));}catch(e){}
    freeHubUsedRef.current=true;setFreeHubUsed(true);setFreeHubTopicId(topicId);
  }
  async function markTopicCompleted(topicId){
    setHubCompletedIds(prev=>{
      if(prev.includes(topicId))return prev;
      const next=[...prev,topicId];
      window.storage.set("hub-completed-topics",JSON.stringify(next)).catch(()=>{});
      return next;
    });
  }

  async function saveSubState(v){
    try{await window.storage.set("subscription-status",JSON.stringify({isSubscribed:v}));setIsSubscribed(v);}catch(e){}
  }
  async function saveFirstName(fn){
    try{await window.storage.set("user-firstname",fn);setFirstName(fn);}catch(e){}
  }
  async function loadSavedPlans(){
    try{
      const idx=await window.storage.get("plans-index");
      const ids=idx?JSON.parse(idx.value):[];
      const plans=[];
      for(const id of ids){try{const p=await window.storage.get(`plan:${id}`);if(p)plans.push(JSON.parse(p.value));}catch(e){}}
      plans.sort((a,b)=>b.createdAt-a.createdAt);setSavedPlans(plans);
    }catch(e){setSavedPlans([]);}
  }
  async function savePlan(planResult,meta){
    const id=`${Date.now()}`;
    const plan={id,createdAt:Date.now(),result:planResult,...meta};
    try{
      await window.storage.set(`plan:${id}`,JSON.stringify(plan));
      const idx=await window.storage.get("plans-index").catch(()=>null);
      const ids=idx?JSON.parse(idx.value):[];ids.unshift(id);
      await window.storage.set("plans-index",JSON.stringify(ids.slice(0,50)));
      setSavedPlans(prev=>[plan,...prev]);
      try{await window.storage.delete("draft-answers");}catch(e){}
      return id;
    }catch(e){return null;}
  }
  async function deletePlan(id){
    try{
      await window.storage.delete(`plan:${id}`);
      const idx=await window.storage.get("plans-index").catch(()=>null);
      const ids=idx?JSON.parse(idx.value).filter(x=>x!==id):[];
      await window.storage.set("plans-index",JSON.stringify(ids));
      setSavedPlans(prev=>prev.filter(p=>p.id!==id));
    }catch(e){}
  }

  function go(s){setScreen(s);window.scrollTo(0,0);setMobileMenuOpen(false);}
  function restart(){
    setCatId(null);setIndustry(null);setCustomInd("");setJourneyStage(null);
    setAnswers({});setQIdx(0);setResult(null);setError(null);
    setViewingPlanId(null);setShowPaywall(false);setNotesText("");setNotesSaveStatus(null);
    setFbDone(false);setFbRating(null);setFbAns({});setShortWarn(false);setStrategyStage('reading');
    setCompletedWeeks([false,false,false,false]);
    go("home");
  }
  async function completeOnboarding(name){
    if(name&&name.trim())await saveFirstName(name.trim());
    if(welcomeEmail&&welcomeEmail.trim()){
      try{await window.storage.set("user-email",welcomeEmail.trim());}catch(e){}
      // FORMSPREE: Replace YOUR_FORM_ID with your Formspree form ID
      // Get it free at formspree.io → New Form → copy the ID
      const FORMSPREE_ENDPOINT = "https://formspree.io/f/xnjelvwq";
      if(!FORMSPREE_ENDPOINT.includes("YOUR_FORM_ID")){
        try{
          fetch(FORMSPREE_ENDPOINT,{
            method:"POST",
            headers:{"Content-Type":"application/json","Accept":"application/json"},
            body:JSON.stringify({name:name.trim(),email:welcomeEmail.trim(),source:"YNM Beta",date:new Date().toISOString()})
          });
        }catch(e){}
      }
    }
    try{await window.storage.set("has-onboarded","1");}catch(e){}
    setHasOnboarded(true);go("home");setTimeout(()=>{const el=document.querySelector(".cats");if(el){el.scrollIntoView({behavior:"smooth",block:"start"});}},150);
  }
  function pickCat(id){setCatId(id);setIndustry(null);setCustomInd("");setJourneyStage(null);setAnswers({});setQIdx(0);go("industry");}
  function togglePill(val,multi){
    setAnswers(prev=>{const cur=prev[qIdx];if(multi){const arr=Array.isArray(cur)?cur:[];return{...prev,[qIdx]:arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]};}return{...prev,[qIdx]:val};});
    setShortWarn(false);
  }
  function answered(i){const a=answers[i];if(!a)return false;if(Array.isArray(a))return a.length>0;return String(a).trim().length>0;}
  function nextQ(){
    if(curQ&&curQ.type==="text"&&(!answers[qIdx]||String(answers[qIdx]).trim().length<20)){setShortWarn(true);return;}
    setShortWarn(false);
    if(qIdx<qs.length-1){setQIdx(q=>q+1);window.scrollTo(0,0);}else generate();
  }
  function openSavedPlan(plan){setCatId(plan.catId);setIndustry(plan.industry);setJourneyStage(plan.journeyStage||null);setResult(plan.result);setViewingPlanId(plan.id);setStrategyStage('reading');setFbDone(!!plan.feedbackSubmitted);setPdfUnlocked(!!plan.pdfUnlocked);setNotesText(plan.notes||"");setNotesSaveStatus(null);setCompletedWeeks(plan.completedWeeks||[false,false,false,false]);go("results");}

  // Persists 30-Day Plan week completion onto this specific saved strategy —
  // reuses the exact same read-modify-write pattern as Notes and the feedback
  // unlock, on the same plan record, so it survives leaving and returning.
  async function toggleWeekComplete(weekIndex){
    const next=completedWeeks.map((v,i)=>i===weekIndex?!v:v);
    setCompletedWeeks(next);
    try{
      let pid=viewingPlanId;
      if(pid){
        const raw=await window.storage.get(`plan:${pid}`).catch(()=>null);
        if(raw){
          const plan=JSON.parse(raw.value);
          plan.completedWeeks=next;
          await window.storage.set(`plan:${pid}`,JSON.stringify(plan));
          setSavedPlans(prev=>prev.map(p=>p.id===pid?{...p,completedWeeks:next}:p));
        }else{
          pid=null;
        }
      }
      if(!pid){
        const newId=await savePlan(result,{catId,industry:effectiveIndustry,journeyStage,notes:notesText,completedWeeks:next});
        if(newId)setViewingPlanId(newId);
      }
    }catch(e){
      console.error("Failed to persist week completion (non-fatal — session state still updated):",e.message);
    }
  }

  // Persists the mandatory-feedback unlock onto this specific saved strategy
  // record, so reopening it later restores PDF access instead of re-demanding
  // feedback. The unlock belongs to that one strategy — a new/different
  // strategy still gets its own fresh feedback requirement.
  async function persistFeedbackUnlock(){
    try{
      let pid=viewingPlanId;
      if(pid){
        const raw=await window.storage.get(`plan:${pid}`).catch(()=>null);
        if(raw){
          const plan=JSON.parse(raw.value);
          plan.feedbackSubmitted=true;plan.pdfUnlocked=true;
          await window.storage.set(`plan:${pid}`,JSON.stringify(plan));
          setSavedPlans(prev=>prev.map(p=>p.id===pid?{...p,feedbackSubmitted:true,pdfUnlocked:true}:p));
        }else{
          pid=null; // referenced record no longer exists — fall through and create a fresh one
        }
      }
      if(!pid){
        const newId=await savePlan(result,{catId,industry:effectiveIndustry,journeyStage,notes:notesText,feedbackSubmitted:true,pdfUnlocked:true});
        if(newId)setViewingPlanId(newId);
      }
    }catch(e){
      console.error("Failed to persist feedback/PDF unlock (non-fatal — session state still unlocked):",e.message);
    }
  }

  async function saveNotes(){
    setNotesSaveStatus('saving');
    try{
      let pid=viewingPlanId;
      if(pid){
        const raw=await window.storage.get(`plan:${pid}`).catch(()=>null);
        if(raw){
          const plan=JSON.parse(raw.value);
          plan.notes=notesText;
          await window.storage.set(`plan:${pid}`,JSON.stringify(plan));
          setSavedPlans(prev=>prev.map(p=>p.id===pid?{...p,notes:notesText}:p));
        }else{
          pid=null; // referenced record no longer exists — fall through and create a fresh one
        }
      }
      if(!pid){
        const newId=await savePlan(result,{catId,industry:effectiveIndustry,journeyStage,notes:notesText});
        if(newId)setViewingPlanId(newId);
        else throw new Error("savePlan returned no id");
      }
      setNotesSaveStatus('saved');
      setTimeout(()=>setNotesSaveStatus(null),2500);
    }catch(e){
      console.error("Notes save failed:",e.message);
      setNotesSaveStatus('error');
    }
  }

  async function generate(){
    if(!isSubscribed&&freeStrategyUsedRef.current){setPaywallContext('strategy');setShowPaywall(true);return;}
    const isNewFreeStrategyUse = !isSubscribed && !freeStrategyUsedRef.current;
    if(isNewFreeStrategyUse){
      freeStrategyUsedRef.current = true; // synchronous lock, before any await — closes the double-click race
    }
    setShowPaywall(false);setLoading(true);setError(null);go("loading");
    const qa=qs.map((q,i)=>{const a=answers[i];return`Q: ${q.q}\nA: ${Array.isArray(a)?a.join(", "):(a||"Not specified")}`;}).join("\n\n");

    const prompt=`You are a senior strategist delivering a concise, premium strategy report. Think McKinsey meets a trusted mentor. Every word earns its place. No filler. No generic advice. No sentences that could apply to anyone other than this exact person.

This is a GLOBAL instruction set — it must work equally well for every industry, focus area, career stage, business stage, budget level, and depth of input you might receive, not just the cases you've seen before. Do not lean on patterns from any specific example you may have encountered previously; reason fresh from what THIS person actually shared.

HANDLING INPUT DEPTH:
- If answers are brief or vague, do not pad with generic filler to sound complete. Work intelligently with what's there, avoid inventing specifics (names, numbers, tools, competitors) that were never mentioned, and where a reasonable assumption is needed, make it sound like a reasonable assumption rather than a fabricated fact.
- If answers are detailed and sophisticated, do not simply restate them back — synthesize and add real strategic value on top of what they already know.
- More context earns more personalization and specificity. Less context should never mean a worse-quality or lower-effort report — it means a report appropriately scoped to what's knowable.

MULTIFACETED USERS: Treat this strategy as its own independent context. Do not assume this person's focus area, industry, or identity based on any other strategy they may have built before — someone can be a corporate project manager, a creator, and an entrepreneur across different sessions, and each one deserves fresh, undiluted reasoning about only what's in front of you right now.

STRICT RULES — violating these fails the output:
1. CONCISE: The entire report must be readable in 6-8 minutes. If a section feels long, cut it in half.
2. SPECIFIC: Every sentence must be specific to this person's industry, stage, and actual answers. Test: could this sentence appear in a strategy for someone in a different industry? If yes, rewrite it.
3. NO AI VOICE: Write like a sharp human advisor. Not "It's important to..." or "Consider..." — say what to do and why.
4. THE INSIGHT: One sentence in Primary Challenge that is so precise it makes the person think "how did they know that." This is the sentence they screenshot.
5. COMPLETE ALL 8: A short complete report beats a long incomplete one. Finish all 8 sections even if brief.
6. NO FABRICATION: Never invent a specific statistic, competitor name, tool, dollar figure, or fact the person didn't provide. Reason with what's given.

Client Profile:
Name: ${firstName||"Not provided"}
Focus: ${cat?.label}
Industry: ${effectiveIndustry}
Stage: ${stageLabel}

What they shared:
${qa}

Write EXACTLY these 8 sections in this exact order. Use these headers verbatim.

# Strategic Assessment
2-3 sentences only. Open with one specific observation from their answers — name the actual detail. Then one strength, one gap.
Format:
[2-3 sentence observation]
**Strengths:** [one specific thing, tied to their answers]
**What needs attention:** [one specific gap, tied to their answers]

# Primary Challenge
Name the root issue as a bold header (4-6 words — make it sharp, not generic).
Then 2 sentences: (1) what it specifically is for this person, (2) the reframe — a new way of seeing it.
Then: The insight: [the one sentence that reframes everything — specific, earned, surprising]

# Strategic Opportunity
One sentence opener referencing their specific stage and industry.
Then 3 opportunities. Each gets a **Bold Title** and 1-2 sentences. Be specific to their situation.

# Recommended Actions
One sentence: where to direct energy.
5 numbered actions. Each: **Title** — [what to do specifically]. *Why this matters: [one sentence tied to their situation.]*
End with: **Set aside for now:** [one specific thing to stop doing or defer]

# 30-Day Priority Plan
All 4 weeks required. Maximum 6 words per task. Tasks must be concrete actions not vague goals.
Week 1 — Foundation: [Task] / [Task] / [Task] / [Task]
Week 2 — Momentum: [Task] / [Task] / [Task] / [Task]
Week 3 — Activation: [Task] / [Task] / [Task] / [Task]
Week 4 — Scale & Review: [Task] / [Task] / [Task] / [Task]

# Looking Ahead
One sentence opener. Then 3 forward-looking items. Each: **Bold Title** then 1-2 sentences specific to their trajectory.

# What Success Looks Like
Exactly 3 sentences. Make them concrete and measurable — not aspirational.
Sentence 1: a specific measurable outcome (number, timeline, metric)
Sentence 2: a relationship or reputation outcome
Sentence 3: an internal shift — how they will feel or think differently

# Your Next Move
Sentence 1: "Based on everything you have shared, the single most important action you should take today is [very specific action — not a category, an action]."
Sentence 2: Why this action creates more leverage than anything else right now — specific to their situation.
Sentence 3: What specifically changes in 2 weeks if they do this.`;

    const callAPI=async()=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),90000);
      try{
        const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt}),signal:controller.signal});
        clearTimeout(timeout);
        if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error||`API error ${res.status}`);}
        const data=await res.json();return data.text||"";
      }catch(e){clearTimeout(timeout);if(e.name==="AbortError")throw new Error("Generation timed out. Your answers are saved — please try again.");throw e;}
    };

    const isComplete=(p)=>{
      // A result is complete if it has meaningful content in the 4 most critical sections
      const critical=[p.yourNextMove,p.priorityPlan,p.strategicAssessment,p.primaryConstraint];
      const allDone=critical.every(s=>s&&s.trim().length>20);
      // Must have reasonable total length
      const fullText=Object.values(p).join(" ");
      const hasLength=fullText.length>400;
      // At least 5 of 8 sections must have content
      const filledSections=Object.values(p).filter(v=>v&&v.trim().length>10).length;
      const hasSections=filledSections>=4;
      return allDone&&hasLength&&hasSections;
    };

    try{
      // STEP 1: Generate
      let text="";
      try{text=await callAPI();}catch(apiErr){
        const msg=(apiErr.message||"").toLowerCase();
        if(msg.includes("abort")||msg.includes("timed out")){
          throw new Error("TIMEOUT: Strategy generation timed out. Your answers are saved — please try again.");
        }else if(msg.includes("401")||msg.includes("403")){
          throw new Error("AUTH: There was a connection issue with the API. Please try again in a moment.");
        }else{
          throw new Error("API: "+apiErr.message);
        }
      }

      // STEP 2: Parse
      let parsed;
      try{parsed=parseResult(text);}catch(parseErr){
        throw new Error("PARSE: Failed to parse strategy response. "+parseErr.message);
      }

      // STEP 3: Quality check — retry once if incomplete
      if(!isComplete(parsed)){
        try{
          const text2=await callAPI();
          const parsed2=parseResult(text2);
          if(isComplete(parsed2))parsed=parsed2;
          // If second attempt also fails isComplete, use whichever has more content
          else{
            const score1=Object.values(parsed).filter(v=>v&&v.length>10).length;
            const score2=Object.values(parsed2).filter(v=>v&&v.length>10).length;
            if(score2>score1)parsed=parsed2;
          }
        }catch(retryErr){
          // Retry failed — continue with first result if it has any content
          const hasAnyContent=Object.values(parsed).some(v=>v&&v.trim().length>20);
          if(!hasAnyContent)throw new Error("GENERATION: Both generation attempts returned empty results.");
        }
      }

      // STEP 4: Verify we have something to show
      const hasMinContent=parsed.yourNextMove||parsed.strategicAssessment||parsed.primaryConstraint;
      if(!hasMinContent){
        throw new Error("EMPTY: Strategy was generated but could not be parsed into sections. Raw length: "+text.length);
      }

      // STEP 5: Set result state FIRST — so user sees it even if save fails
      setResult(parsed);
      setViewingPlanId(null);

      // STEP 6: Save (non-blocking — if this fails, user still sees their strategy)
      let savedId=null;
      try{
        savedId=await savePlan(parsed,{catId,industry:effectiveIndustry,journeyStage});
        if(savedId)setViewingPlanId(savedId); // needed so saveNotes() can find this plan and attach notes to it
      }catch(saveErr){
        // Save failed — log it but don't block the user from seeing their strategy
        console.error("Strategy save failed (non-fatal):",saveErr.message);
      }

      // STEP 7: Navigate to results — always happens if we got here
      if(isNewFreeStrategyUse)await markFreeStrategyUsed();
      go("results");

    }catch(e){
      // Log the full technical error for debugging
      console.error("Strategy generation failed:",e.message,e.stack);
      if(isNewFreeStrategyUse)freeStrategyUsedRef.current=false; // release the lock — a failed attempt must never permanently cost the user their free use
      const msg=e.message||"";
      let userMsg="Something went wrong generating your strategy. Your answers are saved — please try again.";
      if(msg.includes("TIMEOUT:"))userMsg="Your strategy took longer than expected. Your answers are saved — please try again.";
      else if(msg.includes("AUTH:"))userMsg="There was a connection issue. Please check your internet and try again.";
      else if(msg.includes("API:"))userMsg="We couldn't reach the strategy service. Your answers are saved — please try again.";
      else if(msg.includes("EMPTY:")||msg.includes("PARSE:"))userMsg="Your strategy was generated but couldn't be displayed. Please try again — this usually resolves immediately.";
      setError(userMsg+" [Debug: "+msg+"]");
      go("questions");
    }finally{setLoading(false);}
  }

  async function askAdvisor(question){
    if(!question.trim())return;
    if(!isSubscribed&&freeAdvisorUsedRef.current){setPaywallContext('advisor');setShowPaywall(true);return;}
    const isNewFreeAdvisorUse = !isSubscribed && !freeAdvisorUsedRef.current;
    if(isNewFreeAdvisorUse){
      freeAdvisorUsedRef.current = true; // synchronous lock, before any await
    }
    setAdvisorLoading(true);setAdvisorResult(null);
    const context=savedPlans[0]?`Background only, may or may not be relevant: this person previously built a strategy involving ${CATEGORIES.find(c=>c.id===savedPlans[0].catId)?.label} work in ${savedPlans[0].industry} (${savedPlans[0].journeyStage} stage). Use this ONLY if their question below actually relates to it. If their question is about something else entirely, ignore this completely and follow the question wherever it leads — do not force a connection that isn't there.`:"";
    const prompt=`You are a trusted personal advisor with deep, genuine expertise across every domain of business and life — careers, finance, real estate, marketing, operations, law, health, relationships, parenting, creative work, technology, and more. You are warm, direct, and speak plainly, like a brilliant friend who happens to know everything — not like an AI assistant, and not like a narrow specialist.

SILENT REASONING (apply this internally — never show it in your response):
Before answering, determine what this person is actually trying to accomplish and what expertise their situation calls for. Adopt whichever expert lens — or blend of experts — the CURRENT question genuinely needs. A question about buying a home calls for a mortgage-and-credit lens. A question about a difficult employee calls for an HR-and-leadership lens. A question about opening a restaurant calls for an operations-and-hospitality lens. Let the question decide who you become each time — never stay anchored to a domain just because the person explored it before on this platform.

CRITICAL RULES:
1. FOLLOW THE CURRENT QUESTION, NOT PAST HISTORY. Any background context below is supporting color, never a constraint. If it doesn't fit, drop it entirely.
2. ONE CLEAR OPINION. Do not present multiple options and let them choose. Pick the best path and advocate for it.
3. NEVER ASSUME. Respond only to what they actually said about their actual situation.
4. BE DIRECT. Say what you think. "I think you should..." not "You might want to consider..."
5. FEEL HUMAN. Read like someone who knows this person, not a chatbot completing a template. No "expert advice" language, no claiming credentials you don't have.
6. SHORT ENOUGH TO READ. The whole response should take 60-90 seconds to read. Cut anything that doesn't add value.
7. NEVER CLAIM CERTAINTY YOU DON'T HAVE. Never invent facts, sources, statistics, dates, laws, prices, medical guidance, or policies. If not certain of a figure or claim, say so plainly. For medical, legal, financial, or safety-sensitive questions, give real, useful guidance but be clear when something needs professional verification.

${firstName?`The person's name is ${firstName}. Use it once naturally.`:""} ${context}

Their question or situation: ${question}

Respond with ONLY a single valid JSON object. No markdown code fences, no commentary before or after, no text outside the JSON, and no markdown syntax (no **, no #, no numbered-list dots) anywhere inside the string values — write plain sentences. Use exactly this shape:

{
  "hearing": "1-3 sentences reflecting their situation back to them, so they feel understood before any advice",
  "recommendations": [
    {"title": "short, specific recommendation title, a few words", "explanation": "1-3 short sentences explaining this recommendation and why it's right for their situation"}
  ],
  "meaning": "1-3 short sentences translating the recommendations into what this specifically means for THEIR situation right now — do not repeat the recommendations, connect them to something the person mentioned",
  "nextMove": "one concrete, specific action they can take in the next 24 hours — not a category, an actual action"
}

"recommendations" should have between 1 and 5 items depending on what the question actually calls for — a simple tactical question may only need 1-2, a complex strategic question may need 3-5. Never pad with filler recommendations just to fill the array.`;

    try{
      const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      if(!res.ok){const errBody=await res.json().catch(()=>({}));throw new Error(`API ${res.status}: ${errBody.error||errBody.code||"Unknown error"}`);}
      const data=await res.json();
      const raw=(data.text||"").trim();
      const jsonMatch=raw.match(/\{[\s\S]*\}/); // tolerate stray text/fences around the object
      if(!jsonMatch)throw new Error("No JSON object found in response");
      const advice=JSON.parse(jsonMatch[0]);
      if(!advice.hearing||!Array.isArray(advice.recommendations)||!advice.recommendations.length)throw new Error("Response missing required advisor fields");

      const parsed={
        hearing:advice.hearing,
        recommendations:advice.recommendations,
        meaning:advice.meaning,
        nextMove:advice.nextMove,
        question,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      };
      setAdvisorResult(parsed);
      if(isNewFreeAdvisorUse)await markFreeAdvisorUsed();
      const newHistory=[parsed,...advisorHistory].slice(0,10);
      setAdvisorHistory(newHistory);
      try{localStorage.setItem("advisor-history",JSON.stringify(newHistory));}catch(e){}
    }catch(e){
      console.error("[askAdvisor] failed:",e.message);
      if(isNewFreeAdvisorUse)freeAdvisorUsedRef.current=false; // release the lock — a failed attempt must never permanently cost the user their free use
      setAdvisorResult({error:`We hit a snag: ${e.message}. Your question is saved — try again when you're ready.`,question,date:""});
    }
    finally{setAdvisorLoading(false);}
  }

  async function askHubSearch(query){
    if(!query.trim())return;
    setHubSearchLoading(true);setHubSearchResult(null);
    const context=savedPlans[0]?`Background only, may or may not be relevant: this person has explored ${CATEGORIES.find(c=>c.id===savedPlans[0].catId)?.label} work in ${savedPlans[0].industry} on this platform before. Use this only if their question below actually relates to it — otherwise ignore it completely.`:"";
    const prompt=`You are a universal knowledge engine and expert teacher. There is no topic you decline — from a simple fact, to a definition, to a deep framework, to a step-by-step how-to, across any domain of business, finance, careers, creativity, technology, health, or everyday life. The person should never wonder whether they're "allowed" to ask something here. If they can think of the question, you answer it, at whatever depth it deserves.

UNCERTAINTY AND HIGH-STAKES SAFEGUARDS:
Never invent facts, sources, statistics, dates, laws, prices, medical guidance, or policies. If you're not certain of a specific figure or claim, say so plainly rather than presenting a guess as fact. Distinguish general educational information from professional advice — for medical, legal, financial, or safety-sensitive topics, be clear when something requires a professional's verification rather than presenting it as settled. If responsible guidance depends on missing context, ask for it. If something may be outdated or needs a current source, say so briefly. Never fabricate a specific link, citation, organization, or program. Keep this calm and proportionate to the topic — a normal aside, never a disclaimer wall.

${firstName?`This is for ${firstName}.`:""} ${context}

Request: ${query}

SILENT REASONING (apply internally, never show it):
First, determine what kind of request this actually is — a quick fact, a definition, a how-to, a strategic framework, a comparison, or a creative deliverable like an email or calendar — and what depth genuinely serves it. A request for "what is 2+2" deserves a one-line answer, not a six-section teaching breakdown. A request to "teach me commercial real estate" deserves real depth. Match the response to the actual request, not to a template.

HOW TO RESPOND:
Write a genuinely educational, specific answer — like a senior expert with real experience in exactly this topic, not a generic summary. Where it truly adds value for the person's understanding, naturally include any of the following that fit (skip any that don't apply — never force a section that adds nothing):

**Direct Answer**
The core answer or explanation itself, clear and complete.

**Why It Matters**
Why this is relevant or useful to understand.

**Practical Example**
A concrete, real-world example that makes it click.

**Common Mistakes**
Common misunderstandings or errors people make with this — as a short list, only if genuinely useful.

**Related Concepts**
One or two closely related ideas worth knowing — only if it deepens understanding.

**Next Steps**
A short list of concrete next actions, only for how-to or strategic requests where action is the point.

For a simple factual question, "Direct Answer" alone is a complete, correct response — do not pad it with unnecessary sections.`;

    const HUB_SECTIONS=[
      {key:"direct",aliases:["Direct Answer"]},
      {key:"why",aliases:["Why It Matters"]},
      {key:"example",aliases:["Practical Example"]},
      {key:"mistakes",aliases:["Common Mistakes"]},
      {key:"related",aliases:["Related Concepts"]},
      {key:"steps",aliases:["Next Steps"]},
    ];

    try{
      const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      if(!res.ok){const errBody=await res.json().catch(()=>({}));throw new Error(`API ${res.status}: ${errBody.error||errBody.code||"Unknown error"}`);}
      const data=await res.json();
      const text=data.text||"";
      const {sections,fullyFailed}=parseAISections(text,HUB_SECTIONS);
      const hasStructured=Object.values(sections).some(v=>v);
      if(fullyFailed){
        setHubSearchResult({query,error:"We got a response back but couldn't format it properly. Please try again."});
        return;
      }
      setHubSearchResult({
        query,
        isPlaybook: hasStructured,
        rawText: !hasStructured ? text.replace(/\*\*/g,"").trim() : "",
        direct:sections.direct,
        why:sections.why,
        example:sections.example,
        mistakes:lines(sections.mistakes).map(l=>l.replace(/^\d+\.\s*/,"").replace(/^[-•]\s*/,"").trim()).filter(Boolean),
        related:sections.related,
        steps:lines(sections.steps).map(l=>l.replace(/^\d+\.\s*/,"").replace(/^[-•]\s*/,"").trim()).filter(Boolean),
      });
    }catch(e){console.error("[askHubSearch] failed:",e.message);setHubSearchResult({query,error:`We hit a snag: ${e.message}`});}
    finally{setHubSearchLoading(false);}
  }

  // ─── INDUSTRY RESOURCE HUB — LEARNING GUIDE GENERATION ────────────────────
  // Dedicated educational engine, separate from Create My Strategy and Ask
  // Your Advisor. No questionnaire — the topic's own curated metadata is
  // enough context. Requests ONE structured JSON object (never free prose),
  // which is what actually fixes the raw-markdown-leak bug at the root: there
  // is no markdown in a JSON string field, so there's nothing to leak.
  // Cached per topic (via window.storage) since these are predetermined,
  // identical-for-everyone lessons — a repeat visit to the same topic, or
  // clicking a Related Learning link back to something already opened this
  // session, loads instantly instead of re-generating.
  async function askLearningGuide(topic, category){
    // Duplicate-call guard: ignore rapid re-clicks/re-taps on a topic while
    // its own generation is already in flight — a ref because, same as the
    // entitlement locks, hubGuideLoading (state) isn't guaranteed to have
    // committed yet by the time a second click fires.
    if(hubGenerationInFlightRef.current)return;

    // Entitlement gate: free tier gets ONE topic. Revisiting that same topic,
    // or one already marked completed, never re-consumes it. Uses the ref
    // (not the state) for the check-and-lock so two topics clicked in quick
    // succession can't both slip through before state catches up.
    const alreadyAllowed = isSubscribed || !freeHubUsedRef.current || topic.id===freeHubTopicId || hubCompletedIds.includes(topic.id);
    if(!alreadyAllowed){
      setHubTopicId(null);setHubGuide(null);
      setPaywallContext('hub');setShowPaywall(true);
      return;
    }
    const isNewFreeUse = !isSubscribed && !freeHubUsedRef.current;
    if(isNewFreeUse){
      freeHubUsedRef.current = true; // synchronous lock, set before any await below
    }

    hubGenerationInFlightRef.current = true;
    setHubGuideLoading(true);setHubGuide(null);
    setHubStep(0);setHubQuickAnswer(null);setHubQuickSubmitted(false);setHubExpandedTerm(null);

    const cacheKey=`learning-guide:${topic.id}`;
    try{
      const cached=await window.storage.get(cacheKey,true).catch(()=>window.storage.get(cacheKey,false));
      if(cached&&cached.value){
        const parsed=JSON.parse(cached.value);
        setHubGuide({topic,category,...parsed});
        setHubGuideLoading(false);
        hubGenerationInFlightRef.current=false;
        if(isNewFreeUse)await markFreeHubUsed(topic.id);
        return;
      }
    }catch(e){/* no cached lesson yet — fall through to generation */}

    const prompt=`You are the educational engine for the Your Next Move Industry Resource Hub. Your role is to teach people about professional and industry topics clearly, accurately, and practically — never a personalized strategy, never single-opinion advice. Just teach.

Category: ${category.label}
Learning Topic: ${topic.title}
Level: ${topic.level}
What this topic covers: ${topic.shortDescription}
Learning objective: ${topic.learningObjective}

GUARDRAILS:
- Distinguish general education from regulated or professional advice.
- Never fabricate statistics, laws, regulations, certifications, or requirements.
- Never invent citations, sources, or named books.
- Acknowledge when requirements vary by state, country, employer, regulator, or institution — briefly, not as a wall of disclaimers.
- Clearly frame examples as illustrative, not universal fact.
- Never promise financial, health, legal, career, or business outcomes.

WRITING STYLE: Plain English. Short sentences. No jargon unless you define it. No academic tone, no essay voice, no AI-sounding filler ("It's important to note that..."). Write like a smart, approachable teacher explaining something to a curious adult who has five minutes, not a textbook. Match depth to the ${topic.level} level — foundational stays accessible, advanced can use real professional vocabulary.

QUICK CHECK ACCURACY IS CRITICAL: the question must test a concept explicitly covered in the lesson content you write above it — never something outside the lesson. Exactly one option may be correct; the other three must be clearly, unambiguously wrong to anyone who understood the lesson. Never write a trick question, an opinion-based question, or a question with more than one reasonably defensible answer. Never invent a statistic, law, or rule to make a wrong option wrong — base correctness only on the concept itself. If the topic touches anything that varies by jurisdiction, employer, or time (tax rules, licensing, regulations), keep the question about the durable underlying concept rather than a fact that could be wrong somewhere or someday.

Respond with ONLY a single valid JSON object. No markdown code fences, no commentary before or after, no text outside the JSON. Use exactly this shape:

{
  "basics": {
    "explanation": "2-3 plain-English sentences on what this is",
    "whyItMatters": "1-2 sentences on why it matters",
    "analogy": "one short memorable analogy or plain comparison, or empty string if none fits naturally",
    "keyTakeaway": "one short memorable sentence"
  },
  "howItWorks": [
    {"title": "short step or component name", "explanation": "1-2 sentences"}
  ],
  "example": {
    "scenario": "a short, concrete, realistic example or mini scenario, clearly illustrative",
    "lesson": "1 sentence connecting the example back to the concept"
  },
  "rememberThis": {
    "takeaways": ["short memorable sentence", "short memorable sentence", "short memorable sentence"],
    "terms": [{"term": "word or phrase", "definition": "one plain-English sentence"}]
  },
  "goDeeper": ["related concept or search term", "related concept or search term", "related concept or search term"],
  "quickCheck": {
    "question": "one scenario-based multiple choice question testing what was just taught",
    "options": ["option A", "option B", "option C", "option D"],
    "correctIndex": 0,
    "correctExplanation": "1-3 sentences explaining why this answer is correct, tied directly to the lesson content above",
    "incorrectExplanation": "1-2 sentences describing the most common misunderstanding that leads someone to pick a wrong answer here"
  }
}

"howItWorks" should have 3-6 items. "rememberThis.takeaways" should have 3-5 items. "rememberThis.terms" should have 2-5 items if the topic has real vocabulary worth naming, or an empty array if not. "goDeeper" should have 3-5 items. "quickCheck.correctIndex" is a 0-based index into "options".`;

    try{
      const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      if(!res.ok){const errBody=await res.json().catch(()=>({}));throw new Error(`API ${res.status}: ${errBody.error||errBody.code||"Unknown error"}`);}
      const data=await res.json();
      const raw=(data.text||"").trim();
      const jsonMatch=raw.match(/\{[\s\S]*\}/); // tolerate stray text/fences around the object
      if(!jsonMatch)throw new Error("No JSON object found in response");
      const lesson=JSON.parse(jsonMatch[0]);
      if(!lesson.basics||!lesson.howItWorks||!lesson.quickCheck)throw new Error("Response missing required lesson fields");

      setHubGuide({topic,category,...lesson});
      if(isNewFreeUse)await markFreeHubUsed(topic.id);
      try{await window.storage.set(cacheKey,JSON.stringify(lesson),true);}
      catch(e){try{await window.storage.set(cacheKey,JSON.stringify(lesson),false);}catch(e2){/* caching is a nice-to-have, never block the lesson on it */}}
    }catch(e){
      console.error("[askLearningGuide] failed:",e.message);
      // Per product spec: never expose technical errors here — polished, generic, recoverable.
      setHubGuide({topic,category,error:"We couldn't load this lesson. Please try again."});
    }finally{setHubGuideLoading(false);hubGenerationInFlightRef.current=false;}
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  const hubCat = LEARNING_HUB.find(c=>c.id===hubCatId);
  const filteredTopics = hubCat?.topics.filter(t=>
    !hubSearch||t.title.toLowerCase().includes(hubSearch.toLowerCase())||t.shortDescription.toLowerCase().includes(hubSearch.toLowerCase())
  )||[];
  const topicsByLevel = level => filteredTopics.filter(t=>t.level===level);
  const activeHubTopic = hubTopicId ? findLearningTopic(hubTopicId) : null;
  const HUB_LESSON_STEPS=["The Basics","How It Works","See It In Real Life","Remember This","Quick Check"];

  return(<>
    <style>{CSS}</style>

    {/* NAV */}
    <nav className="nav">
      <div className="nav-brand" onClick={restart}>
        <span className="nav-name">Your Next Move</span>
      </div>
      {screen!=="loading"&&(<>
        {/* Desktop nav */}
        <div className="nav-actions">
          {isSubscribed&&<span className="sub-badge"><span className="sub-dot"/>Member</span>}
          <button className="nav-link" onClick={()=>go("advisor")}>Ask Your Advisor</button>
          <button className="nav-link" onClick={()=>go("hub")}>Industry Hub</button>
          <button className="nav-link" onClick={()=>go("plans")}>
            My Strategies{savedPlans.length>0&&<span className="nav-badge">{savedPlans.length}</span>}
          </button>
          {savedPlans.length>0&&<button className="nav-btn" onClick={restart}>New Strategy</button>}
        </div>
        {/* Mobile hamburger */}
        <button className="hamburger" onClick={()=>setMobileMenuOpen(o=>!o)} aria-label="Menu">
          <span style={{transform:mobileMenuOpen?"rotate(45deg) translate(5px,5px)":"none"}}/>
          <span style={{opacity:mobileMenuOpen?0:1}}/>
          <span style={{transform:mobileMenuOpen?"rotate(-45deg) translate(5px,-5px)":"none"}}/>
        </button>
      </>)}
    </nav>
    {/* Mobile slide-out menu */}
    <div className={`mobile-menu${mobileMenuOpen?" open":""}`}>
      <button className="mobile-menu-link" onClick={()=>go("home")}>Home <span>→</span></button>
      <button className="mobile-menu-link" onClick={()=>go("advisor")}>Ask Your Advisor <span>→</span></button>
      <button className="mobile-menu-link" onClick={()=>go("hub")}>Industry Hub <span>→</span></button>
      <button className="mobile-menu-link" onClick={()=>go("plans")}>
        My Strategies{savedPlans.length>0&&<span className="nav-badge" style={{marginLeft:8}}>{savedPlans.length}</span>} <span>→</span>
      </button>
      {savedPlans.length>0&&<button className="mobile-menu-link" onClick={restart}>New Strategy <span>→</span></button>}
      <button className="mobile-menu-cta" onClick={()=>{setMobileMenuOpen(false);go("welcome");}}>
        Create My Strategy →
      </button>
    </div>

        {/* ══ HOME ══ */}
    {screen==="home"&&<>

      {/* HERO — one job: get them to click */}
      <section className="hero">
        {savedPlans.length>0&&firstName?(<>
          <span className="hero-eye">Welcome back</span>
          <h1 className="hero-h1">{firstName}<em>.</em></h1>
          <p className="hero-sub">Your last strategy was {Math.floor((Date.now()-(savedPlans[0]?.createdAt||Date.now()))/(1000*60*60*24))} days ago. Ready to build what's next?</p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="hero-cta" onClick={()=>go("welcome")}>New Strategy <span className="hero-arr">→</span></button>
            <button className="btn-out" style={{padding:"13px 24px",fontSize:11}} onClick={()=>go("plans")}>Review My Strategies</button>
          </div>
        </>):(<>
          <span className="hero-eye">Your Next Move Starts Here</span>
          <h1 className="hero-h1">Clarity.<br/><em>Confidence.</em><br/>Action.</h1>
          <p className="hero-sub">Whether you're growing your career, building a business, changing industries, or planning what's next — Your Next Move helps you create a clear plan, get trusted guidance, and move forward with confidence.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:14}}>
            <button className="hero-cta" onClick={()=>go("welcome")}>
              Start Your Free Strategy <span className="hero-arr">→</span>
            </button>
            <button className="btn-out" style={{padding:"14px 24px",fontSize:11}} onClick={()=>{const el=document.querySelector(".cats");if(el)el.scrollIntoView({behavior:"smooth"});}}>See How It Works</button>
          </div>
          <p style={{fontSize:12,color:"#A8A29E"}}>First strategy free · Then $19.99/month · Cancel anytime</p>
        </>)}
      </section>

      {/* WHAT THIS IS — three cards explaining the product */}
      {savedPlans.length===0&&(
        <section style={{padding:"0 32px 64px",maxWidth:1080,margin:"0 auto",width:"100%"}}>
          <div className="feature-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,borderTop:"1px solid #F0EDEB"}}>
            {[
              {
                num:"01",
                title:"Create My Strategy",
                desc:"Answer a few questions about your goals and situation. Receive a personalized strategic roadmap built specifically around your opportunities, challenges, and next steps.",
                cta:"Start here →",
                action:()=>go("welcome"),
                accent:true
              },
              {
                num:"02",
                title:"Ask Your Advisor",
                desc:"Need help making a decision? Describe your situation and receive direct, thoughtful guidance tailored to what you're working on today.",
                cta:"Ask a question →",
                action:()=>go("advisor"),
                accent:false
              },
              {
                num:"03",
                title:"Industry Hub",
                desc:"Browse professionally curated prompts designed for your field. Real Estate, Finance, Healthcare, Creative, and more — each with expert prompts written specifically for that profession.",
                cta:"Explore your field →",
                action:()=>go("hub"),
                accent:false
              }
            ].map(c=>(
              <div key={c.num} onClick={c.action} style={{
                padding:"36px 28px",
                background:c.accent?"#1A1916":"#FAFAF8",
                cursor:"pointer",
                transition:"all 0.2s",
                borderRight:"1px solid #EEEAE7",
                display:"flex",
                flexDirection:"column",
                gap:0,
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=c.accent?"#2A2420":"#fff";}}
              onMouseLeave={e=>{e.currentTarget.style.background=c.accent?"#1A1916":"#FAFAF8";}}
              >
                <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.22em",textTransform:"uppercase",color:c.accent?"#5A5350":"#C4B5AD",marginBottom:16}}>{c.num==="01"?"PLAN":c.num==="02"?"GUIDE":"LEARN"}</div>
                <div style={{fontFamily:"'Cormorant',serif",fontSize:26,fontWeight:600,color:c.accent?"#fff":"#1C1917",marginBottom:12,lineHeight:1.2,letterSpacing:"-0.01em"}}>{c.title}</div>
                <div style={{fontSize:13,color:c.accent?"#8A7E78":"#78716C",fontWeight:300,lineHeight:1.7,flex:1,marginBottom:24}}>{c.desc}</div>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:c.accent?"#C4A0B0":"#B0728A"}}>{c.cta}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOCUS AREAS */}
      <section className="cats">
        {/* SAMPLE STRATEGY PREVIEW */}
        {savedPlans.length===0&&(
          <div style={{background:"#1A1916",borderRadius:8,padding:"32px 36px",marginBottom:44,position:"relative",overflow:"hidden"}}>
            <p style={{fontSize:10,fontWeight:600,letterSpacing:"0.32em",textTransform:"uppercase",color:"#C4A0B0",marginBottom:12}}>Sample Strategy Output</p>
            <h3 style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(20px,3vw,28px)",fontWeight:600,color:"#fff",marginBottom:10,letterSpacing:"-0.01em",lineHeight:1.2}}>See what your personalized strategy reveals.</h3>
            <p style={{fontSize:13,color:"#8A7E78",fontWeight:300,lineHeight:1.7,marginBottom:24,maxWidth:520}}>Your answers become a personalized strategy designed to help you understand your situation, identify what matters most, and confidently move forward.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,marginBottom:20}}>
              {[
                {num:"01",label:"Strategic Assessment",preview:"Understand where you stand today. Gain a clear picture of your current situation, what's working, and what deserves your attention first."},
                {num:"02",label:"Primary Challenge",preview:"Reveal what's standing in your way. Identify the underlying challenge creating the most friction, so every next decision becomes clearer."},
                {num:"03",label:"Best Opportunity",preview:"Discover your strongest opportunity. See where your time, energy, and attention are most likely to create meaningful progress."},
                {num:"04",label:"Recommended Actions",preview:"Know what to focus on first. Receive thoughtful priorities that help you move forward with confidence instead of uncertainty."},
                {num:"05",label:"30-Day Plan",preview:"Turn your strategy into progress. Follow a practical week-by-week roadmap designed to help you build momentum one step at a time."},
                {num:"06",label:"Your Next Move",preview:"Leave knowing where to begin. Walk away with one clear next step that brings your entire strategy into focus."},
              ].map((s,i)=>(
                <div key={i} style={{background:"#201918",padding:"16px 18px",border:"1px solid #2A2522"}}>
                  <p style={{fontSize:10,fontWeight:600,letterSpacing:"0.2em",textTransform:"uppercase",color:"#5A4A42",marginBottom:6}}>{s.num}</p>
                  <p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:600,color:"#C4A0B0",marginBottom:6,lineHeight:1.2}}>{s.label}</p>
                  <p style={{fontSize:12,color:"#6A6060",lineHeight:1.6,fontWeight:300}}>{s.preview}</p>
                </div>
              ))}
            </div>
            <p style={{fontSize:12,color:"#5A5350",fontStyle:"italic"}}>Every strategy is built around your unique goals, circumstances, and next move — not generated from a generic template.</p>
          </div>
        )}
        <div className="cats-top">
          <h2 className="cats-h2">Where would you like to <em>focus?</em></h2>
          <p className="cats-sub">Choose a focus area to begin your personalized strategy session.</p>
        </div>
        <div className="cats-row1">
          {CATEGORIES.slice(0,3).map(c=>(
            <div key={c.id} className="cat-card" style={{"--acc":c.accent}} onClick={()=>pickCat(c.id)}>
              <div className="cat-top">
                <span className="cat-num">{c.num}</span>
                {c.rec&&<span className="cat-rec">Most popular</span>}
              </div>
              <div className="cat-label">{c.label}</div>
              <div className="cat-tag">{c.tagline}</div>
              <div className="cat-detail">{c.detail}</div>
              <div className="cat-go">Begin →</div>
            </div>
          ))}
        </div>
        <div className="cats-row2">
          {CATEGORIES.slice(3,5).map(c=>(
            <div key={c.id} className="cat-card" style={{"--acc":c.accent}} onClick={()=>pickCat(c.id)}>
              <div className="cat-top"><span className="cat-num">{c.num}</span></div>
              <div className="cat-label">{c.label}</div>
              <div className="cat-tag">{c.tagline}</div>
              <div className="cat-detail">{c.detail}</div>
              <div className="cat-go">Begin →</div>
            </div>
          ))}
        </div>
      </section>
    </>}

        {/* ══ WELCOME ══ */}
    {screen==="welcome"&&(
      <div className="welcome">
        <div className="welcome-rule"/>
        <span className="welcome-eye">Your Next Move</span>
        <h1 className="welcome-h">Let's build your<br/><em>personalized strategy.</em></h1>
        <p className="welcome-sub">Answer a few questions about your situation and receive a strategy built specifically for you — your industry, your goals, your next move.</p>

        <div style={{width:"100%",maxWidth:360,margin:"0 auto 12px"}}>
          <span className="welcome-name-label">Your first name</span>
          <input
            className="welcome-name-input"
            placeholder="e.g. Sarah"
            value={firstName}
            onChange={e=>setFirstName(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{width:"100%",maxWidth:360,margin:"0 auto 28px"}}>
          <span className="welcome-name-label">Your email <span style={{color:"#C4B5AD",fontWeight:300}}>(optional — keep a copy for yourself)</span></span>
          <input
            className="welcome-name-input"
            placeholder="e.g. sarah@email.com"
            type="email"
            value={welcomeEmail}
            onChange={e=>setWelcomeEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&completeOnboarding(firstName)}
          />
        </div>

        <div className="welcome-steps">
          {[
            {n:"01",t:<>Choose a <strong>focus area</strong> and your <strong>industry</strong></>},
            {n:"02",t:<>Answer <strong>4–5 targeted questions</strong> about your situation</>},
            {n:"03",t:<>Receive your <strong>personalized 8-section strategy</strong></>},
          ].map(s=>(
            <div className="welcome-step" key={s.n}>
              <span className="welcome-step-num">{s.n}</span>
              <span className="welcome-step-text">{s.t}</span>
            </div>
          ))}
        </div>

        <p className="welcome-time">Takes about 5 minutes · Free to start · No credit card needed</p>
        <button
          className="btn"
          style={{padding:"16px 52px",fontSize:12}}
          onClick={()=>completeOnboarding(firstName)}
          disabled={!firstName.trim()}
        >
          Let's begin →
        </button>
        {!firstName.trim()&&<p style={{fontSize:11,color:"#C4B5AD",marginTop:10}}>Enter your first name to continue</p>}
      </div>
    )}

    {/* ══ INDUSTRY ══ */}
    {screen==="industry"&&(
      <div className="page">
        <div className="bc"><span onClick={restart}>Home</span><span className="bc-sep">›</span><span style={{color:"#1A1916",fontWeight:500}}>{cat?.label||"Strategy"}</span></div>
        <h1 className="pg-h1">What field are you in?</h1>
        <p className="pg-sub">Your strategy will be built for your specific industry — not generic advice.</p>
        <div className="igrid">
          {INDUSTRIES.map(ind=>(
            <button key={ind} className={`ipill${industry===ind?" on":""}`} onClick={()=>{setIndustry(ind);setCustomInd("");}}>
              {ind}
            </button>
          ))}
        </div>
        {industry==="Other"&&(
          <div className="custom-ind-wrap">
            <span className="custom-ind-label">Tell us your specific field</span>
            <input className="custom-ind-input" placeholder="e.g. Interior Design, Event Planning…" value={customInd} onChange={e=>setCustomInd(e.target.value)} autoFocus/>
          </div>
        )}
        <div className="brow">
          <button className="btn-out" onClick={()=>go("home")}>← Back</button>
          <button className="btn" disabled={!industry||(industry==="Other"&&!customInd.trim())} onClick={()=>go("stage")}>Continue →</button>
        </div>
      </div>
    )}

    {/* ══ STAGE ══ */}
    {screen==="stage"&&(
      <div className="page">
        <div className="bc"><span onClick={restart}>Home</span><span className="bc-sep">›</span><span onClick={()=>go("industry")}>{cat?.label}</span><span className="bc-sep">›</span><span>{effectiveIndustry}</span></div>
        <h1 className="pg-h1">Where are you right now?</h1>
        <p className="pg-sub">Be honest. The more accurately you choose, the more specific your strategy will be.</p>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:28}}>
          {STAGES.map(s=>(
            <button key={s.id} className={`stage-btn${journeyStage===s.id?" on":""}`} onClick={()=>setJourneyStage(s.id)}>
              <div className="stage-label">{s.label}</div>
              <div className="stage-sub">{s.sub}</div>
            </button>
          ))}
        </div>
        <div className="brow">
          <button className="btn-out" onClick={()=>go("industry")}>← Back</button>
          <button className="btn" disabled={!journeyStage} onClick={()=>{setQIdx(0);setAnswers({});go("questions");}}>Continue →</button>
        </div>
      </div>
    )}

    {/* ══ QUESTIONS ══ */}
    {screen==="questions"&&curQ&&(
      <div className="page">
        <div className="bc"><span onClick={restart}>Home</span><span className="bc-sep">›</span><span onClick={()=>go("industry")}>{cat?.label}</span><span className="bc-sep">›</span><span>{effectiveIndustry}</span></div>
        <div className="prog">
          <div className="prog-bars">{qs.map((_,i)=><div key={i} className={`prog-bar${i<qIdx?" done":i===qIdx?" active":""}`}/>)}</div>
          <span className="prog-label">Your strategy is taking shape — {qIdx+1} of {qs.length}</span>
        </div>
        {error&&(
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",padding:"18px 20px",borderRadius:6,marginBottom:20}}>
            <p style={{fontSize:14,color:"#7F1D1D",lineHeight:1.6,marginBottom:12}}>⚠ {error}</p>
            <p style={{fontSize:12,color:"#B91C1C",marginBottom:14,fontWeight:300}}>Your answers are saved. You can retry without re-entering anything.</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn" style={{padding:"10px 20px",fontSize:11}} onClick={()=>{setError(null);generate();}}>Retry Strategy Generation</button>
              <button className="btn-out" style={{padding:"10px 20px",fontSize:11}} onClick={()=>{setError(null);}}>Return to My Answers</button>
              <button className="btn-out" style={{padding:"10px 20px",fontSize:11}} onClick={()=>go("plans")}>View My Strategies</button>
            </div>
          </div>
        )}
        <div className="q-shell" key={qIdx}>
          <div className="q-in">
            <div className="q-eye">{["About you","Your situation","What's in the way","Your goals","One more thing"][Math.min(qIdx,4)]}</div>
            <p className="q-text">{curQ.q}</p>
            {(curQ.hint||curQ.example)&&(
              <div className="q-hint-block">
                {curQ.hint&&<><div className="q-hint-label">You can include</div><div className="q-hint-text">{curQ.hint}</div></>}
                {curQ.example&&<div className="q-hint-example">{curQ.example}</div>}
              </div>
            )}
            {curQ.type==="pills-multi"&&<p className="q-multi-hint">Select all that apply</p>}
            {curQ.type==="text"?(
              <>
                <textarea className="q-ta" rows={4} placeholder="Be specific — the more detail you share, the more personalized your strategy will be." value={answers[qIdx]||""} onChange={e=>{setAnswers(p=>({...p,[qIdx]:e.target.value}));setShortWarn(false);}} autoFocus/>
                <p className="q-specific">The more specific you are, the more specific your plan will be.</p>
                <p className={`q-short-warn${shortWarn?" show":""}`}>Add a little more detail so we can make your strategy useful.</p>
              </>
            ):(
              <div className="pills">
                {curQ.options.map(opt=>{
                  const multi=curQ.type==="pills-multi";
                  const on=multi?(Array.isArray(answers[qIdx])&&answers[qIdx].includes(opt)):answers[qIdx]===opt;
                  return(
                    <button key={opt} className={`qp${on?" on":""}`} onClick={()=>togglePill(opt,multi)}>
                      <span className="qp-dot"/>{opt}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="q-nav">
              <button className="q-back" onClick={()=>{if(qIdx>0)setQIdx(q=>q-1);else go("stage");}}>← {qIdx===0?"Back":"Previous"}</button>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span className={`q-autosave${autoSaved?" show":""}`}>✓ Saved</span>
                <button className="btn" disabled={!answered(qIdx)||loading} onClick={nextQ}>{qIdx<qs.length-1?"Next →":"Build My Strategy →"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ══ INDUSTRY HUB ══ */}
    {screen==="hub"&&!hubCatId&&(
      <div className="hub-page">
        <div className="bc"><span onClick={restart}>Home</span></div>
        <h1 className="hub-h1">Industry <em>Hub.</em></h1>
        <p className="hub-sub">Explore practical learning topics designed to help you understand your industry, strengthen your skills, and keep growing — from foundational concepts to advanced strategy.</p>
        {/* Global search on landing page too */}
        <div style={{marginBottom:32}}>
          <div style={{position:"relative",display:"flex",gap:0}}>
            <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#C4B5AD",fontSize:15,zIndex:1}}>⌕</div>
            <input
              className="hub-search"
              style={{marginBottom:0,paddingLeft:44,paddingRight:120,borderRadius:"6px 0 0 6px",flex:1}}
              placeholder="Search learning topics or ask any question…"
              value={hubSearchQuery}
              onChange={e=>{setHubSearchQuery(e.target.value);setHubSearchResult(null);}}
              onKeyDown={e=>{if(e.key==="Enter"&&hubSearchQuery.trim())askHubSearch(hubSearchQuery);}}
            />
            <button
              onClick={()=>{if(hubSearchQuery.trim())askHubSearch(hubSearchQuery);}}
              disabled={hubSearchLoading||!hubSearchQuery.trim()}
              style={{padding:"0 20px",background:"#1A1916",color:"#fff",border:"none",borderRadius:"0 6px 6px 0",fontSize:11,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Plus Jakarta Sans',sans-serif"}}
            >{hubSearchLoading?"Searching…":"Ask →"}</button>
          </div>
          <p style={{fontSize:12,color:"#A8A29E",marginTop:7,fontStyle:"italic"}}>Browse the learning library below, or press Ask → for an instant answer to any question</p>
        </div>
        {hubSearchLoading&&<div style={{textAlign:"center",padding:"32px 0"}}><div className="load-ring" style={{margin:"0 auto 14px"}}/><p style={{fontSize:13,color:"#78716C"}}>Finding your answer…</p></div>}
        {hubSearchResult&&!hubSearchResult.error&&(
          <div style={{marginBottom:28,border:"1px solid #EEEAE7",borderRadius:6,overflow:"hidden"}}>
            <div style={{background:"#1A1916",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><p style={{fontSize:9,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#C4A0B0",marginBottom:4}}>Expert Response</p><p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:500,color:"#fff"}}>"{hubSearchResult.query}"</p></div>
              <button onClick={()=>{setHubSearchResult(null);setHubSearchQuery("");}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:100,padding:"5px 14px",color:"#A8A29E",fontSize:10,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Clear</button>
            </div>
            {hubSearchResult.direct&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FAFAF8"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Direct Answer</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.direct}</p></div>}
            {hubSearchResult.why&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Why It Matters</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.why}</p></div>}
            {hubSearchResult.example&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FAFAF8"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Practical Example</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.example}</p></div>}
            {hubSearchResult.mistakes?.length>0&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FEF9F6"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#B8936A",marginBottom:12}}>Common Mistakes</p><div style={{display:"flex",flexDirection:"column",gap:8}}>{hubSearchResult.mistakes.map((m,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"#B8936A",fontSize:14,fontWeight:700,flexShrink:0}}>!</span><p style={{fontSize:13,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{m}</p></div>)}</div></div>}
            {hubSearchResult.related&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Related Concepts</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.related}</p></div>}
            {hubSearchResult.steps?.length>0&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:12}}>Next Steps</p><div style={{display:"flex",flexDirection:"column",gap:10}}>{hubSearchResult.steps.map((s,i)=><div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:24,height:24,borderRadius:"50%",background:"#1A1916",color:"#fff",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div><p style={{fontSize:14,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{s}</p></div>)}</div></div>}
            {!hubSearchResult.isPlaybook&&hubSearchResult.rawText&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300,whiteSpace:"pre-wrap"}}>{hubSearchResult.rawText}</p></div>}
          </div>
        )}

        <h2 style={{fontFamily:"'Cormorant',serif",fontSize:20,fontWeight:600,color:"#1C1917",marginBottom:16,letterSpacing:"-0.01em"}}>Browse by Industry</h2>
        <div className="hub-grid">
          {LEARNING_HUB.map(c=>(
            <div key={c.id} className="hub-card" onClick={()=>{setHubCatId(c.id);setHubSearch("");setHubSearchQuery("");setHubSearchResult(null);setHubTopicId(null);setHubGuide(null);}}>
              <div style={{fontFamily:"'Cormorant',serif",fontSize:13,fontWeight:600,color:"#C4B5AD",letterSpacing:"0.06em",marginBottom:10}}>{c.num}</div>
              <div className="hub-card-label">{c.label}</div>
              <div className="hub-card-desc">{c.tagline}</div>
              <div className="hub-card-cta">Explore Resources →</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ══ HUB — LEARNING TOPICS ══ */}
    {screen==="hub"&&hubCatId&&!hubTopicId&&(
      <div className="hub-q-page">
        <div className="bc"><span onClick={restart}>Home</span><span className="bc-sep">›</span><span onClick={()=>setHubCatId(null)}>Industry Hub</span></div>
        <button className="btn-out" style={{marginBottom:20,fontSize:10,padding:"8px 18px"}} onClick={()=>setHubCatId(null)}>← Back to Industry Hub</button>
        <h1 className="hub-q-h1">{hubCat?.label}</h1>
        <p className="hub-q-sub">Learn the industry, strengthen your knowledge, and explore concepts from foundational skills to advanced strategy.</p>
        {hubCat&&(
          <p style={{fontSize:12,color:"#A8A29E",marginTop:-16,marginBottom:24}}>
            {hubCat.topics.filter(t=>hubCompletedIds.includes(t.id)).length} of {hubCat.topics.length} topics completed
          </p>
        )}

        <div style={{marginBottom:32}}>
          <div style={{position:"relative",display:"flex",gap:0}}>
            <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#C4B5AD",fontSize:15,zIndex:1}}>⌕</div>
            <input
              className="hub-search"
              style={{marginBottom:0,paddingLeft:44,borderRadius:6,flex:1}}
              placeholder="Filter learning topics…"
              value={hubSearch}
              onChange={e=>setHubSearch(e.target.value)}
            />
          </div>
        </div>

        {[
          {level:"foundational",label:"Foundational"},
          {level:"growth",label:"Growth"},
          {level:"advanced",label:"Advanced"},
        ].map(({level,label})=>{
          const topics=topicsByLevel(level);
          if(!topics.length)return null;
          return(
            <div key={level} style={{marginBottom:36}}>
              <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.2em",textTransform:"uppercase",color:"#B0728A",marginBottom:14}}>{label}</p>
              <div className="hub-q-grid">
                {topics.map(t=>{
                  const isDone=hubCompletedIds.includes(t.id);
                  return(
                    <div key={t.id} className="hub-q-card" onClick={()=>{setHubTopicId(t.id);setHubGuide(null);askLearningGuide(t,hubCat);}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div className="hub-q-card-tag" style={{margin:0}}>{label}</div>
                        {isDone&&<span style={{fontSize:11,fontWeight:600,color:"#6A9E8A"}}>✓ Completed</span>}
                      </div>
                      <div className="hub-q-card-title">{t.title}</div>
                      <div className="hub-q-card-desc">{t.shortDescription}</div>
                      <div className="hub-q-card-cta">{isDone?"Review →":"Learn →"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filteredTopics.length===0&&<p style={{color:"#A8A29E",fontSize:13,padding:"20px 0"}}>No topics match your search.</p>}
      </div>
    )}

    {/* ══ HUB — LEARNING GUIDE (5-step microlesson) ══ */}
    {screen==="hub"&&hubCatId&&hubTopicId&&(
      <div className="advisor-page">
        <div className="bc">
          <span onClick={restart}>Home</span><span className="bc-sep">›</span>
          <span onClick={()=>{setHubTopicId(null);setHubGuide(null);}}>Industry Hub</span><span className="bc-sep">›</span>
          <span onClick={()=>{setHubTopicId(null);setHubGuide(null);}}>{hubCat?.label}</span>
        </div>
        {activeHubTopic&&(
          <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.2em",textTransform:"uppercase",color:"#B0728A",marginBottom:12}}>
            {activeHubTopic.topic.level.charAt(0).toUpperCase()+activeHubTopic.topic.level.slice(1)} · {activeHubTopic.category.label}
          </p>
        )}
        <h1 className="advisor-h1" style={{marginBottom:28}}><em>{activeHubTopic?.topic.title}</em></h1>

        {hubGuideLoading&&(
          <div className="lesson-skeleton">
            <div className="lesson-skeleton-line" style={{width:"40%"}}/>
            <div className="lesson-skeleton-line" style={{width:"92%"}}/>
            <div className="lesson-skeleton-line" style={{width:"85%"}}/>
            <div className="lesson-skeleton-line" style={{width:"60%"}}/>
            <p style={{fontSize:12,color:"#B8AFA8",marginTop:18,fontStyle:"italic"}}>Building your lesson…</p>
          </div>
        )}

        {hubGuide?.error&&(
          <div>
            <div className="err">⚠ {hubGuide.error}</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn" style={{padding:"10px 20px",fontSize:11}} onClick={()=>askLearningGuide(activeHubTopic.topic,activeHubTopic.category)}>Try Again</button>
              <button className="btn-out" style={{padding:"10px 20px",fontSize:11}} onClick={()=>{setHubTopicId(null);setHubGuide(null);}}>Back to Topics</button>
            </div>
          </div>
        )}

        {hubGuide&&!hubGuide.error&&(<>
          <div className="lesson-progress">
            {HUB_LESSON_STEPS.map((label,i)=>(
              <Fragment key={i}>
                <div className={`lesson-dot${i===hubStep?" active":i<hubStep?" done":""}`} onClick={()=>setHubStep(i)} title={label}>
                  {i<hubStep?"✓":i+1}
                </div>
                {i<HUB_LESSON_STEPS.length-1&&<div className="lesson-dot-line"/>}
              </Fragment>
            ))}
          </div>

          <div className="lesson-body" key={hubStep}>
            <span className="lesson-step-count">Step {hubStep+1} of 5</span>
            <span className="lesson-step-label">{HUB_LESSON_STEPS[hubStep]}</span>

            {/* STEP 1 — THE BASICS */}
            {hubStep===0&&(<>
              <p className="lesson-explain">{hubGuide.basics?.explanation}</p>
              {hubGuide.basics?.analogy&&<div className="lesson-analogy">{hubGuide.basics.analogy}</div>}
              {hubGuide.basics?.whyItMatters&&<p className="lesson-why">{hubGuide.basics.whyItMatters}</p>}
              {hubGuide.basics?.keyTakeaway&&(
                <div className="lesson-takeaway-box">
                  <div className="lesson-takeaway-label">Key Takeaway</div>
                  <div className="lesson-takeaway-text">{hubGuide.basics.keyTakeaway}</div>
                </div>
              )}
            </>)}

            {/* STEP 2 — HOW IT WORKS */}
            {hubStep===1&&(
              <div className="lesson-how-list">
                {(hubGuide.howItWorks||[]).map((h,i)=>(
                  <div className="lesson-how-row" key={i}>
                    <div className="lesson-how-num">{i+1}</div>
                    <div>
                      {h.title&&<div className="lesson-how-title">{h.title}</div>}
                      <div className="lesson-how-text">{h.explanation}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 3 — SEE IT IN REAL LIFE */}
            {hubStep===2&&(
              <div className="lesson-example-box">
                <div className="lesson-example-label">Example</div>
                <p className="lesson-example-text">{hubGuide.example?.scenario}</p>
                {hubGuide.example?.lesson&&<p className="lesson-example-lesson">{hubGuide.example.lesson}</p>}
              </div>
            )}

            {/* STEP 4 — REMEMBER THIS */}
            {hubStep===3&&(<>
              <div className="lesson-takeaways-list">
                {(hubGuide.rememberThis?.takeaways||[]).map((t,i)=>(
                  <div className="lesson-takeaway-row" key={i}>
                    <span className="lesson-takeaway-n">0{i+1}</span>
                    <span className="lesson-takeaway-line">{t}</span>
                  </div>
                ))}
              </div>
              {hubGuide.rememberThis?.terms?.length>0&&(<>
                <div className="lesson-terms-label">Words to Know</div>
                <div className="lesson-terms">
                  {hubGuide.rememberThis.terms.map((t,i)=>(
                    <button key={i} className={`lesson-term-chip${hubExpandedTerm===i?" open":""}`} onClick={()=>setHubExpandedTerm(hubExpandedTerm===i?null:i)}>
                      {t.term}
                    </button>
                  ))}
                </div>
                {hubExpandedTerm!==null&&hubGuide.rememberThis.terms[hubExpandedTerm]&&(
                  <div className="lesson-term-def">{hubGuide.rememberThis.terms[hubExpandedTerm].definition}</div>
                )}
              </>)}
              {hubGuide.goDeeper?.length>0&&(<>
                <div className="lesson-deeper-label">Topics to Research Next</div>
                <div className="lesson-deeper-list">
                  {hubGuide.goDeeper.map((g,i)=><span key={i} className="lesson-deeper-chip">{g}</span>)}
                </div>
              </>)}
            </>)}

            {/* STEP 5 — QUICK CHECK */}
            {hubStep===4&&(<>
              <p className="lesson-check-q">{hubGuide.quickCheck?.question}</p>
              {(hubGuide.quickCheck?.options||[]).map((opt,i)=>{
                const isCorrect=i===hubGuide.quickCheck.correctIndex;
                const isPicked=i===hubQuickAnswer;
                let cls="lesson-check-opt";
                if(hubQuickSubmitted&&isCorrect)cls+=" correct";
                else if(hubQuickSubmitted&&isPicked&&!isCorrect)cls+=" incorrect";
                else if(isPicked)cls+=" picked";
                return(
                  <button key={i} className={cls} disabled={hubQuickSubmitted}
                    onClick={()=>{
                      setHubQuickAnswer(i);setHubQuickSubmitted(true);
                      if(activeHubTopic)markTopicCompleted(activeHubTopic.topic.id);
                    }}>
                    {opt}
                  </button>
                );
              })}
              {hubQuickSubmitted&&(()=>{
                const correct=hubQuickAnswer===hubGuide.quickCheck.correctIndex;
                const correctText=hubGuide.quickCheck?.options?.[hubGuide.quickCheck.correctIndex];
                return(
                  <div className="lesson-check-feedback">
                    <div className="lesson-check-feedback-label" style={{color:correct?"#6A9E8A":"#B0728A"}}>
                      {correct?"Correct.":"Almost."}
                    </div>
                    {correct?(
                      <div className="lesson-check-feedback-text">{hubGuide.quickCheck?.correctExplanation}</div>
                    ):(<>
                      <div className="lesson-check-feedback-text" style={{marginBottom:8}}>{hubGuide.quickCheck?.incorrectExplanation}</div>
                      <div className="lesson-check-feedback-text"><strong>The correct answer:</strong> {correctText} — {hubGuide.quickCheck?.correctExplanation}</div>
                    </>)}
                  </div>
                );
              })()}

              {hubQuickSubmitted&&(
                <div className="lesson-end-actions">
                  {activeHubTopic?.topic.relatedTopicIds?.length>0&&(
                    <div style={{marginBottom:8}}>
                      <p style={{fontSize:10,fontWeight:600,letterSpacing:"0.2em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:10}}>Related Learning</p>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {activeHubTopic.topic.relatedTopicIds.map(rid=>{
                          const rel=findLearningTopic(rid);
                          if(!rel)return null;
                          return(
                            <button key={rid} onClick={()=>{setHubTopicId(rel.topic.id);setHubGuide(null);askLearningGuide(rel.topic,rel.category);window.scrollTo(0,0);}}
                              style={{background:"none",border:"none",textAlign:"left",cursor:"pointer",padding:0,fontSize:13,color:"#B0728A",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                              → {rel.topic.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <button className="btn" onClick={()=>{setHubTopicId(null);setHubGuide(null);}}>Explore Another Topic →</button>
                  <button className="btn-out" onClick={()=>setHubStep(0)}>Review Lesson</button>
                  <button className="btn-out" onClick={()=>{setHubTopicId(null);setHubGuide(null);}}>Back to {hubCat?.label}</button>
                </div>
              )}
            </>)}
          </div>

          {hubStep<4&&(
            <div className="lesson-nav">
              <button className="lesson-nav-back" onClick={()=>hubStep===0?(setHubTopicId(null),setHubGuide(null)):setHubStep(s=>s-1)}>
                ← {hubStep===0?"Back to Topics":"Previous"}
              </button>
              <button className="btn" onClick={()=>setHubStep(s=>s+1)}>Next →</button>
            </div>
          )}
        </>)}
      </div>
    )}

    {/* ══ ASK YOUR ADVISOR ══ */}
    {screen==="advisor"&&(
      <div className="advisor-page">
        <div className="bc"><span onClick={restart}>Home</span></div>

        <div className="advisor-mood">
          <span className="advisor-mood-kicker">Your Private Advisor</span>
          <p className="advisor-mood-line">Every strategy begins with a single honest question.</p>
        </div>

        {!advisorResult&&(
          <>
            <div className="advisor-hero">
              <h1 className="advisor-h1">Ask Your <em>Advisor.</em></h1>
              <p className="advisor-sub">Describe your situation and receive a direct, honest response — like sitting across the table from a trusted strategist.</p>
            </div>
            <div className="advisor-input-wrap">
              <textarea className="advisor-ta" rows={5} placeholder="e.g. I have been a real estate agent for 2 years and I cannot figure out how to get consistent listings…" value={advisorQ} onChange={e=>setAdvisorQ(e.target.value)}/>
            </div>
            {!advisorLoading&&(
              <div className="advisor-suggestions">
                {[
                  "How do I get my first paying clients?",
                  "How do I ask for a raise or promotion?",
                  "How do I raise my prices without losing clients?",
                  "How do I build a referral system that works?",
                  "How do I transition to a new career?",
                  "Should I niche down or stay broad?",
                  "How do I stand out in a crowded market?",
                  "When should I hire help or delegate?",
                ].map(s=>(
                  <button key={s} className="advisor-sugg" onClick={()=>setAdvisorQ(s)}>{s}</button>
                ))}
              </div>
            )}
            <div className="advisor-cta-row">
              <button className="btn" disabled={advisorLoading||!advisorQ.trim()} onClick={()=>askAdvisor(advisorQ)}>
                {advisorLoading?"Getting your answer…":"Get My Advice →"}
              </button>
            </div>
          </>
        )}

        {advisorLoading&&(
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div className="load-ring" style={{margin:"0 auto 16px"}}/>
            <p style={{fontSize:13,color:"#78716C"}}>{firstName?firstName+", your":"Your"} advisor is thinking…</p>
          </div>
        )}

        {advisorResult&&!advisorResult.error&&(
          <>
            <div className="advisor-asked">
              <span className="advisor-asked-eye">You asked</span>
              <p className="advisor-asked-q">"{advisorResult.question}"</p>
            </div>
            <div className="advisor-result">
              <div className="advisor-result-header">
                <div className="advisor-result-eye">Your Advisor</div>
              </div>
              {advisorResult.hearing&&(
                <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                  <div className="advisor-result-label" style={{color:"#A8A29E"}}>What I'm Hearing</div>
                  <div className="advisor-result-text" style={{fontStyle:"italic",color:"#57534E"}}>{advisorResult.hearing}</div>
                </div>
              )}
              {advisorResult.recommendations?.length>0&&(
                <div className="advisor-result-section">
                  <div className="advisor-result-label" style={{color:"#1A1916"}}>Here's What I Think</div>
                  <div className="advisor-reco-list">
                    {advisorResult.recommendations.map((r,i)=>(
                      <div className="advisor-reco" key={i}>
                        <div className="advisor-reco-num">{String(i+1).padStart(2,"0")}</div>
                        <div>
                          {r.title&&<div className="advisor-reco-title">{r.title}</div>}
                          <div className="advisor-reco-text">{r.explanation}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {advisorResult.meaning&&(
                <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                  <div className="advisor-result-label" style={{color:"#A8A29E"}}>What This Means For You</div>
                  <div className="advisor-result-text">{advisorResult.meaning}</div>
                </div>
              )}
              {advisorResult.nextMove&&(
                <div className="advisor-result-section" style={{borderTop:"2px solid #B0728A"}}>
                  <div className="advisor-result-label" style={{color:"#B0728A"}}>Your Next Move</div>
                  <div className="advisor-result-text" style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:600,color:"#1A1916",lineHeight:1.4}}>{advisorResult.nextMove}</div>
                </div>
              )}
            </div>
            <button className="advisor-ask-again" onClick={()=>{setAdvisorQ("");setAdvisorResult(null);}}>Ask another question →</button>
          </>
        )}
        {advisorResult?.error&&(
          <>
            <div className="err">⚠ {advisorResult.error}</div>
            <button className="advisor-ask-again" onClick={()=>{setAdvisorQ("");setAdvisorResult(null);}}>Try again →</button>
          </>
        )}

        {advisorHistory.length>0&&(
          <div className="advisor-history">
            <div className="advisor-history-label">Your previous sessions</div>
            {advisorHistory.slice(0,5).map((h,i)=>(
              <div key={i} className="advisor-history-item" onClick={()=>{setAdvisorQ(h.question);setAdvisorResult(h);}}>
                <div className="advisor-history-date">{h.date}</div>
                <div className="advisor-history-q">"{h.question}"</div>
              </div>
            ))}
          </div>
        )}

        <details className="advisor-disclosure">
          <summary>Advisor vs. Industry Hub — which should I use?</summary>
          <div className="advisor-guidance">
            {[{label:"Use this when",items:["You're weighing a specific decision","Something happened and you need to think it through","You want a second opinion before you act","You have one burning question"]},{label:"Use Industry Hub instead when",items:["You need a framework or process","You want to browse prompts for your field","You need a structured playbook, not a conversation"]}].map((col,i)=>(
              <div key={i} className="advisor-guidance-col">
                <p className="advisor-guidance-label" style={{color:i===0?"#B0728A":"#A8A29E"}}>{col.label}</p>
                {col.items.map((item,j)=>(
                  <p key={j} className="advisor-guidance-item" style={{borderLeft:`2px solid ${i===0?"#E8C4D4":"#EEEAE7"}`}}>{item}</p>
                ))}
              </div>
            ))}
          </div>
        </details>
      </div>
    )}

    {/* ══ MY STRATEGIES ══ */}
    {screen==="devqa"&&(
      <Suspense fallback={<div style={{padding:60,textAlign:"center",fontFamily:"monospace",fontSize:12,color:"#78716C"}}>Loading QA runner…</div>}>
        <QARunner/>
      </Suspense>
    )}

    {screen==="plans"&&(()=>{
      const latest=savedPlans[0];
      const daysSince=latest?Math.floor((Date.now()-latest.createdAt)/(1000*60*60*24)):0;
      return(
        <div className="page" style={{maxWidth:720}}>
          <div className="bc"><span onClick={restart}>Home</span></div>
          <h1 className="pg-h1">{firstName?`${firstName}'s Strategies.`:"Your Strategies."}</h1>
          <p className="pg-sub">Every strategy you build is saved here automatically.</p>
          {latest&&daysSince>=1&&daysSince<28&&(
            <div style={{background:"#FAFAF8",border:"1px solid #EEEAE7",borderRadius:4,padding:"18px 22px",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:6}}>Day {daysSince} of your 30-day plan</p>
                <p style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:600,color:"#1A1916",marginBottom:4}}>
                  {daysSince<=7?"Week 1 — Foundation":daysSince<=14?"Week 2 — Momentum":daysSince<=21?"Week 3 — Activation":"Week 4 — Scale & Review"}
                </p>
                <div style={{display:"flex",gap:4,marginBottom:6}}>
                  {[7,14,21,30].map((d,i)=>(
                    <div key={i} style={{height:4,flex:1,borderRadius:2,background:daysSince>=d?"#B0728A":"#EEEAE7",transition:"background 0.3s"}}/>
                  ))}
                </div>
                <p style={{fontSize:12,color:"#78716C",fontWeight:300}}>{CATEGORIES.find(c=>c.id===latest.catId)?.label} · {latest.industry}</p>
              </div>
              <div style={{display:"flex",gap:7,flexShrink:0}}>
                <button className="btn-out" style={{padding:"8px 16px",fontSize:10}} onClick={()=>openSavedPlan(latest)}>Review plan</button>
                <button className="btn" style={{padding:"8px 16px",fontSize:10}} onClick={restart}>New Strategy →</button>
              </div>
            </div>
          )}
          {latest&&daysSince>=28&&(
            <div className="checkin-banner">
              <div><div className="checkin-eye">30-Day Check-In</div><div className="checkin-title">Your milestone passed.</div><div className="checkin-sub">{daysSince} days since your last strategy. Ready for what's next?</div></div>
              <button className="checkin-btn" onClick={restart}>New Strategy →</button>
            </div>
          )}
          {latest?.result?.yourNextMove&&(
            <div style={{background:"#FAFAF8",border:"1px solid #EEEAE7",borderRadius:4,padding:"16px 20px",marginBottom:12}}>
              <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.2em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:7}}>Your last commitment</p>
              <p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:500,fontStyle:"italic",color:"#1A1916",lineHeight:1.4}}>
                "{(latest.result.yourNextMove||"").replace(/\*\*/g,"").replace(/Based on everything you've shared, the single most important action you should take today is /i,"").trim().split(".")[0]}."
              </p>
            </div>
          )}
          {!isSubscribed&&freeStrategyUsed&&(
            <div style={{background:"#FAF0F4",border:"1px solid #E8C4D4",borderRadius:4,padding:"20px 24px",marginBottom:20}}>
              <p style={{fontSize:10,fontWeight:500,letterSpacing:"0.14em",textTransform:"uppercase",color:"#B0728A",marginBottom:7}}>Unlock unlimited strategies</p>
              <p style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:500,color:"#1C1917",marginBottom:7}}>You've used your free strategy.</p>
              <p style={{fontSize:13,color:"#78716C",marginBottom:16,lineHeight:1.6,fontWeight:300}}>Subscribe for $19.99/month to build unlimited strategies.</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn" onClick={()=>window.open(STRIPE_MONTHLY,"_blank")}>Subscribe — $19.99/mo</button>
                <button className="btn-out" onClick={()=>window.open(STRIPE_ANNUAL,"_blank")}>Annual — $197/yr</button>
              </div>
            </div>
          )}
          {savedPlans.length===0?(
            <div className="plans-empty">
              <div className="plans-empty-icon">◎</div>
              <p className="plans-empty-title">No strategies yet</p>
              <p className="plans-empty-text">Once you build your first strategy, it will be saved here automatically.</p>
              <button className="btn" onClick={restart}>Create My Strategy →</button>
            </div>
          ):(
            <div className="plans-list">
              {savedPlans.map(plan=>{
                const planCat=CATEGORIES.find(c=>c.id===plan.catId);
                const date=new Date(plan.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
                const preview=(plan.result?.yourNextMove||"").replace(/\*\*/g,"").trim();
                const days=Math.floor((Date.now()-plan.createdAt)/(1000*60*60*24));
                return(
                  <div className="plan-card" key={plan.id} onClick={()=>openSavedPlan(plan)}>
                    <div className="plan-accent" style={{background:planCat?.accent||"#B0728A"}}/>
                    <div className="plan-body">
                      <div className="plan-top">
                        <div className="plan-tags">
                          <span className="plan-tag">{planCat?.label}</span>
                          <span className="plan-tag">{plan.industry}</span>
                          {days>=28&&<span className="plan-tag" style={{color:"#B0728A",background:"#FAF0F4",border:"1px solid #E8C4D4"}}>30-day mark</span>}
                        </div>
                        <span className="plan-date">{date}</span>
                      </div>
                      <div className="plan-title">{planCat?.label} — {plan.industry}</div>
                      {(()=>{const d=Math.floor((Date.now()-plan.createdAt)/(1000*60*60*24));const wk=d<7?"Week 1: Foundation":d<14?"Week 2: Momentum":d<21?"Week 3: Activation":d<30?"Week 4: Scale & Review":"30-Day Plan Complete";const pct=Math.min(100,Math.round(d/30*100));return d>0&&d<=35?(<div style={{marginTop:8}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"#B0728A",fontWeight:500}}>{wk}</span><span style={{fontSize:11,color:"#C4B5AD"}}>Day {d}</span></div><div style={{height:3,background:"#EEEAE7",borderRadius:2}}><div style={{height:3,background:"#B0728A",borderRadius:2,width:`${pct}%`,transition:"width 0.3s"}}/></div></div>):null;})()}
                      {preview&&<div className="plan-preview">{preview}</div>}
                    </div>
                    <div className="plan-actions-col">
                      <button className="plan-open" onClick={e=>{e.stopPropagation();openSavedPlan(plan);}}>Open →</button>
                      <button className="plan-del" onClick={e=>{e.stopPropagation();deletePlan(plan.id);}}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })()}

    {/* ══ STRIPE SUCCESS ══ */}
    {stripeSuccess&&(
      <div className="stripe-success">
        <div className="stripe-check">✓</div>
        <p style={{fontSize:10,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#6A9E8A",marginBottom:14}}>Welcome to Your Next Move</p>
        <h2 style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(26px,5vw,40px)",fontWeight:600,color:"#1A1916",lineHeight:1.1,marginBottom:14}}>{firstName?`${firstName}, you're in.`:"You're in."}</h2>
        <p style={{fontSize:15,color:"#6A6560",fontWeight:300,maxWidth:380,lineHeight:1.72,marginBottom:10}}>Your membership is active. Unlimited strategies, all five focus areas, every plan saved.</p>
        <p style={{fontSize:12,color:"#A8A29E",marginBottom:32}}>You'll receive a confirmation email shortly.</p>
        <button className="btn" onClick={()=>{setStripeSuccess(false);restart();}}>Create My Strategy →</button>
      </div>
    )}

    {/* ══ PAYWALL ══ */}
    {showPaywall&&(()=>{
      const copy={
        strategy:{h:<>You've used your<br/><em>free strategy.</em></>,sub:"Subscribe to unlock unlimited strategy sessions across all five focus areas."},
        advisor:{h:<>You've used your<br/><em>free advisor question.</em></>,sub:"Subscribe to unlock unlimited Ask Your Advisor sessions."},
        hub:{h:<>You've used your<br/><em>free learning topic.</em></>,sub:"Subscribe to unlock every learning topic in the Industry Hub. You can still revisit any topic you've already opened."},
      }[paywallContext]||{h:<>Membership<br/><em>required.</em></>,sub:"Subscribe to unlock unlimited access."};
      return(
      <div className="paywall">
        <p className="paywall-eye">Membership Required</p>
        <h2 className="paywall-h">{copy.h}</h2>
        <p className="paywall-sub">{copy.sub}</p>
        <div className="pw-cards">
          <div className="pw-card">
            <div className="pw-label">Monthly</div>
            <div className="pw-price"><span>$</span>19<span>.99</span></div>
            <div className="pw-period">per month</div>
            <div className="pw-features">{["Unlimited strategies","Unlimited Advisor questions","Full Industry Hub access","Save & export plans"].map((f,i)=><div className="pw-feature" key={i}><span className="pw-check">✓</span>{f}</div>)}</div>
            <button className="pw-btn" onClick={()=>window.open(STRIPE_MONTHLY,"_blank")}>Subscribe — $19.99/mo</button>
          </div>
          <div className="pw-card pop">
            <div className="pw-pop-tag">Best value</div>
            <div className="pw-label">Annual</div>
            <div className="pw-price"><span>$</span>197</div>
            <div className="pw-period">per year · billed once</div>
            <div className="pw-save">Save vs monthly</div>
            <div className="pw-features">{["Unlimited strategies","Unlimited Advisor questions","Full Industry Hub access","Save & export plans"].map((f,i)=><div className="pw-feature" key={i}><span className="pw-check">✓</span>{f}</div>)}</div>
            <button className="pw-btn" onClick={()=>window.open(STRIPE_ANNUAL,"_blank")}>Subscribe — $197/yr</button>
          </div>
        </div>
        <p className="pw-free">Cancel anytime · <button onClick={()=>setShowPaywall(false)}>Go back</button></p>
      </div>
      );
    })()}

    {/* ══ LOADING ══ */}
    {screen==="loading"&&(
      <div className="loading">
        <div className="load-ring"/>
        <h2 className="load-h">{firstName?`${firstName}'s strategy is being built…`:"Your strategy is being built…"}</h2>
        <p className="load-msg">{loadMsgs[loadMsg]}</p>
        <p className="load-sub">This usually takes 30–60 seconds.</p>
        <div className="load-steps">
          {loadMsgs.map((_,i)=><div key={i} className={`load-step${i===loadMsg?" active":i<loadMsg?" done":""}`}/>)}
        </div>
      </div>
    )}

    {/* ══ RESULTS ══ */}
    {screen==="results"&&result&&(()=>{
      const {actions,deprioritize}=parseActions(result.recommendedActions||result.actionPlan||"");
      const opps=parseOpps(result.strategicOpportunity||result.keyOpportunities||"");
      const weeks=parseRoadmap(result.priorityPlan||result.roadmap||"");
      const looking=parseLooking(result.longTermGrowth||result.mistakes||"");
      const nextMove=(result.yourNextMove||"").replace(/\*\*/g,"").trim();
      const nextMoveSentence=nextMove.split(".")[0]+".";
      const execRaw=result.strategicAssessment||result.execSummary||"";
      const execAllLines=lines(execRaw.replace(/\*\*/g,""));
      const mainExec=execAllLines.filter(l=>!l.match(/^(strength|what needs|primary tension)/i)).join(" ");
      const strength=execAllLines.find(l=>l.match(/^strength/i))||"";
      const tension=execAllLines.find(l=>l.match(/^(what needs|primary tension)/i))||"";
      const blindRaw=result.primaryConstraint||result.blindSpot||"";
      const blindTitle=blindRaw.match(/^\*\*(.+?)\*\*/)?.[1]||"";
      const blindBody=blindRaw.replace(/^\*\*(.+?)\*\*[:\s]*/,"").replace(/\*\*/g,"");
      const insightMatch=blindBody.match(/The insight:?\s*(.+?)(?:\.|$)/i);
      const cleanBlind=insightMatch?blindBody.replace(insightMatch[0],"").trim():blindBody;
      const insightText=insightMatch?insightMatch[1].replace(/\*\*/g,"").trim():null;
      const successText=(result.successLooks||"").replace(/\*\*/g,"");
      const planCat=CATEGORIES.find(c=>c.id===catId);
      const successSentences=successText.split(/(?<=[.!?])\s+/).filter(s=>s.trim().length>10);
      const position=mainExec?mainExec.split(".")[0]+".":"";
      const challenge=blindTitle||cleanBlind.split(".")[0]+".";
      const opportunity=opps[0]?opps[0].title||opps[0].body.split(".")[0]+".":"";
      const goal=successSentences[0]||"";

      /* ── SAVED ── */
      if(strategyStage==="saved") return(
        <div className="rpt-flow">
          <div className="rpt-flow-mark">✓</div>
          <span className="rpt-flow-eyebrow">Saved</span>
          <h1 className="rpt-flow-h">Your strategy has been saved.</h1>
          <p className="rpt-flow-sub">It lives in My Strategies — available to review anytime.</p>
          <p className="rpt-flow-note">Before you go, share 2 minutes of honest feedback. It shapes every future strategy on this platform.</p>
          <div className="rpt-flow-btns">
            <button className="rpt-flow-primary" onClick={()=>setStrategyStage("feedback")}>Continue to Feedback</button>
          </div>
        </div>
      );

      /* ── FEEDBACK ── */
      if(strategyStage==="feedback"){
        const REQUIRED_FB_KEYS=["personalized","valuable","confusing","wouldPay","wouldRecommend"];
        const missingCount=(fbRating===null?1:0)+REQUIRED_FB_KEYS.filter(k=>!fbAns[k]).length;
        const fbValid=missingCount===0;
        return(
        <div className="rpt-fb">
          <span className="rpt-fb-eyebrow">Beta Feedback</span>
          <h1 className="rpt-fb-h">Help us improve.</h1>
          <p className="rpt-fb-sub">You are one of our first users. Your honest input shapes every future strategy on this platform — please complete every question below before continuing.</p>
          <div className="rpt-fb-rule"/>
          <div className="fb-q"><p className="fb-q-lbl">How useful was this strategy overall?</p><div className="fb-nums">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} className={`fb-num${fbRating===n?" on":""}`} onClick={()=>setFbRating(n)}>{n}</button>)}</div></div>
          {[
            {k:"personalized",q:"Did this feel personalized to your situation?",o:["Yes — very much so","Somewhat","Not really"]},
            {k:"valuable",q:"What was most valuable?",o:["Create My Strategy","Ask Your Advisor","Industry Hub","All three equally"]},
            {k:"confusing",q:"Was anything confusing?",o:["Nothing — all clear","The flow was unclear","Features were unclear","The output was unclear"]},
            {k:"wouldPay",q:"Would you pay $19.99/month for this?",o:["Yes — absolutely","Probably","Not sure","Probably not"]},
            {k:"wouldRecommend",q:"Would you recommend this?",o:["Yes — immediately","Maybe","Not yet"]},
          ].map(item=>(
            <div className="fb-q" key={item.k}><p className="fb-q-lbl">{item.q}</p><div className="fb-pills">{item.o.map(o=><button key={o} className={`fb-pill${fbAns[item.k]===o?" on":""}`} onClick={()=>setFbAns(p=>({...p,[item.k]:o}))}>{o}</button>)}</div></div>
          ))}
          <div className="fb-q"><p className="fb-q-lbl">What would make this better?</p><textarea className="fb-ta" placeholder="Be direct." value={fbAns.suggestions||""} onChange={e=>setFbAns(p=>({...p,suggestions:e.target.value}))}/></div>
          <div className="fb-q"><p className="fb-q-lbl">One action you are taking this week</p><textarea className="fb-ta" placeholder="Be specific." value={fbAns.action||""} onChange={e=>setFbAns(p=>({...p,action:e.target.value}))}/></div>
          <div className="fb-q"><p className="fb-q-lbl">May we use this as a testimonial?</p><div className="fb-pills">{["Yes, with my name","Yes, anonymously","No"].map(o=><button key={o} className={`fb-pill${fbAns.testimonial===o?" on":""}`} onClick={()=>setFbAns(p=>({...p,testimonial:o}))}>{o}</button>)}</div></div>
          <div className="rpt-fb-rule"/>
          <button className="btn" style={{padding:"14px 40px"}} disabled={!fbValid} onClick={()=>{
            if(!fbValid)return;
            setFbDone(true);setPdfUnlocked(true);
            try{window.storage.set(`feedback:${Date.now()}`,JSON.stringify({rating:fbRating,...fbAns}));}catch(e){}
            persistFeedbackUnlock();
            setStrategyStage("complete");
          }}>Submit Feedback</button>
          {!fbValid&&<p style={{fontSize:12,color:"#B0728A",marginTop:10}}>{missingCount} question{missingCount===1?"":"s"} above still need{missingCount===1?"s":""} an answer.</p>}
        </div>
        );
      }

      /* ── COMPLETE ── */
      if(strategyStage==="complete") return(
        <div className="rpt-flow">
          <div className="rpt-flow-mark" style={{fontFamily:"'Cormorant',serif",fontSize:24,color:"var(--r-accent)",borderColor:"rgba(176,114,138,0.3)"}}>✦</div>
          <span className="rpt-flow-eyebrow">Thank you{firstName?`, ${firstName}`:""}</span>
          <h1 className="rpt-flow-h">Your PDF is ready.</h1>
          <p className="rpt-flow-sub">Your strategy is complete and ready to download as a professionally formatted PDF.</p>
          <p className="rpt-flow-note">{fbDone?"Your feedback has been received and will shape every future strategy.":"Your strategy has been saved to My Strategies."}</p>
          <div className="rpt-flow-btns">
            <button className="rpt-flow-primary" onClick={()=>{setStrategyStage('reading');setPendingPrint(true);}}>Download Strategy PDF</button>
          </div>
          <div className="rpt-pdf-grid" style={{marginTop:20}}>
            <button className="rpt-pdf-link" onClick={()=>go("plans")}>My Strategies</button>
            <button className="rpt-pdf-link" onClick={restart}>New Strategy</button>
            <button className="rpt-pdf-link" onClick={()=>go("advisor")}>Ask Your Advisor</button>
            <button className="rpt-pdf-link" onClick={()=>go("hub")}>Industry Hub</button>
          </div>
        </div>
      );

      /* ── MAIN STRATEGY DOCUMENT ── */
      return(
        <div className="rpt">

          {/* COVER */}
          <div className="rpt-cover">
            <span className="rpt-cover-eyebrow">Your Next Move · Strategy Report</span>
            <h1 className="rpt-cover-title">
              <em>{planCat?.label}</em><br/>Strategy
            </h1>
            {firstName&&<p className="rpt-cover-forname">Prepared exclusively for <strong>{firstName}</strong>.</p>}
            <div className="rpt-cover-tags">
              <span className="rpt-cover-tag">{effectiveIndustry||industry}</span>
              <span className="rpt-cover-tag">{stageLabel}</span>
              <span className="rpt-cover-tag">{today}</span>
              {viewingPlanId&&<span className="rpt-cover-tag" style={{color:"#6A9E8A",borderColor:"rgba(106,158,138,0.35)"}}>✓ Saved</span>}
            </div>
            <div className="rpt-cover-actions" style={{marginTop:24}}>
              <button className="btn-out" onClick={()=>{
                if(pdfUnlocked){window.print();}
                else{setStrategyStage('saved');window.scrollTo(0,0);}
              }}>Print / Save as PDF</button>
            </div>
          </div>

          {/* CHAPTER BREAK — intentional transition between cover and the report proper */}
          <div className="rpt-exec-break" style={{padding:"52px var(--r-pad) 8px"}}>
            <div className="rpt-exec-break-rule"/>
          </div>

          {/* 00 — EXECUTIVE SUMMARY — ONE UNIFIED BRIEFING */}
          <div className="rpt-sec rpt-sec-alt" style={{paddingTop:36}}>
            {(()=>{
              const execTotalLen=[challenge,insightText||cleanBlind,position,opportunity,goal,nextMoveSentence].filter(Boolean).join(" ").length;
              const densityClass=execTotalLen>950?"rpt-exec-dense":execTotalLen<400?"rpt-exec-airy":"";
              return (
            <div className={"rpt-exec-unified "+densityClass}>
              <div className="rpt-exec-hero">
                <span className="rpt-exec-hero-label">00 · The Core Insight</span>
                {challenge&&<h2 className="rpt-exec-hero-headline">{challenge}</h2>}
                {(insightText||cleanBlind)&&<p className="rpt-exec-hero-sub">{insightText||cleanBlind.split(".")[0]+"."}</p>}
              </div>
              <div className="rpt-exec-glance">
                {position&&<div className="rpt-exec-glance-item"><div className="rpt-exec-glance-label">Current Position</div><div className="rpt-exec-glance-value">{position}</div></div>}
                {opportunity&&<div className="rpt-exec-glance-item"><div className="rpt-exec-glance-label">Greatest Opportunity</div><div className="rpt-exec-glance-value">{opportunity}</div></div>}
                {goal&&<div className="rpt-exec-glance-item"><div className="rpt-exec-glance-label">Primary Goal</div><div className="rpt-exec-glance-value">{goal}</div></div>}
              </div>
              {nextMoveSentence&&(
                <div className="rpt-exec-nextmove">
                  <span className="rpt-exec-nextmove-label">Today's First Move</span>
                  <p className="rpt-exec-nextmove-text">{nextMoveSentence}</p>
                </div>
              )}
            </div>
              );
            })()}
          </div>


          {/* 01 — STRATEGIC ASSESSMENT */}
          <div className="rpt-sec">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">01 · Strategic Assessment</span>
              <h2 className="rpt-sec-title">Where you are today.</h2>
              <p className="rpt-sec-desc">Patterns discovered after analyzing your responses.</p>
              <div className="rpt-sec-div"/>
            </div>
            {mainExec&&<p className="rpt-body">{mainExec}</p>}
            {(strength||tension)&&(
              <div className="rpt-str-grid">
                {strength&&<div className="rpt-str-cell"><div className="rpt-str-label rpt-str-label-s">Strengths</div><div className="rpt-str-text">{clean(strength)}</div></div>}
                {tension&&<div className="rpt-str-cell"><div className="rpt-str-label rpt-str-label-t">What Needs Attention</div><div className="rpt-str-text">{clean(tension)}</div></div>}
              </div>
            )}
          </div>

          {/* 02 — PRIMARY CHALLENGE */}
          <div className="rpt-sec rpt-sec-dark">
            <div className="rpt-heading-lock">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">02 · Primary Challenge</span>
              <h2 className="rpt-sec-title">The core constraint.</h2>
              <p className="rpt-sec-desc">The single biggest obstacle preventing faster progress.</p>
              <div className="rpt-sec-div"/>
            </div>
            {blindTitle&&<p className="rpt-chal-name">"{blindTitle}"</p>}
            </div>
            {cleanBlind&&<p className="rpt-chal-body">{cleanBlind}</p>}
            {insightText&&(
              <div className="rpt-insight-block">
                <div className="rpt-insight-label">The Insight</div>
                <p className="rpt-insight-quote">"{insightText}"</p>
                <button id="rpt-share" className="rpt-insight-share" onClick={()=>{
                  if(navigator.clipboard){navigator.clipboard.writeText(`"${insightText}" — from my strategy with Your Next Move`).then(()=>{const b=document.getElementById("rpt-share");if(b){b.textContent="Copied";setTimeout(()=>{b.textContent="Copy insight";},2000);}});}
                }}>Copy insight</button>
              </div>
            )}
          </div>

          {/* 03 — BEST OPPORTUNITY */}
          <div className="rpt-sec">
            <div className="rpt-heading-lock">
              <div className="rpt-sec-hd">
                <span className="rpt-sec-num">03 · Best Opportunity</span>
                <h2 className="rpt-sec-title">Where to focus your energy.</h2>
                <p className="rpt-sec-desc">The highest leverage opportunity available right now.</p>
                <div className="rpt-sec-div"/>
              </div>
              {opps[0]&&(
                <div className="rpt-opps-stack rpt-opps-stack-start">
                  <div className="rpt-opp-row">
                    <div className="rpt-opp-idx"><span className="rpt-opp-idx-n">01</span></div>
                    <div className="rpt-opp-content">
                      {opps[0].title&&<div className="rpt-opp-title">{opps[0].title}</div>}
                      <div className="rpt-opp-body">{opps[0].body}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {opps.length>1&&(
              <div className="rpt-opps-stack">
                {opps.slice(1).map((o,i)=>(
                  <div className="rpt-opp-row" key={i+1}>
                    <div className="rpt-opp-idx"><span className="rpt-opp-idx-n">0{i+2}</span></div>
                    <div className="rpt-opp-content">
                      {o.title&&<div className="rpt-opp-title">{o.title}</div>}
                      <div className="rpt-opp-body">{o.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 04 — RECOMMENDED ACTIONS */}
          <div className="rpt-sec rpt-sec-alt">
            <div className="rpt-heading-lock">
              <div className="rpt-sec-hd">
                <span className="rpt-sec-num">04 · Recommended Actions</span>
                <h2 className="rpt-sec-title">Where to direct your energy.</h2>
                <p className="rpt-sec-desc">Exactly what should happen next.</p>
                <div className="rpt-sec-div"/>
              </div>
              {actions[0]&&(
                <div className="rpt-actions-stack rpt-actions-stack-start">
                  <div className="rpt-action-row is-first">
                    <div className="rpt-action-rule">
                      <span className="rpt-action-num">01</span>
                      <span className="rpt-action-cap">Begin today</span>
                    </div>
                    <div className="rpt-action-body">
                      <div className="rpt-action-title">{actions[0].title||clean(actions[0].body)}</div>
                      {actions[0].title&&actions[0].body&&<div className="rpt-action-desc">{actions[0].body}</div>}
                      {actions[0].why&&<div className="rpt-action-why">{actions[0].why}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {actions.length>1&&(
              <div className="rpt-actions-stack">
                {actions.slice(1).map((a,i0)=>{
                  const i=i0+1;
                  const caps=["Begin today","Within 3 days","Within 5 days","Within 2 weeks","Within 2 weeks"];
                  return(
                    <div className="rpt-action-row" key={i}>
                      <div className="rpt-action-rule">
                        <span className="rpt-action-num">{"0"+(i+1)}</span>
                        <span className="rpt-action-cap">{caps[i]||"Ongoing"}</span>
                      </div>
                      <div className="rpt-action-body">
                        <div className="rpt-action-title">{a.title||clean(a.body)}</div>
                        {a.title&&a.body&&<div className="rpt-action-desc">{a.body}</div>}
                        {a.why&&<div className="rpt-action-why">{a.why}</div>}
                      </div>
                    </div>
                  );
                })}
                {deprioritize&&(
                  <div className="rpt-deprio-row">
                    <span className="rpt-deprio-label">Set aside</span>
                    <span className="rpt-deprio-text">{deprioritize}</span>
                  </div>
                )}
              </div>
            )}
            {actions.length<=1&&deprioritize&&(
              <div className="rpt-actions-stack">
                <div className="rpt-deprio-row">
                  <span className="rpt-deprio-label">Set aside</span>
                  <span className="rpt-deprio-text">{deprioritize}</span>
                </div>
              </div>
            )}
          </div>

          {/* 05 — 30-DAY PLAN */}
          <div className="rpt-sec rpt-sec-dark">
            <div className="rpt-heading-lock">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">05 · 30-Day Plan</span>
              <h2 className="rpt-sec-title">Your week-by-week roadmap.</h2>
              <p className="rpt-sec-desc">Concrete actions for the next 30 days.</p>
              <div className="rpt-sec-div"/>
            </div>

            {(()=>{
              const completedCount=completedWeeks.filter(Boolean).length;
              const pct=Math.round((completedCount/4)*100);
              const r=34,circ=2*Math.PI*r;
              const offset=circ*(1-pct/100);
              return(
                <div className="plan-progress-wrap">
                  <svg className="plan-progress-ring" viewBox="0 0 80 80">
                    <circle className="plan-progress-track" cx="40" cy="40" r={r}/>
                    <circle className="plan-progress-fill" cx="40" cy="40" r={r}
                      style={{strokeDasharray:circ,strokeDashoffset:offset}}/>
                  </svg>
                  <div className="plan-progress-text">
                    <span className="plan-progress-pct">{pct}%</span>
                  </div>
                  <p className="plan-progress-label">30-Day Plan Progress</p>
                </div>
              );
            })()}

            <div className={"rpt-weeks rpt-weeks-header"+(weeks.reduce((a,w)=>a+w.length,0)>16?" rpt-weeks-compact":"")}>
              {weeks.map((items,i)=>(
                <div className="rpt-week-col" key={i}>
                  <div className="rpt-week-hd">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <div className="rpt-week-n">Week {i+1}</div>
                      <button
                        className={`plan-week-check${completedWeeks[i]?" done":""}`}
                        onClick={()=>toggleWeekComplete(i)}
                        aria-label={completedWeeks[i]?`Mark Week ${i+1} incomplete`:`Mark Week ${i+1} complete`}
                      >{completedWeeks[i]?"✓":""}</button>
                    </div>
                    <div className="rpt-week-theme">{WEEK_THEMES[i]}</div>
                    <div className="rpt-week-goal">{["Establish your foundation","Build momentum","Execute and activate","Review and scale"][i]}</div>
                  </div>
                </div>
              ))}
            </div>
            </div>
            <div className={"rpt-weeks rpt-weeks-body"+(weeks.reduce((a,w)=>a+w.length,0)>16?" rpt-weeks-compact":"")}>
              {weeks.map((items,i)=>(
                <div className="rpt-week-col" key={i}>
                  <div className="rpt-week-bd">
                    {items.length?items.map((item,j)=>(
                      <div className="rpt-week-task" key={j}>
                        <span className="rpt-week-dot"/>
                        <span>{item}</span>
                      </div>
                    )):<div className="rpt-week-task"><span className="rpt-week-dot"/><span>—</span></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 06 — LOOKING AHEAD */}
          <div className="rpt-sec">
            <div className="rpt-heading-lock">
              <div className="rpt-sec-hd">
                <span className="rpt-sec-num">06 · Looking Ahead</span>
                <h2 className="rpt-sec-title">What becomes possible next.</h2>
                <p className="rpt-sec-desc">What to build toward after your first 30 days.</p>
                <div className="rpt-sec-div"/>
              </div>
              {looking[0]&&(
                <div className="rpt-ahead-list rpt-ahead-list-start">
                  <div className="rpt-ahead-row">
                    <span className="rpt-ahead-idx">01</span>
                    <div>
                      {looking[0].title&&<div className="rpt-ahead-title">{looking[0].title}</div>}
                      <div className="rpt-ahead-body">{looking[0].body}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {looking.length>1&&(
              <div className="rpt-ahead-list">
                {looking.slice(1).map((m,i0)=>{
                  const i=i0+1;
                  return(
                    <div className="rpt-ahead-row" key={i}>
                      <span className="rpt-ahead-idx">0{i+1}</span>
                      <div>
                        {m.title&&<div className="rpt-ahead-title">{m.title}</div>}
                        <div className="rpt-ahead-body">{m.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 07 — WHAT SUCCESS LOOKS LIKE */}
          {successText&&(
            <div className="rpt-sec rpt-sec-alt">
              <div className="rpt-heading-lock">
                <div className="rpt-sec-hd">
                  <span className="rpt-sec-num">07 · What Success Looks Like</span>
                  <h2 className="rpt-sec-title">Measurable milestones.</h2>
                  <p className="rpt-sec-desc">How you'll know this strategy is working.</p>
                  <div className="rpt-sec-div"/>
                </div>
                <div className="rpt-success-list">
                  {successSentences.slice(0,3).map((s,i)=>(
                    <div className="rpt-success-row" key={i}>
                      <div className="rpt-success-mark"><div className="rpt-success-dot"/></div>
                      <span className="rpt-success-text">{s.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 08 — YOUR NEXT MOVE */}
          <div className="rpt-nm">
            <span className="rpt-nm-eyebrow">08 · Your Next Move</span>
            <span className="rpt-nm-label">The single most important action you should take today</span>
            <p className="rpt-nm-text">"{nextMoveSentence}"</p>
            <div className="rpt-nm-meta">
              <div className="rpt-nm-meta-col"><div className="rpt-nm-meta-lbl">Time Required</div><div className="rpt-nm-meta-val">Today</div></div>
              <div className="rpt-nm-meta-col"><div className="rpt-nm-meta-lbl">Priority</div><div className="rpt-nm-meta-val">Highest</div></div>
              <div className="rpt-nm-meta-col"><div className="rpt-nm-meta-lbl">Expected Impact</div><div className="rpt-nm-meta-val">High</div></div>
            </div>
          </div>

          {/* NOTES — replaces the old nonfunctional per-section Edit */}
          <div className="rpt-sec rpt-sec-alt">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">Notes</span>
              <h2 className="rpt-sec-title">Your notes.</h2>
              <p className="rpt-sec-desc">Add your own thoughts or reminders — only visible to you, saved with this strategy.</p>
              <div className="rpt-sec-div"/>
            </div>
            <textarea className="rpt-edit-ta" style={{minHeight:100}} placeholder="Add your notes here…" value={notesText} onChange={e=>setNotesText(e.target.value)}/>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12}}>
              <button className="rpt-edit-save" onClick={saveNotes} disabled={notesSaveStatus==='saving'}>{notesSaveStatus==='saving'?'Saving…':'Save Note'}</button>
              {notesSaveStatus==='saved'&&<span style={{fontSize:11,color:"var(--r-sage)"}}>✓ Saved</span>}
              {notesSaveStatus==='error'&&<span style={{fontSize:11,color:"#B0728A"}}>⚠ Not saved — try again</span>}
            </div>
          </div>

          {/* CONCLUSION */}
          <div className="rpt-end">
            <div className="rpt-end-rule"/>
            <span className="rpt-end-eyebrow">Strategy Complete</span>
            <h2 className="rpt-end-h">Your strategy is ready.</h2>
            <p className="rpt-end-sub">Save it to My Strategies to access anytime. Then take your next move.</p>
            <button className="btn" style={{padding:"16px 48px",fontSize:12}} onClick={()=>setStrategyStage("saved")}>Save My Strategy</button>
          </div>

        </div>
      );
    })()}
  </>);
}
