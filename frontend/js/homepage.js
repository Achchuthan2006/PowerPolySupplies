function ppsHomeIdle(task, timeout = 1200){
  if(typeof task !== "function") return;
  if("requestIdleCallback" in window){
    window.requestIdleCallback(()=> task(), { timeout });
    return;
  }
  window.setTimeout(task, 220);
}

function ppsMoneyValue(product){
  return Number(product?.priceCents) || 0;
}

function ppsCompareValue(product){
  return window.PPS?.getComparePriceCents?.(product) ?? (ppsMoneyValue(product) + 1000);
}

function ppsStockState(product){
  if(product?.stock <= 0){
    return {
      cls: "out",
      label: window.PPS_I18N?.t("product.stock.out") || "Out of stock"
    };
  }
  if(product?.stock <= 10){
    return {
      cls: "low",
      label: window.PPS_I18N?.t("product.stock.low") || "Almost out of stock"
    };
  }
  return {
    cls: "in",
    label: window.PPS_I18N?.t("product.stock.in") || "In stock"
  };
}

function ppsHomeCard(product, extraMeta = ""){
  const comparePrice = ppsCompareValue(product);
  const memberPrice = ppsMoneyValue(product);
  const stock = ppsStockState(product);
  return `
    <div class="card">
      <a href="./product.html?slug=${encodeURIComponent(product.slug)}">
        <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async" width="400" height="190">
      </a>
      <div class="card-body">
        <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(product.slug)}">${product.name}</a>
        <div class="member-pricing">
          <div>
            <div class="market-label" data-i18n="market.price.label">Market price</div>
            <span class="compare-price">${window.PPS.money(comparePrice, product.currency)}</span>
          </div>
          <div>
            <div class="member-label" data-i18n="member.price.label">Power Poly Member Price</div>
            <span class="price">${window.PPS.money(memberPrice, product.currency)}</span>
          </div>
        </div>
        ${extraMeta}
        <div class="stock ${stock.cls}"><span class="dot"></span>${stock.label}</div>
      </div>
    </div>
  `;
}

function ppsHomeRenderGrid(id, items, emptyMessage, renderItem = ppsHomeCard){
  const target = document.getElementById(id);
  if(!target) return;
  if(!Array.isArray(items) || !items.length){
    target.innerHTML = `<div style="color:var(--muted); font-size:13px;">${emptyMessage}</div>`;
    return;
  }
  target.innerHTML = items.map(renderItem).join("");
  try{
    window.PPS_I18N?.applyTranslations?.();
  }catch(_err){
    // ignore translation refresh issues
  }
}

