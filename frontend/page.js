import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <section className="hero fade-in show">
        <img className="hero-logo" src="/assets/poly logo without background.png" alt="Power Poly Supplies logo" />
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Power your packaging
        </p>
        <h1>Power Poly Supplies</h1>
        <p>
          Bulk garment cover bags, poly bags, wraps, racks, and professional-grade hangers. 
          Built for dry cleaners, laundromats, and retailers that need reliable stock.
        </p>
        
        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/products" className="btn btn-primary">Browse Products</Link>
          <Link href="/specials" className="btn btn-outline">View Special Offers</Link>
        </div>

        <div className="hero-callouts">
          <div className="callout-pill pulse">
            <span className="callout-icon ship-icon" aria-hidden="true"></span>
            <span>Fast shipping</span>
          </div>
          <div className="callout-pill pulse delay-1">
            <span className="callout-icon lock-icon" aria-hidden="true"></span>
            <span>Secure Stripe checkout</span>
          </div>
          <div className="callout-pill pulse delay-2">
            <span className="callout-icon leaf-icon" aria-hidden="true"></span>
            <span>Canada-wide supply</span>
          </div>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginTop: '16px' }}>
        <div className="card fade-in show" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 6px' }}>Garment Cover Bags</h3>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
            Multiple sizes with clear/plain options for daily dry-cleaning use.
          </p>
        </div>
        <div className="card fade-in show" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 6px' }}>Professional Hangers</h3>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
            Strut, capped, suit, and shirt hangers built for business operations.
          </p>
        </div>
        <div className="card fade-in show" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 6px' }}>Order Your Way</h3>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
            Pay online with Stripe or book the order and pay later after fulfillment.
          </p>
        </div>
      </section>

      <div className="support-band">
        <div className="support-item">
          <div className="support-label">Help line</div>
          <div className="support-value">Angel 647-523-8645</div>
          <div className="support-value">Achchu 647-570-4878</div>
          <div className="support-value">Andrew 437-425-6638</div>
        </div>
        <div className="support-item">
          <div className="support-label">Customer support</div>
          <div className="support-value">powerpolysupplies@gmail.com</div>
        </div>
        <div className="support-item">
          <div className="support-label">Questions? We're here.</div>
          <div className="support-value">Fast replies during business hours</div>
        </div>
      </div>
    </>
  );
}