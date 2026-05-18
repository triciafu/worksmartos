const form = document.querySelector("[data-quick-draft-form]");
const requestInput = document.querySelector("[data-request-input]");
const statusText = document.querySelector("[data-quick-draft-status]");
const objectiveInput = document.querySelector("[data-objective-input]");
const voiceButton = document.querySelector("[data-voice-draft]");
const themeButtons = document.querySelectorAll("[data-studio-theme]");
const draftTo = document.querySelector("[data-draft-to]");
const draftCc = document.querySelector("[data-draft-cc]");
const draftBcc = document.querySelector("[data-draft-bcc]");
const draftSubject = document.querySelector("[data-draft-subject]");
const draftBody = document.querySelector("[data-draft-body]");
const mailtoDraft = document.querySelector("[data-mailto-draft]");
const sendNowButton = document.querySelector("[data-quick-send-now]");
const qualityPanel = document.querySelector("[data-quick-draft-quality]");
const chatPreview = document.querySelector("[data-chat-preview] p");
const composeHome = document.querySelector(".quick-compose-view");
const composeOutput = document.querySelector("[data-compose-output]");
const addRecipientFieldButtons = document.querySelectorAll("[data-add-recipient-field]");
const removeRecipientFieldButtons = document.querySelectorAll("[data-remove-recipient-field]");
const formatButtons = document.querySelectorAll("[data-format-command]");
const formatLinkButton = document.querySelector("[data-format-link]");
const attachFileButton = document.querySelector("[data-attach-file]");
const attachDriveButton = document.querySelector("[data-attach-drive]");
const attachmentInput = document.querySelector("[data-attachment-input]");
const attachmentList = document.querySelector("[data-attachment-list]");
const drivePicker = document.querySelector("[data-drive-picker]");
const driveFileButtons = document.querySelectorAll("[data-drive-file]");
const folderSelect = document.querySelector("[data-folder-select]");
const newFolderButton = document.querySelector("[data-new-folder]");
const mailActionButtons = document.querySelectorAll("[data-mail-action]");
const aiActionButtons = document.querySelectorAll("[data-ai-action]");
const scheduleSendToggles = document.querySelectorAll("[data-schedule-send-toggle]");
const scheduleSendOptions = document.querySelectorAll("[data-schedule-send-option]");
const studioPrompt = document.querySelector("[data-studio-prompt]");
const studioPromptTitle = document.querySelector("[data-studio-prompt-title]");
const studioPromptLabel = document.querySelector("[data-studio-prompt-label]");
const studioPromptInput = document.querySelector("[data-studio-prompt-input]");
const studioPromptConfirm = document.querySelector("[data-studio-prompt-confirm]");
const studioPromptCancelButtons = document.querySelectorAll("[data-studio-prompt-cancel]");
const unreadCount = document.querySelector("[data-unread-count]");

const studioThemeKey = "worksmartos-email-studio-theme";
const studioThemes = new Set(["light", "white", "dark"]);
let currentIntent = "send";
let studioPromptResolve = null;

const aiActionRequests = {
  "review-plan": "Review my inbox and tell me the fastest plan to get caught up.",
  "morning-brief": "Give me an executive briefing on hidden blockers, stakeholder risks, and what could slip today.",
  stakeholders: "Show stakeholder context, response patterns, blockers, and escalation recommendations.",
  compress: "Compress the email trail into decisions, risks, and one recommended next action.",
  "recovery-mode": "Open recovery mode for the launch risk and prepare escalation, timeline, stakeholder summary, and alternate sequence.",
  summarize: "Summarize what needs my attention today.",
  "follow-ups": "Find emails I need to follow up on.",
  "draft-replies": "Draft safe replies and leave anything risky for my review.",
  decisions: "Show emails that need my decision before anything can move forward.",
  prioritize: "Prioritize urgent emails and explain why.",
  "clean-up": "Find low-priority emails I can archive or move out of my inbox.",
};

const aiActionStatuses = {
  "review-plan": "Plan ready: approve Lauren, send Bob's reply, then follow up with Jordan.",
  "morning-brief": "Briefing ready: launch timing is exposed tomorrow at 2PM unless Bob and Lauren are resolved.",
  stakeholders: "Stakeholder map ready: Lauren is the approval blocker, Bob is waiting on timing, Jordan needs a nudge.",
  compress: "Compressed: 37 messages became 3 decisions, 2 risks, and 1 recommended next action.",
  "recovery-mode": "Recovery mode ready: escalation draft, revised timeline, stakeholder summary, and alternate launch sequence are queued.",
  summarize: "Summary ready. WorkSmartOS grouped your inbox by decisions, safe replies, follow-ups, and cleanup.",
  "follow-ups": "Follow-ups found. WorkSmartOS can prepare reminders for threads waiting on a response.",
  "draft-replies": "Safe replies queued. Anything uncertain stays in review before it can send.",
  decisions: "One decision found: Lauren is waiting for approval on the pricing sheet.",
  prioritize: "Urgent work prioritized. Replies with customer timing and approval blockers are first.",
  "clean-up": "Cleanup suggestions ready. Two low-priority emails can move out of the inbox once connected.",
};

