const { useState, useEffect, useCallback, useMemo, useRef } = React;
const SHEETS_CONFIG = {
  scents: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpVsy-YJvA2ypDOGGv1Zh2KbswjMf0gxJHHvCb2_xaMKltGfad2LtjHf208-28mcffldVw6Cay-RgG/pub?gid=0&single=true&output=csv",
  bases: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpVsy-YJvA2ypDOGGv1Zh2KbswjMf0gxJHHvCb2_xaMKltGfad2LtjHf208-28mcffldVw6Cay-RgG/pub?gid=874764417&single=true&output=csv",
  packaging: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpVsy-YJvA2ypDOGGv1Zh2KbswjMf0gxJHHvCb2_xaMKltGfad2LtjHf208-28mcffldVw6Cay-RgG/pub?gid=1964339911&single=true&output=csv",
  editScents: "https://docs.google.com/spreadsheets/d/18EqvZ4xcSEd1l1fhUniO-Q_Agjc3C5MXVuU1nXsgpTI/edit?gid=0#gid=0",
  editBases: "https://docs.google.com/spreadsheets/d/18EqvZ4xcSEd1l1fhUniO-Q_Agjc3C5MXVuU1nXsgpTI/edit?gid=874764417#gid=874764417",
  editPackaging: "https://docs.google.com/spreadsheets/d/18EqvZ4xcSEd1l1fhUniO-Q_Agjc3C5MXVuU1nXsgpTI/edit?gid=1964339911#gid=1964339911"
};
function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (vals[i] || "").trim();
    });
    return obj;
  });
}
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}
function rowToScent(r) {
  return {
    name: r.name,
    type: r.type || "FO",
    family: r.family || "",
    note: r.note || "",
    profile: r.profile || "",
    masculine: parseInt(r.masculine) || 3,
    ifra: {
      "2": parseFloat(r.ifra_2) || 0,
      "4": parseFloat(r.ifra_4) || 0,
      "5A": parseFloat(r.ifra_5A) || 0,
      "5B": parseFloat(r.ifra_5B) || 0,
      "5C": parseFloat(r.ifra_5C) || 0,
      "7B": parseFloat(r.ifra_7B) || 0,
      "9": parseFloat(r.ifra_9) || 0
    },
    ifraSource: r.ifra_source || "estimated",
    pricePer100ml: r.price_per_ml ? (parseFloat(r.price_eur) || 0) / (parseFloat(r.price_per_ml) || 100) * 100 : parseFloat(r.price_eur) || 0,
    priceRaw: parseFloat(r.price_eur) || 0,
    priceSize: parseFloat(r.price_per_ml) || 100,
    url: r.url || ""
  };
}
function rowToBase(r) {
  return {
    name: r.name,
    inci: r.inci || "",
    role: r.role || "carrier",
    maxPct: parseFloat(r.max_pct) || 100,
    defaultPct: parseFloat(r.default_pct) || 5,
    notes: r.notes || "",
    youwish: true,
    products: Object.keys(PRODUCTS),
    pricePer100: r.price_per_ml ? (parseFloat(r.price_eur) || 0) / (parseFloat(r.price_per_ml) || 100) * 100 : parseFloat(r.price_eur) || 0,
    priceRaw: parseFloat(r.price_eur) || 0,
    priceSize: parseFloat(r.price_per_ml) || 100,
    url: r.url || ""
  };
}
const store = {
  get: async (k) => {
    try {
      const v = localStorage.getItem(k);
      return v ? { value: v } : null;
    } catch (e) {
      return null;
    }
  },
  set: async (k, v) => {
    try {
      localStorage.setItem(k, v);
      return { key: k, value: v };
    } catch (e) {
      return null;
    }
  }
};
const DROP_ML = 0.05;
const IFRA_CAT_ORDER = ["2", "4", "5A", "5B", "5C", "7B", "9"];
const IFRA_CATS = {
  "2": { label: "Body Spray / Deodorant", ex: "Body Spray, Deodorant Spray" },
  "4": { label: "Fine Fragrance / Solid Cologne", ex: "EDT, EDP, Perfume, Aftershave, Solid Perfume, Solid Cologne" },
  "5A": { label: "Body Lotion (Leave-on)", ex: "Body Butter, Body Oil, Sunscreen Body" },
  "5B": { label: "Face & Beard (Leave-on)", ex: "Beard Oil, Face Moisturizer, Facial Toner" },
  "5C": { label: "Hand Cream (Leave-on)", ex: "Hand Cream, Hand Sanitizer, Nail Care" },
  "7B": { label: "Hair Styling (Leave-on)", ex: "Pomade, Hair Gel, Mousse, Leave-on Conditioner" },
  "9": { label: "Soap & Rinse-off", ex: "Bar Soap, Shampoo, Body Wash, Bath Bombs" }
};
const PRODUCTS = {
  beard_oil: { name: "Beard Oil", cat: "5B", test: 10, tU: "ml", prod: 100, pU: "ml" },
  pomade: { name: "Pomade", cat: "7B", test: 50, tU: "g", prod: 500, pU: "g" },
  perfume_edp: { name: "Perfume (EDP)", cat: "4", test: 10, tU: "ml", prod: 100, pU: "ml" },
  perfume_edt: { name: "Perfume (EDT)", cat: "4", test: 10, tU: "ml", prod: 100, pU: "ml" },
  solid_cologne: { name: "Solid Cologne", cat: "4", test: 15, tU: "g", prod: 150, pU: "g" },
  aftershave: { name: "Aftershave", cat: "4", test: 10, tU: "ml", prod: 100, pU: "ml" },
  soap_bar: { name: "Soap (Bar)", cat: "9", test: 500, tU: "g", prod: 5e3, pU: "g" },
  body_lotion: { name: "Body Lotion", cat: "5A", test: 50, tU: "ml", prod: 500, pU: "ml" },
  hand_cream: { name: "Hand Cream", cat: "5C", test: 50, tU: "g", prod: 500, pU: "g" },
  body_wash: { name: "Body Wash", cat: "9", test: 100, tU: "ml", prod: 1e3, pU: "ml" },
  shampoo: { name: "Shampoo", cat: "9", test: 100, tU: "ml", prod: 1e3, pU: "ml" }
};
let SCENTS = [];
let BASES = [];
let PACKAGING_ITEMS = [];
function rowToPackaging(r) {
  return {
    name: r.name || "",
    description: r.description || "",
    category: r.category || "container",
    price_eur: parseFloat(r.price_eur) || 0,
    per_unit: r.per_unit || "piece",
    for_product: r.for_product || "all",
    url: r.url || "",
    notes: r.notes || ""
  };
}
const gold = "#ebb54a";
const bg = "#192d44";
const bgCard = "#1e3550";
const bgInput = "#152538";
const border = "#2a4a6a";
const textMain = "#ffffff";
const textMuted = "#8aa4be";
const textDim = "#5d7a96";
const ok = "#6abf6a";
const warn = "#e8a735";
const danger = "#e55555";
const inp = { background: bgInput, border: `1px solid ${border}`, borderRadius: 6, padding: "7px 10px", color: textMain, fontSize: 13, fontFamily: "'Open Sans',sans-serif", outline: "none", width: "100%", boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 10, color: textMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, fontFamily: "'Open Sans',sans-serif" };
const card = { background: bgCard, borderRadius: 10, border: `1px solid ${border}`, padding: "14px 16px", marginBottom: 12 };
const btn = { border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'Open Sans',sans-serif" };
const TypeBadge = ({ t }) => {
  const c = { EO: "#4a9c5a", FO: "#b89a4a", CO2: "#7a6a9c", ABS: "#9c5a7a" }[t] || "#666";
  const l = { EO: "Essential", FO: "Fragrance", CO2: "CO\u2082", ABS: "Absolute" }[t] || t;
  return /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9, padding: "1px 6px", borderRadius: 4, background: c + "25", color: c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'Open Sans',sans-serif" } }, l);
};
const Dots = ({ n, max = 5 }) => /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, letterSpacing: 1 } }, Array.from({ length: max }, (_, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: { color: i < n ? gold : textDim } }, "\u25CF")));
const Warn = ({ children }) => /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 12px", borderRadius: 8, background: "#2a1520", border: `1px solid ${danger}40`, fontSize: 12, color: "#f0a0a0", marginTop: 8, fontFamily: "'Open Sans',sans-serif" } }, children);
const Ok = ({ children }) => /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 12px", borderRadius: 8, background: "#152a18", border: `1px solid ${ok}40`, fontSize: 12, color: "#a0d0a0", marginTop: 8, fontFamily: "'Open Sans',sans-serif" } }, children);
const Pill = ({ color = textMuted, bg: pbg = bgInput, children }) => /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, padding: "2px 8px", borderRadius: 10, background: pbg, color, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Open Sans',sans-serif" } }, children);
function App() {
  const [tab, setTab] = useState("dashboard");
  const [recipes, setRecipes] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await store.get("bb-recipes");
        if (r?.value) setRecipes(JSON.parse(r.value));
      } catch (e) {
      }
    })();
  }, []);
  const save = useCallback(async (r) => {
    setRecipes(r);
    try {
      await store.set("bb-recipes", JSON.stringify(r));
    } catch (e) {
      console.error(e);
    }
  }, []);
  const tabs = [{ id: "dashboard", icon: "\u{1F3E0}", label: "Dashboard" }, { id: "library", icon: "\u{1F9F4}", label: "Scents" }, { id: "ingredients", icon: "\u{1F9EA}", label: "Base" }, { id: "packaging", icon: "\u{1F4E6}", label: "Packaging" }, { id: "builder", icon: "\u2697\uFE0F", label: "Product Builder" }, { id: "recipes", icon: "\u{1F4CB}", label: "Products" }, { id: "production", icon: "\u{1F3ED}", label: "Production" }, { id: "costs", icon: "\u{1F4B0}", label: "Costs / Profit" }];
  return /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Open Sans',sans-serif", background: bg, color: textMain, minHeight: "100vh" } }, /* @__PURE__ */ React.createElement("link", { href: "https://fonts.googleapis.com/css2?family=Odibee+Sans&family=Open+Sans:wght@300;400;500;600;700&display=swap", rel: "stylesheet" }), /* @__PURE__ */ React.createElement("div", { style: { borderBottom: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "14px 16px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { onClick: () => setTab("dashboard"), style: { fontFamily: "'Odibee Sans',cursive", fontSize: 26, color: "#ffffff", letterSpacing: 3, textTransform: "uppercase", lineHeight: 1, cursor: "pointer" } }, "BOEGBEELD"), /* @__PURE__ */ React.createElement("div", { style: { height: 20, width: 1, background: border } }), /* @__PURE__ */ React.createElement("div", { onClick: () => setTab("dashboard"), style: { fontFamily: "'Odibee Sans',cursive", fontSize: 18, color: gold, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" } }, "Creation Lab")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, overflowX: "auto" } }, tabs.map((t) => /* @__PURE__ */ React.createElement("button", { key: t.id, onClick: () => setTab(t.id), style: { padding: "8px 16px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${gold}` : "2px solid transparent", color: tab === t.id ? gold : "#ffffff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Open Sans',sans-serif", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", transition: "all 0.2s" } }, /* @__PURE__ */ React.createElement("span", null, t.icon), t.label, t.id === "recipes" && recipes.length > 0 && /* @__PURE__ */ React.createElement("span", { style: { background: gold + "30", color: gold, borderRadius: 10, padding: "0 5px", fontSize: 10, marginLeft: 2 } }, recipes.length)))))), /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "12px 16px 40px" } }, tab === "dashboard" && /* @__PURE__ */ React.createElement(Dashboard, { recipes, setTab }), tab === "library" && /* @__PURE__ */ React.createElement(Library, null), tab === "ingredients" && /* @__PURE__ */ React.createElement(IngredientsLib, null), tab === "packaging" && /* @__PURE__ */ React.createElement(Packaging, null), tab === "builder" && /* @__PURE__ */ React.createElement(Builder, { recipes, save, goRecipes: () => setTab("recipes"), editingProduct, clearEdit: () => setEditingProduct(null) }), tab === "recipes" && /* @__PURE__ */ React.createElement(Recipes, { recipes, save, goBuilder: () => setTab("builder"), onEdit: (r) => {
    setEditingProduct(r);
    setTab("builder");
  } }), tab === "production" && /* @__PURE__ */ React.createElement(Production, { recipes, save }), tab === "costs" && /* @__PURE__ */ React.createElement(CostCalc, { recipes, save })));
}
function Dashboard({ recipes, setTab }) {
  const verifiedScents = SCENTS.filter((s) => s.ifraSource === "verified").length;
  const urlVerifiedScents = SCENTS.filter((s) => s.ifraSource === "url_verified").length;
  const estimatedScents = SCENTS.length - verifiedScents - urlVerifiedScents;
  const basesWithPrice = BASES.filter((b) => b.pricePer100 && b.pricePer100 > 0).length;
  const basesWithUrl = BASES.filter((b) => b.url && b.url.includes("youwish.nl/en/shop")).length;
  const latestProduct = recipes.length > 0 ? recipes[recipes.length - 1] : null;
  const statCard = (icon, label, value, sub, onClick) => /* @__PURE__ */ React.createElement("div", { onClick, style: { padding: "16px 20px", background: bgCard, borderRadius: 10, border: `1px solid ${border}`, cursor: onClick ? "pointer" : "default", transition: "border .2s" }, onMouseEnter: (e) => {
    if (onClick) e.currentTarget.style.borderColor = gold;
  }, onMouseLeave: (e) => e.currentTarget.style.borderColor = border }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 24, marginBottom: 4 } }, icon), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 28 } }, value), /* @__PURE__ */ React.createElement("div", { style: { color: textMain, fontSize: 12, fontWeight: 600 } }, label), sub && /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, marginTop: 2 } }, sub));
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 20 } }, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 24, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Dashboard"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12 } }, "Overview of your Creation Lab. Click any card to jump to that section.")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 20 } }, statCard("\u{1F9F4}", "Scents", SCENTS.length, `${verifiedScents} verified, ${urlVerifiedScents} URL ok, ${estimatedScents} to check`, () => setTab("library")), statCard("\u{1F9EA}", "Base Ingredients", BASES.length, "Carrier oils, waxes, actives", () => setTab("ingredients")), statCard("\u{1F4E6}", "Packaging", PACKAGING_ITEMS.length, PACKAGING_ITEMS.length > 0 ? "Items loaded from Sheet" : "Add items in Google Sheet", () => setTab("packaging")), statCard("\u{1F4CB}", "Products", recipes.length, recipes.length > 0 ? recipes.map((r) => r.name).join(", ") : "Build your first product", () => setTab(recipes.length > 0 ? "recipes" : "builder"))), latestProduct && /* @__PURE__ */ React.createElement("div", { style: { ...card, border: `1px solid ${gold}30`, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: textMuted, textTransform: "uppercase", letterSpacing: 1 } }, "Latest Product"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Open Sans',sans-serif", color: gold, fontSize: 16, fontWeight: 700, marginTop: 2 } }, latestProduct.name), /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 11, marginTop: 2 } }, latestProduct.productName, " \xB7 Cat ", latestProduct.category, " \xB7 ", latestProduct.batchSize, latestProduct.batchUnit, " \xB7 ", latestProduct.totalPct, "% formula"), /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 11, marginTop: 2 } }, latestProduct.bases?.length || 0, " base ingredients \xB7 ", latestProduct.scents?.length || 0, " scents \xB7 ", latestProduct.packaging?.length || 0, " packaging items")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("costs"), style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 10 } }, "\u{1F4B0} View Costs"), /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("production"), style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 10 } }, "\u{1F3ED} Production")))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12, marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 15, marginBottom: 8, letterSpacing: 1 } }, "SCENT VERIFICATION (", SCENTS.length, " total)"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 } }, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "IFRA Verified"), /* @__PURE__ */ React.createElement("span", { style: { color: ok, fontWeight: 600 } }, verifiedScents)), /* @__PURE__ */ React.createElement("div", { style: { height: 4, borderRadius: 2, background: bgInput, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { height: "100%", borderRadius: 2, background: ok, width: `${SCENTS.length > 0 ? verifiedScents / SCENTS.length * 100 : 0}%` } }))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 } }, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "URL Confirmed (IFRA needs check)"), /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontWeight: 600 } }, urlVerifiedScents)), /* @__PURE__ */ React.createElement("div", { style: { height: 4, borderRadius: 2, background: bgInput, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { height: "100%", borderRadius: 2, background: gold, width: `${SCENTS.length > 0 ? urlVerifiedScents / SCENTS.length * 100 : 0}%` } }))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 } }, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "Unverified (URL + IFRA need check)"), /* @__PURE__ */ React.createElement("span", { style: { color: warn, fontWeight: 600 } }, estimatedScents)), /* @__PURE__ */ React.createElement("div", { style: { height: 4, borderRadius: 2, background: bgInput, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { height: "100%", borderRadius: 2, background: warn, width: `${SCENTS.length > 0 ? estimatedScents / SCENTS.length * 100 : 0}%` } }))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, paddingTop: 8, borderTop: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 13, marginBottom: 6, letterSpacing: 1 } }, "BASE INGREDIENTS (", BASES.length, " total)"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 } }, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "With price data"), /* @__PURE__ */ React.createElement("span", { style: { color: ok, fontWeight: 600 } }, basesWithPrice, " / ", BASES.length)), /* @__PURE__ */ React.createElement("div", { style: { height: 4, borderRadius: 2, background: bgInput, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { height: "100%", borderRadius: 2, background: ok, width: `${BASES.length > 0 ? basesWithPrice / BASES.length * 100 : 0}%` } }))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 } }, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "With direct product URL"), /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontWeight: 600 } }, basesWithUrl, " / ", BASES.length)), /* @__PURE__ */ React.createElement("div", { style: { height: 4, borderRadius: 2, background: bgInput, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { height: "100%", borderRadius: 2, background: gold, width: `${BASES.length > 0 ? basesWithUrl / BASES.length * 100 : 0}%` } }))))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 15, marginBottom: 8, letterSpacing: 1 } }, "QUICK ACTIONS"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("builder"), style: { ...btn, background: `${gold}15`, color: gold, border: `1px solid ${gold}30`, textAlign: "left", padding: "8px 12px", fontSize: 12 } }, "\u2697\uFE0F Build New Product"), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editScents, target: "_blank", rel: "noopener noreferrer", style: { ...btn, background: bgInput, color: textMain, border: `1px solid ${border}`, textAlign: "left", padding: "8px 12px", fontSize: 12, textDecoration: "none" } }, "\u{1F4DD} Edit Scents in Google Sheet"), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editBases, target: "_blank", rel: "noopener noreferrer", style: { ...btn, background: bgInput, color: textMain, border: `1px solid ${border}`, textAlign: "left", padding: "8px 12px", fontSize: 12, textDecoration: "none" } }, "\u{1F4DD} Edit Base Ingredients in Sheet"), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editPackaging, target: "_blank", rel: "noopener noreferrer", style: { ...btn, background: bgInput, color: textMain, border: `1px solid ${border}`, textAlign: "left", padding: "8px 12px", fontSize: 12, textDecoration: "none" } }, "\u{1F4DD} Edit Packaging in Sheet")))), /* @__PURE__ */ React.createElement("div", { style: { ...card, background: bgInput, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 15, marginBottom: 6, letterSpacing: 1 } }, "HOW IT WORKS"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: textMuted, lineHeight: 1.8 } }, /* @__PURE__ */ React.createElement("strong", { style: { color: textMain } }, "1. Ingredients"), " \u2014 Scents, base ingredients, and packaging are loaded from your Google Sheet. Edit prices and add items there.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", { style: { color: textMain } }, "2. Build"), " \u2014 Use the Product Builder to create formulations. Base \u2192 Scent \u2192 Packaging. IFRA limits are enforced.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", { style: { color: textMain } }, "3. Save & Export"), " \u2014 Save products, export to CSV for Google Sheets, or JSON for backup.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", { style: { color: textMain } }, "4. Produce"), " \u2014 Scale any product to production quantities in the Production tab.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", { style: { color: textMain } }, "5. Calculate"), " \u2014 See full cost breakdown with margins in Costs / Profit. All prices excl. 21% BTW.")));
}
function Library() {
  const [q, setQ] = useState("");
  const [tf, setTf] = useState("all");
  const [ff, setFf] = useState("all");
  const [mf, setMf] = useState(0);
  const [cv, setCv] = useState("all");
  const [exp, setExp] = useState(null);
  const [customs, setCustoms] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await store.get("bb-custom-scents");
        if (r?.value) setCustoms(JSON.parse(r.value));
      } catch (e) {
      }
      try {
        const r = await store.get("bb-scent-overrides");
        if (r?.value) setOverrides(JSON.parse(r.value));
      } catch (e) {
      }
    })();
  }, []);
  const saveCustoms = async (c) => {
    setCustoms(c);
    try {
      await store.set("bb-custom-scents", JSON.stringify(c));
    } catch (e) {
    }
  };
  const saveOverrides = async (o) => {
    setOverrides(o);
    try {
      await store.set("bb-scent-overrides", JSON.stringify(o));
    } catch (e) {
    }
  };
  const setOverride = (name, field, val) => {
    const o = { ...overrides, [name]: { ...overrides[name] || {}, [field]: val } };
    saveOverrides(o);
  };
  const getScent = (s) => {
    const ov = overrides[s.name] || {};
    return { ...s, url: ov.url || s.url || null, ifra: ov.ifra ? { ...s.ifra, ...ov.ifra } : s.ifra, pricePer100ml: ov.pricePer100ml || (s.type === "FO" ? 29.5 : s.type === "CO2" ? 45 : 25), priceSize: ov.priceSize || 100, ifraSource: ov.ifraVerified ? "verified" : s.ifraSource };
  };
  const allScents = [...SCENTS, ...customs].map(getScent);
  const families = useMemo(() => [...new Set(allScents.map((s) => s.family.split(" / ")[0]))].sort(), [customs]);
  const filtered = useMemo(() => allScents.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.profile.toLowerCase().includes(q.toLowerCase()) && !s.family.toLowerCase().includes(q.toLowerCase())) return false;
    if (tf !== "all" && s.type !== tf) return false;
    if (ff !== "all" && !s.family.startsWith(ff)) return false;
    if (mf > 0 && s.masculine < mf) return false;
    return true;
  }), [q, tf, ff, mf, customs]);
  const scentUrl = (name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
    return `https://www.youwish.nl/en/?s=${encodeURIComponent(name)}&post_type=product`;
  };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Scent Library ", /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: textMuted, fontFamily: "'Open Sans'", letterSpacing: 0, textTransform: "none" } }, "(", allScents.length, " scents)")), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12, margin: "0 0 12px" } }, "All prices excl. BTW. Click any row to expand IFRA details."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search scent, profile, family...", style: { ...inp, flex: "1 1 180px", minWidth: 150 } }), /* @__PURE__ */ React.createElement("select", { value: tf, onChange: (e) => setTf(e.target.value), style: { ...inp, width: 130 } }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Types"), /* @__PURE__ */ React.createElement("option", { value: "EO" }, "Essential Oil"), /* @__PURE__ */ React.createElement("option", { value: "FO" }, "Fragrance Oil"), /* @__PURE__ */ React.createElement("option", { value: "CO2" }, "CO\u2082 Extract")), /* @__PURE__ */ React.createElement("select", { value: ff, onChange: (e) => setFf(e.target.value), style: { ...inp, width: 140 } }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Families"), families.map((f) => /* @__PURE__ */ React.createElement("option", { key: f, value: f }, f))), /* @__PURE__ */ React.createElement("select", { value: mf, onChange: (e) => setMf(+e.target.value), style: { ...inp, width: 140 } }, /* @__PURE__ */ React.createElement("option", { value: 0 }, "Any Masculinity"), /* @__PURE__ */ React.createElement("option", { value: 3 }, "3+ Unisex-Masc"), /* @__PURE__ */ React.createElement("option", { value: 4 }, "4+ Masculine"), /* @__PURE__ */ React.createElement("option", { value: 5 }, "5 Very Masculine")), /* @__PURE__ */ React.createElement("select", { value: cv, onChange: (e) => setCv(e.target.value), style: { ...inp, width: 200, background: cv !== "all" ? `${gold}15` : bgInput, borderColor: cv !== "all" ? gold : border } }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Categories (no filter)"), IFRA_CAT_ORDER.map((k) => /* @__PURE__ */ React.createElement("option", { key: k, value: k }, "Cat ", k, ": ", IFRA_CATS[k].label))), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editScents, target: "_blank", rel: "noopener noreferrer", style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 } }, "+ Add in Google Sheet")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, marginBottom: 8 } }, "Showing ", /* @__PURE__ */ React.createElement("strong", { style: { color: textMain } }, filtered.length), cv !== "all" && /* @__PURE__ */ React.createElement(React.Fragment, null, " \u2014 Max % for ", /* @__PURE__ */ React.createElement("strong", { style: { color: gold } }, "Cat ", cv), " (", IFRA_CATS[cv].label, ")")), /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Name", "Type", "Family", "Note", cv !== "all" ? "IFRA Max %" : "IFRA", "Masculinity", "Links"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "6px 8px", textAlign: "left", color: textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((s, i) => {
    const mx = cv !== "all" ? s.ifra[cv] || 0 : null;
    const open = exp === s.name;
    const url = s.url || scentUrl(s.name);
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: s.name }, /* @__PURE__ */ React.createElement("tr", { onClick: () => setExp(open ? null : s.name), style: { borderBottom: `1px solid ${border}30`, cursor: "pointer", background: open ? bgCard : "transparent", transition: "background .15s" }, onMouseEnter: (e) => {
      if (!open) e.currentTarget.style.background = `${bg}ee`;
    }, onMouseLeave: (e) => {
      if (!open) e.currentTarget.style.background = "transparent";
    } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", fontWeight: 600, maxWidth: 200 } }, s.name, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 8, marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: s.ifraSource === "verified" ? `${ok}15` : `${warn}10`, color: s.ifraSource === "verified" ? ok : warn } }, s.ifraSource === "verified" ? "\u2713" : "est")), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px" } }, /* @__PURE__ */ React.createElement(TypeBadge, { t: s.type })), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted, fontSize: 11 } }, s.family), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted, fontSize: 11 } }, s.note), cv !== "all" && /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: mx === 0 ? danger : mx < 1 ? warn : ok, fontWeight: 600 } }, mx === 0 ? "\u26D4" : "" + mx + "%")), cv === "all" && /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textDim } }, "\u2014"), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px" } }, /* @__PURE__ */ React.createElement(Dots, { n: s.masculine })), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 4px" } }, /* @__PURE__ */ React.createElement("a", { href: url, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), style: { color: gold, fontSize: 10, textDecoration: "none", opacity: 0.7 } }, "\u{1F517}"))), open && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: 7, style: { padding: "0 8px 8px", background: bgCard } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", borderRadius: 8, background: bgInput, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMain, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("strong", { style: { color: gold } }, "Profile:"), " ", s.profile), s.inci && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, marginBottom: 8, fontStyle: "italic" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: gold } }, "INCI:"), " ", s.inci), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, padding: "2px 6px", borderRadius: 4, background: s.ifraSource === "verified" ? `${ok}20` : `${warn}20`, color: s.ifraSource === "verified" ? ok : warn, fontWeight: 600 } }, "IFRA: ", s.ifraSource === "verified" ? "[x] Verified" : "\u26A0 Estimated"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: textDim } }, "\u20AC", (s.pricePer100ml || 0).toFixed(2), "/100ml"), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editScents, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), style: { ...btn, fontSize: 10, color: gold, background: "transparent", border: `1px solid ${gold}30`, padding: "2px 8px", textDecoration: "none" } }, "\u{1F4DD} Edit in Sheet")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 } }, IFRA_CAT_ORDER.map((cat) => {
      const v = s.ifra[cat] || 0;
      return /* @__PURE__ */ React.createElement("div", { key: cat, style: { padding: "3px 8px", borderRadius: 5, background: cv === cat ? `${gold}15` : bgCard, border: `1px solid ${cv === cat ? gold : border}`, fontSize: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "Cat ", cat, ":"), " ", /* @__PURE__ */ React.createElement("span", { style: { color: v === 0 ? danger : gold, fontWeight: 600 } }, v === 0 ? "\u26D4" : v + "%"));
    })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("a", { href: s.url || scentUrl(s.name), target: "_blank", rel: "noopener noreferrer", style: { color: gold, fontSize: 11, textDecoration: "underline" } }, "View at supplier \u2192"), s.custom && /* @__PURE__ */ React.createElement("button", { onClick: () => saveCustoms(customs.filter((c) => c.name !== s.name)), style: { ...btn, color: danger, background: "transparent", border: `1px solid ${danger}30`, fontSize: 10 } }, "Remove"))))));
  })))));
}
function IngredientsLib() {
  const [q, setQ] = useState("");
  const [rf, setRf] = useState("all");
  const [exp, setExp] = useState(null);
  const [customs, setCustoms] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nName, setNName] = useState("");
  const [nInci, setNInci] = useState("");
  const [nRole, setNRole] = useState("carrier");
  const [nUrl, setNUrl] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await store.get("bb-custom-bases");
        if (r?.value) setCustoms(JSON.parse(r.value));
      } catch (e) {
      }
      try {
        const r = await store.get("bb-base-overrides");
        if (r?.value) setOverrides(JSON.parse(r.value));
      } catch (e) {
      }
    })();
  }, []);
  const saveCustoms = async (c) => {
    setCustoms(c);
    try {
      await store.set("bb-custom-bases", JSON.stringify(c));
    } catch (e) {
    }
  };
  const saveOverrides = async (o) => {
    setOverrides(o);
    try {
      await store.set("bb-base-overrides", JSON.stringify(o));
    } catch (e) {
    }
  };
  const setOverride = (name, field, val) => {
    const o = { ...overrides, [name]: { ...overrides[name] || {}, [field]: val } };
    saveOverrides(o);
  };
  const getBase = (b) => {
    const ov = overrides[b.name] || {};
    return { ...b, url: ov.url || b.url || null, maxPct: ov.maxPct || b.maxPct, pricePer100: ov.pricePer100 || (b.role === "carrier" ? 8 : b.role === "wax" ? 12 : b.role === "emulsifier" ? 15 : b.role === "solvent" ? 2 : 10), priceSize: ov.priceSize || 100 };
  };
  const allBases = [...BASES, ...customs].map(getBase);
  const roles = [...new Set(allBases.map((b) => b.role))].sort();
  const filtered = allBases.filter((b) => {
    if (q && !b.name.toLowerCase().includes(q.toLowerCase()) && !b.inci.toLowerCase().includes(q.toLowerCase())) return false;
    if (rf !== "all" && b.role !== rf) return false;
    return true;
  });
  const baseUrl = (name) => `https://www.youwish.nl/en/?s=${encodeURIComponent(name)}&post_type=product`;
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Base Ingredients ", /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: textMuted, fontFamily: "'Open Sans'", letterSpacing: 0, textTransform: "none" } }, "(", allBases.length, ")")), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12, margin: "0 0 12px" } }, "All prices excl. BTW. Click to expand details."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search ingredient or INCI...", style: { ...inp, flex: "1 1 200px" } }), /* @__PURE__ */ React.createElement("select", { value: rf, onChange: (e) => setRf(e.target.value), style: { ...inp, width: 150 } }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Roles"), roles.map((r) => /* @__PURE__ */ React.createElement("option", { key: r, value: r }, r))), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editBases, target: "_blank", rel: "noopener noreferrer", style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 } }, "+ Add in Google Sheet")), /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Name", "INCI", "Role", "Max %", "Products", "Links"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "6px 8px", textAlign: "left", color: textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((b) => {
    const open = exp === b.name;
    const url = b.url || baseUrl(b.name);
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: b.name }, /* @__PURE__ */ React.createElement("tr", { onClick: () => setExp(open ? null : b.name), style: { borderBottom: `1px solid ${border}30`, cursor: "pointer", background: open ? bgCard : "transparent", transition: "background .15s" }, onMouseEnter: (e) => {
      if (!open) e.currentTarget.style.background = `${bg}ee`;
    }, onMouseLeave: (e) => {
      if (!open) e.currentTarget.style.background = "transparent";
    } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", fontWeight: 600 } }, b.name, b.custom && /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontSize: 9, marginLeft: 4 } }, "\u270E")), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted, fontSize: 11, fontStyle: "italic" } }, b.inci), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${gold}15`, color: gold, fontWeight: 600, textTransform: "uppercase" } }, b.role)), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted } }, b.maxPct, "%"), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textDim, fontSize: 10 } }, (b.products || []).map((p) => PRODUCTS[p]?.name).filter(Boolean).slice(0, 3).join(", "), (b.products || []).length > 3 ? "..." : ""), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 4px" } }, /* @__PURE__ */ React.createElement("a", { href: url, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), style: { color: gold, fontSize: 10, textDecoration: "none", opacity: 0.7 } }, "\u{1F517}"))), open && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: 6, style: { padding: "0 8px 8px", background: bgCard } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", borderRadius: 8, background: bgInput, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMain, marginBottom: 6 } }, /* @__PURE__ */ React.createElement("strong", { style: { color: gold } }, "Notes:"), " ", b.notes), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, marginBottom: 6 } }, "Default %: ", b.defaultPct, "% \xB7 Max: ", b.maxPct, "% \xB7 \u20AC", (b.pricePer100 || 0).toFixed(2), "/", b.priceSize || 100, "ml excl. BTW \xB7 ", b.youwish ? "Supplier" : "External"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, marginBottom: 6 } }, "Used in: ", (b.products || []).map((p) => PRODUCTS[p]?.name).filter(Boolean).join(", ")), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editBases, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), style: { ...btn, fontSize: 10, color: gold, background: "transparent", border: `1px solid ${gold}30`, padding: "2px 8px", marginBottom: 6, textDecoration: "none" } }, "\u{1F4DD} Edit in Sheet"), /* @__PURE__ */ React.createElement("a", { href: b.url || baseUrl(b.name), target: "_blank", rel: "noopener noreferrer", style: { color: gold, fontSize: 11, textDecoration: "underline" } }, "View at supplier \u2192"), b.custom && /* @__PURE__ */ React.createElement("button", { onClick: () => saveCustoms(customs.filter((c) => c.name !== b.name)), style: { ...btn, marginLeft: 10, color: danger, background: "transparent", border: `1px solid ${danger}30`, fontSize: 10 } }, "Remove")))));
  })))));
}
function Builder({ recipes, save, goRecipes, editingProduct, clearEdit }) {
  const [pt, setPt] = useState("pomade");
  const [cb, setCb] = useState("50");
  const [cbUnit, setCbUnit] = useState("g");
  const [baseRows, setBaseRows] = useState([]);
  const [scentRows, setScentRows] = useState([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [showPifInfo, setShowPifInfo] = useState(false);
  const [baseSearch, setBaseSearch] = useState(null);
  const [scentSearch, setScentSearch] = useState(null);
  const [pkgSearch, setPkgSearch] = useState(null);
  const [selectedPkg, setSelectedPkg] = useState([]);
  const [editId, setEditId] = useState(null);
  useEffect(() => {
    if (editingProduct) {
      setPt(editingProduct.productType || "pomade");
      setCb(String(editingProduct.batchSize || 50));
      setCbUnit(editingProduct.batchUnit || "g");
      setName(editingProduct.name || "");
      setNotes(editingProduct.notes || "");
      setEditId(editingProduct.id);
      setBaseRows((editingProduct.bases || []).map((b) => ({ ...b, mode: b.mode || "grams", grams: b.grams || b.pct / 100 * (editingProduct.batchSize || 50) })));
      setScentRows((editingProduct.scents || []).map((s) => ({ name: s.name, mode: s.drops ? "drops" : "pct", drops: s.drops || 0, pct: s.pct ? String(s.pct) : "" })));
      setSelectedPkg(editingProduct.packaging || []);
      clearEdit();
    }
  }, [editingProduct]);
  const preset = PRODUCTS[pt];
  const cat = preset.cat;
  const batchUnit = cbUnit;
  const availBases = useMemo(() => BASES.filter((b) => b.products.includes(pt)), [pt]);
  const addBase = (bName) => {
    if (baseRows.find((r) => r.name === bName)) return;
    const b = BASES.find((x) => x.name === bName);
    if (!b) return;
    const refBatch = parseFloat(cb) || preset.test;
    const useDrops = b.name.includes("Vitamin E") || b.name.includes("Rosemary Extract");
    if (useDrops) {
      const drops = Math.round(b.defaultPct / 100 * refBatch / DROP_ML);
      const ml = drops * DROP_ML;
      setBaseRows([...baseRows, { name: bName, grams: +ml.toFixed(3), drops, mode: "drops" }]);
    } else {
      const g = +(b.defaultPct / 100 * refBatch).toFixed(3);
      setBaseRows([...baseRows, { name: bName, grams: g, drops: 0, mode: "grams" }]);
    }
  };
  const updBase = (i, field, value) => {
    const n = [...baseRows];
    if (field === "grams" || field === "ml") {
      const g = parseFloat(value) || 0;
      n[i] = { ...n[i], grams: g, drops: Math.round(g / DROP_ML) };
    } else if (field === "drops") {
      const d = parseInt(value) || 0;
      const ml = d * DROP_ML;
      n[i] = { ...n[i], drops: d, grams: +ml.toFixed(3) };
    } else if (field === "mode") {
      n[i] = { ...n[i], mode: value };
    }
    setBaseRows(n);
  };
  const rmBase = (i) => setBaseRows(baseRows.filter((_, j) => j !== i));
  const addScent = (sName) => {
    if (scentRows.find((r) => r.name === sName)) return;
    setScentRows([...scentRows, { name: sName, mode: "drops", drops: 1, pct: "" }]);
  };
  const updScent = (i, f, v) => {
    const n = [...scentRows];
    n[i] = { ...n[i], [f]: v };
    setScentRows(n);
  };
  const rmScent = (i) => setScentRows(scentRows.filter((_, j) => j !== i));
  const totalBaseGrams = baseRows.reduce((a, r) => a + (r.grams || 0), 0);
  const compScents = scentRows.map((s) => {
    const sd = SCENTS.find((x) => x.name === s.name);
    const mx = sd ? sd.ifra[cat] || 0 : 0;
    let ml, drops;
    if (s.mode === "drops") {
      drops = parseInt(s.drops) || 0;
      ml = drops * DROP_ML;
    } else {
      const pctVal = parseFloat(s.pct) || 0;
      ml = pctVal / 100 * (totalBaseGrams || 1);
      drops = Math.round(ml / DROP_ML);
    }
    return { ...s, ml, drops, maxPct: mx, sd };
  });
  const totalScentMl = compScents.reduce((a, s) => a + s.ml, 0);
  const batchSize = totalBaseGrams + totalScentMl;
  const baseRowsWithPct = baseRows.map((r) => ({ ...r, pct: batchSize > 0 ? +((r.grams || 0) / batchSize * 100).toFixed(2) : 0 }));
  const compScentsWithPct = compScents.map((s) => ({ ...s, pct: batchSize > 0 ? +(s.ml / batchSize * 100).toFixed(3) : 0, over: s.maxPct > 0 && batchSize > 0 && s.ml / batchSize * 100 > s.maxPct, banned: s.maxPct === 0 }));
  const totalBasePct = batchSize > 0 ? +(totalBaseGrams / batchSize * 100).toFixed(2) : 0;
  const totalScentPct = batchSize > 0 ? +(totalScentMl / batchSize * 100).toFixed(3) : 0;
  const totalPct = batchSize > 0 ? 100 : 0;
  const hasIFRAWarn = compScentsWithPct.some((s) => s.over || s.banned);
  const baseTooHigh = false;
  const totalOff = false;
  const baseWarnings = [];
  baseRowsWithPct.forEach((r) => {
    const b = BASES.find((x) => x.name === r.name);
    if (b && r.pct > b.maxPct) baseWarnings.push(`${r.name}: ${r.pct}% exceeds recommended max ${b.maxPct}%`);
  });
  const hasWater = baseRows.some((r) => {
    const b = BASES.find((x) => x.name === r.name);
    return b && b.role === "solvent" && b.inci === "Aqua" && r.pct > 0;
  });
  const hasOil = baseRows.some((r) => {
    const b = BASES.find((x) => x.name === r.name);
    return b && (b.role === "carrier" || b.role === "wax") && r.pct > 0;
  });
  const hasEmulsifier = baseRows.some((r) => {
    const b = BASES.find((x) => x.name === r.name);
    return b && b.role === "emulsifier" && r.pct > 0;
  });
  if (hasWater && hasOil && !hasEmulsifier) baseWarnings.push("\u26A0\uFE0F Water + Oil detected without emulsifier \u2014 your product will separate! Add Olivem 1000 or BTMS-50.");
  const hasPreservative = baseRows.some((r) => {
    const b = BASES.find((x) => x.name === r.name);
    return b && b.role === "preservative" && r.pct > 0;
  });
  if (hasWater && !hasPreservative) baseWarnings.push("\u26A0\uFE0F Water-based formula without preservative \u2014 microbial growth risk. Add Glyceryl Caprylate or similar.");
  const hasAntioxidant = baseRows.some((r) => r.name.includes("Vitamin E") || r.name.includes("Rosemary Extract"));
  if (!hasWater && hasOil && !hasAntioxidant) baseWarnings.push("\u{1F4A1} Oil-based formula \u2014 consider adding Vitamin E or Rosemary Extract to prevent rancidity.");
  const handleSave = () => {
    if (!name.trim()) return;
    const product = {
      id: editId || Date.now(),
      name,
      notes,
      productType: pt,
      productName: PRODUCTS[pt].name,
      batchSize: +batchSize.toFixed(2),
      batchUnit,
      category: cat,
      bases: baseRowsWithPct.map((r) => {
        const b = BASES.find((x) => x.name === r.name);
        return { ...r, inci: b?.inci || "", role: b?.role || "" };
      }),
      scents: compScentsWithPct.map((s) => ({ name: s.name, type: s.sd?.type || "FO", drops: s.drops, ml: +s.ml.toFixed(4), pct: +s.pct, maxPct: s.maxPct, inci: s.sd?.type === "FO" ? "Parfum" : s.sd?.name || "Parfum" })),
      totalBasePct,
      totalScentPct: +totalScentPct,
      totalPct: 100,
      totalScentMl: +totalScentMl.toFixed(3),
      createdAt: editId ? recipes.find((r) => r.id === editId)?.createdAt || (/* @__PURE__ */ new Date()).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: editId ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
      hasWarnings: hasIFRAWarn || baseWarnings.length > 0,
      packaging: selectedPkg.map((p) => ({ name: p.name, category: p.category, price_eur: p.price_eur, per_unit: p.per_unit, description: p.description }))
    };
    if (editId) {
      save(recipes.map((r) => r.id === editId ? product : r));
    } else {
      save([...recipes, product]);
    }
    setSaved(true);
    setEditId(null);
    setTimeout(() => setSaved(false), 2500);
  };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Product Builder"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12, margin: "0 0 12px" } }, "Build full formulations. System enforces IFRA limits and flags formulation issues."), /* @__PURE__ */ React.createElement("div", { style: { ...card, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 180px" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Product Type"), /* @__PURE__ */ React.createElement("select", { value: pt, onChange: (e) => {
    setPt(e.target.value);
    setBaseRows([]);
    setScentRows([]);
    setCb(String(PRODUCTS[e.target.value].test));
    setCbUnit(PRODUCTS[e.target.value].tU);
  }, style: inp }, Object.entries(PRODUCTS).map(([k, v]) => /* @__PURE__ */ React.createElement("option", { key: k, value: k }, v.name)))), /* @__PURE__ */ React.createElement("div", { style: { flex: "0 0 auto" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Reference Size (for defaults)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("input", { type: "number", value: cb, onChange: (e) => setCb(e.target.value), style: { ...inp, width: 80, textAlign: "center" } }), /* @__PURE__ */ React.createElement("select", { value: cbUnit, onChange: (e) => setCbUnit(e.target.value), style: { ...inp, width: 55 } }, /* @__PURE__ */ React.createElement("option", { value: "ml" }, "ml"), /* @__PURE__ */ React.createElement("option", { value: "g" }, "g")))), /* @__PURE__ */ React.createElement("div", { style: { flex: "0 0 auto" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Actual Batch Size"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, padding: "4px 0" } }, batchSize > 0 ? batchSize.toFixed(1) : "-", " ", batchUnit)), /* @__PURE__ */ React.createElement("div", { style: { flex: "0 0 auto" } }, /* @__PURE__ */ React.createElement(Pill, { color: gold, bg: `${gold}15` }, "IFRA Cat ", cat, " \u2014 ", IFRA_CATS[cat].label))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 14 } }, "Step 1 \u2014 Base Ingredients"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: totalBasePct > 100 ? danger : totalBasePct > 0 ? gold : textMuted } }, "Base total: ", totalBasePct.toFixed(1), "%")), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("input", { value: baseSearch || "", onChange: (e) => setBaseSearch(e.target.value), onFocus: () => setBaseSearch(baseSearch || ""), placeholder: "+ Search or click to browse ingredients...", style: { ...inp, width: "100%" } }), baseSearch !== null && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: bgCard, border: `1px solid ${border}`, borderRadius: 6, maxHeight: 200, overflowY: "auto", marginTop: 2 } }, availBases.filter((b) => !baseRows.find((r) => r.name === b.name)).filter((b) => b.name.toLowerCase().includes((baseSearch || "").toLowerCase()) || b.role.toLowerCase().includes((baseSearch || "").toLowerCase()) || b.inci.toLowerCase().includes((baseSearch || "").toLowerCase())).map((b) => /* @__PURE__ */ React.createElement("div", { key: b.name, onClick: () => {
    addBase(b.name);
    setBaseSearch(null);
  }, style: { padding: "6px 10px", cursor: "pointer", fontSize: 12, borderBottom: `1px solid ${border}20` }, onMouseEnter: (e) => e.currentTarget.style.background = `${gold}15`, onMouseLeave: (e) => e.currentTarget.style.background = "transparent" }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, b.name), " ", /* @__PURE__ */ React.createElement("span", { style: { color: textMuted, fontSize: 10 } }, "(", b.role, ") \u2014 max ", b.maxPct, "%"))), availBases.filter((b) => !baseRows.find((r) => r.name === b.name)).filter((b) => b.name.toLowerCase().includes((baseSearch || "").toLowerCase()) || b.role.toLowerCase().includes((baseSearch || "").toLowerCase())).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 10px", color: textMuted, fontSize: 11 } }, "No matches found"))), baseRowsWithPct.map((r, i) => {
    const b = BASES.find((x) => x.name === r.name);
    const overMax = b && r.pct > b.maxPct;
    return /* @__PURE__ */ React.createElement("div", { key: r.name, style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "6px 0", borderTop: i > 0 ? `1px solid ${border}30` : "none" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 180px", minWidth: 120 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, fontSize: 12 } }, r.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: textMuted } }, b?.inci, " \xB7 ", b?.role, " \xB7 max ", b?.maxPct, "%")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ React.createElement("select", { value: r.mode || "grams", onChange: (e) => updBase(i, "mode", e.target.value), style: { ...inp, width: 55, fontSize: 10, padding: 4 } }, /* @__PURE__ */ React.createElement("option", { value: "grams" }, "g"), /* @__PURE__ */ React.createElement("option", { value: "ml" }, "ml"), /* @__PURE__ */ React.createElement("option", { value: "drops" }, "Drops")), r.mode === "drops" ? /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "1", value: r.drops || 0, onChange: (e) => updBase(i, "drops", e.target.value), style: { ...inp, width: 55, textAlign: "center" } }) : /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: r.grams || 0, onChange: (e) => updBase(i, "grams", e.target.value), style: { ...inp, width: 70, textAlign: "center" } })), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: gold, fontWeight: 600, minWidth: 60 } }, r.pct, "%"), overMax && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: warn, fontWeight: 600 } }, "\u26A0\uFE0F Over max"), /* @__PURE__ */ React.createElement("button", { onClick: () => rmBase(i), style: { background: "none", border: "none", color: danger, cursor: "pointer", fontSize: 14, padding: "0 4px" } }, "\xD7"));
  }), (b) => b?.notes && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: textMuted, marginTop: 4 } }, b.notes)), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 14 } }, "Step 2 \u2014 Scent Blend"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: hasIFRAWarn ? danger : totalScentPct > 0 ? gold : textMuted } }, "Scent total: ", totalScentPct.toFixed(3), "% (", totalScentMl.toFixed(3), " ml)")), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("input", { value: scentSearch || "", onChange: (e) => setScentSearch(e.target.value), onFocus: () => setScentSearch(scentSearch || ""), placeholder: "+ Search or click to browse scents...", style: { ...inp, width: "100%" } }), scentSearch !== null && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: bgCard, border: `1px solid ${border}`, borderRadius: 6, maxHeight: 200, overflowY: "auto", marginTop: 2 } }, SCENTS.filter((s) => !scentRows.find((r) => r.name === s.name)).filter((s) => s.name.toLowerCase().includes((scentSearch || "").toLowerCase()) || s.family.toLowerCase().includes((scentSearch || "").toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map((s) => {
    const mx = s.ifra[cat] || 0;
    return /* @__PURE__ */ React.createElement("div", { key: s.name, onClick: () => {
      addScent(s.name);
      setScentSearch(null);
    }, style: { padding: "6px 10px", cursor: "pointer", fontSize: 12, borderBottom: `1px solid ${border}20`, color: mx === 0 ? danger : textMain }, onMouseEnter: (e) => e.currentTarget.style.background = `${gold}15`, onMouseLeave: (e) => e.currentTarget.style.background = "transparent" }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, s.name), " ", /* @__PURE__ */ React.createElement(TypeBadge, { t: s.type }), " ", /* @__PURE__ */ React.createElement("span", { style: { color: textMuted, fontSize: 10 } }, "\u2014 max ", mx === 0 ? "\u26D4 BANNED" : mx + "% Cat " + cat));
  }), SCENTS.filter((s) => !scentRows.find((r) => r.name === s.name)).filter((s) => s.name.toLowerCase().includes((scentSearch || "").toLowerCase()) || s.family.toLowerCase().includes((scentSearch || "").toLowerCase())).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 10px", color: textMuted, fontSize: 11 } }, "No matches found"))), compScentsWithPct.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.name, style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "6px 0", borderTop: i > 0 ? `1px solid ${border}30` : "none" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 160px", minWidth: 110 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500, fontSize: 12 } }, s.name, " ", /* @__PURE__ */ React.createElement(TypeBadge, { t: s.sd?.type || "FO" })), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: textMuted } }, s.sd?.note, " \u2022 max ", s.maxPct, "%")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 3, alignItems: "center" } }, /* @__PURE__ */ React.createElement("select", { value: scentRows[i].mode, onChange: (e) => updScent(i, "mode", e.target.value), style: { ...inp, width: 70, fontSize: 10, padding: 4 } }, /* @__PURE__ */ React.createElement("option", { value: "drops" }, "Drops"), /* @__PURE__ */ React.createElement("option", { value: "pct" }, "%")), scentRows[i].mode === "drops" ? /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "1", value: scentRows[i].drops, onChange: (e) => updScent(i, "drops", e.target.value), style: { ...inp, width: 55, textAlign: "center" } }) : /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: scentRows[i].pct, onChange: (e) => updScent(i, "pct", e.target.value), style: { ...inp, width: 65, textAlign: "center" } })), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, minWidth: 130 } }, "= ", s.ml.toFixed(3), "ml (", s.pct.toFixed(3), "%) / ", s.drops, "dr"), /* @__PURE__ */ React.createElement("div", { style: { minWidth: 50 } }, s.banned && /* @__PURE__ */ React.createElement("span", { style: { color: danger, fontSize: 10, fontWeight: 600 } }, "\u26D4 BANNED"), s.over && !s.banned && /* @__PURE__ */ React.createElement("span", { style: { color: warn, fontSize: 10, fontWeight: 600 } }, "\u26A0\uFE0F OVER ", s.maxPct, "%"), !s.over && !s.banned && s.pct > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: ok, fontSize: 10 } }, "[x]")), /* @__PURE__ */ React.createElement("button", { onClick: () => rmScent(i), style: { background: "none", border: "none", color: danger, cursor: "pointer", fontSize: 14, padding: "0 4px" } }, "\xD7")))), hasIFRAWarn && /* @__PURE__ */ React.createElement(Warn, null, /* @__PURE__ */ React.createElement("strong", null, "\u26A0\uFE0F IFRA Violation:"), " One or more scents exceed the maximum for Cat ", cat, ". Reduce amounts before saving."), baseWarnings.map((w, i) => /* @__PURE__ */ React.createElement(Warn, { key: i }, w)), compScentsWithPct.length > 0 && !hasIFRAWarn && /* @__PURE__ */ React.createElement(Ok, null, /* @__PURE__ */ React.createElement("strong", null, "\u{1F4A1} Formulation tip:"), " ", cat === "5B" && "Beard oil Cat 5B is strict \u2014 FOs max ~0.39%. Use essential oils for higher scent loads. For a 10ml batch, 1 drop = ~0.5% which already exceeds FO limits.", cat === "7B" && "Pomade Cat 7B allows ~1% FO. For 50g batch = ~0.5ml total FO or ~10 drops. Layer 3-5 scents for complexity.", cat === "4" && "Perfume Cat 4 allows up to ~9% FO. This is where you can be most creative. Structure: 30% top, 50% mid, 20% base notes.", cat === "9" && "Soap Cat 9 allows ~3.57% FO. Rinse-off so skin exposure is brief. Be generous with scent.", !["5B", "7B", "4", "9"].includes(cat) && "Check individual IFRA limits per scent in the library tab."), (baseRows.length > 0 || compScentsWithPct.length > 0) && /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 12, background: `${bg}ee`, border: "1px solid #3a3520" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, fontSize: 14, color: gold, marginBottom: 8 } }, "Formula Summary"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "Batch:"), " ", /* @__PURE__ */ React.createElement("strong", { style: { color: gold } }, batchSize.toFixed(1), batchUnit)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "Base:"), " ", /* @__PURE__ */ React.createElement("strong", null, totalBaseGrams.toFixed(1), batchUnit, " (", totalBasePct, "%)")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "Scent:"), " ", /* @__PURE__ */ React.createElement("strong", null, totalScentMl.toFixed(2), "ml (", totalScentPct, "%)")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { color: textMuted } }, "Total:"), " ", /* @__PURE__ */ React.createElement("strong", { style: { color: ok } }, "100%")))), /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 14 } }, "Step 3 \u2014 Packaging"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: selectedPkg.length > 0 ? gold : textMuted } }, "\u20AC", selectedPkg.reduce((a, p) => a + p.price_eur, 0).toFixed(2), " per unit excl. BTW")), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("input", { value: pkgSearch || "", onChange: (e) => setPkgSearch(e.target.value), onFocus: () => {
    if (pkgSearch === null) setPkgSearch("");
  }, placeholder: "+ Search or click to add packaging items...", style: { ...inp, width: "100%" } }), pkgSearch !== null && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: bgCard, border: `1px solid ${border}`, borderRadius: 6, maxHeight: 200, overflowY: "auto", marginTop: 2 } }, PACKAGING_ITEMS.filter((p) => !selectedPkg.find((s) => s.name === p.name)).filter((p) => !pkgSearch || p.name.toLowerCase().includes(pkgSearch.toLowerCase()) || p.category.toLowerCase().includes(pkgSearch.toLowerCase()) || p.description.toLowerCase().includes(pkgSearch.toLowerCase())).map((p) => /* @__PURE__ */ React.createElement("div", { key: p.name, onClick: () => {
    setSelectedPkg([...selectedPkg, p]);
    setPkgSearch(null);
  }, style: { padding: "6px 10px", cursor: "pointer", fontSize: 12, borderBottom: `1px solid ${border}20` }, onMouseEnter: (e) => e.currentTarget.style.background = `${gold}15`, onMouseLeave: (e) => e.currentTarget.style.background = "transparent" }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600 } }, p.name), " ", /* @__PURE__ */ React.createElement("span", { style: { color: textMuted, fontSize: 10 } }, "(", p.category, ") \u2014 \u20AC", p.price_eur.toFixed(2), "/", p.per_unit, " excl. BTW"))), PACKAGING_ITEMS.filter((p) => !selectedPkg.find((s) => s.name === p.name)).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 10px", color: textMuted, fontSize: 11 } }, "No more items. Add packaging in Google Sheet."))), selectedPkg.map((p, i) => /* @__PURE__ */ React.createElement("div", { key: p.name, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderTop: i > 0 ? `1px solid ${border}20` : "none" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 12 } }, p.name), " ", /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: textMuted } }, "(", p.category, ")")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontSize: 12, fontWeight: 600 } }, "\u20AC", p.price_eur.toFixed(2)), /* @__PURE__ */ React.createElement("button", { onClick: () => setSelectedPkg(selectedPkg.filter((_, j) => j !== i)), style: { background: "none", border: "none", color: danger, cursor: "pointer", fontSize: 14 } }, "\xD7")))), selectedPkg.length === 0 && PACKAGING_ITEMS.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, padding: "8px 0" } }, "No packaging items in Google Sheet yet. Add them in the Packaging tab.")), /* @__PURE__ */ React.createElement("div", { style: { ...card, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 200px" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Product Name"), /* @__PURE__ */ React.createElement("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. Boegbeeld Signature Pomade v1", style: inp })), /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 200px" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Notes (optional)"), /* @__PURE__ */ React.createElement("input", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Internal notes...", style: inp })), /* @__PURE__ */ React.createElement("button", { onClick: handleSave, disabled: !name.trim() || hasIFRAWarn, style: { ...btn, background: hasIFRAWarn ? textDim : gold, color: hasIFRAWarn ? textMuted : bg, fontWeight: 600, padding: "8px 24px", cursor: hasIFRAWarn || !name.trim() ? "not-allowed" : "pointer", opacity: !name.trim() ? 0.5 : 1 } }, hasIFRAWarn ? "Fix IFRA Warnings" : editId ? "Update Product" : "Save Product"), saved && /* @__PURE__ */ React.createElement("span", { style: { color: ok, fontSize: 12 } }, "[x] Saved! View in Saved Products tab.")));
}
function Recipes({ recipes, save, goBuilder, onEdit }) {
  const [expanded, setExpanded] = useState(null);
  const [pifView, setPifView] = useState(null);
  const fileRef = useRef(null);
  const del = (id) => save(recipes.filter((r) => r.id !== id));
  const exportAll = () => {
    const rows = [];
    rows.push(["name", "product_type", "category", "batch_size", "batch_unit", "total_base_pct", "total_scent_pct", "total_pct", "created", "notes", "ingredients_json", "scents_json", "packaging_json"].join(","));
    recipes.forEach((r) => {
      rows.push([
        `"${r.name}"`,
        r.productType,
        r.category,
        r.batchSize,
        r.batchUnit,
        r.totalBasePct,
        r.totalScentPct,
        r.totalPct,
        `"${new Date(r.createdAt).toLocaleDateString("nl-NL")}"`,
        `"${(r.notes || "").replace(/"/g, '""')}"`,
        `"${JSON.stringify(r.bases || []).replace(/"/g, '""')}"`,
        `"${JSON.stringify(r.scents || []).replace(/"/g, '""')}"`,
        `"${JSON.stringify(r.packaging || []).replace(/"/g, '""')}"`
      ].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boegbeeld-products-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boegbeeld-products-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        let imported;
        if (file.name.endsWith(".json")) {
          imported = JSON.parse(text);
        } else {
          try {
            imported = JSON.parse(text);
          } catch (e2) {
            alert("For importing, please use the JSON backup file. CSV export is for viewing in Google Sheets.");
            return;
          }
        }
        if (Array.isArray(imported)) {
          const merged = [...recipes];
          imported.forEach((r) => {
            if (!merged.find((x) => x.id === r.id)) merged.push({ ...r, id: r.id || Date.now() + Math.random() });
          });
          save(merged);
          alert(`Imported ${imported.length} product(s). ${merged.length} total.`);
        }
      } catch (err) {
        alert("Invalid file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  const copyForSheet = (r) => {
    const rows = [];
    rows.push(["Product: " + r.name, "Product: " + r.productName, "Cat: " + r.category, "Batch: " + r.batchSize + r.batchUnit, "Created: " + new Date(r.createdAt).toLocaleDateString("nl-NL")].join("	"));
    rows.push("");
    rows.push(["BASE INGREDIENTS", "INCI", "Role", "%", r.batchUnit || "g"].join("	"));
    (r.bases || []).forEach((b) => rows.push([b.name, b.inci, b.role, b.pct + "%", (b.pct / 100 * r.batchSize).toFixed(2)].join("	")));
    rows.push("");
    rows.push(["SCENT BLEND", "Type", "Drops", "ml", "%"].join("	"));
    (r.scents || []).forEach((s) => rows.push([s.name, s.type, s.drops, (s.ml || 0).toFixed(3), (s.pct || 0).toFixed(3) + "%"].join("	")));
    rows.push("");
    rows.push(["TOTAL", "", " ", " ", r.totalPct + "%"].join("	"));
    rows.push("");
    rows.push(["INCI LIST", ...(r.bases || []).sort((a, b) => b.pct - a.pct).map((b) => b.inci), "Parfum"].join(", "));
    navigator.clipboard.writeText(rows.join("\n")).then(() => alert("Product copied! Paste into Google Sheets."));
  };
  if (recipes.length === 0) return /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "50px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 44, marginBottom: 12 } }, "\u{1F4CB}"), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "'Open Sans',sans-serif", color: gold, fontWeight: 700 } }, "No Saved Products"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 13 } }, "Build your first formulation in the Product Builder."), /* @__PURE__ */ React.createElement("button", { onClick: goBuilder, style: { ...btn, background: gold, color: bg, fontWeight: 600, padding: "10px 24px", marginTop: 10 } }, "Open Product Builder"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => fileRef.current?.click(), style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11 } }, "\u{1F4E4} Import Products from JSON"), /* @__PURE__ */ React.createElement("input", { ref: fileRef, type: "file", accept: ".json", onChange: importFile, style: { display: "none" } })));
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Saved Products"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12, margin: 0 } }, "Click a recipe to view summary and download product specification."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { onClick: exportAll, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 10 } }, "\u{1F4E5} Export CSV (for Sheets)"), /* @__PURE__ */ React.createElement("button", { onClick: exportJSON, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 10 } }, "\u{1F4E5} Export JSON (backup)"), /* @__PURE__ */ React.createElement("button", { onClick: () => fileRef.current?.click(), style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 10 } }, "\u{1F4E4} Import (JSON)"), /* @__PURE__ */ React.createElement("input", { ref: fileRef, type: "file", accept: ".json", onChange: importFile, style: { display: "none" } }))), recipes.map((r) => {
    const isOpen = expanded === r.id;
    const isPif = pifView === r.id;
    return /* @__PURE__ */ React.createElement("div", { key: r.id, style: { ...card, border: isOpen ? `1px solid ${gold}40` : `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "start", cursor: "pointer" }, onClick: () => setExpanded(isOpen ? null : r.id) }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "'Open Sans',sans-serif", color: gold, fontSize: 15, margin: "0 0 3px", fontWeight: 700 } }, r.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted } }, r.productName, " \u2022 Cat ", r.category, " \u2022 ", r.batchSize, r.batchUnit, " \u2022 ", new Date(r.createdAt).toLocaleDateString("nl-NL"), r.hasWarnings && /* @__PURE__ */ React.createElement("span", { style: { color: warn, marginLeft: 6 } }, "\u26A0\uFE0F has warnings"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      onEdit(r);
    }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}30`, fontSize: 10 } }, "\u270F\uFE0F Edit"), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      copyForSheet(r);
    }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}30`, fontSize: 10 } }, "\u{1F4CB} Copy for Sheet"), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      del(r.id);
    }, style: { ...btn, background: bgInput, color: danger, border: `1px solid ${danger}30`, fontSize: 10 } }, "Delete"))), isOpen && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10 } }, r.bases?.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: gold, fontWeight: 600, marginBottom: 4 } }, "Base Ingredients (", r.totalBasePct, "%)"), /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Ingredient", "INCI", "Role", "%", r.batchUnit || "g"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "3px 6px", textAlign: "left", color: textDim, fontSize: 9, textTransform: "uppercase" } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, r.bases.map((b, i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px" } }, b.name), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: textMuted, fontSize: 10 } }, b.inci), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: textMuted } }, b.role), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: gold, fontWeight: 600 } }, b.pct, "%"), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: textMuted } }, (b.pct / 100 * r.batchSize).toFixed(2))))))), r.scents?.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: gold, fontWeight: 600, marginBottom: 4 } }, "Scent Blend (", r.totalScentPct, "%)"), /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Scent", "Type", "Drops", "ml", "%", "Max %"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "3px 6px", textAlign: "left", color: textDim, fontSize: 9, textTransform: "uppercase" } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, r.scents.map((s, i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px" } }, s.name), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px" } }, /* @__PURE__ */ React.createElement(TypeBadge, { t: s.type })), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: textMuted } }, s.drops), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: textMuted } }, s.ml?.toFixed(3)), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: gold, fontWeight: 600 } }, s.pct?.toFixed(3), "%"), /* @__PURE__ */ React.createElement("td", { style: { padding: "3px 6px", color: textMuted } }, s.maxPct, "%")))))), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, paddingTop: 4, borderTop: `1px solid ${border}30` } }, "Total: ", /* @__PURE__ */ React.createElement("strong", { style: { color: gold } }, r.totalPct, "%"), " \u2022 Scent: ", r.totalScentMl, "ml"), r.notes && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, marginTop: 4, fontStyle: "italic" } }, "Notes: ", r.notes), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, padding: "8px 12px", borderRadius: 6, background: bgInput, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: gold, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 } }, "INCI Ingredients (for label)"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMain, lineHeight: 1.6 } }, [...(r.bases || []).sort((a, b) => b.pct - a.pct).map((b) => b.inci), "Parfum"].filter((v, i, a) => a.indexOf(v) === i).join(", ")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: textDim, marginTop: 4 } }, "Note: Allergens from fragrance (", ">", " 0.01% leave-on / ", ">", ' 0.001% rinse-off) must be listed after "Parfum". Check IFRA certificates.')), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      setPifView(isPif ? null : r.id);
    }, style: { ...btn, marginTop: 10, background: isPif ? `${gold}15` : bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11, padding: "6px 14px" } }, "\u{1F4C4} ", isPif ? "Hide" : "Download", " Product Specification (PIF Data)"), isPif && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, padding: "12px 14px", borderRadius: 8, background: `${bg}ee`, border: `1px solid ${gold}30` } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 14, marginBottom: 8 } }, "\u{1F4C4} PIF / CPNP Data Package"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: textMain, marginBottom: 10 } }, "Below is the data your safety assessor needs to prepare your PIF and CPSR. Copy this or use as your submission brief."), /* @__PURE__ */ React.createElement("div", { id: `pif-${r.id}`, style: { background: bgInput, borderRadius: 6, padding: 12, fontSize: 11, lineHeight: 1.7, color: textMain, whiteSpace: "pre-wrap", fontFamily: "'Courier New',monospace", border: `1px solid ${border}`, maxHeight: 400, overflowY: "auto" } }, `=======================================
PRODUCT INFORMATION \u2014 ${r.name}
For: PIF & CPSR Submission
Brand: Boegbeeld (www.boegbeeld.shop)
Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString("nl-NL")}
=======================================
1. PRODUCT DESCRIPTION
---------------------
Product Name: ${r.name}
Product Type: ${r.productName}
IFRA Category: ${r.category} (${IFRA_CATS[r.category]?.label})
Intended Use: ${IFRA_CATS[r.category]?.ex}
Target Group: Adults (male grooming)
Application: Leave-on / ${r.category === "9" ? "Rinse-off" : "Leave-on"}
Batch Size: ${r.batchSize} ${r.batchUnit}
2. QUALITATIVE & QUANTITATIVE FORMULA
------------------------------------
${r.bases?.map((b) => `${b.inci.padEnd(45)} ${b.pct.toString().padStart(6)}%    (${b.name})`).join("\n") || "(no base ingredients listed)"}
${"Parfum".padEnd(45)} ${r.totalScentPct?.toString().padStart(6)}%    (fragrance blend)
${"-".repeat(60)}
${"TOTAL".padEnd(45)} ${r.totalPct?.toString().padStart(6)}%
3. FRAGRANCE COMPOSITION (for IFRA assessment)
--------------------------------------------
Fragrance % of total product: ${r.totalScentPct}%
${r.scents?.map((s) => `\u2022 ${s.name.padEnd(35)} ${s.pct?.toFixed(3).padStart(7)}% of product    (${s.type}, max ${s.maxPct}% Cat ${r.category})`).join("\n") || "(no scents)"}
4. DOCUMENTS NEEDED FROM YOU (Boegbeeld)
---------------------------------------
[ ] CoA (Certificate of Analysis) per ingredient
[ ] MSDS/SDS per ingredient
[ ] TDS (Technical Data Sheet) per ingredient
[ ] IFRA Certificate per fragrance oil (from supplier)
[ ] Allergen declaration per fragrance (from IFRA cert)
[ ] GMP statement or ISO 22716 compliance
[ ] Manufacturing method description
[ ] Packaging specification (material, volume)
[ ] Label draft (with INCI list, batch no., PAO symbol)
[ ] Stability test samples (safety assessor arranges lab)
5. INCI LIST (for label \u2014 descending order)
----------------------------------------
${[...(r.bases || []).sort((a, b) => b.pct - a.pct).map((b) => b.inci), "Parfum"].filter((v, i, a) => a.indexOf(v) === i).join(", ")}
Note: Allergens from fragrance (>0.001% rinse-off, >0.01% leave-on)
must be listed after "Parfum". Check supplier IFRA certificates for these.
6. WHAT YOUWISH HANDLES
----------------------
[x] CPSR (Cosmetic Product Safety Report Part A + B)
[x] PIF compilation and review
[x] Stability testing (lab coordination)
[x] Challenge test (if water-containing)
[x] IFRA compliance verification
[x] Allergen calculation
[x] CPNP notification guidance
7. WHAT BOEGBEELD MUST PROVIDE
-----------------------------
-> Final formula (this document)
-> Ingredient documentation (CoA, SDS, TDS per ingredient)
   Tip: Your supplier may provide these for ingredients bought from them
-> Packaging details + label mockup
-> Physical product samples for stability testing
-> GMP compliance (ISO 22716 or equivalent statement)
-> Manufacturing process description
-> Responsible Person details (if self, your NL address)
8. CPNP NOTIFICATION (after PIF is complete)
------------------------------------------
Portal: ec.europa.eu/growth/tools-databases/cosing/
Required before placing product on market.
Upload: product name, category, frame formula,
        RP details, label image, CPSR reference.
`), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
      const el = document.getElementById(`pif-${r.id}`);
      if (el) navigator.clipboard.writeText(el.textContent).then(() => alert("Copied to clipboard!"));
    }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 10 } }, "\u{1F4CB} Copy to clipboard"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      const el = document.getElementById(`pif-${r.id}`);
      if (el) {
        const blob = new Blob([el.textContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PIF-${r.name.replace(/\s+/g, "-")}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 10 } }, "\u{1F4BE} Download .txt")))));
  }));
}
function Production({ recipes, save }) {
  const [selId, setSelId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [targetUnit, setTargetUnit] = useState("ml");
  const [showUnits, setShowUnits] = useState("both");
  const [containerSize, setContainerSize] = useState("");
  const [containerUnit, setContainerUnit] = useState("ml");
  const [configName, setConfigName] = useState("");
  const recipe = recipes.find((r) => r.id === +selId);
  const savedConfigs = recipe?.productionConfigs || [];
  const saveConfig = () => {
    if (!configName.trim() || !recipe) return;
    const cfg = { id: Date.now(), name: configName.trim(), targetQty, targetUnit, containerSize, containerUnit, savedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const updated = { ...recipe, productionConfigs: [...savedConfigs, cfg] };
    save(recipes.map((r) => r.id === recipe.id ? updated : r));
    setConfigName("");
  };
  const loadConfig = (cfg) => {
    setTargetQty(cfg.targetQty);
    setTargetUnit(cfg.targetUnit);
    setContainerSize(cfg.containerSize);
    setContainerUnit(cfg.containerUnit);
  };
  const delConfig = (cfgId) => {
    const updated = { ...recipe, productionConfigs: savedConfigs.filter((c) => c.id !== cfgId) };
    save(recipes.map((r) => r.id === recipe.id ? updated : r));
  };
  const origSize = recipe?.batchSize || 1;
  const origUnit = recipe?.batchUnit || "ml";
  const target = parseFloat(targetQty) || 0;
  const targetInOrigUnit = (() => {
    if (!target) return 0;
    if (targetUnit === origUnit) return target;
    if (targetUnit === "L" && origUnit === "ml") return target * 1e3;
    if (targetUnit === "ml" && origUnit === "L") return target / 1e3;
    if (targetUnit === "L" && origUnit === "g") return target * 1e3;
    if (targetUnit === "kg" && origUnit === "g") return target * 1e3;
    if (targetUnit === "g" && origUnit === "kg") return target / 1e3;
    if (targetUnit === "kg" && origUnit === "ml") return target * 1e3;
    if (targetUnit === "L" && origUnit === "g") return target * 1e3;
    return target;
  })();
  const scaleFactor = targetInOrigUnit / origSize;
  const containerSz = parseFloat(containerSize) || 0;
  const containerInOrigUnit = (() => {
    if (!containerSz) return 0;
    if (containerUnit === origUnit) return containerSz;
    if (containerUnit === "ml" && origUnit === "g") return containerSz;
    if (containerUnit === "ml" && origUnit === "L") return containerSz / 1e3;
    return containerSz;
  })();
  const numContainers = containerInOrigUnit > 0 ? Math.floor(targetInOrigUnit / containerInOrigUnit) : 0;
  const quickSizes = [
    { label: "100 ml", val: 100, unit: "ml" },
    { label: "250 ml", val: 250, unit: "ml" },
    { label: "500 ml", val: 500, unit: "ml" },
    { label: "1 L", val: 1, unit: "L" },
    { label: "2.5 L", val: 2.5, unit: "L" },
    { label: "5 L", val: 5, unit: "L" },
    { label: "500 g", val: 500, unit: "g" },
    { label: "1 kg", val: 1, unit: "kg" },
    { label: "5 kg", val: 5, unit: "kg" }
  ];
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Production Scale-Up"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12, margin: "0 0 12px" } }, "Select a saved recipe and scale it to any production quantity."), recipes.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "50px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 44, marginBottom: 12 } }, "\u{1F3ED}"), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "'Open Sans',sans-serif", color: gold, fontWeight: 700 } }, "No Products to Produce"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 13 } }, "Create and save a recipe in the Product Builder first.")), recipes.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { ...card, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 250px" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Select Product"), /* @__PURE__ */ React.createElement("select", { value: selId, onChange: (e) => setSelId(e.target.value), style: inp }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose a product..."), recipes.map((r) => /* @__PURE__ */ React.createElement("option", { key: r.id, value: r.id }, r.name, " (", r.productName, " \xB7 ", r.batchSize, r.batchUnit, " original)")))), recipe && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { flex: "0 0 auto" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Production Quantity"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("input", { type: "number", value: targetQty, onChange: (e) => setTargetQty(e.target.value), placeholder: "e.g. 5", style: { ...inp, width: 80, textAlign: "center" } }), /* @__PURE__ */ React.createElement("select", { value: targetUnit, onChange: (e) => setTargetUnit(e.target.value), style: { ...inp, width: 60 } }, /* @__PURE__ */ React.createElement("option", { value: "ml" }, "ml"), /* @__PURE__ */ React.createElement("option", { value: "L" }, "L"), /* @__PURE__ */ React.createElement("option", { value: "g" }, "g"), /* @__PURE__ */ React.createElement("option", { value: "kg" }, "kg")))), /* @__PURE__ */ React.createElement("div", { style: { flex: "0 0 auto" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Container Size (optional)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("input", { type: "number", value: containerSize, onChange: (e) => setContainerSize(e.target.value), placeholder: "e.g. 30", style: { ...inp, width: 70, textAlign: "center" } }), /* @__PURE__ */ React.createElement("select", { value: containerUnit, onChange: (e) => setContainerUnit(e.target.value), style: { ...inp, width: 60 } }, /* @__PURE__ */ React.createElement("option", { value: "ml" }, "ml"), /* @__PURE__ */ React.createElement("option", { value: "g" }, "g")))))), recipe && /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 12, color: textMuted } }, "Saved Configurations"), target > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { value: configName, onChange: (e) => setConfigName(e.target.value), placeholder: "e.g. 200x15ml bottles", style: { ...inp, width: 180, fontSize: 11 } }), /* @__PURE__ */ React.createElement("button", { onClick: saveConfig, disabled: !configName.trim(), style: { ...btn, background: gold, color: bg, fontWeight: 600, fontSize: 10, padding: "4px 10px", opacity: configName.trim() ? 1 : 0.4 } }, "Save"))), savedConfigs.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 } }, savedConfigs.map((cfg) => /* @__PURE__ */ React.createElement("div", { key: cfg.id, style: { display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: bgInput, borderRadius: 6, border: `1px solid ${border}`, fontSize: 11 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => loadConfig(cfg), style: { background: "none", border: "none", color: gold, cursor: "pointer", fontWeight: 600, fontSize: 11 } }, cfg.name), /* @__PURE__ */ React.createElement("span", { style: { color: textDim, fontSize: 10 } }, cfg.targetQty, cfg.targetUnit, cfg.containerSize ? ` \xB7 ${cfg.containerSize}${cfg.containerUnit}` : ""), /* @__PURE__ */ React.createElement("button", { onClick: () => delConfig(cfg.id), style: { background: "none", border: "none", color: danger, cursor: "pointer", fontSize: 12, padding: "0 2px" } }, "\xD7")))), savedConfigs.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textDim } }, "Set a production quantity above, then save it for quick access later.")), recipe && !target && /* @__PURE__ */ React.createElement("div", { style: { ...card } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Quick Select Production Size"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 } }, quickSizes.map((q) => /* @__PURE__ */ React.createElement("button", { key: q.label, onClick: () => {
    setTargetQty(String(q.val));
    setTargetUnit(q.unit);
  }, style: { ...btn, background: bgInput, color: textMuted, border: `1px solid ${border}`, fontSize: 11, padding: "6px 12px" } }, q.label)))), recipe && target > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { ...card, background: bgInput, border: `1px solid ${gold}30` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 18, margin: 0 } }, recipe.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted } }, recipe.productName, " \xB7 IFRA Cat ", recipe.category, " \xB7 Original: ", origSize, origUnit)), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 22 } }, target, " ", targetUnit), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted } }, "Scale factor: ", scaleFactor.toFixed(1), "\xD7", numContainers > 0 && ` \xB7 ~${numContainers} \xD7 ${containerSize}${containerUnit} containers`)))), recipe.bases?.length > 0 && /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 15, marginBottom: 8 } }, "Base Ingredients"), /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Ingredient", "INCI", "Product %", "Amount", ""].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "6px 8px", textAlign: "left", color: textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, recipe.bases.map((b, i) => {
    const scaled = b.pct / 100 * targetInOrigUnit;
    const displayAmt = scaled >= 1e3 ? { val: (scaled / 1e3).toFixed(2), unit: origUnit === "g" ? "kg" : "L" } : { val: scaled.toFixed(2), unit: origUnit };
    return /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", fontWeight: 600 } }, b.name), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", color: textMuted, fontSize: 11, fontStyle: "italic" } }, b.inci), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", color: textMuted } }, b.pct, "%"), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontWeight: 700, fontSize: 14 } }, displayAmt.val), /* @__PURE__ */ React.createElement("span", { style: { color: textMuted, fontSize: 11, marginLeft: 3 } }, displayAmt.unit)), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", color: textDim, fontSize: 10 } }, "(", scaled.toFixed(3), " ", origUnit, ")"));
  })))), recipe.scents?.length > 0 && /* @__PURE__ */ React.createElement("div", { style: card }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 15, marginBottom: 8 } }, "Scent Blend"), /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Scent", "Type", "Product %", "Amount (ml)", "Drops (\u2248)", ""].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "6px 8px", textAlign: "left", color: textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, recipe.scents.map((s, i) => {
    const scaledMl = s.pct / 100 * targetInOrigUnit;
    const scaledDrops = Math.round(scaledMl / DROP_ML);
    return /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", fontWeight: 600 } }, s.name), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, /* @__PURE__ */ React.createElement(TypeBadge, { t: s.type })), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", color: textMuted } }, s.pct, "%"), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontWeight: 700, fontSize: 14 } }, scaledMl.toFixed(2)), /* @__PURE__ */ React.createElement("span", { style: { color: textMuted, fontSize: 11, marginLeft: 3 } }, "ml")), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", color: textMuted } }, scaledDrops > 200 ? `${scaledMl.toFixed(1)} ml` : scaledDrops + " dr"), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", color: textDim, fontSize: 10 } }, "max ", s.maxPct, "%"));
  }))), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${border}30` } }, "Total fragrance: ", /* @__PURE__ */ React.createElement("strong", { style: { color: gold } }, (recipe.totalScentPct / 100 * targetInOrigUnit).toFixed(2), " ", origUnit), " (", recipe.totalScentPct, "%)")), /* @__PURE__ */ React.createElement("div", { style: { ...card, background: bgInput, border: `1px solid ${gold}30` } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 15, marginBottom: 8 } }, "Production Summary"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, fontSize: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase", marginBottom: 2 } }, "Total Production"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20 } }, target, " ", targetUnit)), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase", marginBottom: 2 } }, "Scale Factor"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20 } }, scaleFactor.toFixed(1), "\xD7"), /* @__PURE__ */ React.createElement("div", { style: { color: textDim, fontSize: 10 } }, "from ", origSize, origUnit, " recipe")), numContainers > 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase", marginBottom: 2 } }, "Containers"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20 } }, "~", numContainers, " pcs"), /* @__PURE__ */ React.createElement("div", { style: { color: textDim, fontSize: 10 } }, "@ ", containerSize, containerUnit, " each")), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase", marginBottom: 2 } }, "Ingredients Count"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20 } }, (recipe.bases?.length || 0) + (recipe.scents?.length || 0)), /* @__PURE__ */ React.createElement("div", { style: { color: textDim, fontSize: 10 } }, recipe.bases?.length || 0, " base + ", recipe.scents?.length || 0, " scent"))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 } }, "Weigh-Out Checklist"), recipe.bases?.map((b, i) => {
    const scaled = b.pct / 100 * targetInOrigUnit;
    const disp = scaled >= 1e3 ? `${(scaled / 1e3).toFixed(2)} ${origUnit === "g" ? "kg" : "L"}` : `${scaled.toFixed(2)} ${origUnit}`;
    return /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 16, height: 16, borderRadius: 3, border: `1px solid ${border}`, display: "inline-block", flexShrink: 0 } }), /* @__PURE__ */ React.createElement("span", { style: { color: textMain, fontWeight: 500, minWidth: 180 } }, b.name), /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontWeight: 700 } }, disp));
  }), recipe.scents?.map((s, i) => {
    const scaledMl = s.pct / 100 * targetInOrigUnit;
    return /* @__PURE__ */ React.createElement("div", { key: `s${i}`, style: { display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 16, height: 16, borderRadius: 3, border: `1px solid ${border}`, display: "inline-block", flexShrink: 0 } }), /* @__PURE__ */ React.createElement("span", { style: { color: textMain, fontWeight: 500, minWidth: 180 } }, s.name, " ", /* @__PURE__ */ React.createElement(TypeBadge, { t: s.type })), /* @__PURE__ */ React.createElement("span", { style: { color: gold, fontWeight: 700 } }, scaledMl.toFixed(2), " ml"));
  }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
    const rows = [["PRODUCTION SHEET \u2014 " + recipe.name], ["Date: " + (/* @__PURE__ */ new Date()).toLocaleDateString("nl-NL")], ["Product: " + recipe.productName + " \xB7 IFRA Cat " + recipe.category], ["Target: " + target + " " + targetUnit + " (" + scaleFactor.toFixed(1) + "\xD7 from " + origSize + origUnit + ")"], ["Containers: " + (numContainers > 0 ? "~" + numContainers + " \xD7 " + containerSize + containerUnit : "N/A")], [""], ["BASE INGREDIENTS", "INCI", "%", "Amount"]];
    (recipe.bases || []).forEach((b) => {
      const s = b.pct / 100 * targetInOrigUnit;
      rows.push([b.name, b.inci, b.pct + "%", s.toFixed(2) + " " + origUnit]);
    });
    rows.push([""], ["SCENT BLEND", "Type", "%", "Amount (ml)"]);
    (recipe.scents || []).forEach((s) => {
      const m = s.pct / 100 * targetInOrigUnit;
      rows.push([s.name, s.type, s.pct + "%", m.toFixed(2) + " ml"]);
    });
    rows.push([""], ["Total fragrance", "", recipe.totalScentPct + "%", (recipe.totalScentPct / 100 * targetInOrigUnit).toFixed(2) + " " + origUnit]);
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-${recipe.name.replace(/\s+/g, "-")}-${target}${targetUnit}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11 } }, "\u{1F4E5} Export CSV"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    const lines = [`PRODUCTION SHEET \u2014 ${recipe.name}`, `${target} ${targetUnit} (${scaleFactor.toFixed(1)}\xD7 from ${origSize}${origUnit})`, `Date: ${(/* @__PURE__ */ new Date()).toLocaleDateString("nl-NL")}`, `Product: ${recipe.productName} \xB7 IFRA Cat ${recipe.category}`, ``, `BASE INGREDIENTS:`, ...(recipe.bases || []).map((b) => {
      const s = b.pct / 100 * targetInOrigUnit;
      return `  ${b.name.padEnd(35)} ${b.pct}%   ${s >= 1e3 ? (s / 1e3).toFixed(2) + (origUnit === "g" ? " kg" : " L") : s.toFixed(2) + " " + origUnit}`;
    }), ``, `SCENT BLEND:`, ...(recipe.scents || []).map((s) => {
      const m = s.pct / 100 * targetInOrigUnit;
      return `  ${s.name.padEnd(35)} ${s.pct}%   ${m.toFixed(2)} ml`;
    }), ``, `Total fragrance: ${(recipe.totalScentPct / 100 * targetInOrigUnit).toFixed(2)} ${origUnit} (${recipe.totalScentPct}%)`, numContainers > 0 ? `Containers: ~${numContainers} \xD7 ${containerSize}${containerUnit}` : ""];
    navigator.clipboard.writeText(lines.join("\n")).then(() => alert("Production sheet copied!"));
  }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11 } }, "\u{1F4CB} Copy for Sheet"), /* @__PURE__ */ React.createElement("button", { onClick: () => window.print(), style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11 } }, "\u{1F5A8}\uFE0F Print")))));
}
function CostCalc({ recipes, save }) {
  const [selId, setSelId] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [containerSz, setContainerSz] = useState("30");
  const [containerUnit, setContainerUnit] = useState("ml");
  const [configName, setConfigName] = useState("");
  const [scentOv, setScentOv] = useState({});
  const [baseOv, setBaseOv] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const r = await store.get("bb-scent-overrides");
        if (r?.value) setScentOv(JSON.parse(r.value));
      } catch (e) {
      }
      try {
        const r = await store.get("bb-base-overrides");
        if (r?.value) setBaseOv(JSON.parse(r.value));
      } catch (e) {
      }
    })();
  }, []);
  const getPrice = (name, isScent) => {
    if (isScent) {
      const ov = scentOv[name];
      if (ov?.pricePer100ml) return ov.pricePer100ml;
      const s = SCENTS.find((x) => x.name === name);
      return s?.pricePer100ml || (s?.type === "FO" ? 29.5 : s?.type === "CO2" ? 45 : 25);
    } else {
      const ov = baseOv[name];
      if (ov?.pricePer100) return ov.pricePer100;
      const b = BASES.find((x) => x.name === name);
      return b?.pricePer100 || (b?.role === "carrier" ? 8 : b?.role === "wax" ? 12 : b?.role === "solvent" ? 2 : 10);
    }
  };
  const recipe = recipes.find((r) => r.id === +selId);
  const cSz = parseFloat(containerSz) || 30;
  const rp = parseFloat(retailPrice) || 0;
  const rpExBtw = rp / 1.21;
  const allIngredients = recipe ? [...(recipe.bases || []).map((b) => ({ ...b, isScent: false })), ...(recipe.scents || []).map((s) => ({ ...s, isScent: true }))] : [];
  const ingredientCosts = allIngredients.map((ing) => {
    const pricePerUnit = getPrice(ing.name, ing.isScent);
    const amtPerContainer = ing.pct / 100 * cSz;
    const costPerContainer = pricePerUnit > 0 ? amtPerContainer / 100 * pricePerUnit : 0;
    return { ...ing, pricePerUnit, amtPerContainer, costPerContainer };
  });
  const totalCostPerContainer = ingredientCosts.reduce((a, i) => a + i.costPerContainer, 0);
  const packagingForProduct = recipe?.packaging || [];
  const totalPackagingCost = packagingForProduct.reduce((a, p) => a + (p.price_eur || 0), 0);
  const totalCostPerUnit = totalCostPerContainer + totalPackagingCost;
  const margin = rpExBtw > 0 && totalCostPerUnit > 0 ? (rpExBtw - totalCostPerUnit) / rpExBtw * 100 : 0;
  const sectionTitle = { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 14, marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Costs / Profit Calculator"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12, margin: "0 0 12px" } }, "All costs excl. 21% BTW. Enter retail price incl. BTW \u2014 margin is calculated on your revenue excl. BTW."), /* @__PURE__ */ React.createElement("div", { style: { ...card, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 250px" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Select Product"), /* @__PURE__ */ React.createElement("select", { value: selId, onChange: (e) => setSelId(e.target.value), style: inp }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose a product..."), recipes.map((r) => /* @__PURE__ */ React.createElement("option", { key: r.id, value: r.id }, r.name, " (", r.productName, ")")))), /* @__PURE__ */ React.createElement("div", { style: { flex: "0 0 auto" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Container Size"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("input", { type: "number", value: containerSz, onChange: (e) => setContainerSz(e.target.value), style: { ...inp, width: 65, textAlign: "center" } }), /* @__PURE__ */ React.createElement("select", { value: containerUnit, onChange: (e) => setContainerUnit(e.target.value), style: { ...inp, width: 50 } }, /* @__PURE__ */ React.createElement("option", { value: "ml" }, "ml"), /* @__PURE__ */ React.createElement("option", { value: "g" }, "g")))), /* @__PURE__ */ React.createElement("div", { style: { flex: "0 0 auto" } }, /* @__PURE__ */ React.createElement("label", { style: lbl }, "Retail Price incl. BTW (\u20AC)"), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.01", value: retailPrice, onChange: (e) => setRetailPrice(e.target.value), placeholder: "e.g. 14.95", style: { ...inp, width: 90, textAlign: "center" } }))), recipe && /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 12, color: textMuted } }, "Saved Pricing Setups"), rp > 0 && cSz > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { value: configName, onChange: (e) => setConfigName(e.target.value), placeholder: "e.g. 15ml @ \u20AC14.95", style: { ...inp, width: 160, fontSize: 11 } }), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    if (!configName.trim() || !recipe) return;
    const cfg = { id: Date.now(), name: configName.trim(), containerSz, containerUnit, retailPrice, savedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const updated = { ...recipe, costConfigs: [...recipe.costConfigs || [], cfg] };
    save(recipes.map((r) => r.id === recipe.id ? updated : r));
    setConfigName("");
  }, disabled: !configName.trim(), style: { ...btn, background: gold, color: bg, fontWeight: 600, fontSize: 10, padding: "4px 10px", opacity: configName.trim() ? 1 : 0.4 } }, "Save"))), (recipe.costConfigs || []).length > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 } }, (recipe.costConfigs || []).map((cfg) => /* @__PURE__ */ React.createElement("div", { key: cfg.id, style: { display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: bgInput, borderRadius: 6, border: `1px solid ${border}`, fontSize: 11 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setContainerSz(cfg.containerSz);
    setContainerUnit(cfg.containerUnit);
    setRetailPrice(cfg.retailPrice);
  }, style: { background: "none", border: "none", color: gold, cursor: "pointer", fontWeight: 600, fontSize: 11 } }, cfg.name), /* @__PURE__ */ React.createElement("span", { style: { color: textDim, fontSize: 10 } }, cfg.containerSz, cfg.containerUnit, " \xB7 \u20AC", cfg.retailPrice), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    const updated = { ...recipe, costConfigs: (recipe.costConfigs || []).filter((c) => c.id !== cfg.id) };
    save(recipes.map((r) => r.id === recipe.id ? updated : r));
  }, style: { background: "none", border: "none", color: danger, cursor: "pointer", fontSize: 12, padding: "0 2px" } }, "\xD7")))), (recipe.costConfigs || []).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textDim } }, "Set container size and retail price above, then save for quick access.")), recipe && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 12, background: bgInput, border: `1px solid ${gold}30` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase" } }, "Ingredients"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 24 } }, "\u20AC", totalCostPerContainer.toFixed(2))), /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase" } }, "Packaging"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 24 } }, "\u20AC", totalPackagingCost.toFixed(2))), /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", background: bgCard, borderRadius: 8, border: `1px solid ${gold}40` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase" } }, "Total / Unit"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: "#fff", fontSize: 24 } }, "\u20AC", totalCostPerUnit.toFixed(2))), rp > 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase" } }, "Retail incl. BTW"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: textMain, fontSize: 24 } }, "\u20AC", rp.toFixed(2)), /* @__PURE__ */ React.createElement("div", { style: { color: textDim, fontSize: 10 } }, "excl. BTW: \u20AC", rpExBtw.toFixed(2))), rp > 0 && totalCostPerUnit > 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", background: margin >= 70 ? `${ok}15` : margin >= 50 ? `${warn}15` : `${danger}15`, borderRadius: 8, border: `1px solid ${margin >= 70 ? ok : margin >= 50 ? warn : danger}30` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase" } }, "Margin"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: margin >= 70 ? ok : margin >= 50 ? warn : danger, fontSize: 24 } }, margin.toFixed(1), "%")), rp > 0 && totalCostPerUnit > 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 16px", background: bgCard, borderRadius: 8, border: `1px solid ${border}` } }, /* @__PURE__ */ React.createElement("div", { style: { color: textMuted, fontSize: 10, textTransform: "uppercase" } }, "Profit"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 24 } }, "\u20AC", (rpExBtw - totalCostPerUnit).toFixed(2)), /* @__PURE__ */ React.createElement("div", { style: { color: textDim, fontSize: 10 } }, "per unit excl. BTW")))), /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 12 } }, /* @__PURE__ */ React.createElement("div", { style: sectionTitle }, "Section 1 \u2014 Ingredients (excl. BTW)"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 10, color: textMuted, margin: "0 0 8px" } }, "Prices from Google Sheet (excl. 21% BTW). ", /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editScents, target: "_blank", rel: "noopener noreferrer", style: { color: gold } }, "Edit prices in Sheet")), /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Ingredient", "%", `Per ${cSz}${containerUnit}`, "\u20AC/100", "Cost/unit"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "6px 8px", textAlign: "left", color: textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, ingredientCosts.map((ing, i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", fontWeight: 500 } }, ing.name, " ", ing.isScent && /* @__PURE__ */ React.createElement(TypeBadge, { t: ing.type })), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted } }, ing.pct, "%"), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted } }, ing.amtPerContainer.toFixed(2), " ", ing.isScent ? "ml" : containerUnit), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: ing.pricePerUnit > 0 ? textMain : danger } }, ing.pricePerUnit > 0 ? `\u20AC${ing.pricePerUnit.toFixed(2)}` : "\u2014"), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: gold, fontWeight: 600 } }, "\u20AC", ing.costPerContainer.toFixed(3))))), /* @__PURE__ */ React.createElement("tfoot", null, /* @__PURE__ */ React.createElement("tr", { style: { borderTop: `1px solid ${gold}40` } }, /* @__PURE__ */ React.createElement("td", { colSpan: 4, style: { padding: "8px", fontWeight: 700, textAlign: "right", color: textMain } }, "Subtotal ingredients:"), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 16, fontWeight: 700 } }, "\u20AC", totalCostPerContainer.toFixed(2)))))), /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 12 } }, /* @__PURE__ */ React.createElement("div", { style: sectionTitle }, "Section 2 \u2014 Packaging (excl. BTW)"), packagingForProduct.length === 0 ? /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: textMuted } }, 'No packaging items found. Add a "packaging" tab in your Google Sheet with columns: name, description, category, price_eur, per_unit, for_product, url, notes') : /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Item", "Category", "Cost/unit"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "6px 8px", textAlign: "left", color: textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, packagingForProduct.map((p, i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", fontWeight: 500 } }, p.name, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: textMuted, fontWeight: 400, marginLeft: 6 } }, p.description)), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${gold}15`, color: gold, fontWeight: 600, textTransform: "uppercase" } }, p.category)), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: gold, fontWeight: 600 } }, "\u20AC", p.price_eur.toFixed(2))))), /* @__PURE__ */ React.createElement("tfoot", null, /* @__PURE__ */ React.createElement("tr", { style: { borderTop: `1px solid ${gold}40` } }, /* @__PURE__ */ React.createElement("td", { colSpan: 2, style: { padding: "8px", fontWeight: 700, textAlign: "right", color: textMain } }, "Subtotal packaging:"), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 16, fontWeight: 700 } }, "\u20AC", totalPackagingCost.toFixed(2)))))), /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 12, background: `${gold}08`, border: `1px solid ${gold}30` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: sectionTitle }, "Total Cost Per Unit"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: textMuted } }, "Ingredients (\u20AC", totalCostPerContainer.toFixed(2), ") + Packaging (\u20AC", totalPackagingCost.toFixed(2), ") \u2014 all excl. BTW")), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 32 } }, "\u20AC", totalCostPerUnit.toFixed(2)))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
    const rows = [];
    rows.push(["Boegbeeld Costs / Profit Report", recipe.name, (/* @__PURE__ */ new Date()).toLocaleDateString("nl-NL")].join(","));
    rows.push("");
    rows.push(["SECTION 1: INGREDIENTS", "", "", "", ""].join(","));
    rows.push(["Ingredient", "%", "Amount", "\u20AC/100", "Cost/unit"].join(","));
    ingredientCosts.forEach((ing) => rows.push([`"${ing.name}"`, ing.pct + "%", ing.amtPerContainer.toFixed(2), "\u20AC" + ing.pricePerUnit.toFixed(2), "\u20AC" + ing.costPerContainer.toFixed(3)].join(",")));
    rows.push(["", "", "", "Subtotal:", "\u20AC" + totalCostPerContainer.toFixed(2)].join(","));
    rows.push("");
    rows.push(["SECTION 2: PACKAGING", "", "", "", ""].join(","));
    rows.push(["Item", "Category", "", "", "Cost/unit"].join(","));
    packagingForProduct.forEach((p) => rows.push([`"${p.name}"`, p.category, "", "", "\u20AC" + (p.price_eur || 0).toFixed(2)].join(",")));
    rows.push(["", "", "", "Subtotal:", "\u20AC" + totalPackagingCost.toFixed(2)].join(","));
    rows.push("");
    rows.push(["TOTAL COST PER UNIT", "", "", "", "\u20AC" + totalCostPerUnit.toFixed(2)].join(","));
    if (rp > 0) {
      rows.push(["Retail Price incl. BTW", "", "", "", "\u20AC" + rp.toFixed(2)].join(","));
      rows.push(["Retail Price excl. BTW", "", "", "", "\u20AC" + rpExBtw.toFixed(2)].join(","));
      rows.push(["Margin (on excl. BTW)", "", "", "", margin.toFixed(1) + "%"].join(","));
      rows.push(["Profit per Unit excl. BTW", "", "", "", "\u20AC" + (rpExBtw - totalCostPerUnit).toFixed(2)].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boegbeeld-costs-${recipe.name.replace(/\s+/g, "-")}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11 } }, "\u{1F4E5} Export Cost Report (CSV)"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    const rows = [];
    rows.push(["Item", "Amount", "Cost"].join("	"));
    ingredientCosts.forEach((ing) => rows.push([ing.name, ing.amtPerContainer.toFixed(2) + "ml", "\u20AC" + ing.costPerContainer.toFixed(3)].join("	")));
    rows.push(["---", "---", "---"].join("	"));
    packagingForProduct.forEach((p) => rows.push([p.name, p.category, "\u20AC" + (p.price_eur || 0).toFixed(2)].join("	")));
    rows.push(["", "TOTAL", "\u20AC" + totalCostPerUnit.toFixed(2)].join("	"));
    navigator.clipboard.writeText(rows.join("\n")).then(() => alert("Cost report copied! Paste into Google Sheets."));
  }, style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11 } }, "\u{1F4CB} Copy for Sheet"))), !recipe && recipes.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { ...card, marginTop: 12, background: bgInput, border: `1px solid ${gold}20` } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: textMuted } }, "\u{1F4A1} Select a recipe above to see cost breakdown. All prices excl. 21% BTW. Edit prices in Google Sheet (Scents, Base, Packaging tabs).")));
}
function Packaging() {
  const items = PACKAGING_ITEMS;
  const categories = [...new Set(items.map((i) => i.category))].sort();
  const [cf, setCf] = useState("all");
  const [q, setQ] = useState("");
  const filtered = items.filter((i) => {
    if (cf !== "all" && i.category !== cf) return false;
    if (q && !i.name.toLowerCase().includes(q.toLowerCase()) && !i.description.toLowerCase().includes(q.toLowerCase()) && !i.for_product.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { style: { fontFamily: "'Odibee Sans',cursive", color: gold, fontSize: 20, margin: "0 0 4px", letterSpacing: 3, textTransform: "uppercase" } }, "Packaging"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 12, margin: "0 0 12px" } }, "All prices excl. BTW. Loaded from Google Sheet."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search packaging...", style: { ...inp, flex: "1 1 180px" } }), /* @__PURE__ */ React.createElement("select", { value: cf, onChange: (e) => setCf(e.target.value), style: { ...inp, width: 160 } }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Categories"), categories.map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, c))), /* @__PURE__ */ React.createElement("a", { href: SHEETS_CONFIG.editPackaging, target: "_blank", rel: "noopener noreferrer", style: { ...btn, background: bgInput, color: gold, border: `1px solid ${gold}40`, fontSize: 11, textDecoration: "none" } }, "+ Add in Google Sheet")), filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "40px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 40, marginBottom: 8 } }, "\u{1F4E6}"), /* @__PURE__ */ React.createElement("h3", { style: { fontFamily: "'Open Sans',sans-serif", color: gold, fontWeight: 700 } }, "No Packaging Items"), /* @__PURE__ */ React.createElement("p", { style: { color: textMuted, fontSize: 13, marginTop: 4 } }, 'Add a "packaging" tab in your Google Sheet with columns: name, description, category, price_eur, per_unit, for_product, url, notes')), filtered.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: `1px solid ${border}` } }, ["Name", "Category", "For Product", "Price", "Notes", "Link"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: { padding: "6px 8px", textAlign: "left", color: textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((item, i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${border}30` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", fontWeight: 600 } }, item.name, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: textMuted, fontWeight: 400 } }, item.description)), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${gold}15`, color: gold, fontWeight: 600, textTransform: "uppercase" } }, item.category)), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted, fontSize: 11 } }, item.for_product), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: gold, fontWeight: 600 } }, "\u20AC", item.price_eur.toFixed(2), " ", /* @__PURE__ */ React.createElement("span", { style: { color: textDim, fontWeight: 400, fontSize: 10 } }, "/", item.per_unit)), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 8px", color: textMuted, fontSize: 11 } }, item.notes), /* @__PURE__ */ React.createElement("td", { style: { padding: "6px 4px" } }, item.url && /* @__PURE__ */ React.createElement("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", style: { color: gold, fontSize: 10 } }, "\u{1F517}"))))))));
}
function SheetsApp() {
  const [ready, setReady] = React.useState(false);
  const [status, setStatus] = React.useState("Loading data from Google Sheets...");
  React.useEffect(() => {
    const load = async () => {
      try {
        const sRes = await fetch(SHEETS_CONFIG.scents);
        if (sRes.ok) {
          const rows = parseCSV(await sRes.text()).filter((r) => r.name);
          SCENTS.length = 0;
          rows.forEach((r) => SCENTS.push(rowToScent(r)));
          setStatus("Scents loaded (" + SCENTS.length + "). Loading base ingredients...");
        }
      } catch (e) {
        console.warn("Scents sheet:", e);
      }
      try {
        const bRes = await fetch(SHEETS_CONFIG.bases);
        if (bRes.ok) {
          const rows = parseCSV(await bRes.text()).filter((r) => r.name);
          BASES.length = 0;
          rows.forEach((r) => BASES.push(rowToBase(r)));
          setStatus("Bases loaded (" + BASES.length + "). Loading packaging...");
        }
      } catch (e) {
        console.warn("Bases sheet:", e);
      }
      try {
        if (SHEETS_CONFIG.packaging) {
          const pRes = await fetch(SHEETS_CONFIG.packaging);
          if (pRes.ok) {
            const rows = parseCSV(await pRes.text()).filter((r) => r.name);
            PACKAGING_ITEMS.length = 0;
            rows.forEach((r) => PACKAGING_ITEMS.push(rowToPackaging(r)));
          }
        }
      } catch (e) {
        console.warn("Packaging sheet:", e);
      }
      setStatus("All data loaded.");
      setReady(true);
    };
    load();
  }, []);
  if (!ready) return /* @__PURE__ */ React.createElement("div", { style: { background: "#192d44", color: "#ebb54a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Odibee Sans',cursive", fontSize: 24, gap: 12 } }, /* @__PURE__ */ React.createElement("div", null, "BOEGBEELD"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#8aa4be", fontFamily: "'Open Sans',sans-serif" } }, status));
  return /* @__PURE__ */ React.createElement(App, null);
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(SheetsApp, null));
