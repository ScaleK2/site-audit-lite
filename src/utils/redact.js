export const safeMessage=e=>String(e?.message||e).replace(/([?&](?:token|key|secret|password|email)=)[^&\s]+/gi,'$1[REDACTED]').slice(0,500);
