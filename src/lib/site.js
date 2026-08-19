import { cache } from "react";
import { supabase } from "./supabase";

export const DEFAULT_THEME = {
  primary_color: "#1F2A24",
  accent_color: "#C77B4C",
  background_color: "#FBF8F3",
  surface_color: "#FFFFFF",
  text_color: "#1F2A24",
  muted_color: "#8A8578",
  border_color: "#E7E0D3",
  show_announcement_bar: false,
  announcement_text: "",
  font_family: "fraunces",
  logo_text: "MHFood",
  store_name: "MHFood",
};

export const DEFAULT_SEO = {
  site_name: "MHFood",
  site_tagline: "Order online, tracked the whole way.",
  home_title: "MHFood — Shop online",
  home_description:
    "Shop a curated collection of products across every category — ordered in a click and tracked the whole way.",
  home_keywords: "shop, online store, ecommerce",
  og_image: "",
};

export const getTheme = cache(async () => {
  try {
    const { data } = await supabase
      .from("theme_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
});

export const getSeoSettings = cache(async () => {
  try {
    const { data } = await supabase
      .from("seo_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data || DEFAULT_SEO;
  } catch {
    return DEFAULT_SEO;
  }
});

export const getSiteSettings = cache(async () => {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
});

export const DEFAULT_SECTIONS = [
  { key: "hero", title: "Featured", subtitle: "Showcase your hero banner", enabled: true, sort_order: 1, items_per_page: 1 },
  { key: "bestsellers", title: "Best Selling Products", subtitle: "Our customers' favorites", enabled: true, sort_order: 2, items_per_page: 12 },
  { key: "categories", title: "Shop by Category", subtitle: "Browse our collections", enabled: true, sort_order: 3, items_per_page: 12 },
  { key: "featured", title: "Featured Products", subtitle: "Handpicked for you", enabled: true, sort_order: 4, items_per_page: 8 },
  { key: "latest", title: "New Arrivals", subtitle: "Fresh in store", enabled: true, sort_order: 5, items_per_page: 8 },
];

export const getHomeSections = cache(async () => {
  try {
    const { data } = await supabase
      .from("home_sections")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data && data.length > 0) return data;
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SECTIONS;
});

export const getCategories = cache(async () => {
  try {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });
    return data || [];
  } catch {
    return [];
  }
});

export const getDeliveryZones = cache(async () => {
  try {
    const { data } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data || [];
  } catch {
    return [];
  }
});

export const getDiscountRules = cache(async () => {
  try {
    const { data } = await supabase
      .from("discount_rules")
      .select("*")
      .eq("is_active", true);
    return data || [];
  } catch {
    return [];
  }
});
