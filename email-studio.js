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

let currentStep = 0;
let editorHistory = [];
let editorHistoryIndex = -1;
let isRestoringHistory = false;
let activeTemplateEditor = bodyTemplateEditor;
let savedTemplateRange = null;

let generatedEmails = [];

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

function recipientFieldTemplate(field, values = {}) {
  const wideClass = ["approval_link"].includes(field) || !defaultFields.includes(field) ? " class=\"wide\"" : "";
  return `<label${wideClass}><span>${escapeHtml(fieldLabels[field] || field)}</span><input name="${field}" value="${escapeAttribute(values[field] || "")}" /></label>`;
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
  return values;
}

function syncRecipientDetailFieldOrder() {
  recipientBody.querySelectorAll(".recipient-card").forEach((card) => {
    const grid = card.querySelector(".recipient-detail-grid");
    if (!grid) {
      return;
    }

    const values = recipientValuesFromCard(card);
    grid.innerHTML = getRecipientFieldOrder().map((field) => recipientFieldTemplate(field, values)).join("");
  });
}

function emailChipsTemplate(value = "") {
  const emails = splitEmailList(value);
  return `
    <div class="email-chip-input" data-email-chip-input>
      ${emails.map((email) => `<span class="email-address-chip">${escapeHtml(email)}<button type="button" data-remove-email-chip aria-label="Remove ${escapeAttribute(email)}">×</button></span>`).join("")}
      <input name="recipient_email" type="text" value="" />
    </div>
  `;
}

function addressRowTemplate(values = {}, type = "To", isExtra = false) {
  const fieldType = values.recipient_type || type;
  return `
    <div class="recipient-address-row${isExtra ? " is-extra" : ""}">
      <div class="address-field-static">
        <span>${fieldType}:</span>
        <input type="hidden" name="recipient_type" value="${fieldType}" />
      </div>
      <label>
        <span class="email-address-label">Email address(es)</span>
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
    ${addressRows}
    <div class="address-field-actions">
      <button class="add-placeholder add-address-link" type="button" data-add-address-row="Cc"><span>+</span>Add cc:</button>
      <button class="add-placeholder add-address-link" type="button" data-add-address-row="Bcc"><span>+</span>Add bcc:</button>
      <button class="add-placeholder remove-address-link" type="button" data-remove-address-row>Remove email field</button>
    </div>
    <div class="recipient-detail-grid">
      ${getRecipientFieldOrder().map((field) => recipientFieldTemplate(field, values)).join("")}
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
  return ["To", "Cc", "Bcc"].map((group) => `
    <label>
      <span>${group}:</span>
      <input value="${escapeAttribute(groups[group].join(", "))}" data-address-input="${group}" />
    </label>
  `).join("");
}

function updateAddressRemoveButtons(card) {
  const rows = card.querySelectorAll(".recipient-address-row");
  const removeButton = card.querySelector("[data-remove-address-row]");
  if (removeButton) {
    removeButton.hidden = rows.length <= 1;
  }
}

function getEmailChipValues(container) {
  const chips = Array.from(container.querySelectorAll(".email-address-chip")).map((chip) => chip.firstChild?.textContent.trim() || "");
  const inputValue = container.querySelector('[name="recipient_email"]')?.value || "";
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
}

function fieldHeader(field) {
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
  return ["To", "Cc", "Bcc", ...getRecipientFieldOrder().map(fieldHeader)];
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
    importStatus.textContent = "No recipient rows found in the CSV.";
    return;
  }

  const [headers, ...dataRows] = rows;
  const cards = dataRows.map((row) => rowTemplate(valuesFromCsvRow(headers, row)));
  recipientBody.replaceChildren(...cards);
  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
  importStatus.textContent = `${cards.length} ${cards.length === 1 ? "email" : "emails"} imported from CSV.`;
}

function getRecipients() {
  return Array.from(recipientBody.querySelectorAll(".recipient-card"))
    .map((row) => {
      const data = {};
      fields.forEach((field) => {
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
    .filter((row) => row.client_name || row.contact_firstname || row.campaign_name || row.approval_link);
}

function mergeTemplate(template, data, options = {}) {
  return String(template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = data[key] || "";
    return options.html ? escapeHtml(value) : value;
  });
}

function htmlToText(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.innerText.trim();
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
  outputCount.textContent = emails.length ? `${emails.length} approval emails ready.` : "No emails generated yet.";
  exportButton.disabled = emails.length === 0;

  if (!emails.length) {
    output.innerHTML = `
      <article class="empty-state">
        <h3>Your personalized approval emails will appear here.</h3>
        <p>Add at least one recipient row, then generate the batch.</p>
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
      <div class="email-preview-actions">
        <button class="button secondary" type="button" data-copy-subject>Copy subject</button>
        <button class="button primary" type="button" data-copy-body>Copy body</button>
      </div>
    `;

    card.querySelector("[data-copy-subject]").addEventListener("click", () => {
      copyText(card.querySelector("[data-subject-input]").value);
    });

    card.querySelector("[data-copy-body]").addEventListener("click", () => {
      copyRichText(card.querySelector("[data-body-input]"));
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
    const actions = card.querySelector(".address-field-actions");
    actions.insertAdjacentHTML("beforebegin", addressRowTemplate({}, addAddressButton.dataset.addAddressRow || "Cc", true));
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
    event.target.closest(".email-address-chip")?.remove();
  }
});

recipientBody.addEventListener("keydown", (event) => {
  if (!event.target.matches('[name="recipient_email"]')) {
    return;
  }

  if (event.key === "Enter" || event.key === "," || event.key === " ") {
    event.preventDefault();
    commitEmailChips(event.target);
  }
});

recipientBody.addEventListener("input", (event) => {
  if (event.target.matches('[name="recipient_email"]') && shouldCommitEmailInput(event.target.value)) {
    commitEmailChips(event.target);
  }
});

recipientBody.addEventListener("focusout", (event) => {
  if (event.target.matches('[name="recipient_email"]')) {
    commitEmailChips(event.target);
  }
});

addRowButton.addEventListener("click", () => {
  recipientBody.appendChild(rowTemplate());
  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
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
    document.execCommand(command, false, null);
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
    if (index === 2) {
      generateEmails();
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
  generateEmails();
  goToStep(2);
});

function generateEmails() {
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
}

function goToStep(step) {
  currentStep = Math.max(0, Math.min(step, 2));
  if (currentStep === 1) {
    syncRecipientDetailFieldOrder();
  }
  stepperTrack.style.transform = `translateX(-${currentStep * (100 / 3)}%)`;

  stepLabels.forEach((label, index) => {
    label.classList.toggle("is-active", index === currentStep);
  });
}

function renumberRecipients() {
  recipientBody.querySelectorAll(".recipient-card").forEach((card, index) => {
    const label = card.querySelector(".recipient-card-top strong");
    if (label) {
      label.textContent = `Email ${index + 1}`;
    }
  });
}

renumberRecipients();
document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
saveEditorHistory();
goToStep(0);
