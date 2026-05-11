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
const stepLabels = document.querySelectorAll(".studio-steps span");
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
  "custom_note",
];

const fieldLabels = {
  client_name: "Company name",
  contact_firstname: "Client first name",
  campaign_name: "Campaign",
  deadline: "Deadline",
  approval_link: "Approval link",
  custom_note: "Note",
};

const fields = [...defaultFields];

function recipientFieldTemplate(field, values = {}) {
  const wideClass = ["approval_link", "custom_note"].includes(field) || !defaultFields.includes(field) ? " class=\"wide\"" : "";
  return `<label${wideClass}><span>${escapeHtml(fieldLabels[field] || field)}</span><input name="${field}" value="${escapeAttribute(values[field] || "")}" /></label>`;
}

function rowTemplate(values = {}) {
  const row = document.createElement("article");
  row.className = "recipient-card";
  row.innerHTML = `
    <div class="recipient-card-top">
      <strong>Recipient</strong>
      <button class="table-button" type="button" data-remove-row>Remove</button>
    </div>
    ${fields.map((field) => recipientFieldTemplate(field, values)).join("")}
  `;
  return row;
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getRecipients() {
  return Array.from(recipientBody.querySelectorAll(".recipient-card"))
    .map((row) => {
      const data = {};
      fields.forEach((field) => {
        data[field] = row.querySelector(`[name="${field}"]`)?.value.trim() || "";
      });
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

  recipientBody.querySelectorAll(".recipient-card").forEach((card) => {
    card.insertAdjacentHTML("beforeend", recipientFieldTemplate(field));
  });
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
  const rows = [["Company name", "Client first name", "Campaign", "Subject", "Body"]];

  output.querySelectorAll(".email-preview-card").forEach((card, index) => {
    const email = generatedEmails[index];
    rows.push([
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
});

addRowButton.addEventListener("click", () => {
  recipientBody.appendChild(rowTemplate());
  renumberRecipients();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateEmails();
  goToStep(2);
});

exportButton.addEventListener("click", exportCsv);

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
  stepperTrack.style.transform = `translateX(-${currentStep * 100}%)`;

  stepLabels.forEach((label, index) => {
    label.classList.toggle("is-active", index === currentStep);
  });

  document.querySelectorAll("[data-step-panel]").forEach((panel) => {
    panel.classList.toggle("is-current-step", Number(panel.dataset.stepPanel) === currentStep);
  });
}

function renumberRecipients() {
  recipientBody.querySelectorAll(".recipient-card").forEach((card, index) => {
    const label = card.querySelector(".recipient-card-top strong");
    if (label) {
      label.textContent = `Recipient ${String(index + 1).padStart(2, "0")}`;
    }
  });
}

renumberRecipients();
saveEditorHistory();
goToStep(0);
