"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Minus,
  Phone,
  MessageCircle,
  Plus,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { trackViewContent, trackAddToCart } from "@/components/Analytics";
import { supabase } from "@/lib/supabase";
import StarRating from "./StarRating";
import ReviewsList from "./ReviewsList";
import ProductCard from "./ProductCard";
import Link from "next/link";

export default function ProductView({ product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMsg, setAddedMsg] = useState(false);
  const [selected, setSelected] = useState({});
  const [siteSettings, setSiteSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  // Fetch site settings
  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("whatsapp_enabled, whatsapp_number, store_phone")
          .eq("id", 1)
          .maybeSingle();

        if (error) {
          console.error("Error loading site settings:", error);
          return;
        }

        if (!cancelled) {
          setSiteSettings(data);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch related products
  useEffect(() => {
    let cancelled = false;

    async function loadRelatedProducts() {
      setRelatedLoading(true);
      try {
        // Get products from the same category
        const { data, error } = await supabase
          .from("products")
          .select(
            `
            *,
            categories (
              name
            ),
            product_images (
              image_url,
              sort_order
            )
          `,
          )
          .eq("is_active", true)
          .eq("category_id", product.category_id)
          .neq("id", product.id)
          .limit(4);

        if (error) {
          console.error("Error loading related products:", error);
          return;
        }

        if (!cancelled) {
          // Fetch ratings for related products
          const relatedWithRatings = await Promise.all(
            (data || []).map(async (p) => {
              const { data: reviews } = await supabase
                .from("reviews")
                .select("rating")
                .eq("product_id", p.id)
                .eq("is_approved", true);

              const avgRating =
                reviews && reviews.length > 0
                  ? reviews.reduce((sum, r) => sum + r.rating, 0) /
                    reviews.length
                  : 0;

              return {
                ...p,
                avg_rating: avgRating,
                review_count: reviews?.length || 0,
              };
            }),
          );

          setRelatedProducts(relatedWithRatings);
        }
      } catch (error) {
        console.error("Failed to load related products:", error);
      } finally {
        if (!cancelled) {
          setRelatedLoading(false);
        }
      }
    }

    if (product.category_id) {
      loadRelatedProducts();
    } else {
      setRelatedLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [product.id, product.category_id]);

  useEffect(() => {
    trackViewContent({
      content_type: "product",
      content_ids: [product.id],
      content_name: product.name,
      value: Number(product.price),
      currency: "BDT",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const images = product.product_images || [];

  // Group variant rows into selectable groups
  const groups = useMemo(() => {
    const map = {};
    const variants = product.variants || [];
    variants.forEach((v) => {
      if (!map[v.name]) map[v.name] = [];
      map[v.name].push(v);
    });
    return Object.entries(map).map(([name, options]) => ({
      name,
      options: options.sort((a, b) => a.sort_order - b.sort_order),
    }));
  }, [product.variants]);

  const allSelected =
    groups.length === 0 || groups.every((g) => selected[g.name]);

  const selectedOptions = groups
    .map(
      (g) =>
        groups &&
        selected[g.name] &&
        g.options.find((o) => o.id === selected[g.name]),
    )
    .filter(Boolean);

  const priceAdjustment = selectedOptions.reduce(
    (sum, o) => sum + Number(o.price_adjustment || 0),
    0,
  );
  const price = Number(product.price) + priceAdjustment;

  const variantStock = allSelected
    ? selectedOptions.reduce(
        (min, o) => Math.min(min, Number(o.stock)),
        Infinity,
      )
    : Infinity;
  const effectiveStock =
    groups.length === 0
      ? Number(product.stock)
      : allSelected
        ? variantStock === Infinity
          ? Number(product.stock)
          : variantStock
        : Number(product.stock);

  const outOfStock = effectiveStock <= 0;

  function selectVariant(groupName, optionId) {
    setSelected((prev) => ({ ...prev, [groupName]: optionId }));
  }

  function handleAddToCart() {
    if (outOfStock || !allSelected) return;
    const selection = groups.map((g) => {
      const opt = g.options.find((o) => o.id === selected[g.name]);
      return {
        variant_id: opt.id,
        name: g.name,
        value: opt.value,
        price_adjustment: opt.price_adjustment,
      };
    });
    addItem(product, quantity, selection);
    trackAddToCart({
      content_type: "product",
      content_ids: [product.id],
      content_name: product.name,
      value:
        Number(product.price) +
        selection.reduce((s, o) => s + Number(o.price_adjustment || 0), 0),
      currency: "BDT",
      quantity,
    });
    setAddedMsg(true);
    setTimeout(() => setAddedMsg(false), 2000);
  }

  function handleBuyNow() {
    if (outOfStock || !allSelected) return;
    const selection = groups.map((g) => {
      const opt = g.options.find((o) => o.id === selected[g.name]);
      return {
        variant_id: opt.id,
        name: g.name,
        value: opt.value,
        price_adjustment: opt.price_adjustment,
      };
    });
    addItem(product, quantity, selection);
    router.push("/checkout");
  }

  // Check if WhatsApp and Phone are enabled using existing schema fields
  const showWhatsApp =
    siteSettings?.whatsapp_enabled && siteSettings?.whatsapp_number;
  const showPhone = siteSettings?.store_phone; // Using store_phone from your schema
  const whatsappNumber = siteSettings?.whatsapp_number || "";
  const phoneNumber = siteSettings?.store_phone || "";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-primary/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                images[activeImage]?.image_url ||
                "https://placehold.co/600x600?text=No+Image"
              }
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === activeImage ? "border-accent" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.categories?.name && (
            <p className="text-xs uppercase tracking-wide text-muted mb-2">
              {product.categories.name}
            </p>
          )}
          <h1 className="font-display text-2xl sm:text-3xl text-ink mb-3">
            {product.name}
          </h1>

          <div className="flex items-center gap-3 mb-4">
            <StarRating rating={product.avg_rating} />
            <span className="text-sm text-muted">
              {product.review_count} review
              {product.review_count === 1 ? "" : "s"}
            </span>
            {product.total_sold > 0 && (
              <span className="text-sm text-muted">
                · {product.total_sold} sold
              </span>
            )}
          </div>

          <p className="text-2xl font-semibold text-accent mb-4">
            ৳{price.toFixed(2)}
          </p>

          {/* Variant groups */}
          {groups.length > 0 && (
            <div className="space-y-4 mb-6">
              {groups.map((g) => (
                <div key={g.name}>
                  <p className="text-sm font-medium text-ink mb-2">{g.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((opt) => {
                      const active = selected[g.name] === opt.id;
                      const disabled = Number(opt.stock) <= 0;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => selectVariant(g.name, opt.id)}
                          disabled={disabled}
                          className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                            active
                              ? "bg-primary text-white border-primary"
                              : disabled
                                ? "border-line text-muted line-through opacity-60 cursor-not-allowed"
                                : "border-line text-ink hover:border-primary"
                          }`}
                        >
                          {opt.value}
                          {Number(opt.price_adjustment) > 0 &&
                            ` (+৳${Number(opt.price_adjustment)})`}
                          {Number(opt.price_adjustment) < 0 &&
                            ` (−৳${Math.abs(Number(opt.price_adjustment))})`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {groups.length > 0 && !allSelected && (
            <p className="text-xs text-muted mb-4">
              Please select all options above to continue.
            </p>
          )}

          {outOfStock ? (
            <p className="text-sm font-medium text-red-500 mb-4">
              Out of stock
            </p>
          ) : (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center border border-line rounded-full">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-9 h-9 flex items-center justify-center text-ink hover:bg-primary/5 rounded-full transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center text-sm text-ink">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity((q) => Math.min(effectiveStock, q + 1))
                  }
                  aria-label="Increase quantity"
                  className="w-9 h-9 flex items-center justify-center text-ink hover:bg-primary/5 rounded-full transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <span className="text-xs text-muted">
                {effectiveStock} in stock
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={outOfStock || !allSelected}
              className="flex-1 btn btn-outline"
            >
              {addedMsg ? <Check size={16} /> : <ShoppingBag size={16} />}
              {addedMsg ? "Added" : "Add to Cart"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={outOfStock || !allSelected}
              className="flex-1 btn btn-accent"
            >
              <Zap size={16} />
              Buy Now
            </button>
          </div>

          {/* WhatsApp & Call Order Buttons */}
          {!settingsLoading && (showWhatsApp || showPhone) && (
            <div className="mt-6 pt-6 border-t border-line">
              <p className="text-sm font-medium text-ink mb-3">Quick Order</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {showWhatsApp && (
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      `Hi, I'm interested in "${product.name}". Could you please provide more information?`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle size={20} />
                    Order via WhatsApp
                  </a>
                )}

                {showPhone && (
                  <a
                    href={`tel:${phoneNumber}`}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#0088CC] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    <Phone size={20} />
                    Call to Order
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description Section - Full Width */}
      {product.description && (
        <section className="mt-12 max-w-4xl">
          <h2 className="font-display text-xl text-ink mb-4">Description</h2>
          <div className="prose prose-sm max-w-none text-muted leading-relaxed">
            {product.description}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="mt-12 max-w-4xl">
        <h2 className="font-display text-xl text-ink mb-6">Reviews</h2>
        <ReviewsList
          reviews={product.reviews || []}
          avgRating={product.avg_rating}
          reviewCount={product.review_count}
        />
      </section>

      {/* Related Products */}
      <section className="mt-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-ink">Related Products</h2>
          <Link
            href={`/shop?category=${product.category_id}`}
            className="text-sm text-accent hover:underline"
          >
            View All
          </Link>
        </div>

        {relatedLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-3/4 bg-primary/5 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : relatedProducts.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No related products found.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
