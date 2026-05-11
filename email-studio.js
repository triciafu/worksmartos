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
const tokenButtons = document.querySelectorAll("[data-token]");
const subjectTemplateInput = form.querySelector("[name=\"subject_template\"]");

let currentStep = 0;
let editorHistory = [];
let editorHistoryIndex = -1;
let isRestoringHistory = false;

let generatedEmails = [];

const fields = [
  "client_name",
  "contact_firstname",
  "campaign_name",
  "deadline",
  "approval_link",
  "custom_note",
];

function rowTemplate(values = {}) {
  const row = document.createElement("article");
  row.className = "recipient-card";
  row.innerHTML = `
    <div class="recipient-card-top">
      <strong>Recipient</strong>
      <button class="table-button" type="button" data-remove-row>Remove</button>
    </div>
    <label><span>Client/team</span><input name="client_name" value="${escapeAttribute(values.client_name || "")}" /></label>
    <label><span>Contact</span><input name="contact_firstname" value="${escapeAttribute(values.contact_firstname || "")}" /></label>
    <label><span>Campaign</span><input name="campaign_name" value="${escapeAttribute(values.campaign_name || "")}" /></label>
    <label><span>Deadline</span><input name="deadline" value="${escapeAttribute(values.deadline || "")}" /></label>
    <label class="wide"><span>Approval link</span><input name="approval_link" value="${escapeAttribute(values.approval_link || "")}" /></label>
    <label class="wide"><span>Note</span><input name="custom_note" value="${escapeAttribute(values.custom_note || "")}" /></label>
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

function insertTokenIntoInput(input, token) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
  input.focus();
  input.setSelectionRange(start + token.length, start + token.length);
}

function insertTokenIntoEditor(editor, token) {
  editor.focus();
  const selection = window.getSelection();

  if (!selection || !selection.rangeCount) {
    editor.append(document.createTextNode(token));
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    editor.append(document.createTextNode(token));
    return;
  }

  range.deleteContents();
  const node = document.createTextNode(token);
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertToken(target, token) {
  if (target === subjectTemplateInput) {
    insertTokenIntoInput(subjectTemplateInput, token);
    return;
  }

  insertTokenIntoEditor(bodyTemplateEditor, token);
}

function setEditorCaretFromPoint(editor, x, y) {
  const selection = window.getSelection();
  let range = null;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
    }
  }

  if (!selection || !range || !editor.contains(range.commonAncestorContainer)) {
    return;
  }

  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function handleTokenDrop(event, target) {
  event.preventDefault();
  const token = event.dataTransfer.getData("text/plain");

  if (!token) {
    return;
  }

  if (target === bodyTemplateEditor) {
    setEditorCaretFromPoint(bodyTemplateEditor, event.clientX, event.clientY);
  }

  insertToken(target, token);
  saveEditorHistory();
}

function updateHistoryButtons() {
  undoButton.disabled = editorHistoryIndex <= 0;
  redoButton.disabled = editorHistoryIndex >= editorHistory.length - 1;
}

function saveEditorHistory() {
  if (isRestoringHistory) {
    return;
  }

  const html = bodyTemplateEditor.innerHTML;
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
  bodyTemplateEditor.innerHTML = editorHistory[editorHistoryIndex];
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
  const rows = [["Client/team", "Contact", "Campaign", "Subject", "Body"]];

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

    bodyTemplateEditor.focus();
    document.execCommand(command, false, null);
    saveEditorHistory();
  });
});

bodyTemplateEditor.addEventListener("input", saveEditorHistory);

[subjectTemplateInput, bodyTemplateEditor].forEach((target) => {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    target.classList.add("is-drag-over");
  });

  target.addEventListener("dragleave", () => {
    target.classList.remove("is-drag-over");
  });

  target.addEventListener("drop", (event) => {
    target.classList.remove("is-drag-over");
    handleTokenDrop(event, target);
  });
});

tokenButtons.forEach((tokenButton) => {
  tokenButton.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", tokenButton.dataset.token);
    event.dataTransfer.effectAllowed = "copy";
    tokenButton.classList.add("is-dragging");
  });

  tokenButton.addEventListener("dragend", () => {
    tokenButton.classList.remove("is-dragging");
    bodyTemplateEditor.classList.remove("is-drag-over");
    subjectTemplateInput.classList.remove("is-drag-over");
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
  const subjectTemplate = formData.get("subject_template");
  const bodyTemplate = bodyTemplateEditor.innerHTML;
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
