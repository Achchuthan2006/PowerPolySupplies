(() => {
  "use strict";

  const WORDS_PER_MINUTE = 220;
  const MAX_RELATED = 3;

  const tt = (key, fallback) => {
    try {
      return window.PPS_I18N?.t?.(key) || fallback;
    } catch {
      return fallback;
    }
  };

  const countWords = (text) =>
    String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean).length;

  const computeReadMinutes = (words) => Math.max(1, Math.round((Number(words) || 0) / WORDS_PER_MINUTE));

  const getReadTimeLabel = (minutes) => {
    const tpl = tt("blog.read_time", "{{min}} min read");
    return tpl.replace("{{min}}", String(minutes));
  };

  const splitBullet = (text) => String(text || "").split(/•|â€¢/).map((s) => s.trim()).filter(Boolean);

  const getArticlePermalink = (articleId) => {
    const url = new URL(window.location.href);
    url.hash = articleId ? `#${articleId}` : "";
    return url.toString();
  };

  const safeClipboardCopy = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // ignore
    }
    try {
      window.prompt(tt("blog.share.copy_prompt", "Copy this link:"), text);
      return true;
    } catch {
      return false;
    }
  };

  function makeShareBar({ url, title }) {
    const wrap = document.createElement("div");
    wrap.className = "blog-share-bar";

    const shareLabel = tt("blog.share", "Share");
    const copyLabel = tt("blog.share.copy", "Copy link");
    const copiedLabel = tt("blog.share.copied", "Copied!");
    const emailLabel = tt("blog.share.email", "Email");
    const linkedInLabel = tt("blog.share.linkedin", "LinkedIn");
    const xLabel = tt("blog.share.x", "X");

    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title || "");

    const emailHref = `mailto:?subject=${t}&body=${u}`;
    const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    const xHref = `https://twitter.com/intent/tweet?url=${u}&text=${t}`;

    wrap.innerHTML = `
      <div class="blog-share-title">${shareLabel}</div>
      <div class="blog-share-actions">
        <button class="btn btn-primary btn-sm" type="button" data-share="copy">${copyLabel}</button>
        <button class="btn btn-outline btn-sm" type="button" data-share="native" style="display:none;">${shareLabel}</button>
        <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${xHref}">${xLabel}</a>
        <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${linkedInHref}">${linkedInLabel}</a>
        <a class="btn btn-outline btn-sm" href="${emailHref}">${emailLabel}</a>
      </div>
    `;

    const copyBtn = wrap.querySelector('[data-share="copy"]');
    const nativeBtn = wrap.querySelector('[data-share="native"]');

    if (navigator.share) {
      nativeBtn.style.display = "";
      nativeBtn.addEventListener("click", async () => {
        try {
          await navigator.share({ title: title || "", text: title || "", url });
        } catch {
          // ignore user cancel
        }
      });
    }

    copyBtn.addEventListener("click", async () => {
      const ok = await safeClipboardCopy(url);
      if (!ok) return;
      const prev = copyBtn.textContent;
      copyBtn.textContent = copiedLabel;
      copyBtn.classList.add("is-copied");
      setTimeout(() => {
        copyBtn.textContent = prev;
        copyBtn.classList.remove("is-copied");
      }, 1400);
    });

    return wrap;
  }

  function parsePosts() {
    const articles = Array.from(document.querySelectorAll("article.blog-post[id]"));
    return articles.map((article) => {
      const id = String(article.id || "");
      const title = (article.querySelector("h2")?.textContent || "").trim();
      const cat = String(article.dataset.cat || "").trim().toLowerCase();
      const meta = (article.querySelector(".blog-post-meta")?.textContent || "").trim();
      const dateLabel = splitBullet(meta)[0] || "";
      const excerpt = (article.querySelector(".blog-post-sub")?.textContent || "").trim();
      const firstImg = article.querySelector("img");
      const coverSrc = firstImg?.getAttribute?.("src") || "";
      const coverAlt = firstImg?.getAttribute?.("alt") || "";
      return { id, title, cat, el: article };
    }).map((p, idx) => {
      // Avoid changing downstream call sites by extending shape here.
      const meta = (p.el.querySelector(".blog-post-meta")?.textContent || "").trim();
      const dateLabel = splitBullet(meta)[0] || "";
      const excerpt = (p.el.querySelector(".blog-post-sub")?.textContent || "").trim();
      const firstImg = p.el.querySelector("img");
      const coverSrc = firstImg?.getAttribute?.("src") || "";
      const coverAlt = firstImg?.getAttribute?.("alt") || "";
      return { ...p, idx, dateLabel, excerpt, coverSrc, coverAlt };
    }).filter((p) => p.id);
  }

  function inferCategoryFromCard(card) {
    return String(card?.dataset?.cat || "").trim().toLowerCase();
  }

  function updateReadingTimes(posts) {
    const byId = new Map(posts.map((p) => [p.id, p]));
    posts.forEach((post) => {
      const meta = post.el.querySelector(".blog-post-meta");
      if (!meta) return;

      const text = post.el.textContent || "";
      const words = countWords(text);
      const minutes = computeReadMinutes(words);
      const label = getReadTimeLabel(minutes);

      const existing = String(meta.textContent || "");
      const datePart = existing.includes("•") ? existing.split("•")[0].trim() : existing.trim();
      meta.textContent = datePart ? `${datePart} • ${label}` : label;
      post.el.dataset.readMin = String(minutes);
    });

    document.querySelectorAll(".blog-card[href^=\"#\"], .blog-card[href^=\"./blog.html#\"]").forEach((card) => {
      const href = card.getAttribute("href") || "";
      const id = href.includes("#") ? href.split("#").pop() : "";
      const post = byId.get(String(id || ""));
      if (!post) return;
      const label = getReadTimeLabel(post.el.dataset.readMin || "1");

      let meta = card.querySelector(".blog-card-meta");
      if (!meta) {
        meta = document.createElement("div");
        meta.className = "blog-card-meta";
        card.appendChild(meta);
      }
      meta.textContent = label;
    });
  }

  const catLabel = (cat) => {
    const key = String(cat || "").trim().toLowerCase();
    const map = {
      news: "blog.filter.news",
      launch: "blog.filter.launch",
      case: "blog.filter.case",
      tips: "blog.filter.tips"
    };
    const k = map[key] || "";
    return k ? tt(k, key.toUpperCase()) : (key ? key.toUpperCase() : tt("blog.related.kicker", "POST"));
  };

  function addShareBarsTop(posts) {
    posts.forEach((post) => {
      const url = getArticlePermalink(post.id);
      const title = post.title || document.title;

      const head = post.el.querySelector(".blog-post-head");
      if (head && !post.el.querySelector(".blog-share-bar")) {
        const barTop = makeShareBar({ url, title });
        head.insertAdjacentElement("afterend", barTop);
      }
    });
  }

  function addShareBarsBottom(posts) {
    posts.forEach((post) => {
      if (post.el.querySelector(".blog-share-bar.bottom")) return;
      const url = getArticlePermalink(post.id);
      const title = post.title || document.title;
      const barBottom = makeShareBar({ url, title });
      barBottom.classList.add("bottom");
      post.el.appendChild(barBottom);
    });
  }

  function addRelatedPosts(posts) {
    const byCat = new Map();
    posts.forEach((p) => {
      const key = p.cat || "all";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(p);
    });

    const relatedTitle = tt("blog.related.title", "Related posts");

    posts.forEach((post) => {
      if (post.el.querySelector(".blog-related")) return;

      const sameCat = (byCat.get(post.cat || "all") || []).filter((p) => p.id !== post.id);
      const fallback = posts.filter((p) => p.id !== post.id && p.cat !== post.cat);
      const related = [...sameCat, ...fallback].slice(0, MAX_RELATED);
      if (!related.length) return;

      const section = document.createElement("div");
      section.className = "blog-related";
      section.innerHTML = `
        <div class="blog-related-title">${relatedTitle}</div>
        <div class="blog-related-grid"></div>
      `;

      const grid = section.querySelector(".blog-related-grid");
      related.forEach((p) => {
        const a = document.createElement("a");
        a.className = "blog-related-card";
        a.href = `#${p.id}`;
        a.setAttribute("data-cat", p.cat || "");
        a.innerHTML = `
          <div class="blog-related-kicker">${catLabel(p.cat)}</div>
          <div class="blog-related-name">${p.title || ""}</div>
          <div class="blog-related-meta">${getReadTimeLabel(p.el.dataset.readMin || "1")}</div>
        `;
        grid.appendChild(a);
      });

      post.el.appendChild(section);
    });
  }

  function renderFeatured(posts) {
    const host = document.getElementById("blogFeatured");
    if (!host) return;
    const featured = posts[0];
    if (!featured) return;

    const kicker = tt("blog.featured.kicker", "Featured");
    const cta = tt("blog.featured.cta", "Read article");
    const url = `#${featured.id}`;

    const imgSrc = featured.coverSrc || "./assets/polybag%20clear.webp";
    const imgAlt = featured.coverAlt || "";

    host.innerHTML = `
      <div class="blog-featured-grid">
        <div class="blog-featured-body">
          <div class="blog-featured-kicker">${kicker}</div>
          <div class="blog-featured-title">${featured.title || ""}</div>
          <div class="blog-featured-meta">${[featured.dateLabel, getReadTimeLabel(featured.el?.dataset?.readMin || "1")].filter(Boolean).join(" • ")}</div>
          <div class="blog-featured-desc">${featured.excerpt || ""}</div>
          <div class="blog-featured-actions">
            <a class="btn btn-primary btn-sm" href="${url}">${cta}</a>
            <a class="btn btn-outline btn-sm" href="./products.html">${tt("industry.cta.browse", "Browse products")}</a>
          </div>
        </div>
        <div class="blog-featured-media" aria-hidden="true">
          <img src="${imgSrc}" alt="${String(imgAlt).replace(/\"/g, "&quot;")}" loading="lazy" decoding="async">
        </div>
      </div>
    `;
  }

  function enhanceCards(posts) {
    const byId = new Map(posts.map((p) => [p.id, p]));
    const cards = Array.from(document.querySelectorAll(".blog-card[href*=\"#\"]"));
    cards.forEach((card) => {
      if (card.querySelector(".blog-card-thumb")) return;
      const href = card.getAttribute("href") || "";
      const id = href.includes("#") ? href.split("#").pop() : "";
      const post = byId.get(String(id || ""));
      if (!post) return;

      const imgSrc = post.coverSrc || "";
      if (imgSrc) {
        const thumb = document.createElement("div");
        thumb.className = "blog-card-thumb";
        thumb.innerHTML = `<img src="${imgSrc}" alt="" loading="lazy" decoding="async">`;
        card.insertAdjacentElement("afterbegin", thumb);
      }

      // meta is (re)written by updateReadingTimes, but include date too.
      const min = post.el?.dataset?.readMin || "1";
      const metaText = [post.dateLabel, getReadTimeLabel(min)].filter(Boolean).join(" • ");
      let meta = card.querySelector(".blog-card-meta");
      if (!meta) {
        meta = document.createElement("div");
        meta.className = "blog-card-meta";
        card.appendChild(meta);
      }
      meta.textContent = metaText;
    });
  }

  function setupFilters(posts) {
    const filters = Array.from(document.querySelectorAll(".blog-filter"));
    const search = document.getElementById("blogSearch");
    const results = document.getElementById("blogResults");
    const cards = Array.from(document.querySelectorAll(".blog-card"));

    if (!filters.length || !cards.length) return;

    const getActiveFilter = () => String(document.querySelector(".blog-filter.active")?.dataset?.filter || "all");

    const setActiveFilter = (filter) => {
      const f = String(filter || "all").trim() || "all";
      filters.forEach((b) => b.classList.toggle("active", b.dataset.filter === f));
    };

    const apply = () => {
      const filter = getActiveFilter();
      const q = String(search?.value || "").trim().toLowerCase();

      let visible = 0;
      cards.forEach((card) => {
        const cat = String(card.dataset.cat || "");
        const visibleByFilter = (filter === "all" || cat === filter);
        if (!q) {
          card.style.display = visibleByFilter ? "" : "none";
          if (visibleByFilter) visible += 1;
          return;
        }
        const text = (card.textContent || "").toLowerCase();
        const match = text.includes(q);
        const show = visibleByFilter && match;
        card.style.display = show ? "" : "none";
        if (show) visible += 1;
      });

      if (results) {
        const tpl = tt("blog.results", "{{count}} posts");
        results.textContent = tpl.replace("{{count}}", String(visible));
      }

      try {
        const url = new URL(window.location.href);
        const f = getActiveFilter();
        if (f && f !== "all") url.searchParams.set("cat", f);
        else url.searchParams.delete("cat");
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore
      }
    };

    // Add per-filter counts.
    const counts = cards.reduce((acc, card) => {
      const cat = String(card.dataset.cat || "");
      acc.all = (acc.all || 0) + 1;
      if (cat) acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    filters.forEach((btn) => {
      const key = String(btn.dataset.filter || "all");
      const count = Number(counts[key] || 0);
      let badge = btn.querySelector(".blog-filter-count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "blog-filter-count";
        btn.appendChild(badge);
      }
      const tpl = tt("blog.filter.count", "({{count}})");
      badge.textContent = ` ${tpl.replace("{{count}}", String(count))}`;
    });

    // Initial state from URL
    try {
      const params = new URLSearchParams(window.location.search);
      const initial = String(params.get("cat") || "").trim();
      if (["news", "launch", "case", "tips"].includes(initial)) setActiveFilter(initial);
      else setActiveFilter("all");
    } catch {
      setActiveFilter("all");
    }

    filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveFilter(btn.dataset.filter || "all");
        apply();
      });
    });

    if (search) {
      let t = null;
      search.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(apply, 120);
      });
    }

    apply();
  }

  function addTableOfContents(posts) {
    const title = tt("blog.toc.title", "On this page");

    posts.forEach((post) => {
      if (post.el.querySelector(".blog-toc")) return;
      const headings = Array.from(post.el.querySelectorAll("h3")).filter((h) => (h.textContent || "").trim());
      if (headings.length < 2) return;

      headings.forEach((h, idx) => {
        if (h.id) return;
        const base = `${post.id}-h${idx + 1}`;
        h.id = base;
      });

      const toc = document.createElement("div");
      toc.className = "blog-toc";
      toc.innerHTML = `
        <div class="blog-toc-title">${title}</div>
        <div class="blog-toc-links"></div>
      `;
      const links = toc.querySelector(".blog-toc-links");
      headings.forEach((h) => {
        const a = document.createElement("a");
        a.className = "blog-toc-link";
        a.href = `#${h.id}`;
        a.textContent = (h.textContent || "").trim();
        links.appendChild(a);
      });

      const after = post.el.querySelector(".blog-share-bar") || post.el.querySelector(".blog-post-head");
      if (after) after.insertAdjacentElement("afterend", toc);
    });
  }

  function addPrevNext(posts) {
    posts.forEach((post, idx) => {
      if (post.el.querySelector(".blog-nextprev")) return;
      const prev = posts[idx - 1];
      const next = posts[idx + 1];
      if (!prev && !next) return;

      const wrap = document.createElement("div");
      wrap.className = "blog-nextprev";
      wrap.innerHTML = `
        <a class="blog-nextprev-link" href="${prev ? `#${prev.id}` : "#"}" style="${prev ? "" : "visibility:hidden;"}">
          <div class="blog-nextprev-kicker">${tt("blog.nav.prev", "Previous")}</div>
          <div class="blog-nextprev-title">${prev ? (prev.title || "") : ""}</div>
        </a>
        <a class="blog-nextprev-link" href="${next ? `#${next.id}` : "#"}" style="${next ? "" : "visibility:hidden;"}">
          <div class="blog-nextprev-kicker">${tt("blog.nav.next", "Next")}</div>
          <div class="blog-nextprev-title">${next ? (next.title || "") : ""}</div>
        </a>
      `;
      post.el.appendChild(wrap);
    });
  }

  function renderComments(listEl, items) {
    const empty = tt("blog.comments.empty", "No comments yet. Be the first to share a tip.");
    if (!Array.isArray(items) || items.length === 0) {
      listEl.innerHTML = `<div class="blog-comments-empty">${empty}</div>`;
      return;
    }
    listEl.innerHTML = items
      .slice()
      .sort((a, b) => Number(a?.at || 0) - Number(b?.at || 0))
      .map((c) => {
        const name = String(c?.name || tt("blog.comments.anonymous", "Anonymous")).trim();
        const at = new Date(Number(c?.at || Date.now()));
        const when = Number.isNaN(at.getTime()) ? "" : at.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
        const msg = String(c?.message || "").trim();
        const safeMsg = msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `
          <div class="blog-comment">
            <div class="blog-comment-head">
              <div class="blog-comment-name">${name.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              <div class="blog-comment-date">${when}</div>
            </div>
            <div class="blog-comment-body">${safeMsg.replace(/\n/g, "<br/>")}</div>
          </div>
        `;
      })
      .join("");
  }

  function addComments(posts) {
    const title = tt("blog.comments.title", "Comments");
    const note = tt("blog.comments.note", "Comments are stored on your device (local only).");
    const nameLabel = tt("blog.comments.name", "Name");
    const emailLabel = tt("blog.comments.email", "Email (optional)");
    const msgLabel = tt("blog.comments.message", "Write a comment...");
    const postLabel = tt("blog.comments.post", "Post comment");
    const invalid = tt("blog.comments.invalid", "Please write a comment.");
    const saved = tt("blog.comments.saved", "Comment posted.");

    posts.forEach((post) => {
      if (post.el.querySelector(".blog-comments")) return;

      const key = `pps_blog_comments_v1_${post.id}`;
      const section = document.createElement("div");
      section.className = "blog-comments";
      section.innerHTML = `
        <div class="blog-comments-title">${title}</div>
        <div class="blog-comments-note">${note}</div>
        <div class="blog-comments-list" data-list></div>
        <form class="blog-comments-form" data-form>
          <div class="blog-comments-row">
            <label class="blog-comments-label">
              <span>${nameLabel}</span>
              <input class="input" name="name" autocomplete="name" />
            </label>
            <label class="blog-comments-label">
              <span>${emailLabel}</span>
              <input class="input" type="email" name="email" autocomplete="email" />
            </label>
          </div>
          <label class="blog-comments-label">
            <span style="display:none;">${msgLabel}</span>
            <textarea class="input" name="message" rows="3" placeholder="${msgLabel}"></textarea>
          </label>
          <div class="blog-comments-actions">
            <button class="btn btn-primary btn-sm" type="submit">${postLabel}</button>
            <div class="blog-comments-status" data-status role="status" aria-live="polite"></div>
          </div>
        </form>
      `;

      const listEl = section.querySelector("[data-list]");
      const form = section.querySelector("[data-form]");
      const status = section.querySelector("[data-status]");

      const read = () => {
        try {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };
      const write = (items) => {
        try {
          localStorage.setItem(key, JSON.stringify(items || []));
          return true;
        } catch {
          return false;
        }
      };

      const refresh = () => renderComments(listEl, read());
      refresh();

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        status.textContent = "";
        const fd = new FormData(form);
        const message = String(fd.get("message") || "").trim();
        if (!message) {
          status.textContent = invalid;
          return;
        }
        const name = String(fd.get("name") || "").trim();
        const email = String(fd.get("email") || "").trim();
        const next = read();
        next.push({ at: Date.now(), name, email, message });
        if (!write(next)) {
          status.textContent = tt("blog.comments.storage_failed", "Could not save comment on this device.");
          return;
        }
        try {
          form.reset();
        } catch {
          // ignore
        }
        refresh();
        status.textContent = saved;
      });

      post.el.appendChild(section);
    });
  }

  async function subscribeEmail(email) {
    const payload = {
      name: "",
      email,
      phone: "",
      orderType: "blog_subscribe",
      message: `Please subscribe this email to blog updates: ${email}`
    };
    const base = window.PPS?.API_BASE || window.API_BASE_URL || window.PPS_API_BASE || "";
    if (!base) throw new Error("missing_api_base");
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.message || "subscribe_failed");
    return true;
  }

  function setupSubscribeForm() {
    const form = document.getElementById("blogSubscribeForm");
    if (!form) return;
    const status = document.getElementById("blogSubscribeStatus");
    const input = form.querySelector('input[name="email"]');

    const sending = tt("blog.subscribe.sending", "Subscribing...");
    const thanks = tt("blog.subscribe.thanks", "Thanks! You’re subscribed.");
    const failed = tt("blog.subscribe.failed", "Couldn’t subscribe right now. Try again or email us.");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (status) status.textContent = "";
      const email = String(input?.value || "").trim();
      if (!email || !email.includes("@")) {
        if (status) status.textContent = tt("blog.subscribe.invalid", "Enter a valid email.");
        return;
      }

      if (status) status.textContent = sending;
      try {
        await subscribeEmail(email);
        try {
          localStorage.setItem("pps_blog_subscribed_email", email);
        } catch {
          // ignore
        }
        if (status) status.textContent = thanks;
        return;
      } catch {
        // fallback: mailto (works without backend)
        try {
          const subject = encodeURIComponent("Blog updates subscription");
          const body = encodeURIComponent(`Please add me to blog updates: ${email}`);
          window.location.href = `mailto:powerpolysupplies@gmail.com?subject=${subject}&body=${body}`;
        } catch {
          // ignore
        }
        if (status) status.textContent = failed;
      }
    });

    try {
      const savedEmail = localStorage.getItem("pps_blog_subscribed_email");
      if (savedEmail && input && !input.value) input.value = savedEmail;
    } catch {
      // ignore
    }
  }

  function init() {
    const posts = parsePosts();
    if (!posts.length) return;

    updateReadingTimes(posts);
    enhanceCards(posts);
    renderFeatured(posts);
    setupFilters(posts);
    addShareBarsTop(posts);
    addTableOfContents(posts);
    addRelatedPosts(posts);
    addComments(posts);
    addPrevNext(posts);
    addShareBarsBottom(posts);
    setupSubscribeForm();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
