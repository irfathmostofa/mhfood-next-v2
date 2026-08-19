import { Suspense } from "react";
import { getTheme, getSeoSettings } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import ShopClient from "@/components/ShopClient";

export async function generateMetadata() {
  const seo = await getSeoSettings();
  return buildMetadata({ seo, path: "/shop" });
}

export default async function ShopPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-muted">Loading shop...</div>}>
      <ShopClient />
    </Suspense>
  );
}
