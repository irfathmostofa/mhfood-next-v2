"use client";

import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getProductsWithRatings } from "@/lib/products";
import ProductCard from "./ProductCard";

export default function BestSellers({ title, subtitle, limit = 12 }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: products.length > 4, align: "start", skipSnaps: false },
    [
      Autoplay({
        delay: 4000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: false,
      }),
    ],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity");

      const soldMap = {};
      (items || []).forEach((it) => {
        soldMap[it.product_id] = (soldMap[it.product_id] || 0) + it.quantity;
      });

      const soldIds = Object.entries(soldMap)
        .filter(([, qty]) => qty > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      if (soldIds.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { products: prods } = await getProductsWithRatings({
        ids: soldIds,
      });
      if (!cancelled) {
        setProducts(
          prods.sort((a, b) => (soldMap[b.id] || 0) - (soldMap[a.id] || 0)),
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, products]);

  if (!loading && products.length === 0) return null;

  return (
    <section className="max-w-8xl mx-auto px-5 py-10">
      <div className="flex items-end justify-between mb-6">
        <div className="px-1.5">
          <h2 className="font-display text-2xl sm:text-3xl text-ink">
            {title || "Best Selling Products"}
          </h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {products.length > 4 && (
          <div className="hidden sm:flex items-center gap-2">
            <CarouselButton
              direction="prev"
              onClick={() => emblaApi?.scrollPrev()}
            />
            <CarouselButton
              direction="next"
              onClick={() => emblaApi?.scrollNext()}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] bg-primary/5 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {products.map((product, rank) => (
              <div
                key={product.id}
                className="relative shrink-0 px-1.5 sm:px-2.5 basis-1/2 sm:basis-1/3 lg:basis-1/5"
              >
                {rank < 3 && (
                  <span className="absolute top-2 left-4 z-10 px-2.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-semibold shadow">
                    #{rank + 1} Best Seller
                  </span>
                )}
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      )}

      {products.length > 4 && (
        <div className="sm:hidden flex items-center justify-center gap-3 mt-5">
          <CarouselButton
            direction="prev"
            onClick={() => emblaApi?.scrollPrev()}
          />
          <CarouselButton
            direction="next"
            onClick={() => emblaApi?.scrollNext()}
          />
        </div>
      )}
    </section>
  );
}

function CarouselButton({ direction, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous" : "Next"}
      className="p-2 rounded-full border border-line text-ink hover:border-primary hover:bg-primary hover:text-white transition-colors"
    >
      {direction === "prev" ? (
        <ChevronLeft size={18} />
      ) : (
        <ChevronRight size={18} />
      )}
    </button>
  );
}
