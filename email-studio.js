const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const form = document.querySelector("[data-email-studio-form]");
const recipientSheet = document.querySelector(".recipient-sheet");
const recipientSheetHeader = document.querySelector(".recipient-sheet-header");
const recipientBody = document.querySelector("[data-recipient-body]");
const output = document.querySelector("[data-email-output]");
const outputCount = document.querySelector("[data-output-count]");
const exportButton = document.querySelector("[data-export-csv]");
const addRowButton = document.querySelector("[data-add-row]");
const stepperTrack = document.querySelector("[data-stepper-track]");
const stepLabels = document.querySelectorAll(".studio-steps button");
const nextStepButtons = document.querySelectorAll("[data-next-step]");
const prevStepButtons = document.querySelectorAll("[data-prev-step]");
const generateStepButton = document.querySelector("[data-generate-step]");
const bodyTemplateEditor = document.querySelector("[data-body-template]");
const formatButtons = document.querySelectorAll("[data-format]");
const undoButton = document.querySelector("[data-format=\"undo\"]");
const redoButton = document.querySelector("[data-format=\"redo\"]");
const tokenList = document.querySelector("[data-token-list]");
const addPlaceholderButton = document.querySelector("[data-add-placeholder]");
const subjectTemplateEditor = document.querySelector("[data-subject-template]");
const downloadTemplateButton = document.querySelector("[data-download-template]");
const uploadCsvInput = document.querySelector("[data-upload-csv]");
const importStatus = document.querySelector("[data-import-status]");
const templateSaveToggle = document.querySelector("[data-template-save-toggle]");
const templateSavePanel = document.querySelector("[data-template-save-panel]");
const templateNameInput = document.querySelector("[data-template-name]");

let currentStep = 0;
let editorHistory = [];
let editorHistoryIndex = -1;
let isRestoringHistory = false;
let activeTemplateEditor = bodyTemplateEditor;
let savedTemplateRange = null;
let emailInputCounter = 1;

let generatedEmails = [];

if (templateSaveToggle && templateSavePanel) {
  templateSaveToggle.addEventListener("click", () => {
    const willOpen = templateSavePanel.classList.contains("is-hidden");
    templateSavePanel.classList.toggle("is-hidden", !willOpen);
    templateSaveToggle.setAttribute("aria-expanded", String(willOpen));

    if (willOpen) {
      window.requestAnimationFrame(() => templateNameInput?.focus());
    }
  });
}

const defaultFields = [
  "client_name",
  "contact_firstname",
  "campaign_name",
  "deadline",
  "approval_link",
];

const fieldLabels = {
  client_name: "Company name",
  contact_firstname: "Recipient first name",
  campaign_name: "Campaign",
  deadline: "Deadline",
  approval_link: "Creative link",
};

const fields = [...defaultFields];

function recipientFieldTemplate(field, values = {}, sheetColumn = null) {
  const wideClass = ["approval_link"].includes(field) || !defaultFields.includes(field) ? " class=\"wide\"" : "";
  const columnStyle = sheetColumn ? ` style="--sheet-column: ${sheetColumn};"` : "";
  if (field === "approval_link") {
    return `
      <div class="creative-link-fields wide" data-creative-link-field>
        <span>${escapeHtml(fieldLabels[field] || field)}</span>
        <label${columnStyle}><span>Link name</span><input name="approval_link_name" value="${escapeAttribute(values.approval_link_name || "")}" required /></label>
        <label${sheetColumn ? ` style="--sheet-column: ${sheetColumn + 1};"` : ""}><span>URL</span><input name="approval_link_url" value="${escapeAttribute(values.approval_link_url || "")}" inputmode="url" autocapitalize="none" spellcheck="false" required /></label>
      </div>
    `;
  }
  return `<label${wideClass}${columnStyle}><span>${escapeHtml(fieldLabels[field] || field)}</span><input name="${field}" value="${escapeAttribute(values[field] || "")}" /></label>`;
}

function fieldFromToken(token) {
  return String(token || "").replace(/[{}]/g, "").trim();
}

function getRecipientFieldOrder() {
  const naturalOrder = ["client_name", "contact_firstname", "campaign_name", "deadline", "approval_link"];
  const ordered = [];
  const seen = new Set();

  naturalOrder.forEach((field) => {
    if (fields.includes(field)) {
      ordered.push(field);
      seen.add(field);
    }
  });

  [subjectTemplateEditor, bodyTemplateEditor].forEach((editor) => {
    editor.querySelectorAll(".merge-token").forEach((token) => {
      const field = fieldFromToken(token.dataset.token);
      if (!field || field === "sender_name" || !fields.includes(field) || seen.has(field)) {
        return;
      }

      ordered.push(field);
      seen.add(field);
    });
  });

  fields.forEach((field) => {
    if (!seen.has(field)) {
      ordered.push(field);
    }
  });

  return ordered;
}

function recipientValuesFromCard(card) {
  const values = {};
  fields.forEach((field) => {
    values[field] = card.querySelector(`[name="${field}"]`)?.value || "";
  });
  values.approval_link_name = card.querySelector('[name="approval_link_name"]')?.value || "";
  values.approval_link_url = card.querySelector('[name="approval_link_url"]')?.value || values.approval_link || "";
  return values;
}

