import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { getSeoSettings } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import ProductView from "@/components/ProductView";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [product, seo] = await Promise.all([
    getProductBySlug(slug),
    getSeoSettings(),
  ]);

  if (!product) return {};

  return buildMetadata({
    seo,
    title: product.name,
    description: product.description?.slice(0, 160),
    keywords: `${product.name}, ${product.categories?.name || ""}, ${seo.home_keywords}`,
    image: product.product_images?.[0]?.image_url,
    path: `/product/${slug}`,
  });
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  return (
    <div className="max-w-8xl mx-auto px-5 py-8">
      <ProductView product={product} />
    </div>
  );
}
