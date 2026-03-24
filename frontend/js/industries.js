(() => {
  "use strict";

  const tt = (key, fallback) => {
    try {
      return window.PPS_I18N?.t?.(key) || fallback;
    } catch {
      return fallback;
    }
  };

  const fmt = (n) => new Intl.NumberFormat(undefined).format(Math.round(Number(n) || 0));

  function setupCalculators() {
    document.querySelectorAll("[data-pps-industry-calc]").forEach((form) => {
      const outMonthly = form.parentElement?.querySelector("[data-pps-calc-monthly]");
      const outOrder = form.parentElement?.querySelector("[data-pps-calc-order]");
      const compute = () => {
        const gpd = Math.max(0, Number(form.gpd?.value || 0) || 0);
        const days = Math.min(31, Math.max(0, Number(form.days?.value || 0) || 0));
        const buffer = Math.min(50, Math.max(0, Number(form.buffer?.value || 0) || 0));
        const monthly = gpd * days;
        const order = monthly * (1 + buffer / 100);
        if (outMonthly) outMonthly.textContent = fmt(monthly);
        if (outOrder) outOrder.textContent = fmt(order);
      };
      ["input", "change"].forEach((evt) => form.addEventListener(evt, compute));
      compute();
    });
  }

  function buildRecoText(industry, flags) {
    const base = [];
    base.push(tt("industry.reco.base", "Starter bundle: Standard garment bags + Polybags (Heavy) + a small set of hanger types."));

    if (flags.deliver || flags.routes) {
      base.push(tt("industry.reco.deliver", "Delivery routes: consider Extra Heavy for stress points and cleaner bundled handling."));
    }
    if (flags.uniforms) {
      base.push(tt("industry.reco.uniforms", "Uniform programs: standardize 2–3 hanger types to reduce wrong-hanger returns."));
    }
    if (flags.formal || flags.garments) {
      base.push(tt("industry.reco.long", "Long garments: add 1–2 longer bag sizes to reduce crushed hems."));
    }
    if (flags.multi || flags.departments) {
      base.push(tt("industry.reco.multi", "Multiple locations/teams: document sizes + reorder SKUs for repeatability."));
    }

    const suffix = industry === "healthcare"
      ? tt("industry.reco.healthcare", "Healthcare: keep labeling/department staging consistent to avoid mix-ups.")
      : tt("industry.reco.laundry", "Laundry facilities: match thickness to handling and route stacking.");
    base.push(suffix);

    return base.join(" ");
  }

  function setupChecklists() {
    document.querySelectorAll("[data-pps-industry-checklist]").forEach((wrap) => {
      const industry = wrap.getAttribute("data-pps-industry") || "laundry";
      const recoBox = wrap.parentElement?.querySelector("[data-pps-industry-reco]");
      const recoText = wrap.parentElement?.querySelector("[data-pps-industry-reco-text]");
      const copyBtn = wrap.parentElement?.querySelector("[data-pps-copy-reco]");

      const state = {};
      const compute = () => {
        wrap.querySelectorAll("input[type=\"checkbox\"]").forEach((cb) => {
          state[String(cb.name || cb.value || "")] = cb.checked;
        });
        const text = buildRecoText(industry, state);
        if (recoText) recoText.textContent = text;
        if (recoBox) recoBox.classList.add("ready");
      };

      wrap.addEventListener("change", compute);
      compute();

      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const text = recoText?.textContent || "";
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
            const prev = copyBtn.textContent;
            copyBtn.textContent = tt("industry.reco.copied", "Copied!");
            copyBtn.disabled = true;
            setTimeout(() => {
              copyBtn.textContent = prev;
              copyBtn.disabled = false;
            }, 1200);
          } catch {
            try {
              window.prompt(tt("industry.reco.copy_prompt", "Copy this summary:"), text);
            } catch {
              // ignore
            }
          }
        });
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    setupCalculators();
    setupChecklists();
  });
})();