function recipientFieldColumnTemplates(values = {}) {
  let sheetColumn = 4;
  return getRecipientFieldOrder().map((field) => {
    const template = recipientFieldTemplate(field, values, sheetColumn);
    sheetColumn += field === "approval_link" ? 2 : 1;
    return template;
  }).join("");
}

function recipientSheetColumnWidths() {
  const fieldColumns = getRecipientFieldOrder().flatMap((field) => {
    if (field === "approval_link") {
      return ["minmax(170px, 1fr)", "minmax(220px, 1.2fr)"];
    }

    if (field === "contact_firstname") {
      return ["minmax(150px, 0.95fr)"];
    }

    if (field === "deadline") {
      return ["minmax(140px, 0.85fr)"];
    }

    return ["minmax(160px, 1fr)"];
  });

  return ["92px", "132px", "minmax(260px, 1.45fr)", ...fieldColumns].join(" ");
}

function syncRecipientSheetHeader() {
  if (!recipientSheet || !recipientSheetHeader) {
    return;
  }

  const headers = ["Email No.", "Actions", "Email address(es)", ...getRecipientFieldOrder().flatMap(fieldHeader)];
  recipientSheet.style.setProperty("--recipient-sheet-columns", recipientSheetColumnWidths());
  recipientSheet.style.setProperty("--recipient-sheet-min-width", `${headers.length === 9 ? 1490 : Math.max(980, 352 + ((headers.length - 3) * 170))}px`);
  recipientSheetHeader.innerHTML = headers.map((header) => `<span>${escapeHtml(header)}</span>`).join("");
}

function syncRecipientDetailFieldOrder() {
  syncRecipientSheetHeader();
  recipientBody.querySelectorAll(".recipient-card").forEach((card) => {
    const grid = card.querySelector(".recipient-detail-grid");
    if (!grid) {
      return;
    }

    const values = recipientValuesFromCard(card);
    grid.innerHTML = recipientFieldColumnTemplates(values);
  });
}

function emailInputName() {
  emailInputCounter += 1;
  return `recipient_email_${emailInputCounter}`;
}

function emailInputSelector() {
  return "[data-recipient-email-input]";
}

function emailChipsTemplate(value = "") {
  const emails = splitEmailList(value);
  return `
    <div class="email-chip-input" data-email-chip-input>
      ${emails.map((email) => `<span class="email-address-chip">${escapeHtml(email)}<button type="button" data-remove-email-chip aria-label="Remove ${escapeAttribute(email)}">×</button></span>`).join("")}
      <input name="${emailInputName()}" data-recipient-email-input type="text" value="" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" />
    </div>
  `;
}

function addressRowTemplate(values = {}, type = "To", isExtra = false) {
  const fieldType = values.recipient_type || type;
  const typeClass = `type-${fieldType.toLowerCase()}`;
  const addressLabel = fieldType === "To" ? "Email address(es)" : `${fieldType}:`;
  return `
    <div class="recipient-address-row ${typeClass}${isExtra ? " is-extra" : ""}">
      <div class="address-field-static">
        <input type="hidden" name="recipient_type" value="${fieldType}" />
      </div>
      <label>
        <span class="email-address-label">${addressLabel}</span>
        ${emailChipsTemplate(values.recipient_email || "")}
      </label>
    </div>
  `;
}

function rowTemplate(values = {}) {
  const row = document.createElement("article");
  row.className = "recipient-card";
  const addressRows = values.addresses?.length
    ? values.addresses.map((address, index) => addressRowTemplate({ recipient_email: address.email, recipient_type: address.type }, address.type, index > 0)).join("")
    : addressRowTemplate(values);
  row.innerHTML = `
    <div class="recipient-card-top">
      <strong>Email</strong>
      <button class="table-button" type="button" data-remove-row>Remove</button>
    </div>
    <div class="recipient-address-stack" data-address-stack>
      ${addressRows}
    </div>
    <div class="address-field-actions">
      <button class="add-placeholder add-address-link" type="button" data-add-address-row="Cc"><span>+</span>Add cc:</button>
      <button class="add-placeholder add-address-link" type="button" data-add-address-row="Bcc"><span>+</span>Add bcc:</button>
      <button class="add-placeholder remove-address-link" type="button" data-remove-address-row>Remove email field</button>
    </div>
    <div class="recipient-detail-grid">
      ${recipientFieldColumnTemplates(values)}
    </div>
  `;
  return row;
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function splitEmailList(value) {
  return String(value)
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function looksCompleteEmail(value) {
  return /^[^\s,;@]+@[^\s,;@]+\.(com|org|net|edu|gov|io|ai|app|biz|info|us)$/i.test(value.trim());
}

function shouldCommitEmailInput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/[\s,;]$/.test(value)) {
    return splitEmailList(value).some(looksCompleteEmail);
  }

  return looksCompleteEmail(trimmed);
}

function getAddressGroups(addresses = []) {
  return addresses.reduce((groups, address) => {
    const key = address.type || "To";
    groups[key] = groups[key] || [];
    splitEmailList(address.email).forEach((email) => groups[key].push(email));
    return groups;
  }, { To: [], Cc: [], Bcc: [] });
}

