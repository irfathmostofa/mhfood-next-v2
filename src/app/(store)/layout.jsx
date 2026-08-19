import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import BackToTop from "@/components/BackToTop";
import FloatingContactButtons from "@/components/FloatingContactButtons";
import { getTheme } from "@/lib/site";

export default async function StoreLayout({ children }) {
  const theme = await getTheme();

  return (
    <div className="min-h-screen flex flex-col">
      <Header theme={theme} />
      <main className="flex-1">{children}</main>
      <Footer theme={theme} />
      <FloatingContactButtons />
      <BackToTop />
      <CartDrawer />
    </div>
  );
}
