const meetingModes = {
  schedule: {
    kicker: "Schedule a meeting",
    title: "Find the best time and send the invite.",
    description: "Use this for one-on-one or small-group meetings where the goal is to collect availability, select a time, and create the invite.",
    goal: "Intro call",
    guests: "Client contact, internal owner",
    dateRange: "Next week",
    duration: "30 minutes",
    location: "Google Meet",
    timezone: "Recipient local time",
    organizerEmail: "contact@worksmartos.com",
    timeOptions: "Tuesday at 10:00 AM\nWednesday at 1:30 PM\nThursday at 3:00 PM",
    rules: "Avoid Fridays, protect focus blocks, and offer three options.",
    context: "Share the purpose of the meeting and ask guests to send any questions ahead of time.",
  },
  group: {
    kicker: "Coordinate with a group",
    title: "Collect availability across several people.",
    description: "Use this when multiple attendees need to weigh in and the studio should narrow the best shared windows.",
    goal: "Team planning session",
    guests: "Project team, department lead, external partner",
    dateRange: "Next two weeks",
    duration: "45 minutes",
    location: "Zoom",
    timezone: "Show all options in each guest's local time",
    organizerEmail: "contact@worksmartos.com",
    timeOptions: "Monday at 11:00 AM\nTuesday at 2:00 PM\nThursday at 12:30 PM",
    rules: "Collect availability from every guest, rank overlapping windows, and avoid early mornings.",
    context: "Ask guests to choose every time that works so the final meeting can be scheduled quickly.",
  },
  "follow-up": {
    kicker: "Reschedule or follow up",
    title: "Move stale or conflicted meetings forward.",
    description: "Use this when someone has not responded, a conflict appears, or a meeting needs a clean reschedule.",
    goal: "Reschedule project check-in",
    guests: "Original meeting guests",
    dateRange: "This week or early next week",
    duration: "30 minutes",
    location: "Original meeting link",
    timezone: "Keep original time zone",
    organizerEmail: "contact@worksmartos.com",
    timeOptions: "Today at 4:00 PM\nTomorrow at 10:30 AM\nFriday at 1:00 PM",
    rules: "Preserve the original agenda, suggest two replacement times, and follow up after one business day.",
    context: "A conflict came up, but the meeting is still important and should be moved to a new time.",
  },
  protect: {
    kicker: "Protect time",
    title: "Apply scheduling rules before meetings appear.",
    description: "Use this to protect focus blocks, executive availability, no-meeting days, or preferred meeting windows.",
    goal: "Create team scheduling rules",
    guests: "Internal team",
    dateRange: "Ongoing",
    duration: "Default to 25 or 50 minutes",
    location: "Calendar rules",
    timezone: "Team local time",
    organizerEmail: "contact@worksmartos.com",
    timeOptions: "Tuesday through Thursday, 10:00 AM-3:00 PM\nNo Fridays\nNo meetings before 10:00 AM",
    rules: "No meetings before 10 AM, protect Fridays, and require an agenda for meetings over 30 minutes.",
    context: "The team needs fewer fragmented days and clearer rules for when meetings should be booked.",
  },
  prep: {
    kicker: "Meeting prep",
    title: "Collect context before the meeting happens.",
    description: "Use this to gather questions, generate an agenda, and send prep notes before guests join.",
    goal: "Client strategy meeting",
    guests: "Client team, account lead, strategist",
    dateRange: "Before scheduled meeting",
    duration: "60 minutes",
    location: "Existing calendar invite",
    timezone: "Meeting time zone",
    organizerEmail: "contact@worksmartos.com",
    timeOptions: "Already scheduled\nPrep notes due two days before\nReminder sent one day before",
    rules: "Collect agenda items two days before the meeting and send prep notes the day before.",
    context: "Make sure everyone arrives with decisions, questions, and open items already captured.",
  },
};

const modeButtons = document.querySelectorAll("[data-meeting-mode]");
const meetingForm = document.querySelector("[data-meeting-form]");
const modeKicker = document.querySelector("[data-mode-kicker]");
const modeTitle = document.querySelector("[data-mode-title]");
const modeDescription = document.querySelector("[data-mode-description]");
const planList = document.querySelector("[data-meeting-plan]");
const messageOutput = document.querySelector("[data-meeting-message]");
const checklist = document.querySelector("[data-meeting-checklist]");
const copyButton = document.querySelector("[data-copy-meeting-message]");
const bookingLinkOutput = document.querySelector("[data-booking-link]");
const copyBookingLinkButton = document.querySelector("[data-copy-booking-link]");

let activeMode = "schedule";

function setField(name, value) {
  const field = meetingForm.elements[name];
  if (field) {
    field.value = value;
  }
}

function formValue(name) {
  return meetingForm.elements[name]?.value.trim() || "";
}

function checkedOptions() {
  return Array.from(meetingForm.querySelectorAll('input[name="options"]:checked')).map((input) => input.value);
}

function timeOptions() {
  return formValue("time_options")
    .split(/\n+/)
    .map((time) => time.trim())
    .filter(Boolean);
}

function encodeBookingPayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function bookingLink() {
  const url = new URL("meeting-booking.html", window.location.href);
  const payload = {
    goal: formValue("goal"),
    guests: formValue("guests"),
    duration: formValue("duration"),
    location: formValue("location"),
    timezone: formValue("timezone"),
    organizerEmail: formValue("organizer_email"),
    context: formValue("context"),
    times: timeOptions(),
  };

  url.searchParams.set("data", encodeBookingPayload(payload));
  return url.href;
}

async function copyText(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function setMode(mode) {
  const config = meetingModes[mode] || meetingModes.schedule;
  activeMode = mode;

  modeButtons.forEach((button) => {
    const isActive = button.dataset.meetingMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  modeKicker.textContent = config.kicker;
  modeTitle.textContent = config.title;
  modeDescription.textContent = config.description;
  setField("goal", config.goal);
  setField("guests", config.guests);
  setField("date_range", config.dateRange);
  setField("duration", config.duration);
  setField("location", config.location);
  setField("timezone", config.timezone);
  setField("organizer_email", config.organizerEmail);
  setField("time_options", config.timeOptions);
  setField("rules", config.rules);
  setField("context", config.context);
  generateWorkflow();
}

function planItems() {
  const goal = formValue("goal");
  const guests = formValue("guests");
  const dateRange = formValue("date_range");
  const duration = formValue("duration");
  const rules = formValue("rules");
  const options = checkedOptions();

  const base = {
    schedule: [
      `Collect availability from ${guests || "the required guests"} for ${dateRange || "the preferred window"}.`,
      `Send a no-login booking link with ${timeOptions().length || "the"} available ${duration || "meeting"} options.`,
      "Use the guest's selected time to create the final calendar invite.",
    ],
    group: [
      `Request availability from ${guests || "each guest"} and keep responses in one place.`,
      "Let guests choose from shared options without connecting their calendars.",
      `Schedule ${goal || "the meeting"} once a strong overlap is found.`,
    ],
    "follow-up": [
      "Check whether the meeting is missing responses or has a calendar conflict.",
      `Send a new no-login booking link with replacement times within ${dateRange || "the preferred range"}.`,
      "Send a clear follow-up if guests do not respond.",
    ],
    protect: [
      "Apply the scheduling rules before booking links are sent.",
      "Decline or reroute requests that conflict with protected time.",
      "Suggest better windows that respect focus blocks and meeting limits.",
    ],
    prep: [
      "Collect agenda items and open questions before the meeting.",
      "Send prep notes to attendees before the meeting starts.",
      "Create follow-up tasks from decisions and unresolved items.",
    ],
  };

  return [...(base[activeMode] || base.schedule), ...options];
}

function meetingMessage() {
  const goal = formValue("goal") || "our meeting";
  const dateRange = formValue("date_range") || "the next few days";
  const duration = formValue("duration") || "30 minutes";
  const timezone = formValue("timezone") || "your local time";
  const context = formValue("context");
  const link = bookingLink();

  if (activeMode === "follow-up") {
    return `Hi,\n\nI wanted to follow up on ${goal}. Please choose the time that works best here:\n${link}\n\nI’ll use ${timezone} and keep the meeting to ${duration}.\n\n${context}\n\nThank you,`;
  }

  if (activeMode === "protect") {
    return `Hi,\n\nI’m setting up scheduling rules for ${goal}. The goal is to protect focus time while keeping important meetings easy to book.\n\n${formValue("rules")}\n\nThank you,`;
  }

  if (activeMode === "prep") {
    return `Hi,\n\nAhead of ${goal}, please send any questions, decisions, or topics you want included in the agenda.\n\n${context}\n\nThank you,`;
  }

  return `Hi,\n\nI’d like to schedule ${goal}. Please choose the time that works best here:\n${link}\n\nI’m planning for ${duration}, and I’ll show times in ${timezone}.\n\n${context}\n\nThank you,`;
}

function checklistItems() {
  return [
    `Goal: ${formValue("goal") || "Not set"}`,
    `Guests: ${formValue("guests") || "Not set"}`,
    `Timing: ${formValue("date_range") || "Not set"} · ${formValue("duration") || "Not set"}`,
    `Location: ${formValue("location") || "Not set"}`,
    `Time options: ${timeOptions().join("; ") || "Not set"}`,
    `Rules: ${formValue("rules") || "Not set"}`,
  ];
}

function renderList(list, items) {
  list.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function generateWorkflow() {
  renderList(planList, planItems());
  bookingLinkOutput.value = bookingLink();
  messageOutput.value = meetingMessage();
  renderList(checklist, checklistItems());
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.meetingMode));
});

meetingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  generateWorkflow();
});

meetingForm.addEventListener("input", generateWorkflow);

copyButton.addEventListener("click", async () => {
  await copyText(messageOutput.value);
  copyButton.textContent = "Copied";
  window.setTimeout(() => {
    copyButton.textContent = "Copy message";
  }, 1400);
});

copyBookingLinkButton.addEventListener("click", async () => {
  await copyText(bookingLinkOutput.value);
  copyBookingLinkButton.textContent = "Copied";
  window.setTimeout(() => {
    copyBookingLinkButton.textContent = "Copy booking link";
  }, 1400);
});

setMode(activeMode);