function addressPreviewHtml(addresses = []) {
  const groups = getAddressGroups(addresses);
  return ["To", "Cc", "Bcc"].filter((group) => group === "To" || groups[group].length).map((group) => `
    <label>
      <span>${group}:</span>
      <input value="${escapeAttribute(groups[group].join(", "))}" data-address-input="${group}" />
    </label>
  `).join("");
}

function encodedDraftParams(email) {
  const groups = getAddressGroups(email.addresses);
  const body = htmlToText(email.body);
  return {
    to: groups.To.join(","),
    cc: groups.Cc.join(","),
    bcc: groups.Bcc.join(","),
    subject: email.subject || "",
    body,
  };
}

function queryString(params, aliases = {}) {
  return Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${aliases[key] || key}=${encodeURIComponent(value)}`)
    .join("&");
}

function draftLinksHtml(email) {
  const params = encodedDraftParams(email);
  const gmailQuery = queryString(params, { subject: "su" });
  const outlookQuery = queryString(params);
  const mailtoRecipients = params.to.split(",").filter(Boolean).map(encodeURIComponent).join(",");
  const mailtoQuery = queryString({ cc: params.cc, bcc: params.bcc, subject: params.subject, body: params.body });
  const mailtoHref = `mailto:${mailtoRecipients}${mailtoQuery ? `?${mailtoQuery}` : ""}`;

  return `
    <div class="draft-actions" aria-label="Draft actions">
      <a class="draft-link draft-link-primary" href="https://mail.google.com/mail/?view=cm&fs=1&${gmailQuery}" target="_blank" rel="noopener noreferrer">Open in Gmail</a>
      <a class="draft-link" href="https://outlook.office.com/mail/deeplink/compose?${outlookQuery}" target="_blank" rel="noopener noreferrer">Open in Outlook</a>
      <a class="draft-link" href="${escapeAttribute(mailtoHref)}">Default email app</a>
    </div>
  `;
}

function updateAddressRemoveButtons(card) {
  const rows = Array.from(card.querySelectorAll(".recipient-address-row"));
  const removeButton = card.querySelector("[data-remove-address-row]");
  const addressTypes = new Set(rows.map((row) => row.querySelector('[name="recipient_type"]')?.value));

  card.querySelectorAll("[data-add-address-row]").forEach((button) => {
    button.hidden = addressTypes.has(button.dataset.addAddressRow);
  });

  if (removeButton) {
    removeButton.hidden = rows.length <= 1;
  }
}

function updateEmailChipState(container) {
  if (!container) {
    return;
  }

  const inputValue = container.querySelector(emailInputSelector())?.value.trim() || "";
  const hasChips = Boolean(container.querySelector(".email-address-chip"));
  container.classList.toggle("is-populated", Boolean(inputValue) || hasChips);
}

function updateAllEmailChipStates() {
  recipientBody.querySelectorAll("[data-email-chip-input]").forEach(updateEmailChipState);
}

function setImportStatus(message = "", tone = "") {
  importStatus.textContent = message;
  importStatus.classList.toggle("is-error", tone === "error");
  importStatus.classList.toggle("is-success", tone === "success");
}

function getEmailChipValues(container) {
  const chips = Array.from(container.querySelectorAll(".email-address-chip")).map((chip) => chip.firstChild?.textContent.trim() || "");
  const inputValue = container.querySelector(emailInputSelector())?.value || "";
  return [...chips, ...splitEmailList(inputValue)].filter(Boolean);
}

function createEmailChip(email) {
  const chip = document.createElement("span");
  chip.className = "email-address-chip";
  chip.appendChild(document.createTextNode(email));

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-remove-email-chip", "");
  button.setAttribute("aria-label", `Remove ${email}`);
  button.textContent = "×";
  chip.appendChild(button);

  return chip;
}

function commitEmailChips(input) {
  const container = input.closest("[data-email-chip-input]");
  const emails = splitEmailList(input.value);
  if (!container || !emails.length) {
    updateEmailChipState(container);
    return;
  }

  const existing = new Set(Array.from(container.querySelectorAll(".email-address-chip")).map((chip) => chip.firstChild?.textContent.trim() || ""));
  emails.forEach((email) => {
    if (!existing.has(email)) {
      container.insertBefore(createEmailChip(email), input);
      existing.add(email);
    }
  });
  input.value = "";
  updateEmailChipState(container);
  clearResolvedRecipientError(input);
}

function clearResolvedRecipientError(input) {
  if (!input?.hasAttribute("aria-invalid")) {
    return;
  }

  if (input.matches(emailInputSelector())) {
    const container = input.closest("[data-email-chip-input]");
    if (getEmailChipValues(container).length) {
      setInputValidity(input, false);
    }
    return;
  }

  if (input.name === "approval_link_url") {
    setInputValidity(input, !input.value.trim() || !hasLinkDomain(input.value));
    input.closest("[data-creative-link-field]")?.classList.toggle(
      "is-invalid",
      Boolean(input.closest("[data-creative-link-field]")?.querySelector("[aria-invalid]")),
    );
    return;
  }

  if (input.value.trim()) {
    setInputValidity(input, false);
    input.closest("[data-creative-link-field]")?.classList.toggle(
      "is-invalid",
      Boolean(input.closest("[data-creative-link-field]")?.querySelector("[aria-invalid]")),
    );
  }
}

function fieldHeader(field) {
  if (field === "approval_link") {
    return ["Creative link name", "Creative link URL"];
  }
  return fieldLabels[field] || field.replaceAll("_", " ");
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function csvHeaders() {
  return ["To", "Cc", "Bcc", ...getRecipientFieldOrder().flatMap(fieldHeader)];
}

function downloadCsvTemplate() {
  const csv = `${csvHeaders().map(csvEscape).join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "worksmartos-approval-email-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function valuesFromCsvRow(headers, row) {
  const byHeader = new Map(headers.map((header, index) => [normalizeHeader(header), row[index]?.trim() || ""]));
  const values = {};
  fields.forEach((field) => {
    if (field === "approval_link") {
      values.approval_link_name = byHeader.get("creative_link_name") || byHeader.get("approval_link_name") || "";
      values.approval_link_url = byHeader.get("creative_link_url") || byHeader.get("approval_link_url") || byHeader.get("creative_link") || byHeader.get("approval_link") || "";
      values.approval_link = values.approval_link_url;
      return;
    }

    values[field] = byHeader.get(normalizeHeader(fieldHeader(field))) || byHeader.get(normalizeHeader(field)) || "";
  });

  values.addresses = [
    { type: "To", email: byHeader.get("to") || "" },
    { type: "Cc", email: byHeader.get("cc") || "" },
    { type: "Bcc", email: byHeader.get("bcc") || "" },
  ].filter((address) => address.email);

  return values;
}

function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    setImportStatus("No recipient rows found in the CSV.", "error");
    return;
  }

  const [headers, ...dataRows] = rows;
  const cards = dataRows.map((row) => rowTemplate(valuesFromCsvRow(headers, row)));
  recipientBody.replaceChildren(...cards);
  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
  updateAllEmailChipStates();
  setImportStatus(`${cards.length} ${cards.length === 1 ? "email" : "emails"} imported from CSV.`, "success");
}

