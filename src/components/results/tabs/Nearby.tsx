"use client";

// Nearby & Competitors — reviewer-facing preview.
// Not wired to any live data yet. The panel shows what the finished feature
// will do (Google Places / OSM search around the user's city, filtered by
// the resolved business type) and lets the reviewer walk through the UX.

import { useState } from "react";
import { GoldCounter } from "@/components/GoldCounter";

interface Props {
  businessLabel: string;
  city: string;
  attributes: string[];
}

const RADII = [1, 3, 5, 10] as const;

type Radius = (typeof RADII)[number];

export function Nearby({ businessLabel, city, attributes }: Props) {
  const [radius, setRadius] = useState<Radius>(3);
  const category = deriveCategory(attributes);
  const previewCompetitors = mockCompetitors(category, city);

  return (
    <section aria-labelledby="nearby-heading" className="space-y-6">
      <GoldCounter route="results/nearby" />
      <h2 id="nearby-heading" className="sr-only">
        Nearby & Competitors
      </h2>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-22 font-semibold text-ink">Nearby & competitor landscape</h3>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-11 font-medium text-amber-900">
            Preview · v0
          </span>
        </div>
        <p className="mt-1 text-13 text-slate">
          Discover similar businesses and direct competitors around your operating location. Helps size
          the market before you commit to a lease.
        </p>
      </div>

      {/* Preview banner */}
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-white to-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-16">🗺️</span>
          <div>
            <p className="text-14 font-medium text-ink">This tab is a working preview.</p>
            <p className="mt-1 text-13 text-slate leading-relaxed">
              In the shipped version this will query Google Places / OpenStreetMap Overpass around
              your city, filter by the business category we already resolved from your intake, and
              rank results by proximity, review volume, and estimated overlap. Results below are
              illustrative so a reviewer can see the intended UX.
            </p>
          </div>
        </div>
      </div>

      {/* Query controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="block text-11 font-semibold uppercase tracking-wider text-slate mb-1.5">
              Around
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-14 font-medium text-ink">
              {city || "Coimbatore"}
            </div>
          </div>
          <div>
            <label className="block text-11 font-semibold uppercase tracking-wider text-slate mb-1.5">
              Category
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-14 font-medium text-ink capitalize">
              {category.label}
            </div>
          </div>
          <div>
            <label className="block text-11 font-semibold uppercase tracking-wider text-slate mb-1.5">
              Radius
            </label>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50/50 p-1">
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadius(r)}
                  className={
                    "flex-1 rounded-lg px-3 py-1.5 text-13 font-medium transition " +
                    (radius === r ? "bg-white text-ink shadow-xs" : "text-slate hover:text-ink")
                  }
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <p className="text-12 text-slate">
            Estimated: <span className="font-medium text-ink tabular">{previewCompetitors.length} similar businesses</span> within {radius} km of {city || "your city"}.
          </p>
          <button
            type="button"
            disabled
            title="Wire this button to /api/nearby once Google Places / OSM is enabled."
            className="rounded-xl bg-ink px-4 py-2 text-13 font-medium text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Run live search (coming soon)
          </button>
        </div>
      </div>

      {/* Preview competitor list */}
      <div>
        <p className="text-11 font-semibold uppercase tracking-wider text-slate mb-3">
          Example results
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {previewCompetitors.map((c) => (
            <li
              key={c.name}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-card hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-16 font-semibold text-ink truncate">{c.name}</p>
                  <p className="text-12 text-slate">{c.locality}</p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-11 font-medium text-slate-700 tabular">
                  {c.distanceKm} km
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-11 text-slate">
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 tabular">
                  ★ {c.rating.toFixed(1)}
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 tabular">
                  {c.reviews} reviews
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5">
                  {c.priceLevel}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Roadmap */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-5 backdrop-blur-xs">
        <p className="text-11 font-semibold uppercase tracking-wider text-slate">
          What this tab will do when shipped
        </p>
        <ul className="mt-3 space-y-2 text-13 text-slate leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            Live Places lookup around <span className="font-medium text-ink">{city || "your city"}</span> filtered by the
            attributes we resolved from your intake (e.g. <span className="font-medium text-ink">{previewOfAttributes(attributes)}</span>).
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            Competitor density heat-map — where existing operators cluster, and where the whitespace is.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            Price-band spread and rating distribution so you can position — premium, mid, or budget.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            Export the shortlist into the pathway (informs premises, signage, and trade-licence steps).
          </li>
        </ul>
      </div>

      <p className="text-11 text-slate-light">
        Business: <span className="font-medium text-slate">{businessLabel || "not set"}</span>. Preview data
        only — no external API is called on this tab yet.
      </p>
    </section>
  );
}

// Cheap category derivation from resolved attributes. Only the shape the
// preview needs; the real feature will use the classifier's business_label
// + a Places category map.
function deriveCategory(attrs: string[]): { key: string; label: string } {
  const has = (a: string) => attrs.includes(a);
  if (has("handles_food") && has("prepares_food_onsite")) return { key: "cafe", label: "Cafe / restaurant" };
  if (has("handles_food") && has("manufactures")) return { key: "food_mfg", label: "Food manufacturing" };
  if (has("trades_goods") && has("customer_premises")) return { key: "retail", label: "Retail store" };
  if (has("services_only") && has("customer_premises")) return { key: "salon", label: "Salon / personal services" };
  if (has("professional_regulated")) return { key: "clinic", label: "Professional services" };
  if (has("services_only")) return { key: "services", label: "Services" };
  return { key: "general", label: "General business" };
}

function previewOfAttributes(attrs: string[]): string {
  const shown = attrs.slice(0, 3).map((a) => a.replace(/_/g, " "));
  if (attrs.length > 3) shown.push(`+${attrs.length - 3} more`);
  return shown.join(", ") || "your attributes";
}

// Small, category-tuned examples so the preview reads plausibly.
function mockCompetitors(cat: { key: string; label: string }, city: string): Array<{
  name: string;
  locality: string;
  distanceKm: number;
  rating: number;
  reviews: number;
  priceLevel: string;
}> {
  const c = city || "Coimbatore";
  if (cat.key === "cafe") {
    return [
      { name: "Third Wave Coffee — RS Puram", locality: `RS Puram, ${c}`, distanceKm: 0.8, rating: 4.3, reviews: 412, priceLevel: "₹₹" },
      { name: "Blue Tokai Roasters", locality: `Race Course, ${c}`, distanceKm: 1.4, rating: 4.5, reviews: 289, priceLevel: "₹₹₹" },
      { name: "Amma Kadai Tiffin", locality: `Peelamedu, ${c}`, distanceKm: 2.2, rating: 4.2, reviews: 638, priceLevel: "₹" },
      { name: "Bakingo Cafe", locality: `Saibaba Colony, ${c}`, distanceKm: 2.9, rating: 4.1, reviews: 174, priceLevel: "₹₹" },
    ];
  }
  if (cat.key === "salon") {
    return [
      { name: "Naturals Unisex Salon", locality: `RS Puram, ${c}`, distanceKm: 1.1, rating: 4.4, reviews: 502, priceLevel: "₹₹" },
      { name: "Green Trends", locality: `Saibaba Colony, ${c}`, distanceKm: 1.7, rating: 4.2, reviews: 341, priceLevel: "₹₹" },
      { name: "Enrich Salon", locality: `Race Course, ${c}`, distanceKm: 2.4, rating: 4.5, reviews: 278, priceLevel: "₹₹₹" },
      { name: "Kalki Ladies Parlour", locality: `Ganapathy, ${c}`, distanceKm: 3.0, rating: 4.0, reviews: 96, priceLevel: "₹" },
    ];
  }
  if (cat.key === "retail") {
    return [
      { name: "Reliance Smart Point", locality: `Peelamedu, ${c}`, distanceKm: 0.9, rating: 4.1, reviews: 812, priceLevel: "₹₹" },
      { name: "Ram Store", locality: `Saibaba Colony, ${c}`, distanceKm: 1.3, rating: 4.3, reviews: 210, priceLevel: "₹" },
      { name: "More Supermarket", locality: `Race Course, ${c}`, distanceKm: 2.1, rating: 4.0, reviews: 411, priceLevel: "₹₹" },
      { name: "Nilgiris Supermarket", locality: `Ganapathy, ${c}`, distanceKm: 2.7, rating: 4.2, reviews: 315, priceLevel: "₹₹" },
    ];
  }
  if (cat.key === "food_mfg") {
    return [
      { name: "Grand Sweets & Snacks", locality: `RS Puram, ${c}`, distanceKm: 1.5, rating: 4.5, reviews: 921, priceLevel: "₹₹" },
      { name: "MTR Foods Depot", locality: `Peelamedu, ${c}`, distanceKm: 2.0, rating: 4.3, reviews: 178, priceLevel: "₹₹" },
      { name: "Sri Krishna Sweets", locality: `Race Course, ${c}`, distanceKm: 2.8, rating: 4.4, reviews: 604, priceLevel: "₹₹" },
    ];
  }
  return [
    { name: "Example Business One", locality: c, distanceKm: 0.9, rating: 4.2, reviews: 132, priceLevel: "₹₹" },
    { name: "Example Business Two", locality: c, distanceKm: 1.6, rating: 4.0, reviews: 89, priceLevel: "₹" },
    { name: "Example Business Three", locality: c, distanceKm: 2.4, rating: 4.4, reviews: 210, priceLevel: "₹₹" },
  ];
}
