import { useState } from "react";

const BRAND = {
  teal: "#0d5c46",
  tealDark: "#0a3d2e",
  gold: "#C9A84C",
  goldLight: "#f0d98a",
  bg: "#f7faf9",
  card: "#ffffff",
  text: "#1a2e26",
  muted: "#6b8c7e",
};

const QUICK_TAGS = [
  "Dal Makhani", "Paneer Butter Masala", "Aloo Paratha",
  "Chole Bhature", "Rajma Chawal", "Palak Paneer",
  "Biryani", "Idli Sambar", "Poha", "Upma",
];

const FILTERS = [
  { label: "Quick (30 min)", value: "quick easy 30 minutes" },
  { label: "Healthy", value: "healthy low calorie" },
  { label: "Kids Friendly", value: "kids friendly toddler" },
  { label: "No Onion Garlic", value: "no onion no garlic jain" },
];

const SITES = [
  { label: "Any", value: "" },
  { label: "Hebbars Kitchen", value: "hebbarskitchen.com" },
  { label: "Archana's Kitchen", value: "archanaskitchen.com" },
  { label: "Vegrecipesofindia", value: "vegrecipesofindia.com" },
  { label: "YouTube", value: "youtube.com" },
];

export default function RecipeSearch() {
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [activeSite, setActiveSite] = useState("");

  const toggleFilter = (val) => {
    setActiveFilters((prev) =>
      prev.includes(val) ? prev.filter((f) => f !== val) : [...prev, val]
    );
  };

  const buildSearchURL = (meal) => {
    const base = meal || query;
    if (!base.trim()) return null;
    let q = `${base.trim()} recipe`;
    if (activeFilters.length > 0) q += " " + activeFilters.join(" ");
    if (activeSite) q = `site:${activeSite} ${q}`;
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  };

  const handleSearch = (meal) => {
    const url = buildSearchURL(meal);
    if (url) window.open(url, "_blank");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div style={{
      fontFamily: "'Georgia', serif",
      background: BRAND.bg,
      minHeight: "100vh",
      padding: "24px 16px",
      color: BRAND.text,
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${BRAND.tealDark}, ${BRAND.teal})`,
        borderRadius: 16,
        padding: "24px 20px",
        marginBottom: 24,
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(10,61,46,0.18)",
      }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🔍</div>
        <h1 style={{
          margin: 0,
          fontSize: 22,
          fontWeight: "bold",
          color: BRAND.gold,
          letterSpacing: 0.5,
        }}>Recipe Search</h1>
        <p style={{
          margin: "6px 0 0",
          color: "rgba(255,255,255,0.75)",
          fontSize: 13,
          fontFamily: "sans-serif",
        }}>Find any recipe on Google in one tap</p>
      </div>

      {/* Search Box */}
      <div style={{
        background: BRAND.card,
        borderRadius: 14,
        padding: 20,
        marginBottom: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        border: `1px solid rgba(10,61,46,0.08)`,
      }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Dal Tadka, Khichdi..."
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1.5px solid ${BRAND.teal}33`,
              fontSize: 15,
              fontFamily: "sans-serif",
              color: BRAND.text,
              background: BRAND.bg,
              outline: "none",
            }}
          />
          <button
            onClick={() => handleSearch()}
            style={{
              background: BRAND.teal,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px 18px",
              fontSize: 18,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >🔍</button>
        </div>

        {/* Filters */}
        <div style={{ marginTop: 14 }}>
          <p style={{
            fontSize: 11,
            fontFamily: "sans-serif",
            color: BRAND.muted,
            margin: "0 0 8px",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}>Filters</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FILTERS.map((f) => {
              const active = activeFilters.includes(f.value);
              return (
                <button
                  key={f.value}
                  onClick={() => toggleFilter(f.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontFamily: "sans-serif",
                    cursor: "pointer",
                    border: `1.5px solid ${active ? BRAND.gold : BRAND.teal + "44"}`,
                    background: active ? BRAND.gold + "22" : "transparent",
                    color: active ? BRAND.tealDark : BRAND.muted,
                    fontWeight: active ? "bold" : "normal",
                    transition: "all 0.15s",
                  }}
                >
                  {active ? "✓ " : ""}{f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Site Selector */}
        <div style={{ marginTop: 14 }}>
          <p style={{
            fontSize: 11,
            fontFamily: "sans-serif",
            color: BRAND.muted,
            margin: "0 0 8px",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}>Search On</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SITES.map((s) => {
              const active = activeSite === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setActiveSite(s.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontFamily: "sans-serif",
                    cursor: "pointer",
                    border: `1.5px solid ${active ? BRAND.teal : BRAND.teal + "33"}`,
                    background: active ? BRAND.teal : "transparent",
                    color: active ? "#fff" : BRAND.muted,
                    fontWeight: active ? "bold" : "normal",
                    transition: "all 0.15s",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Picks */}
      <div style={{
        background: BRAND.card,
        borderRadius: 14,
        padding: 20,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        border: `1px solid rgba(10,61,46,0.08)`,
      }}>
        <p style={{
          fontSize: 11,
          fontFamily: "sans-serif",
          color: BRAND.muted,
          margin: "0 0 12px",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>⚡ Quick Search</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {QUICK_TAGS.map((meal) => (
            <button
              key={meal}
              onClick={() => handleSearch(meal)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderRadius: 10,
                border: `1px solid ${BRAND.teal}22`,
                background: BRAND.bg,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = BRAND.teal + "11";
                e.currentTarget.style.borderColor = BRAND.teal + "55";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = BRAND.bg;
                e.currentTarget.style.borderColor = BRAND.teal + "22";
              }}
            >
              <span style={{
                fontSize: 14,
                fontFamily: "sans-serif",
                color: BRAND.text,
              }}>🍽️ {meal}</span>
              <span style={{
                fontSize: 18,
                color: BRAND.gold,
              }}>→</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p style={{
        textAlign: "center",
        fontSize: 11,
        fontFamily: "sans-serif",
        color: BRAND.muted,
        marginTop: 20,
      }}>Family OS · Simayank Forever 🏠</p>
    </div>
  );
}