function getRecipients() {
  return Array.from(recipientBody.querySelectorAll(".recipient-card"))
    .map((row) => {
      const data = {};
      fields.forEach((field) => {
        if (field === "approval_link") {
          data.approval_link_name = row.querySelector('[name="approval_link_name"]')?.value.trim() || "";
          data.approval_link_url = row.querySelector('[name="approval_link_url"]')?.value.trim() || "";
          data.approval_link = data.approval_link_name || data.approval_link_url;
          return;
        }

        data[field] = row.querySelector(`[name="${field}"]`)?.value.trim() || "";
      });
      const addresses = Array.from(row.querySelectorAll(".recipient-address-row")).map((addressRow) => ({
        type: addressRow.querySelector('[name="recipient_type"]')?.value || "To",
        email: getEmailChipValues(addressRow.querySelector("[data-email-chip-input]")).join(", "),
      })).filter((address) => address.email);
      data.addresses = addresses;
      data.recipient_type = addresses.map((address) => address.type).join("; ");
      data.recipient_email = addresses.map((address) => address.email).join("; ");
      return data;
    })
    .filter((row) => row.client_name || row.contact_firstname || row.campaign_name || row.approval_link_name || row.approval_link_url);
}

function linkifyCreativeLink(data) {
  const label = String(data.approval_link_name || "").trim();
  const rawUrl = String(data.approval_link_url || "").trim();
  if (!label && !rawUrl) {
    return "";
  }

  if (!rawUrl) {
    return escapeHtml(label);
  }

  const href = normalizeLinkUrl(rawUrl);
  if (!hasLinkDomain(href)) {
    return escapeHtml(label || rawUrl);
  }

  const link = `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(href)}</a>`;
  return label ? `${escapeHtml(label)}<br>${link}` : link;
}

function normalizeLinkUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function hasLinkDomain(value) {
  try {
    const { hostname } = new URL(normalizeLinkUrl(value));
    const topLevelDomain = hostname.split(".").pop() || "";
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(hostname)
      && /[a-z]/i.test(topLevelDomain);
  } catch {
    return false;
  }
}

function mergeTemplate(template, data, options = {}) {
  return String(template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = data[key] || "";
    if (options.html && key === "approval_link") {
      return linkifyCreativeLink(data);
    }
    return options.html ? escapeHtml(value) : value;
  });
}

function normalizeDraftText(value) {
  return String(value)
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/^\s+/, ""))
    .join("\n")
    .trim();
}

function htmlToText(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  temp.querySelectorAll("a[href]").forEach((link) => {
    link.replaceWith(document.createTextNode(link.href));
  });

  return normalizeDraftText(temp.innerText);
}

function createTokenElement(token, label, removeAttribute = "data-remove-token") {
  const chip = document.createElement("span");
  chip.className = "merge-token";
  chip.contentEditable = "false";
  chip.dataset.token = token;
  chip.dataset.label = label;
  chip.textContent = label;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.setAttribute(removeAttribute, "");
  removeButton.setAttribute("aria-label", `Remove ${label}`);
  removeButton.textContent = "×";
  chip.appendChild(removeButton);

  return chip;
}

function createPaletteToken(token, label) {
  return createTokenElement(token, label, "data-remove-placeholder");
}

function labelFromTokenElement(element) {
  return element.dataset.label || element.textContent.replace("×", "").trim();
}

