const detailsForm = document.querySelector("[data-availability-details]");
const stepButtons = Array.from(document.querySelectorAll("[data-availability-step-button]"));
const stepPanels = Array.from(document.querySelectorAll("[data-availability-step]"));
const statusText = document.querySelector("[data-availability-status]");
const tableHead = document.querySelector("[data-availability-head]");
const tableBody = document.querySelector("[data-availability-body]");
const resultsPanel = document.querySelector("[data-availability-results]");
const messageOutput = document.querySelector("[data-availability-message]");
const addCountInput = document.querySelector("[data-add-availability-count]");
const themeButtons = document.querySelectorAll("[data-studio-theme]");
const methodInputs = document.querySelectorAll("[data-availability-method]");
const calendarPanel = document.querySelector("[data-calendar-panel]");
const calendarStatus = document.querySelector("[data-calendar-status]");
const candidateHelp = document.querySelector("[data-candidate-help]");
const studioThemeKey = "worksmartos-email-studio-theme";
const studioThemes = new Set(["light", "white", "dark"]);

let candidateTimes = [];
let participants = [
  { name: "Alex", email: "alex@example.com", available: [true, true, false, true], notes: "" },
  { name: "Jordan", email: "jordan@example.com", available: [true, false, true, true], notes: "" },
  { name: "Taylor", email: "taylor@example.com", available: [false, true, true, true], notes: "" },
];

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

function detailValue(name) {
  return detailsForm.elements[name]?.value.trim() || "";
}

function selectedMethod() {
  return detailsForm.elements.availability_method?.value || "manual";
}

function updateAvailabilityMethod() {
  const method = selectedMethod();
  const isCalendar = method === "calendar";

  calendarPanel?.classList.toggle("is-hidden", !isCalendar);
  candidateHelp.textContent = isCalendar
    ? "You can still add backup options while calendar connection is being prepared."
    : "Each line becomes a column in the manual availability grid.";

  methodInputs.forEach((input) => {
    input.closest(".availability-method-card")?.classList.toggle("is-active", input.checked);
  });
}

function parseCandidateTimes() {
  return detailValue("candidate_times")
    .split(/\n+/)
    .map((time) => time.trim())
    .filter(Boolean);
}

function setStep(index) {
  stepButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("is-active", buttonIndex === index);
  });

  stepPanels.forEach((panel, panelIndex) => {
    panel.classList.toggle("is-active", panelIndex === index);
  });
}

function syncParticipantsFromTable() {
  const rows = Array.from(tableBody.querySelectorAll("[data-availability-row]"));

  if (!rows.length) {
    return;
  }

  participants = rows.map((row) => ({
    name: row.querySelector("[data-participant-name]")?.value.trim() || "",
    email: row.querySelector("[data-participant-email]")?.value.trim() || "",
    available: Array.from(row.querySelectorAll("[data-time-check]")).map((input) => input.checked),
    notes: row.querySelector("[data-participant-notes]")?.value.trim() || "",
  }));
}

function normalizeParticipantAvailability() {
  participants = participants.map((participant) => ({
    ...participant,
    available: candidateTimes.map((_, index) => Boolean(participant.available[index])),
  }));
}

