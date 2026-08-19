import HeroSlider from "./HeroSlider";
import PromoBanner from "./PromoBanner";

// Homepage hero: a 12-column grid — 9 columns for the slider and 3
// columns for a single promo banner on the right.
export default function HeroSection() {
  return (
    <section className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        <div className="col-span-12 lg:col-span-8 rounded-2xl overflow-hidden">
          <HeroSlider />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <PromoBanner />
        </div>
      </div>
    </section>
  );
}
