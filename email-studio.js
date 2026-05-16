const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("[data-nav]");

function updateActiveNavLinks() {
  if (!nav) {
    return;
  }

  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const currentHash = window.location.hash;

  nav.querySelectorAll("a:not(.nav-cta)").forEach((link) => {
    const url = new URL(link.href, window.location.href);
    const linkPath = url.pathname.split("/").pop() || "index.html";
    const isActive = linkPath === currentPath && (!url.hash || url.hash === currentHash);

    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

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

updateActiveNavLinks();
window.addEventListener("hashchange", updateActiveNavLinks);

const form = document.querySelector("[data-email-studio-form]");
const recipientSheet = document.querySelector(".recipient-sheet");
const recipientSheetHeader = document.querySelector(".recipient-sheet-header");
const recipientBody = document.querySelector("[data-recipient-body]");
const output = document.querySelector("[data-email-output]");
const outputCount = document.querySelector("[data-output-count]");
const exportButton = document.querySelector("[data-export-csv]");
const addRowButton = document.querySelector("[data-add-row]");
const addRowCountInput = document.querySelector("[data-add-row-count]");
const stepperTrack = document.querySelector("[data-stepper-track]");
const stepLabels = document.querySelectorAll(".studio-steps button");
const themeButtons = document.querySelectorAll("[data-studio-theme]");
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
const templatePresetButtons = document.querySelectorAll("[data-template-preset]");
const templatePromptInput = document.querySelector("[data-template-prompt]");
const generateTemplateButton = document.querySelector("[data-generate-template]");
const templateStartStatus = document.querySelector("[data-template-start-status]");

let currentStep = 0;
let editorHistory = [];
let editorHistoryIndex = -1;
let isRestoringHistory = false;
let activeTemplateEditor = bodyTemplateEditor;
let savedTemplateRange = null;
let emailInputCounter = 1;
let autosaveTimer = null;
let isRestoringAutosave = false;

let generatedEmails = [];
let emailWorkflowState = [];

const studioVariant = document.body.dataset.studioVariant || "creative-approval";
let activeTemplatePreset = studioVariant;
const isBlankSlateStudio = studioVariant === "blank" || studioVariant === "batch";
const autosaveVersions = {
  blank: "v2",
  batch: "v1",
  "event-invite": "v5",
};
const studioFileSlugs = {
  blank: "custom-email-template",
  batch: "batch-email-template",
  "event-invite": "event-invite-email-template",
  "sales-outreach": "sales-outreach-email-template",
  "creative-approval": "creative-approval-email-template",
};
const defaultFieldSets = {
  blank: ["contact_firstname"],
  batch: ["contact_firstname"],
  "event-invite": ["contact_firstname", "event_name", "event_date", "event_time", "event_location", "rsvp_link"],
  "sales-outreach": ["contact_firstname", "client_name", "recipient_role", "pain_point", "offer", "scheduling_link"],
  "creative-approval": ["client_name", "contact_firstname", "campaign_name", "deadline", "approval_link"],
};
const autosaveKey = `worksmartos-email-studio-draft-${studioVariant}-${autosaveVersions[studioVariant] || "v1"}`;
const studioThemeKey = "worksmartos-email-studio-theme";
const studioThemes = new Set(["light", "white", "dark"]);

function applyStudioTheme(theme) {
  const nextTheme = studioThemes.has(theme) ? theme : "white";
  document.body.dataset.studioTheme = nextTheme;
  themeButtons.forEach((button) => {
    const isActive = button.dataset.studioTheme === nextTheme;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function saveStudioTheme(theme) {
  applyStudioTheme(theme);
  try {
    window.localStorage.setItem(studioThemeKey, document.body.dataset.studioTheme);
  } catch {
    // Theme preference is optional; the studio should still work if storage is blocked.
  }
}

function restoreStudioTheme() {
  let theme = "white";
  try {
    theme = window.localStorage.getItem(studioThemeKey) || "white";
  } catch {
    theme = "white";
  }
  applyStudioTheme(theme);
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    saveStudioTheme(button.dataset.studioTheme);
  });
});

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

const defaultFields = defaultFieldSets[studioVariant] || defaultFieldSets["creative-approval"];
const urlFields = new Set(["rsvp_link", "scheduling_link"]);

const fieldLabels = {
  client_name: "Company name",
  contact_firstname: "Recipient first name",
  campaign_name: "Campaign",
  deadline: "Deadline",
  approval_link: "Creative link",
  event_name: "Event name",
  event_date: "Event date",
  event_time: "Event time",
  event_location: "Event location",
  rsvp_link: "Registration link",
  recipient_role: "Role",
  pain_point: "Pain point",
  offer: "Offer",
  scheduling_link: "Scheduling link",
};
const baseFieldLabels = { ...fieldLabels };

const fields = [...defaultFields];

function activeTemplateFields() {
  const activeFields = new Map();

  [subjectTemplateEditor, bodyTemplateEditor].forEach((editor) => {
    editor.querySelectorAll(".merge-token").forEach((token) => {
      const field = fieldFromToken(token.dataset.token);
      if (!field || field === "sender_name" || activeFields.has(field)) {
        return;
      }

      activeFields.set(field, {
        field,
        label: labelFromTokenElement(token),
      });
    });
  });

  return Array.from(activeFields.values());
}

function syncRecipientFieldsFromTemplate() {
  const activeFields = activeTemplateFields();

  fields.length = 0;
  activeFields.forEach((item) => {
    fields.push(item.field);
    fieldLabels[item.field] = sentenceCaseLabel(item.label || fieldLabels[item.field] || item.field);
  });

  syncRecipientDetailFieldOrder();
}

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
  const naturalOrder = [
    "client_name",
    "contact_firstname",
    "recipient_role",
    "pain_point",
    "offer",
    "scheduling_link",
    "event_name",
    "event_date",
    "event_time",
    "event_location",
    "rsvp_link",
    "campaign_name",
    "deadline",
    "approval_link",
  ];
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

function recipientDraftFromCard(card) {
  return {
    ...recipientValuesFromCard(card),
    addresses: Array.from(card.querySelectorAll(".recipient-address-row")).map((addressRow) => ({
      type: addressRow.querySelector('[name="recipient_type"]')?.value || "To",
      email: getEmailChipValues(addressRow.querySelector("[data-email-chip-input]")).join(", "),
    })),
  };
}

function recipientDrafts() {
  return Array.from(recipientBody.querySelectorAll(".recipient-card")).map(recipientDraftFromCard);
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

function recipientSheetMinWidth() {
  const fieldWidths = getRecipientFieldOrder().flatMap((field) => {
    if (field === "approval_link") {
      return [170, 220];
    }

    if (field === "contact_firstname") {
      return [150];
    }

    if (field === "deadline") {
      return [140];
    }

    return [160];
  });

  return 92 + 132 + 260 + fieldWidths.reduce((total, width) => total + width, 0);
}

function syncRecipientSheetHeader() {
  if (!recipientSheet || !recipientSheetHeader) {
    return;
  }

  const headers = ["Email no.", "Actions", "Email address(es)", ...getRecipientFieldOrder().flatMap(fieldHeader)];
  recipientSheet.style.setProperty("--recipient-sheet-columns", recipientSheetColumnWidths());
  recipientSheet.style.setProperty("--recipient-sheet-min-width", `${recipientSheetMinWidth()}px`);
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

function sentenceCaseLabel(value) {
  const label = String(value || "").trim().replace(/\s+/g, " ");
  if (!label) {
    return "";
  }

  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

function labelForField(field) {
  return fieldLabels[field] || baseFieldLabels[field] || field;
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
      <a class="draft-link draft-link-primary" href="https://mail.google.com/mail/?view=cm&fs=1&${gmailQuery}" target="_blank" rel="noopener noreferrer">Send in Gmail</a>
      <a class="draft-link" href="https://outlook.office.com/mail/deeplink/compose?${outlookQuery}" target="_blank" rel="noopener noreferrer">Send in Outlook</a>
      <a class="draft-link" href="${escapeAttribute(mailtoHref)}">Default email app</a>
    </div>
  `;
}

function emailIdentity(email, index) {
  const groups = getAddressGroups(email.addresses);
  return `${index}-${groups.To.join("|")}-${email.subject || ""}`;
}

function emailRecipients(email) {
  const groups = getAddressGroups(email.addresses);
  return [...groups.To, ...groups.Cc, ...groups.Bcc].map((address) => address.trim()).filter(Boolean);
}

function qualityIssuesForEmail(email, index, emails) {
  const issues = [];
  const recipients = emailRecipients(email);
  const toRecipients = getAddressGroups(email.addresses).To;
  const subject = String(email.subject || "").trim();
  const bodyText = htmlToText(email.body || "");
  const duplicateRecipients = new Set();

  emails.forEach((otherEmail, otherIndex) => {
    if (otherIndex === index) {
      return;
    }

    emailRecipients(otherEmail).forEach((address) => {
      if (recipients.map((recipient) => recipient.toLowerCase()).includes(address.toLowerCase())) {
        duplicateRecipients.add(address.toLowerCase());
      }
    });
  });

  if (!toRecipients.length) {
    issues.push("Missing To recipient.");
  }

  if (!subject) {
    issues.push("Missing subject.");
  } else if (subject.length > 90) {
    issues.push("Subject may be too long.");
  }

  if (!bodyText || bodyText.length < 40) {
    issues.push("Body may need more detail.");
  }

  if (bodyText.includes("{{") || bodyText.includes("}}")) {
    issues.push("Unmerged placeholder appears in body.");
  }

  if (subject.includes("{{") || subject.includes("}}")) {
    issues.push("Unmerged placeholder appears in subject.");
  }

  if (duplicateRecipients.size) {
    issues.push("Duplicate recipient appears in another email.");
  }

  return issues;
}

function qualitySummary(emails) {
  return emails.reduce((summary, email, index) => {
    const issueCount = qualityIssuesForEmail(email, index, emails).length;
    if (issueCount) {
      summary.needsReview += 1;
      summary.issues += issueCount;
    } else {
      summary.ready += 1;
    }
    return summary;
  }, { ready: 0, needsReview: 0, issues: 0 });
}

function sendCenterHtml(emails) {
  const summary = qualitySummary(emails);
  const pluralEmails = emails.length === 1 ? "email" : "emails";
  const pluralIssues = summary.issues === 1 ? "issue" : "issues";

  return `
    <section class="send-center" aria-label="Send Center">
      <div class="send-center-heading">
        <span>Send Center</span>
        <h3>${emails.length} ${pluralEmails} prepared</h3>
        <p>${summary.ready} ready, ${summary.needsReview} need review, ${summary.issues} ${pluralIssues} found.</p>
      </div>
      <div class="send-center-grid">
        <article>
          <span>Quality check</span>
          <strong>${summary.issues ? "Review recommended" : "Ready to send"}</strong>
          <p>${summary.issues ? "Fix flagged emails before using a connected send method." : "No obvious issues found in this batch."}</p>
        </article>
        <article>
          <span>Connected sending</span>
          <strong>Gmail and Outlook</strong>
          <p>Direct sending will be available after account connection and backend email permissions are enabled.</p>
          <div class="send-provider-actions">
            <button class="button secondary" type="button" data-connect-email-provider="gmail">Connect Gmail</button>
            <button class="button secondary" type="button" data-connect-email-provider="outlook">Connect Outlook</button>
          </div>
        </article>
        <article>
          <span>Current send method</span>
          <strong>Open drafts manually</strong>
          <p>Use Gmail, Outlook, or your default email app below while direct sending is being connected.</p>
        </article>
      </div>
      <p class="send-center-status" data-send-center-status aria-live="polite"></p>
    </section>
  `;
}

function statusPill(status) {
  return `<span class="email-status-pill" data-status="${escapeAttribute(status)}">${escapeHtml(status)}</span>`;
}

function qualityListHtml(issues) {
  if (!issues.length) {
    return `
      <div class="email-quality-check is-ready" data-quality-check>
        <strong>Ready</strong>
        <p>No obvious issues found.</p>
      </div>
    `;
  }

  return `
    <div class="email-quality-check" data-quality-check>
      <strong>Needs review</strong>
      <ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>
    </div>
  `;
}

function directSendActionsHtml() {
  return `
    <div class="direct-send-actions" aria-label="Connected send actions">
      <button class="button secondary" type="button" data-direct-send="gmail">Send via connected Gmail</button>
      <button class="button secondary" type="button" data-direct-send="outlook">Send via connected Outlook</button>
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

  if (urlFields.has(input.name)) {
    setInputValidity(input, Boolean(input.value.trim()) && !hasLinkDomain(input.value));
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
    return ["Creative link name", "Creative link url"];
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
  link.download = `worksmartos-${studioFileSlugs[studioVariant] || "email-template"}.csv`;
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
  scheduleAutosave();
}

function parsePastedRows(text) {
  const raw = String(text || "").replace(/\r\n?/g, "\n").trimEnd();
  if (!raw.trim()) {
    return [];
  }

  if (raw.includes("\t")) {
    return raw
      .split("\n")
      .map((row) => row.split("\t").map((cell) => cell.trim()))
      .filter((row) => row.some(Boolean));
  }

  return parseCsv(raw);
}

function pasteColumns() {
  return [
    { type: "email" },
    ...getRecipientFieldOrder().flatMap((field) => {
      if (field === "approval_link") {
        return [{ name: "approval_link_name" }, { name: "approval_link_url" }];
      }

      return [{ name: field }];
    }),
  ];
}

function pasteColumnIndexFromTarget(target) {
  if (target.matches(emailInputSelector()) || target.closest("[data-email-chip-input]")) {
    return 0;
  }

  const name = target.name;
  if (!name) {
    return -1;
  }

  return pasteColumns().findIndex((column) => column.name === name);
}

function ensureRecipientRowCount(count) {
  const currentCount = recipientBody.querySelectorAll(".recipient-card").length;
  if (currentCount >= count) {
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let index = currentCount; index < count; index += 1) {
    fragment.appendChild(rowTemplate());
  }
  recipientBody.appendChild(fragment);
}

function setEmailChipValues(container, value) {
  if (!container) {
    return;
  }

  const input = container.querySelector(emailInputSelector());
  container.querySelectorAll(".email-address-chip").forEach((chip) => chip.remove());
  splitEmailList(value).forEach((email) => {
    container.insertBefore(createEmailChip(email), input);
  });

  if (input) {
    input.value = "";
    clearResolvedRecipientError(input);
  }
  updateEmailChipState(container);
}

function setRecipientCellValue(card, column, value) {
  if (!card || !column) {
    return;
  }

  if (column.type === "email") {
    setEmailChipValues(card.querySelector(".recipient-address-row.type-to [data-email-chip-input]"), value);
    return;
  }

  const input = card.querySelector(`[name="${column.name}"]`);
  if (input) {
    input.value = value;
    clearResolvedRecipientError(input);
  }
}

function pasteSpreadsheetRows(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches("input")) {
    return false;
  }

  const text = event.clipboardData?.getData("text/plain") || "";
  if (!text.includes("\t") && !text.includes("\n")) {
    return false;
  }

  const rows = parsePastedRows(text);
  const startColumnIndex = pasteColumnIndexFromTarget(target);
  const startCard = target.closest(".recipient-card");
  const cards = Array.from(recipientBody.querySelectorAll(".recipient-card"));
  const startRowIndex = cards.indexOf(startCard);
  const columns = pasteColumns();

  if (!rows.length || startColumnIndex < 0 || startRowIndex < 0) {
    return false;
  }

  event.preventDefault();
  ensureRecipientRowCount(startRowIndex + rows.length);

  const updatedCards = Array.from(recipientBody.querySelectorAll(".recipient-card"));
  rows.forEach((row, rowOffset) => {
    const card = updatedCards[startRowIndex + rowOffset];
    row.forEach((value, columnOffset) => {
      const column = columns[startColumnIndex + columnOffset];
      if (column) {
        setRecipientCellValue(card, column, value);
      }
    });
  });

  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
  updateAllEmailChipStates();
  setImportStatus(`${rows.length} ${rows.length === 1 ? "row" : "rows"} pasted into Step 2.`, "success");
  scheduleAutosave();
  return true;
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
    .filter((row) => fields.some((field) => {
      if (field === "approval_link") {
        return row.approval_link_name || row.approval_link_url;
      }
      return row[field];
    }));
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
  const normalized = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (activeTemplatePreset === "event-invite") {
    return normalized;
  }

  return normalized
    .replace(/\b(Thanks,|Thank you,)\n{2,}/gi, "$1\n");
}

function trimTrailingEmptyBlocks(container) {
  if (activeTemplatePreset === "event-invite") {
    return;
  }

  while (container.lastElementChild && !container.lastElementChild.textContent.trim()) {
    container.lastElementChild.remove();
  }
}

function htmlToText(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  temp.querySelectorAll("a[href]").forEach((link) => {
    link.replaceWith(document.createTextNode(link.href));
  });

  temp.querySelectorAll("br").forEach((breakNode) => {
    breakNode.replaceWith(document.createTextNode("\n"));
  });

  temp.querySelectorAll("p, div, li").forEach((block) => {
    block.appendChild(document.createTextNode("\n"));
  });

  return normalizeDraftText(temp.textContent || "");
}

function createTokenElement(token, label, removeAttribute = "data-remove-token") {
  const cleanLabel = sentenceCaseLabel(label);
  const chip = document.createElement("span");
  chip.className = "merge-token";
  chip.contentEditable = "false";
  chip.dataset.token = token;
  chip.dataset.label = cleanLabel;
  chip.textContent = cleanLabel;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.setAttribute(removeAttribute, "");
  removeButton.setAttribute("aria-label", `Remove ${cleanLabel}`);
  removeButton.textContent = "×";
  chip.appendChild(removeButton);

  return chip;
}

function createPaletteToken(token, label) {
  return createTokenElement(token, sentenceCaseLabel(label), "data-remove-placeholder");
}

function tokenHtml(field) {
  const label = labelForField(field);
  return `<span class="merge-token" contenteditable="false" data-token="{{${escapeAttribute(field)}}}" data-label="${escapeAttribute(label)}">${escapeHtml(label)}<button type="button" data-remove-token aria-label="Remove ${escapeAttribute(label)}">×</button></span>`;
}

function fieldsForPreset(preset) {
  return (defaultFieldSets[preset] || defaultFieldSets.blank).map((field) => ({
    field,
    token: `{{${field}}}`,
    label: labelForField(field),
  }));
}

function templateStateFromPreset(preset) {
  const normalizedPreset = preset === "batch" ? "blank" : preset;
  const paletteFields = fieldsForPreset(normalizedPreset);
  const base = {
    preset: normalizedPreset,
    senderName: "",
    paletteFields,
    recipientFields: paletteFields,
  };

  if (normalizedPreset === "sales-outreach") {
    return {
      ...base,
      subjectHtml: `Quick idea for ${tokenHtml("client_name")}`,
      bodyHtml: `<p>Hi ${tokenHtml("contact_firstname")},</p><p><br></p><p>I noticed ${tokenHtml("client_name")} may be working through ${tokenHtml("pain_point")}.</p><p><br></p><p>We help ${tokenHtml("recipient_role")} teams move faster with ${tokenHtml("offer")}.</p><p><br></p><p>Would you be open to finding a time here?</p><p>${tokenHtml("scheduling_link")}</p><p><br></p><p>Thanks,</p>`,
    };
  }

  if (normalizedPreset === "creative-approval") {
    return {
      ...base,
      subjectHtml: `Response needed by ${tokenHtml("deadline")}: ${tokenHtml("client_name")} Creative Assets`,
      bodyHtml: `<p>Hi ${tokenHtml("contact_firstname")},</p><p><br></p><p>I hope you're doing well!</p><p><br></p><p>Attached are the latest creative assets for your review. Please take a look and send feedback by ${tokenHtml("deadline")}.</p><p><br></p><p>${tokenHtml("approval_link")}</p><p><br></p><p>Thank you,</p>`,
    };
  }

  if (normalizedPreset === "event-invite") {
    return {
      ...base,
      subjectHtml: `You're invited: ${tokenHtml("event_name")}`,
      bodyHtml: `<p>Hi ${tokenHtml("contact_firstname")},</p><p><br></p><p>We'd love to invite you to ${tokenHtml("event_name")}.</p><p><br></p><p>Date: ${tokenHtml("event_date")}<br>Time: ${tokenHtml("event_time")}<br>Location: ${tokenHtml("event_location")}</p><p><br></p><p>Please register here:<br>${tokenHtml("rsvp_link")}</p><p><br></p><p><br></p><p>Thanks,</p>`,
    };
  }

  return {
    ...base,
    subjectHtml: "",
    bodyHtml: `<p>Hi ${tokenHtml("contact_firstname")},</p><p><br></p><p><br></p>`,
  };
}

function inferTemplatePreset(prompt) {
  const text = String(prompt || "").toLowerCase();

  if (/\b(event|invite|invitation|webinar|registration|register|attend|rsvp|launch)\b/.test(text)) {
    return "event-invite";
  }

  if (/\b(creative|approval|approve|asset|assets|campaign|feedback|deadline)\b/.test(text)) {
    return "creative-approval";
  }

  if (/\b(sales|outreach|prospect|lead|demo|pitch|customer|book|meeting|intro)\b/.test(text)) {
    return "sales-outreach";
  }

  return "blank";
}

function presetStatusLabel(preset) {
  const labels = {
    blank: "",
    "sales-outreach": "Sales outreach template created.",
    "creative-approval": "Creative approval template created.",
    "event-invite": "Event invitation template created.",
  };
  return labels[preset] || "Template created.";
}

function applyTemplatePreset(preset, options = {}) {
  const nextPreset = preset === "batch" ? "blank" : preset;
  activeTemplatePreset = nextPreset;
  loadTemplateState(templateStateFromPreset(nextPreset));
  if (templateStartStatus) {
    const statusLabel = presetStatusLabel(nextPreset);
    templateStartStatus.textContent = statusLabel ? `${statusLabel} Edit anything before adding recipients.` : "";
  }
  if (options.focusBody) {
    window.requestAnimationFrame(() => bodyTemplateEditor.focus());
  }
}

function labelFromTokenElement(element) {
  return sentenceCaseLabel(element.dataset.label || element.textContent.replace("×", "").trim());
}

function addRecipientField(field, label) {
  if (fields.includes(field)) {
    return;
  }

  fieldLabels[field] = sentenceCaseLabel(label);
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
    preset: activeTemplatePreset,
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

function getAutosaveState() {
  return {
    savedAt: Date.now(),
    currentStep,
    template: getTemplateState(),
    recipients: recipientDrafts(),
  };
}

function saveAutosaveDraft() {
  if (isRestoringAutosave) {
    return;
  }

  try {
    window.localStorage.setItem(autosaveKey, JSON.stringify(getAutosaveState()));
  } catch {
    // Autosave is best-effort; the form should keep working even if storage is blocked.
  }
}

function scheduleAutosave() {
  if (isRestoringAutosave) {
    return;
  }

  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(saveAutosaveDraft, 250);
}

function restoreAutosaveDraft() {
  let draft = null;

  try {
    draft = JSON.parse(window.localStorage.getItem(autosaveKey) || "null");
  } catch {
    return null;
  }

  if (!draft || typeof draft !== "object") {
    return null;
  }

  isRestoringAutosave = true;

  if (draft.template) {
    loadTemplateState(draft.template);
  }

  if (Array.isArray(draft.recipients) && draft.recipients.length) {
    recipientBody.replaceChildren(...draft.recipients.map((recipient) => rowTemplate(recipient)));
  }

  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
  updateAllEmailChipStates();
  setImportStatus("");
  isRestoringAutosave = false;

  return draft;
}

function resetTemplateFields(template) {
  const paletteFields = Array.isArray(template.paletteFields) && template.paletteFields.length
    ? template.paletteFields.filter((item) => item.field !== "sender_name")
    : defaultFields.map((field) => ({ field, token: `{{${field}}}`, label: labelForField(field) }));
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

  syncRecipientFieldsFromTemplate();
}

function loadTemplateState(template = {}) {
  activeTemplatePreset = template.preset || studioVariant;

  if (typeof template.subjectHtml === "string") {
    subjectTemplateEditor.innerHTML = template.subjectHtml;
  }

  if (typeof template.bodyHtml === "string") {
    bodyTemplateEditor.innerHTML = template.bodyHtml;
  }
  removeSenderNameTokens(bodyTemplateEditor);

  if (typeof template.senderName === "string" && form.elements.sender_name) {
    form.elements.sender_name.value = template.senderName;
  }

  resetTemplateFields(template);
  saveEditorHistory();
  scheduleAutosave();
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
  removeSenderNameTokens(temp);
  replaceTokenChips(temp, true);
  return temp.innerHTML;
}

function templateHtmlToMergeText(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  removeSenderNameTokens(temp);
  replaceTokenChips(temp);
  return temp.innerText.trim();
}

function removeSenderNameTokens(container) {
  container.querySelectorAll('[data-token="{{sender_name}}"]').forEach((token) => {
    const parentParagraph = token.closest("p");
    const tokenLabel = token.dataset.label || token.textContent || "";

    if (parentParagraph && parentParagraph.textContent.trim() === tokenLabel.trim()) {
      const previousParagraph = parentParagraph.previousElementSibling;
      if (previousParagraph?.matches("p") && !previousParagraph.textContent.trim()) {
        previousParagraph.remove();
      }
      parentParagraph.remove();
      return;
    }

    token.remove();
  });
}

function appendSenderNameToBody(bodyHtml, senderName) {
  const name = String(senderName || "").trim();
  if (!name) {
    return bodyHtml;
  }

  const temp = document.createElement("div");
  temp.innerHTML = bodyHtml;
  trimTrailingEmptyBlocks(temp);

  return `${temp.innerHTML}<p>${escapeHtml(name)}</p>`;
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
  syncRecipientFieldsFromTemplate();
  saveEditorHistory();
  scheduleAutosave();
}

function insertToken(target, token, label) {
  insertTokenIntoEditor(target, token, label);
}

function updateHistoryButtons() {
  if (!undoButton || !redoButton) {
    return;
  }

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
  syncRecipientFieldsFromTemplate();
  bodyTemplateEditor.focus();
  isRestoringHistory = false;
  updateHistoryButtons();
}

function renderEmails(emails) {
  output.innerHTML = "";
  generatedEmails = emails.map((email, index) => ({
    ...email,
    workflowId: emailIdentity(email, index),
  }));
  emailWorkflowState = generatedEmails.map((email, index) => ({
    id: email.workflowId,
    status: qualityIssuesForEmail(email, index, generatedEmails).length ? "Needs review" : "Ready",
    issues: qualityIssuesForEmail(email, index, generatedEmails),
  }));
  outputCount.textContent = "Review and send emails";
  exportButton.disabled = emails.length === 0;

  if (!emails.length) {
    output.innerHTML = `
      <article class="empty-state">
        <h3>Add at least one recipient to generate an email.</h3>
      </article>
    `;
    return;
  }

  output.insertAdjacentHTML("beforeend", sendCenterHtml(generatedEmails));

  generatedEmails.forEach((email, index) => {
    const card = document.createElement("article");
    card.className = "email-preview-card";
    card.dataset.workflowId = email.workflowId;
    const recipientTitle = email.client_name || email.event_name || email.contact_firstname || "Untitled recipient";
    const workflow = emailWorkflowState[index];
    card.innerHTML = `
      <div class="email-preview-top">
        <div>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(recipientTitle)}</strong>
        </div>
        ${statusPill(workflow.status)}
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
      ${qualityListHtml(workflow.issues)}
      ${directSendActionsHtml()}
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

function updateEmailStatus(card, status, message = "") {
  const workflowId = card?.dataset.workflowId;
  const workflow = emailWorkflowState.find((item) => item.id === workflowId);
  if (workflow) {
    workflow.status = status;
  }

  const pill = card?.querySelector(".email-status-pill");
  if (pill) {
    pill.dataset.status = status;
    pill.textContent = status;
  }

  const statusNode = output.querySelector("[data-send-center-status]");
  if (statusNode && message) {
    statusNode.textContent = message;
  }
}

function refreshEmailCard(card) {
  const index = Array.from(output.querySelectorAll(".email-preview-card")).indexOf(card);
  if (index < 0 || !generatedEmails[index]) {
    return;
  }

  generatedEmails[index].subject = card.querySelector("[data-subject-input]")?.value || "";
  generatedEmails[index].body = card.querySelector("[data-body-input]")?.innerHTML || "";

  const issues = qualityIssuesForEmail(generatedEmails[index], index, generatedEmails);
  const workflow = emailWorkflowState[index];
  if (workflow) {
    workflow.issues = issues;
    workflow.status = issues.length ? "Needs review" : "Ready";
  }

  const qualityNode = card.querySelector("[data-quality-check]");
  if (qualityNode) {
    qualityNode.outerHTML = qualityListHtml(issues);
  }

  const draftActions = card.querySelector(".draft-actions");
  if (draftActions) {
    draftActions.outerHTML = draftLinksHtml(generatedEmails[index]);
  }

  updateEmailStatus(card, issues.length ? "Needs review" : "Ready");
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
  link.download = `${studioFileSlugs[studioVariant] || "batch-emails"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

recipientBody.addEventListener("click", (event) => {
  if (event.target.matches("[data-remove-row]")) {
    const rows = recipientBody.querySelectorAll(".recipient-card");
    if (rows.length > 1) {
      event.target.closest(".recipient-card").remove();
      renumberRecipients();
      scheduleAutosave();
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
    scheduleAutosave();
  }

  if (event.target.closest("[data-remove-address-row]")) {
    const card = event.target.closest(".recipient-card");
    const rows = card.querySelectorAll(".recipient-address-row");
    if (rows.length > 1) {
      rows[rows.length - 1].remove();
      updateAddressRemoveButtons(card);
      scheduleAutosave();
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
    scheduleAutosave();
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

recipientBody.addEventListener("paste", (event) => {
  pasteSpreadsheetRows(event);
});

recipientBody.addEventListener("keydown", (event) => {
  if (!event.target.matches(emailInputSelector())) {
    return;
  }

  if (event.key === "Enter" || event.key === "," || event.key === " ") {
    event.preventDefault();
    commitEmailChips(event.target);
    scheduleAutosave();
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
  scheduleAutosave();
});

recipientBody.addEventListener("focusout", (event) => {
  if (event.target.matches(emailInputSelector())) {
    commitEmailChips(event.target);
    clearResolvedRecipientError(event.target);
    scheduleAutosave();
    const container = event.target.closest("[data-email-chip-input]");
    window.requestAnimationFrame(() => {
      if (!container?.contains(document.activeElement)) {
        container?.classList.remove("is-expanded");
      }
    });
  }
});

function addRecipientRows(count = 1) {
  const rowCount = Math.min(Math.max(Number.parseInt(count, 10) || 1, 1), 50);
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < rowCount; index += 1) {
    fragment.appendChild(rowTemplate());
  }

  recipientBody.appendChild(fragment);
  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
  updateAllEmailChipStates();
  scheduleAutosave();
}

addRowButton.addEventListener("click", () => {
  addRecipientRows(addRowCountInput?.value);
});

addRowCountInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addRecipientRows(addRowCountInput.value);
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (generateEmails()) {
    goToStep(2);
  }
});

form.addEventListener("input", scheduleAutosave);

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

output.addEventListener("click", (event) => {
  const connectButton = event.target.closest("[data-connect-email-provider]");
  if (connectButton) {
    const statusNode = output.querySelector("[data-send-center-status]");
    const provider = connectButton.dataset.connectEmailProvider === "gmail" ? "Gmail" : "Outlook";
    if (statusNode) {
      statusNode.textContent = `${provider} connection needs OAuth and backend sending to be enabled before direct send can run.`;
    }
    return;
  }

  const directSendButton = event.target.closest("[data-direct-send]");
  if (directSendButton) {
    const card = directSendButton.closest(".email-preview-card");
    const provider = directSendButton.dataset.directSend === "gmail" ? "Gmail" : "Outlook";
    updateEmailStatus(card, "Connection required", `${provider} direct sending is not connected yet. Open a draft manually for now.`);
    return;
  }

  const draftLink = event.target.closest(".draft-link");
  if (draftLink) {
    const card = draftLink.closest(".email-preview-card");
    updateEmailStatus(card, "Draft opened", "Draft opened. Mark it as sent after you send it from your email client.");
  }
});

output.addEventListener("input", (event) => {
  if (!event.target.matches("[data-subject-input], [data-body-input]")) {
    return;
  }

  const card = event.target.closest(".email-preview-card");
  if (card) {
    refreshEmailCard(card);
  }
});


formatButtons.forEach((button) => {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    const command = button.dataset.format;

    if (command === "undo") {
      restoreEditorHistory(editorHistoryIndex - 1);
      scheduleAutosave();
      return;
    }

    if (command === "redo") {
      restoreEditorHistory(editorHistoryIndex + 1);
      scheduleAutosave();
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
    scheduleAutosave();
  });
});

subjectTemplateEditor.addEventListener("input", () => {
  syncRecipientFieldsFromTemplate();
  saveEditorHistory();
  scheduleAutosave();
});
bodyTemplateEditor.addEventListener("input", () => {
  syncRecipientFieldsFromTemplate();
  saveEditorHistory();
  scheduleAutosave();
});

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
    const paletteToken = event.target.closest("[data-token]");
    const tokenValue = paletteToken?.dataset.token;
    paletteToken?.remove();
    [subjectTemplateEditor, bodyTemplateEditor].forEach((editor) => {
      editor.querySelectorAll(".merge-token").forEach((token) => {
        if (token.dataset.token === tokenValue) {
          token.remove();
        }
      });
    });
    syncRecipientFieldsFromTemplate();
    saveEditorHistory();
    scheduleAutosave();
  }
});

[subjectTemplateEditor, bodyTemplateEditor].forEach((editor) => {
  editor.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-token]")) {
      event.target.closest(".merge-token").remove();
      syncRecipientFieldsFromTemplate();
      saveEditorHistory();
      scheduleAutosave();
    }
  });
});

addPlaceholderButton.addEventListener("click", () => {
  const label = window.prompt("Placeholder name", "New placeholder");
  if (!label) {
    return;
  }

  const field = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!field) {
    return;
  }

  const cleanLabel = sentenceCaseLabel(label);
  addRecipientField(field, cleanLabel);

  const token = createPaletteToken(`{{${field}}}`, cleanLabel);
  tokenList.appendChild(token);
  bindTokenControl(token);
  scheduleAutosave();
});

templatePresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTemplatePreset(button.dataset.templatePreset, { focusBody: true });
  });
});

generateTemplateButton?.addEventListener("click", () => {
  const preset = inferTemplatePreset(templatePromptInput?.value || "");
  applyTemplatePreset(preset, { focusBody: true });
});

stepLabels.forEach((button, index) => {
  button.addEventListener("click", () => {
    if (index === 2) {
      if (currentStep !== 1) {
        goToStep(1, { skipAutosave: true, immediate: true });
      }
      if (!generateEmails()) {
        goToStep(1, { skipAutosave: true, immediate: true });
        scheduleAutosave();
        return;
      }
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
      const value = input?.value.trim() || "";
      const isUrlInvalid = Boolean(value) && urlFields.has(field) && !hasLinkDomain(value);
      const isInvalid = !value || isUrlInvalid;
      setInputValidity(input, isInvalid);
      if (isInvalid) {
        if (isUrlInvalid) {
          messages.add(`${fieldLabels[field] || field.replaceAll("_", " ")} must include a domain.`);
        } else {
          messages.add(`${fieldLabels[field] || field.replaceAll("_", " ")} is required.`);
        }
        firstInvalidInput = firstInvalidInput || input;
      }
    });
  });

  if (firstInvalidInput) {
    firstInvalidInput.focus({ preventScroll: true });
    setImportStatus("Please check below and fill in blank fields or incomplete domains before reviewing emails.", "error");
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
    const body = mergeTemplate(bodyTemplate, data, { html: true });
    return {
      ...recipient,
      subject: mergeTemplate(subjectTemplate, data),
      body: appendSenderNameToBody(body, senderName),
    };
  });

  renderEmails(emails);
  return true;
}

