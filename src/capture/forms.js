import crypto from "node:crypto";

function normalise(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normaliseAction(value) {
  try {
    const url = new URL(value);
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return normalise(value) || "/";
  }
}

export function formSignature(form) {
  const fields = form.fields.map((field) => [normalise(field.name), normalise(field.input_type || field.element)]);
  const structure = {
    method: normalise(form.form_method || "GET"),
    action: normaliseAction(form.form_action),
    id: normalise(form.form_id),
    name: normalise(form.form_name),
    fields,
    submits: (form.submit_controls || []).map(normalise).sort(),
  };
  return crypto.createHash("sha256").update(JSON.stringify(structure)).digest("hex").slice(0, 16);
}

export function classifyForm(text, fields) {
  const haystack = `${text} ${fields.map((field) => [field.name, field.input_type, field.autocomplete].join(" ")).join(" ")}`.toLowerCase();
  if (/search/.test(haystack)) return "search";
  if (/password/.test(haystack)) return /register|sign.?up/.test(haystack) ? "registration" : "login";
  if (/newsletter|subscribe/.test(haystack)) return "newsletter";
  if (/checkout|payment/.test(haystack)) return "checkout";
  if (/quote/.test(haystack)) return "quote";
  if (/application|apply/.test(haystack)) return "application";
  if (/contact|message/.test(haystack)) return "contact";
  return "unknown";
}

export async function detectForms(page, pageUrl) {
  const forms = await page.locator("form").evaluateAll((nodes, url) => {
    const selector = (element) => element.id
      ? `#${CSS.escape(element.id)}`
      : element.name
        ? `${element.tagName.toLowerCase()}[name="${CSS.escape(element.name)}"]`
        : element.tagName.toLowerCase();
    return nodes.map((form, formIndex) => {
      const fields = [...form.querySelectorAll("input,select,textarea")].map((field) => ({
        element: field.tagName.toLowerCase(),
        input_type: field.type || null,
        name: field.name || null,
        id: field.id || null,
        candidate_selector: selector(field),
        selector_certainty: field.id ? "high" : field.name ? "medium" : "low",
        placeholder: field.placeholder || null,
        label: field.labels?.[0]?.innerText?.trim() || null,
        required: field.required,
        autocomplete: field.autocomplete || null,
        select_options: field.tagName === "SELECT"
          ? [...field.options].map((option) => ({ value: option.value, label: option.text }))
          : [],
      }));
      return {
        page_url: url,
        hostname: new URL(url).hostname,
        form_index: formIndex,
        form_id: form.id || null,
        form_name: form.name || null,
        form_action: form.action || url,
        form_method: (form.method || "get").toUpperCase(),
        form_selector: selector(form),
        field_count: fields.length,
        submit_controls: [...form.querySelectorAll("button,input[type=submit]")].map(selector),
        fields,
        form_text: form.innerText,
      };
    });
  }, pageUrl);
  return forms.map((form) => {
    const likely = classifyForm(form.form_text, form.fields);
    const { form_text: _discarded, ...evidence } = form;
    return {
      ...evidence,
      form_signature: formSignature(form),
      likely_form_type: likely,
      classification_confidence: likely === "unknown" ? "low" : "medium",
      requires_manual_config: true,
      notes: "Passive detection only; no values recorded.",
    };
  });
}

export function formTemplate(form) {
  return {
    url: form.page_url,
    name: `review-form-${form.form_signature || form.form_index}`,
    submissionAllowed: false,
    manualReviewRequired: true,
    actions: form.fields.map((field) => ({
      type: field.input_type === "checkbox" ? "check" : field.element === "select" ? "select" : "fill",
      selector: field.candidate_selector,
      value: "",
    })),
    notes: "Generated template requires manual review; contains no real values.",
  };
}
