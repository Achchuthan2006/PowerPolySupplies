import { useEffect } from "react";

export default function LegalTerms() {
  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  return (
    <section className="card legal-section fade-in">
      <h2 data-i18n="legal.terms.title">Terms & Conditions</h2>
      <p data-i18n="legal.terms.subtitle">Standard terms for purchasing from Power Poly Supplies.</p>
      <h3 data-i18n="legal.terms.orders.title">Orders & Payments</h3>
      <ul>
        <li data-i18n="legal.terms.orders.li1">All prices are listed in CAD unless stated otherwise.</li>
        <li data-i18n="legal.terms.orders.li2">Orders are confirmed once payment is approved.</li>
        <li data-i18n="legal.terms.orders.li3">We reserve the right to cancel orders for pricing errors or stock issues.</li>
      </ul>
      <h3 data-i18n="legal.terms.use.title">Product Use</h3>
      <p data-i18n="legal.terms.use.desc">
        Products are supplied for commercial and retail packaging needs. Please follow product guidelines and local regulations for safe use.
      </p>
      <h3 data-i18n="legal.terms.liability.title">Limitation of Liability</h3>
      <p data-i18n="legal.terms.liability.desc">
        Power Poly Supplies is not liable for indirect, incidental, or consequential damages related to product use or delivery delays beyond our control.
      </p>
      <h3 data-i18n="legal.terms.contact.title">Contact</h3>
      <p data-i18n="legal.terms.contact.note">For questions about these terms, contact</p>
      <div>powerpolysupplies@gmail.com</div>
    </section>
  );
}
