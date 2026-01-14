import './globals.css'; // This would contain your styles.css content
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CartProvider } from '@/context/CartContext';

export const metadata = {
  title: 'Power Poly Supplies',
  description: 'Bulk garment cover bags, poly bags, wraps, racks, and professional-grade hangers.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/assets/poly logo without background.png" />
        {/* Fonts and other head tags go here */}
      </head>
      <body>
        <CartProvider>
          <Header />
          
          <div className="container page">
            {children}
            <Footer />
          </div>
          
        </CartProvider>
      </body>
    </html>
  );
}