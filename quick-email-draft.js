const form = document.querySelector("[data-quick-draft-form]");
const requestInput = document.querySelector("[data-request-input]");
const statusText = document.querySelector("[data-quick-draft-status]");
const voiceButton = document.querySelector("[data-voice-draft]");
const themeButtons = document.querySelectorAll("[data-studio-theme]");
const draftTo = document.querySelector("[data-draft-to]");
const draftSubject = document.querySelector("[data-draft-subject]");
const draftBody = document.querySelector("[data-draft-body]");
const mailtoDraft = document.querySelector("[data-mailto-draft]");
const sendNowButton = document.querySelector("[data-quick-send-now]");
const qualityPanel = document.querySelector("[data-quick-draft-quality]");

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

function createDraft() {
  const request = requestInput.value.trim();
  const recipient = extractRecipient(request);
  const message = extractMessage(request, recipient);

  draftTo.value = recipient || "";
  draftSubject.value = subjectFromMessage(message);
  draftBody.value = bodyFromRequest(recipient, message);

  updateLinks();
  updateQuality();
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
    subject: draftSubject.value.trim(),
    body: draftBody.value.trim(),
  };
  const mailtoTo = encodeURIComponent(params.to);
  const mailtoQuery = queryString({ subject: params.subject, body: params.body });

  mailtoDraft.href = `mailto:${mailtoTo}${mailtoQuery ? `?${mailtoQuery}` : ""}`;
}

function updateQuality() {
  const issues = [];
  if (!draftTo.value.trim()) {
    issues.push("Recipient is missing.");
  }
  if (!draftSubject.value.trim()) {
    issues.push("Subject is missing.");
  }
  if (!draftBody.value.trim()) {
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

document.querySelectorAll("[data-example-request]").forEach((button) => {
  button.addEventListener("click", () => {
    requestInput.value = button.dataset.exampleRequest;
    createDraft();
  });
});

[draftTo, draftSubject, draftBody].forEach((field) => {
  field.addEventListener("input", () => {
    updateLinks();
    updateQuality();
  });
});

sendNowButton.addEventListener("click", () => {
  statusText.textContent = "Connect Gmail or Outlook to send directly.";
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
updateLinks();
updateQuality();
