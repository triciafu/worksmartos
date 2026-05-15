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

const motionTargets = document.querySelectorAll(
  ".hero .eyebrow, .hero h1, .hero-text, .hero-actions, .section-heading, .feature-card, .security-copy, .security-list article, .split-section > div, .workflow-list article, .pricing-copy, .price-card, .suite-hero-copy, .suite-hero-visual, .suite-intro, .suite-section-heading, .suite-studio-grid article, .suite-flow-grid article, .suite-cta"
);

motionTargets.forEach((target, index) => {
  target.classList.add("reveal");
  target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 90}ms`);
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.16,
    }
  );

  motionTargets.forEach((target) => revealObserver.observe(target));
} else {
  motionTargets.forEach((target) => target.classList.add("is-visible"));
}


const signupForm = document.querySelector("[data-signup-form]");
const formStatus = document.querySelector("[data-form-status]");

if (signupForm && formStatus) {
  signupForm.addEventListener("submit", async (event) => {
    const endpoint = signupForm.getAttribute("action");

    if (!endpoint || endpoint.includes("PASTE_GOOGLE_APPS_SCRIPT")) {
      event.preventDefault();
      formStatus.textContent = "Form storage is not connected yet.";
      formStatus.classList.add("is-error");
      return;
    }

    event.preventDefault();
    formStatus.textContent = "Submitting...";
    formStatus.classList.remove("is-error");

    try {
      await fetch(endpoint, {
        method: "POST",
        body: new FormData(signupForm),
        mode: "no-cors",
      });

      signupForm.reset();
      formStatus.textContent = "Thanks. You're on the enterprise launch list.";
    } catch (error) {
      formStatus.textContent = "Something went wrong. Please try again.";
      formStatus.classList.add("is-error");
    }
  });
}