function addRecipientField(field, label) {
  if (fields.includes(field)) {
    return;
  }

  fields.push(field);
  fieldLabels[field] = label;

  syncRecipientDetailFieldOrder();
}

function paletteFieldsFromTemplate() {
  return Array.from(tokenList.querySelectorAll("[data-token]")).map((token) => ({
    field: fieldFromToken(token.dataset.token),
    token: token.dataset.token,
    label: labelFromTokenElement(token),
  }));
}

function getTemplateState() {
  return {
    subjectHtml: subjectTemplateEditor.innerHTML,
    bodyHtml: bodyTemplateEditor.innerHTML,
    senderName: form.elements.sender_name?.value || "",
    paletteFields: paletteFieldsFromTemplate(),
    recipientFields: fields.map((field) => ({
      field,
      label: fieldLabels[field] || field,
    })),
  };
}

function resetTemplateFields(template) {
  const paletteFields = Array.isArray(template.paletteFields) && template.paletteFields.length
    ? template.paletteFields
    : [
        ...defaultFields.map((field) => ({ field, token: `{{${field}}}`, label: fieldLabels[field] || field })),
        { field: "sender_name", token: "{{sender_name}}", label: "Sender Name" },
      ];
  const recipientFields = Array.isArray(template.recipientFields) && template.recipientFields.length
    ? template.recipientFields
    : paletteFields.filter((item) => item.field !== "sender_name");

  fields.length = 0;
  Object.keys(fieldLabels).forEach((field) => {
    delete fieldLabels[field];
  });

  recipientFields.forEach((item) => {
    if (!item.field || item.field === "sender_name") {
      return;
    }

    fields.push(item.field);
    fieldLabels[item.field] = item.label || item.field;
  });

  tokenList.innerHTML = "";
  paletteFields.forEach((item) => {
    if (!item.token || !item.label) {
      return;
    }

    const token = createPaletteToken(item.token, item.label);
    tokenList.appendChild(token);
    bindTokenControl(token);
  });

  syncRecipientDetailFieldOrder();
}

function loadTemplateState(template = {}) {
  if (template.subjectHtml) {
    subjectTemplateEditor.innerHTML = template.subjectHtml;
  }

  if (template.bodyHtml) {
    bodyTemplateEditor.innerHTML = template.bodyHtml;
  }

  if (typeof template.senderName === "string" && form.elements.sender_name) {
    form.elements.sender_name.value = template.senderName;
  }

  resetTemplateFields(template);
  saveEditorHistory();
}

function tokenFormatWrapper(token, textNode) {
  let node = textNode;
  const style = window.getComputedStyle(token);
  const isBold = Number.parseInt(style.fontWeight, 10) >= 600 || style.fontWeight === "bold";
  const isItalic = style.fontStyle === "italic";
  const isUnderlined = style.textDecorationLine.includes("underline");

  if (isBold) {
    const strong = document.createElement("strong");
    strong.appendChild(node);
    node = strong;
  }

  if (isItalic) {
    const em = document.createElement("em");
    em.appendChild(node);
    node = em;
  }

  if (isUnderlined) {
    const underline = document.createElement("u");
    underline.appendChild(node);
    node = underline;
  }

  return node;
}

function replaceTokenChips(container, preserveFormatting = false) {
  container.querySelectorAll(".merge-token").forEach((token) => {
    const textNode = document.createTextNode(token.dataset.token || "");
    token.replaceWith(preserveFormatting ? tokenFormatWrapper(token, textNode) : textNode);
  });
}

function templateHtmlToMergeHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  replaceTokenChips(temp, true);
  return temp.innerHTML;
}

function templateHtmlToMergeText(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  replaceTokenChips(temp);
  return temp.innerText.trim();
}

function rememberTemplateRange(editor) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return;
  }

  activeTemplateEditor = editor;
  savedTemplateRange = range.cloneRange();
}

function insertTokenIntoEditor(editor, token, label) {
  editor.focus();
  const selection = window.getSelection();
  const node = createTokenElement(token, label);
  const spacer = document.createTextNode(" ");
  const range = savedTemplateRange && editor.contains(savedTemplateRange.commonAncestorContainer)
    ? savedTemplateRange.cloneRange()
    : document.createRange();

  if (!savedTemplateRange || !editor.contains(savedTemplateRange.commonAncestorContainer)) {
    range.selectNodeContents(editor);
    range.collapse(false);
  }

  range.deleteContents();
  range.insertNode(spacer);
  range.insertNode(node);
  range.setStartAfter(spacer);
  range.setEndAfter(spacer);
  selection.removeAllRanges();
  selection.addRange(range);
  savedTemplateRange = range.cloneRange();
  saveEditorHistory();
}

function insertToken(target, token, label) {
  insertTokenIntoEditor(target, token, label);
}

function updateHistoryButtons() {
  undoButton.disabled = editorHistoryIndex <= 0;
  redoButton.disabled = editorHistoryIndex >= editorHistory.length - 1;
}

function saveEditorHistory() {
  if (isRestoringHistory) {
    return;
  }

  const html = `${subjectTemplateEditor.innerHTML}|||${bodyTemplateEditor.innerHTML}`;
  if (editorHistory[editorHistoryIndex] === html) {
    updateHistoryButtons();
    return;
  }

  editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
  editorHistory.push(html);
  editorHistoryIndex = editorHistory.length - 1;
  updateHistoryButtons();
}

