import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  useEffect(() => {
    const yearEl = document.getElementById("footer-year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  return (
    <footer className="footer dark-footer reveal">
      <div className="footer-inner">
        <div className="footer-brand">
          <span data-i18n="brand.name">Power Poly Supplies</span>
          <span style={{ color: "#ffb25c", fontSize: "12px" }} data-i18n="brand.tagline">
            Power your packaging
          </span>
          <div className="footer-meta" data-i18n="footer.meta">
            Bulk-ready stock | Fast response | Canada-wide supply
          </div>
        </div>
        <div>
          <h4 data-i18n="footer.shop">Shop</h4>
          <Link to="/products" data-i18n="footer.all_products">All products</Link>
          <Link to="/specials" data-i18n="footer.special_offers">Special offers</Link>
        </div>
        <div>
          <h4 data-i18n="footer.support">Support</h4>
          <Link to="/contact" data-i18n="footer.contact">Contact</Link>
          <Link to="/feedback" data-i18n="footer.feedback">Feedback</Link>
        </div>
        <div>
          <h4 data-i18n="footer.legal">Legal</h4>
          <Link to="/legal-shipping" data-i18n="footer.shipping">Shipping & Returns</Link>
          <Link to="/legal-privacy" data-i18n="footer.privacy">Privacy Policy</Link>
          <Link to="/legal-terms" data-i18n="footer.terms">Terms & Conditions</Link>
        </div>
          <div className="footer-contact">
            <h4 data-i18n="footer.help_line">Help line:</h4>
            <div>Angel 647-523-8645</div>
            <div>Andrew 437-425-6638</div>
            <div>Achchu 647-570-4878</div>
            <div style={{ marginTop: "6px" }}>
              <span data-i18n="footer.email">Email:</span> powerpolysupplies@gmail.com
            </div>
          </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-meta" data-i18n="footer.secure">Secure payments via Square</div>
        <div className="footer-meta">
          &copy; <span id="footer-year"></span>{" "}
          <span data-i18n="footer.rights">
            Power Poly Supplies. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