function plainTextToHtml(value) {
  return String(value || "")
    .split(/\n/)
    .map((line) => line || "<br>")
    .join("<br>");
}

function getDraftBody() {
  return draftBody.innerText.trim();
}

function setDraftBody(value) {
  draftBody.innerHTML = plainTextToHtml(value);
}

function addAttachmentChip(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    return;
  }

  const existingNames = Array.from(attachmentList.querySelectorAll("span")).map((item) => item.textContent);
  if (!existingNames.includes(cleanName)) {
    attachmentList.insertAdjacentHTML("beforeend", `<span>${cleanName}</span>`);
  }
}

function activeInboxItem() {
  return document.querySelector("[data-inbox-item].is-active");
}

function selectedInboxItems() {
  const selected = Array.from(document.querySelectorAll("[data-inbox-item].is-selected"));
  return selected.length ? selected : [activeInboxItem()].filter(Boolean);
}

function inboxItemLabel(items) {
  return items.length === 1 ? items[0].dataset.inboxSubject : `${items.length} emails`;
}

function updateUnreadCount() {
  const unread = document.querySelectorAll("[data-inbox-item]:not(.is-read)").length;
  unreadCount.textContent = `${unread} item${unread === 1 ? "" : "s"}`;
}

function setActiveInboxItem(item) {
  if (item.classList.contains("is-open")) {
    item.classList.remove("is-open");
    const openDetail = item.querySelector("[data-inbox-detail]");
    if (openDetail) {
      openDetail.hidden = true;
    }
    composeHome.append(composeOutput);
    composeOutput.hidden = true;
    return;
  }

  document.querySelectorAll("[data-inbox-item]").forEach((inboxItem) => {
    inboxItem.classList.toggle("is-active", inboxItem === item);
    inboxItem.classList.toggle("is-open", inboxItem === item);
    const detail = inboxItem.querySelector("[data-inbox-detail]");
    if (detail) {
      detail.hidden = inboxItem !== item;
    }
  });

  let detail = item.querySelector("[data-inbox-detail]");
  if (!detail) {
    detail = document.createElement("div");
    detail.className = "quick-inbox-detail";
    detail.dataset.inboxDetail = "";
    detail.innerHTML = `<span>Message</span><p>${item.dataset.inboxBody || ""}</p>`;
    item.append(detail);
  }
  detail.hidden = false;
  detail.append(composeOutput);
  composeOutput.hidden = false;
  requestInput.value = item.dataset.inboxRequest || "";
  createDraft();
}

function scheduleLabel(value) {
  if (value === "tomorrow") {
    return "tomorrow morning";
  }
  if (value === "afternoon") {
    return "this afternoon";
  }
  return "a custom date and time";
}

function closeStudioPrompt(value = "") {
  studioPrompt.hidden = true;
  if (studioPromptResolve) {
    studioPromptResolve(value);
    studioPromptResolve = null;
  }
}

function openStudioPrompt({ title, label, value = "", placeholder = "", confirmText = "Save" }) {
  studioPromptTitle.textContent = title;
  studioPromptLabel.textContent = label;
  studioPromptInput.value = value;
  studioPromptInput.placeholder = placeholder;
  studioPromptConfirm.textContent = confirmText;
  studioPrompt.hidden = false;
  window.requestAnimationFrame(() => {
    studioPromptInput.focus();
    studioPromptInput.select();
  });

  return new Promise((resolve) => {
    studioPromptResolve = resolve;
  });
}

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
    // Theme preference is optional.
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

function sentenceCase(value) {
  const clean = String(value || "").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
}

function extractRecipient(request) {
  const patterns = [
    /\b(?:send|write|draft|email)\s+(?:an\s+email\s+)?to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /\b(?:respond|reply)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /\bfollow\s+up\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /\bemail\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = request.match(pattern);
    if (match?.[1]) {
      return sentenceCase(match[1].replace(/\s+(and|that|about|to|for)\b.*$/i, ""));
    }
  }

  return "";
}