function restoreEditorHistory(index) {
  if (index < 0 || index >= editorHistory.length) {
    return;
  }

  isRestoringHistory = true;
  editorHistoryIndex = index;
  const [subjectHtml = "", bodyHtml = ""] = editorHistory[editorHistoryIndex].split("|||");
  subjectTemplateEditor.innerHTML = subjectHtml;
  bodyTemplateEditor.innerHTML = bodyHtml;
  bodyTemplateEditor.focus();
  isRestoringHistory = false;
  updateHistoryButtons();
}

function renderEmails(emails) {
  output.innerHTML = "";
  generatedEmails = emails;
  outputCount.textContent = "Review and open emails to send";
  exportButton.disabled = emails.length === 0;

  if (!emails.length) {
    output.innerHTML = `
      <article class="empty-state">
        <h3>Add at least one recipient to generate an email.</h3>
      </article>
    `;
    return;
  }

  emails.forEach((email, index) => {
    const card = document.createElement("article");
    card.className = "email-preview-card";
    card.innerHTML = `
      <div class="email-preview-top">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(email.client_name || "Untitled recipient")}</strong>
      </div>
      <div class="email-address-preview">
        ${addressPreviewHtml(email.addresses)}
      </div>
      <label>
        <span>Subject</span>
        <input value="${escapeAttribute(email.subject)}" data-subject-input />
      </label>
      <div class="email-body-field">
        <span>Body</span>
        <div class="email-body-preview" contenteditable="true" data-body-input role="textbox" aria-multiline="true">${email.body}</div>
      </div>
      ${draftLinksHtml(email)}
    `;

    card.querySelectorAll("[data-body-input] a[href]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(link.href, "_blank", "noopener,noreferrer");
      });
    });

    output.appendChild(card);
  });
}

async function copyText(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();
}

async function copyRichText(element) {
  const html = element.innerHTML;
  const text = element.innerText;

  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch (error) {
      await copyText(text);
      return;
    }
  }

  await copyText(text);
}

function exportCsv() {
  const rows = [["Send as", "Email address", "Company name", "Recipient first name", "Campaign", "Subject", "Body"]];

  output.querySelectorAll(".email-preview-card").forEach((card, index) => {
    const email = generatedEmails[index];
    rows.push([
      email.recipient_type,
      email.recipient_email,
      email.client_name,
      email.contact_firstname,
      email.campaign_name,
      card.querySelector("[data-subject-input]").value,
      card.querySelector("[data-body-input]").innerText.trim(),
    ]);
  });

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "approval-emails.csv";
  link.click();
  URL.revokeObjectURL(url);
}

recipientBody.addEventListener("click", (event) => {
  if (event.target.matches("[data-remove-row]")) {
    const rows = recipientBody.querySelectorAll(".recipient-card");
    if (rows.length > 1) {
      event.target.closest(".recipient-card").remove();
      renumberRecipients();
    }
  }

  const addAddressButton = event.target.closest("[data-add-address-row]");
  if (addAddressButton) {
    const card = event.target.closest(".recipient-card");
    const type = addAddressButton.dataset.addAddressRow || "Cc";
    const alreadyExists = Array.from(card.querySelectorAll('[name="recipient_type"]')).some((input) => input.value === type);
    if (!alreadyExists) {
      const stack = card.querySelector("[data-address-stack]");
      stack?.insertAdjacentHTML("beforeend", addressRowTemplate({}, type, true));
    }
    updateAddressRemoveButtons(card);
  }

  if (event.target.closest("[data-remove-address-row]")) {
    const card = event.target.closest(".recipient-card");
    const rows = card.querySelectorAll(".recipient-address-row");
    if (rows.length > 1) {
      rows[rows.length - 1].remove();
      updateAddressRemoveButtons(card);
    }
  }

  if (event.target.matches("[data-remove-email-chip]")) {
    const container = event.target.closest("[data-email-chip-input]");
    if (!container?.classList.contains("is-expanded") || container?.dataset.skipChipRemove === "true") {
      event.preventDefault();
      delete container.dataset.skipChipRemove;
      container?.classList.add("is-expanded");
      container?.querySelector(emailInputSelector())?.focus();
      return;
    }

    event.target.closest(".email-address-chip")?.remove();
    updateEmailChipState(container);
    container?.querySelector(emailInputSelector())?.focus();
    return;
  }

  const emailChipContainer = event.target.closest("[data-email-chip-input]");
  if (emailChipContainer) {
    emailChipContainer.classList.add("is-expanded");
    emailChipContainer.querySelector(emailInputSelector())?.focus();
  }
});

recipientBody.addEventListener("pointerdown", (event) => {
  const emailChipContainer = event.target.closest("[data-email-chip-input]");
  if (!emailChipContainer || emailChipContainer.classList.contains("is-expanded")) {
    return;
  }

  emailChipContainer.dataset.skipChipRemove = "true";
  emailChipContainer.classList.add("is-expanded");
  emailChipContainer.querySelector(emailInputSelector())?.focus();
  window.setTimeout(() => {
    delete emailChipContainer.dataset.skipChipRemove;
  }, 350);
}, true);

