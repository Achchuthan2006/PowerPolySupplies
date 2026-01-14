import { useEffect } from "react";

export default function LegalPrivacy() {
  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  return (
    <section className="card legal-section fade-in">
      <h2 data-i18n="legal.privacy.title">Privacy Policy</h2>
      <p data-i18n="legal.privacy.subtitle">How Power Poly Supplies collects and uses personal information.</p>
      <h3 data-i18n="legal.privacy.collect.title">Information We Collect</h3>
      <ul>
        <li data-i18n="legal.privacy.collect.li1">Contact details you provide (name, email, phone, address).</li>
        <li data-i18n="legal.privacy.collect.li2">Order details, payment confirmations, and delivery preferences.</li>
        <li data-i18n="legal.privacy.collect.li3">Messages or feedback you submit through our site.</li>
      </ul>
      <h3 data-i18n="legal.privacy.use.title">How We Use Information</h3>
      <ul>
        <li data-i18n="legal.privacy.use.li1">Process orders, deliver products, and provide support.</li>
        <li data-i18n="legal.privacy.use.li2">Send order updates, receipts, and service communications.</li>
        <li data-i18n="legal.privacy.use.li3">Improve our products, services, and customer experience.</li>
      </ul>
      <h3 data-i18n="legal.privacy.share.title">Sharing & Security</h3>
      <p data-i18n="legal.privacy.share.desc">
        We do not sell personal information. We only share data with service providers required to process payments, deliver orders, or provide customer support.
      </p>
      <p data-i18n="legal.privacy.share.security">We use reasonable security measures to protect your information.</p>
      <h3 data-i18n="legal.privacy.contact.title">Contact</h3>
      <p data-i18n="legal.privacy.contact.note">For privacy questions, contact</p>
      <div>powerpolysupplies@gmail.com</div>
    </section>
  );
}
