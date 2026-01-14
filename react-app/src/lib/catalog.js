export function categoryLabel(lang, category) {
  const normalized = String(lang || "en");
  if (normalized === "fr") {
    const map = {
      "Garment Bags": "Housses de vetements",
      "Hangers": "Cintres",
      "Polybags": "Sacs en poly",
      "Wraps": "Films",
      "Racks": "Portants",
    };
    return map[category] || category || "";
  }
  if (normalized === "es") {
    const map = {
      "Garment Bags": "Bolsas para prendas",
      "Hangers": "Ganchos",
      "Polybags": "Bolsas de polietileno",
      "Wraps": "Film",
      "Racks": "Percheros",
    };
    return map[category] || category || "";
  }
  return category || "";
}

export function stockClass(stock) {
  if (stock <= 0) return "out";
  if (stock <= 10) return "low";
  return "in";
}

export function stockLabel(stock) {
  if (stock <= 0) return window.PPS_I18N?.t("products.stock.out") || "Out of stock";
  if (stock <= 10) return window.PPS_I18N?.t("products.stock.low") || "Almost out of stock";
  return window.PPS_I18N?.t("products.stock.in") || "In stock";
}