function ppsHomeSetupHeroCarousel(){
  const hero = document.getElementById("heroCarousel");
  const track = document.getElementById("heroCarouselTrack");
  const dotsHost = document.getElementById("heroCarouselDots");
  if(!hero || !track || !dotsHost) return;

  const slides = Array.from(track.querySelectorAll("[data-hero-slide]"));
  if(!slides.length) return;

  let index = 0;
  let intervalId = 0;
  const swipeHint = document.getElementById("heroSwipeHint");
  const swipeStorageKey = "pps_hero_swipe_hint_seen";
  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  dotsHost.innerHTML = slides
    .map((_, slideIndex)=> `<button type="button" aria-label="Go to slide ${slideIndex + 1}" data-hero-dot="${slideIndex}"></button>`)
    .join("");

  const dots = Array.from(dotsHost.querySelectorAll("button"));
  const hideSwipeHint = ()=>{
    if(!swipeHint) return;
    swipeHint.classList.remove("is-visible");
    swipeHint.classList.add("is-hidden");
    try{
      sessionStorage.setItem(swipeStorageKey, "1");
    }catch(_err){
      // ignore
    }
  };

  if(swipeHint && isMobile){
    let seen = false;
    try{
      seen = sessionStorage.getItem(swipeStorageKey) === "1";
    }catch(_err){
      seen = false;
    }
    if(seen){
      swipeHint.classList.add("is-hidden");
    }else{
      swipeHint.classList.add("is-visible");
      setTimeout(hideSwipeHint, 5200);
    }
  }

  const render = (nextIndex)=>{
    index = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translateX(-${100 * index}%)`;
    dots.forEach((dot, dotIndex)=> dot.classList.toggle("active", dotIndex === index));
  };

  const start = ()=>{
    window.clearInterval(intervalId);
    intervalId = window.setInterval(()=> render(index + 1), 7000);
  };

  const goTo = (nextIndex)=>{
    render(nextIndex);
    hideSwipeHint();
    start();
  };

  render(0);
  start();

  document.querySelector("[data-hero-prev]")?.addEventListener("click", ()=> goTo(index - 1));
  document.querySelector("[data-hero-next]")?.addEventListener("click", ()=> goTo(index + 1));
  dotsHost.addEventListener("click", (event)=>{
    const button = event.target.closest("button[data-hero-dot]");
    if(!button) return;
    goTo(Number(button.dataset.heroDot) || 0);
  });

  let startX = 0;
  let startY = 0;
  track.addEventListener("touchstart", (event)=>{
    const touch = event.changedTouches?.[0];
    if(!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive:true });
  track.addEventListener("touchend", (event)=>{
    const touch = event.changedTouches?.[0];
    if(!touch) return;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if(Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    goTo(deltaX < 0 ? index + 1 : index - 1);
  }, { passive:true });
}

function ppsHomeSetupCountdown(){
  const countdown = document.getElementById("dealCountdown");
  if(!countdown) return;
  const endAt = Date.now() + 6 * 60 * 60 * 1000;
  const tick = ()=>{
    const remaining = Math.max(0, endAt - Date.now());
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    countdown.textContent = value;
    document.querySelectorAll("[data-deal-timer]").forEach((el)=>{
      el.textContent = value;
    });
  };
  tick();
  window.setInterval(tick, 1000);
}

function ppsHomeSetupFeaturedCarousel(){
  const track = document.getElementById("featuredCarouselTrack");
  if(!track) return;
  document.querySelectorAll('[data-carousel-prev="featured"]').forEach((button)=>{
    button.addEventListener("click", ()=>{
      track.scrollBy({ left:-320, behavior:"smooth" });
    });
  });
  document.querySelectorAll('[data-carousel-next="featured"]').forEach((button)=>{
    button.addEventListener("click", ()=>{
      track.scrollBy({ left:320, behavior:"smooth" });
    });
  });
}

function ppsHomeSetupTestimonials(){
  const grid = document.getElementById("homeTestimonialGrid");
  if(!grid || grid.dataset.cloned === "true") return;
  if((window.PPS_I18N?.getLang?.() || "en") !== "en"){
    grid.querySelectorAll(".testimonial-card.en-only").forEach((card)=> card.remove());
  }
  const cards = Array.from(grid.children);
  if(!cards.length) return;
  cards.forEach((card)=> grid.appendChild(card.cloneNode(true)));
  grid.dataset.cloned = "true";
  requestAnimationFrame(()=>{
    const halfWidth = grid.scrollWidth / 2;
    const duration = Math.max(24, halfWidth / 70);
    grid.style.setProperty("--marquee-duration", `${duration}s`);
  });
}

function ppsHomeSetupCountUp(){
  const els = Array.from(document.querySelectorAll("[data-count-up]"));
  if(!els.length) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const format = (value)=> String(Math.round(value));

  const animate = (el)=>{
    if(el.dataset.counted === "1") return;
    const target = Number(el.getAttribute("data-count-up"));
    const suffix = el.getAttribute("data-count-suffix") || "";
    if(!Number.isFinite(target)) return;
    el.dataset.counted = "1";
    if(reduceMotion){
      el.textContent = format(target) + suffix;
      return;
    }
    const startedAt = performance.now();
    const step = (time)=>{
      const progress = Math.min(1, (time - startedAt) / 900);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = format(target * eased) + suffix;
      if(progress < 1){
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting){
        animate(entry.target);
      }
    });
  }, { threshold:0.15, rootMargin:"0px 0px -10% 0px" });

  els.forEach((el)=> observer.observe(el));
}

function ppsHomeSetupPersonalizedForm(){
  const form = document.getElementById("personalizedEmailForm");
  const note = document.getElementById("personalizedEmailNote");
  if(!form) return;
  form.addEventListener("submit", (event)=>{
    event.preventDefault();
    const email = String(form.email?.value || "").trim();
    if(!email) return;
    try{
      localStorage.setItem("pps_personalized_email", email);
    }catch(_err){
      // ignore
    }
    if(note){
      note.textContent = "Thanks! We'll send tailored picks to your inbox.";
    }
    form.reset();
  });
}

window.addEventListener("DOMContentLoaded", ()=>{
  const yearEl = document.getElementById("y");
  if(yearEl){
    yearEl.textContent = String(new Date().getFullYear());
  }
  window.PPS?.updateCartBadge?.();

  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if(isMobile){
    [
      "trendingNowGrid",
      "industryRecsGrid",
      "recentlyLaunchedGrid",
      "bestByCategory",
      "trendsGrid",
      "dealsGrid"
    ].forEach((id)=>{
      document.getElementById(id)?.closest("section")?.style.setProperty("display", "none");
    });
    const interactiveTools = document.getElementById("interactive-tools");
    interactiveTools?.querySelector(".tool-grid")?.style.setProperty("display", "none");
    document.getElementById("mobileToolsSummary")?.style.setProperty("display", "block");
  }

  ppsHomeSetupHeroCarousel();
  ppsHomeSetupCountdown();
  ppsHomeSetupFeaturedCarousel();
  ppsHomeSetupCountUp();
  ppsHomeSetupPersonalizedForm();

  ppsHomeIdle(()=>{
    ppsHomeSetupTestimonials();
  }, 1400);

  (async ()=>{
    try{
      const products = await window.PPS.loadProducts();
      const countsByCategory = products.reduce((acc, product)=>{
        const category = product.category || "";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      document.querySelectorAll("[data-cat-count]").forEach((el)=>{
        const category = el.getAttribute("data-cat-count") || "";
        el.textContent = String(countsByCategory[category] || 0);
      });

      const recentSlugs = (()=>{
        try{
          const raw = localStorage.getItem("pps_recently_viewed_v1");
          const parsed = JSON.parse(raw || "[]");
          return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
        }catch(_err){
          return [];
        }
      })();

      const recentProducts = recentSlugs
        .map((slug)=> products.find((product)=> String(product.slug) === slug))
        .filter(Boolean);

      const cartCategories = (()=>{
        const cart = window.PPS.getCart?.() || [];
        const productMap = new Map(products.map((product)=> [product.id, product]));
        const counts = {};
        cart.forEach((item)=>{
          const category = String(productMap.get(item.id)?.category || "").trim();
          if(!category) return;
          counts[category] = (counts[category] || 0) + (Number(item.qty) || 1);
        });
        return counts;
      })();

      const prioritizedCategories = Array.from(new Set([
        ...Object.keys(cartCategories).sort((a, b)=> (cartCategories[b] || 0) - (cartCategories[a] || 0)),
        ...recentProducts.map((product)=> product.category).filter(Boolean)
      ])).slice(0, 3);

      const recommended = Array.from(
        new Map(
          products
            .filter((product)=> prioritizedCategories.includes(product.category))
            .map((product)=> [product.id, product])
        ).values()
      ).slice(0, 4);

      const deals = products.filter((product)=> product.special).slice(0, 4);
      const featured = products.slice(0, 10);
      const trending = products.slice(0, 8);
      const launches = products.slice(-4);

      ppsHomeRenderGrid(
        "recommendedGrid",
        recommended,
        "Browse products to unlock personalized recommendations."
      );

      ppsHomeRenderGrid(
        "dealsDayGrid",
        deals.length ? deals : products.slice(0, 4),
        "Deals refresh daily. Check back soon.",
        (product)=> ppsHomeCard(product, '<div class="deal-timer">Ends in <span data-deal-timer>--:--:--</span></div>')
      );

      ppsHomeRenderGrid(
        "featuredCarouselTrack",
        featured,
        "Featured products will appear here."
      );

      if(!isMobile){
        ppsHomeIdle(()=>{
          ppsHomeRenderGrid("trendingNowGrid", trending, "Check back soon for new trends.");
          ppsHomeRenderGrid("recentlyLaunchedGrid", launches, "New launches are coming soon.");
        });
      }

      const industryMap = {
        dry: ["Garment Bags", "Hangers", "Polybags"],
        laundry: ["Garment Bags", "Polybags", "Hangers"],
        retail: ["Polybags", "Hangers", "Garment Bags"],
        uniform: ["Garment Bags", "Hangers", "Polybags"]
      };

      const renderIndustry = (industry)=>{
        const categories = industryMap[industry] || [];
        const items = products.filter((product)=> categories.includes(product.category)).slice(0, 4);
        ppsHomeRenderGrid("industryRecsGrid", items, "No picks yet.");
      };

      if(!isMobile){
        ppsHomeIdle(()=> renderIndustry("dry"));
      }

      const industryPills = document.getElementById("industryPills");
      if(industryPills && !isMobile){
        industryPills.addEventListener("click", (event)=>{
          const pill = event.target.closest(".industry-pill");
          if(!pill) return;
          industryPills.querySelectorAll(".industry-pill").forEach((el)=> el.classList.remove("active"));
          pill.classList.add("active");
          renderIndustry(pill.dataset.industry || "dry");
        });
      }

      const bestByCategory = document.getElementById("bestByCategory");
      if(bestByCategory && !isMobile){
        const grouped = products.reduce((acc, product)=>{
          const category = String(product.category || "Other");
          acc[category] = acc[category] || [];
          acc[category].push(product);
          return acc;
        }, {});

        const html = Object.keys(grouped)
          .slice(0, 4)
          .map((category)=> `
            <div class="best-seller-card">
              <div class="best-seller-title">${category}</div>
              <div class="best-seller-list">
                ${grouped[category].slice(0, 3).map((product)=> `
                  <div class="best-seller-item">
                    <span>${product.name}</span>
                    <a href="./product.html?slug=${encodeURIComponent(product.slug)}">View</a>
                  </div>
                `).join("")}
              </div>
            </div>
          `)
          .join("");
        bestByCategory.innerHTML = html;
      }
    }catch(_err){
      // Keep homepage stable even if product data fails.
    }
  })();
});
