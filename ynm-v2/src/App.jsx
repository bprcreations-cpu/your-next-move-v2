import { useState, useEffect } from "react";
import {
  CATEGORIES, INDUSTRIES, STAGES, WEEK_THEMES,
  STRIPE_MONTHLY, STRIPE_ANNUAL, FREE_PLAN_LIMIT,
  HUB_CATEGORIES, getQuestions
} from "./data.js";

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
  const hits=[...(text||"").matchAll(/week\s*([1-4])[:\s\-–]*([\s\S]*?)(?=week\s*[1-4]|$)/gi)];
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
.paywall{min-height:68vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 24px;text-align:center;}
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
.advisor-page{max-width:680px;margin:0 auto;padding:52px 28px 80px;}
.advisor-h1{font-family:'Cormorant',serif;font-size:clamp(28px,4.5vw,44px);font-weight:600;color:#1C1917;line-height:1.1;margin-bottom:10px;letter-spacing:-0.02em;}
.advisor-h1 em{font-style:italic;color:#B0728A;}
.advisor-sub{font-size:15px;color:#78716C;font-weight:300;line-height:1.7;margin-bottom:28px;}
.advisor-ta{width:100%;padding:16px 18px;border:1.5px solid #EEEAE7;border-radius:4px;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#1A1916;line-height:1.72;resize:none;min-height:130px;outline:none;background:#FAFAF8;transition:border-color 0.15s;}
.advisor-ta:focus{border-color:#B0728A;background:#fff;}
.advisor-ta::placeholder{color:#C4B5AD;}
.advisor-hint{font-size:12px;color:#B8AFA8;margin-top:8px;font-style:italic;margin-bottom:16px;}
.advisor-suggested{margin-bottom:28px;}
.advisor-suggested-label{font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#C4B5AD;margin-bottom:10px;}
.advisor-suggestions{display:flex;flex-wrap:wrap;gap:7px;}
.advisor-sugg{padding:8px 16px;border:1px solid #EEEAE7;background:#fff;border-radius:100px;font-size:12px;color:#57534E;cursor:pointer;transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;}
.advisor-sugg:hover{border-color:#B0728A;color:#1C1917;background:#FDF7F9;}
.advisor-result{margin-top:28px;border:1px solid #EEEAE7;border-radius:4px;overflow:hidden;}
.advisor-result-header{background:#1A1916;padding:18px 24px;}
.advisor-result-eye{font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#C4A0B0;}
.advisor-result-section{padding:20px 24px;border-bottom:1px solid #EEEAE7;}
.advisor-result-section:last-child{border-bottom:none;}
.advisor-result-label{font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#C4B5AD;margin-bottom:10px;}
.advisor-result-text{font-size:14px;color:#3A3530;line-height:1.78;font-weight:300;}
.advisor-result-steps{display:flex;flex-direction:column;gap:8px;}
.advisor-result-step{display:flex;gap:10px;align-items:flex-start;}
.advisor-result-step-num{width:22px;height:22px;border-radius:50%;background:#B0728A;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.advisor-result-step-text{font-size:13px;color:#57534E;line-height:1.65;font-weight:300;}
.advisor-history{margin-top:32px;}
.advisor-history-label{font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#C4B5AD;margin-bottom:12px;}
.advisor-history-item{padding:12px 16px;border:1px solid #EEEAE7;border-radius:4px;margin-bottom:6px;cursor:pointer;transition:all 0.15s;}
.advisor-history-item:hover{border-color:#E8C4D4;background:#FDF7F9;}
.advisor-history-q{font-size:13px;color:#1A1916;font-weight:400;line-height:1.4;margin-bottom:3px;}
.advisor-history-date{font-size:12px;color:#C4B5AD;}


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
.rpt-cover{background:var(--r-bg-dark);padding:92px var(--r-pad) 76px;}
.rpt-cover-eyebrow{font-size:10px;font-weight:500;letter-spacing:0.38em;text-transform:uppercase;color:var(--r-dark-meta);margin-bottom:32px;display:block;}
.rpt-cover-title{font-family:'Cormorant',serif;font-size:clamp(46px,7.2vw,80px);font-weight:600;color:#fff;line-height:0.98;letter-spacing:-0.03em;margin-bottom:22px;}
.rpt-cover-title em{font-style:italic;color:var(--r-accent);}
.rpt-cover-forname{font-family:'Cormorant',serif;font-style:italic;font-size:19px;font-weight:500;color:var(--r-dark-label);letter-spacing:0.01em;margin-bottom:44px;}
.rpt-cover-forname strong{font-style:normal;font-weight:600;color:#fff;}
.rpt-cover-meta{font-size:12px;color:#4A4540;letter-spacing:0.06em;line-height:2;margin-bottom:36px;}
.rpt-cover-meta span{margin:0 12px 0 0;}
.rpt-cover-meta span:not(:last-child)::after{content:'·';margin-left:12px;color:#2A2520;}
.rpt-cover-tags{display:flex;flex-wrap:wrap;align-items:center;gap:0;padding-top:28px;border-top:1px solid var(--r-rule-dark);}
.rpt-cover-tag{font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--r-dark-meta);}
.rpt-cover-tag:not(:last-child)::after{content:'·';margin:0 14px;color:#3A3430;}
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

/* ── EXECUTIVE SUMMARY ──────────────────────────────────────── */
/* One dominant anchor (Primary Challenge), one quiet supporting strip */
.rpt-exec-anchor{background:var(--r-bg-dark);padding:60px var(--r-pad) 56px;}
.rpt-exec-anchor-label{font-size:10px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:var(--r-accent);margin-bottom:22px;display:block;}
.rpt-exec-anchor-text{font-family:'Cormorant',serif;font-size:clamp(25px,3.4vw,34px);font-weight:500;font-style:italic;color:#fff;line-height:1.48;letter-spacing:-0.01em;max-width:660px;}
.rpt-exec-support{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--r-rule);}
.rpt-exec-support-item{background:#fff;padding:26px var(--r-pad);}
.rpt-exec-support-item:first-child{padding-left:var(--r-pad);}
.rpt-exec-support-label{font-size:9px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:var(--r-ink-3);margin-bottom:10px;opacity:0.85;}
.rpt-exec-support-value{font-size:13px;color:var(--r-ink-2);line-height:1.62;font-weight:300;}
.rpt-exec-tl{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--r-rule);margin-top:0;border-top:2px solid var(--r-ink);}
.rpt-exec-tl-cell{padding:20px 32px;background:#fff;}
.rpt-exec-tl-period{font-size:9px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--r-accent);margin-bottom:6px;opacity:0.9;}
.rpt-exec-tl-text{font-size:12px;color:var(--r-ink-3);font-weight:300;line-height:1.6;}

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
.rpt-opps-stack{display:flex;flex-direction:column;gap:1px;background:var(--r-rule);border-top:1px solid var(--r-rule);}
.rpt-opp-row{display:grid;grid-template-columns:64px 1fr;background:#fff;}
.rpt-opp-idx{display:flex;align-items:flex-start;justify-content:center;padding:32px 0;border-right:1px solid var(--r-rule);}
.rpt-opp-idx-n{font-size:10px;font-weight:600;letter-spacing:0.14em;color:var(--r-accent);padding-top:3px;}
.rpt-opp-content{padding:28px 32px;}
.rpt-opp-title{font-family:'Cormorant',serif;font-size:19px;font-weight:600;color:var(--r-ink);margin-bottom:8px;line-height:1.3;letter-spacing:-0.01em;}
.rpt-opp-body{font-size:13px;color:var(--r-ink-2);line-height:1.75;font-weight:300;}

/* ── ACTIONS ────────────────────────────────────────────────── */
.rpt-actions-stack{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--r-rule);}
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
.rpt-week-bd{padding:16px 20px 22px;}
.rpt-week-task{font-size:11.5px;color:var(--r-dark-body);line-height:1.7;padding:6px 0;border-bottom:1px solid var(--r-rule-dark);display:flex;gap:8px;align-items:flex-start;}
.rpt-week-task:last-child{border-bottom:none;}
.rpt-week-dot{width:3px;height:3px;border-radius:50%;background:var(--r-accent);flex-shrink:0;margin-top:8px;opacity:0.8;}

/* ── LOOKING AHEAD ──────────────────────────────────────────── */
.rpt-ahead-list{display:flex;flex-direction:column;border-top:1px solid var(--r-rule);}
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
  @page{margin:0.6in 0.7in;size:letter;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  .nav,.rpt-end,.rpt-edit,.rpt-cover-actions,body>*:not(.rpt){display:none!important;}
  .rpt-cover{background:#141210!important;-webkit-print-color-adjust:exact!important;}
  .rpt-sec-dark,.rpt-nm,.rpt-weeks,.rpt-exec-anchor{background:#141210!important;}
  .rpt-weeks{grid-template-columns:repeat(4,1fr)!important;}
  .rpt-exec-support{grid-template-columns:repeat(4,1fr)!important;}
  .rpt-action-row.is-first{background:#141210!important;}
  .rpt-sec{padding:48px 64px;}
  .rpt-nm{padding:64px;}
  .rpt-cover{padding:64px;}
  .rpt-str-grid{grid-template-columns:1fr 1fr!important;}

  /* Never split a heading from what follows it, and never split a card/row mid-content */
  .rpt-sec-hd{break-after:avoid;page-break-after:avoid;}
  .rpt-exec-anchor,.rpt-exec-support-item,.rpt-exec-tl-cell,
  .rpt-opp-row,.rpt-action-row,.rpt-ahead-row,.rpt-success-row,
  .rpt-week-col,.rpt-str-cell,.rpt-insight-block,.rpt-nm{
    break-inside:avoid;page-break-inside:avoid;
  }
  /* Prevent a single stray line stranded at the top or bottom of a page */
  .rpt-body,.rpt-chal-body,.rpt-opp-body,.rpt-action-desc,.rpt-ahead-body,
  .rpt-str-text,.rpt-success-text,.rpt-exec-support-value{
    orphans:3;widows:3;
  }
}

/* Screen fallback for browsers that don't fully support break-inside in flex/grid contexts */
.rpt-sec-hd,.rpt-exec-anchor,.rpt-opp-row,.rpt-action-row,.rpt-ahead-row{break-inside:avoid;}

/* RESPONSIVE */
@media(max-width:860px){
  :root{--r-col-pad:32px;--r-section-pad:56px 0;}
  .rpt-action{grid-template-columns:110px 1fr;}
  .rpt-deprio{grid-template-columns:110px 1fr;}
  .rpt-roadmap{grid-template-columns:1fr 1fr;}
  .rpt-exec{grid-template-columns:1fr;}
  .rpt-exec-item.span2{grid-column:span 1;}
  .rpt-exec-tl{grid-template-columns:1fr;}
  .rpt-str-ten{grid-template-columns:1fr;}
  .rpt-sec-header{grid-template-columns:36px 1fr;gap:0 16px;}
  .rpt-nextmove-meta{flex-direction:column;gap:20px;align-items:center;}
  .rpt-nextmove-meta-item{border-right:none;padding:0;}
}
@media(max-width:640px){
  :root{--r-col-pad:16px;--r-section-pad:44px 0;}
  .rpt-cover{padding:48px 16px 40px;}
  .rpt-action{grid-template-columns:1fr;}
  .rpt-action-meta{border-right:none;border-bottom:1px solid var(--r-rule);flex-direction:row;align-items:center;gap:12px;}
  .rpt-action.priority-1 .rpt-action-meta{border-bottom-color:var(--r-rule-dark);}
  .rpt-action-num{display:none;}
  .rpt-deprio{grid-template-columns:1fr;}
  .rpt-roadmap{grid-template-columns:1fr;}
  .rpt-nextmove{padding:56px 16px;}
  .rpt-nextmove-text{font-size:clamp(20px,5.5vw,28px);}
  .rpt-conclusion{padding:56px 16px;}
  .rpt-conclusion-btns{flex-direction:column;align-items:center;}
  .rpt-conclusion-btns .btn,.rpt-conclusion-btns .btn-out{width:100%;max-width:300px;justify-content:center;}
  .rpt-next-grid{grid-template-columns:1fr;}
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

// ─── PDF GENERATOR ───────────────────────────────────────────────────────────
function generatePDF(result, meta) {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { window.print(); return; } // Fallback to print if jsPDF not loaded
    const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"letter" });
    const W=216,H=279,ML=20,MR=20,CW=W-ML-MR;
    const ACCENT=[176,114,138],DARK=[26,25,22],INK=[42,40,38],MUTED=[120,113,108],RULE=[230,226,223],SAGE=[106,158,138];
    let y=ML+5, pageNum=1;
    const wrap=(t,x,w)=>doc.splitTextToSize(String(t||""),w);
    const rawLines=(t)=>(t||"").split("\n").map(l=>l.trim()).filter(Boolean).filter(l=>!l.match(/^#+/));
    const cleanStr=(s)=>(s||"").replace(/\*\*/g,"").replace(/^[-•*✓✗\d.]+\s*/,"").trim();
    function chk(n){if(y+n>H-14){doc.addPage();y=ML+5;pageNum++;footer();}}
    function footer(){doc.setFontSize(8);doc.setTextColor(...MUTED);doc.text(String(pageNum),W/2,H-10,{align:"center"});}
    function rule(){chk(4);doc.setDrawColor(...RULE);doc.setLineWidth(0.2);doc.line(ML,y,W-MR,y);y+=4;}
    function body(t,ind){const x=ML+(ind||0);doc.setFontSize(10);doc.setTextColor(...INK);doc.setFont("helvetica","normal");wrap(t,x,CW-(ind||0)).forEach(l=>{chk(5);doc.text(l,x,y);y+=5;});y+=1;}
    function secHd(num,title,desc){chk(30);doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text(num,ML,y);y+=4.5;doc.setFontSize(18);doc.setTextColor(...DARK);doc.setFont("helvetica","bold");wrap(title,ML,CW).forEach((l)=>{doc.text(l,ML,y);y+=7;});if(desc){doc.setFontSize(9);doc.setTextColor(...MUTED);doc.setFont("helvetica","normal");doc.text(desc,ML,y);y+=4.5;}doc.setDrawColor(...ACCENT);doc.setLineWidth(0.5);doc.line(ML,y,ML+20,y);y+=5.5;}
    // COVER
    doc.setFillColor(...DARK);doc.rect(0,0,W,H,"F");
    doc.setFontSize(8);doc.setTextColor(80,75,70);doc.setFont("helvetica","bold");doc.text("YOUR NEXT MOVE  ·  STRATEGY REPORT",ML,24);
    doc.setFontSize(30);doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");
    const ct=meta.catLabel||"Strategy";wrap(ct+" Strategy",ML,CW).forEach((l,i)=>{doc.text(l,ML,50+i*12);});
    if(meta.firstName){doc.setFontSize(12);doc.setTextColor(...ACCENT);doc.setFont("helvetica","normal");doc.text("Prepared for "+meta.firstName,ML,90);}
    let tx=ML;
    [meta.effectiveIndustry,meta.stageLabel,meta.today].filter(Boolean).forEach(tag=>{doc.setFontSize(7);doc.setTextColor(100,95,90);doc.setFont("helvetica","normal");const tw=doc.getTextWidth(tag)+8;doc.setDrawColor(55,50,47);doc.setLineWidth(0.3);doc.roundedRect(tx,100,tw,5.5,1,1);doc.text(tag,tx+4,104.2);tx+=tw+4;});
    footer();doc.addPage();pageNum=2;y=ML+5;footer();
    // Parse data
    const execRaw=(result.strategicAssessment||"").replace(/\*\*/g,"");
    const execLines=rawLines(execRaw);
    const mainExec=execLines.filter(l=>!l.match(/^(strength|what needs)/i)).join(" ");
    const position=mainExec?mainExec.split(".")[0]+".":"";
    const blindRaw=(result.primaryConstraint||"").replace(/\*\*/g,"");
    const blindTitle=(blindRaw.match(/^[^.]+/)||[""])[0];
    const insM=blindRaw.match(/The insight:?\s*(.+?)(?:\.|$)/i);
    const insight=insM?insM[1].trim():"";
    const succ=(result.successLooks||"").replace(/\*\*/g,"").split(/(?<=[.!?])\s+/).filter(s=>s.length>10);
    const nm=(result.yourNextMove||"").replace(/\*\*/g,"").trim();
    const nms=nm.split(".")[0]+".";
    // EXEC SUMMARY
    secHd("00 · EXECUTIVE SUMMARY","Your strategy at a glance.","The complete picture in under sixty seconds.");
    if(position){doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("CURRENT POSITION",ML,y);y+=3.5;body(position);}
    if(blindTitle){doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");chk(4);doc.text("PRIMARY CHALLENGE",ML,y);y+=3.5;body(blindTitle);}
    if(succ[0]){doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");chk(4);doc.text("PRIMARY GOAL",ML,y);y+=3.5;body(succ[0]);}
    if(nms){doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");chk(4);doc.text("TODAY'S NEXT MOVE",ML,y);y+=3.5;body(nms);}
    rule();
    // ASSESSMENT
    secHd("01 · STRATEGIC ASSESSMENT","Where you are today.","What we discovered from your answers.");
    if(mainExec)body(mainExec);
    const sl=execLines.find(l=>l.match(/^strength/i))||"";
    const tl=execLines.find(l=>l.match(/^what needs/i))||"";
    if(sl){chk(8);doc.setFontSize(8);doc.setTextColor(...SAGE);doc.setFont("helvetica","bold");doc.text("STRENGTHS",ML,y);y+=4;body(cleanStr(sl));}
    if(tl){chk(8);doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("WHAT NEEDS ATTENTION",ML,y);y+=4;body(cleanStr(tl));}
    rule();
    // CHALLENGE
    secHd("02 · PRIMARY CHALLENGE","The core constraint.","The main issue making progress harder right now.");
    if(blindTitle){doc.setFontSize(13);doc.setTextColor(...DARK);doc.setFont("helvetica","bolditalic");chk(8);doc.text('"'+blindTitle+'"',ML,y);y+=8;}
    const blindBody=blindRaw.replace(insM?.[0]||"","").replace(/^[^.]+\./,"").trim();
    if(blindBody)body(blindBody);
    if(insight){chk(14);doc.setFillColor(240,235,232);doc.rect(ML,y,CW,12,"F");doc.setFontSize(7);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("THE INSIGHT",ML+3,y+4);doc.setFontSize(9);doc.setTextColor(...DARK);doc.setFont("helvetica","bolditalic");doc.text('"'+insight+'"',ML+3,y+9);y+=14;}
    rule();
    // OPPORTUNITY
    secHd("03 · BEST OPPORTUNITY","Where to focus your energy.","The areas most likely to move the needle.");
    let on=0;rawLines(result.strategicOpportunity||"").forEach(l=>{const b=l.match(/^\*\*(.+?)\*\*[:\s]*(.*)/);if(b){on++;chk(15);doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("0"+on+"  "+b[1],ML,y);y+=4;if(b[2])body(cleanStr(b[2]),6);}else if(l.trim())body(cleanStr(l),6);});
    rule();
    // ACTIONS
    secHd("04 · RECOMMENDED ACTIONS","Where to direct your energy.","In priority order.");
    const caps=["BEGIN TODAY","WITHIN 3 DAYS","WITHIN 5 DAYS","WITHIN 2 WEEKS","WITHIN 2 WEEKS"];
    let an=0;
    rawLines(result.recommendedActions||"").forEach(l=>{const b=l.match(/^\*\*(.+?)\*\*[:\s]*(.*)/)||l.match(/^\d+\.\s*\*\*(.+?)\*\*[:\s]*(.*)/);const wy=l.match(/\*Why this matters:?\*?\s*(.*)/i);if(b&&an<5){chk(20);doc.setFontSize(13);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("0"+(an+1),ML,y);doc.setFontSize(11);doc.setTextColor(...DARK);doc.text(b[1],ML+10,y);y+=4.3;doc.setFontSize(6.5);doc.setTextColor(...MUTED);doc.setFont("helvetica","normal");doc.text(caps[an]||"ONGOING",ML+10,y);y+=4.2;if(b[2])body(cleanStr(b[2]),10);an++;}else if(wy){doc.setFontSize(9);doc.setTextColor(...ACCENT);doc.setFont("helvetica","italic");wrap("→ "+wy[1],ML+10,CW-10).forEach(l=>{chk(5);doc.text(l,ML+10,y);y+=4.5;});y+=1;}});
    rule();
    // 30-DAY PLAN
    secHd("05 · 30-DAY PLAN","Your week-by-week roadmap.","Concrete actions for the next 30 days.");
    const wths=["Foundation","Momentum","Activation","Scale & Review"];
    const wgls=["Establish your foundation","Build momentum","Execute and activate","Review and scale"];
    const whs=[...(result.priorityPlan||"").matchAll(/week\s*([1-4])[:\s\-–]*([\s\S]*?)(?=week\s*[1-4]|$)/gi)];
    const wd=["","","",""];whs.forEach(m=>{const i=parseInt(m[1])-1;if(i>=0&&i<4)wd[i]=m[2].trim();});
    wd.forEach((w,i)=>{chk(19);doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("WEEK "+(i+1)+" · "+wths[i].toUpperCase(),ML,y);y+=4;doc.setFontSize(9);doc.setTextColor(...MUTED);doc.setFont("helvetica","normal");doc.text(wgls[i],ML,y);y+=4;w.split(/[\/\n]/).map(t=>cleanStr(t)).filter(Boolean).slice(0,4).forEach(t=>{chk(5);doc.setFontSize(9);doc.setTextColor(...INK);doc.text("·  "+t,ML+4,y);y+=4.5;});y+=1.5;});
    rule();
    // LOOKING AHEAD
    secHd("06 · LOOKING AHEAD","What becomes possible next.","What to build toward after your first 30 days.");
    let ln=0;rawLines(result.longTermGrowth||"").forEach(l=>{const b=l.match(/^\*\*(.+?)\*\*[:\s]*(.*)/);if(b){ln++;chk(15);doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("0"+ln+"  "+b[1],ML,y);y+=4;if(b[2])body(cleanStr(b[2]),6);}else if(l.trim())body(cleanStr(l),6);});
    rule();
    // SUCCESS
    if(succ.length){secHd("07 · WHAT SUCCESS LOOKS LIKE","Measurable milestones.","How you will know this strategy is working.");succ.slice(0,3).forEach(s=>{chk(8);doc.setFontSize(8);doc.setTextColor(...SAGE);doc.setFont("helvetica","bold");doc.text("○",ML,y);doc.setFontSize(10);doc.setTextColor(...INK);doc.setFont("helvetica","normal");wrap(s.trim(),ML+5,CW-5).forEach(l=>{chk(5);doc.text(l,ML+5,y);y+=4.5;});y+=2;});rule();}
    // NEXT MOVE — box height computed from actual content, never clips or overflows
    const nmQuoteLines=wrap('"'+nms+'"',ML,CW);
    const nmBoxH=10+(nmQuoteLines.length*7)+3+12;
    chk(nmBoxH+4);doc.setFillColor(...DARK);doc.rect(0,y-4,W,nmBoxH,"F");doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("08 · YOUR NEXT MOVE",ML,y);y+=4.5;doc.setFontSize(9);doc.setTextColor(176,114,138);doc.setFont("helvetica","italic");doc.text("The single most important action you should take today",ML,y);y+=5.5;doc.setFontSize(14);doc.setTextColor(255,255,255);doc.setFont("helvetica","bolditalic");nmQuoteLines.forEach(l=>{doc.text(l,ML,y);y+=7;});y+=3;
    [["TIME REQUIRED","Today"],["PRIORITY","Highest"],["EXPECTED IMPACT","High"]].forEach(([lbl,val],i)=>{const mx=ML+i*(CW/3);doc.setFontSize(7);doc.setTextColor(90,85,80);doc.setFont("helvetica","bold");doc.text(lbl,mx,y);doc.setFontSize(10);doc.setTextColor(160,154,148);doc.setFont("helvetica","normal");doc.text(val,mx,y+4);});y+=12;
    // CLOSING NOTE — stays on current page if room allows, avoiding a wasted near-empty page
    if(y+50>H-14){doc.addPage();pageNum++;y=ML+20;footer();}else{rule();y+=6;}
    doc.setFontSize(8);doc.setTextColor(...ACCENT);doc.setFont("helvetica","bold");doc.text("YOUR NEXT MOVE",ML,y);y+=6;
    doc.setFontSize(10);doc.setTextColor(...INK);doc.setFont("helvetica","normal");doc.text("This strategy was built specifically for you.",ML,y);y+=6;
    doc.setFontSize(9);doc.setTextColor(...MUTED);doc.text("Return to My Strategies to review and continue building on this plan.",ML,y);y+=6;
    doc.text("Generated "+meta.today+" · Your Next Move by Chat It Up",ML,y);
    const safe=(meta.firstName||"My").replace(/[^a-zA-Z0-9]/g,"_");
    doc.save("YourNextMove_"+safe+"_Strategy.pdf");
  } catch(err) { console.error("PDF generation failed:",err); window.print(); }
}


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
  const [editSection,  setEditSection]  = useState(null);
  const [editDraft,    setEditDraft]    = useState("");
  const [fbDone,       setFbDone]       = useState(false);
  const [pdfUnlocked,  setPdfUnlocked]  = useState(false);
  const [strategyStage, setStrategyStage] = useState('reading'); // reading | saved | feedback | complete
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [fbRating,     setFbRating]     = useState(null);
  const [fbAns,        setFbAns]        = useState({});
  const [autoSaved,    setAutoSaved]    = useState(false);
  const [shortWarn,    setShortWarn]    = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Industry Hub state
  const [hubCatId,     setHubCatId]     = useState(null);
  const [hubSearchResult, setHubSearchResult] = useState(null);
  const [hubSearchLoading, setHubSearchLoading] = useState(false);
  const [hubSearchQuery, setHubSearchQuery] = useState("");
  const [hubSearch,    setHubSearch]    = useState("");
  const [hubQuestion,  setHubQuestion]  = useState(null);
  const [hubContext,   setHubContext]   = useState("");

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
    loadUserState();loadSavedPlans();
    const p=new URLSearchParams(window.location.search);
    if(p.get("subscribed")==="1"){setStripeSuccess(true);saveSubState(true);window.history.replaceState({},"",window.location.pathname);}
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
    setViewingPlanId(null);setShowPaywall(false);setEditSection(null);
    setFbDone(false);setFbRating(null);setFbAns({});setShortWarn(false);setStrategyStage('reading');
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
  function openSavedPlan(plan){setCatId(plan.catId);setIndustry(plan.industry);setJourneyStage(plan.journeyStage||null);setResult(plan.result);setViewingPlanId(plan.id);setStrategyStage('reading');setFbDone(false);setPdfUnlocked(false);go("results");}
  function startEdit(key,val){setEditSection(key);setEditDraft(val||"");}
  function cancelEdit(){setEditSection(null);setEditDraft("");}
  function saveEdit(key){
    const updated={...result,[key]:editDraft};setResult(updated);setEditSection(null);
    if(viewingPlanId){window.storage.get(`plan:${viewingPlanId}`).then(raw=>{if(raw){const plan=JSON.parse(raw.value);plan.result=updated;window.storage.set(`plan:${viewingPlanId}`,JSON.stringify(plan));}}).catch(()=>{});}
  }

  async function generate(){
    if(!isSubscribed&&savedPlans.length>=FREE_PLAN_LIMIT){setShowPaywall(true);return;}
    setShowPaywall(false);setLoading(true);setError(null);go("loading");
    const qa=qs.map((q,i)=>{const a=answers[i];return`Q: ${q.q}\nA: ${Array.isArray(a)?a.join(", "):(a||"Not specified")}`;}).join("\n\n");

    const prompt=`You are a senior strategist delivering a concise, premium strategy report. Think McKinsey meets a trusted mentor. Every word earns its place. No filler. No generic advice. No sentences that could apply to anyone other than this exact person.

STRICT RULES — violating these fails the output:
1. CONCISE: The entire report must be readable in 6-8 minutes. If a section feels long, cut it in half.
2. SPECIFIC: Every sentence must be specific to this person's industry, stage, and actual answers. Test: could this sentence appear in a strategy for someone in a different industry? If yes, rewrite it.
3. NO AI VOICE: Write like a sharp human advisor. Not "It's important to..." or "Consider..." — say what to do and why.
4. THE INSIGHT: One sentence in Primary Challenge that is so precise it makes the person think "how did they know that." This is the sentence they screenshot.
5. COMPLETE ALL 8: A short complete report beats a long incomplete one. Finish all 8 sections even if brief.

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
      }catch(saveErr){
        // Save failed — log it but don't block the user from seeing their strategy
        console.error("Strategy save failed (non-fatal):",saveErr.message);
      }

      // STEP 7: Navigate to results — always happens if we got here
      go("results");

    }catch(e){
      // Log the full technical error for debugging
      console.error("Strategy generation failed:",e.message,e.stack);
      const msg=e.message||"";
      let userMsg="Something went wrong generating your strategy. Your answers are saved — please try again.";
      if(msg.includes("TIMEOUT:"))userMsg="Your strategy took longer than expected. Your answers are saved — please try again.";
      else if(msg.includes("AUTH:"))userMsg="There was a connection issue. Please check your internet and try again.";
      else if(msg.includes("API:"))userMsg="We couldn't reach the strategy service. Your answers are saved — please try again.";
      else if(msg.includes("EMPTY:")||msg.includes("PARSE:"))userMsg="Your strategy was generated but couldn't be displayed. Please try again — this usually resolves immediately.";
      setError(userMsg);
      go("questions");
    }finally{setLoading(false);}
  }

  async function askAdvisor(question){
    if(!question.trim())return;
    setAdvisorLoading(true);setAdvisorResult(null);
    const context=savedPlans[0]?`User context: ${CATEGORIES.find(c=>c.id===savedPlans[0].catId)?.label} focus, ${savedPlans[0].industry} industry, ${savedPlans[0].journeyStage} stage.`:"";
    const prompt=`You are a trusted personal advisor. You are warm, direct, and speak plainly. You have deep knowledge across business, careers, finance, real estate, marketing, leadership, and personal development. You respond like a brilliant friend who happens to know everything — not like an AI assistant.

CRITICAL RULES:
1. NO BULLET POINTS. No numbered lists. Write in natural flowing sentences and paragraphs only.
2. ONE CLEAR OPINION. Do not present multiple options and let them choose. Pick the best path and advocate for it.
3. NEVER ASSUME. The person may have a corporate job, a side business, multiple income streams, or none. Respond only to what they actually said.
4. BE DIRECT. Say what you think. "I think you should..." not "You might want to consider..."
5. FEEL HUMAN. Read like someone who knows this person, not a chatbot completing a template.
6. SHORT ENOUGH TO READ. The whole response should take 60-90 seconds to read. Cut anything that doesn't add value.

${firstName?`The person's name is ${firstName}. Use it once naturally — not at the start of every section.`:""} ${context}

Their question or situation: ${question}

Respond with exactly these four sections. Write each section as flowing prose — never as a list.

**What I'm hearing**
One to two sentences reflecting what they said back to them. Make them feel understood before you give any advice.

**Here's what I think**
Two to four sentences. Your direct recommendation. Take a position. Be specific to their exact situation — not general career advice.

**What this means for you**
One to two sentences on why this matters right now for their specific situation. Connect it to something they mentioned.

**Your single next move**
One sentence. The single most important action to take in the next 24 hours. Be specific — not a category, an actual action.`;

    try{
      const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      if(!res.ok)throw new Error("Failed to get response");
      const data=await res.json();
      const text=data.text||"";
      // Parse the advisor response
      const hearingMatch=text.match(/\*\*What I'm hearing\*\*\s*([\s\S]*?)(?=\*\*Here's what I think\*\*|\*\*Direct Answer\*\*|$)/i);
      const thinkMatch=text.match(/\*\*Here's what I think\*\*\s*([\s\S]*?)(?=\*\*What this means\*\*|\*\*Why It Matters\*\*|$)/i);
      const meansMatch=text.match(/\*\*What this means for you\*\*\s*([\s\S]*?)(?=\*\*Your single next move\*\*|\*\*Do This First\*\*|$)/i);
      const moveMatch=text.match(/\*\*Your single next move\*\*\s*([\s\S]*?)(?=$)/i);
      // Fallback to old format
      const directMatch=text.match(/\*\*Direct Answer\*\*\s*([\s\S]*?)(?=\*\*Why It Matters\*\*|$)/i);
      const whyMatch=text.match(/\*\*Why It Matters\*\*\s*([\s\S]*?)(?=\*\*Next Steps\*\*|$)/i);
      const stepsMatch=text.match(/\*\*Next Steps\*\*\s*([\s\S]*?)(?=\*\*Do This First\*\*|$)/i);
      const firstMatch=text.match(/\*\*Do This First\*\*\s*([\s\S]*?)(?=$)/i);
      const parsed={
        hearing:(hearingMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        think:(thinkMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        means:(meansMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        move:(moveMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        direct:(directMatch?.[1]||hearingMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        why:(whyMatch?.[1]||thinkMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        steps:lines((stepsMatch?.[1]||"").replace(/\*\*/g,"")).map(l=>l.replace(/^\d+\.\s*/,"").trim()).filter(Boolean),
        first:(firstMatch?.[1]||moveMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        raw:text.replace(/\*\*/g,"").trim(),
        question,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      };
      setAdvisorResult(parsed);
      const newHistory=[parsed,...advisorHistory].slice(0,10);
      setAdvisorHistory(newHistory);
      try{localStorage.setItem("advisor-history",JSON.stringify(newHistory));}catch(e){}
    }catch(e){setAdvisorResult({error:"We hit a snag on our end. Your question is saved — try again when you're ready.",question,date:""});}
    finally{setAdvisorLoading(false);}
  }

  async function askHubSearch(query){
    if(!query.trim())return;
    setHubSearchLoading(true);setHubSearchResult(null);
    const context=savedPlans[0]?`User context: ${CATEGORIES.find(c=>c.id===savedPlans[0].catId)?.label} focus, ${savedPlans[0].industry} industry.`:"";
    const prompt=`You are an expert consultant delivering a professional resource. Every response should feel like it was created by a senior advisor with 20 years of experience in this exact topic — not generated by a tool.

${firstName?`This is for ${firstName}.`:""} ${context}

Request: ${query}

STEP 1 — Classify this request:
- Is this a KNOWLEDGE question (what is X, how does X work, define X)? → Write 2-3 clear explanatory paragraphs with a bold header. No lists needed unless they add clarity.
- Is this a CHECKLIST or TEMPLATE request (create a checklist, give me a template)? → Deliver a numbered checklist or template immediately. Clean, complete, ready to use.
- Is this a STRATEGY or PLAN request? → Deliver a structured response with clear sections: Situation Overview, Key Recommendations, Action Steps, What to Watch For.
- Is this a COMPARISON or DECISION? → Use a clear comparison format. Give a recommendation at the end.
- Is this a GENERAL professional question? → Answer directly and practically in 3-4 paragraphs.

STEP 2 — Write the response:
Use the right format for the request type above. Do not force every response into the same structure.

Every response must be:
- Professional in tone — like reading a consultant's memo
- Specific — not generic advice that applies to everyone
- Actionable — the person should know exactly what to do
- Complete — do not cut off before finishing

End every response with:

**Your First Step**
One sentence. The single most concrete action to take right now.`;

    try{
      const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      if(!res.ok)throw new Error("Failed");
      const data=await res.json();
      const text=data.text||"";
      const frameworkMatch=text.match(/\*\*The Framework\*\*\s*([\s\S]*?)(?=\*\*Applied to Your Situation\*\*|$)/i);
      const appliedMatch=text.match(/\*\*Applied to Your Situation\*\*\s*([\s\S]*?)(?=\*\*Step-by-Step\*\*|$)/i);
      const stepsMatch=text.match(/\*\*Step-by-Step\*\*\s*([\s\S]*?)(?=\*\*Common Mistakes\*\*|$)/i);
      const mistakesMatch=text.match(/\*\*Common Mistakes\*\*\s*([\s\S]*?)(?=\*\*Your Starting Point\*\*|$)/i);
      const startMatch=text.match(/\*\*Your Starting Point\*\*\s*([\s\S]*?)(?=$)/i);
      // Smart format detection
      const hasStructured = frameworkMatch||appliedMatch||stepsMatch;
      // Parse title from response
      const titleMatch = text.match(/^#+\s*(.+)|^\*\*(.+?)\*\*/);
      const responseTitle = titleMatch?(titleMatch[1]||titleMatch[2]||"").replace(/\*\*/g,"").trim():"";
      // Get first step from various formats
      const firstStepMatch = text.match(/\*\*Your First Step\*\*\s*([\s\S]*?)(?=$)/i);
      setHubSearchResult({
        query,
        isPlaybook: !!hasStructured,
        rawText: !hasStructured ? text.replace(/\*\*/g,"").trim() : "",
        responseTitle,
        framework:(frameworkMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        applied:(appliedMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        steps:lines((stepsMatch?.[1]||"").replace(/\*\*/g,"")).map(l=>l.replace(/^\d+\.\s*/,"").trim()).filter(Boolean),
        mistakes:lines((mistakesMatch?.[1]||"").replace(/\*\*/g,"")).map(l=>l.replace(/^\d+\.\s*/,"").trim()).filter(Boolean),
        start:(firstStepMatch?.[1]||startMatch?.[1]||"").replace(/\*\*/g,"").trim(),
      });
    }catch(e){setHubSearchResult({query,error:"We hit a snag on our end. Please try again in a moment."});}
    finally{setHubSearchLoading(false);}
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  const hubCat = HUB_CATEGORIES.find(c=>c.id===hubCatId);
  const filteredQuestions = hubCat?.questions.filter(q=>
    !hubSearch||q.title.toLowerCase().includes(hubSearch.toLowerCase())||q.description.toLowerCase().includes(hubSearch.toLowerCase())
  )||[];

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
          <p style={{fontSize:12,color:"#A8A29E"}}>First strategy free · Then $19/month · Cancel anytime</p>
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
                <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.22em",textTransform:"uppercase",color:c.accent?"#5A5350":"#C4B5AD",marginBottom:16}}>{c.num==="01"?"PLAN":c.num==="02"?"DECIDE":"LEARN"}</div>
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
            <h3 style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(20px,3vw,28px)",fontWeight:600,color:"#fff",marginBottom:16,letterSpacing:"-0.01em",lineHeight:1.2}}>Here's what your personalized strategy looks like</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:2,marginBottom:20}}>
              {[
                {num:"01",label:"Strategic Assessment",preview:"Where you are today and the most important pattern in your answers."},
                {num:"02",label:"Primary Challenge",preview:"'The real issue isn't your offer — it's that you've been optimizing for the wrong client entirely.'"},
                {num:"03",label:"Best Opportunity",preview:"The highest-leverage move available to you right now given your industry and stage."},
                {num:"05",label:"30-Day Plan",preview:"Week 1: Foundation → Week 2: Momentum → Week 3: Activation → Week 4: Scale"},
              ].map((s,i)=>(
                <div key={i} style={{background:"#201918",padding:"16px 18px",border:"1px solid #2A2522"}}>
                  <p style={{fontSize:10,fontWeight:600,letterSpacing:"0.2em",textTransform:"uppercase",color:"#5A4A42",marginBottom:6}}>{s.num}</p>
                  <p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:600,color:i===1?"#E8C4D4":"#C4A0B0",marginBottom:6,lineHeight:1.2}}>{s.label}</p>
                  <p style={{fontSize:12,color:"#6A6060",lineHeight:1.6,fontWeight:300,fontStyle:i===1?"italic":"normal"}}>{s.preview}</p>
                </div>
              ))}
            </div>
            <p style={{fontSize:12,color:"#5A5350",fontStyle:"italic"}}>Your strategy will be built around your specific industry, goals, and situation — not a template.</p>
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
                <button className="btn" disabled={!answered(qIdx)} onClick={nextQ}>{qIdx<qs.length-1?"Next →":"Build My Strategy →"}</button>
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
        <p className="hub-sub">Browse curated questions built specifically for your industry. Each one is pre-researched and ready to go — just add your context and get a focused answer.</p>
        {/* Global search on landing page too */}
        <div style={{marginBottom:32}}>
          <div style={{position:"relative",display:"flex",gap:0}}>
            <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#C4B5AD",fontSize:15,zIndex:1}}>⌕</div>
            <input
              className="hub-search"
              style={{marginBottom:0,paddingLeft:44,paddingRight:120,borderRadius:"6px 0 0 6px",flex:1}}
              placeholder="Search prompts or ask any business question…"
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
          <p style={{fontSize:12,color:"#A8A29E",marginTop:7,fontStyle:"italic"}}>Search 164 professional prompts, or press Ask → for an intelligent answer to any question</p>
        </div>
        {hubSearchLoading&&<div style={{textAlign:"center",padding:"32px 0"}}><div className="load-ring" style={{margin:"0 auto 14px"}}/><p style={{fontSize:13,color:"#78716C"}}>Finding your answer…</p></div>}
        {hubSearchResult&&!hubSearchResult.error&&(
          <div style={{marginBottom:28,border:"1px solid #EEEAE7",borderRadius:6,overflow:"hidden"}}>
            <div style={{background:"#1A1916",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><p style={{fontSize:9,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#C4A0B0",marginBottom:4}}>Expert Response</p><p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:500,color:"#fff"}}>"{hubSearchResult.query}"</p></div>
              <button onClick={()=>{setHubSearchResult(null);setHubSearchQuery("");}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:100,padding:"5px 14px",color:"#A8A29E",fontSize:10,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Clear</button>
            </div>
            {hubSearchResult.framework&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FAFAF8"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>The Framework</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.framework}</p></div>}
            {hubSearchResult.applied&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Applied to Your Situation</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.applied}</p></div>}
            {hubSearchResult.steps?.length>0&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:12}}>Step-by-Step</p><div style={{display:"flex",flexDirection:"column",gap:10}}>{hubSearchResult.steps.map((s,i)=><div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:24,height:24,borderRadius:"50%",background:"#1A1916",color:"#fff",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div><p style={{fontSize:14,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{s}</p></div>)}</div></div>}
            {hubSearchResult.mistakes?.length>0&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FEF9F6"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#B8936A",marginBottom:12}}>Common Mistakes</p><div style={{display:"flex",flexDirection:"column",gap:8}}>{hubSearchResult.mistakes.map((m,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"#B8936A",fontSize:14,fontWeight:700,flexShrink:0}}>!</span><p style={{fontSize:13,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{m}</p></div>)}</div></div>}
            {!hubSearchResult.isPlaybook&&hubSearchResult.rawText&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300,whiteSpace:"pre-wrap"}}>{hubSearchResult.rawText}</p></div>}
            {hubSearchResult.start&&<div style={{padding:"18px 22px",background:"#FAFAF8",borderTop:"2px solid #1A1916"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Your Starting Point</p><p style={{fontSize:15,color:"#1A1916",fontWeight:600,lineHeight:1.5,fontFamily:"'Cormorant',serif"}}>{hubSearchResult.start}</p></div>}
          </div>
        )}

        <h2 style={{fontFamily:"'Cormorant',serif",fontSize:20,fontWeight:600,color:"#1C1917",marginBottom:16,letterSpacing:"-0.01em"}}>Browse by Industry</h2>
        <div className="hub-grid">
          {HUB_CATEGORIES.map(c=>(
            <div key={c.id} className="hub-card" onClick={()=>{setHubCatId(c.id);setHubSearch("");setHubSearchQuery("");setHubSearchResult(null);setHubQuestion(null);setHubContext("");}}>
              <div style={{fontFamily:"'Cormorant',serif",fontSize:13,fontWeight:600,color:"#C4B5AD",letterSpacing:"0.06em",marginBottom:10}}>{c.icon}</div>
              <div className="hub-card-label">{c.label}</div>
              <div className="hub-card-desc">{c.description}</div>
              <div className="hub-card-cta">Explore prompts →</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ══ HUB — QUESTION LIST ══ */}
    {screen==="hub"&&hubCatId&&!hubQuestion&&(
      <div className="hub-q-page">
        <div className="bc"><span onClick={restart}>Home</span><span className="bc-sep">›</span><span onClick={()=>setHubCatId(null)}>Industry Hub</span></div>
        <button className="btn-out" style={{marginBottom:20,fontSize:10,padding:"8px 18px"}} onClick={()=>setHubCatId(null)}>← Back to Industry Hub</button>
        <h1 className="hub-q-h1">{hubCat?.label}</h1>
        <p className="hub-q-sub">{
          hubCat?.id==="entrepreneurship"?"Explore professionally curated prompts designed to help you launch, grow, and scale your business — from your first business plan to building systems, finding clients, and creating long-term value.":
          hubCat?.id==="corporate"?"Explore professionally curated prompts designed to strengthen your leadership, accelerate your career, improve communication, manage teams, and build lasting professional influence.":
          hubCat?.id==="creative"?"Explore professionally curated prompts designed to help you grow your brand, attract your audience, create compelling content, land partnerships, and build a sustainable creative career.":
          hubCat?.id==="realestate"?"Explore professionally curated prompts designed to help you buy, sell, invest, negotiate, analyze properties, build your client base, and make more confident real estate decisions.":
          hubCat?.id==="finance"?"Explore professionally curated prompts designed to help you build wealth, manage debt, budget smarter, invest wisely, and make better financial decisions for your life and business.":
          hubCat?.id==="education"?"Explore professionally curated prompts designed to help you design better learning experiences, master new subjects, advance your teaching career, and build programs that create real impact.":
          hubCat?.id==="nonprofit"?"Explore professionally curated prompts designed to help you grow your organization, secure funding, engage donors, measure impact, and create lasting community change.":
          hubCat?.id==="wellness"?"Explore professionally curated prompts designed to help you build sustainable health habits, improve nutrition, manage stress, optimize energy, and create a whole-life wellness practice.":
          hubCat?.id==="healthcare"?"Explore professionally curated prompts designed to help you advance your healthcare career, build your practice, improve patient outcomes, and make confident professional decisions.":
          "Select a prompt below. Add your context and get a professional, actionable response tailored to your situation."
        }</p>
        {/* AI-POWERED SEARCH BAR */}
        <div style={{marginBottom:28}}>
          <div style={{position:"relative",display:"flex",gap:0}}>
            <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#C4B5AD",fontSize:15,zIndex:1}}>⌕</div>
            <input
              className="hub-search"
              style={{marginBottom:0,paddingLeft:44,paddingRight:120,borderRadius:"6px 0 0 6px",flex:1}}
              placeholder="Search our prompt library — or ask any question…"
              value={hubSearchQuery||hubSearch}
              onChange={e=>{const v=e.target.value;setHubSearchQuery(v);setHubSearch(v);setHubSearchResult(null);}}
              onKeyDown={e=>{if(e.key==="Enter"&&(hubSearchQuery||hubSearch).trim()){askHubSearch(hubSearchQuery||hubSearch);}}}
            />
            <button
              onClick={()=>{const q=hubSearchQuery||hubSearch;if(q.trim())askHubSearch(q);}}
              disabled={hubSearchLoading||!(hubSearchQuery||hubSearch).trim()}
              style={{padding:"0 20px",background:"#1A1916",color:"#fff",border:"none",borderRadius:"0 6px 6px 0",fontSize:11,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"background 0.2s"}}
              onMouseEnter={e=>e.target.style.background="#B0728A"}
              onMouseLeave={e=>e.target.style.background="#1A1916"}
            >
              {hubSearchLoading?"Searching…":"Ask →"}
            </button>
          </div>
          <p style={{fontSize:11,color:"#A8A29E",marginTop:7,fontStyle:"italic"}}>Press Enter or click Ask → to get a full expert answer to any question</p>
        </div>

        {/* AI SEARCH RESULT */}
        {hubSearchLoading&&(
          <div style={{textAlign:"center",padding:"32px 0",marginBottom:24}}>
            <div className="load-ring" style={{margin:"0 auto 14px"}}/>
            <p style={{fontSize:13,color:"#78716C"}}>Finding your answer…</p>
          </div>
        )}
        {hubSearchResult&&!hubSearchResult.error&&(
          <div style={{marginBottom:28,border:"1px solid #EEEAE7",borderRadius:6,overflow:"hidden"}}>
            <div style={{background:"#1A1916",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#C4A0B0",marginBottom:4}}>Expert Response</p>
                <p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:500,color:"#fff",lineHeight:1.3}}>"{hubSearchResult.query}"</p>
              </div>
              <button onClick={()=>{setHubSearchResult(null);setHubSearchQuery("");setHubSearch("");}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:100,padding:"5px 14px",color:"#A8A29E",fontSize:10,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",letterSpacing:"0.08em",textTransform:"uppercase"}}>Clear</button>
            </div>
            {hubSearchResult.framework&&(
              <div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FAFAF8"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>The Framework</p>
                <p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.framework}</p>
              </div>
            )}
            {hubSearchResult.applied&&(
              <div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Applied to Your Situation</p>
                <p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.applied}</p>
              </div>
            )}
            {hubSearchResult.steps?.length>0&&(
              <div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:12}}>Next Steps</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {hubSearchResult.steps.map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"#B0728A",color:"#fff",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div>
                      <p style={{fontSize:13,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hubSearchResult.mistakes?.length>0&&(
              <div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FEF9F6"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#B8936A",marginBottom:12}}>Common Mistakes</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {hubSearchResult.mistakes.map((m,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <span style={{color:"#B8936A",fontSize:14,fontWeight:700,flexShrink:0}}>!</span>
                      <p style={{fontSize:13,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{m}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!hubSearchResult.isPlaybook&&hubSearchResult.rawText&&(
              <div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}>
                <p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300,whiteSpace:"pre-wrap"}}>{hubSearchResult.rawText}</p>
              </div>
            )}
            {hubSearchResult.start&&(
              <div style={{padding:"18px 22px",background:"#FAFAF8"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Your Starting Point</p>
                <p style={{fontSize:14,color:"#1A1916",fontWeight:500,lineHeight:1.6}}>{hubSearchResult.start}</p>
              </div>
            )}
          </div>
        )}
        {hubSearchResult?.error&&<div className="err" style={{marginBottom:20}}>⚠ {hubSearchResult.error}</div>}
        <div className="hub-q-grid">
          {filteredQuestions.map(q=>(
            <div key={q.id} className="hub-q-card" onClick={()=>{setHubQuestion(q);setHubContext("");setAdvisorResult(null);}}>
              <div className="hub-q-card-tag">{hubCat?.label}</div>
              <div className="hub-q-card-title">{q.question.length > 80 ? q.question.substring(0,78)+"…" : q.question}</div>

              <div className="hub-q-card-cta">Use this prompt →</div>
            </div>
          ))}
          {filteredQuestions.length===0&&<p style={{color:"#A8A29E",fontSize:13,padding:"20px 0"}}>No questions match your search.</p>}
        </div>
      </div>
    )}

    {/* ══ HUB — QUESTION DETAIL ══ */}
    {screen==="hub"&&hubCatId&&hubQuestion&&(
      <div className="advisor-page">
        <div className="bc">
          <span onClick={restart}>Home</span><span className="bc-sep">›</span>
          <span onClick={()=>setHubQuestion(null)}>Industry Hub</span><span className="bc-sep">›</span>
          <span onClick={()=>setHubQuestion(null)}>{hubCat?.label}</span>
        </div>
        <h1 className="advisor-h1"><em>{hubQuestion.title}</em></h1>
        <p className="advisor-sub">Add your personal context below — then get your guidance.</p>
        <textarea
          className="advisor-ta"
          rows={5}
          placeholder={hubQuestion.question.replace("{context}","tell us about your specific situation — your industry, where you are, and what you are dealing with")}
          value={hubContext}
          onChange={e=>setHubContext(e.target.value)}
        />
        <p className="advisor-hint">The more context you add, the more specific your answer will be.</p>
        <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
          <button className="btn" disabled={advisorLoading||!hubContext.trim()} onClick={()=>askAdvisor(hubQuestion.question + (hubContext.trim() ? " Here is my specific context: " + hubContext.trim() : ""))}>
            {advisorLoading?"Generating your answer…":"Build My Playbook →"}
          </button>
          <button className="btn-out" onClick={()=>setHubQuestion(null)}>← Back to questions</button>
        </div>
        {advisorLoading&&(
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div className="load-ring" style={{margin:"0 auto 16px"}}/>
            <p style={{fontSize:13,color:"#78716C"}}>{firstName?firstName+", your":"Your"} advisor is thinking…</p>
          </div>
        )}
        {advisorResult&&!advisorResult.error&&(
          <div className="advisor-result">
            <div className="advisor-result-header" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div className="advisor-result-eye" style={{marginBottom:6}}>Your Advisor</div>
                <p style={{fontFamily:"'Cormorant',serif",fontSize:15,fontStyle:"italic",color:"#8A7E78",lineHeight:1.4}}>"{advisorResult.question.length>60?advisorResult.question.substring(0,58)+"…":advisorResult.question}"</p>
              </div>
            </div>
            {advisorResult.hearing&&(
              <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                <div className="advisor-result-label" style={{color:"#A8A29E"}}>What I'm Hearing</div>
                <div className="advisor-result-text" style={{fontStyle:"italic",color:"#57534E"}}>{advisorResult.hearing}</div>
              </div>
            )}
            {advisorResult.think&&(
              <div className="advisor-result-section">
                <div className="advisor-result-label" style={{color:"#1A1916"}}>Here's What I Think</div>
                <div className="advisor-result-text">{advisorResult.think}</div>
              </div>
            )}
            {advisorResult.means&&(
              <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                <div className="advisor-result-label" style={{color:"#A8A29E"}}>What This Means For You</div>
                <div className="advisor-result-text">{advisorResult.means}</div>
              </div>
            )}
            {(advisorResult.move||advisorResult.first)&&(
              <div className="advisor-result-section" style={{borderTop:"2px solid #B0728A"}}>
                <div className="advisor-result-label" style={{color:"#B0728A"}}>Your Single Next Move</div>
                <div className="advisor-result-text" style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:600,color:"#1A1916",lineHeight:1.4}}>{advisorResult.move||advisorResult.first}</div>
              </div>
            )}
            {!advisorResult.hearing&&!advisorResult.think&&!advisorResult.means&&!advisorResult.move&&!advisorResult.first&&advisorResult.raw&&(
              <div className="advisor-result-section">
                <div className="advisor-result-text" style={{whiteSpace:"pre-wrap"}}>{advisorResult.raw}</div>
              </div>
            )}
            {/* Follow-up prompt */}
            <div style={{padding:"16px 24px",background:"#FAFAF8",borderTop:"1px solid #EEEAE7"}}>
              <p style={{fontSize:13,color:"#A8A29E",fontStyle:"italic"}}>Does this resonate? Ask a follow-up or try a different question above.</p>
            </div>
          </div>
        )}
        {advisorResult?.error&&<div className="err">⚠ {advisorResult.error}</div>}
      </div>
    )}

    {/* ══ ASK YOUR ADVISOR ══ */}
    {screen==="advisor"&&(
      <div className="advisor-page">
        <div className="bc"><span onClick={restart}>Home</span></div>
        <h1 className="advisor-h1">Ask Your <em>Advisor.</em></h1>
        <p className="advisor-sub">Need help making a decision? Working through a challenge? Not sure what to do next? Describe your situation and get a direct, honest response — like talking to a trusted advisor who actually understands your world.</p>
        <div style={{display:"flex",gap:24,marginBottom:28,flexWrap:"wrap"}}>
          {[{label:"Use this when",items:["You're weighing a specific decision","Something happened and you need to think it through","You want a second opinion before you act","You have one burning question"]},{label:"Use Industry Hub instead when",items:["You need a framework or process","You want to browse prompts for your field","You need a structured playbook, not a conversation"]}].map((col,i)=>(
            <div key={i} style={{flex:1,minWidth:200}}>
              <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.16em",textTransform:"uppercase",color:i===0?"#B0728A":"#A8A29E",marginBottom:8}}>{col.label}</p>
              {col.items.map((item,j)=>(
                <p key={j} style={{fontSize:13,color:"#78716C",fontWeight:300,lineHeight:1.65,paddingLeft:12,borderLeft:`2px solid ${i===0?"#E8C4D4":"#EEEAE7"}`,marginBottom:6}}>{item}</p>
              ))}
            </div>
          ))}
        </div>
        <textarea className="advisor-ta" rows={5} placeholder="e.g. I have been a real estate agent for 2 years and I cannot figure out how to get consistent listings. I have tried open houses and cold calling but nothing is working…" value={advisorQ} onChange={e=>setAdvisorQ(e.target.value)}/>
        <p className="advisor-hint">Type your question above or choose a suggested question below.</p>
        <div className="advisor-suggested">
          <div className="advisor-suggested-label">Common questions — tap to use</div>
          <div className="advisor-suggestions">
            {[
              "How do I get my first paying clients?",
              "How do I ask for a raise or promotion?",
              "How do I raise my prices without losing clients?",
              "How do I build a referral system that actually works?",
              "How do I transition to a new career or industry?",
              "Should I niche down or stay broad?",
              "How do I stand out in a crowded market?",
              "How do I stay motivated when progress feels slow?",
              "How do I manage a difficult conversation at work?",
              "When should I hire help or delegate?",
            ].map(s=>(
              <button key={s} className="advisor-sugg" onClick={()=>{setAdvisorQ(s);window.scrollTo({top:0,behavior:"smooth"});}}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          <button className="btn" disabled={advisorLoading||!advisorQ.trim()} onClick={()=>askAdvisor(advisorQ)}>
            {advisorLoading?"Getting your answer…":"Get My Advice →"}
          </button>
          {advisorQ&&<button className="btn-out" onClick={()=>{setAdvisorQ("");setAdvisorResult(null);}}>Clear</button>}
        </div>
        {advisorLoading&&(
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div className="load-ring" style={{margin:"0 auto 16px"}}/>
            <p style={{fontSize:13,color:"#78716C"}}>{firstName?firstName+", your":"Your"} advisor is thinking…</p>
          </div>
        )}
        {advisorResult&&!advisorResult.error&&(
          <div className="advisor-result">
            <div className="advisor-result-header" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div className="advisor-result-eye" style={{marginBottom:6}}>Your Advisor</div>
                <p style={{fontFamily:"'Cormorant',serif",fontSize:15,fontStyle:"italic",color:"#8A7E78",lineHeight:1.4}}>"{advisorResult.question.length>60?advisorResult.question.substring(0,58)+"…":advisorResult.question}"</p>
              </div>
            </div>
            {advisorResult.hearing&&(
              <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                <div className="advisor-result-label" style={{color:"#A8A29E"}}>What I'm Hearing</div>
                <div className="advisor-result-text" style={{fontStyle:"italic",color:"#57534E"}}>{advisorResult.hearing}</div>
              </div>
            )}
            {advisorResult.think&&(
              <div className="advisor-result-section">
                <div className="advisor-result-label" style={{color:"#1A1916"}}>Here's What I Think</div>
                <div className="advisor-result-text">{advisorResult.think}</div>
              </div>
            )}
            {advisorResult.means&&(
              <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                <div className="advisor-result-label" style={{color:"#A8A29E"}}>What This Means For You</div>
                <div className="advisor-result-text">{advisorResult.means}</div>
              </div>
            )}
            {(advisorResult.move||advisorResult.first)&&(
              <div className="advisor-result-section" style={{borderTop:"2px solid #B0728A"}}>
                <div className="advisor-result-label" style={{color:"#B0728A"}}>Your Single Next Move</div>
                <div className="advisor-result-text" style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:600,color:"#1A1916",lineHeight:1.4}}>{advisorResult.move||advisorResult.first}</div>
              </div>
            )}
            {!advisorResult.hearing&&!advisorResult.think&&!advisorResult.means&&!advisorResult.move&&!advisorResult.first&&advisorResult.raw&&(
              <div className="advisor-result-section">
                <div className="advisor-result-text" style={{whiteSpace:"pre-wrap"}}>{advisorResult.raw}</div>
              </div>
            )}
            {/* Follow-up prompt */}
            <div style={{padding:"16px 24px",background:"#FAFAF8",borderTop:"1px solid #EEEAE7"}}>
              <p style={{fontSize:13,color:"#A8A29E",fontStyle:"italic"}}>Does this resonate? Ask a follow-up or try a different question above.</p>
            </div>
          </div>
        )}
        {advisorResult?.error&&<div className="err">⚠ {advisorResult.error}</div>}
        {advisorHistory.length>0&&!advisorResult&&(
          <div className="advisor-history">
            <div className="advisor-history-label">Recent questions</div>
            {advisorHistory.slice(0,5).map((h,i)=>(
              <div key={i} className="advisor-history-item" onClick={()=>{setAdvisorQ(h.question);setAdvisorResult(h);}}>
                <div className="advisor-history-q">{h.question}</div>
                <div className="advisor-history-date">{h.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* ══ MY STRATEGIES ══ */}
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
          {!isSubscribed&&savedPlans.length>=FREE_PLAN_LIMIT&&(
            <div style={{background:"#FAF0F4",border:"1px solid #E8C4D4",borderRadius:4,padding:"20px 24px",marginBottom:20}}>
              <p style={{fontSize:10,fontWeight:500,letterSpacing:"0.14em",textTransform:"uppercase",color:"#B0728A",marginBottom:7}}>Unlock unlimited strategies</p>
              <p style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:500,color:"#1C1917",marginBottom:7}}>You've used your free strategy.</p>
              <p style={{fontSize:13,color:"#78716C",marginBottom:16,lineHeight:1.6,fontWeight:300}}>Subscribe for $19/month to build unlimited strategies.</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn" onClick={()=>window.open(STRIPE_MONTHLY,"_blank")}>Subscribe — $19/mo</button>
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
    {showPaywall&&(
      <div className="paywall">
        <p className="paywall-eye">Membership Required</p>
        <h2 className="paywall-h">You've used your<br/><em>free strategy.</em></h2>
        <p className="paywall-sub">Subscribe to unlock unlimited strategy sessions across all five focus areas.</p>
        <div className="pw-cards">
          <div className="pw-card">
            <div className="pw-label">Monthly</div>
            <div className="pw-price"><span>$</span>19</div>
            <div className="pw-period">per month</div>
            <div className="pw-features">{["Unlimited strategies","All 5 focus areas","Save & export plans","30-day priority plan"].map((f,i)=><div className="pw-feature" key={i}><span className="pw-check">✓</span>{f}</div>)}</div>
            <button className="pw-btn" onClick={()=>{window.open(STRIPE_MONTHLY,"_blank");saveSubState(true);}}>Subscribe — $19/mo</button>
          </div>
          <div className="pw-card pop">
            <div className="pw-pop-tag">Best value</div>
            <div className="pw-label">Annual</div>
            <div className="pw-price"><span>$</span>197</div>
            <div className="pw-period">per year · billed once</div>
            <div className="pw-save">Save $31 vs monthly</div>
            <div className="pw-features">{["Unlimited strategies","All 5 focus areas","Save & export plans","30-day priority plan"].map((f,i)=><div className="pw-feature" key={i}><span className="pw-check">✓</span>{f}</div>)}</div>
            <button className="pw-btn" onClick={()=>{window.open(STRIPE_ANNUAL,"_blank");saveSubState(true);}}>Subscribe — $197/yr</button>
          </div>
        </div>
        <p className="pw-free">Cancel anytime · <button onClick={()=>setShowPaywall(false)}>Go back</button></p>
      </div>
    )}

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

      const EC=({sk,val})=>{
        if(editSection===sk)return(
          <div style={{marginTop:20}}>
            <textarea className="rpt-edit-ta" value={editDraft} onChange={e=>setEditDraft(e.target.value)} autoFocus rows={5}/>
            <div className="rpt-edit-row">
              <button className="rpt-edit-save" onClick={()=>saveEdit(sk)}>Save</button>
              <button className="rpt-edit-cancel" onClick={cancelEdit}>Cancel</button>
            </div>
          </div>
        );
        return <button className="rpt-edit" onClick={()=>startEdit(sk,val)}>✎ Edit</button>;
      };

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
      if(strategyStage==="feedback") return(
        <div className="rpt-fb">
          <span className="rpt-fb-eyebrow">Beta Feedback</span>
          <h1 className="rpt-fb-h">Help us improve.</h1>
          <p className="rpt-fb-sub">You are one of our first users. Your honest input shapes every future strategy on this platform.</p>
          <div className="rpt-fb-rule"/>
          <div className="fb-q"><p className="fb-q-lbl">How useful was this strategy overall?</p><div className="fb-nums">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} className={`fb-num${fbRating===n?" on":""}`} onClick={()=>setFbRating(n)}>{n}</button>)}</div></div>
          {[
            {k:"personalized",q:"Did this feel personalized to your situation?",o:["Yes — very much so","Somewhat","Not really"]},
            {k:"valuable",q:"What was most valuable?",o:["Create My Strategy","Ask Your Advisor","Industry Hub","All three equally"]},
            {k:"confusing",q:"Was anything confusing?",o:["Nothing — all clear","The flow was unclear","Features were unclear","The output was unclear"]},
            {k:"wouldPay",q:"Would you pay $19/month for this?",o:["Yes — absolutely","Probably","Not sure","Probably not"]},
            {k:"wouldRecommend",q:"Would you recommend this?",o:["Yes — immediately","Maybe","Not yet"]},
          ].map(item=>(
            <div className="fb-q" key={item.k}><p className="fb-q-lbl">{item.q}</p><div className="fb-pills">{item.o.map(o=><button key={o} className={`fb-pill${fbAns[item.k]===o?" on":""}`} onClick={()=>setFbAns(p=>({...p,[item.k]:o}))}>{o}</button>)}</div></div>
          ))}
          <div className="fb-q"><p className="fb-q-lbl">What would make this better?</p><textarea className="fb-ta" placeholder="Be direct." value={fbAns.suggestions||""} onChange={e=>setFbAns(p=>({...p,suggestions:e.target.value}))}/></div>
          <div className="fb-q"><p className="fb-q-lbl">One action you are taking this week</p><textarea className="fb-ta" placeholder="Be specific." value={fbAns.action||""} onChange={e=>setFbAns(p=>({...p,action:e.target.value}))}/></div>
          <div className="fb-q"><p className="fb-q-lbl">May we use this as a testimonial?</p><div className="fb-pills">{["Yes, with my name","Yes, anonymously","No"].map(o=><button key={o} className={`fb-pill${fbAns.testimonial===o?" on":""}`} onClick={()=>setFbAns(p=>({...p,testimonial:o}))}>{o}</button>)}</div></div>
          <div className="rpt-fb-rule"/>
          <button className="btn" style={{padding:"14px 40px"}} onClick={()=>{
            setFbDone(true);setPdfUnlocked(true);
            try{window.storage.set(`feedback:${Date.now()}`,JSON.stringify({rating:fbRating,...fbAns}));}catch(e){}
            setStrategyStage("complete");
          }}>Submit Feedback</button>
        </div>
      );

      /* ── COMPLETE ── */
      if(strategyStage==="complete") return(
        <div className="rpt-flow">
          <div className="rpt-flow-mark" style={{fontFamily:"'Cormorant',serif",fontSize:24,color:"var(--r-accent)",borderColor:"rgba(176,114,138,0.3)"}}>✦</div>
          <span className="rpt-flow-eyebrow">Thank you{firstName?`, ${firstName}`:""}</span>
          <h1 className="rpt-flow-h">Your PDF is ready.</h1>
          <p className="rpt-flow-sub">Your strategy is complete and ready to download as a professionally formatted PDF.</p>
          <p className="rpt-flow-note">{fbDone?"Your feedback has been received and will shape every future strategy.":"Your strategy has been saved to My Strategies."}</p>
          <div className="rpt-flow-btns">
            <button className="rpt-flow-primary" onClick={()=>generatePDF(result,{
              firstName,
              effectiveIndustry: effectiveIndustry||industry,
              stageLabel,
              today,
              catLabel:planCat?.label||""
            })}>Download Strategy PDF</button>
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
              {viewingPlanId&&<span className="rpt-cover-tag" style={{color:"#6A9E8A"}}>✓ Saved</span>}
            </div>
          </div>

          {/* 00 — EXECUTIVE SUMMARY */}
          <div className="rpt-sec rpt-sec-alt" style={{padding:0}}>
            <div className="rpt-sec-hd" style={{padding:"var(--r-pad-v) var(--r-pad) 0"}}>
              <span className="rpt-sec-num">00 · Executive Summary</span>
              <h2 className="rpt-sec-title">Your strategy at a glance.</h2>
              <p className="rpt-sec-desc">Understand the complete picture in under sixty seconds.</p>
              <div className="rpt-sec-div" style={{marginBottom:44}}/>
            </div>
            {challenge&&(
              <div className="rpt-exec-anchor">
                <span className="rpt-exec-anchor-label">Primary Challenge</span>
                <p className="rpt-exec-anchor-text">{challenge}</p>
              </div>
            )}
            <div className="rpt-exec-support">
              {position&&<div className="rpt-exec-support-item"><div className="rpt-exec-support-label">Current Position</div><div className="rpt-exec-support-value">{position}</div></div>}
              {opportunity&&<div className="rpt-exec-support-item"><div className="rpt-exec-support-label">Greatest Opportunity</div><div className="rpt-exec-support-value">{opportunity}</div></div>}
              {goal&&<div className="rpt-exec-support-item"><div className="rpt-exec-support-label">Primary Goal</div><div className="rpt-exec-support-value">{goal}</div></div>}
              {nextMoveSentence&&<div className="rpt-exec-support-item"><div className="rpt-exec-support-label">Today's Next Move</div><div className="rpt-exec-support-value">{nextMoveSentence}</div></div>}
            </div>
            <div className="rpt-exec-tl">
              <div className="rpt-exec-tl-cell"><div className="rpt-exec-tl-period">Days 1–10</div><div className="rpt-exec-tl-text">Foundation — establish systems and take first actions</div></div>
              <div className="rpt-exec-tl-cell"><div className="rpt-exec-tl-period">Days 11–21</div><div className="rpt-exec-tl-text">Momentum — activate your strategy and measure progress</div></div>
              <div className="rpt-exec-tl-cell"><div className="rpt-exec-tl-period">Days 22–30</div><div className="rpt-exec-tl-text">Scale — review results and set your 60-day targets</div></div>
            </div>
          </div>


          {/* 01 — STRATEGIC ASSESSMENT */}
          <div className="rpt-sec">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">01 · Strategic Assessment</span>
              <h2 className="rpt-sec-title">Where you are today.</h2>
              <p className="rpt-sec-desc">What we discovered from your answers.</p>
              <div className="rpt-sec-div"/>
            </div>
            {mainExec&&<p className="rpt-body">{mainExec}</p>}
            {(strength||tension)&&(
              <div className="rpt-str-grid">
                {strength&&<div className="rpt-str-cell"><div className="rpt-str-label rpt-str-label-s">Strengths</div><div className="rpt-str-text">{clean(strength)}</div></div>}
                {tension&&<div className="rpt-str-cell"><div className="rpt-str-label rpt-str-label-t">What Needs Attention</div><div className="rpt-str-text">{clean(tension)}</div></div>}
              </div>
            )}
            <EC sk="strategicAssessment" val={result.strategicAssessment||result.execSummary||""}/>
          </div>

          {/* 02 — PRIMARY CHALLENGE */}
          <div className="rpt-sec rpt-sec-dark">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">02 · Primary Challenge</span>
              <h2 className="rpt-sec-title">The core constraint.</h2>
              <p className="rpt-sec-desc">The main issue making progress harder right now.</p>
              <div className="rpt-sec-div"/>
            </div>
            {blindTitle&&<p className="rpt-chal-name">"{blindTitle}"</p>}
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
            <EC sk="primaryConstraint" val={result.primaryConstraint||result.blindSpot||""}/>
          </div>

          {/* 03 — BEST OPPORTUNITY */}
          <div className="rpt-sec">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">03 · Best Opportunity</span>
              <h2 className="rpt-sec-title">Where to focus your energy.</h2>
              <p className="rpt-sec-desc">The areas most likely to move the needle right now.</p>
              <div className="rpt-sec-div"/>
            </div>
            <div className="rpt-opps-stack">
              {opps.map((o,i)=>(
                <div className="rpt-opp-row" key={i}>
                  <div className="rpt-opp-idx"><span className="rpt-opp-idx-n">0{i+1}</span></div>
                  <div className="rpt-opp-content">
                    {o.title&&<div className="rpt-opp-title">{o.title}</div>}
                    <div className="rpt-opp-body">{o.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <EC sk="strategicOpportunity" val={result.strategicOpportunity||result.keyOpportunities||""}/>
          </div>

          {/* 04 — RECOMMENDED ACTIONS */}
          <div className="rpt-sec rpt-sec-alt">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">04 · Recommended Actions</span>
              <h2 className="rpt-sec-title">Where to direct your energy.</h2>
              <p className="rpt-sec-desc">In priority order.</p>
              <div className="rpt-sec-div"/>
            </div>
            <div className="rpt-actions-stack">
              {actions.map((a,i)=>{
                const caps=["Begin today","Within 3 days","Within 5 days","Within 2 weeks","Within 2 weeks"];
                return(
                  <div className={`rpt-action-row${i===0?" is-first":""}`} key={i}>
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
            <EC sk="recommendedActions" val={result.recommendedActions||result.actionPlan||""}/>
          </div>

          {/* 05 — 30-DAY PLAN */}
          <div className="rpt-sec rpt-sec-dark">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">05 · 30-Day Plan</span>
              <h2 className="rpt-sec-title">Your week-by-week roadmap.</h2>
              <p className="rpt-sec-desc">Concrete actions for the next 30 days.</p>
              <div className="rpt-sec-div"/>
            </div>
            <div className="rpt-weeks">
              {weeks.map((items,i)=>(
                <div className="rpt-week-col" key={i}>
                  <div className="rpt-week-hd">
                    <div className="rpt-week-n">Week {i+1}</div>
                    <div className="rpt-week-theme">{WEEK_THEMES[i]}</div>
                    <div className="rpt-week-goal">{["Establish your foundation","Build momentum","Execute and activate","Review and scale"][i]}</div>
                  </div>
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
            <EC sk="priorityPlan" val={result.priorityPlan||result.roadmap||""}/>
          </div>

          {/* 06 — LOOKING AHEAD */}
          <div className="rpt-sec">
            <div className="rpt-sec-hd">
              <span className="rpt-sec-num">06 · Looking Ahead</span>
              <h2 className="rpt-sec-title">What becomes possible next.</h2>
              <p className="rpt-sec-desc">What to build toward after your first 30 days.</p>
              <div className="rpt-sec-div"/>
            </div>
            <div className="rpt-ahead-list">
              {looking.map((m,i)=>(
                <div className="rpt-ahead-row" key={i}>
                  <span className="rpt-ahead-idx">0{i+1}</span>
                  <div>
                    {m.title&&<div className="rpt-ahead-title">{m.title}</div>}
                    <div className="rpt-ahead-body">{m.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <EC sk="longTermGrowth" val={result.longTermGrowth||result.mistakes||""}/>
          </div>

          {/* 07 — WHAT SUCCESS LOOKS LIKE */}
          {successText&&(
            <div className="rpt-sec rpt-sec-alt">
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
              <EC sk="successLooks" val={result.successLooks||""}/>
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
            <EC sk="yourNextMove" val={result.yourNextMove||""}/>
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
