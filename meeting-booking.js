const title = document.querySelector("[data-booking-title]");
const summary = document.querySelector("[data-booking-summary]");
const timesContainer = document.querySelector("[data-booking-times]");
const bookingForm = document.querySelector("[data-booking-form]");
const responsePanel = document.querySelector("[data-booking-response]");
const responseMessage = document.querySelector("[data-booking-response-message]");
const mailtoLink = document.querySelector("[data-booking-mailto]");

function decodeBookingPayload(value) {
  if (!value) {
    return null;
  }

  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function payload() {
  return decodeBookingPayload(new URLSearchParams(window.location.search).get("data")) || {
    goal: "Meeting",
    duration: "30 minutes",
    location: "To be confirmed",
    timezone: "your local time",
    organizerEmail: "contact@worksmartos.com",
    context: "Please choose the time that works best.",
    times: ["Tuesday at 10:00 AM", "Wednesday at 1:30 PM", "Thursday at 3:00 PM"],
  };
}

const booking = payload();
const times = Array.isArray(booking.times) && booking.times.length ? booking.times : ["Time to be confirmed"];

title.textContent = booking.goal || "Choose a meeting time";
summary.textContent = `${booking.duration || "30 minutes"} · ${booking.location || "Location to be confirmed"} · ${booking.timezone || "your local time"}`;
timesContainer.innerHTML = times.map((time, index) => `
  <label>
    <input type="radio" name="selected_time" value="${escapeHtml(time)}" ${index === 0 ? "checked" : ""} />
    <span>${escapeHtml(time)}</span>
  </label>
`).join("");

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(bookingForm);
  const selectedTime = formData.get("selected_time") || "";
  const guestName = formData.get("guest_name") || "";
  const guestEmail = formData.get("guest_email") || "";
  const notes = formData.get("guest_notes") || "";
  const message = `Hi,\n\n${guestName} selected this time for ${booking.goal || "the meeting"}:\n${selectedTime}\n\nGuest email: ${guestEmail}\n\nNotes: ${notes || "None"}\n\nThank you,`;
  const subject = `Selected meeting time: ${booking.goal || "Meeting"}`;
  const recipient = booking.organizerEmail || "contact@worksmartos.com";

  responseMessage.value = message;
  mailtoLink.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  responsePanel.classList.remove("is-hidden");
});
