// Destructure React hooks (loaded globally via CDN)
const { useState, useEffect, useCallback, useMemo, useRef } = React;

const SHEETS_CONFIG = {
  scents: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpVsy-YJvA2ypDOGGv1Zh2KbswjMf0gxJHHvCb2_xaMKltGfad2LtjHf208-28mcffldVw6Cay-RgG/pub?gid=0&single=true&output=csv",
  bases: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpVsy-YJvA2ypDOGGv1Zh2KbswjMf0gxJHHvCb2_xaMKltGfad2LtjHf208-28mcffldVw6Cay-RgG/pub?gid=874764417&single=true&output=csv",
  packaging: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpVsy-YJvA2ypDOGGv1Zh2KbswjMf0gxJHHvCb2_xaMKltGfad2LtjHf208-28mcffldVw6Cay-RgG/pub?gid=1964339911&single=true&output=csv",
  editUrl: "https://docs.google.com/spreadsheets/d/REPLACE_WITH_YOUR_SHEET_ID/edit",
};
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}
function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += c; }
  }
  result.push(current);
  return result;
}
function rowToScent(r) {
  return {
    name: r.name, type: r.type || 'FO', family: r.family || '', note: r.note || '',
    profile: r.profile || '', masculine: parseInt(r.masculine) || 3,
    ifra: { "2": parseFloat(r.ifra_2)||0, "4": parseFloat(r.ifra_4)||0, "5A": parseFloat(r.ifra_5A)||0,
            "5B": parseFloat(r.ifra_5B)||0, "5C": parseFloat(r.ifra_5C)||0, "7B": parseFloat(r.ifra_7B)||0,
            "9": parseFloat(r.ifra_9)||0 },
    ifraSource: r.ifra_source || 'estimated',
    pricePer100ml: r.price_per_ml ? (parseFloat(r.price_eur)||0) / (parseFloat(r.price_per_ml)||100) * 100 : parseFloat(r.price_eur) || 0,
    priceRaw: parseFloat(r.price_eur) || 0, priceSize: parseFloat(r.price_per_ml) || 100,
    url: r.url || ''
  };
}
function rowToBase(r) {
  return {
    name: r.name, inci: r.inci || '', role: r.role || 'carrier',
    maxPct: parseFloat(r.max_pct) || 100, defaultPct: parseFloat(r.default_pct) || 5,
    notes: r.notes || '', youwish: true, products: Object.keys(PRODUCTS),
    pricePer100: r.price_per_ml ? (parseFloat(r.price_eur)||0) / (parseFloat(r.price_per_ml)||100) * 100 : parseFloat(r.price_eur) || 0,
    priceRaw: parseFloat(r.price_eur) || 0, priceSize: parseFloat(r.price_per_ml) || 100,
    url: r.url || ''
  };
}
const store = {
  get: async (k) => { try { const v = localStorage.getItem(k); return v ? {value: v} : null; } catch(e) { return null; } },
  set: async (k, v) => { try { localStorage.setItem(k, v); return {key:k, value:v}; } catch(e) { return null; } },
};
const DROP_ML = 0.05;
const IFRA_CAT_ORDER = ["2","4","5A","5B","5C","7B","9"];
const IFRA_CATS = {
  "2":  { label: "Body Spray / Deodorant", ex: "Body Spray, Deodorant Spray" },
  "4":  { label: "Fine Fragrance / Solid Cologne", ex: "EDT, EDP, Perfume, Aftershave, Solid Perfume, Solid Cologne" },
  "5A": { label: "Body Lotion (Leave-on)", ex: "Body Butter, Body Oil, Sunscreen Body" },
  "5B": { label: "Face & Beard (Leave-on)", ex: "Beard Oil, Face Moisturizer, Facial Toner" },
  "5C": { label: "Hand Cream (Leave-on)", ex: "Hand Cream, Hand Sanitizer, Nail Care" },
  "7B": { label: "Hair Styling (Leave-on)", ex: "Pomade, Hair Gel, Mousse, Leave-on Conditioner" },
  "9":  { label: "Soap & Rinse-off", ex: "Bar Soap, Shampoo, Body Wash, Bath Bombs" },
};
const PRODUCTS = {
  beard_oil:     { name: "Beard Oil",        cat: "5B", test: 10,  tU: "ml", prod: 100,  pU: "ml" },
  pomade:        { name: "Pomade",           cat: "7B", test: 50,  tU: "g",  prod: 500,  pU: "g"  },
  perfume_edp:   { name: "Perfume (EDP)",    cat: "4",  test: 10,  tU: "ml", prod: 100,  pU: "ml" },
  perfume_edt:   { name: "Perfume (EDT)",    cat: "4",  test: 10,  tU: "ml", prod: 100,  pU: "ml" },
  solid_cologne: { name: "Solid Cologne",    cat: "4",  test: 15,  tU: "g",  prod: 150,  pU: "g"  },
  aftershave:    { name: "Aftershave",       cat: "4",  test: 10,  tU: "ml", prod: 100,  pU: "ml" },
  soap_bar:      { name: "Soap (Bar)",       cat: "9",  test: 500, tU: "g",  prod: 5000, pU: "g"  },
  body_lotion:   { name: "Body Lotion",      cat: "5A", test: 50,  tU: "ml", prod: 500,  pU: "ml" },
  hand_cream:    { name: "Hand Cream",       cat: "5C", test: 50,  tU: "g",  prod: 500,  pU: "g"  },
  body_wash:     { name: "Body Wash",        cat: "9",  test: 100, tU: "ml", prod: 1000, pU: "ml" },
  shampoo:       { name: "Shampoo",          cat: "9",  test: 100, tU: "ml", prod: 1000, pU: "ml" },
};
const S = (name,type,fam,note,prof,masc,ifra,src) => ({name,type,family:fam,note,profile:prof,masculine:masc,ifra,ifraSource:src||"estimated"});
const FO_DEF = {"4":9.02,"5A":6.33,"5B":0.39,"5C":1.56,"7B":1.0,"9":3.57,"2":1.33};
const FO = (n,fam,note,prof,masc,ovr) => S(n,"FO",fam,note,prof,masc,{...FO_DEF,...(ovr||{})},"verified");
const EO = (n,fam,note,prof,masc,ifra) => S(n,"EO",fam,note,prof,masc,ifra,"estimated");
const SCENTS = [
  // === ESSENTIAL OILS (from YouWish EO catalog + your list) ===
  EO("Ambrette Seed","Musk / Animalic","base","Warm musky floral, wine-like, natural musk alternative",3,{"4":100,"5A":100,"5B":100,"5C":100,"7B":100,"9":100,"2":100}),
  EO("Bay Leaf","Aromatic / Herbal","top-mid","Spicy herbal, warm bay rum character, classic barbershop",5,{"4":3.0,"5A":1.5,"5B":0.5,"5C":0.8,"7B":1.0,"9":3.0,"2":1.0}),
  EO("Bergamot","Citrus","top","Fresh citrus, slightly floral, sophisticated Italian",4,{"4":5.0,"5A":3.0,"5B":1.5,"5C":2.0,"7B":2.0,"9":5.0,"2":2.5}),
  EO("Black Pepper","Spicy","top-mid","Sharp warm spice, dry woody undertone",5,{"4":8.0,"5A":4.0,"5B":2.0,"5C":2.5,"7B":3.0,"9":8.0,"2":3.0}),
  EO("Cardamom","Spicy / Aromatic","top-mid","Sweet spicy, warm eucalyptus-camphor hint",4,{"4":10,"5A":6.0,"5B":3.0,"5C":4.0,"7B":4.0,"9":10,"2":4.0}),
  EO("Cedarwood","Woody","base","Warm dry wood, pencil shavings, grounding",5,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Cinnamon Leaf","Spicy / Warm","mid","Warm spicy cinnamon, use sparingly — skin sensitizer",4,{"4":1.5,"5A":0.5,"5B":0.2,"5C":0.3,"7B":0.3,"9":1.5,"2":0.4}),
  EO("Clove Leaf","Spicy / Warm","mid","Rich eugenol spice, warm depth, use sparingly",4,{"4":2.0,"5A":0.8,"5B":0.3,"5C":0.5,"7B":0.5,"9":2.0,"2":0.5}),
  EO("Copaiba Balsam","Resinous / Woody","base","Soft balsamic, honey-like, woody, anti-inflammatory",4,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Cypress","Woody / Green","mid","Fresh green coniferous, clean forest air",5,{"4":12,"5A":7.0,"5B":3.5,"5C":4.0,"7B":5.0,"9":12,"2":5.0}),
  EO("Ginger","Spicy / Fresh","top","Warm zingy spice, energizing, fresh",4,{"4":5.0,"5A":3.0,"5B":1.5,"5C":2.0,"7B":2.0,"9":5.0,"2":2.0}),
  EO("Grapefruit","Citrus","top","Bright tangy citrus, slightly bitter, uplifting",3,{"4":8.0,"5A":5.0,"5B":2.5,"5C":3.0,"7B":3.5,"9":8.0,"2":3.5}),
  EO("Grapefruit White","Citrus","top","Cleaner lighter grapefruit, less bitter, fresher",3,{"4":8.0,"5A":5.0,"5B":2.5,"5C":3.0,"7B":3.5,"9":8.0,"2":3.5}),
  EO("Indian Frankincense","Resinous / Incense","base","Sacred resinous, warm smoky incense, meditative",5,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Juniper","Woody / Green","top-mid","Fresh gin-like, piney and crisp",5,{"4":10,"5A":6.0,"5B":3.0,"5C":4.0,"7B":4.0,"9":10,"2":4.0}),
  EO("Lavender","Herbal / Floral","mid","Classic herbal floral, calming, versatile",3,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Lemon Grass","Citrus / Herbal","top","Fresh lemony herbal, bright, high citral — sensitizer",3,{"4":3.0,"5A":1.5,"5B":0.5,"5C":0.8,"7B":1.0,"9":3.0,"2":1.0}),
  EO("Lemon Verbena","Citrus / Herbal","top","Delicate lemon, herbaceous, elegant",3,{"4":2.0,"5A":1.0,"5B":0.3,"5C":0.5,"7B":0.5,"9":2.0,"2":0.5}),
  EO("Lime","Citrus","top","Zesty sharp citrus, vibrant energy",4,{"4":6.0,"5A":4.0,"5B":2.0,"5C":2.5,"7B":2.5,"9":6.0,"2":2.5}),
  EO("Litsea Cubeba","Citrus / Herbal","top","Lemony sweet tropical, may chang character",3,{"4":4.0,"5A":2.0,"5B":1.0,"5C":1.5,"7B":1.5,"9":4.0,"2":1.5}),
  EO("Mandarin","Citrus","top","Sweet soft citrus, rounded and friendly",3,{"4":8.0,"5A":5.0,"5B":2.5,"5C":3.0,"7B":3.5,"9":8.0,"2":3.5}),
  EO("Myrrh","Resinous / Balsamic","base","Deep warm resinous, slightly medicinal, ancient",5,{"4":12,"5A":8.0,"5B":4.0,"5C":5.0,"7B":6.0,"9":12,"2":6.0}),
  EO("Orange 5x","Citrus","top","Concentrated sweet orange, 5-fold, intense",3,{"4":3.0,"5A":2.0,"5B":0.8,"5C":1.0,"7B":1.2,"9":3.0,"2":1.2}),
  EO("Palmarosa","Floral / Herbal","mid","Rose-like geranium, sweet grassy",2,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Patchouli","Woody / Earthy","base","Deep earthy, musky, camphoraceous sweet",4,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Petitgrain","Citrus / Green","top-mid","Green bitter orange leaf, woody citrus",4,{"4":12,"5A":8.0,"5B":4.0,"5C":5.0,"7B":6.0,"9":12,"2":6.0}),
  EO("Pine Needle","Woody / Green","top","Fresh forest, Christmas tree, turpentine hint",5,{"4":8.0,"5A":4.0,"5B":2.0,"5C":2.5,"7B":3.0,"9":8.0,"2":3.0}),
  EO("Rosemary","Herbal / Camphor","top-mid","Herbal camphor, fresh, Mediterranean",4,{"4":8.0,"5A":5.0,"5B":2.5,"5C":3.0,"7B":3.5,"9":8.0,"2":3.5}),
  EO("Rosewood","Woody / Floral","mid","Sweet woody floral, linalool-rich, elegant",3,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Sage","Herbal / Camphor","top-mid","Herbal camphorous, dry and cleansing",4,{"4":5.0,"5A":3.0,"5B":1.5,"5C":2.0,"7B":2.0,"9":5.0,"2":2.0}),
  EO("Sandalwood Amyris","Woody / Creamy","base","Creamy woody, softer than true sandalwood",4,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Spearmint","Herbal / Fresh","top","Sweet cool mint, gentler than peppermint",3,{"4":8.0,"5A":4.0,"5B":2.0,"5C":2.5,"7B":3.0,"9":8.0,"2":3.0}),
  EO("Sweet Birch","Woody / Minty","top-mid","Wintergreen-like, medicinal sweet — use sparingly",4,{"4":2.0,"5A":0.8,"5B":0.3,"5C":0.5,"7B":0.5,"9":2.0,"2":0.5}),
  EO("Sweet Orange","Citrus","top","Bright cheerful orange peel, uplifting",3,{"4":8.0,"5A":5.0,"5B":2.5,"5C":3.0,"7B":3.5,"9":8.0,"2":3.5}),
  EO("Thyme","Herbal / Spicy","mid","Strong herbal, thymol-rich — skin sensitizer",4,{"4":2.0,"5A":0.8,"5B":0.3,"5C":0.5,"7B":0.5,"9":2.0,"2":0.5}),
  S("Vanilla CO2 Extract","CO2","Gourmand / Sweet","base","Rich natural vanilla, warm comforting depth, thick",3,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Vetiver Java","Woody / Earthy","base","Deep smoky earthy, complex dark wood",5,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Ylang Ylang","Floral / Exotic","mid","Sweet exotic floral, heady, use sparingly in masc blends",2,{"4":5.0,"5A":3.0,"5B":1.5,"5C":2.0,"7B":2.0,"9":5.0,"2":2.0}),
  // Additional EOs from YouWish catalog useful for men's grooming
  EO("Neroli (Orange Blossom)","Floral / Citrus","mid","Orange blossom, honeyed, elegant, expensive",3,{"4":8.0,"5A":4.0,"5B":2.0,"5C":2.5,"7B":3.0,"9":8.0,"2":3.0}),
  EO("Eucalyptus","Herbal / Camphor","top","Sharp camphor, clearing, medicinal fresh",3,{"4":8.0,"5A":4.0,"5B":2.0,"5C":2.5,"7B":3.0,"9":8.0,"2":3.0}),
  EO("Tea Tree","Herbal / Medicinal","top-mid","Clean medicinal, antibacterial, sharp",3,{"4":5.0,"5A":3.0,"5B":1.5,"5C":2.0,"7B":2.0,"9":5.0,"2":2.0}),
  EO("Clary Sage","Herbal / Floral","mid","Herbaceous, slightly sweet, earthy floral",3,{"4":8.0,"5A":5.0,"5B":2.5,"5C":3.0,"7B":3.5,"9":8.0,"2":3.5}),
  EO("Geranium","Floral / Green","mid","Sweet rosy green, balancing, versatile",3,{"4":10,"5A":6.0,"5B":3.0,"5C":4.0,"7B":4.0,"9":10,"2":4.0}),
  EO("Ho Wood","Woody / Floral","mid","Similar to rosewood, linalool-rich, sustainable",3,{"4":15,"5A":10,"5B":5.0,"5C":6.0,"7B":8.0,"9":15,"2":8.0}),
  EO("Silver Fir","Woody / Green","top","Alpine forest, fresh balsamic, crisp mountain air",5,{"4":8.0,"5A":4.0,"5B":2.0,"5C":2.5,"7B":3.0,"9":8.0,"2":3.0}),
  EO("Marjoram","Herbal / Warm","mid","Warm herbaceous, grounding, calming middle note",3,{"4":8.0,"5A":5.0,"5B":2.5,"5C":3.0,"7B":3.5,"9":8.0,"2":3.5}),
  EO("Nutmeg","Spicy / Warm","mid","Warm spicy nutmeg, rich aromatic",4,{"4":5.0,"5A":3.0,"5B":1.0,"5C":1.5,"7B":2.0,"9":5.0,"2":2.0}),
  EO("Basil","Herbal / Green","top","Fresh green herbal, slightly anise, energizing",3,{"4":5.0,"5A":3.0,"5B":1.5,"5C":2.0,"7B":2.0,"9":5.0,"2":2.0}),
  // === FRAGRANCE OILS (parfumoliën) — YouWish catalog for men's grooming ===
  FO("Amberwood Twilight","Woody / Amber","base","Rich amber woods, warm twilight glow",4),
  FO("Anarchy","Aromatic / Spicy","mid","Bold rebellious, dark spice and musk",5),
  FO("Arabic Tonka","Oriental / Gourmand","base","Sweet tonka bean, warm Oriental coumarin depth",4),
  FO("Ayurveda","Herbal / Oriental","mid-base","Complex herbal, incense, meditative warmth",4),
  FO("Bay Rum","Spicy / Aromatic","mid","Classic barbershop bay rum, spice and citrus",5),
  FO("Boss in a Bottle Fragrance","Aromatic / Woody","mid-base","Designer-inspired: green apple, cinnamon, sandalwood",5),
  FO("Bourbon Street","Gourmand / Boozy","mid-base","Rich bourbon, caramel, oak barrel, vanilla",5),
  FO("Candied Citrus","Citrus / Gourmand","top","Sweet sugar-coated citrus, playful",2),
  FO("Cardamom & Cedar","Spicy / Woody","mid-base","Warm cardamom with dry cedar backbone",5),
  FO("Cashmere Noir & Oudh","Woody / Oriental","base","Dark luxurious oudh, soft cashmere, noir mood",5),
  FO("Cavalier","Aromatic / Fougère","mid","Classic masculine fougère: lavender, oak, musk",5),
  FO("Cedar & Amber","Woody / Amber","base","Warm cedar layered with golden amber resin",5),
  FO("Celestial Vanilla & Leather","Gourmand / Leather","base","Smooth vanilla wrapped in rich leather",5),
  FO("Coconut Cream","Gourmand / Tropical","mid","Rich creamy coconut, sweet tropical",2),
  FO("Cranberry","Fruity / Tart","top","Sharp tart berry, slightly sweet",2),
  FO("Cucumber","Green / Fresh","top","Cool crisp green, aquatic freshness",3),
  FO("Driftwood & Amber","Woody / Amber","base","Sun-dried wood, warm amber, coastal feel",4),
  FO("Fiery Pink Pepper & Oudh","Spicy / Woody","mid-base","Electric pink pepper heat meets dark oudh",5),
  FO("Fireplace in the Salon","Smoky / Woody","base","Crackling fire, smoky woods, leather salon warmth",5),
  FO("Forest Oudh & Balm","Woody / Balsamic","base","Deep forest floor, precious oudh, healing balm",5),
  FO("Frozen Margarita","Citrus / Gourmand","top","Zesty lime, salt, tequila sweetness",2),
  FO("Garlands & Pine","Woody / Green","top-mid","Christmas garland, fresh pine, festive",4),
  FO("Ginger Ale","Spicy / Fresh","top","Fizzy ginger, sweet citrus, effervescent",3),
  FO("Glowing Tobacco & Pimento","Tobacco / Spicy","mid-base","Warm glowing tobacco, allspice pimento heat",5),
  FO("Golden Pumpkin & Cardamom","Gourmand / Spicy","mid","Autumn pumpkin, golden cardamom spice",3),
  FO("Green Apple","Fruity / Green","top","Crisp tart green apple, fresh clean",3),
  FO("Green Fig","Fruity / Green","mid","Fresh green fig leaf, milky, slightly sweet",3),
  FO("Green Tea & Cactus Flower","Green / Floral","top-mid","Light green tea, delicate cactus bloom",3),
  FO("Hammam","Herbal / Warm","mid","Turkish bath, eucalyptus, warm steam, herbs",4),
  FO("Hickory & Suede","Woody / Leather","mid-base","Bergamot, leather, lavender, cypress, sandalwood, suede, tobacco",5),
  FO("Jing Jang","Oriental / Balance","mid","East-meets-West, herbal and warm balance",3),
  FO("Lime Basil & Mandarin","Citrus / Herbal","top","Jo Malone inspired: zesty lime, basil, mandarin",4),
  FO("Magnolia Leaf & Tonka","Floral / Gourmand","mid-base","Creamy magnolia, sweet tonka, soft",3),
  FO("Monoi de Tahiti","Tropical / Floral","mid","Gardenia-infused coconut oil, tropical",2),
  FO("Musk","Musk / Clean","base","Clean white musk, soft skin-like",3),
  FO("Natural Coconut Milk","Gourmand / Tropical","mid","Creamy natural coconut, soft milky",2),
  FO("Neroli & Shea Blossom","Floral / Citrus","mid","Orange blossom, honeyed, shea flower",2),
  FO("Oudh & Purple Patchouli","Woody / Earthy","base","Rich oudh, dark patchouli, deep mystical",5),
  FO("Palo Santo & Mahogany","Woody / Sacred","base","Holy wood, rich mahogany, spiritual warmth",5),
  FO("Pistachio & Salted Fig","Gourmand / Nutty","mid","Creamy pistachio, sweet salted fig",3),
  FO("Raw Honeycomb","Gourmand / Amber","mid-base","Natural beeswax honey, golden warm",3),
  FO("Royal Oudh Inspired","Woody / Oriental","base","Premium oudh accord, rose, saffron, regal",5),
  FO("Saffron & Oudh","Spicy / Woody","mid-base","Precious saffron, dark oudh, luxurious",5),
  FO("Sensual Sandalwood","Woody / Creamy","base","Smooth creamy sandalwood, sensual, skin-like",4),
  FO("Seventh Heaven","Oriental / Gourmand","base","Heavenly amber, vanilla, celestial warmth",3),
  FO("Shave & Cut Fragrance","Aromatic / Barbershop","mid","Classic barbershop, clean shave, powder musk",5),
  FO("Silver Sandalwood & Musk","Woody / Musk","base","Cool silver sandalwood, clean musk, modern",4),
  FO("Somali Soul","Resinous / Incense","base","Rich frankincense, myrrh, warm African soul",5),
  FO("Spiced Mahogany","Woody / Spicy","mid-base","Dark mahogany, clove and nutmeg spice",5),
  FO("Sweet Honey & Tobacco","Gourmand / Tobacco","mid-base","Golden honey, warm cured tobacco leaf",4),
  FO("Tobacco & Bay Leaf","Tobacco / Herbal","mid-base","Aromatic tobacco, warm bay laurel, classic",5),
  FO("Transformation","Aromatic / Complex","mid","Multi-faceted evolving blend",3),
  FO("Vintage Leather & Turmeric","Leather / Spicy","mid-base","Aged leather, golden turmeric, vintage",5),
  FO("Warm Birch Wood","Woody / Smoky","base","Warm birch, slightly smoky campfire glow",5),
  FO("Wild Violets & Peony","Floral / Green","mid","Sweet violet, lush peony, powdery",1),
  // Extra YouWish FOs that fit men's grooming or could be useful
  FO("Africa Inspired","Woody / Fougère","mid","Rich woody fougère, mandarin, bergamot, herbs, oak",5),
  FO("Bergamot Black Tea","Citrus / Tea","top-mid","Bright bergamot meets black tea depth",4),
  FO("Dark Honey & Tobacco","Gourmand / Tobacco","base","Dark amber honey, rich cured tobacco",5),
  FO("Leather & Oud","Leather / Woody","base","Rich tanned leather, dark precious oud",5),
  FO("Noir Amber","Amber / Dark","base","Dark mysterious amber, resinous depth, smoky",5),
  FO("Sandalwood & Musk","Woody / Musk","base","Classic sandalwood cream with clean musk",4),
  FO("Tobacco Vanille Inspired","Gourmand / Tobacco","base","Tom Ford inspired: tobacco, vanilla, spice, honey",5),
  FO("Vetiver & Golden Amber","Woody / Amber","base","Earthy vetiver meets warm golden amber",5),
  FO("Whiskey & Smoke","Smoky / Boozy","base","Smoky peat, aged whiskey, warm amber",5),
  FO("Wood Sage & Sea Salt","Aromatic / Marine","mid","Jo Malone inspired: ambrette, sage, sea salt, driftwood",4),
];
const BASES = [
  // CARRIER OILS
  {name:"Jojoba Oil",inci:"Simmondsia Chinensis Seed Oil",role:"carrier",products:["beard_oil","body_lotion","hand_cream"],notes:"Closest to skin sebum. Non-comedogenic. Premium base.",youwish:true,maxPct:100,defaultPct:40},
  {name:"Jojoba Oil (Clear/Deodorized)",inci:"Simmondsia Chinensis Seed Oil",role:"carrier",products:["beard_oil","pomade"],notes:"Same as golden but no scent — won't interfere with fragrance.",youwish:true,maxPct:100,defaultPct:40},
  {name:"Argan Oil (Deodorized)",inci:"Argania Spinosa Kernel Oil",role:"carrier",products:["beard_oil","body_lotion"],notes:"Rich vitamin E, softening, deodorized for clean scent profile.",youwish:true,maxPct:100,defaultPct:25},
  {name:"Sweet Almond Oil",inci:"Prunus Amygdalus Dulcis Oil",role:"carrier",products:["beard_oil","body_lotion","hand_cream"],notes:"Light, good absorption, mild nutty scent.",youwish:true,maxPct:100,defaultPct:25},
  {name:"Castor Oil",inci:"Ricinus Communis Seed Oil",role:"carrier",products:["beard_oil","pomade","soap_bar"],notes:"Thick, glossy, binding. Creates lather in soap.",youwish:true,maxPct:30,defaultPct:10},
  {name:"Castor Oil (Cold-Pressed Organic)",inci:"Ricinus Communis Seed Oil",role:"carrier",products:["beard_oil","pomade"],notes:"Organic cold-pressed version. Premium quality.",youwish:true,maxPct:30,defaultPct:10},
  {name:"Sunflower Oil",inci:"Helianthus Annuus Seed Oil",role:"carrier",products:["pomade","body_lotion","soap_bar"],notes:"Light conditioning, vitamin E rich, affordable base.",youwish:true,maxPct:100,defaultPct:15},
  {name:"Grapeseed Oil",inci:"Vitis Vinifera Seed Oil",role:"carrier",products:["beard_oil","body_lotion"],notes:"Very light, fast absorbing, non-greasy.",youwish:true,maxPct:100,defaultPct:20},
  {name:"Hemp Seed Oil (Organic)",inci:"Cannabis Sativa Seed Oil",role:"carrier",products:["beard_oil","body_lotion"],notes:"Rich omega fatty acids, fast absorbing, green tint.",youwish:true,maxPct:100,defaultPct:15},
  {name:"Avocado Oil",inci:"Persea Gratissima Oil",role:"carrier",products:["beard_oil","body_lotion","hand_cream"],notes:"Rich, nourishing, slower absorbing. Good for dry skin.",youwish:true,maxPct:100,defaultPct:15},
  {name:"Coconut Oil (Fractionated)",inci:"Caprylic/Capric Triglyceride",role:"carrier",products:["beard_oil","body_lotion","perfume_edp"],notes:"Always liquid, odorless, light. Good perfume carrier.",youwish:true,maxPct:100,defaultPct:20},
  // WAXES
  {name:"Berry Wax",inci:"Rhus Verniciflua Peel Cera",role:"wax",products:["pomade","solid_cologne"],notes:"Plant wax for hold and texture. Medium hold.",youwish:true,maxPct:25,defaultPct:8},
  {name:"Carnauba Wax",inci:"Copernicia Cerifera Cera",role:"wax",products:["pomade","solid_cologne"],notes:"Hardest natural wax. High hold, shine.",youwish:true,maxPct:15,defaultPct:4},
  {name:"Beeswax (White)",inci:"Cera Alba",role:"wax",products:["pomade","solid_cologne","hand_cream"],notes:"Natural hold, slight honey scent. Classic pomade ingredient.",youwish:true,maxPct:30,defaultPct:10},
  {name:"Beeswax (Yellow)",inci:"Cera Flava",role:"wax",products:["pomade","solid_cologne"],notes:"Unbleached beeswax. Stronger honey scent.",youwish:true,maxPct:30,defaultPct:10},
  {name:"Candelilla Wax",inci:"Euphorbia Cerifera Cera",role:"wax",products:["pomade","solid_cologne"],notes:"Vegan wax alternative to beeswax. Hard, glossy.",youwish:true,maxPct:20,defaultPct:6},
  {name:"Sunflower Wax",inci:"Helianthus Annuus Seed Cera",role:"wax",products:["pomade","solid_cologne"],notes:"Vegan, high melting point, natural origin.",youwish:true,maxPct:15,defaultPct:5},
  // BUTTERS
  {name:"Shea Butter",inci:"Butyrospermum Parkii Butter",role:"carrier",products:["pomade","body_lotion","hand_cream","solid_cologne"],notes:"Rich, nourishing, adds creaminess and body.",youwish:true,maxPct:50,defaultPct:10},
  {name:"Cocoa Butter",inci:"Theobroma Cacao Seed Butter",role:"carrier",products:["pomade","solid_cologne","body_lotion"],notes:"Hard butter, chocolate scent. Firmness + nourishment.",youwish:true,maxPct:30,defaultPct:8},
  {name:"Mango Butter",inci:"Mangifera Indica Seed Butter",role:"carrier",products:["body_lotion","hand_cream"],notes:"Light, non-greasy butter. Good skin feel.",youwish:true,maxPct:40,defaultPct:10},
  // EMULSIFIERS
  {name:"Olivem 1000",inci:"Cetearyl Olivate, Sorbitan Olivate",role:"emulsifier",products:["pomade","body_lotion","hand_cream"],notes:"Olive-derived O/W emulsifier. Creates stable lotions.",youwish:true,maxPct:8,defaultPct:5},
  {name:"BTMS-50",inci:"Behentrimonium Methosulfate, Cetyl Alcohol",role:"emulsifier",products:["body_lotion","hand_cream"],notes:"Conditioning emulsifier. Hair/skin feel.",youwish:true,maxPct:8,defaultPct:5},
  // PRESERVATIVES & ANTIOXIDANTS
  {name:"Vitamin E Oil (Tocopherol)",inci:"Tocopherol",role:"preservative",products:["beard_oil","pomade","body_lotion","hand_cream","solid_cologne"],notes:"Antioxidant. Prevents oil rancidity. Skin nourishing. 0.5-1%.",youwish:true,maxPct:2,defaultPct:0.5},
  {name:"Glyceryl Caprylate",inci:"Glyceryl Caprylate",role:"preservative",products:["pomade","body_lotion","hand_cream"],notes:"Mild preservative booster. Coconut-derived.",youwish:true,maxPct:2,defaultPct:1},
  {name:"Rosemary Extract (ROE)",inci:"Rosmarinus Officinalis Leaf Extract",role:"preservative",products:["beard_oil","pomade","body_lotion"],notes:"Natural antioxidant for oils. Extends shelf life.",youwish:true,maxPct:0.5,defaultPct:0.2},
  // SOLVENTS & BASES
  {name:"Demi Water (Aqua)",inci:"Aqua",role:"solvent",products:["pomade","body_lotion","hand_cream","body_wash","shampoo"],notes:"Demineralized water. Water phase base.",youwish:true,maxPct:80,defaultPct:50},
  {name:"Parfumeurs Alcohol",inci:"Alcohol Denat.",role:"solvent",products:["perfume_edp","perfume_edt","aftershave"],notes:"Denatured ethanol base for perfume. From YouWish.",youwish:true,maxPct:95,defaultPct:80},
  // SURFACTANTS & CLEANSERS
  {name:"Cocofoam (Coco Glucoside)",inci:"Coco-Glucoside",role:"surfactant",products:["pomade","body_wash","shampoo"],notes:"Gentle plant-derived cleanser. Wash-out aid in pomade.",youwish:true,maxPct:15,defaultPct:5},
  {name:"Sodium Cocoyl Isethionate (SCI)",inci:"Sodium Cocoyl Isethionate",role:"surfactant",products:["soap_bar","shampoo"],notes:"Gentle coconut-derived surfactant. Syndet bars.",youwish:true,maxPct:60,defaultPct:40},
  // TEXTURIZERS & ACTIVES
  {name:"Diatomaceous Earth",inci:"Diatomaceous Earth",role:"texturizer",products:["pomade"],notes:"Natural matte finish. Absorbs oil, adds body to pomade.",youwish:true,maxPct:8,defaultPct:3},
  {name:"Triethyl Citrate",inci:"Triethyl Citrate",role:"active",products:["pomade","aftershave"],notes:"Citric acid ester. Deodorant properties. Fragrance fixative.",youwish:true,maxPct:5,defaultPct:2},
  {name:"Glycerine (Vegetable)",inci:"Glycerin",role:"active",products:["pomade","body_lotion","hand_cream","soap_bar","body_wash"],notes:"Humectant. Draws moisture to skin. Versatile.",youwish:true,maxPct:10,defaultPct:3},
  {name:"Kaolin Clay",inci:"Kaolin",role:"texturizer",products:["pomade"],notes:"White clay. Matte finish, oil absorption, texture.",youwish:true,maxPct:10,defaultPct:3},
  {name:"Bentonite Clay",inci:"Bentonite",role:"texturizer",products:["pomade"],notes:"Strong oil absorption. Matte hold. Thickening.",youwish:true,maxPct:8,defaultPct:2},
  {name:"D-Panthenol (Provitamin B5)",inci:"Panthenol",role:"active",products:["body_lotion","hand_cream","shampoo","body_wash"],notes:"Moisturizing, healing, hair strengthening. 1-5%.",youwish:true,maxPct:5,defaultPct:2},
  {name:"Allantoin",inci:"Allantoin",role:"active",products:["aftershave","body_lotion","hand_cream"],notes:"Soothing, anti-irritant. Great in aftershave. 0.1-0.5%.",youwish:true,maxPct:0.5,defaultPct:0.2},
];
// Packaging items loaded from Google Sheet (tab: packaging)
let PACKAGING_ITEMS = [];
function rowToPackaging(r) {
  return {
    name: r.name||'', description: r.description||'', category: r.category||'container',
    price_eur: parseFloat(r.price_eur)||0, per_unit: r.per_unit||'piece',
    for_product: r.for_product||'all', url: r.url||'', notes: r.notes||''
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
const inp = {background:bgInput,border:`1px solid ${border}`,borderRadius:6,padding:"7px 10px",color:textMain,fontSize:13,fontFamily:"'Open Sans',sans-serif",outline:"none",width:"100%",boxSizing:"border-box"};
const lbl = {display:"block",fontSize:10,color:textMuted,marginBottom:3,textTransform:"uppercase",letterSpacing:1,fontWeight:600,fontFamily:"'Open Sans',sans-serif"};
const card = {background:bgCard,borderRadius:10,border:`1px solid ${border}`,padding:"14px 16px",marginBottom:12};
const btn = {border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Open Sans',sans-serif"};
const TypeBadge = ({t}) => {
  const c = {EO:"#4a9c5a",FO:"#b89a4a",CO2:"#7a6a9c",ABS:"#9c5a7a"}[t]||"#666";
  const l = {EO:"Essential",FO:"Fragrance",CO2:"CO₂",ABS:"Absolute"}[t]||t;
  return <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:c+"25",color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,fontFamily:"'Open Sans',sans-serif"}}>{l}</span>;
};
const Dots = ({n,max=5}) => <span style={{fontSize:10,letterSpacing:1}}>{Array.from({length:max},(_,i)=><span key={i} style={{color:i<n?gold:textDim}}>●</span>)}</span>;
const Warn = ({children}) => <div style={{padding:"8px 12px",borderRadius:8,background:"#2a1520",border:`1px solid ${danger}40`,fontSize:12,color:"#f0a0a0",marginTop:8,fontFamily:"'Open Sans',sans-serif"}}>{children}</div>;
const Ok = ({children}) => <div style={{padding:"8px 12px",borderRadius:8,background:"#152a18",border:`1px solid ${ok}40`,fontSize:12,color:"#a0d0a0",marginTop:8,fontFamily:"'Open Sans',sans-serif"}}>{children}</div>;
const Pill = ({color=textMuted,bg:pbg=bgInput,children}) => <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:pbg,color,fontWeight:600,whiteSpace:"nowrap",fontFamily:"'Open Sans',sans-serif"}}>{children}</span>;
function App() {
  const [tab, setTab] = useState("library");
  const [recipes, setRecipes] = useState([]);
  useEffect(() => {
    (async()=>{try{const r=await store.get("bb-recipes");if(r?.value)setRecipes(JSON.parse(r.value));}catch(e){}})();
  }, []);
  const save = useCallback(async(r)=>{
    setRecipes(r);
    try{await store.set("bb-recipes",JSON.stringify(r));}catch(e){console.error(e);}
  },[]);
  const tabs = [{id:"library",icon:"🧴",label:"Scents"},{id:"ingredients",icon:"🧪",label:"Base"},{id:"builder",icon:"⚗️",label:"Recipe Builder"},{id:"recipes",icon:"📋",label:"Recipes"},{id:"production",icon:"🏭",label:"Production"},{id:"packaging",icon:"📦",label:"Packaging"},{id:"costs",icon:"💰",label:"Costs"}];
  return (
    <div style={{fontFamily:"'Open Sans',sans-serif",background:bg,color:textMain,minHeight:"100vh"}}>
      <link href="https://fonts.googleapis.com/css2?family=Odibee+Sans&family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      {/* HEADER */}
      <div style={{borderBottom:`1px solid ${border}`}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"14px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{fontFamily:"'Odibee Sans',cursive",fontSize:26,color:"#ffffff",letterSpacing:3,textTransform:"uppercase",lineHeight:1}}>BOEGBEELD</div>
            <div style={{height:20,width:1,background:border}}/>
            <div style={{fontFamily:"'Odibee Sans',cursive",fontSize:18,color:gold,letterSpacing:2,textTransform:"uppercase"}}>Creation Lab</div>
          </div>
          <div style={{display:"flex",gap:0,overflowX:"auto"}}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 16px",background:"none",border:"none",borderBottom:tab===t.id?`2px solid ${gold}`:"2px solid transparent",color:tab===t.id?gold:"#ffffff",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Odibee Sans',cursive",letterSpacing:1,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",transition:"all 0.2s",textTransform:"uppercase"}}>
                <span>{t.icon}</span>{t.label}{t.id==="recipes"&&recipes.length>0&&<span style={{background:gold+"30",color:gold,borderRadius:10,padding:"0 5px",fontSize:10,marginLeft:2}}>{recipes.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"12px 16px 40px"}}>
        {tab==="library"&&<Library/>}
        {tab==="ingredients"&&<IngredientsLib/>}
        {tab==="builder"&&<Builder recipes={recipes} save={save} goRecipes={()=>setTab("recipes")}/>}
        {tab==="recipes"&&<Recipes recipes={recipes} save={save} goBuilder={()=>setTab("builder")}/>}
        {tab==="production"&&<Production recipes={recipes}/>}
        {tab==="packaging"&&<Packaging/>}
        {tab==="costs"&&<CostCalc recipes={recipes}/>}
      </div>
    </div>
  );
}
function Library() {
  const [q,setQ]=useState("");
  const [tf,setTf]=useState("all");
  const [ff,setFf]=useState("all");
  const [mf,setMf]=useState(0);
  const [cv,setCv]=useState("all");
  const [exp,setExp]=useState(null);
  const [customs,setCustoms]=useState([]);
  const [overrides,setOverrides]=useState({});
  const [editing,setEditing]=useState(null);
  useEffect(()=>{(async()=>{
    try{const r=await store.get("bb-custom-scents");if(r?.value)setCustoms(JSON.parse(r.value));}catch(e){}
    try{const r=await store.get("bb-scent-overrides");if(r?.value)setOverrides(JSON.parse(r.value));}catch(e){}
  })();},[]);
  const saveCustoms=async(c)=>{setCustoms(c);try{await store.set("bb-custom-scents",JSON.stringify(c));}catch(e){}};
  const saveOverrides=async(o)=>{setOverrides(o);try{await store.set("bb-scent-overrides",JSON.stringify(o));}catch(e){}};
  const setOverride=(name,field,val)=>{const o={...overrides,[name]:{...(overrides[name]||{}),[field]:val}};saveOverrides(o);};
  // Merge overrides into scent data
  const getScent=(s)=>{const ov=overrides[s.name]||{};return {...s,url:ov.url||s.url||null,ifra:ov.ifra?{...s.ifra,...ov.ifra}:s.ifra,pricePer100ml:ov.pricePer100ml||(s.type==="FO"?29.50:s.type==="CO2"?45.00:25.00),priceSize:ov.priceSize||100,ifraSource:ov.ifraVerified?"verified":s.ifraSource};};
  const allScents = [...SCENTS,...customs].map(getScent);
  const families = useMemo(()=>[...new Set(allScents.map(s=>s.family.split(" / ")[0]))].sort(),[customs]);
  const filtered = useMemo(()=>allScents.filter(s=>{
    if(q&&!s.name.toLowerCase().includes(q.toLowerCase())&&!s.profile.toLowerCase().includes(q.toLowerCase())&&!s.family.toLowerCase().includes(q.toLowerCase()))return false;
    if(tf!=="all"&&s.type!==tf)return false;
    if(ff!=="all"&&!s.family.startsWith(ff))return false;
    if(mf>0&&s.masculine<mf)return false;
    return true;
  }),[q,tf,ff,mf,customs]);
  const scentUrl=(name)=>{const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,"");return `https://www.youwish.nl/en/?s=${encodeURIComponent(name)}&post_type=product`;};
  return <div>
    <h2 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20,margin:"0 0 4px",letterSpacing:3,textTransform:"uppercase"}}>Scent Library <span style={{fontSize:11,color:textMuted,fontFamily:"'Open Sans'",letterSpacing:0,textTransform:"none"}}>({allScents.length} scents)</span></h2>
    <p style={{color:textMuted,fontSize:12,margin:"0 0 12px"}}>YouWish fragrance oils & essential oils. Click any row to expand IFRA details. Filter by category to see max %.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12,alignItems:"center"}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search scent, profile, family..." style={{...inp,flex:"1 1 180px",minWidth:150}}/>
      <select value={tf} onChange={e=>setTf(e.target.value)} style={{...inp,width:130}}><option value="all">All Types</option><option value="EO">Essential Oil</option><option value="FO">Fragrance Oil</option><option value="CO2">CO₂ Extract</option></select>
      <select value={ff} onChange={e=>setFf(e.target.value)} style={{...inp,width:140}}><option value="all">All Families</option>{families.map(f=><option key={f} value={f}>{f}</option>)}</select>
      <select value={mf} onChange={e=>setMf(+e.target.value)} style={{...inp,width:140}}><option value={0}>Any Masculinity</option><option value={3}>3+ Unisex-Masc</option><option value={4}>4+ Masculine</option><option value={5}>5 Very Masculine</option></select>
      <select value={cv} onChange={e=>setCv(e.target.value)} style={{...inp,width:200,background:cv!=="all"?`${gold}15`:bgInput,borderColor:cv!=="all"?gold:border}}>
        <option value="all">All Categories (no filter)</option>
        {IFRA_CAT_ORDER.map(k=><option key={k} value={k}>Cat {k}: {IFRA_CATS[k].label}</option>)}
      </select>
      <a href={SHEETS_CONFIG.editUrl+"#gid=0"} target="_blank" rel="noopener noreferrer" style={{...btn,background:bgInput,color:gold,border:`1px solid ${gold}40`,fontSize:11,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>+ Add in Google Sheet</a>
    </div>
    <div style={{fontSize:11,color:textMuted,marginBottom:8}}>
      Showing <strong style={{color:textMain}}>{filtered.length}</strong>
      {cv!=="all"&&<> — Max % for <strong style={{color:gold}}>Cat {cv}</strong> ({IFRA_CATS[cv].label})</>}
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`1px solid ${border}`}}>
          {["Name","Type","Family","Note",cv!=="all"?"IFRA Max %":"IFRA","Masculinity","Links"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:textDim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map((s,i)=>{
          const mx=cv!=="all"?(s.ifra[cv]||0):null;
          const open=exp===s.name;
          const url=s.url||scentUrl(s.name);
          return (<React.Fragment key={s.name}>
            <tr onClick={()=>setExp(open?null:s.name)} style={{borderBottom:`1px solid ${border}30`,cursor:"pointer",background:open?bgCard:"transparent",transition:"background .15s"}} onMouseEnter={e=>{if(!open)e.currentTarget.style.background=`${bg}ee`}} onMouseLeave={e=>{if(!open)e.currentTarget.style.background="transparent"}}>
              <td style={{padding:"6px 8px",fontWeight:600,maxWidth:200}}>{s.name}<span style={{fontSize:8,marginLeft:4,padding:"1px 4px",borderRadius:3,background:s.ifraSource==="verified"?`${ok}15`:`${warn}10`,color:s.ifraSource==="verified"?ok:warn}}>{s.ifraSource==="verified"?"✓":"est"}</span></td>
              <td style={{padding:"6px 8px"}}><TypeBadge t={s.type}/></td>
              <td style={{padding:"6px 8px",color:textMuted,fontSize:11}}>{s.family}</td>
              <td style={{padding:"6px 8px",color:textMuted,fontSize:11}}>{s.note}</td>
              {cv!=="all"&&<td style={{padding:"6px 8px"}}><span style={{color:mx===0?danger:mx<1?warn:ok,fontWeight:600}}>{mx===0?"⛔":""+mx+"%"}</span></td>}
              {cv==="all"&&<td style={{padding:"6px 8px",color:textDim}}>—</td>}
              <td style={{padding:"6px 8px"}}><Dots n={s.masculine}/></td>
              <td style={{padding:"6px 4px"}}><a href={url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:gold,fontSize:10,textDecoration:"none",opacity:0.7}}>🔗</a></td>
            </tr>
            {open&&<tr><td colSpan={7} style={{padding:"0 8px 8px",background:bgCard}}><div style={{padding:"10px 14px",borderRadius:8,background:bgInput,border:`1px solid ${border}`}}>
              <div style={{fontSize:11,color:textMain,marginBottom:8}}><strong style={{color:gold}}>Profile:</strong> {s.profile}</div>
              {s.inci&&<div style={{fontSize:11,color:textMuted,marginBottom:8,fontStyle:"italic"}}><strong style={{color:gold}}>INCI:</strong> {s.inci}</div>}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:s.ifraSource==="verified"?`${ok}20`:`${warn}20`,color:s.ifraSource==="verified"?ok:warn,fontWeight:600}}>IFRA: {s.ifraSource==="verified"?"[x] Verified":"⚠ Estimated"}</span>
                <span style={{fontSize:10,color:textDim}}>€{(s.pricePer100ml||0).toFixed(2)}/100ml</span>
                <button onClick={e=>{e.stopPropagation();setEditing(editing===s.name?null:s.name);}} style={{...btn,fontSize:10,color:gold,background:"transparent",border:`1px solid ${gold}30`,padding:"2px 8px"}}>{editing===s.name?"Close":"✏️ Edit"}</button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                {IFRA_CAT_ORDER.map(cat=>{const v=s.ifra[cat]||0;return <div key={cat} style={{padding:"3px 8px",borderRadius:5,background:cv===cat?`${gold}15`:bgCard,border:`1px solid ${cv===cat?gold:border}`,fontSize:10}}>
                  <span style={{color:textMuted}}>Cat {cat}:</span> <span style={{color:v===0?danger:gold,fontWeight:600}}>{v===0?"⛔":v+"%"}</span>
                </div>})}
              </div>
              {editing===s.name&&<div style={{padding:"8px 10px",borderRadius:6,background:bgCard,border:`1px solid ${gold}20`,marginBottom:8}}>
                <div style={{fontSize:10,color:gold,fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Edit — saves automatically</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:6}}>
                  <div style={{flex:"1 1 220px"}}><label style={lbl}>Product URL</label><input defaultValue={overrides[s.name]?.url||s.url||""} onBlur={e=>setOverride(s.name,"url",e.target.value)} placeholder="https://www.youwish.nl/en/shop/..." style={inp}/></div>
                  <div style={{flex:"0 0 90px"}}><label style={lbl}>Price (€)</label><input type="number" step="0.01" defaultValue={overrides[s.name]?.pricePer100ml||""} onBlur={e=>setOverride(s.name,"pricePer100ml",parseFloat(e.target.value)||0)} placeholder={String(s.pricePer100ml||"")} style={inp}/></div>
                  <div style={{flex:"0 0 70px"}}><label style={lbl}>Per (ml)</label><input type="number" defaultValue={overrides[s.name]?.priceSize||100} onBlur={e=>setOverride(s.name,"priceSize",parseInt(e.target.value)||100)} style={inp}/></div>
                </div>
                <div style={{fontSize:10,color:textMuted,marginBottom:4}}>IFRA Max % per category:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                  {IFRA_CAT_ORDER.map(cat=><div key={cat} style={{display:"flex",alignItems:"center",gap:2}}>
                    <span style={{fontSize:9,color:textMuted,minWidth:30}}>Cat{cat}</span>
                    <input type="number" step="0.01" defaultValue={overrides[s.name]?.ifra?.[cat]??""} onBlur={e=>{const iv={...(overrides[s.name]?.ifra||{}),[cat]:parseFloat(e.target.value)};setOverride(s.name,"ifra",iv);}} placeholder={String(s.ifra[cat]||0)} style={{...inp,width:50,textAlign:"center",padding:"2px 4px",fontSize:10}}/>
                  </div>)}
                  <label style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:textMuted,cursor:"pointer",marginLeft:8}}>
                    <input type="checkbox" checked={overrides[s.name]?.ifraVerified||false} onChange={e=>setOverride(s.name,"ifraVerified",e.target.checked)}/> Verified [x]
                  </label>
                </div>
              </div>}
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <a href={s.url||scentUrl(s.name)} target="_blank" rel="noopener noreferrer" style={{color:gold,fontSize:11,textDecoration:"underline"}}>View on YouWish -></a>
                {s.custom&&<button onClick={()=>saveCustoms(customs.filter(c=>c.name!==s.name))} style={{...btn,color:danger,background:"transparent",border:`1px solid ${danger}30`,fontSize:10}}>Remove</button>}
              </div>
            </div></td></tr>}
          </React.Fragment>);
        })}</tbody>
      </table>
    </div>
  </div>;
}
function IngredientsLib() {
  const [q,setQ]=useState("");
  const [rf,setRf]=useState("all");
  const [exp,setExp]=useState(null);
  const [customs,setCustoms]=useState([]);
  const [overrides,setOverrides]=useState({});
  const [showAdd,setShowAdd]=useState(false);
  const [editing,setEditing]=useState(null);
  const [nName,setNName]=useState("");
  const [nInci,setNInci]=useState("");
  const [nRole,setNRole]=useState("carrier");
  const [nUrl,setNUrl]=useState("");
  useEffect(()=>{(async()=>{
    try{const r=await store.get("bb-custom-bases");if(r?.value)setCustoms(JSON.parse(r.value));}catch(e){}
    try{const r=await store.get("bb-base-overrides");if(r?.value)setOverrides(JSON.parse(r.value));}catch(e){}
  })();},[]);
  const saveCustoms=async(c)=>{setCustoms(c);try{await store.set("bb-custom-bases",JSON.stringify(c));}catch(e){}};
  const saveOverrides=async(o)=>{setOverrides(o);try{await store.set("bb-base-overrides",JSON.stringify(o));}catch(e){}};
  const setOverride=(name,field,val)=>{const o={...overrides,[name]:{...(overrides[name]||{}),[field]:val}};saveOverrides(o);};
  const getBase=(b)=>{const ov=overrides[b.name]||{};return {...b,url:ov.url||b.url||null,maxPct:ov.maxPct||b.maxPct,pricePer100:ov.pricePer100||(b.role==="carrier"?8.00:b.role==="wax"?12.00:b.role==="emulsifier"?15.00:b.role==="solvent"?2.00:10.00),priceSize:ov.priceSize||100};};
  const allBases=[...BASES,...customs].map(getBase);
  const roles=[...new Set(allBases.map(b=>b.role))].sort();
  const filtered=allBases.filter(b=>{
    if(q&&!b.name.toLowerCase().includes(q.toLowerCase())&&!b.inci.toLowerCase().includes(q.toLowerCase()))return false;
    if(rf!=="all"&&b.role!==rf)return false;
    return true;
  });
  const baseUrl=(name)=>`https://www.youwish.nl/en/?s=${encodeURIComponent(name)}&post_type=product`;
  return <div>
    <h2 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20,margin:"0 0 4px",letterSpacing:3,textTransform:"uppercase"}}>Base Ingredients <span style={{fontSize:11,color:textMuted,fontFamily:"'Open Sans'",letterSpacing:0,textTransform:"none"}}>({allBases.length})</span></h2>
    <p style={{color:textMuted,fontSize:12,margin:"0 0 12px"}}>Base ingredients from YouWish. Click to expand details. Links go to YouWish product search.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search ingredient or INCI..." style={{...inp,flex:"1 1 200px"}}/>
      <select value={rf} onChange={e=>setRf(e.target.value)} style={{...inp,width:150}}><option value="all">All Roles</option>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select>
      <a href={SHEETS_CONFIG.editUrl+"#gid=874764417"} target="_blank" rel="noopener noreferrer" style={{...btn,background:bgInput,color:gold,border:`1px solid ${gold}40`,fontSize:11,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>+ Add in Google Sheet</a>
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`1px solid ${border}`}}>
          {["Name","INCI","Role","Max %","Products","Links"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:textDim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(b=>{
          const open=exp===b.name;
          const url=b.url||baseUrl(b.name);
          return <React.Fragment key={b.name}>
            <tr onClick={()=>setExp(open?null:b.name)} style={{borderBottom:`1px solid ${border}30`,cursor:"pointer",background:open?bgCard:"transparent",transition:"background .15s"}} onMouseEnter={e=>{if(!open)e.currentTarget.style.background=`${bg}ee`}} onMouseLeave={e=>{if(!open)e.currentTarget.style.background="transparent"}}>
              <td style={{padding:"6px 8px",fontWeight:600}}>{b.name}{b.custom&&<span style={{color:gold,fontSize:9,marginLeft:4}}>✎</span>}</td>
              <td style={{padding:"6px 8px",color:textMuted,fontSize:11,fontStyle:"italic"}}>{b.inci}</td>
              <td style={{padding:"6px 8px"}}><span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:`${gold}15`,color:gold,fontWeight:600,textTransform:"uppercase"}}>{b.role}</span></td>
              <td style={{padding:"6px 8px",color:textMuted}}>{b.maxPct}%</td>
              <td style={{padding:"6px 8px",color:textDim,fontSize:10}}>{(b.products||[]).map(p=>PRODUCTS[p]?.name).filter(Boolean).slice(0,3).join(", ")}{(b.products||[]).length>3?"...":""}</td>
              <td style={{padding:"6px 4px"}}><a href={url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:gold,fontSize:10,textDecoration:"none",opacity:0.7}}>🔗</a></td>
            </tr>
            {open&&<tr><td colSpan={6} style={{padding:"0 8px 8px",background:bgCard}}><div style={{padding:"10px 14px",borderRadius:8,background:bgInput,border:`1px solid ${border}`}}>
              <div style={{fontSize:11,color:textMain,marginBottom:6}}><strong style={{color:gold}}>Notes:</strong> {b.notes}</div>
              <div style={{fontSize:11,color:textMuted,marginBottom:6}}>Default %: {b.defaultPct}% · Max: {b.maxPct}% · €{(b.pricePer100||0).toFixed(2)}/{b.priceSize||100}ml · {b.youwish?"YouWish":"External"}</div>
              <div style={{fontSize:11,color:textMuted,marginBottom:6}}>Used in: {(b.products||[]).map(p=>PRODUCTS[p]?.name).filter(Boolean).join(", ")}</div>
              <button onClick={e=>{e.stopPropagation();setEditing(editing===b.name?null:b.name);}} style={{...btn,fontSize:10,color:gold,background:"transparent",border:`1px solid ${gold}30`,padding:"2px 8px",marginBottom:6}}>{editing===b.name?"Close":"✏️ Edit"}</button>
              {editing===b.name&&<div style={{padding:"8px 10px",borderRadius:6,background:bgCard,border:`1px solid ${gold}20`,marginBottom:8}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  <div style={{flex:"1 1 220px"}}><label style={lbl}>Product URL</label><input defaultValue={overrides[b.name]?.url||b.url||""} onBlur={e=>setOverride(b.name,"url",e.target.value)} placeholder="https://www.youwish.nl/..." style={inp}/></div>
                  <div style={{flex:"0 0 80px"}}><label style={lbl}>Max %</label><input type="number" step="1" defaultValue={overrides[b.name]?.maxPct||""} onBlur={e=>setOverride(b.name,"maxPct",parseFloat(e.target.value)||0)} placeholder={String(b.maxPct)} style={inp}/></div>
                  <div style={{flex:"0 0 80px"}}><label style={lbl}>Price (€)</label><input type="number" step="0.01" defaultValue={overrides[b.name]?.pricePer100||""} onBlur={e=>setOverride(b.name,"pricePer100",parseFloat(e.target.value)||0)} placeholder={String(b.pricePer100||"")} style={inp}/></div>
                  <div style={{flex:"0 0 65px"}}><label style={lbl}>Per (ml)</label><input type="number" defaultValue={overrides[b.name]?.priceSize||100} onBlur={e=>setOverride(b.name,"priceSize",parseInt(e.target.value)||100)} style={inp}/></div>
                </div>
              </div>}
              <a href={b.url||baseUrl(b.name)} target="_blank" rel="noopener noreferrer" style={{color:gold,fontSize:11,textDecoration:"underline"}}>View on YouWish -></a>
              {b.custom&&<button onClick={()=>saveCustoms(customs.filter(c=>c.name!==b.name))} style={{...btn,marginLeft:10,color:danger,background:"transparent",border:`1px solid ${danger}30`,fontSize:10}}>Remove</button>}
            </div></td></tr>}
          </React.Fragment>;
        })}</tbody>
      </table>
    </div>
  </div>;
}
function Builder({recipes,save,goRecipes}) {
  const [pt,setPt]=useState("pomade");
  const [cb,setCb]=useState("50");
  const [cbUnit,setCbUnit]=useState("g");
  const [baseRows,setBaseRows]=useState([]);
  const [scentRows,setScentRows]=useState([]);
  const [name,setName]=useState("");
  const [notes,setNotes]=useState("");
  const [saved,setSaved]=useState(false);
  const [showPifInfo,setShowPifInfo]=useState(false);
  const preset=PRODUCTS[pt];
  const cat=preset.cat;
  const batchSize=parseFloat(cb)||preset.test;
  const batchUnit=cbUnit;
  // Auto-filter bases for product
  const availBases=useMemo(()=>BASES.filter(b=>b.products.includes(pt)),[pt]);
  const addBase=(bName)=>{
    if(baseRows.find(r=>r.name===bName))return;
    const b=BASES.find(x=>x.name===bName);
    if(!b)return;
    setBaseRows([...baseRows,{name:bName,pct:b.defaultPct,grams:(b.defaultPct/100)*batchSize,mode:"pct"}]);
  };
  const updBase=(i,field,value)=>{
    const n=[...baseRows];
    if(field==="pct"){const p=parseFloat(value)||0;n[i]={...n[i],pct:p,grams:+(p/100*batchSize).toFixed(3)};}
    else if(field==="grams"){const g=parseFloat(value)||0;n[i]={...n[i],grams:g,pct:+(g/batchSize*100).toFixed(3)};}
    else if(field==="mode"){n[i]={...n[i],mode:value};}
    setBaseRows(n);
  };
  const rmBase=(i)=>setBaseRows(baseRows.filter((_,j)=>j!==i));
  const addScent=(sName)=>{
    if(scentRows.find(r=>r.name===sName))return;
    setScentRows([...scentRows,{name:sName,mode:"drops",drops:1,pct:""}]);
  };
  const updScent=(i,f,v)=>{ const n=[...scentRows]; n[i]={...n[i],[f]:v}; setScentRows(n); };
  const rmScent=(i)=>setScentRows(scentRows.filter((_,j)=>j!==i));
  // Compute
  const totalBasePct=baseRows.reduce((a,r)=>a+r.pct,0);
  const compScents=scentRows.map(s=>{
    const sd=SCENTS.find(x=>x.name===s.name);
    const mx=sd?(sd.ifra[cat]||0):0;
    let ml,pct,drops;
    if(s.mode==="drops"){drops=parseInt(s.drops)||0;ml=drops*DROP_ML;pct=(ml/batchSize)*100;}
    else{pct=parseFloat(s.pct)||0;ml=(pct/100)*batchSize;drops=Math.round(ml/DROP_ML);}
    return {...s,ml,pct,drops,maxPct:mx,over:mx>0&&pct>mx,banned:mx===0,sd};
  });
  const totalScentMl=compScents.reduce((a,s)=>a+s.ml,0);
  const totalScentPct=(totalScentMl/batchSize)*100;
  const totalPct=totalBasePct+totalScentPct;
  const hasIFRAWarn=compScents.some(s=>s.over||s.banned);
  const baseTooHigh=totalBasePct>100;
  const totalOff=Math.abs(totalPct-100)>2;
  // Base warnings
  const baseWarnings=[];
  baseRows.forEach(r=>{
    const b=BASES.find(x=>x.name===r.name);
    if(b&&r.pct>b.maxPct)baseWarnings.push(`${r.name}: ${r.pct}% exceeds recommended max ${b.maxPct}%`);
  });
  // Check if emulsion needs emulsifier
  const hasWater=baseRows.some(r=>{const b=BASES.find(x=>x.name===r.name);return b&&b.role==="solvent"&&b.inci==="Aqua"&&r.pct>0;});
  const hasOil=baseRows.some(r=>{const b=BASES.find(x=>x.name===r.name);return b&&(b.role==="carrier"||b.role==="wax")&&r.pct>0;});
  const hasEmulsifier=baseRows.some(r=>{const b=BASES.find(x=>x.name===r.name);return b&&b.role==="emulsifier"&&r.pct>0;});
  if(hasWater&&hasOil&&!hasEmulsifier)baseWarnings.push("⚠️ Water + Oil detected without emulsifier — your product will separate! Add Olivem 1000 or BTMS-50.");
  // Check preservative for water-containing
  const hasPreservative=baseRows.some(r=>{const b=BASES.find(x=>x.name===r.name);return b&&b.role==="preservative"&&r.pct>0;});
  if(hasWater&&!hasPreservative)baseWarnings.push("⚠️ Water-based formula without preservative — microbial growth risk. Add Glyceryl Caprylate or similar.");
  // Anhydrous doesn't need preservative but needs antioxidant
  const hasAntioxidant=baseRows.some(r=>r.name.includes("Vitamin E")||r.name.includes("Rosemary Extract"));
  if(!hasWater&&hasOil&&!hasAntioxidant)baseWarnings.push("💡 Oil-based formula — consider adding Vitamin E or Rosemary Extract to prevent rancidity.");
  const handleSave=()=>{
    if(!name.trim())return;
    const recipe={
      id:Date.now(), name, notes, productType:pt, productName:PRODUCTS[pt].name,
      batchSize, batchUnit, category:cat,
      bases:baseRows.map(r=>{const b=BASES.find(x=>x.name===r.name);return{...r,inci:b?.inci||"",role:b?.role||""};}),
      scents:compScents.map(s=>({name:s.name,type:s.sd?.type||"FO",drops:s.drops,ml:+s.ml.toFixed(4),pct:+s.pct.toFixed(3),maxPct:s.maxPct,inci:s.sd?.type==="FO"?"Parfum":s.sd?.name||"Parfum"})),
      totalBasePct:+totalBasePct.toFixed(2), totalScentPct:+totalScentPct.toFixed(3), totalPct:+totalPct.toFixed(2),
      totalScentMl:+totalScentMl.toFixed(3),
      createdAt:new Date().toISOString(), hasWarnings:hasIFRAWarn||baseWarnings.length>0,
    };
    save([...recipes,recipe]);
    setSaved(true);
    setTimeout(()=>setSaved(false),2500);
  };
  return <div>
    <h2 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20,margin:"0 0 4px",letterSpacing:3,textTransform:"uppercase"}}>Recipe Builder</h2>
    <p style={{color:textMuted,fontSize:12,margin:"0 0 12px"}}>Build full formulations. System enforces IFRA limits and flags formulation issues.</p>
    <div style={{...card,display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
      <div style={{flex:"1 1 180px"}}><label style={lbl}>Product Type</label>
        <select value={pt} onChange={e=>{setPt(e.target.value);setBaseRows([]);setScentRows([]);setCb(String(PRODUCTS[e.target.value].test));setCbUnit(PRODUCTS[e.target.value].tU);}} style={inp}>
          {Object.entries(PRODUCTS).map(([k,v])=><option key={k} value={k}>{v.name}</option>)}
        </select></div>
      <div style={{flex:"0 0 auto"}}><label style={lbl}>Batch Size</label>
        <div style={{display:"flex",gap:4}}>
          <input type="number" value={cb} onChange={e=>setCb(e.target.value)} style={{...inp,width:80,textAlign:"center"}}/>
          <select value={cbUnit} onChange={e=>setCbUnit(e.target.value)} style={{...inp,width:55}}>
            <option value="ml">ml</option><option value="g">g</option>
          </select>
        </div>
      </div>
      <div style={{flex:"0 0 auto"}}><Pill color={gold} bg={`${gold}15`}>IFRA Cat {cat} — {IFRA_CATS[cat].label}</Pill></div>
    </div>
    <div style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontWeight:600,fontSize:14}}>Base Ingredients</span>
        <span style={{fontSize:11,color:totalBasePct>100?danger:totalBasePct>0?gold:textMuted}}>Base total: {totalBasePct.toFixed(1)}%</span>
      </div>
      <select onChange={e=>{if(e.target.value)addBase(e.target.value);e.target.value="";}} style={inp} defaultValue="">
        <option value="" disabled>+ Add base ingredient...</option>
        {availBases.filter(b=>!baseRows.find(r=>r.name===b.name)).map(b=><option key={b.name} value={b.name}>{b.name} ({b.role}) — max {b.maxPct}%</option>)}
      </select>
      {baseRows.map((r,i)=>{
        const b=BASES.find(x=>x.name===r.name);
        const grams=(r.pct/100)*batchSize;
        const overMax=b&&r.pct>b.maxPct;
        return <div key={r.name} style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",padding:"6px 0",borderTop:i>0?`1px solid ${border}30`:"none"}}>
          <div style={{flex:"1 1 180px",minWidth:120}}>
            <div style={{fontWeight:600,fontSize:12}}>{r.name}</div>
            <div style={{fontSize:10,color:textMuted}}>{b?.inci} · {b?.role} · max {b?.maxPct}%</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <select value={r.mode||"pct"} onChange={e=>updBase(i,"mode",e.target.value)} style={{...inp,width:55,fontSize:10,padding:4}}>
              <option value="pct">%</option><option value="grams">{batchUnit}</option>
            </select>
            {(r.mode||"pct")==="pct"
              ?<input type="number" min="0" step="0.1" value={r.pct} onChange={e=>updBase(i,"pct",e.target.value)} style={{...inp,width:65,textAlign:"center"}}/>
              :<input type="number" min="0" step="0.01" value={r.grams||+(r.pct/100*batchSize).toFixed(3)} onChange={e=>updBase(i,"grams",e.target.value)} style={{...inp,width:70,textAlign:"center"}}/>
            }
          </div>
          <div style={{fontSize:11,color:textMuted,minWidth:100}}>
            {(r.mode||"pct")==="pct" ? `= ${grams.toFixed(2)} ${batchUnit}` : `= ${r.pct.toFixed(2)}%`}
          </div>
          {overMax&&<span style={{fontSize:10,color:warn,fontWeight:600}}>⚠️ Over max</span>}
          <button onClick={()=>rmBase(i)} style={{background:"none",border:"none",color:danger,cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
        </div>;
      })}
      {b=>b?.notes&&<div style={{fontSize:10,color:textMuted,marginTop:4}}>{b.notes}</div>}
    </div>
    <div style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontWeight:600,fontSize:14}}>Scent Blend</span>
        <span style={{fontSize:11,color:hasIFRAWarn?danger:totalScentPct>0?gold:textMuted}}>Scent total: {totalScentPct.toFixed(3)}% ({totalScentMl.toFixed(3)} ml)</span>
      </div>
      <select onChange={e=>{if(e.target.value)addScent(e.target.value);e.target.value="";}} style={inp} defaultValue="">
        <option value="" disabled>+ Add scent...</option>
        {SCENTS.filter(s=>!scentRows.find(r=>r.name===s.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{
          const mx=s.ifra[cat]||0;
          return <option key={s.name} value={s.name} style={{color:mx===0?danger:undefined}}>{s.name} ({s.type}) — max {mx===0?"⛔ BANNED":mx+"% in Cat "+cat}</option>;
        })}
      </select>
      {compScents.map((s,i)=><div key={s.name} style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",padding:"6px 0",borderTop:i>0?`1px solid ${border}30`:"none"}}>
        <div style={{flex:"1 1 160px",minWidth:110}}>
          <div style={{fontWeight:500,fontSize:12}}>{s.name} <TypeBadge t={s.sd?.type||"FO"}/></div>
          <div style={{fontSize:10,color:textMuted}}>{s.sd?.note} • max {s.maxPct}%</div>
        </div>
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          <select value={scentRows[i].mode} onChange={e=>updScent(i,"mode",e.target.value)} style={{...inp,width:70,fontSize:10,padding:4}}>
            <option value="drops">Drops</option><option value="pct">%</option>
          </select>
          {scentRows[i].mode==="drops"
            ?<input type="number" min="0" step="1" value={scentRows[i].drops} onChange={e=>updScent(i,"drops",e.target.value)} style={{...inp,width:55,textAlign:"center"}}/>
            :<input type="number" min="0" step="0.01" value={scentRows[i].pct} onChange={e=>updScent(i,"pct",e.target.value)} style={{...inp,width:65,textAlign:"center"}}/>
          }
        </div>
        <div style={{fontSize:11,color:textMuted,minWidth:130}}>= {s.ml.toFixed(3)}ml ({s.pct.toFixed(3)}%) / {s.drops}dr</div>
        <div style={{minWidth:50}}>
          {s.banned&&<span style={{color:danger,fontSize:10,fontWeight:600}}>⛔ BANNED</span>}
          {s.over&&!s.banned&&<span style={{color:warn,fontSize:10,fontWeight:600}}>⚠️ OVER {s.maxPct}%</span>}
          {!s.over&&!s.banned&&s.pct>0&&<span style={{color:ok,fontSize:10}}>[x]</span>}
        </div>
        <button onClick={()=>rmScent(i)} style={{background:"none",border:"none",color:danger,cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
      </div>)}
    </div>
    {hasIFRAWarn&&<Warn><strong>⚠️ IFRA Violation:</strong> One or more scents exceed the maximum for Cat {cat}. Reduce amounts before saving.</Warn>}
    {baseWarnings.map((w,i)=><Warn key={i}>{w}</Warn>)}
    {totalPct>0&&Math.abs(totalPct-100)>5&&<Warn><strong>Formula total: {totalPct.toFixed(1)}%</strong> — should be close to 100%. {totalPct<95?"You're missing base ingredients.":"Your percentages exceed 100%."}</Warn>}
    {compScents.length>0&&!hasIFRAWarn&&<Ok>
      <strong>💡 Formulation tip:</strong>{" "}
      {cat==="5B"&&"Beard oil Cat 5B is strict — FOs max ~0.39%. Use essential oils for higher scent loads. For a 10ml batch, 1 drop = ~0.5% which already exceeds FO limits."}
      {cat==="7B"&&"Pomade Cat 7B allows ~1% FO. For 50g batch = ~0.5ml total FO or ~10 drops. Layer 3-5 scents for complexity."}
      {cat==="4"&&"Perfume Cat 4 allows up to ~9% FO. This is where you can be most creative. Structure: 30% top, 50% mid, 20% base notes."}
      {cat==="9"&&"Soap Cat 9 allows ~3.57% FO. Rinse-off so skin exposure is brief. Be generous with scent."}
      {!["5B","7B","4","9"].includes(cat)&&"Check individual IFRA limits per scent in the library tab."}
    </Ok>}
    {(baseRows.length>0||compScents.length>0)&&<div style={{...card,marginTop:12,background:`${bg}ee`,border:"1px solid #3a3520"}}>
      <div style={{fontWeight:600,fontSize:14,color:gold,marginBottom:8}}>Formula Summary</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12}}>
        <div><span style={{color:textMuted}}>Base:</span> <strong>{totalBasePct.toFixed(1)}%</strong></div>
        <div><span style={{color:textMuted}}>Scent:</span> <strong>{totalScentPct.toFixed(3)}%</strong></div>
        <div><span style={{color:textMuted}}>Total:</span> <strong style={{color:Math.abs(totalPct-100)<2?ok:warn}}>{totalPct.toFixed(2)}%</strong></div>
      </div>
    </div>}
    {(baseRows.length>0||compScents.length>0)&&<div style={{...card,display:"flex",flexWrap:"wrap",gap:10,alignItems:"end"}}>
      <div style={{flex:"1 1 200px"}}><label style={lbl}>Recipe Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Boegbeeld Signature Pomade v1" style={inp}/></div>
      <div style={{flex:"1 1 200px"}}><label style={lbl}>Notes (optional)</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Internal notes..." style={inp}/></div>
      <button onClick={handleSave} disabled={!name.trim()||hasIFRAWarn} style={{...btn,background:hasIFRAWarn?textDim:gold,color:hasIFRAWarn?textMuted:bg,fontWeight:600,padding:"8px 24px",cursor:hasIFRAWarn||!name.trim()?"not-allowed":"pointer",opacity:!name.trim()?0.5:1}}>
        {hasIFRAWarn?"Fix IFRA Warnings":"Save Recipe"}
      </button>
      {saved&&<span style={{color:ok,fontSize:12}}>[x] Saved! View in Saved Recipes tab.</span>}
    </div>}
  </div>;
}
function Recipes({recipes,save,goBuilder}) {
  const [expanded,setExpanded]=useState(null);
  const [pifView,setPifView]=useState(null);
  const del=(id)=>save(recipes.filter(r=>r.id!==id));
  if(recipes.length===0)return <div style={{textAlign:"center",padding:"50px 20px"}}>
    <div style={{fontSize:44,marginBottom:12}}>📋</div>
    <h3 style={{fontFamily:"'Odibee Sans',cursive",color:gold}}>No Saved Recipes</h3>
    <p style={{color:textMuted,fontSize:13}}>Build your first formulation in the Recipe Builder.</p>
    <button onClick={goBuilder} style={{...btn,background:gold,color:bg,fontWeight:600,padding:"10px 24px",marginTop:10}}>Open Recipe Builder</button>
  </div>;
  return <div>
    <h2 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20,margin:"0 0 4px",letterSpacing:3,textTransform:"uppercase"}}>Saved Recipes</h2>
    <p style={{color:textMuted,fontSize:12,margin:"0 0 12px"}}>Stored persistently. Click "PIF Data" to generate documentation for YouWish submission.</p>
    {recipes.map(r=>{
      const isOpen=expanded===r.id;
      const isPif=pifView===r.id;
      return <div key={r.id} style={{...card,border:isOpen?`1px solid ${gold}40`:`1px solid ${border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",cursor:"pointer"}} onClick={()=>setExpanded(isOpen?null:r.id)}>
          <div>
            <h3 style={{fontFamily:"'Odibee Sans',cursive",color:textMain,fontSize:15,margin:"0 0 3px"}}>{r.name}</h3>
            <div style={{fontSize:11,color:textMuted}}>
              {r.productName} • Cat {r.category} • {r.batchSize}{r.batchUnit} • {new Date(r.createdAt).toLocaleDateString("nl-NL")}
              {r.hasWarnings&&<span style={{color:warn,marginLeft:6}}>⚠️ has warnings</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:4}}>
            <button onClick={e=>{e.stopPropagation();setPifView(isPif?null:r.id);setExpanded(r.id);}} style={{...btn,background:isPif?`${gold}15`:bgInput,color:isPif?gold:textMuted,border:`1px solid ${isPif?gold:border}`,fontSize:10}}>📄 PIF Data</button>
            <button onClick={e=>{e.stopPropagation();del(r.id);}} style={{...btn,background:bgInput,color:danger,border:`1px solid ${danger}30`,fontSize:10}}>Delete</button>
          </div>
        </div>
        {isOpen&&<div style={{marginTop:10}}>
          {/* Base */}
          {r.bases?.length>0&&<><div style={{fontSize:11,color:gold,fontWeight:600,marginBottom:4}}>Base Ingredients ({r.totalBasePct}%)</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:8}}>
            <thead><tr style={{borderBottom:`1px solid ${border}`}}>
              {["Ingredient","INCI","Role","%",batchUnit].map(h=><th key={h} style={{padding:"3px 6px",textAlign:"left",color:textDim,fontSize:9,textTransform:"uppercase"}}>{h}</th>)}
            </tr></thead>
            <tbody>{r.bases.map((b,i)=><tr key={i} style={{borderBottom:`1px solid ${border}30`}}>
              <td style={{padding:"3px 6px"}}>{b.name}</td>
              <td style={{padding:"3px 6px",color:textMuted,fontSize:10}}>{b.inci}</td>
              <td style={{padding:"3px 6px",color:textMuted}}>{b.role}</td>
              <td style={{padding:"3px 6px",color:gold,fontWeight:600}}>{b.pct}%</td>
              <td style={{padding:"3px 6px",color:textMuted}}>{((b.pct/100)*r.batchSize).toFixed(2)}</td>
            </tr>)}</tbody>
          </table></>}
          {/* Scents */}
          {r.scents?.length>0&&<><div style={{fontSize:11,color:gold,fontWeight:600,marginBottom:4}}>Scent Blend ({r.totalScentPct}%)</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:8}}>
            <thead><tr style={{borderBottom:`1px solid ${border}`}}>
              {["Scent","Type","Drops","ml","%","Max %"].map(h=><th key={h} style={{padding:"3px 6px",textAlign:"left",color:textDim,fontSize:9,textTransform:"uppercase"}}>{h}</th>)}
            </tr></thead>
            <tbody>{r.scents.map((s,i)=><tr key={i} style={{borderBottom:`1px solid ${border}30`}}>
              <td style={{padding:"3px 6px"}}>{s.name}</td>
              <td style={{padding:"3px 6px"}}><TypeBadge t={s.type}/></td>
              <td style={{padding:"3px 6px",color:textMuted}}>{s.drops}</td>
              <td style={{padding:"3px 6px",color:textMuted}}>{s.ml?.toFixed(3)}</td>
              <td style={{padding:"3px 6px",color:gold,fontWeight:600}}>{s.pct?.toFixed(3)}%</td>
              <td style={{padding:"3px 6px",color:textMuted}}>{s.maxPct}%</td>
            </tr>)}</tbody>
          </table></>}
          <div style={{fontSize:11,color:textMuted,paddingTop:4,borderTop:`1px solid ${border}30`}}>Total: <strong style={{color:gold}}>{r.totalPct}%</strong> • Scent: {r.totalScentMl}ml</div>
          {r.notes&&<div style={{fontSize:11,color:textMuted,marginTop:4,fontStyle:"italic"}}>Notes: {r.notes}</div>}
          {/* -- INCI LIST -- */}
          <div style={{marginTop:8,padding:"8px 12px",borderRadius:6,background:bgInput,border:`1px solid ${border}`}}>
            <div style={{fontSize:10,color:gold,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>INCI Ingredients (for label)</div>
            <div style={{fontSize:11,color:textMain,lineHeight:1.6}}>
              {[...(r.bases||[]).sort((a,b)=>b.pct-a.pct).map(b=>b.inci),"Parfum"].filter((v,i,a)=>a.indexOf(v)===i).join(", ")}
            </div>
            <div style={{fontSize:10,color:textDim,marginTop:4}}>Note: Allergens from fragrance ({'>'} 0.01% leave-on / {'>'} 0.001% rinse-off) must be listed after "Parfum". Check IFRA certificates.</div>
          </div>
          {/* -- PIF DATA EXPORT -- */}
          {isPif&&<div style={{marginTop:12,padding:"12px 14px",borderRadius:8,background:`${bg}ee`,border:`1px solid ${gold}30`}}>
            <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:14,marginBottom:8}}>📄 PIF / CPNP Data Package</div>
            <p style={{fontSize:11,color:textMain,marginBottom:10}}>Below is the data YouWish needs from you to prepare your PIF and CPSR. Copy this or use as your submission brief.</p>
            <div id={`pif-${r.id}`} style={{background:bgInput,borderRadius:6,padding:12,fontSize:11,lineHeight:1.7,color:textMain,whiteSpace:"pre-wrap",fontFamily:"'Courier New',monospace",border:`1px solid ${border}`,maxHeight:400,overflowY:"auto"}}>
{`=======================================
PRODUCT INFORMATION — ${r.name}
For: YouWish PIF & CPSR Submission
Brand: Boegbeeld (www.boegbeeld.shop)
Generated: ${new Date().toLocaleDateString("nl-NL")}
=======================================
1. PRODUCT DESCRIPTION
---------------------
Product Name: ${r.name}
Product Type: ${r.productName}
IFRA Category: ${r.category} (${IFRA_CATS[r.category]?.label})
Intended Use: ${IFRA_CATS[r.category]?.ex}
Target Group: Adults (male grooming)
Application: Leave-on / ${r.category==="9"?"Rinse-off":"Leave-on"}
Batch Size: ${r.batchSize} ${r.batchUnit}
2. QUALITATIVE & QUANTITATIVE FORMULA
------------------------------------
${r.bases?.map(b=>`${b.inci.padEnd(45)} ${b.pct.toString().padStart(6)}%    (${b.name})`).join("\n")||"(no base ingredients listed)"}
${"Parfum".padEnd(45)} ${r.totalScentPct?.toString().padStart(6)}%    (fragrance blend)
${"-".repeat(60)}
${"TOTAL".padEnd(45)} ${r.totalPct?.toString().padStart(6)}%
3. FRAGRANCE COMPOSITION (for IFRA assessment)
--------------------------------------------
Fragrance % of total product: ${r.totalScentPct}%
${r.scents?.map(s=>`• ${s.name.padEnd(35)} ${s.pct?.toFixed(3).padStart(7)}% of product    (${s.type}, max ${s.maxPct}% Cat ${r.category})`).join("\n")||"(no scents)"}
4. DOCUMENTS NEEDED FROM YOU (Boegbeeld)
---------------------------------------
[ ] CoA (Certificate of Analysis) per ingredient
[ ] MSDS/SDS per ingredient
[ ] TDS (Technical Data Sheet) per ingredient
[ ] IFRA Certificate per fragrance oil (download from YouWish)
[ ] Allergen declaration per fragrance (from YouWish IFRA cert)
[ ] GMP statement or ISO 22716 compliance
[ ] Manufacturing method description
[ ] Packaging specification (material, volume)
[ ] Label draft (with INCI list, batch no., PAO symbol)
[ ] Stability test samples (YouWish arranges lab)
5. INCI LIST (for label — descending order)
----------------------------------------
${[...(r.bases||[]).sort((a,b)=>b.pct-a.pct).map(b=>b.inci),"Parfum"].filter((v,i,a)=>a.indexOf(v)===i).join(", ")}
Note: Allergens from fragrance (>0.001% rinse-off, >0.01% leave-on)
must be listed after "Parfum". YouWish IFRA certificates list these.
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
   Tip: YouWish provides these for ingredients bought from them
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
`}
            </div>
            <div style={{marginTop:8,display:"flex",gap:6}}>
              <button onClick={()=>{
                const el=document.getElementById(`pif-${r.id}`);
                if(el)navigator.clipboard.writeText(el.textContent).then(()=>alert("Copied to clipboard!"));
              }} style={{...btn,background:bgInput,color:gold,border:`1px solid ${gold}40`,fontSize:10}}>📋 Copy to clipboard</button>
              <button onClick={()=>{
                const el=document.getElementById(`pif-${r.id}`);
                if(el){const blob=new Blob([el.textContent],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`PIF-${r.name.replace(/\s+/g,"-")}.txt`;a.click();URL.revokeObjectURL(url);}
              }} style={{...btn,background:bgInput,color:gold,border:`1px solid ${gold}40`,fontSize:10}}>💾 Download .txt</button>
            </div>
          </div>}
        </div>}
      </div>;
    })}
  </div>;
}
function Production({recipes}) {
  const [selId,setSelId]=useState("");
  const [targetQty,setTargetQty]=useState("");
  const [targetUnit,setTargetUnit]=useState("ml");
  const [showUnits,setShowUnits]=useState("both"); // both, metric, drops
  const [containerSize,setContainerSize]=useState("");
  const [containerUnit,setContainerUnit]=useState("ml");
  const recipe = recipes.find(r=>r.id===+selId);
  const origSize = recipe?.batchSize||1;
  const origUnit = recipe?.batchUnit||"ml";
  const target = parseFloat(targetQty)||0;
  // Convert target to same unit as recipe if needed
  const targetInOrigUnit = (() => {
    if(!target) return 0;
    if(targetUnit===origUnit) return target;
    // ml to L or L to ml
    if(targetUnit==="L"&&origUnit==="ml") return target*1000;
    if(targetUnit==="ml"&&origUnit==="L") return target/1000;
    if(targetUnit==="L"&&origUnit==="g") return target*1000; // approximate for water-based
    if(targetUnit==="kg"&&origUnit==="g") return target*1000;
    if(targetUnit==="g"&&origUnit==="kg") return target/1000;
    if(targetUnit==="kg"&&origUnit==="ml") return target*1000;
    if(targetUnit==="L"&&origUnit==="g") return target*1000;
    return target;
  })();
  const scaleFactor = targetInOrigUnit/origSize;
  const containerSz = parseFloat(containerSize)||0;
  const containerInOrigUnit = (() => {
    if(!containerSz) return 0;
    if(containerUnit===origUnit) return containerSz;
    if(containerUnit==="ml"&&origUnit==="g") return containerSz;
    if(containerUnit==="ml"&&origUnit==="L") return containerSz/1000;
    return containerSz;
  })();
  const numContainers = containerInOrigUnit>0?Math.floor(targetInOrigUnit/containerInOrigUnit):0;
  const quickSizes = [
    {label:"100 ml",val:100,unit:"ml"},
    {label:"250 ml",val:250,unit:"ml"},
    {label:"500 ml",val:500,unit:"ml"},
    {label:"1 L",val:1,unit:"L"},
    {label:"2.5 L",val:2.5,unit:"L"},
    {label:"5 L",val:5,unit:"L"},
    {label:"500 g",val:500,unit:"g"},
    {label:"1 kg",val:1,unit:"kg"},
    {label:"5 kg",val:5,unit:"kg"},
  ];
  return <div>
    <h2 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20,margin:"0 0 4px",letterSpacing:3,textTransform:"uppercase"}}>Production Scale-Up</h2>
    <p style={{color:textMuted,fontSize:12,margin:"0 0 12px"}}>Select a saved recipe and scale it to any production quantity. All amounts recalculate automatically.</p>
    {recipes.length===0&&<div style={{textAlign:"center",padding:"50px 20px"}}>
      <div style={{fontSize:44,marginBottom:12}}>🏭</div>
      <h3 style={{fontFamily:"'Odibee Sans',cursive",color:gold}}>No Recipes to Produce</h3>
      <p style={{color:textMuted,fontSize:13}}>Create and save a recipe in the Recipe Builder first.</p>
    </div>}
    {recipes.length>0&&<>
      {/* Recipe Selection */}
      <div style={{...card,display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
        <div style={{flex:"1 1 250px"}}>
          <label style={lbl}>Select Recipe</label>
          <select value={selId} onChange={e=>setSelId(e.target.value)} style={inp}>
            <option value="">Choose a recipe...</option>
            {recipes.map(r=><option key={r.id} value={r.id}>{r.name} ({r.productName} · {r.batchSize}{r.batchUnit} original)</option>)}
          </select>
        </div>
        {recipe&&<>
          <div style={{flex:"0 0 auto"}}>
            <label style={lbl}>Production Quantity</label>
            <div style={{display:"flex",gap:4}}>
              <input type="number" value={targetQty} onChange={e=>setTargetQty(e.target.value)} placeholder="e.g. 5" style={{...inp,width:80,textAlign:"center"}}/>
              <select value={targetUnit} onChange={e=>setTargetUnit(e.target.value)} style={{...inp,width:60}}>
                <option value="ml">ml</option><option value="L">L</option><option value="g">g</option><option value="kg">kg</option>
              </select>
            </div>
          </div>
          <div style={{flex:"0 0 auto"}}>
            <label style={lbl}>Container Size (optional)</label>
            <div style={{display:"flex",gap:4}}>
              <input type="number" value={containerSize} onChange={e=>setContainerSize(e.target.value)} placeholder="e.g. 30" style={{...inp,width:70,textAlign:"center"}}/>
              <select value={containerUnit} onChange={e=>setContainerUnit(e.target.value)} style={{...inp,width:60}}>
                <option value="ml">ml</option><option value="g">g</option>
              </select>
            </div>
          </div>
        </>}
      </div>
      {/* Quick Sizes */}
      {recipe&&!target&&<div style={{...card}}>
        <label style={lbl}>Quick Select Production Size</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
          {quickSizes.map(q=><button key={q.label} onClick={()=>{setTargetQty(String(q.val));setTargetUnit(q.unit);}} style={{...btn,background:bgInput,color:textMuted,border:`1px solid ${border}`,fontSize:11,padding:"6px 12px"}}>{q.label}</button>)}
        </div>
      </div>}
      {/* Scaled Production Sheet */}
      {recipe&&target>0&&<>
        <div style={{...card,background:bgInput,border:`1px solid ${gold}30`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div>
              <h3 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:18,margin:0}}>{recipe.name}</h3>
              <div style={{fontSize:11,color:textMuted}}>{recipe.productName} · IFRA Cat {recipe.category} · Original: {origSize}{origUnit}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:22}}>{target} {targetUnit}</div>
              <div style={{fontSize:11,color:textMuted}}>Scale factor: {scaleFactor.toFixed(1)}×{numContainers>0&&` · ~${numContainers} × ${containerSize}${containerUnit} containers`}</div>
            </div>
          </div>
        </div>
        {/* Base Ingredients */}
        {recipe.bases?.length>0&&<div style={card}>
          <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:15,marginBottom:8}}>Base Ingredients</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:`1px solid ${border}`}}>
              {["Ingredient","INCI","Recipe %","Amount",""].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:textDim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}
            </tr></thead>
            <tbody>{recipe.bases.map((b,i)=>{
              const scaled=(b.pct/100)*targetInOrigUnit;
              const displayAmt=scaled>=1000?{val:(scaled/1000).toFixed(2),unit:origUnit==="g"?"kg":"L"}:{val:scaled.toFixed(2),unit:origUnit};
              return <tr key={i} style={{borderBottom:`1px solid ${border}30`}}>
                <td style={{padding:"8px",fontWeight:600}}>{b.name}</td>
                <td style={{padding:"8px",color:textMuted,fontSize:11,fontStyle:"italic"}}>{b.inci}</td>
                <td style={{padding:"8px",color:textMuted}}>{b.pct}%</td>
                <td style={{padding:"8px"}}>
                  <span style={{color:gold,fontWeight:700,fontSize:14}}>{displayAmt.val}</span>
                  <span style={{color:textMuted,fontSize:11,marginLeft:3}}>{displayAmt.unit}</span>
                </td>
                <td style={{padding:"8px",color:textDim,fontSize:10}}>({scaled.toFixed(3)} {origUnit})</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {/* Scent Blend */}
        {recipe.scents?.length>0&&<div style={card}>
          <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:15,marginBottom:8}}>Scent Blend</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:`1px solid ${border}`}}>
              {["Scent","Type","Recipe %","Amount (ml)","Drops (≈)",""].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:textDim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}
            </tr></thead>
            <tbody>{recipe.scents.map((s,i)=>{
              const scaledMl=(s.pct/100)*targetInOrigUnit;
              const scaledDrops=Math.round(scaledMl/DROP_ML);
              return <tr key={i} style={{borderBottom:`1px solid ${border}30`}}>
                <td style={{padding:"8px",fontWeight:600}}>{s.name}</td>
                <td style={{padding:"8px"}}><TypeBadge t={s.type}/></td>
                <td style={{padding:"8px",color:textMuted}}>{s.pct}%</td>
                <td style={{padding:"8px"}}>
                  <span style={{color:gold,fontWeight:700,fontSize:14}}>{scaledMl.toFixed(2)}</span>
                  <span style={{color:textMuted,fontSize:11,marginLeft:3}}>ml</span>
                </td>
                <td style={{padding:"8px",color:textMuted}}>{scaledDrops>200?`${(scaledMl).toFixed(1)} ml`:scaledDrops+" dr"}</td>
                <td style={{padding:"8px",color:textDim,fontSize:10}}>max {s.maxPct}%</td>
              </tr>;
            })}</tbody>
          </table>
          <div style={{fontSize:11,color:textMuted,marginTop:6,paddingTop:6,borderTop:`1px solid ${border}30`}}>
            Total fragrance: <strong style={{color:gold}}>{((recipe.totalScentPct/100)*targetInOrigUnit).toFixed(2)} {origUnit}</strong> ({recipe.totalScentPct}%)
          </div>
        </div>}
        {/* Production Summary */}
        <div style={{...card,background:bgInput,border:`1px solid ${gold}30`}}>
          <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:15,marginBottom:8}}>Production Summary</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,fontSize:12}}>
            <div style={{padding:"10px 14px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
              <div style={{color:textMuted,fontSize:10,textTransform:"uppercase",marginBottom:2}}>Total Production</div>
              <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20}}>{target} {targetUnit}</div>
            </div>
            <div style={{padding:"10px 14px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
              <div style={{color:textMuted,fontSize:10,textTransform:"uppercase",marginBottom:2}}>Scale Factor</div>
              <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20}}>{scaleFactor.toFixed(1)}×</div>
              <div style={{color:textDim,fontSize:10}}>from {origSize}{origUnit} recipe</div>
            </div>
            {numContainers>0&&<div style={{padding:"10px 14px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
              <div style={{color:textMuted,fontSize:10,textTransform:"uppercase",marginBottom:2}}>Containers</div>
              <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20}}>~{numContainers} pcs</div>
              <div style={{color:textDim,fontSize:10}}>@ {containerSize}{containerUnit} each</div>
            </div>}
            <div style={{padding:"10px 14px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
              <div style={{color:textMuted,fontSize:10,textTransform:"uppercase",marginBottom:2}}>Ingredients Count</div>
              <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20}}>{(recipe.bases?.length||0)+(recipe.scents?.length||0)}</div>
              <div style={{color:textDim,fontSize:10}}>{recipe.bases?.length||0} base + {recipe.scents?.length||0} scent</div>
            </div>
          </div>
          {/* Weigh-out Checklist */}
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${border}30`}}>
            <div style={{fontSize:11,color:textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Weigh-Out Checklist</div>
            {recipe.bases?.map((b,i)=>{
              const scaled=(b.pct/100)*targetInOrigUnit;
              const disp=scaled>=1000?`${(scaled/1000).toFixed(2)} ${origUnit==="g"?"kg":"L"}`:`${scaled.toFixed(2)} ${origUnit}`;
              return <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"3px 0",fontSize:12}}>
                <span style={{width:16,height:16,borderRadius:3,border:`1px solid ${border}`,display:"inline-block",flexShrink:0}}/>
                <span style={{color:textMain,fontWeight:500,minWidth:180}}>{b.name}</span>
                <span style={{color:gold,fontWeight:700}}>{disp}</span>
              </div>;
            })}
            {recipe.scents?.map((s,i)=>{
              const scaledMl=(s.pct/100)*targetInOrigUnit;
              return <div key={`s${i}`} style={{display:"flex",gap:8,alignItems:"center",padding:"3px 0",fontSize:12}}>
                <span style={{width:16,height:16,borderRadius:3,border:`1px solid ${border}`,display:"inline-block",flexShrink:0}}/>
                <span style={{color:textMain,fontWeight:500,minWidth:180}}>{s.name} <TypeBadge t={s.type}/></span>
                <span style={{color:gold,fontWeight:700}}>{scaledMl.toFixed(2)} ml</span>
              </div>;
            })}
          </div>
        </div>
        {/* Print / Copy */}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button onClick={()=>window.print()} style={{...btn,background:bgCard,color:gold,border:`1px solid ${gold}40`,fontSize:11}}>🖨️ Print Production Sheet</button>
          <button onClick={()=>{
            const lines=[`PRODUCTION SHEET — ${recipe.name}`,`${target} ${targetUnit} (${scaleFactor.toFixed(1)}× from ${origSize}${origUnit})`,`Date: ${new Date().toLocaleDateString("nl-NL")}`,`Product: ${recipe.productName} · IFRA Cat ${recipe.category}`,``,`BASE INGREDIENTS:`,...(recipe.bases||[]).map(b=>{const s=(b.pct/100)*targetInOrigUnit;return `  ${b.name.padEnd(35)} ${b.pct}%   ${s>=1000?(s/1000).toFixed(2)+(origUnit==="g"?" kg":" L"):s.toFixed(2)+" "+origUnit}`;}),``,`SCENT BLEND:`,...(recipe.scents||[]).map(s=>{const m=(s.pct/100)*targetInOrigUnit;return `  ${s.name.padEnd(35)} ${s.pct}%   ${m.toFixed(2)} ml`;}),``,`Total fragrance: ${((recipe.totalScentPct/100)*targetInOrigUnit).toFixed(2)} ${origUnit} (${recipe.totalScentPct}%)`,numContainers>0?`Containers: ~${numContainers} × ${containerSize}${containerUnit}`:""];
            navigator.clipboard.writeText(lines.join("\n")).then(()=>alert("Production sheet copied!"));
          }} style={{...btn,background:bgCard,color:gold,border:`1px solid ${gold}40`,fontSize:11}}>📋 Copy Production Sheet</button>
        </div>
      </>}
    </>}
  </div>;
}
function CostCalc({recipes}) {
  const [selId,setSelId]=useState("");
  const [retailPrice,setRetailPrice]=useState("");
  const [containerSz,setContainerSz]=useState("30");
  const [containerUnit,setContainerUnit]=useState("ml");
  const [scentOv,setScentOv]=useState({});
  const [baseOv,setBaseOv]=useState({});
  useEffect(()=>{(async()=>{
    try{const r=await store.get("bb-scent-overrides");if(r?.value)setScentOv(JSON.parse(r.value));}catch(e){}
    try{const r=await store.get("bb-base-overrides");if(r?.value)setBaseOv(JSON.parse(r.value));}catch(e){}
  })();},[]);
  const getPrice=(name,isScent)=>{
    if(isScent){const ov=scentOv[name];if(ov?.pricePer100ml)return ov.pricePer100ml;const s=SCENTS.find(x=>x.name===name);return s?.type==="FO"?29.50:s?.type==="CO2"?45.00:25.00;}
    else{const ov=baseOv[name];if(ov?.pricePer100)return ov.pricePer100;const b=BASES.find(x=>x.name===name);return b?.role==="carrier"?8.00:b?.role==="wax"?12.00:b?.role==="solvent"?2.00:10.00;}
  };
  const recipe=recipes.find(r=>r.id===+selId);
  const cSz=parseFloat(containerSz)||30;
  const rp=parseFloat(retailPrice)||0;
  // Get all unique ingredients from selected recipe
  const allIngredients=recipe?[...(recipe.bases||[]).map(b=>({...b,isScent:false})),...(recipe.scents||[]).map(s=>({...s,isScent:true}))]:[];
  // Calculate costs per container
  const ingredientCosts=allIngredients.map(ing=>{
    const pricePerUnit=getPrice(ing.name,ing.isScent);
    const amtPerContainer=(ing.pct/100)*cSz;
    const costPerContainer=pricePerUnit>0?(amtPerContainer/100)*pricePerUnit:0;
    return {...ing,pricePerUnit,amtPerContainer,costPerContainer};
  });
  const totalCostPerContainer=ingredientCosts.reduce((a,i)=>a+i.costPerContainer,0);
  // Packaging costs from Google Sheet
  const packagingForProduct=PACKAGING_ITEMS.filter(p=>p.for_product==="all"||p.for_product.toLowerCase()===(recipe?.productType||"").toLowerCase()||p.for_product.toLowerCase()===(recipe?.productName||"").toLowerCase());
  const totalPackagingCost=packagingForProduct.reduce((a,p)=>a+p.price_eur,0);
  const totalCostPerUnit=totalCostPerContainer+totalPackagingCost;
  const margin=rp>0&&totalCostPerUnit>0?((rp-totalCostPerUnit)/rp*100):0;
  const sectionTitle={fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:14,marginBottom:4,letterSpacing:1,textTransform:"uppercase"};
  return <div>
    <h2 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20,margin:"0 0 4px",letterSpacing:3,textTransform:"uppercase"}}>Cost Calculator</h2>
    <p style={{color:textMuted,fontSize:12,margin:"0 0 12px"}}>Select a recipe to see total cost per unit. Adjust ingredient prices below the summary.</p>
    {/* Recipe Selection */}
    <div style={{...card,display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
      <div style={{flex:"1 1 250px"}}><label style={lbl}>Select Recipe</label>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={inp}>
          <option value="">Choose a recipe...</option>
          {recipes.map(r=><option key={r.id} value={r.id}>{r.name} ({r.productName})</option>)}
        </select>
      </div>
      <div style={{flex:"0 0 auto"}}><label style={lbl}>Container Size</label>
        <div style={{display:"flex",gap:4}}>
          <input type="number" value={containerSz} onChange={e=>setContainerSz(e.target.value)} style={{...inp,width:65,textAlign:"center"}}/>
          <select value={containerUnit} onChange={e=>setContainerUnit(e.target.value)} style={{...inp,width:50}}><option value="ml">ml</option><option value="g">g</option></select>
        </div>
      </div>
      <div style={{flex:"0 0 auto"}}><label style={lbl}>Retail Price (€)</label>
        <input type="number" step="0.01" value={retailPrice} onChange={e=>setRetailPrice(e.target.value)} placeholder="e.g. 24.95" style={{...inp,width:90,textAlign:"center"}}/>
      </div>
    </div>
    {recipe&&<>
      {/* -- TOTAL PRICE SUMMARY (shown first) -- */}
      <div style={{...card,marginTop:12,background:bgInput,border:`1px solid ${gold}30`}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
          <div style={{padding:"12px 16px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
            <div style={{color:textMuted,fontSize:10,textTransform:"uppercase"}}>Ingredients</div>
            <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:24}}>€{totalCostPerContainer.toFixed(2)}</div>
          </div>
          <div style={{padding:"12px 16px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
            <div style={{color:textMuted,fontSize:10,textTransform:"uppercase"}}>Packaging</div>
            <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:24}}>€{totalPackagingCost.toFixed(2)}</div>
          </div>
          <div style={{padding:"12px 16px",background:bgCard,borderRadius:8,border:`1px solid ${gold}40`}}>
            <div style={{color:textMuted,fontSize:10,textTransform:"uppercase"}}>Total / Unit</div>
            <div style={{fontFamily:"'Odibee Sans',cursive",color:"#fff",fontSize:24}}>€{totalCostPerUnit.toFixed(2)}</div>
          </div>
          {rp>0&&<div style={{padding:"12px 16px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
            <div style={{color:textMuted,fontSize:10,textTransform:"uppercase"}}>Retail</div>
            <div style={{fontFamily:"'Odibee Sans',cursive",color:textMain,fontSize:24}}>€{rp.toFixed(2)}</div>
          </div>}
          {rp>0&&totalCostPerUnit>0&&<div style={{padding:"12px 16px",background:margin>=70?`${ok}15`:margin>=50?`${warn}15`:`${danger}15`,borderRadius:8,border:`1px solid ${margin>=70?ok:margin>=50?warn:danger}30`}}>
            <div style={{color:textMuted,fontSize:10,textTransform:"uppercase"}}>Margin</div>
            <div style={{fontFamily:"'Odibee Sans',cursive",color:margin>=70?ok:margin>=50?warn:danger,fontSize:24}}>{margin.toFixed(1)}%</div>
          </div>}
          {rp>0&&totalCostPerUnit>0&&<div style={{padding:"12px 16px",background:bgCard,borderRadius:8,border:`1px solid ${border}`}}>
            <div style={{color:textMuted,fontSize:10,textTransform:"uppercase"}}>Profit</div>
            <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:24}}>€{(rp-totalCostPerUnit).toFixed(2)}</div>
          </div>}
        </div>
      </div>
      {/* -- INGREDIENT BREAKDOWN (with editable prices) -- */}
      <div style={{...card,marginTop:12}}>
        <div style={sectionTitle}>Section 1 — Ingredients</div>
        <p style={{fontSize:10,color:textMuted,margin:"0 0 8px"}}>Prices default to YouWish estimates. Adjust per ingredient — changes apply to Scents/Base tabs too.</p>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:`1px solid ${border}`}}>
            {["Ingredient","%",`Per ${cSz}${containerUnit}`,"€ / size","Cost/unit"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:textDim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}
          </tr></thead>
          <tbody>{ingredientCosts.map((ing,i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${border}30`}}>
              <td style={{padding:"6px 8px",fontWeight:500}}>{ing.name} {ing.isScent&&<TypeBadge t={ing.type}/>}</td>
              <td style={{padding:"6px 8px",color:textMuted}}>{ing.pct}%</td>
              <td style={{padding:"6px 8px",color:textMuted}}>{ing.amtPerContainer.toFixed(2)} {ing.isScent?"ml":containerUnit}</td>
              <td style={{padding:"6px 8px"}}>
                <div style={{display:"flex",alignItems:"center",gap:2}}>
                  <span style={{color:textMuted,fontSize:10}}>€</span>
                  <input type="number" step="0.01" defaultValue={ing.pricePerUnit.toFixed(2)} onBlur={e=>{const v=parseFloat(e.target.value)||0;if(ing.isScent){const o={...scentOv,[ing.name]:{...(scentOv[ing.name]||{}),pricePer100ml:v}};setScentOv(o);store.set("bb-scent-overrides",JSON.stringify(o));}else{const o={...baseOv,[ing.name]:{...(baseOv[ing.name]||{}),pricePer100:v}};setBaseOv(o);store.set("bb-base-overrides",JSON.stringify(o));}}} style={{...inp,width:55,textAlign:"right",padding:"3px 4px",fontSize:11}}/>
                  <span style={{color:textDim,fontSize:9}}>/100</span>
                </div>
              </td>
              <td style={{padding:"6px 8px",color:gold,fontWeight:600}}>€{ing.costPerContainer.toFixed(3)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr style={{borderTop:`1px solid ${gold}40`}}>
            <td colSpan={4} style={{padding:"8px",fontWeight:700,textAlign:"right",color:textMain}}>Subtotal ingredients:</td>
            <td style={{padding:"8px",fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:16,fontWeight:700}}>€{totalCostPerContainer.toFixed(2)}</td>
          </tr></tfoot>
        </table>
      </div>
      {/* SECTION 2: PACKAGING */}
      <div style={{...card,marginTop:12}}>
        <div style={sectionTitle}>Section 2 — Packaging</div>
        {packagingForProduct.length===0?
          <p style={{fontSize:11,color:textMuted}}>No packaging items found. Add a "packaging" tab in your Google Sheet with columns: name, description, category, price_eur, per_unit, for_product, url, notes</p>
        :<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:`1px solid ${border}`}}>
            {["Item","Category","Cost/unit"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:textDim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}
          </tr></thead>
          <tbody>{packagingForProduct.map((p,i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${border}30`}}>
              <td style={{padding:"6px 8px",fontWeight:500}}>{p.name}<span style={{fontSize:10,color:textMuted,fontWeight:400,marginLeft:6}}>{p.description}</span></td>
              <td style={{padding:"6px 8px"}}><span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:`${gold}15`,color:gold,fontWeight:600,textTransform:"uppercase"}}>{p.category}</span></td>
              <td style={{padding:"6px 8px",color:gold,fontWeight:600}}>€{p.price_eur.toFixed(2)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr style={{borderTop:`1px solid ${gold}40`}}>
            <td colSpan={2} style={{padding:"8px",fontWeight:700,textAlign:"right",color:textMain}}>Subtotal packaging:</td>
            <td style={{padding:"8px",fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:16,fontWeight:700}}>€{totalPackagingCost.toFixed(2)}</td>
          </tr></tfoot>
        </table>}
      </div>
      {/* SECTION 3: TOTAL */}
      <div style={{...card,marginTop:12,background:`${gold}08`,border:`1px solid ${gold}30`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={sectionTitle}>Total Cost Per Unit</div>
            <div style={{fontSize:11,color:textMuted}}>Ingredients (€{totalCostPerContainer.toFixed(2)}) + Packaging (€{totalPackagingCost.toFixed(2)})</div>
          </div>
          <div style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:32}}>€{totalCostPerUnit.toFixed(2)}</div>
        </div>
      </div>
    </>}
    {!recipe&&recipes.length>0&&<div style={{...card,marginTop:12,background:bgInput,border:`1px solid ${gold}20`}}>
      <div style={{fontSize:12,color:textMuted}}>💡 Select a recipe above to see cost breakdown. Prices are pre-filled with YouWish estimates (FO: €29.50/100ml, EO: €25/100ml, Carrier oils: €8/100ml). Edit directly in the table or in the Scents/Base tabs.</div>
    </div>}
  </div>;
}
function Packaging() {
  const items = PACKAGING_ITEMS;
  const categories = [...new Set(items.map(i=>i.category))].sort();
  const [cf,setCf]=useState("all");
  const filtered = cf==="all"?items:items.filter(i=>i.category===cf);
  return <div>
    <h2 style={{fontFamily:"'Odibee Sans',cursive",color:gold,fontSize:20,margin:"0 0 4px",letterSpacing:3,textTransform:"uppercase"}}>Packaging</h2>
    <p style={{color:textMuted,fontSize:12,margin:"0 0 12px"}}>Packaging items loaded from Google Sheet. Add new items there.</p>
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      <select value={cf} onChange={e=>setCf(e.target.value)} style={{...inp,width:160}}><option value="all">All Categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <a href={SHEETS_CONFIG.editUrl} target="_blank" rel="noopener noreferrer" style={{...btn,background:bgInput,color:gold,border:`1px solid ${gold}40`,fontSize:11,textDecoration:"none"}}>+ Add in Google Sheet</a>
    </div>
    {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:40,marginBottom:8}}>📦</div>
      <p style={{color:textMuted,fontSize:13}}>No packaging items yet. Add a "packaging" tab in your Google Sheet with columns: name, description, category, price_eur, per_unit, for_product, url, notes</p>
    </div>}
    {filtered.length>0&&<div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`1px solid ${border}`}}>
          {["Name","Category","For Product","Price","Notes","Link"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:textDim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map((item,i)=>(
          <tr key={i} style={{borderBottom:`1px solid ${border}30`}}>
            <td style={{padding:"6px 8px",fontWeight:600}}>{item.name}<div style={{fontSize:10,color:textMuted,fontWeight:400}}>{item.description}</div></td>
            <td style={{padding:"6px 8px"}}><span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:`${gold}15`,color:gold,fontWeight:600,textTransform:"uppercase"}}>{item.category}</span></td>
            <td style={{padding:"6px 8px",color:textMuted,fontSize:11}}>{item.for_product}</td>
            <td style={{padding:"6px 8px",color:gold,fontWeight:600}}>€{item.price_eur.toFixed(2)} <span style={{color:textDim,fontWeight:400,fontSize:10}}>/{item.per_unit}</span></td>
            <td style={{padding:"6px 8px",color:textMuted,fontSize:11}}>{item.notes}</td>
            <td style={{padding:"6px 4px"}}>{item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" style={{color:gold,fontSize:10}}>🔗</a>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>}
  </div>;
}

// ─── SHEETS LOADER + RENDER ──────────────────────────────────────
function SheetsApp() {
  const [ready, setReady] = React.useState(false);
  const [status, setStatus] = React.useState("Loading data from Google Sheets...");

  React.useEffect(() => {
    const load = async () => {
      try {
        const sRes = await fetch(SHEETS_CONFIG.scents);
        if (sRes.ok) {
          const rows = parseCSV(await sRes.text()).filter(r => r.name);
          rows.forEach(r => {
            const s = rowToScent(r);
            const idx = SCENTS.findIndex(x => x.name === s.name);
            if (idx >= 0) SCENTS[idx] = {...SCENTS[idx], ...s, ifra: {...SCENTS[idx].ifra, ...s.ifra}};
            else SCENTS.push(s);
          });
          setStatus("Scents loaded. Loading base ingredients...");
        }
      } catch(e) { console.warn("Scents sheet:", e); }
      try {
        const bRes = await fetch(SHEETS_CONFIG.bases);
        if (bRes.ok) {
          const rows = parseCSV(await bRes.text()).filter(r => r.name);
          rows.forEach(r => {
            const b = rowToBase(r);
            const idx = BASES.findIndex(x => x.name === b.name);
            if (idx >= 0) BASES[idx] = {...BASES[idx], ...b};
            else BASES.push(b);
          });
        }
      } catch(e) { console.warn("Bases sheet:", e); }
      // Load packaging
      try {
        if (SHEETS_CONFIG.packaging) {
          const pRes = await fetch(SHEETS_CONFIG.packaging);
          if (pRes.ok) {
            const rows = parseCSV(await pRes.text()).filter(r => r.name);
            PACKAGING_ITEMS.length = 0;
            rows.forEach(r => PACKAGING_ITEMS.push(rowToPackaging(r)));
            setStatus("All data loaded.");
          }
        }
      } catch(e) { console.warn("Packaging sheet:", e); }
      setReady(true);
    };
    load();
  }, []);

  if (!ready) return <div style={{background:'#192d44',color:'#ebb54a',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Odibee Sans',cursive",fontSize:24,gap:12}}>
    <div>BOEGBEELD</div>
    <div style={{fontSize:14,color:'#8aa4be',fontFamily:"'Open Sans',sans-serif"}}>{status}</div>
  </div>;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<SheetsApp />);
