'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { cartCount } = useCart();

  return (
    <header className="site-header">
      <div className="promo-strip">
        <div className="container promo-inner">
          <div><strong>Power Poly Supplies</strong> | <span>Power your packaging</span></div>
          <div style={{ fontWeight: 700 }}>Bulk stock | Fast shipping | Canada-wide</div>
        </div>
      </div>
      <div className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="brand">
            <img src="/assets/poly logo without background.png" alt="Power Poly Supplies" />
            <div className="brand-text">
              <span className="brand-title">Power Poly Supplies</span>
              <span className="brand-tagline">Power your packaging</span>
            </div>
          </Link>
          
          <button 
            className="menu-btn" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            Menu
          </button>

          <nav className={`navlinks ${isMenuOpen ? 'open' : ''}`} id="navLinks">
            <Link href="/">Home</Link>
            <Link href="/specials">Special Offers</Link>
            
            <div className="dropdown">
              <button className="dropbtn" type="button">
                Shop by Category <span className="caret" aria-hidden="true"></span>
              </button>
              <div className="dropdown-menu">
                <Link href="/products?cat=Garment%20Bags">Garment Cover Bags</Link>
                <Link href="/products?cat=Polybags">Polybags</Link>
                <Link href="/products?cat=Hangers">Hangers</Link>
              </div>
            </div>

            <Link href="/about">About Us</Link>
            
            <Link href="/contact">
              <span className="nav-icon phone-icon" aria-hidden="true"></span>
              <span>Contact</span>
            </Link>
            
            <Link href="/feedback">
              <span className="nav-icon pen-icon" aria-hidden="true"></span>
              <span>Feedback</span>
            </Link>
            
            <Link href="/login">
              <span className="nav-icon user-icon" aria-hidden="true"></span>
              <span>Account</span>
            </Link>
            
            <Link href="/cart">
              <span className="nav-icon cart-icon" aria-hidden="true"></span>
              <span>Cart</span> 
              <span className="badge">{cartCount}</span>
            </Link>

            <form className="search-bar nav-search" action="/products" method="get" role="search">
              <input type="search" name="q" placeholder="Search" aria-label="Search products" />
              <button type="submit">Search</button>
            </form>
          </nav>
        </div>
      </div>
    </header>
  );
}