function detectIntent(request) {
  const lower = String(request || "").toLowerCase();
  if (/\b(summarize|summary|digest)\b/.test(lower)) {
    return "summarize";
  }
  if (/\b(follow up|follow-up|has not responded|haven't responded|waiting on)\b/.test(lower)) {
    return "follow-up";
  }
  if (/\b(respond|reply)\b/.test(lower)) {
    return "reply";
  }
  return "send";
}

function extractMessage(request, recipient) {
  const text = String(request || "").trim();
  const letKnow = text.match(/\blet\s+(?:him|her|them|[A-Z][a-z]+)\s+know\s+(?:that\s+)?(.+?)(?:[.!?])?$/i);
  if (letKnow?.[1]) {
    return letKnow[1].trim();
  }

  const saying = text.match(/\b(?:saying|tell(?:ing)?|that)\s+(.+?)(?:[.!?])?$/i);
  if (saying?.[1]) {
    return saying[1].trim();
  }

  const tell = text.match(/\btell\s+(?:him|her|them|[A-Z][a-z]+)\s+(.+?)(?:[.!?])?$/i);
  if (tell?.[1]) {
    return tell[1].trim();
  }

  const ask = text.match(/\bask\s+(?:him|her|them|[A-Z][a-z]+)\s+(?:if|whether)\s+(.+?)(?:[.!?])?$/i);
  if (ask?.[1]) {
    return `if ${ask[1].trim()}`;
  }

  return recipient ? "I wanted to send a quick update." : text;
}

function subjectFromMessage(message) {
  const lower = message.toLowerCase();
  if (lower.includes("thank")) {
    return "Thank you";
  }
  if (lower.includes("follow up") || lower.includes("follow-up")) {
    return "Following up";
  }
  if (lower.includes("works") || lower.includes("available") || lower.includes("check-in")) {
    return "Quick check-in";
  }
  if (lower.includes("working on it") || lower.includes("work on it")) {
    return "Quick update";
  }
  if (lower.includes("proposal")) {
    return "Proposal ready";
  }
  return "Quick note";
}

function bodyFromRequest(recipient, message) {
  const name = recipient || "there";
  const cleanMessage = message.replace(/^we're/i, "we're").replace(/^we are/i, "we are");
  const firstSentence = cleanMessage
    ? `Just wanted to let you know ${cleanMessage.replace(/[.!?]$/, "")}.`
    : "Just wanted to send a quick note.";

  return `Hi ${name},

${firstSentence}

Thank you,`;
}

function inboxActionBody(intent, request) {
  if (intent === "follow-up") {
    return `WorkSmartOS will look for sent emails that have not received a reply, prioritize the most important threads, and prepare follow-up drafts for review.

Connect Gmail or Outlook to scan sent mail and identify open follow-ups.`;
  }

  if (intent === "summarize") {
    return `WorkSmartOS will summarize the messages that need your attention, group them by urgency, and identify the replies or decisions waiting on you.

Connect Gmail or Outlook to read the relevant inbox context.`;
  }

  return "";
}

function createDraft() {
  const request = requestInput.value.trim();
  const intent = detectIntent(request);
  currentIntent = intent;
  const recipient = extractRecipient(request);
  const message = extractMessage(request, recipient);
  chatPreview.textContent = request || "Tell WorkSmartOS what you want done.";

  if ((intent === "follow-up" && !recipient) || intent === "summarize") {
    draftTo.value = "";
    draftCc.value = "";
    draftBcc.value = "";
    draftSubject.value = intent === "follow-up" ? "Follow-up review" : "Inbox summary";
    setDraftBody(inboxActionBody(intent, request));
  } else {
    draftTo.value = recipient || "";
    draftCc.value = "";
    draftBcc.value = "";
    draftSubject.value = subjectFromMessage(message);
    setDraftBody(bodyFromRequest(recipient, message));
  }

  updateLinks();
  updateQuality();
}

function runAiAction(action) {
  const objective = objectiveInput?.value.trim();
  const request = action === "review-plan" && objective ? objective : aiActionRequests[action];
  if (!request) {
    return;
  }

  requestInput.value = request;
  chatPreview.textContent = request;
  statusText.textContent = aiActionStatuses[action] || "WorkSmartOS is ready to help with that.";

  if (composeOutput && !composeOutput.hidden) {
    createDraft();
  }
}

function queryString(params, aliases = {}) {
  return Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${aliases[key] || key}=${encodeURIComponent(value)}`)
    .join("&");
}

function updateLinks() {
  const params = {
    to: draftTo.value.trim(),
    cc: draftCc.value.trim(),
    bcc: draftBcc.value.trim(),
    subject: draftSubject.value.trim(),
    body: getDraftBody(),
  };
  const mailtoTo = encodeURIComponent(params.to);
  const mailtoQuery = queryString({
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    body: params.body,
  });

  mailtoDraft.href = `mailto:${mailtoTo}${mailtoQuery ? `?${mailtoQuery}` : ""}`;
}

function updateQuality() {
  const needsInboxConnection = currentIntent === "summarize" || (currentIntent === "follow-up" && !draftTo.value.trim());
  if (needsInboxConnection) {
    qualityPanel.classList.remove("is-ready");
    qualityPanel.innerHTML =
      "<strong>Connection required</strong><p>Connect Gmail or Outlook to use inbox-aware assistant actions.</p>";
    return;
  }

  const issues = [];
  if (!draftTo.value.trim()) {
    issues.push("Recipient is missing.");
  }
  if (!draftSubject.value.trim()) {
    issues.push("Subject is missing.");
  }
  if (!getDraftBody()) {
    issues.push("Body is missing.");
  }

  qualityPanel.classList.toggle("is-ready", !issues.length);
  qualityPanel.innerHTML = issues.length
    ? `<strong>Needs review</strong><ul>${issues.map((issue) => `<li>${issue}</li>`).join("")}</ul>`
    : "<strong>Ready</strong><p>Draft is ready for review.</p>";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  createDraft();
});

requestInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    createDraft();
  }
});

document.querySelectorAll("[data-example-request]").forEach((button) => {
  button.addEventListener("click", () => {
    requestInput.value = button.dataset.exampleRequest;
    chatPreview.textContent = button.dataset.exampleRequest;
    createDraft();
  });
});

aiActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    runAiAction(button.dataset.aiAction);
  });
});

[draftTo, draftCc, draftBcc, draftSubject, draftBody].forEach((field) => {
  field.addEventListener("input", () => {
    updateLinks();
    updateQuality();
  });
});

formatButtons.forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    draftBody.focus();
    document.execCommand(button.dataset.formatCommand, false, null);
    updateLinks();
  });
});

formatLinkButton.addEventListener("mousedown", (event) => event.preventDefault());
formatLinkButton.addEventListener("click", async () => {
  draftBody.focus();
  const url = await openStudioPrompt({
    title: "Insert link",
    label: "Link URL",
    value: "https://",
    confirmText: "Insert link",
  });
  if (url) {
    document.execCommand("createLink", false, url);
    updateLinks();
  }
});

attachFileButton.addEventListener("click", () => {
  attachmentInput.click();
});

attachmentInput.addEventListener("change", () => {
  const files = Array.from(attachmentInput.files);
  const count = files.length;
  files.forEach((file) => addAttachmentChip(file.name));
  statusText.textContent = count
    ? `${count} attachment${count === 1 ? "" : "s"} selected. Gmail or Outlook connection will attach files when sending.`
    : "";
});

attachDriveButton.addEventListener("click", () => {
  if (!drivePicker) {
    statusText.textContent = "Connect Google Drive to choose and attach Drive files.";
    return;
  }
  drivePicker.hidden = !drivePicker.hidden;
  statusText.textContent = drivePicker.hidden
    ? ""
    : "Choose a Google Drive file to attach. Backend connection will open the real picker.";
});

driveFileButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const fileName = button.dataset.driveFile;
    addAttachmentChip(fileName);
    drivePicker.hidden = true;
    statusText.textContent = `${fileName} attached from Google Drive.`;
  });
});

newFolderButton.addEventListener("click", async () => {
  const folderName = await openStudioPrompt({
    title: "",
    label: "Folder name",
    placeholder: "Example: Client follow-ups",
    confirmText: "Create folder",
  });
  const cleanName = String(folderName || "").trim();
  if (!cleanName) {
    return;
  }

  const existing = Array.from(folderSelect.options).some((option) => option.value === cleanName);
  if (!existing) {
    folderSelect.add(new Option(cleanName, cleanName));
  }
  folderSelect.value = cleanName;
  statusText.textContent = `${cleanName} folder is ready to sync once Gmail or Outlook is connected.`;
});

studioPromptConfirm.addEventListener("click", () => {
  closeStudioPrompt(studioPromptInput.value.trim());
});

studioPromptCancelButtons.forEach((button) => {
  button.addEventListener("click", () => closeStudioPrompt(""));
});

studioPromptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    closeStudioPrompt(studioPromptInput.value.trim());
  }
  if (event.key === "Escape") {
    closeStudioPrompt("");
  }
});

mailActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const items = selectedInboxItems();
    const action = button.dataset.mailAction;

    if (!items.length) {
      statusText.textContent = "Choose one or more emails first.";
      return;
    }

    if (action === "move") {
      statusText.textContent = `${inboxItemLabel(items)} will move to ${folderSelect.value} once connected.`;
      return;
    }

    if (action === "mark-read") {
      items.forEach((item) => item.classList.add("is-read"));
      updateUnreadCount();
      statusText.textContent = `${inboxItemLabel(items)} marked as read.`;
      return;
    }

    if (action === "mark-unread") {
      items.forEach((item) => item.classList.remove("is-read"));
      updateUnreadCount();
      statusText.textContent = `${inboxItemLabel(items)} marked as unread.`;
      return;
    }

    if (action === "print") {
      window.print();
      return;
    }

    if (action === "delete") {
      const activeItem = activeInboxItem();
      const fallbackItem = items[items.length - 1].nextElementSibling || items[0].previousElementSibling;
      const deletedLabel = inboxItemLabel(items);
      composeHome.append(composeOutput);
      composeOutput.hidden = true;
      items.forEach((item) => item.remove());
      if (activeItem && !document.body.contains(activeItem) && fallbackItem?.matches("[data-inbox-item]")) {
        setActiveInboxItem(fallbackItem);
      }
      updateUnreadCount();
      statusText.textContent = `${deletedLabel} removed from this view. Backend delete will sync this action.`;
    }
  });
});

document.querySelectorAll("[data-inbox-item]").forEach((item) => {
  item.addEventListener("click", (event) => {
    if (event.target.closest("[data-select-email]") || event.metaKey || event.ctrlKey || event.shiftKey) {
      item.classList.toggle("is-selected");
      const selectButton = item.querySelector("[data-select-email]");
      selectButton?.setAttribute("aria-pressed", String(item.classList.contains("is-selected")));
      statusText.textContent = `${document.querySelectorAll("[data-inbox-item].is-selected").length} selected.`;
      return;
    }

    setActiveInboxItem(item);
  });

  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      item.click();
    }
  });
});

sendNowButton.addEventListener("click", () => {
  statusText.textContent = "Connect Gmail or Outlook to send directly.";
});

scheduleSendToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const split = button.closest("[data-send-split]");
    const menu = split?.querySelector("[data-schedule-send-menu]");
    document.querySelectorAll("[data-schedule-send-menu]").forEach((otherMenu) => {
      if (otherMenu !== menu) {
        otherMenu.hidden = true;
      }
    });
    if (menu) {
      menu.hidden = !menu.hidden;
    }
  });
});

scheduleSendOptions.forEach((button) => {
  button.addEventListener("click", () => {
    const menu = button.closest("[data-schedule-send-menu]");
    menu.hidden = true;
    statusText.textContent = `Email scheduled for ${scheduleLabel(button.dataset.scheduleSendOption)}. Gmail or Outlook will send it once connected.`;
  });
});

addRecipientFieldButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const fieldName = button.dataset.addRecipientField;
    const field = document.querySelector(`[data-optional-recipient-field="${fieldName}"]`);
    field.hidden = false;
    button.hidden = true;
    const input = field.querySelector("input");
    input.focus();
  });
});

removeRecipientFieldButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const fieldName = button.dataset.removeRecipientField;
    const field = document.querySelector(`[data-optional-recipient-field="${fieldName}"]`);
    const addButton = document.querySelector(`[data-add-recipient-field="${fieldName}"]`);
    const input = field.querySelector("input");
    input.value = "";
    field.hidden = true;
    addButton.hidden = false;
    updateLinks();
    updateQuality();
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => saveStudioTheme(button.dataset.studioTheme));
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  voiceButton.disabled = true;
  voiceButton.title = "Voice input is not supported in this browser.";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;

  voiceButton.addEventListener("click", () => {
    statusText.textContent = "Listening...";
    recognition.start();
  });

  recognition.addEventListener("result", (event) => {
    requestInput.value = event.results[0][0].transcript;
    statusText.textContent = "Request captured.";
    createDraft();
  });

  recognition.addEventListener("end", () => {
    if (statusText.textContent === "Listening...") {
      statusText.textContent = "";
    }
  });

  recognition.addEventListener("error", () => {
    statusText.textContent = "Voice input could not start. Type the request instead.";
  });
}

restoreStudioTheme();
currentIntent = detectIntent(requestInput.value);
updateLinks();
updateQuality();
