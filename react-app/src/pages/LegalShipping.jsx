import { useEffect } from "react";

export default function LegalShipping() {
  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  return (
    <section className="card legal-section fade-in">
      <h2 data-i18n="legal.shipping.title">Shipping & Returns</h2>
      <p data-i18n="legal.shipping.subtitle">Clear, simple details on delivery and returns for Power Poly Supplies orders in Canada.</p>
      <h3 data-i18n="legal.shipping.section">Shipping</h3>
      <p data-i18n="legal.shipping.blurb">We ship within Canada. Standard GTA delivery is free and scheduled by our team.</p>
      <ul>
        <li data-i18n="legal.shipping.li1">Express delivery is available on request; contact us for delivery charges.</li>
        <li data-i18n="legal.shipping.li2">Delivery timing is confirmed after we review your order and address.</li>
        <li data-i18n="legal.shipping.li3">For large or bulk orders, our team may contact you to confirm delivery details.</li>
        <li data-i18n="legal.shipping.li4">If you choose "place order and pay later" and cancel after delivery is attempted or completed, you are responsible for any delivery or service charges already incurred.</li>
      </ul>
      <h3 data-i18n="legal.returns.section">Returns</h3>
      <p data-i18n="legal.returns.blurb">We accept returns within 30 days of delivery for unused items in original packaging.</p>
      <ul>
        <li data-i18n="legal.returns.li1">Return shipping is paid by the customer.</li>
        <li data-i18n="legal.returns.li2">Please include your order ID in your return request.</li>
        <li data-i18n="legal.returns.li3">Refunds are issued to the original payment method after inspection.</li>
      </ul>
      <p data-i18n="legal.returns.note">To start a return, email us at</p>
      <div>powerpolysupplies@gmail.com</div>
    </section>
  );
}
