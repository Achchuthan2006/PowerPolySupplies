function renderCategoryLandingPage(config){
  const grid = document.getElementById("categoryProductGrid");
  const faq = document.getElementById("categoryFaq");
  if(!grid || !config || !window.PPS?.loadProducts) return;

  const category = String(config.category || "").trim();
  const categorySeo = window.PPS_SEO?.getCategorySeo?.(category);
  if(categorySeo){
    window.PPS_SEO.applyPageSeo({
      ...categorySeo,
      image: config.image
    });
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type":"ListItem", "position":1, "name":"Home", "item": window.PPS_SEO.absoluteSiteUrl("./index.html") },
      { "@type":"ListItem", "position":2, "name":"Products", "item": window.PPS_SEO.absoluteSiteUrl("./products.html") },
      { "@type":"ListItem", "position":3, "name": categorySeo?.shortName || category, "item": window.PPS_SEO.absoluteSiteUrl(categorySeo?.path || "./products.html") }
    ]
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${categorySeo?.shortName || category} | Power Poly Supplies`,
    "itemListOrder": "https://schema.org/ItemListUnordered",
    "numberOfItems": 0,
    "itemListElement": []
  };
  document.getElementById("categoryJsonLd")?.remove?.();
  const ld = document.createElement("script");
  ld.id = "categoryJsonLd";
  ld.type = "application/ld+json";
  document.head.appendChild(ld);

  window.PPS.loadProducts().then((products)=>{
    const items = (products || []).filter((product)=> String(product.category || "").trim() === category);
    itemListLd.numberOfItems = items.length;
    itemListLd.itemListElement = items.map((product, index)=>({
      "@type": "ListItem",
      "position": index + 1,
      "url": window.PPS_SEO.absoluteSiteUrl(`./product.html?slug=${encodeURIComponent(product.slug)}`)
    }));
    ld.textContent = JSON.stringify({ "@context":"https://schema.org", "@graph":[breadcrumbLd, itemListLd] });

    grid.innerHTML = items.map((product)=>{
      const desc = window.PPS_SEO?.getProductSummary?.(product) || product.description || "";
      return `
        <article class="card fade-in">
          <a href="./product.html?slug=${encodeURIComponent(product.slug)}">
            <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async" width="640" height="360">
          </a>
          <div class="card-body">
            <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(product.slug)}">${product.name}</a>
            <p style="margin-top:10px; color:var(--muted); line-height:1.6;">${desc}</p>
            <div class="member-pricing">
              <div>
                <div class="member-label">From</div>
                <span class="price">${window.PPS.money(product.priceCents, product.currency)}</span>
              </div>
              <div>
                <div class="member-label">Availability</div>
                <span class="stock ${product.stock <= 0 ? "out" : product.stock <= 10 ? "low" : "in"}"><span class="dot"></span>${product.stock <= 0 ? "Out of stock" : product.stock <= 10 ? "Low stock" : "In stock"}</span>
              </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
              <a class="btn btn-primary btn-sm" href="./product.html?slug=${encodeURIComponent(product.slug)}">View details</a>
              <a class="btn btn-outline btn-sm" href="./contact.html">Request bulk quote</a>
            </div>
          </div>
        </article>
      `;
    }).join("");

    if(faq && Array.isArray(config.faqs)){
      faq.innerHTML = config.faqs.map((item)=>`
        <details class="resource-faq-item">
          <summary>${item.question}</summary>
          <div class="resource-faq-body">${item.answer}</div>
        </details>
      `).join("");

      const faqLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": config.faqs.map((item)=>({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
          }
        }))
      };
      const faqScript = document.createElement("script");
      faqScript.id = "categoryFaqJsonLd";
      faqScript.type = "application/ld+json";
      faqScript.textContent = JSON.stringify(faqLd);
      document.head.appendChild(faqScript);
    }

    document.querySelectorAll(".fade-in").forEach((el)=> el.classList.add("show"));
    if(window.injectFooter) window.injectFooter();
  }).catch(()=>{
    grid.innerHTML = `<div class="card" style="padding:18px;">Product listings are loading. Contact us for a quote on ${category.toLowerCase()}.</div>`;
  });
}

window.renderCategoryLandingPage = renderCategoryLandingPage;
