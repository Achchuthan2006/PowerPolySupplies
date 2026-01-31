(() => {
  "use strict";

  const tt = (key, fallback) => {
    try {
      return window.PPS_I18N?.t?.(key) || fallback;
    } catch {
      return fallback;
    }
  };

  // ---- Calculator ----
  function setupUsageCalculator() {
    const form = document.getElementById("ppsUsageCalc");
    if (!form) return;

    const outMonthly = document.getElementById("ppsUsageMonthly");
    const outOrder = document.getElementById("ppsUsageOrderQty");
    const outBuffer = document.getElementById("ppsUsageBufferHint");

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const fmt = (n) => new Intl.NumberFormat(undefined).format(Math.round(n));

    const compute = () => {
      const gpd = clamp(toNum(form.garmentsPerDay.value), 0, 100000);
      const days = clamp(toNum(form.daysPerMonth.value), 0, 31);
      const bufferPct = clamp(toNum(form.bufferPct.value), 0, 50);
      const monthly = gpd * days;
      const orderQty = monthly * (1 + bufferPct / 100);
      if (outMonthly) outMonthly.textContent = fmt(monthly);
      if (outOrder) outOrder.textContent = fmt(orderQty);
      if (outBuffer) outBuffer.textContent = `${fmt(bufferPct)}%`;
    };

    ["input", "change"].forEach((evt) => form.addEventListener(evt, compute));
    compute();
  }

  // ---- Simple PDF builder (no external libs) ----
  // Note: ASCII-only content for reliability.
  function makeSimplePdf({ title, lines }) {
    const safe = (s) =>
      String(s || "")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/[()\\]/g, (m) => `\\${m}`);

    const contentLines = [
      "BT",
      "/F1 18 Tf",
      "54 770 Td",
      `(${safe(title)}) Tj`,
      "0 -26 Td",
      "/F1 11 Tf",
      ...lines.map((l) => `(${safe(l)}) Tj\n0 -16 Td`),
      "ET"
    ].join("\n");

    const encoder = new TextEncoder();
    const streamBytes = encoder.encode(contentLines);

    const objects = [];
    const pushObj = (s) => {
      objects.push(encoder.encode(s));
      return objects.length;
    };

    // 1) Catalog
    pushObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    // 2) Pages
    pushObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    // 3) Page
    pushObj(
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
    );
    // 4) Font
    pushObj("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
    // 5) Contents stream
    const streamHeader = encoder.encode(`5 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    const streamFooter = encoder.encode("\nendstream\nendobj\n");
    objects.push(streamHeader, streamBytes, streamFooter);

    const header = encoder.encode("%PDF-1.4\n");
    const xrefHeader = encoder.encode("xref\n0 6\n0000000000 65535 f \n");
    const trailerTemplate = (startXref) =>
      encoder.encode(
        `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`
      );

    const parts = [header, ...objects];
    let offset = header.length;
    const offsets = [0];

    objects.forEach((b) => {
      offsets.push(offset);
      offset += b.length;
    });

    const xrefEntries = offsets
      .slice(1, 6)
      .map((off) => `${String(off).padStart(10, "0")} 00000 n \n`)
      .join("");

    const xrefBody = encoder.encode(xrefEntries);
    const startXref = offset;
    const trailer = trailerTemplate(startXref);

    return new Uint8Array(
      [...parts, xrefHeader, xrefBody, trailer].reduce((acc, b) => acc + b.length, 0)
    );
  }

  function downloadBytes(filename, bytes) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function setupPdfDownloads() {
    const guides = {
      garment_sizes: {
        filename: "PowerPolySupplies-Garment-Bag-Sizing-Guide.pdf",
        title: "Garment Bag Sizing (Quick Guide)",
        lines: [
          "1) Measure garment width + 4-6 inches",
          "2) Measure garment length + 4-8 inches",
          "3) Use gusseted bags for bulky coats/layers",
          "Tip: If between two lengths, choose longer first"
        ]
      },
      thickness: {
        filename: "PowerPolySupplies-Heavy-vs-Extra-Heavy.pdf",
        title: "Heavy vs Extra Heavy (Quick Guide)",
        lines: [
          "Heavy: everyday store use, light loads, local handling",
          "Extra Heavy: sharp edges, heavy loads, delivery routes",
          "If you double-bag often, thicker once is usually cheaper"
        ]
      },
      monthly_usage: {
        filename: "PowerPolySupplies-Monthly-Packaging-Usage.pdf",
        title: "Monthly Packaging Usage (Planner)",
        lines: [
          "Monthly garments = garments/day x operating days/month",
          "Add buffer 5-12% for rewraps/tears/rush orders",
          "Order qty = estimated usage x (1 + buffer)"
        ]
      },
      polybags: {
        filename: "PowerPolySupplies-Polybags-Quality-Checklist.pdf",
        title: "Polybags (Buying Checklist)",
        lines: [
          "Use-case: store use vs delivery routes vs bulk packing",
          "Thickness: Heavy vs Extra Heavy based on handling",
          "Clarity: improves presentation and reduces mix-ups",
          "Finish: clean seals, low odor, consistent tear lines"
        ]
      },
      hangers: {
        filename: "PowerPolySupplies-Hangers-Quick-Guide.pdf",
        title: "Hangers (Quick Guide)",
        lines: [
          "Match hanger strength to garment weight",
          "Wider shoulders reduce dents for suits and jackets",
          "Standardize hanger types to cut rehang time"
        ]
      }
    };

    document.querySelectorAll("[data-pps-pdf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = String(btn.getAttribute("data-pps-pdf") || "").trim();
        const g = guides[key];
        if (!g) return;
        const pdf = makeSimplePdf({ title: g.title, lines: g.lines });
        downloadBytes(g.filename, pdf);
      });
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    setupUsageCalculator();
    setupPdfDownloads();
  });
})();
