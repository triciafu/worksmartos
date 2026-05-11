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
const loadSampleButton = document.querySelector("[data-load-sample]");

let generatedEmails = [];

const sampleRecipients = [
  {
    client_name: "GLAM INC",
    contact_name: "Tricia",
    campaign_name: "Spring Campaign",
    deadline: "Friday at 3 PM",
    approval_link: "https://approval-link.com/glam",
    custom_note: "Please focus on the hero concept and final CTA.",
  },
  {
    client_name: "Northline Retail",
    contact_name: "Maya",
    campaign_name: "June Storefront Refresh",
    deadline: "Wednesday EOD",
    approval_link: "https://approval-link.com/northline",
    custom_note: "The layout includes the updated offer language from last week.",
  },
  {
    client_name: "BrightPath Health",
    contact_name: "Jordan",
    campaign_name: "Member Welcome Series",
    deadline: "Thursday at noon",
    approval_link: "https://approval-link.com/brightpath",
    custom_note: "Please review the compliance language in panel three.",
  },
];

const fields = [
  "client_name",
  "contact_name",
  "campaign_name",
  "deadline",
  "approval_link",
  "custom_note",
];

function rowTemplate(values = {}) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input name="client_name" value="${escapeAttribute(values.client_name || "")}" /></td>
    <td><input name="contact_name" value="${escapeAttribute(values.contact_name || "")}" /></td>
    <td><input name="campaign_name" value="${escapeAttribute(values.campaign_name || "")}" /></td>
    <td><input name="deadline" value="${escapeAttribute(values.deadline || "")}" /></td>
    <td><input name="approval_link" value="${escapeAttribute(values.approval_link || "")}" /></td>
    <td><input name="custom_note" value="${escapeAttribute(values.custom_note || "")}" /></td>
    <td><button class="table-button" type="button" data-remove-row>Remove</button></td>
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
  return Array.from(recipientBody.querySelectorAll("tr"))
    .map((row) => {
      const data = {};
      fields.forEach((field) => {
        data[field] = row.querySelector(`[name="${field}"]`)?.value.trim() || "";
      });
      return data;
    })
    .filter((row) => row.client_name || row.contact_name || row.campaign_name || row.approval_link);
}

function mergeTemplate(template, data) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => data[key] || "");
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
      <label>
        <span>Body</span>
        <textarea rows="10" data-body-input>${escapeHtml(email.body)}</textarea>
      </label>
      <div class="email-preview-actions">
        <button class="button secondary" type="button" data-copy-subject>Copy subject</button>
        <button class="button primary" type="button" data-copy-body>Copy body</button>
      </div>
    `;

    card.querySelector("[data-copy-subject]").addEventListener("click", () => {
      copyText(card.querySelector("[data-subject-input]").value);
    });

    card.querySelector("[data-copy-body]").addEventListener("click", () => {
      copyText(card.querySelector("[data-body-input]").value);
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

function exportCsv() {
  const rows = [["Client/team", "Contact", "Campaign", "Subject", "Body"]];
  generatedEmails.forEach((email) => {
    rows.push([email.client_name, email.contact_name, email.campaign_name, email.subject, email.body]);
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
    const rows = recipientBody.querySelectorAll("tr");
    if (rows.length > 1) {
      event.target.closest("tr").remove();
    }
  }
});

addRowButton.addEventListener("click", () => {
  recipientBody.appendChild(rowTemplate());
});

loadSampleButton.addEventListener("click", () => {
  recipientBody.innerHTML = "";
  sampleRecipients.forEach((recipient) => recipientBody.appendChild(rowTemplate(recipient)));
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const subjectTemplate = formData.get("subject_template");
  const bodyTemplate = formData.get("body_template");
  const senderName = formData.get("sender_name") || "";

  const emails = getRecipients().map((recipient) => {
    const data = { ...recipient, sender_name: senderName };
    return {
      ...recipient,
      subject: mergeTemplate(subjectTemplate, data),
      body: mergeTemplate(bodyTemplate, data),
    };
  });

  renderEmails(emails);
});

exportButton.addEventListener("click", exportCsv);