recipientBody.addEventListener("focusin", (event) => {
  const emailChipContainer = event.target.closest("[data-email-chip-input]");
  if (emailChipContainer) {
    emailChipContainer.classList.add("is-expanded");
  }
});

recipientBody.addEventListener("keydown", (event) => {
  if (!event.target.matches(emailInputSelector())) {
    return;
  }

  if (event.key === "Enter" || event.key === "," || event.key === " ") {
    event.preventDefault();
    commitEmailChips(event.target);
  }
});

recipientBody.addEventListener("input", (event) => {
  if (!event.target.matches("input")) {
    return;
  }

  if (event.target.matches(emailInputSelector())) {
    updateEmailChipState(event.target.closest("[data-email-chip-input]"));
    if (shouldCommitEmailInput(event.target.value)) {
      commitEmailChips(event.target);
    }
  }

  clearResolvedRecipientError(event.target);
});

recipientBody.addEventListener("focusout", (event) => {
  if (event.target.matches(emailInputSelector())) {
    commitEmailChips(event.target);
    clearResolvedRecipientError(event.target);
    const container = event.target.closest("[data-email-chip-input]");
    window.requestAnimationFrame(() => {
      if (!container?.contains(document.activeElement)) {
        container?.classList.remove("is-expanded");
      }
    });
  }
});

addRowButton.addEventListener("click", () => {
  recipientBody.appendChild(rowTemplate());
  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
  updateAllEmailChipStates();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateEmails();
  goToStep(2);
});

exportButton.addEventListener("click", exportCsv);
downloadTemplateButton.addEventListener("click", downloadCsvTemplate);

uploadCsvInput.addEventListener("change", async () => {
  const file = uploadCsvInput.files?.[0];
  if (!file) {
    return;
  }

  importCsv(await file.text());
  uploadCsvInput.value = "";
});


formatButtons.forEach((button) => {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    const command = button.dataset.format;

    if (command === "undo") {
      restoreEditorHistory(editorHistoryIndex - 1);
      return;
    }

    if (command === "redo") {
      restoreEditorHistory(editorHistoryIndex + 1);
      return;
    }

    activeTemplateEditor.focus();
    if (savedTemplateRange && activeTemplateEditor.contains(savedTemplateRange.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedTemplateRange);
    }

    if (command === "createLink") {
      const url = normalizeLinkUrl(window.prompt("Link URL", "https://"));
      if (!url) {
        return;
      }
      document.execCommand(command, false, url);
    } else {
      document.execCommand(command, false, null);
    }

    rememberTemplateRange(activeTemplateEditor);
    saveEditorHistory();
  });
});

subjectTemplateEditor.addEventListener("input", saveEditorHistory);
bodyTemplateEditor.addEventListener("input", saveEditorHistory);

[subjectTemplateEditor, bodyTemplateEditor].forEach((editor) => {
  editor.addEventListener("focus", () => {
    activeTemplateEditor = editor;
    rememberTemplateRange(editor);
  });

  editor.addEventListener("mouseup", () => rememberTemplateRange(editor));
  editor.addEventListener("keyup", () => rememberTemplateRange(editor));
  editor.addEventListener("input", () => rememberTemplateRange(editor));
});

function bindTokenControl(tokenButton) {
  tokenButton.addEventListener("mousedown", (event) => {
    if (!event.target.matches("button")) {
      event.preventDefault();
    }
  });

  tokenButton.addEventListener("click", (event) => {
    if (event.target.matches("button")) {
      return;
    }

    insertToken(activeTemplateEditor, tokenButton.dataset.token, labelFromTokenElement(tokenButton));
  });
}

tokenList.querySelectorAll("[data-token]").forEach(bindTokenControl);

tokenList.addEventListener("click", (event) => {
  if (event.target.matches("[data-remove-placeholder]")) {
    event.target.closest("[data-token]").remove();
  }
});

[subjectTemplateEditor, bodyTemplateEditor].forEach((editor) => {
  editor.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-token]")) {
      event.target.closest(".merge-token").remove();
      saveEditorHistory();
    }
  });
});

addPlaceholderButton.addEventListener("click", () => {
  const label = window.prompt("Placeholder name", "New Placeholder");
  if (!label) {
    return;
  }

  const field = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!field) {
    return;
  }

  const cleanLabel = label.trim();
  addRecipientField(field, cleanLabel);

  const token = createPaletteToken(`{{${field}}}`, cleanLabel);
  tokenList.appendChild(token);
  bindTokenControl(token);
});


stepLabels.forEach((button, index) => {
  button.addEventListener("click", () => {
    if (index === 2 && !generateEmails()) {
      return;
    }
    goToStep(index);
  });
});

nextStepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (currentStep === 0 && !form.reportValidity()) {
      return;
    }

    goToStep(currentStep + 1);
  });
});

prevStepButtons.forEach((button) => {
  button.addEventListener("click", () => goToStep(currentStep - 1));
});

generateStepButton.addEventListener("click", () => {
  if (generateEmails()) {
    goToStep(2);
  }
});

