import { supabase } from "@/lib/supabase";

export async function getProductsWithRatings({
  categoryId,
  ids,
  query,
  minPrice,
  maxPrice,
  inStockOnly,
  sort,
  limit,
  featuredOnly,
}) {
  let q = supabase
    .from("products")
    .select(
      "*, product_images(id, image_url, sort_order), categories(name)",
    )
    .eq("is_active", true);

  if (categoryId && categoryId !== "all") q = q.eq("category_id", categoryId);
  if (featuredOnly) q = q.eq("is_featured", true);
  if (ids && ids.length > 0) q = q.in("id", ids);
  if (query && query.trim()) q = q.ilike("name", `%${query.trim()}%`);
  if (minPrice) q = q.gte("price", Number(minPrice));
  if (maxPrice) q = q.lte("price", Number(maxPrice));
  if (inStockOnly) q = q.gt("stock", 0);

  if (sort === "price_asc") q = q.order("price", { ascending: true });
  else if (sort === "price_desc") q = q.order("price", { ascending: false });
  else q = q.order("created_at", { ascending: false });

  if (limit) q = q.limit(limit);

  const { data: prods, error } = await q;
  if (error || !prods || prods.length === 0) return { products: [], error };

  const idList = prods.map((p) => p.id);
  const { data: ratings } = await supabase
    .from("product_ratings")
    .select("*")
    .in("product_id", idList);

  const ratingMap = Object.fromEntries(
    (ratings || []).map((r) => [r.product_id, r]),
  );

  const products = prods.map((p) => ({
    ...p,
    product_images: [...(p.product_images || [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
    avg_rating: ratingMap[p.id]?.avg_rating || 0,
    review_count: ratingMap[p.id]?.review_count || 0,
  }));

  return { products, error };
}

export async function getBestsellers(limit = 12) {
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

  if (soldIds.length === 0) return [];

  const { products } = await getProductsWithRatings({ ids: soldIds });
  return products.sort((a, b) => (soldMap[b.id] || 0) - (soldMap[a.id] || 0));
}

export async function getProductBySlug(slug) {
  const { data: product, error } = await supabase
    .from("products")
    .select("*, categories(name), product_images(id, image_url, sort_order)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !product) return null;

  const productId = product.id;

  const [
    { data: rating },
    { data: reviewRows },
    { data: countRow },
    { data: variantRows },
  ] = await Promise.all([
    supabase
      .from("product_ratings")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("approved", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_order_counts")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    ...product,
    product_images: [...(product.product_images || [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
    avg_rating: rating?.avg_rating || 0,
    review_count: rating?.review_count || 0,
    total_sold: countRow?.total_sold || 0,
    variants: variantRows || [],
    reviews: reviewRows || [],
  };
}
