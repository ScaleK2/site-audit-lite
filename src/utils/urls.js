import path from 'node:path';
export const httpUrl = value => { try { const u=new URL(value); return /^https?:$/.test(u.protocol)?u:null; } catch { return null; } };
export function primaryDomain(value){const u=httpUrl(value); const raw=u?.hostname||String(value||'unknown'); return raw.toLowerCase().replace(/^www\./,'').replace(/[^a-z0-9.-]/g,'-')||'unknown';}
const staticExt=/\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|pdf|zip|mp4|mp3)(?:$|[?#])/i;
const unsafe=/(?:^|\/)(?:logout|signout|delete|remove|unsubscribe|checkout|payment|purchase)(?:\/|$)/i;
export function normaliseLink(raw,base){try{const u=new URL(raw,base);if(!/^https?:$/.test(u.protocol)||staticExt.test(u.pathname)||unsafe.test(u.pathname))return null;u.hash='';[...u.searchParams].forEach(([k,v])=>{if(/^(?:utm_|fbclid|gclid)/i.test(k))u.searchParams.delete(k);if(/^(?:page|p|offset|date|month|year)$/i.test(k)&&(/^\d{4,}$/.test(v)||+v>1000))u.searchParams.delete(k)});return u.href}catch{return null}}
export function safeSlug(url){const u=httpUrl(url);return `${primaryDomain(url)}-${(u?.pathname||'page').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,50)||'root'}`}
export const basenameHar=p=>path.basename(p);
