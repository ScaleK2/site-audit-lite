const SENSITIVE_KEY = /(?:pass|secret|token|auth|cookie|email|phone|client.?id|session.?id|user.?id)/i;

export function safeSerialize(value, options = {}) {
  const limits = { maxDepth: 5, maxItems: 100, maxBytes: 20_000, ...options };
  const seen = new WeakSet();
  let items = 0;
  let truncated = false;

  function visit(input, depth, key = "") {
    if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
    if (input == null || ["string", "number", "boolean"].includes(typeof input)) return input;
    if (["function", "symbol", "bigint", "undefined"].includes(typeof input)) return `[${typeof input}]`;
    if (depth >= limits.maxDepth || items++ >= limits.maxItems) {
      truncated = true;
      return "[TRUNCATED]";
    }
    if (seen.has(input)) return "[CIRCULAR]";
    seen.add(input);
    if (Array.isArray(input)) return input.map((item) => visit(item, depth + 1));
    const output = {};
    for (const [childKey, child] of Object.entries(input)) output[childKey] = visit(child, depth + 1, childKey);
    return output;
  }

  let data = visit(value, 0);
  let rendered = JSON.stringify(data);
  if (Buffer.byteLength(rendered) > limits.maxBytes) {
    rendered = rendered.slice(0, limits.maxBytes);
    data = { truncated_payload: rendered };
    truncated = true;
  }
  return { data, truncated };
}

export function dataLayerInitScript() {
  return ({ maxDepth, maxItems, maxBytes }) => {
    const records = [];
    const sensitive = /(?:pass|secret|token|auth|cookie|email|phone|client.?id|session.?id|user.?id)/i;
    const serialise = (value) => {
      const seen = new WeakSet();
      let count = 0;
      let truncated = false;
      const visit = (input, depth, key = "") => {
        if (sensitive.test(key)) return "[REDACTED]";
        if (input == null || ["string", "number", "boolean"].includes(typeof input)) return input;
        if (typeof input !== "object") return `[${typeof input}]`;
        if (depth >= maxDepth || count++ >= maxItems) { truncated = true; return "[TRUNCATED]"; }
        if (seen.has(input)) return "[CIRCULAR]";
        seen.add(input);
        if (Array.isArray(input)) return input.map((item) => visit(item, depth + 1));
        if (input.nodeType) return `[DOM ${input.nodeName || "node"}]`;
        const out = {};
        for (const [k, child] of Object.entries(input)) out[k] = visit(child, depth + 1, k);
        return out;
      };
      let data = visit(value, 0);
      if (JSON.stringify(data).length > maxBytes) { data = "[TRUNCATED PAYLOAD]"; truncated = true; }
      return { data, truncated };
    };
    const capture = (item, phase) => {
      const safe = serialise(item);
      records.push({
        timestamp: new Date().toISOString(),
        monotonic_ms: performance.now(),
        phase,
        event_name: item && typeof item === "object" && typeof item.event === "string" ? item.event : null,
        ...safe,
      });
    };
    const install = (array) => {
      if (!Array.isArray(array) || array.__siteAuditWrapped) return array;
      for (const item of array) capture(item, "initial");
      const original = array.push;
      Object.defineProperty(array, "__siteAuditWrapped", { value: true });
      array.push = function (...items) {
        for (const item of items) capture(item, "push");
        return original.apply(this, items);
      };
      return array;
    };
    let current = install(Array.isArray(window.dataLayer) ? window.dataLayer : []);
    try {
      Object.defineProperty(window, "dataLayer", {
        configurable: true,
        get: () => current,
        set: (value) => { current = install(value); },
      });
    } catch {}
    window.__siteAuditDataLayer = records;
  };
}

export const DATA_LAYER_LIMITS = { maxDepth: 5, maxItems: 100, maxBytes: 20_000 };

export function companionPath(harPath) {
  return harPath.replace(/\.har$/i, ".datalayer.json");
}
