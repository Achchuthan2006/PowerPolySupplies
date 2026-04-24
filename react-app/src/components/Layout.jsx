import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import HelpWidget from "./HelpWidget.jsx";

export default function Layout({ children }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="container page" tabIndex="-1">
        {children}
      </main>
      <Footer />
      <HelpWidget />
    </>
  );
}
