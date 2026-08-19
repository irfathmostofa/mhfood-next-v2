"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Image as ImageIcon,
  Tags,
  ChevronDown,
  LayoutGrid,
  List,
  Settings,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ImageUploader from "./ImageUploader";

const EMPTY_PRODUCT = {
  name: "",
  slug: "",
  category_id: "",
  price: "",
  stock: 0,
  description: "",
  is_featured: false,
  is_active: true,
};

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("products");

  const [editing, setEditing] = useState(null); // product being edited
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: productsData }, { data: categoryData }, { data: heroData }] =
      await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
        supabase.from("hero_slides").select("*").order("sort_order"),
      ]);
    setProducts(productsData || []);
    setCategories(categoryData || []);
    setHeroSlides(heroData || []);
    setLoading(false);
  }

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  }

  // ---- Products ----
  async function saveProduct(e) {
    e.preventDefault();
    if (!editing?.name) return;
    setSaving(true);
    setError("");

    const payload = {
      name: editing.name,
      slug:
        editing.slug ||
        slugify(editing.name) +
          (editing.id ? "" : `-${Date.now().toString(36).slice(-4)}`),
      category_id: editing.category_id || null,
      price: Number(editing.price) || 0,
      stock: Number(editing.stock) || 0,
      description: editing.description || "",
      is_featured: editing.is_featured,
      is_active: editing.is_active,
    };

    const { data: savedProduct, error } = editing.id
      ? await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single()
      : await supabase.from("products").insert(payload).select().single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    // Save variants if any were edited.
    const variantRows = editing.variants || [];
    if (variantRows.some((v) => v._dirty)) {
      const existing = variantRows.filter((v) => v.id && !v._removed);
      const removedIds = variantRows
        .filter((v) => v._removed && v.id)
        .map((v) => v.id);
      const newRows = variantRows
        .filter((v) => !v.id && !v._removed && (v.name || v.value))
        .map(({ name, value, price_adjustment, stock, sku }) => ({
          product_id: savedProduct.id,
          name,
          value,
          price_adjustment: Number(price_adjustment) || 0,
          stock: Number(stock) || 0,
          sku: sku || null,
        }));

      if (removedIds.length > 0) {
        await supabase.from("product_variants").delete().in("id", removedIds);
      }
      if (existing.length > 0) {
        await Promise.all(
          existing.map((v) =>
            supabase
              .from("product_variants")
              .update({
                name: v.name,
                value: v.value,
                price_adjustment: Number(v.price_adjustment) || 0,
                stock: Number(v.stock) || 0,
                sku: v.sku || null,
              })
              .eq("id", v.id),
          ),
        );
      }
      if (newRows.length > 0) {
        await supabase.from("product_variants").insert(newRows);
      }
    }

    // Sync product images.
    const imageRows = editing.images || [];
    const removedImageIds = imageRows
      .filter((im) => im._removed && im.id)
      .map((im) => im.id);
    const newImageRows = imageRows
      .filter((im) => !im._removed && !im.id && im.image_url)
      .map((im, i) => ({
        product_id: savedProduct.id,
        image_url: im.image_url,
        sort_order: im.sort_order || i + 1,
      }));
    if (removedImageIds.length > 0) {
      await supabase.from("product_images").delete().in("id", removedImageIds);
    }
    if (newImageRows.length > 0) {
      await supabase.from("product_images").insert(newImageRows);
    }

    setEditing(null);
    showFlash(editing.id ? "Product updated." : "Product added.");
    await loadAll();
    setSaving(false);
  }

  async function loadVariants(productId) {
    if (!productId) return [];
    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    return data || [];
  }

  async function loadImages(productId) {
    if (!productId) return [];
    const { data } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    return data || [];
  }

  async function toggleActive(product) {
    await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    await loadAll();
  }

  // ---- Categories ----
  async function saveCategory(e) {
    e.preventDefault();
    if (!editingCategory?.name) return;
    setSaving(true);
    const payload = {
      name: editingCategory.name,
      slug: editingCategory.slug || slugify(editingCategory.name),
      image_url: editingCategory.image_url || null,
      parent_id: editingCategory.parent_id || null,
    };
    const { error } = editingCategory.id
      ? await supabase
          .from("categories")
          .update(payload)
          .eq("id", editingCategory.id)
      : await supabase.from("categories").insert(payload);
    if (error) setError(error.message);
    else {
      setEditingCategory(null);
      showFlash(editingCategory.id ? "Category updated." : "Category added.");
      await loadAll();
    }
    setSaving(false);
  }

  async function deleteCategory(id) {
    if (!confirm("Delete this category? Products in it will keep their data."))
      return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) setError(error.message);
    else {
      showFlash("Category deleted.");
      await loadAll();
    }
  }

  // ---- Hero slides ----
  async function addHeroSlide() {
    const { data, error } = await supabase
      .from("hero_slides")
      .insert({
        image_url: "",
        title: "New Slide",
        subtitle: "",
        link_url: "",
        sort_order: heroSlides.length + 1,
        is_active: true,
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setHeroSlides((prev) => [...prev, data]);
    showFlash("Slide added — fill in the details below.");
  }

  async function saveHeroSlide(slide) {
    setSaving(true);
    const { error } = await supabase
      .from("hero_slides")
      .update({
        image_url: slide.image_url,
        title: slide.title,
        subtitle: slide.subtitle,
        link_url: slide.link_url,
        sort_order: slide.sort_order,
        is_active: slide.is_active,
      })
      .eq("id", slide.id);
    if (error) setError(error.message);
    else showFlash("Slide saved.");
    setSaving(false);
  }

  async function deleteHeroSlide(id) {
    if (!confirm("Delete this hero slide?")) return;
    const { error } = await supabase.from("hero_slides").delete().eq("id", id);
    if (error) setError(error.message);
    else {
      showFlash("Slide deleted.");
      await loadAll();
    }
  }

  function updateHeroSlide(id, field, value) {
    setHeroSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()),
  );

  const tabs = [
    { id: "products", label: "Products", icon: LayoutGrid },
    { id: "categories", label: "Categories", icon: Tags },
    { id: "hero", label: "Hero Slider", icon: Sparkles },
    // { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display text-ink">Admin Dashboard</h1>
        {activeTab === "products" && (
          <button
            onClick={() =>
              setEditing({
                ...EMPTY_PRODUCT,
                slug: "",
                id: null,
                variants: [],
                images: [],
              })
            }
            className="btn btn-primary"
          >
            <Plus size={16} /> Add Product
          </button>
        )}
        {activeTab === "hero" && (
          <button onClick={addHeroSlide} className="btn btn-primary">
            <Plus size={16} /> Add Slide
          </button>
        )}
        {activeTab === "categories" && (
          <button
            onClick={() =>
              setEditingCategory({
                id: null,
                name: "",
                slug: "",
                image_url: "",
                parent_id: null,
              })
            }
            className="btn btn-primary"
          >
            <Plus size={16} /> Add Category
          </button>
        )}
      </div>

      {flash && (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          {flash}
        </p>
      )}
      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="border-b border-line mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-ink hover:border-line"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left panel - List */}
        <div className="xl:col-span-3">
          {activeTab === "products" && (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="input mb-4"
              />

              {loading ? (
                <p className="text-sm text-muted py-10 text-center">
                  Loading products...
                </p>
              ) : (
                <div className="card overflow-hidden">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted py-10 text-center">
                      No products found.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {filtered.map((product) => (
                        <li
                          key={product.id}
                          className="flex items-center justify-between px-5 py-4"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="text-sm font-medium text-ink truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              ৳{product.price} · {product.stock} in stock ·{" "}
                              {product.is_featured
                                ? "featured"
                                : "not featured"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toggleActive(product)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                product.is_active
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-muted border border-line"
                              }`}
                            >
                              {product.is_active ? "Active" : "Hidden"}
                            </button>
                            <button
                              onClick={async () => {
                                const [variants, images] = await Promise.all([
                                  loadVariants(product.id),
                                  loadImages(product.id),
                                ]);
                                setEditing({ ...product, variants, images });
                              }}
                              aria-label="Edit"
                              className="p-2 text-muted hover:text-ink"
                            >
                              <Pencil size={15} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "categories" && (
            <div className="card p-6">
              <ul className="divide-y divide-line">
                {categories.map((cat) => {
                  const parent = categories.find((c) => c.id === cat.parent_id);
                  const childCount = categories.filter(
                    (c) => c.parent_id === cat.id,
                  ).length;
                  return (
                    <li
                      key={cat.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm text-ink truncate">{cat.name}</p>
                        <p className="text-xs text-muted truncate">
                          {parent
                            ? `Sub-category of ${parent.name}`
                            : "Top level"}
                          {childCount > 0 && ` · ${childCount} sub-categories`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setEditingCategory({
                              id: cat.id,
                              name: cat.name,
                              slug: cat.slug,
                              image_url: cat.image_url || "",
                              parent_id: cat.parent_id || null,
                            })
                          }
                          aria-label="Edit category"
                          className="p-2 text-muted hover:text-ink"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          aria-label="Delete category"
                          className="p-2 text-muted hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
                {categories.length === 0 && (
                  <p className="text-sm text-muted py-10 text-center">
                    No categories yet. Create one using the form on the right.
                  </p>
                )}
              </ul>
            </div>
          )}

          {activeTab === "hero" && (
            <div className="space-y-4">
              {heroSlides.map((slide) => (
                <div key={slide.id} className="card p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={slide.is_active}
                        onChange={(e) =>
                          updateHeroSlide(
                            slide.id,
                            "is_active",
                            e.target.checked,
                          )
                        }
                      />
                      Active
                    </label>
                    <button
                      onClick={() => deleteHeroSlide(slide.id)}
                      aria-label="Delete slide"
                      className="text-muted hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div>
                    <ImageUploader
                      value={slide.image_url}
                      onChange={(v) =>
                        updateHeroSlide(slide.id, "image_url", v)
                      }
                      folder="hero-slides"
                      label="Image"
                      aspect="wide"
                      hint="Recommended 1920x700px — optimized automatically on upload."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Title</label>
                      <input
                        value={slide.title}
                        onChange={(e) =>
                          updateHeroSlide(slide.id, "title", e.target.value)
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Link URL</label>
                      <input
                        value={slide.link_url}
                        onChange={(e) =>
                          updateHeroSlide(slide.id, "link_url", e.target.value)
                        }
                        placeholder="/shop"
                        className="input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Subtitle</label>
                    <input
                      value={slide.subtitle}
                      onChange={(e) =>
                        updateHeroSlide(slide.id, "subtitle", e.target.value)
                      }
                      className="input"
                    />
                  </div>

                  <button
                    onClick={() => saveHeroSlide(slide)}
                    disabled={saving}
                    className="btn btn-outline w-full btn-sm disabled:opacity-60"
                  >
                    <Save size={14} /> Save Slide
                  </button>
                </div>
              ))}

              {heroSlides.length === 0 && (
                <p className="text-sm text-muted text-center py-10">
                  No slides yet — click &quot;Add Slide&quot; to create one.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right panel - Edit form */}
        <div className="xl:col-span-2">
          {activeTab === "products" && editing && (
            <form
              onSubmit={saveProduct}
              className="card p-6 space-y-4 sticky top-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">
                  {editing.id ? "Edit Product" : "New Product"}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  aria-label="Close"
                  className="text-muted hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="label">Name</label>
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Slug (URL)</label>
                <input
                  value={editing.slug}
                  onChange={(e) =>
                    setEditing({ ...editing, slug: e.target.value })
                  }
                  placeholder="auto-generated from name"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  value={editing.category_id || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, category_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">— No category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Price (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing.price}
                    onChange={(e) =>
                      setEditing({ ...editing, price: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={editing.stock}
                    onChange={(e) =>
                      setEditing({ ...editing, stock: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  className="input"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={editing.is_featured}
                    onChange={(e) =>
                      setEditing({ ...editing, is_featured: e.target.checked })
                    }
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(e) =>
                      setEditing({ ...editing, is_active: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>

              <VariantsEditor
                variants={editing.variants || []}
                onChange={(variants) => setEditing({ ...editing, variants })}
              />

              <ImagesEditor
                images={editing.images || []}
                onChange={(images) => setEditing({ ...editing, images })}
              />

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary w-full disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />{" "}
                    {editing.id ? "Save Changes" : "Add Product"}
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === "categories" && editingCategory && (
            <form
              onSubmit={saveCategory}
              className="card p-6 space-y-4 sticky top-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">
                  {editingCategory.id ? "Edit Category" : "New Category"}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  aria-label="Close"
                  className="text-muted hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="label">Name</label>
                <input
                  value={editingCategory.name || ""}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      name: e.target.value,
                    })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Slug (URL)</label>
                <input
                  value={editingCategory.slug || ""}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      slug: e.target.value,
                    })
                  }
                  placeholder="auto-generated from name"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Parent Category</label>
                <select
                  value={editingCategory.parent_id || ""}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      parent_id: e.target.value || null,
                    })
                  }
                  className="input"
                >
                  <option value="">— No parent (top level) —</option>
                  {categories
                    .filter(
                      (c) => !editingCategory.id || c.id !== editingCategory.id,
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <ImageUploader
                  value={editingCategory.image_url || ""}
                  onChange={(v) =>
                    setEditingCategory({
                      ...editingCategory,
                      image_url: v,
                    })
                  }
                  folder="categories"
                  label="Image (optional)"
                  aspect="square"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary w-full disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />{" "}
                    {editingCategory.id ? "Save Category" : "Add Category"}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Variants ----------
function VariantsEditor({ variants, onChange }) {
  const [open, setOpen] = useState(false);

  function update(idx, field, value) {
    onChange(
      variants.map((v, i) =>
        i === idx ? { ...v, [field]: value, _dirty: true } : v,
      ),
    );
  }

  function addRow() {
    onChange([
      ...variants,
      {
        id: null,
        name: "",
        value: "",
        price_adjustment: 0,
        stock: 0,
        sku: "",
        _dirty: true,
        _removed: false,
      },
    ]);
  }

  function removeRow(idx) {
    onChange(
      variants.map((v, i) =>
        i === idx ? { ...v, _removed: true, _dirty: true } : v,
      ),
    );
  }

  const visible = variants.filter((v) => !v._removed);

  return (
    <div className="border border-line rounded-xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-ink"
      >
        <span>Options / Variants</span>
        <span className="flex items-center gap-2">
          {visible.length > 0 && (
            <span className="text-xs text-muted font-normal">
              {visible.length} set
            </span>
          )}
          <ChevronDown
            size={15}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-muted mb-3">
            Groups are options like Size or Color. Each row is one option; the
            first column is the group name, the second is the option value. Fill
            both to create a variant.
          </p>

          {visible.length === 0 && (
            <p className="text-xs text-muted mb-3">
              No variants — this product is sold as-is.
            </p>
          )}

          <div className="space-y-2">
            {variants.map((v, i) =>
              v._removed ? null : (
                <div key={i} className="grid grid-cols-5 gap-2 items-center">
                  <input
                    value={v.name}
                    onChange={(e) => update(i, "name", e.target.value)}
                    placeholder="Group"
                    className="input input-sm"
                  />
                  <input
                    value={v.value}
                    onChange={(e) => update(i, "value", e.target.value)}
                    placeholder="Value"
                    className="input input-sm"
                  />
                  <input
                    type="number"
                    value={v.price_adjustment}
                    onChange={(e) =>
                      update(i, "price_adjustment", e.target.value)
                    }
                    placeholder="+৳"
                    className="input input-sm"
                  />
                  <input
                    type="number"
                    value={v.stock}
                    onChange={(e) => update(i, "stock", e.target.value)}
                    placeholder="Stock"
                    className="input input-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label="Remove variant"
                    className="justify-self-end p-1.5 text-muted hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 btn btn-outline btn-sm"
          >
            <Plus size={14} /> Add Option
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Product images ----------
function ImagesEditor({ images, onChange }) {
  const [open, setOpen] = useState(false);

  function addImage() {
    onChange([
      ...images,
      {
        id: null,
        image_url: "",
        sort_order: images.length + 1,
        _removed: false,
      },
    ]);
  }

  function updateImage(idx, value) {
    onChange(
      images.map((im, i) => {
        if (i !== idx) return im;
        if (value === "" && im.id) return { ...im, _removed: true };
        return { ...im, image_url: value };
      }),
    );
  }

  function removeImage(idx) {
    onChange(
      images.map((im, i) => (i === idx ? { ...im, _removed: true } : im)),
    );
  }

  const visible = images.filter((im) => !im._removed);

  return (
    <div className="border border-line rounded-xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-ink"
      >
        <span className="flex items-center gap-2">
          <ImageIcon size={15} /> Product Images
        </span>
        <span className="flex items-center gap-2">
          {visible.length > 0 && (
            <span className="text-xs text-muted font-normal">
              {visible.length}
            </span>
          )}
          <ChevronDown
            size={15}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-muted mb-3">
            Images are optimized automatically before upload. The first image is
            used as the main product photo.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {visible.map((img, i) => (
              <div key={i} className="relative">
                <ImageUploader
                  value={img.image_url}
                  onChange={(v) => updateImage(i, v)}
                  folder="products"
                  label={`Image ${i + 1}`}
                  aspect="square"
                />
                {img.id && (
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label="Delete image"
                    className="absolute top-1.5 left-1.5 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors z-10"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addImage}
            className="mt-3 btn btn-outline btn-sm"
          >
            <Plus size={14} /> Add Image
          </button>
        </div>
      )}
    </div>
  );
}
