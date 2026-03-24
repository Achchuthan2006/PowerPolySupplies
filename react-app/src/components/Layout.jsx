import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import HelpWidget from "./HelpWidget.jsx";

export default function Layout({ children }) {
  return (
    <>
      <Header />
      <div className="container page">{children}</div>
      <Footer />
      <HelpWidget />
    </>
  );
}