function goToStep(step, options = {}) {
  currentStep = Math.max(0, Math.min(step, 2));
  if (currentStep === 1) {
    syncRecipientFieldsFromTemplate();
  }
  if (options.immediate) {
    stepperTrack.style.transition = "none";
  }
  stepperTrack.style.transform = `translateX(-${currentStep * (100 / 3)}%)`;
  if (options.immediate) {
    stepperTrack.getBoundingClientRect();
    stepperTrack.style.transition = "";
  }

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

  if (!options.skipAutosave) {
    scheduleAutosave();
  }
}

function renumberRecipients() {
  recipientBody.querySelectorAll(".recipient-card").forEach((card, index) => {
    const label = card.querySelector(".recipient-card-top strong");
    if (label) {
      label.textContent = `${index + 1}`;
    }
  });
}

restoreStudioTheme();
const restoredDraft = restoreAutosaveDraft();
if (!restoredDraft) {
  renumberRecipients();
  document.querySelectorAll(".recipient-card").forEach(updateAddressRemoveButtons);
  updateAllEmailChipStates();
}
saveEditorHistory();
goToStep(restoredDraft?.currentStep === 1 ? 1 : 0, { initial: true });
window.addEventListener("beforeunload", saveAutosaveDraft);
window.addEventListener("pagehide", saveAutosaveDraft);

window.WorkSmartEmailStudio = {
  getTemplateState,
  loadTemplateState,
  getGeneratedEmails: () => generatedEmails,
  getSendWorkflowState: () => emailWorkflowState,
};
