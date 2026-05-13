import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  isSignInWithEmailLink,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const authOpenButton = document.querySelector("[data-auth-open]");
const authSignOutButton = document.querySelector("[data-auth-signout]");
const authModal = document.querySelector("[data-auth-modal]");
const authCloseButton = document.querySelector("[data-auth-close]");
const authMessage = document.querySelector("[data-auth-message]");
const authEmailForm = document.querySelector("[data-auth-email-form]");
const authEmailInput = document.querySelector("[data-auth-email]");
const saveTemplateButton = document.querySelector("[data-save-template]");
const templateSelect = document.querySelector("[data-template-select]");
const templateNameInput = document.querySelector("[data-template-name]");
const templateStatus = document.querySelector("[data-template-status]");

let app;
let auth;
let db;
let currentUser = null;
let savedTemplates = [];

function setStatus(message, tone = "muted") {
  if (!templateStatus) {
    return;
  }

  templateStatus.textContent = message;
  templateStatus.dataset.tone = tone;
}

function setAuthMessage(message, tone = "muted") {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.dataset.tone = tone;
}

function openAuthModal(message = "") {
  if (!authModal) {
    return;
  }

  authModal.classList.remove("is-hidden");
  authModal.setAttribute("aria-hidden", "false");
  setAuthMessage(message);
}

function closeAuthModal() {
  if (!authModal) {
    return;
  }

  authModal.classList.add("is-hidden");
  authModal.setAttribute("aria-hidden", "true");
}

function templateCollection(user = currentUser) {
  return collection(db, "users", user.uid, "emailTemplates");
}

function updateAuthUi(user) {
  currentUser = user;

  authOpenButton?.classList.toggle("is-hidden", Boolean(user));
  authSignOutButton?.classList.toggle("is-hidden", !user);

  if (user) {
    closeAuthModal();
    setStatus(`Signed in as ${user.email || "your account"}.`);
    loadSavedTemplates();
    return;
  }

  savedTemplates = [];
  renderTemplateOptions();
  setStatus("Sign in to save and reopen templates.");
}

function renderTemplateOptions() {
  if (!templateSelect) {
    return;
  }

  templateSelect.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = savedTemplates.length ? "Select template" : "No saved templates";
  templateSelect.appendChild(empty);

  savedTemplates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name || "Untitled template";
    templateSelect.appendChild(option);
  });
}

async function loadSavedTemplates() {
  if (!currentUser || !db) {
    return;
  }

  try {
    const snapshot = await getDocs(templateCollection());
    savedTemplates = snapshot.docs
      .map((templateDoc) => ({ id: templateDoc.id, ...templateDoc.data() }))
      .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    renderTemplateOptions();
  } catch (error) {
    console.error(error);
    setStatus("Templates could not load. Check Firestore rules.", "error");
  }
}

async function saveTemplate() {
  if (!isFirebaseConfigured()) {
    setStatus("Add your Firebase config to enable saved templates.", "error");
    openAuthModal("Firebase is not configured yet. Paste your web app config into firebase-config.js first.");
    return;
  }

  if (!currentUser) {
    setStatus("Sign in before saving a template.");
    openAuthModal("Sign in to save this template.");
    return;
  }

  const studio = window.WorkSmartEmailStudio;
  if (!studio?.getTemplateState) {
    setStatus("Template tools are still loading. Try again in a moment.", "error");
    return;
  }

  const state = studio.getTemplateState();
  const selectedId = templateSelect?.value;
  const payload = {
    ...state,
    name: templateNameInput?.value?.trim() || "Creative approval request",
    updatedAt: serverTimestamp(),
  };

  try {
    if (selectedId) {
      await setDoc(doc(db, "users", currentUser.uid, "emailTemplates", selectedId), payload, { merge: true });
    } else {
      await addDoc(templateCollection(), { ...payload, createdAt: serverTimestamp() });
    }

    setStatus("Template saved.", "success");
    await loadSavedTemplates();
  } catch (error) {
    console.error(error);
    setStatus("Template could not save. Check Firestore rules.", "error");
  }
}

function loadSelectedTemplate() {
  const selectedId = templateSelect?.value;
  if (!selectedId) {
    return;
  }

  const template = savedTemplates.find((item) => item.id === selectedId);
  if (!template) {
    return;
  }

  window.WorkSmartEmailStudio?.loadTemplateState?.(template);
  if (templateNameInput) {
    templateNameInput.value = template.name || "";
  }
  setStatus("Template loaded.", "success");
}

async function signInWithProvider(providerName) {
  if (!auth) {
    setAuthMessage("Firebase is not configured yet.", "error");
    return;
  }

  const provider = providerName === "google"
    ? new GoogleAuthProvider()
    : new OAuthProvider(providerName === "apple" ? "apple.com" : "microsoft.com");

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    setAuthMessage("Sign-in did not complete. Try another option or check Firebase providers.", "error");
  }
}

async function sendEmailLink(event) {
  event.preventDefault();

  if (!auth) {
    setAuthMessage("Firebase is not configured yet.", "error");
    return;
  }

  const email = authEmailInput?.value?.trim();
  if (!email) {
    setAuthMessage("Enter your email address first.", "error");
    return;
  }

  try {
    await sendSignInLinkToEmail(auth, email, {
      url: window.location.href,
      handleCodeInApp: true,
    });
    window.localStorage.setItem("worksmartosEmailForSignIn", email);
    setAuthMessage("Check your email for the sign-in link.", "success");
  } catch (error) {
    console.error(error);
    setAuthMessage("Email sign-in is not enabled yet in Firebase.", "error");
  }
}

async function completeEmailLinkSignIn() {
  if (!auth || !isSignInWithEmailLink(auth, window.location.href)) {
    return;
  }

  const storedEmail = window.localStorage.getItem("worksmartosEmailForSignIn");
  const email = storedEmail || window.prompt("Confirm your email address");
  if (!email) {
    return;
  }

  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem("worksmartosEmailForSignIn");
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (error) {
    console.error(error);
    openAuthModal("Email sign-in link could not be completed. Try signing in again.");
  }
}

authOpenButton?.addEventListener("click", () => openAuthModal());
authCloseButton?.addEventListener("click", closeAuthModal);
authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) {
    closeAuthModal();
  }
});
authSignOutButton?.addEventListener("click", () => auth && signOut(auth));
saveTemplateButton?.addEventListener("click", saveTemplate);
templateSelect?.addEventListener("change", loadSelectedTemplate);
authEmailForm?.addEventListener("submit", sendEmailLink);
document.querySelectorAll("[data-auth-provider]").forEach((button) => {
  button.addEventListener("click", () => signInWithProvider(button.dataset.authProvider));
});

if (!isFirebaseConfigured()) {
  setStatus("Add your Firebase config to enable saved templates.");
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  completeEmailLinkSignIn();
  onAuthStateChanged(auth, updateAuthUi);
}
