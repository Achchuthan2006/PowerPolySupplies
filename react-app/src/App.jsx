import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Products = lazy(() => import("./pages/Products.jsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.jsx"));
const Specials = lazy(() => import("./pages/Specials.jsx"));
const Cart = lazy(() => import("./pages/Cart.jsx"));
const Checkout = lazy(() => import("./pages/Checkout.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const Feedback = lazy(() => import("./pages/Feedback.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const Account = lazy(() => import("./pages/Account.jsx"));
const LegalShipping = lazy(() => import("./pages/LegalShipping.jsx"));
const LegalPrivacy = lazy(() => import("./pages/LegalPrivacy.jsx"));
const LegalTerms = lazy(() => import("./pages/LegalTerms.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const AdminMessages = lazy(() => import("./pages/AdminMessages.jsx"));
const ThankYou = lazy(() => import("./pages/ThankYou.jsx"));

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    window.PPS_I18N?.applyTranslations?.();
    window.PPS?.updateCartBadge?.();
  }, [location.pathname, location.search]);

  return (
    <Layout>
      <Suspense fallback={<div className="card skeleton" style={{ height: "260px" }} />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product" element={<ProductDetail />} />
          <Route path="/specials" element={<Specials />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/account" element={<Account />} />
          <Route path="/legal/shipping" element={<LegalShipping />} />
          <Route path="/legal/privacy" element={<LegalPrivacy />} />
          <Route path="/legal/terms" element={<LegalTerms />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin-messages" element={<AdminMessages />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
