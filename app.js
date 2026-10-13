// Clarion landing page — scroll reveals + odometer-style numeric transitions.
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Stagger siblings that reveal together.
  document.querySelectorAll(".feature-grid, .how-grid, .problem-grid").forEach((group) => {
    [...group.querySelectorAll(".reveal")].forEach((el, i) => el.style.setProperty("--d", `${i * 0.08}s`));
  });

  // Headings: wrap each word so it can rise out of its own mask.
  document.querySelectorAll(".split").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", words.join(" "));
    el.innerHTML = words
      .map((w, i) => `<span class="w" aria-hidden="true"><span style="--wi:${i}">${w}</span></span>`)
      .join(" ");
  });

  // Buttons: duplicate the label for the hover roll.
  document.querySelectorAll(".btn").forEach((btn) => {
    const text = btn.textContent.trim();
    btn.innerHTML = `<span class="btn-label" data-text="${text}">${text}</span>`;
  });

  /**
   * Turn an element's text into rolling digit reels.
   * Each digit gets a strip of numbers that spins (several full turns for
   * leading digits, fewer for trailing ones) and settles on its target.
   */
  function buildOdometer(el) {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.textContent = "";
    const wrap = document.createElement("span");
    wrap.className = "odo";
    wrap.setAttribute("aria-hidden", "true");

    const digitCount = (text.match(/\d/g) || []).length;
    let digitIndex = 0;

    [...text].forEach((ch, i) => {
      const delay = i * 0.07;
      if (!/\d/.test(ch)) {
        const s = document.createElement("span");
        s.className = "odo-static";
        s.textContent = ch;
        s.style.setProperty("--delay", `${delay + 0.35}s`);
        wrap.appendChild(s);
        return;
      }
      const target = Number(ch);
      // Leftmost digits spin more; this gives the classic "settling" cascade.
      const spins = Math.max(1, digitCount - digitIndex);
      digitIndex++;
      const reel = document.createElement("span");
      reel.className = "odo-reel";
      const strip = document.createElement("span");
      strip.className = "odo-strip";
      const total = spins * 10 + target;
      for (let n = 0; n <= total; n++) {
        const d = document.createElement("span");
        d.textContent = n % 10;
        strip.appendChild(d);
      }
      reel.style.setProperty("--delay", `${delay}s`);
      reel.style.setProperty("--dur", `${1.4 + spins * 0.25}s`);
      reel.dataset.steps = total;
      reel.appendChild(strip);
      wrap.appendChild(reel);
    });
    el.appendChild(wrap);
    return wrap;
  }

  function roll(wrap) {
    wrap.classList.add("go");
    wrap.querySelectorAll(".odo-reel").forEach((reel) => {
      const strip = reel.firstChild;
      reel.classList.add("rolling");
      strip.style.transform = `translateY(-${reel.dataset.steps * 1.2}em)`;
    });
  }

  const odometers = new Map();
  if (!reduceMotion) {
    document.querySelectorAll("[data-count], [data-roll]").forEach((el) => {
      odometers.set(el, buildOdometer(el));
    });
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("in");
        // Start any odometers inside (or on) this element.
        [el, ...el.querySelectorAll("[data-count], [data-roll]")].forEach((n) => {
          const wrap = odometers.get(n);
          if (wrap) requestAnimationFrame(() => requestAnimationFrame(() => roll(wrap)));
        });
        io.unobserve(el);
      });
    },
    { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
  );

  document.querySelectorAll(".reveal, .split").forEach((el) => io.observe(el));
  // Odometers that are not inside a .reveal block still need a trigger.
  odometers.forEach((_, el) => {
    if (!el.closest(".reveal")) io.observe(el);
  });

  // ---------- Analytics cards: loop only while on screen ----------
  const steps = document.querySelectorAll(".step");

  function reroll(wrap) {
    wrap.querySelectorAll(".odo-reel").forEach((reel) => {
      reel.classList.remove("rolling");
      reel.firstChild.style.transform = "translateY(0)";
    });
    void wrap.offsetHeight; // flush so the reels restart from zero
    roll(wrap);
  }

  // Ask card: type the question, tap send, clear, repeat.
  function startTyping(card) {
    const textEl = card.querySelector(".ask-text");
    const sendEl = card.querySelector(".ask-send");
    if (!textEl) return;
    const question = textEl.textContent.trim();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let running = false;

    async function loop() {
      if (running) return;
      running = true;
      while (card.classList.contains("playing")) {
        textEl.classList.remove("sent");
        textEl.textContent = "";
        const caret = document.createElement("span");
        caret.className = "caret";
        const typed = document.createTextNode("");
        textEl.append(typed, caret);
        for (const ch of question) {
          if (!card.classList.contains("playing")) break;
          typed.data += ch;
          await wait(38 + Math.random() * 50);
        }
        await wait(1100);
        sendEl.classList.add("press");
        await wait(260);
        sendEl.classList.remove("press");
        textEl.classList.add("sent");
        await wait(700);
      }
      // Leave the finished question on screen when paused.
      textEl.classList.remove("sent");
      textEl.textContent = question;
      running = false;
    }
    return loop;
  }

  if (!reduceMotion) {
    const typers = new Map();
    steps.forEach((step) => {
      typers.set(step, startTyping(step));
      // Re-roll the chart's axis numbers every time the line redraws.
      const line = step.querySelector(".chart-line");
      if (line) {
        const rerollAxis = () =>
          step.querySelectorAll(".chart [data-count]").forEach((el) => {
            const wrap = odometers.get(el);
            if (wrap) reroll(wrap);
          });
        line.addEventListener("animationstart", rerollAxis);
        line.addEventListener("animationiteration", rerollAxis);
      }
    });

    const playIO = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          target.classList.toggle("playing", isIntersecting);
          if (isIntersecting) typers.get(target)?.();
        });
      },
      { threshold: 0.35 }
    );
    steps.forEach((s) => playIO.observe(s));
  }

  // ---------- Mobile menu modal ----------
  const root = document.documentElement;
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("menu");

  function setMenu(open) {
    root.classList.toggle("menu-open", open);
    root.style.overflow = open ? "hidden" : "";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) setTimeout(() => menu.querySelector(".menu-panel").focus({ preventScroll: true }), 250);
    else toggle.focus({ preventScroll: true });
  }
  const isOpen = () => root.classList.contains("menu-open");

  toggle?.addEventListener("click", () => setMenu(!isOpen()));
  menu?.addEventListener("click", (e) => {
    if (e.target.closest("[data-menu-close], a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") return setMenu(false);
    if (e.key !== "Tab") return;
    // Keep focus inside the toggle + visible menu items.
    const items = [...menu.querySelectorAll("a"), toggle].filter((el) => el.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  });
  // Close if the viewport grows back to desktop width while open.
  window.matchMedia("(min-width: 1101px)").addEventListener("change", (e) => {
    if (e.matches && isOpen()) setMenu(false);
  });

  // Hero chat: little send feedback.
  const form = document.querySelector(".chat-hero");
  form?.addEventListener("submit", () => {
    const btn = form.querySelector(".send");
    btn.animate(
      [{ transform: "scale(1)" }, { transform: "scale(.85) rotate(-20deg)" }, { transform: "scale(1)" }],
      { duration: 450, easing: "cubic-bezier(.34,1.56,.64,1)" }
    );
  });
})();