function hasRecipientContent(card) {
  return Boolean(card) && Array.from(card.querySelectorAll("input")).some((input) => {
    if (input.name === "recipient_type") {
      return false;
    }
    if (input.matches(emailInputSelector())) {
      return Boolean(input.value.trim()) || Boolean(input.closest("[data-email-chip-input]")?.querySelector(".email-address-chip"));
    }
    return Boolean(input.value.trim());
  });
}

function setInputValidity(input, isInvalid) {
  if (!input) {
    return;
  }

  input.toggleAttribute("aria-invalid", isInvalid);
  input.closest("[data-email-chip-input]")?.classList.toggle("is-invalid", isInvalid);
}

function setCreativeLinkValidity(field, nameInvalid, urlInvalid) {
  field.classList.toggle("is-invalid", nameInvalid || urlInvalid);
  setInputValidity(field.querySelector('[name="approval_link_name"]'), nameInvalid);
  setInputValidity(field.querySelector('[name="approval_link_url"]'), urlInvalid);
}

function validateRecipientRows() {
  let firstInvalidInput = null;
  const messages = new Set();

  recipientBody.querySelectorAll(".recipient-card").forEach((card) => {
    card.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
    card.querySelectorAll(".is-invalid").forEach((field) => field.classList.remove("is-invalid"));

    if (!hasRecipientContent(card)) {
      return;
    }

    const emailInput = card.querySelector(".recipient-address-row.type-to [data-recipient-email-input]");
    const emailChipContainer = emailInput?.closest("[data-email-chip-input]");
    const hasEmail = Boolean(emailChipContainer) && getEmailChipValues(emailChipContainer).length > 0;
    setInputValidity(emailInput, !hasEmail);
    if (!hasEmail) {
      messages.add("Email address(es) is required.");
      firstInvalidInput = firstInvalidInput || emailInput;
    }

    getRecipientFieldOrder().forEach((field) => {
      if (field === "approval_link") {
        const creativeField = card.querySelector("[data-creative-link-field]");
        const nameInput = creativeField?.querySelector('[name="approval_link_name"]');
        const urlInput = creativeField?.querySelector('[name="approval_link_url"]');
        const name = nameInput?.value.trim() || "";
        const url = urlInput?.value.trim() || "";
        const nameInvalid = !name;
        const urlInvalid = !url || !hasLinkDomain(url);

        if (creativeField) {
          setCreativeLinkValidity(creativeField, nameInvalid, urlInvalid);
        }

        if (nameInvalid) {
          messages.add("Creative link name is required.");
          firstInvalidInput = firstInvalidInput || nameInput;
        }

        if (!url) {
          messages.add("Creative link URL is required.");
          firstInvalidInput = firstInvalidInput || urlInput;
        } else if (urlInvalid) {
          messages.add("Creative link URL must include a domain.");
          firstInvalidInput = firstInvalidInput || urlInput;
        }
        return;
      }

      const input = card.querySelector(`[name="${field}"]`);
      const isInvalid = !input?.value.trim();
      setInputValidity(input, isInvalid);
      if (isInvalid) {
        messages.add(`${fieldLabels[field] || field.replaceAll("_", " ")} is required.`);
        firstInvalidInput = firstInvalidInput || input;
      }
    });
  });

  if (firstInvalidInput) {
    firstInvalidInput.focus();
    setImportStatus("Please check the highlighted fields below and fill in any missing information before reviewing emails.", "error");
    return false;
  }

  setImportStatus("");
  return true;
}

function generateEmails() {
  if (!validateRecipientRows()) {
    return false;
  }

  const formData = new FormData(form);
  const subjectTemplate = templateHtmlToMergeText(subjectTemplateEditor.innerHTML);
  const bodyTemplate = templateHtmlToMergeHtml(bodyTemplateEditor.innerHTML);
  const senderName = formData.get("sender_name") || "";

  const emails = getRecipients().map((recipient) => {
    const data = { ...recipient, sender_name: senderName };
    return {
      ...recipient,
      subject: mergeTemplate(subjectTemplate, data),
      body: mergeTemplate(bodyTemplate, data, { html: true }),
    };
  });

  renderEmails(emails);
  return true;
}

function goToStep(step, options = {}) {
  currentStep = Math.max(0, Math.min(step, 2));
  if (currentStep === 1) {
    syncRecipientDetailFieldOrder();
  }
  stepperTrack.style.transform = `translateX(-${currentStep * (100 / 3)}%)`;

  document.querySelectorAll(".studio-step.is-entering").forEach((panel) => {
    panel.classList.remove("is-entering");
  });

  const activePanel = document.querySelector(`[data-step-panel="${currentStep}"]`);
  const shouldAnimatePanel = currentStep !== 0 || options.initial;
  if (activePanel && shouldAnimatePanel) {
    window.requestAnimationFrame(() => {
      activePanel.classList.add("is-entering");
    });
  }

  stepLabels.forEach((label, index) => {
    label.classList.toggle("is-active", index === currentStep);
  });
}

function renumberRecipients() {
  recipientBody.querySelectorAll(".recipient-card").forEach((card, index) => {
    const label = card.querySelector(".recipient-card-top strong");
    if (label) {
      label.textContent = `${index + 1}`;
    }
  });
}

renumberRecipients();
document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
updateAllEmailChipStates();
saveEditorHistory();
goToStep(0, { initial: true });

window.WorkSmartEmailStudio = {
  getTemplateState,
  loadTemplateState,
};