function renderAvailabilityGrid() {
  normalizeParticipantAvailability();

  tableHead.innerHTML = `
    <tr>
      <th>Team member</th>
      <th>Email</th>
      ${candidateTimes.map((time) => `<th>${time}</th>`).join("")}
      <th>Notes</th>
      <th></th>
    </tr>
  `;

  tableBody.innerHTML = participants
    .map(
      (participant, participantIndex) => `
        <tr data-availability-row>
          <td><input data-participant-name value="${escapeHtml(participant.name)}" aria-label="Team member ${participantIndex + 1} name" /></td>
          <td><input data-participant-email type="email" value="${escapeHtml(participant.email)}" aria-label="Team member ${participantIndex + 1} email" /></td>
          ${candidateTimes
            .map(
              (time, timeIndex) => `
                <td class="availability-check-cell">
                  <label>
                    <input data-time-check type="checkbox" ${participant.available[timeIndex] ? "checked" : ""} />
                    <span>Available</span>
                  </label>
                </td>
              `
            )
            .join("")}
          <td><input data-participant-notes value="${escapeHtml(participant.notes)}" aria-label="Notes for ${escapeHtml(participant.name || `team member ${participantIndex + 1}`)}" /></td>
          <td><button class="table-button" type="button" data-remove-availability-row>Remove</button></td>
        </tr>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildAvailabilityGrid() {
  candidateTimes = parseCandidateTimes();

  if (!candidateTimes.length) {
    statusText.textContent = "Add at least one candidate time before building the grid.";
    return;
  }

  statusText.textContent = "";
  renderAvailabilityGrid();
  setStep(1);
}

function addAvailabilityRows() {
  syncParticipantsFromTable();
  const requestedRows = Number.parseInt(addCountInput.value, 10);
  const rowCount = Number.isFinite(requestedRows) && requestedRows > 0 ? Math.min(requestedRows, 20) : 1;

  for (let index = 0; index < rowCount; index += 1) {
    participants.push({
      name: "",
      email: "",
      available: candidateTimes.map(() => false),
      notes: "",
    });
  }

  addCountInput.value = "";
  renderAvailabilityGrid();
}

function removeAvailabilityRow(button) {
  const row = button.closest("[data-availability-row]");
  const rows = Array.from(tableBody.querySelectorAll("[data-availability-row]"));
  const index = rows.indexOf(row);

  if (index >= 0) {
    syncParticipantsFromTable();
    participants.splice(index, 1);
    renderAvailabilityGrid();
  }
}

function rankedTimes() {
  syncParticipantsFromTable();

  return candidateTimes
    .map((time, index) => {
      const availablePeople = participants.filter((participant) => participant.available[index]);
      const unavailablePeople = participants.filter((participant) => !participant.available[index]);

      return {
        time,
        availablePeople,
        unavailablePeople,
        score: availablePeople.length,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function renderResults() {
  const ranked = rankedTimes();
  const total = participants.length || 0;

  resultsPanel.innerHTML = ranked
    .map((result, index) => {
      const isBest = index === 0;
      const availableNames = result.availablePeople.map((person) => person.name || "Unnamed").join(", ") || "No one yet";
      const unavailableNames = result.unavailablePeople.map((person) => person.name || "Unnamed").join(", ") || "Everyone is available";

      return `
        <article class="availability-result-card ${isBest ? "is-best" : ""}">
          <span>${isBest ? "Best option" : `Option ${index + 1}`}</span>
          <h3>${escapeHtml(result.time)}</h3>
          <strong>${result.score} of ${total} available</strong>
          <p>Available: ${escapeHtml(availableNames)}</p>
          <p>Not available: ${escapeHtml(unavailableNames)}</p>
        </article>
      `;
    })
    .join("");

  messageOutput.value = buildMessage(ranked[0]);
  setStep(2);
}

function buildMessage(bestResult) {
  const meetingName = detailValue("meeting_name") || "our meeting";
  const duration = detailValue("duration") || "the planned duration";
  const timezone = detailValue("timezone") || "your local time";
  const context = detailValue("context");
  const bestTime = bestResult?.time || "the strongest shared time";
  const methodIntro = selectedMethod() === "calendar"
    ? "Calendar checks pointed to"
    : "Based on everyone's availability, the best time for";

  return `Hi team,\n\n${methodIntro} ${meetingName} is ${bestTime} (${timezone}). I’ll keep it to ${duration}.\n\n${context}\n\nThank you,`;
}

async function copyMessage() {
  const message = messageOutput.value;

  if (!message) {
    return;
  }

  try {
    await navigator.clipboard.writeText(message);
  } catch {
    messageOutput.select();
    document.execCommand("copy");
  }
}

document.querySelector("[data-build-availability-grid]")?.addEventListener("click", buildAvailabilityGrid);
document.querySelector("[data-add-availability-row]")?.addEventListener("click", addAvailabilityRows);
document.querySelector("[data-find-team-time]")?.addEventListener("click", renderResults);
document.querySelector("[data-availability-back]")?.addEventListener("click", () => setStep(0));
document.querySelector("[data-availability-edit]")?.addEventListener("click", () => setStep(1));
document.querySelector("[data-copy-availability-message]")?.addEventListener("click", copyMessage);

methodInputs.forEach((input) => {
  input.addEventListener("change", updateAvailabilityMethod);
});

document.querySelectorAll("[data-calendar-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    calendarStatus.textContent = `${button.dataset.calendarProvider} connection is not live yet. Use manual availability first, then this can become the calendar authorization step.`;
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    saveStudioTheme(button.dataset.studioTheme);
  });
});

tableBody?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-availability-row]");

  if (removeButton) {
    removeAvailabilityRow(removeButton);
  }
});

stepButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    if (index === 1 && !candidateTimes.length) {
      buildAvailabilityGrid();
      return;
    }

    if (index === 2) {
      if (!candidateTimes.length) {
        buildAvailabilityGrid();
        return;
      }

      renderResults();
      return;
    }

    setStep(index);
  });
});

restoreStudioTheme();
updateAvailabilityMethod();
