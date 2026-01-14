import { Link, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";

const navLinkClass = ({ isActive }) =>
  isActive ? "active" : undefined;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    window.PPS?.updateCartBadge?.();
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  const handleLangChange = (event) => {
    window.PPS_I18N?.setLang?.(event.target.value);
  };

  const handleCurrencyChange = (event) => {
    window.PPS?.setCurrency?.(event.target.value);
  };

  return (
    <header className="site-header">
      <div className="promo-strip">
        <div className="container promo-inner">
          <div>
            <strong data-i18n="brand.name">Power Poly Supplies</strong>{" "}
            |{" "}
            <span data-i18n="brand.tagline">Power your packaging</span>
          </div>
          <div className="promo-right" data-i18n="promo.right">
            Bulk-ready stock | Fast response | Canada-wide supply
          </div>
        </div>
      </div>

      <div className="navbar">
        <div className="container navbar-inner">
          <Link className="brand" to="/">
            <img
              src="/assets/poly%20logo%20without%20background.png"
              alt="Power Poly Supplies"
            />
            <div className="brand-text">
              <span className="brand-title" data-i18n="brand.name">
                Power Poly Supplies
              </span>
              <span className="brand-tagline" data-i18n="brand.tagline">
                Power your packaging
              </span>
            </div>
          </Link>

          <button
            className="menu-btn"
            type="button"
            aria-label="Open menu"
            data-i18n="nav.menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            Menu
          </button>

          <nav className={`navlinks ${menuOpen ? "open" : ""}`} id="navLinks">
            <NavLink to="/" className={navLinkClass} data-i18n="nav.home">
              Home
            </NavLink>
            <NavLink
              to="/specials"
              className={navLinkClass}
              data-i18n="nav.specials"
            >
              Special Offers
            </NavLink>

            <div className={`dropdown ${shopOpen ? "open" : ""}`}>
              <button
                className="dropbtn"
                type="button"
                onClick={() => setShopOpen((value) => !value)}
              >
                <span data-i18n="nav.shop">Shop by Category</span>{" "}
                <span className="caret" aria-hidden="true" />
              </button>
              <div className="dropdown-menu">
                <Link to="/products?cat=Garment%20Bags" data-i18n="nav.garment">
                  Garment Cover Bags
                </Link>
                <Link to="/products?cat=Polybags" data-i18n="nav.polybags">
                  Polybags
                </Link>
                <Link to="/products?cat=Hangers" data-i18n="nav.hangers">
                  Hangers
                </Link>
                <Link to="/products?cat=Wraps" data-i18n="nav.wraps">
                  Wraps
                </Link>
                <Link to="/products?cat=Racks" data-i18n="nav.racks">
                  Racks
                </Link>
              </div>
            </div>

            <NavLink to="/about" className={navLinkClass} data-i18n="nav.about">
              About Us
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              <span className="nav-icon phone-icon" aria-hidden="true" />
              <span data-i18n="nav.contact">Contact</span>
            </NavLink>
            <NavLink to="/feedback" className={navLinkClass}>
              <span className="nav-icon pen-icon" aria-hidden="true" />
              <span data-i18n="nav.feedback">Feedback</span>
            </NavLink>
            <NavLink to="/login" className={navLinkClass}>
              <span className="nav-icon user-icon" aria-hidden="true" />
              <span data-i18n="nav.account">Account</span>
            </NavLink>
            <NavLink to="/cart" className={navLinkClass}>
              <span className="nav-icon cart-icon" aria-hidden="true" />
              <span data-i18n="nav.cart">Cart</span>{" "}
              <span className="badge" data-cart-badge>
                0
              </span>
            </NavLink>

            <form
              className="search-bar nav-search"
              action="/products"
              method="get"
              role="search"
            >
              <input
                type="search"
                name="q"
                placeholder="Search"
                aria-label="Search products"
              />
              <button type="submit">Search</button>
            </form>

            <div className="nav-tools">
              <div className="lang-switcher">
                <select
                  id="langSelect"
                  className="lang-select"
                  aria-label="Language"
                  onChange={handleLangChange}
                  defaultValue={window.PPS_I18N?.getLang?.() || "en"}
                >
                  <option value="en" data-i18n="lang.en">English</option>
                  <option value="fr" data-i18n="lang.fr">French</option>
                  <option value="es" data-i18n="lang.es">Spanish</option>
                  <option value="ko" data-i18n="lang.ko">Korean</option>
                  <option value="hi" data-i18n="lang.hi">Hindi</option>
                  <option value="ta" data-i18n="lang.ta">Tamil</option>
                </select>
              </div>
              <div className="currency-switcher">
                <select
                  id="currencySelect"
                  className="currency-select"
                  aria-label="Currency"
                  onChange={handleCurrencyChange}
                  defaultValue={window.PPS?.getCurrency?.() || "CAD"}
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
