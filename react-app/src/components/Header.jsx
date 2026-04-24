import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useId, useRef, useState } from "react";

const navLinkClass = ({ isActive }) =>
  isActive ? "active" : undefined;

export default function Header() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const navRef = useRef(null);
  const navId = useId();
  const shopMenuId = useId();
  const hasSession = Boolean(window.PPS?.getSession?.());
  const accountActive = location.pathname === "/account" || location.pathname === "/account.html";

  const closeMenus = () => {
    setMenuOpen(false);
    setShopOpen(false);
  };

  useEffect(() => {
    window.PPS?.updateCartBadge?.();
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("mobile-menu-open", menuOpen);
    body.classList.toggle("mobile-menu-open", menuOpen);

    return () => {
      root.classList.remove("mobile-menu-open");
      body.classList.remove("mobile-menu-open");
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 860) {
        setMenuOpen(false);
        setShopOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setShopOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setShopOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const handlePointerDown = (event) => {
      if (window.innerWidth > 860) {
        return;
      }
      const target = event.target;
      if (
        navRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
      setShopOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    const firstFocusable = navRef.current?.querySelector(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

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
            Bulk stock | Fast shipping | Canada-wide
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
            ref={menuButtonRef}
            className="menu-btn"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls={navId}
            data-i18n="nav.menu"
            onClick={() => {
              setMenuOpen((value) => {
                const next = !value;
                if (!next) {
                  setShopOpen(false);
                }
                return next;
              });
            }}
          >
            Menu
          </button>

          {menuOpen ? (
            <button
              className="menu-backdrop"
              type="button"
              aria-label="Close menu"
              onClick={() => {
                closeMenus();
                menuButtonRef.current?.focus();
              }}
            />
          ) : null}

          <nav
            ref={navRef}
            className={`navlinks ${menuOpen ? "open" : ""}`}
            id={navId}
            aria-label="Primary"
          >
            <NavLink to="/" className={navLinkClass} data-i18n="nav.home" onClick={closeMenus}>
              Home
            </NavLink>
            <NavLink
              to="/specials"
              className={navLinkClass}
              data-i18n="nav.specials"
              onClick={closeMenus}
            >
              Special Offers
            </NavLink>

            <div className={`dropdown ${shopOpen ? "open" : ""}`}>
              <button
                className="dropbtn"
                type="button"
                aria-expanded={shopOpen}
                aria-controls={shopMenuId}
                onClick={() => setShopOpen((value) => !value)}
              >
                <span data-i18n="nav.shop">Shop by Category</span>{" "}
                <span className="caret" aria-hidden="true" />
              </button>
              <div className="dropdown-menu" id={shopMenuId}>
                <Link to="/products?cat=Garment%20Bags" data-i18n="nav.garment" onClick={closeMenus}>
                  Garment Cover Bags
                </Link>
                <Link to="/products?cat=Polybags" data-i18n="nav.polybags" onClick={closeMenus}>
                  Polybags
                </Link>
                <Link to="/products?cat=Hangers" data-i18n="nav.hangers" onClick={closeMenus}>
                  Hangers
                </Link>
                <Link to="/products?cat=Wraps" data-i18n="nav.wraps" onClick={closeMenus}>
                  Wraps
                </Link>
                <Link to="/products?cat=Racks" data-i18n="nav.racks" onClick={closeMenus}>
                  Racks
                </Link>
              </div>
            </div>

            <NavLink to="/about" className={navLinkClass} data-i18n="nav.about" onClick={closeMenus}>
              About Us
            </NavLink>
            <NavLink to="/contact" className={navLinkClass} onClick={closeMenus}>
              <span className="nav-icon phone-icon" aria-hidden="true" />
              <span data-i18n="nav.contact">Contact</span>
            </NavLink>
            <NavLink to="/feedback" className={navLinkClass} onClick={closeMenus}>
              <span className="nav-icon pen-icon" aria-hidden="true" />
              <span data-i18n="nav.feedback">Feedback</span>
            </NavLink>
            {hasSession ? (
              <Link to="/account" className={accountActive ? "active" : undefined} onClick={closeMenus}>
                <span className="nav-icon user-icon" aria-hidden="true" />
                <span data-i18n="nav.my_account">My Account</span>
              </Link>
            ) : (
              <NavLink to="/login" className={navLinkClass} onClick={closeMenus}>
                <span className="nav-icon user-icon" aria-hidden="true" />
                <span data-i18n="nav.account">Account</span>
              </NavLink>
            )}
            <NavLink to="/cart" className={navLinkClass} onClick={closeMenus}>
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
              onSubmit={closeMenus}
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
