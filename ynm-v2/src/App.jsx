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
  const patterns=[
    [/(?:strategic assessment|current position)[:\s]*([\s\S]*?)(?=\n#+\s*(?:primary constraint|primary challenge|2[\.\)])|$)/i,"strategicAssessment"],
    [/(?:primary constraint|primary challenge)[:\s]*([\s\S]*?)(?=\n#+\s*(?:strategic opportunit|best opportunit|3[\.\)])|$)/i,"primaryConstraint"],
    [/(?:strategic opportunit|best opportunit)[^\n]*[:\s]*([\s\S]*?)(?=\n#+\s*(?:recommended action|4[\.\)])|$)/i,"strategicOpportunity"],
    [/recommended action[^\n]*[:\s]*([\s\S]*?)(?=\n#+\s*(?:30.day|priority plan|5[\.\)])|$)/i,"recommendedActions"],
    [/(?:30.day priority plan|priority plan|30.day plan)[:\s]*([\s\S]*?)(?=\n#+\s*(?:long.term|looking ahead|6[\.\)])|$)/i,"priorityPlan"],
    [/(?:long.term growth|looking ahead)[^\n]*[:\s]*([\s\S]*?)(?=\n#+\s*(?:what success|7[\.\)])|$)/i,"longTermGrowth"],
    [/what success looks like[:\s]*([\s\S]*?)(?=\n#+\s*(?:your next move|8[\.\)])|$)/i,"successLooks"],
    [/your next move[:\s]*([\s\S]*?)(?=\n#+|$)/i,"yourNextMove"],
  ];
  patterns.forEach(([re,k])=>{const m=raw.match(re);if(m)s[k]=m[1].trim();});
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
  .hub-q-grid{grid-template-columns:1fr;}
  .hub-page,.hub-q-page,.advisor-page{padding:32px 16px 60px;}
}
@media print{
  @page{margin:0.5in 0.6in;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  .nav,.res-btns,.res-footer,.edit-btn,.fb-wrap{display:none!important;}
  .res-cover{background:#1A1916!important;padding:36px 28px!important;}
  .sec-dark{background:#1A1916!important;}
  .roadmap-grid{grid-template-columns:repeat(4,1fr)!important;}
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
  const [editSection,  setEditSection]  = useState(null);
  const [editDraft,    setEditDraft]    = useState("");
  const [fbDone,       setFbDone]       = useState(false);
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
    `${firstName?firstName+", we":"We"}'re reviewing your answers…`,
    "Identifying your primary challenge…",
    "Prioritizing your best opportunity…",
    `Building your 30-day plan for ${effectiveIndustry||"your field"}…`,
    "Finalizing your next move…",
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
    setFbDone(false);setFbRating(null);setFbAns({});setShortWarn(false);
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
  function openSavedPlan(plan){setCatId(plan.catId);setIndustry(plan.industry);setJourneyStage(plan.journeyStage||null);setResult(plan.result);setViewingPlanId(plan.id);go("results");}
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

    const prompt=`You are a senior strategist writing a concise, personalized strategy report. This should feel like a focused $500 session — not a lengthy document. Every section must be specific to this person. No generic advice.

RULES:
1. SPECIFIC: Every sentence applies only to this person. If a sentence could apply to 80% of people, rewrite it.
2. CONCISE: Keep each section tight. Users should finish reading in 8–10 minutes total.
3. PERSONALIZED: Reference their industry, stage, goals, and actual answers throughout.
4. THE INSIGHT: In Primary Challenge, include: "The insight: [one sentence — the most important truth about their situation]"
5. REFRAME: Primary Challenge must include one sentence that reframes how they see their situation.
6. STAGE AWARE: Just Getting Started = simple first steps. Growing = what to accelerate. Established = challenge assumptions. Optimizing = leverage and efficiency.
7. VOICE: Warm, direct, executive. Not a coach or chatbot.
8. COMPLETE ALL 8 SECTIONS. Shorter is better than incomplete.

Client: ${firstName||"Not provided"} | Focus: ${cat?.label} | Industry: ${effectiveIndustry} | Stage: ${stageLabel}

Answers:
${qa}

Write EXACTLY these 8 sections. Be concise — quality over quantity.

# Strategic Assessment
3 sentences maximum. First sentence references a specific detail from their answers.
**Strengths:** [1 specific strength]
**What needs attention:** [1 core gap]

# Primary Challenge
Bold header naming the constraint (4–7 words).
2 sentences: what it is, the reframe.
The insight: [single most important truth — the sentence they will screenshot]

# Strategic Opportunity
Start: "Given your position in ${effectiveIndustry} at the ${stageLabel} stage..."
3 opportunities. Each: **[Title]** then 1–2 sentences.

# Recommended Actions
"Here is where to direct your energy."
5 actions. Each: **[Title]** / [specific action] / *Why this matters: [1 sentence]*
After action 5: **What to set aside for now:** [one specific thing to stop or defer]

# 30-Day Priority Plan
All 4 weeks required. 6 words max per task.
Week 1 — Foundation: [Task] / [Task] / [Task] / [Task]
Week 2 — Momentum: [Task] / [Task] / [Task] / [Task]
Week 3 — Activation: [Task] / [Task] / [Task] / [Task]
Week 4 — Scale & Review: [Task] / [Task] / [Task] / [Task]

# Looking Ahead
"Beyond 30 days, here is what to build toward."
3 items. Each: **[Title]** then 1–2 sentences.

# What Success Looks Like
3 sentences. Concrete, not aspirational. One measurable result, one relationship outcome, one internal shift.

# Your Next Move
Sentence 1: "Based on everything you've shared, the single most important action you should take today is [specific action]."
Sentence 2: Why this is higher leverage than anything else.
Sentence 3: What changes in 2 weeks if they do this.`;

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
      const critical=[p.yourNextMove,p.priorityPlan,p.strategicAssessment,p.primaryConstraint];
      const allDone=critical.every(s=>s&&s.trim().length>20);
      const fullText=Object.values(p).join(" ");
      const indOk=effectiveIndustry?fullText.toLowerCase().includes(effectiveIndustry.toLowerCase().split(" ")[0]):true;
      return allDone&&indOk;
    };

    try{
      let text=await callAPI();let parsed=parseResult(text);
      if(!isComplete(parsed)){text=await callAPI();parsed=parseResult(text);}
      setResult(parsed);setViewingPlanId(null);
      await savePlan(parsed,{catId,industry:effectiveIndustry,journeyStage});
      go("results");
    }catch(e){
      const msg=e.message||"";
      setError(msg.includes("timed out")?"Your strategy took longer than expected. Your answers are saved — please try again.":msg.includes("401")||msg.includes("403")?"There was a connection issue. Please try again in a moment.":"Something went wrong generating your strategy. Your answers are saved — please try again.");
      go("questions");
    }finally{setLoading(false);}
  }

  async function askAdvisor(question){
    if(!question.trim())return;
    setAdvisorLoading(true);setAdvisorResult(null);
    const context=savedPlans[0]?`User context: ${CATEGORIES.find(c=>c.id===savedPlans[0].catId)?.label} focus, ${savedPlans[0].industry} industry, ${savedPlans[0].journeyStage} stage.`:"";
    const prompt=`You are a trusted personal advisor — warm, direct, and honest. You speak like a brilliant friend who happens to know business and careers deeply. You give one clear opinion, not a list of options. You reference what the person actually said back to them so they feel heard.

${firstName?`The person's name is ${firstName}. Address them by name once.`:""} ${context}

Their situation: ${question}

Respond conversationally with these four parts. Do NOT use bullet points or numbered lists. Write in flowing sentences like a real advisor speaking.

**What I'm hearing**
2 sentences that mirror back their situation so they feel understood. Start with their name if provided.

**Here's what I think**
3–4 sentences. One clear, direct opinion or recommendation. Be specific to their situation. Take a position — don't hedge.

**What this means for you**
2–3 sentences explaining why this matters specifically for their situation, not in general.

**Your single next move**
1 sentence. Not a list — the ONE thing they should do in the next 24 hours.`;

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
    const prompt=`You are a senior professional advisor creating a structured playbook for a specific professional challenge. Your output should feel like a professional reference document — authoritative, methodical, and referenceable. Not a conversation.

${firstName?`Context: This is for ${firstName}.`:""} ${context}

Topic: ${query}

Respond with exactly these five sections. Use clear headers. Be specific and methodical.

**The Framework**
2–3 sentences explaining what this is, why it works, and what it's based on. Give it professional authority.

**Applied to Your Situation**
2–3 sentences connecting this framework directly to the context provided. Be specific.

**Step-by-Step**
5 numbered steps. Each step is one concrete action. Specific enough to start today.

**Common Mistakes**
3 things people get wrong with this specific challenge. Short, direct, specific.

**Your Starting Point**
1 sentence. The single first action given their specific context.`;

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
      setHubSearchResult({
        query,
        isPlaybook: true,
        framework:(frameworkMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        applied:(appliedMatch?.[1]||"").replace(/\*\*/g,"").trim(),
        steps:lines((stepsMatch?.[1]||"").replace(/\*\*/g,"")).map(l=>l.replace(/^\d+\.\s*/,"").trim()).filter(Boolean),
        mistakes:lines((mistakesMatch?.[1]||"").replace(/\*\*/g,"")).map(l=>l.replace(/^\d+\.\s*/,"").trim()).filter(Boolean),
        start:(startMatch?.[1]||"").replace(/\*\*/g,"").trim(),
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
          <span className="hero-eye">Strategic Clarity On Demand</span>
          <h1 className="hero-h1">Your Personal<br/><em>Strategist.</em></h1>
          <p className="hero-sub">A guided strategy experience that helps entrepreneurs, professionals, and creatives gain clarity and move forward with confidence.</p>
          <button className="hero-cta" onClick={()=>go("welcome")}>
            Create My Strategy <span className="hero-arr">→</span>
          </button>
          <p style={{fontSize:12,color:"#A8A29E",marginTop:14}}>First strategy free · Then $19/month · Cancel anytime</p>
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
                desc:"Answer a short series of questions about your focus area, industry, and goals. In under a minute, you receive a personalized 8-section strategy built specifically for you.",
                cta:"Start here →",
                action:()=>go("welcome"),
                accent:true
              },
              {
                num:"02",
                title:"Ask Your Advisor",
                desc:"Have a specific challenge you need help with right now? Ask one focused question and get a direct, personalized answer — no lengthy session required.",
                cta:"Ask a question →",
                action:()=>go("advisor"),
                accent:false
              },
              {
                num:"03",
                title:"Industry Hub",
                desc:"Browse curated questions built for your specific field. Real Estate, Creative, Healthcare, Finance and more — each with 15 questions written for that industry.",
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
                <div style={{fontFamily:"'Cormorant',serif",fontSize:13,fontWeight:500,color:c.accent?"#5A5350":"#C4B5AD",letterSpacing:"0.06em",marginBottom:16}}>{c.num}</div>
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
                {num:"02",label:"Primary Challenge",preview:""The real issue isn't your offer — it's that you've been optimizing for the wrong client entirely.""},
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
          <div className="err">⚠ {error}
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
              <button className="btn" style={{padding:"8px 18px",fontSize:10}} onClick={generate}>Try again</button>
              <button className="btn-out" style={{padding:"8px 18px",fontSize:10}} onClick={()=>setError(null)}>Return to my answers</button>
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
          <p style={{fontSize:12,color:"#A8A29E",marginTop:7,fontStyle:"italic"}}>Search 164 professional prompts, or press Ask → for an AI-powered answer to any question</p>
        </div>
        {hubSearchLoading&&<div style={{textAlign:"center",padding:"32px 0"}}><div className="load-ring" style={{margin:"0 auto 14px"}}/><p style={{fontSize:13,color:"#78716C"}}>Finding your answer…</p></div>}
        {hubSearchResult&&!hubSearchResult.error&&(
          <div style={{marginBottom:28,border:"1px solid #EEEAE7",borderRadius:6,overflow:"hidden"}}>
            <div style={{background:"#1A1916",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><p style={{fontSize:9,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#C4A0B0",marginBottom:4}}>AI Answer</p><p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:500,color:"#fff"}}>"{hubSearchResult.query}"</p></div>
              <button onClick={()=>{setHubSearchResult(null);setHubSearchQuery("");}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:100,padding:"5px 14px",color:"#A8A29E",fontSize:10,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Clear</button>
            </div>
            {hubSearchResult.framework&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FAFAF8"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>The Framework</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.framework}</p></div>}
            {hubSearchResult.applied&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Applied to Your Situation</p><p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.applied}</p></div>}
            {hubSearchResult.steps?.length>0&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:12}}>Step-by-Step</p><div style={{display:"flex",flexDirection:"column",gap:10}}>{hubSearchResult.steps.map((s,i)=><div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:24,height:24,borderRadius:"50%",background:"#1A1916",color:"#fff",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div><p style={{fontSize:14,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{s}</p></div>)}</div></div>}
            {hubSearchResult.mistakes?.length>0&&<div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FEF9F6"}}><p style={{fontSize:11,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#B8936A",marginBottom:12}}>Common Mistakes</p><div style={{display:"flex",flexDirection:"column",gap:8}}>{hubSearchResult.mistakes.map((m,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"#B8936A",fontSize:14,fontWeight:700,flexShrink:0}}>!</span><p style={{fontSize:13,color:"#57534E",lineHeight:1.65,fontWeight:300}}>{m}</p></div>)}</div></div>}
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
              <div className="hub-card-cta">{c.questions.length} prompts →</div>
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
        <p className="hub-q-sub">Select a prompt to explore. Add your personal context and get a structured playbook for your specific situation.</p>
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
          <p style={{fontSize:11,color:"#A8A29E",marginTop:7,fontStyle:"italic"}}>Press Enter or click Ask → to get a full AI answer to any question</p>
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
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#C4A0B0",marginBottom:4}}>AI Answer</p>
                <p style={{fontFamily:"'Cormorant',serif",fontSize:16,fontWeight:500,color:"#fff",lineHeight:1.3}}>"{hubSearchResult.query}"</p>
              </div>
              <button onClick={()=>{setHubSearchResult(null);setHubSearchQuery("");setHubSearch("");}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:100,padding:"5px 14px",color:"#A8A29E",fontSize:10,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",letterSpacing:"0.08em",textTransform:"uppercase"}}>Clear</button>
            </div>
            {hubSearchResult.direct&&(
              <div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Direct Answer</p>
                <p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.direct}</p>
              </div>
            )}
            {hubSearchResult.why&&(
              <div style={{padding:"18px 22px",borderBottom:"1px solid #EEEAE7",background:"#FAFAF8"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Why It Matters</p>
                <p style={{fontSize:14,color:"#3A3530",lineHeight:1.78,fontWeight:300}}>{hubSearchResult.why}</p>
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
            {hubSearchResult.first&&(
              <div style={{padding:"18px 22px",background:"#FAFAF8"}}>
                <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:8}}>Do This First</p>
                <p style={{fontSize:14,color:"#1A1916",fontWeight:500,lineHeight:1.6}}>{hubSearchResult.first}</p>
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
        <p className="advisor-sub">Add your personal context below — then generate your answer.</p>
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
            <p style={{fontSize:13,color:"#78716C"}}>Building your personalized answer…</p>
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
                <div className="advisor-result-label">What I'm Hearing</div>
                <div className="advisor-result-text" style={{fontStyle:"italic",color:"#57534E"}}>{advisorResult.hearing}</div>
              </div>
            )}
            {advisorResult.think&&(
              <div className="advisor-result-section">
                <div className="advisor-result-label">Here's What I Think</div>
                <div className="advisor-result-text">{advisorResult.think}</div>
              </div>
            )}
            {advisorResult.means&&(
              <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                <div className="advisor-result-label">What This Means For You</div>
                <div className="advisor-result-text">{advisorResult.means}</div>
              </div>
            )}
            {(advisorResult.move||advisorResult.first)&&(
              <div className="advisor-result-section" style={{borderTop:"2px solid #B0728A"}}>
                <div className="advisor-result-label" style={{color:"#B0728A"}}>Your Single Next Move</div>
                <div className="advisor-result-text" style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:600,color:"#1A1916",lineHeight:1.4}}>{advisorResult.move||advisorResult.first}</div>
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
        <p className="advisor-sub">Your personal sounding board for the decisions, challenges, and moments that don't fit neatly into a plan. Describe what's on your mind and get a direct, honest response — like talking to a trusted advisor who actually knows what they're talking about.</p>
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
              "How do I raise my prices without losing clients?",
              "How do I build a referral system that actually works?",
              "How do I stand out in a crowded market?",
              "How do I stay motivated when growth is slow?",
              "Should I niche down or stay broad?",
              "When should I hire help?",
              "How do I make my revenue more consistent?"
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
            <p style={{fontSize:13,color:"#78716C"}}>Building your personalized answer…</p>
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
                <div className="advisor-result-label">What I'm Hearing</div>
                <div className="advisor-result-text" style={{fontStyle:"italic",color:"#57534E"}}>{advisorResult.hearing}</div>
              </div>
            )}
            {advisorResult.think&&(
              <div className="advisor-result-section">
                <div className="advisor-result-label">Here's What I Think</div>
                <div className="advisor-result-text">{advisorResult.think}</div>
              </div>
            )}
            {advisorResult.means&&(
              <div className="advisor-result-section" style={{background:"#FAFAF8"}}>
                <div className="advisor-result-label">What This Means For You</div>
                <div className="advisor-result-text">{advisorResult.means}</div>
              </div>
            )}
            {(advisorResult.move||advisorResult.first)&&(
              <div className="advisor-result-section" style={{borderTop:"2px solid #B0728A"}}>
                <div className="advisor-result-label" style={{color:"#B0728A"}}>Your Single Next Move</div>
                <div className="advisor-result-text" style={{fontFamily:"'Cormorant',serif",fontSize:18,fontWeight:600,color:"#1A1916",lineHeight:1.4}}>{advisorResult.move||advisorResult.first}</div>
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
      const opps=parseOpportunities(result.strategicOpportunity||result.keyOpportunities||"");
      const weeks=parseRoadmap(result.priorityPlan||result.roadmap||"");
      const looking=parseLooking(result.longTermGrowth||result.mistakes||"");
      const nextMove=(result.yourNextMove||"").replace(/\*\*/g,"").trim();
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

      const EC=({sk,lbl,val})=>{
        const isEdit=editSection===sk;
        if(isEdit)return(<div><textarea className="edit-ta" value={editDraft} onChange={e=>setEditDraft(e.target.value)} autoFocus/><div className="edit-acts"><button className="edit-save" onClick={()=>saveEdit(sk)}>Save</button><button className="edit-cancel" onClick={cancelEdit}>Cancel</button></div></div>);
        return <button className="edit-btn" onClick={()=>startEdit(sk,val)}>✎ Edit</button>;
      };

      return(
        <div className="res">
          {/* COVER */}
          <div className="res-cover">
            <span className="res-eye">Your Next Move · Strategy Report</span>
            <h1 className="res-h1">{firstName?`${firstName}'s `:""}<em>{planCat?.label}</em><br/>Strategy</h1>
            <p className="res-meta">Built for your {effectiveIndustry||industry} business at the {stageLabel} stage</p>
            <div className="res-tags">
              <span className="res-tag">{effectiveIndustry||industry}</span>
              <span className="res-tag">{stageLabel}</span>
              <span className="res-tag">{today}</span>
              {viewingPlanId&&<span className="res-tag res-tag-saved">✓ Saved</span>}
            </div>
            <div className="res-btns">
              <button className="res-btn" onClick={()=>window.print()}>Export PDF</button>
              <button className="res-btn" onClick={()=>go("plans")}>My Strategies</button>
            </div>
          </div>

          {/* 01 */}
          <div className="sec sec-light">
            <div className="sec-kicker"><span className="sec-kicker-num">01</span>Strategic Assessment</div>
            <p className="sec-purpose">Where you are today and what we noticed from your answers.</p>
            {mainExec&&<p className="sec-body">{mainExec}</p>}
            {(strength||tension)&&(
              <div className="cards-2">
                {strength&&<div className="card-sm"><div className="card-sm-label">Strengths</div><div className="card-sm-text">{clean(strength)}</div></div>}
                {tension&&<div className="card-sm card-sm-gap"><div className="card-sm-label">What needs attention</div><div className="card-sm-text">{clean(tension)}</div></div>}
              </div>
            )}
            <EC sk="strategicAssessment" lbl="Strategic Assessment" val={result.strategicAssessment||result.execSummary||""}/>
          </div>

          {/* 02 */}
          <div className="sec sec-dark">
            <div className="sec-kicker sec-kicker-dark"><span className="sec-kicker-num sec-kicker-num-dark">02</span>Primary Challenge</div>
            <p className="sec-purpose sec-purpose-dark">The main issue making progress harder right now.</p>
            {blindTitle?<p style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(22px,4vw,38px)",fontWeight:600,fontStyle:"italic",color:"#fff",lineHeight:1.2,marginBottom:18,letterSpacing:"-0.01em"}}>"{blindTitle}"</p>:<p style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(20px,3.5vw,30px)",fontWeight:600,fontStyle:"italic",color:"#fff",lineHeight:1.25,marginBottom:18}}>"{cleanBlind.split(".")[0]}."</p>}
            <p className="sec-body-dark">{blindTitle?cleanBlind:cleanBlind.split(".").slice(1).join(".").trim()}</p>
            {insightText&&<div className="insight-block"><div className="insight-label">The Insight</div><p className="insight-text">"{insightText}"</p></div>}
            <button id="copy-btn" className="insight-copy" onClick={()=>{
              const txt=insightText?`"${insightText}"`:blindTitle?`"${blindTitle}" — ${cleanBlind}`:cleanBlind;
              if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>{const b=document.getElementById("copy-btn");if(b){b.textContent="✓ Copied";setTimeout(()=>{b.textContent="Share this insight";},2200);}});}
            }}>Share this insight →</button>
            <EC sk="primaryConstraint" lbl="Primary Challenge" val={result.primaryConstraint||result.blindSpot||""}/>
          </div>

          {/* 03 */}
          <div className="sec">
            <div className="sec-kicker"><span className="sec-kicker-num">03</span>Best Opportunity</div>
            <p className="sec-purpose">The area most likely to create meaningful progress.</p>
            <div className="opp-list">
              {opps.map((o,i)=>(
                <div className="opp-row" key={i}>
                  <div className="opp-num">{i+1}</div>
                  <div className="opp-body">{o.title&&<div className="opp-title">{o.title}</div>}<div className="opp-text">{o.body}</div></div>
                </div>
              ))}
            </div>
            <EC sk="strategicOpportunity" lbl="Best Opportunity" val={result.strategicOpportunity||result.keyOpportunities||""}/>
          </div>

          {/* 04 */}
          <div className="sec">
            <div className="sec-kicker"><span className="sec-kicker-num">04</span>Recommended Actions</div>
            <p className="sec-purpose">Where to direct your energy, in order of priority.</p>
            <div className="action-list">
              {actions.map((a,i)=>{
                const lbl=i===0?"Start here":i<=2?"This week":"This month";
                const clr=i===0?"#B0728A":i<=2?"#6A9E8A":"#A8A29E";
                return(
                  <div className="action-row" key={i}>
                    <div className={`action-num${i===0?" first":""}`}>{i+1}</div>
                    <div className="action-content">
                      <div className="action-priority" style={{color:clr}}>{lbl}</div>
                      <div className="action-title">{a.title||clean(a.body)}</div>
                      {a.title&&<div className="action-body">{a.body}</div>}
                      {a.why&&<div className="action-why">{a.why}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            {deprioritize&&<div className="deprioritize"><div className="dep-label">What to set aside for now</div><div className="dep-text">{deprioritize}</div></div>}
            <EC sk="recommendedActions" lbl="Recommended Actions" val={result.recommendedActions||result.actionPlan||""}/>
            {/* BRIDGE TO HUB */}
            <div style={{marginTop:20,padding:"14px 18px",background:"#FAFAF8",border:"1px solid #EEEAE7",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div>
                <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:"#B0728A",marginBottom:4}}>Go deeper</p>
                <p style={{fontSize:13,color:"#57534E",fontWeight:300}}>Find structured playbooks for your specific challenges in the Industry Hub.</p>
              </div>
              <button className="btn-out" style={{fontSize:10,padding:"8px 16px",flexShrink:0,whiteSpace:"nowrap"}} onClick={()=>go("hub")}>Explore Industry Hub →</button>
            </div>
          </div>

          {/* 05 */}
          <div className="sec sec-dark">
            <div className="roadmap-kicker" style={{fontSize:9,fontWeight:600,letterSpacing:"0.36em",textTransform:"uppercase",color:"#5A5350",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontFamily:"'Cormorant',serif",fontSize:26,fontWeight:600,color:"#2E2926",letterSpacing:"-0.02em",lineHeight:1}}>05</span>30-Day Priority Plan
            </div>
            <div className="roadmap-grid">
              {weeks.map((items,i)=>(
                <div className="wk" key={i}>
                  <div className="wk-head"><div className="wk-n">{i+1}</div><div className="wk-theme-lbl">Week {i+1}</div><div className="wk-theme">{WEEK_THEMES[i]}</div></div>
                  <div className="wk-body"><ul className="wk-items">{items.length?items.map((t,j)=><li className="wk-item" key={j}>{t}</li>):<li className="wk-item">—</li>}</ul></div>
                </div>
              ))}
            </div>
            <EC sk="priorityPlan" lbl="30-Day Plan" val={result.priorityPlan||result.roadmap||""}/>
          </div>

          {/* 06 */}
          <div className="sec sec-light">
            <div className="sec-kicker"><span className="sec-kicker-num">06</span>Looking Ahead</div>
            <p className="sec-purpose">Beyond 30 days — what to build toward next.</p>
            <div className="look-list">
              {looking.map((m,i)=>(
                <div className="look-row" key={i}>
                  <div className="look-arr">→</div>
                  <div className="look-content">{m.title&&<div className="look-title">{m.title}</div>}<div className="look-body">{m.body}</div></div>
                </div>
              ))}
            </div>
            <EC sk="longTermGrowth" lbl="Looking Ahead" val={result.longTermGrowth||result.mistakes||""}/>
          </div>

          {/* 07 */}
          {successText&&(
            <div className="sec sec-green">
              <div className="sec-kicker" style={{color:"#5A8A78"}}><span style={{fontFamily:"'Cormorant',serif",fontSize:26,fontWeight:600,color:"#9ABFB3",lineHeight:1}}>07</span>What Success Looks Like</div>
              <p className="sec-body" style={{color:"#2A4A40"}}>{successText}</p>
              <EC sk="successLooks" lbl="What Success Looks Like" val={result.successLooks||""}/>
            </div>
          )}

          {/* 08 */}
          <div className="sec sec-dark" style={{textAlign:"center",padding:"68px 52px"}}>
            <span className="nextmove-kicker">08 · Your Next Move</span>
            <span className="nextmove-sub">The single most important action you should take today</span>
            <p className="nextmove-text">"{nextMove||"—"}"</p>
            <div className="nextmove-rule"/>
            <span className="nextmove-footer">Every section in this plan leads here.</span>
            <EC sk="yourNextMove" lbl="Your Next Move" val={result.yourNextMove||""}/>
          </div>

          {/* EXIT EXPERIENCE */}
          <div style={{background:"#FAFAF8",borderTop:"1px solid #EEEAE7",padding:"48px 52px",textAlign:"center"}}>
            <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#B0728A",marginBottom:12}}>You're ready.</p>
            <h3 style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:600,color:"#1A1916",lineHeight:1.2,marginBottom:12,letterSpacing:"-0.01em"}}>Your strategy is saved.<br/>Now it's time to act.</h3>
            <p style={{fontSize:15,color:"#78716C",fontWeight:300,lineHeight:1.7,maxWidth:440,margin:"0 auto 32px"}}>The most important thing you can do right now is take your single next move. Not tomorrow. Today.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:32}}>
              <button className="btn" onClick={()=>window.print()}>Export PDF</button>
              <button className="btn-out" onClick={()=>go("advisor")}>Ask Your Advisor</button>
              <button className="btn-out" onClick={()=>go("hub")}>Explore the Industry Hub</button>
            </div>
            <div style={{borderTop:"1px solid #EEEAE7",paddingTop:24,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <button className="btn-out" style={{fontSize:10}} onClick={restart}>New Strategy</button>
              <button className="btn-out" style={{fontSize:10}} onClick={()=>go("plans")}>My Strategies</button>
            </div>
          </div>

          {/* EXIT EXPERIENCE */}
          <div style={{background:"#FAFAF8",padding:"36px 52px",borderTop:"1px solid #EEEAE7",textAlign:"center"}}>
            <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.24em",textTransform:"uppercase",color:"#B0728A",marginBottom:10}}>Your Strategy Is Ready</p>
            <h3 style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(20px,3vw,28px)",fontWeight:600,color:"#1A1916",marginBottom:8,letterSpacing:"-0.01em"}}>What's your next move?</h3>
            <p style={{fontSize:14,color:"#78716C",fontWeight:300,marginBottom:24,maxWidth:440,margin:"0 auto 24px",lineHeight:1.7}}>The most important thing you can do now is take one action today — not tomorrow.</p>
            {nextMove&&(
              <div style={{background:"#1A1916",borderRadius:8,padding:"22px 26px",maxWidth:500,margin:"0 auto 22px",textAlign:"left"}}>
                <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.16em",textTransform:"uppercase",color:"#C4A0B0",marginBottom:8}}>Your commitment</p>
                <p style={{fontFamily:"'Cormorant',serif",fontSize:"clamp(14px,2.2vw,18px)",fontWeight:500,fontStyle:"italic",color:"#fff",lineHeight:1.45}}>{'"'}{(nextMove||"").split("**").join("").split(".")[0]}.{'"'}</p>
                <button style={{marginTop:12,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:100,padding:"6px 16px",color:"#C4A0B0",fontSize:10,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",letterSpacing:"0.1em",textTransform:"uppercase"}} onClick={()=>{const txt='"'+(nextMove||"").split("**").join("").split(".")[0]+'." — My strategy from Your Next Move';if(navigator.clipboard)navigator.clipboard.writeText(txt);}}>Share this →</button>
              </div>
            )}
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
              <button className="btn" onClick={()=>window.print()}>Export My Strategy</button>
              <button className="btn-out" onClick={restart}>New Strategy</button>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              <button className="btn-out" style={{fontSize:10,padding:"8px 14px"}} onClick={()=>go("advisor")}>Ask Your Advisor</button>
              <button className="btn-out" style={{fontSize:10,padding:"8px 14px"}} onClick={()=>go("hub")}>Industry Hub</button>
              <button className="btn-out" style={{fontSize:10,padding:"8px 14px"}} onClick={()=>go("plans")}>My Strategies</button>
            </div>
            <p style={{fontSize:12,color:"#C4B5AD",marginTop:16,fontStyle:"italic"}}>Come back in 7 days to check your progress.</p>
          </div>

          {/* FEEDBACK */}
          {!fbDone?(
            <div className="fb-wrap">
              <p style={{fontSize:9,fontWeight:600,letterSpacing:"0.28em",textTransform:"uppercase",color:"#C4B5AD",marginBottom:12}}>Beta Feedback</p>
              <h3 className="fb-h">How did your strategy land?</h3>
              <p className="fb-sub">90 seconds of feedback shapes every future session.</p>
              <div className="fb-q"><p className="fb-q-lbl">How useful was this overall?</p><div className="fb-nums">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} className={`fb-num${fbRating===n?" on":""}`} onClick={()=>setFbRating(n)}>{n}</button>)}</div></div>
              {[
                {k:"personalized",q:"Did this feel personalized?",o:["Yes — very much so","Somewhat","Not really"]},
                {k:"wouldPay",q:"Would you pay $19/month for this?",o:["Yes — absolutely","Probably yes","Not sure","Probably not"]},
                {k:"wouldRecommend",q:"Would you recommend this?",o:["Yes — immediately","Maybe","Not yet"]},
              ].map(item=>(
                <div className="fb-q" key={item.k}><p className="fb-q-lbl">{item.q}</p><div className="fb-pills">{item.o.map(o=><button key={o} className={`fb-pill${fbAns[item.k]===o?" on":""}`} onClick={()=>setFbAns(p=>({...p,[item.k]:o}))}>{o}</button>)}</div></div>
              ))}
              <div className="fb-q"><p className="fb-q-lbl">One thing you plan to do this week</p><textarea className="fb-ta" placeholder="Be specific." value={fbAns.action||""} onChange={e=>setFbAns(p=>({...p,action:e.target.value}))}/></div>
              <button className="btn" style={{padding:"11px 26px",fontSize:10}} onClick={()=>{setFbDone(true);try{window.storage.set(`feedback:${Date.now()}`,JSON.stringify({rating:fbRating,industry:effectiveIndustry,stage:journeyStage,...fbAns}));}catch(e){}}}>Submit feedback</button>
            </div>
          ):(
            <div style={{background:"#FAFAF8",borderTop:"1px solid #EEEAE7",padding:"32px 52px",textAlign:"center"}}>
              <p style={{fontFamily:"'Cormorant',serif",fontSize:20,fontWeight:600,color:"#1A1916",marginBottom:7}}>Thank you{firstName?`, ${firstName}`:""} .</p>
              <p style={{fontSize:13,color:"#78716C",fontWeight:300}}>Your feedback makes every future strategy better.</p>
            </div>
          )}
        </div>
      );
    })()}
  </>);
}
