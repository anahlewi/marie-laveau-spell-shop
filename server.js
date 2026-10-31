// Etsy Witch spell shop: zero-dependency Node server.
//   /         -> spell order form (for the witch)
//   /cast     -> NFC tag landing page (eerie flashing "spell cast" page)
//   /receipt  -> latest spell receipt
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "latest-spell.json");

const SPELLS = {
  love: { name: "Love Spell", price: 4.44, blurb: "Rose quartz, moonlight & one (1) hair from a crush" },
  money: { name: "Money Spell", price: 4.44, blurb: "Bay leaves, cinnamon & a suspiciously lucky penny" },
  job: { name: "New Job Spell", price: 4.44, blurb: "LinkedIn-blessed sage bundle & a polished résumé rune" },
  hex: { name: "Hex Someone", price: 4.44, blurb: "Black candle, toad spit & a strongly worded curse" },
  custom: { name: "Custom Spell", price: 4.44, blurb: "Name your own spell. Madam brews anything (within reason)" },
};

// Custom spells carry their own name; everything else uses the menu name.
const spellName = (spell) => spell.customName || SPELLS[spell.type].name;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Spells live in Supabase when it's configured (so they survive restarts on the host),
// and in a local JSON file otherwise.
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

// With the public key the locked-down table looks empty and refuses new spells, so flag that mix-up at startup.
function keyRole(key) {
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
  } catch {
    return "unknown";
  }
}
if (useSupabase && !["secret", "service_role"].includes(keyRole(SUPABASE_KEY))) {
  console.warn(
    `WARNING: SUPABASE_SECRET_KEY looks like a "${keyRole(SUPABASE_KEY)}" key. ` +
      "Use the secret key (sb_secret_...) or the legacy service_role key, or saving spells will fail."
  );
}

async function supabase(pathAndQuery, init = {}) {
  const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json", ...init.headers };
  // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys don't.
  if (SUPABASE_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 || res.status === 201 ? null : res.json();
}

async function loadLatest() {
  if (useSupabase) {
    const [row] = await supabase("spells?select=*&order=created_at.desc&limit=1");
    if (!row) return null;
    return {
      id: row.order_no,
      type: row.type,
      customName: row.custom_name,
      target: row.target,
      note: row.note,
      createdAt: row.created_at,
    };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function saveLatest(spell) {
  if (useSupabase) {
    await supabase("spells", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        order_no: spell.id,
        type: spell.type,
        custom_name: spell.customName || null,
        target: spell.target,
        note: spell.note || null,
        created_at: spell.createdAt,
      }),
    });
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(spell, null, 2));
}

const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Mystery+Quest&family=Cormorant+Garamond:wght@500;700&family=Courier+Prime&display=swap');
  :root { --bg:#0d0714; --panel:#1b1026; --ink:#efe6ff; --muted:#a995c4; --accent:#9d4edd; --lime:#7cff6b; --orange:#ff7a1a; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; background:var(--bg); color:var(--ink);
         font-family:'Cormorant Garamond', Georgia, serif; font-size:18px; }
  a { color:var(--lime); }
  .wrap { max-width:560px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font-family:'Mystery Quest', cursive; font-weight:400; letter-spacing:1px; color:var(--orange);
       text-shadow:0 0 12px rgba(255,122,26,.6); text-align:center; margin:8px 0 4px; font-size:clamp(1.8rem, 8vw, 2.6rem); line-height:1.15; }
  .sub { text-align:center; color:var(--muted); margin:0 0 24px; }
  .btn { display:inline-block; width:100%; padding:16px; border:0; border-radius:12px; cursor:pointer;
         background:linear-gradient(135deg,var(--accent),#5a189a); color:#fff; font:700 1.2rem 'Cormorant Garamond',serif;
         text-decoration:none; text-align:center; box-shadow:0 0 20px rgba(157,78,221,.5); }
`;

function page(title, body, extraCss = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${baseStyles}${extraCss}</style></head>
<body>${body}</body></html>`;
}

function formPage(saved) {
  const options = Object.entries(SPELLS)
    .map(
      ([key, s], i) => `
    <label class="spell">
      <input type="radio" name="spell" value="${key}" ${i === 0 ? "checked" : ""}>
      <span class="card">
        <span class="name">${s.name}</span>
        <span class="blurb">${s.blurb}</span>
        <span class="price">$${s.price.toFixed(2)}</span>
      </span>
    </label>`
    )
    .join("");

  return page(
    "Madam Marie Laveau Shop",
    `<div class="wrap">
  <h1>Madam Marie Laveau Shop</h1>
  <p class="sub">★★★★★ Star Seller · Handcrafted curses since 1692</p>
  ${saved ? `<div class="saved">Spell queued! Tap your NFC tag to cast it. <a href="/cast">Preview</a></div>` : ""}
  <form method="POST" action="/">
    <div class="grid">${options}</div>
    <label class="field custom-field">Name your custom spell
      <input name="customName" maxlength="40" placeholder="e.g. Make My Ex's Wi-Fi Slow">
    </label>
    <label class="field">For (target / lucky customer)
      <input name="target" required maxlength="60" placeholder="e.g. Brad from accounting">
    </label>
    <label class="field">Special request (optional)
      <textarea name="note" maxlength="200" rows="2" placeholder="e.g. make it rain on his parade, literally"></textarea>
    </label>
    <button class="btn" type="submit">Prepare Spell</button>
  </form>
  <p class="links"><a href="/cast">NFC page</a> · <a href="/receipt">Latest receipt</a></p>
</div>
<script>
  // The custom spell name is only required when Custom Spell is picked.
  const nameInput = document.querySelector('[name=customName]');
  document.querySelectorAll('[name=spell]').forEach((r) =>
    r.addEventListener('change', () => (nameInput.required = r.value === 'custom' && r.checked))
  );
</script>`,
    `
  .saved { background:#163d1a; border:1px solid var(--lime); color:var(--lime); padding:12px; border-radius:10px; margin-bottom:16px; text-align:center; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
  .spell:last-child { grid-column:1 / -1; }
  .field.custom-field { display:none; }
  form:has(input[value="custom"]:checked) .field.custom-field { display:block; }
  .spell input { position:absolute; opacity:0; pointer-events:none; }
  .card { display:flex; flex-direction:column; gap:4px; height:100%; padding:14px; border-radius:14px; cursor:pointer;
          background:var(--panel); border:2px solid #2e1d42; transition:.2s; }
  .spell input:checked + .card { border-color:var(--lime); box-shadow:0 0 18px rgba(124,255,107,.35); transform:translateY(-2px); }
  .blurb { color:var(--muted); font-size:.9rem; line-height:1.2; flex:1; } .price { color:var(--orange); font-weight:700; }
  .field { display:block; margin-bottom:16px; color:var(--muted); }
  .field input, .field textarea { display:block; width:100%; margin-top:6px; padding:12px; border-radius:10px;
          border:1px solid #3a2752; background:var(--panel); color:var(--ink); font:inherit; }
  .links { text-align:center; margin-top:20px; color:var(--muted); }
`
  );
}

function castPage(spell) {
  if (!spell) {
    return page(
      "No spell yet",
      `<div class="wrap"><h1>The cauldron is cold…</h1><p class="sub">No spell has been prepared yet. Ask the witch.</p></div>`
    );
  }
  return page(
    "Your spell has been cast",
    `<div class="flash"></div>
<div class="fog"></div>
<div class="stage">
  <div class="spellname">${esc(spellName(spell))}</div>
  <div class="for">for <b>${esc(spell.target)}</b></div>
  <div class="sparkles" id="sparkles"></div>
  <h1 class="magic" id="magic">
    ${["Bibbidi-", "Bobbidi-", "Boo"]
      .map((word, w) => `<span class="word">${word.split("").map((c, i) => `<span style="animation-delay:${2 + (w * 8 + i) * 0.07}s">${esc(c)}</span>`).join("")}</span>`)
      .join("")}
  </h1>
  <p class="cast">your spell has been cast</p>
  <a class="btn receipt-btn" href="/receipt">View Receipt</a>
</div>
<script>
  // Burst of sparkles once the incantation lands.
  setTimeout(() => {
    const box = document.getElementById('sparkles');
    const glyphs = ['✦','✧','✦','✧','✶'];
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('span');
      el.textContent = glyphs[i % glyphs.length];
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 160;
      el.style.setProperty('--x', Math.cos(a) * d + 'px');
      el.style.setProperty('--y', Math.sin(a) * d + 'px');
      el.style.animationDelay = (Math.random() * .3) + 's';
      box.appendChild(el);
    }
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);
  }, 3200);
</script>`,
    `
  body { overflow:hidden; }
  .flash { position:fixed; inset:0; z-index:0; animation:flicker 2.6s steps(1) 1, eerie 4s ease-in-out 2.6s infinite; }
  @keyframes flicker {
    0%{background:#000} 8%{background:#7cff6b} 12%{background:#000} 20%{background:#9d4edd} 24%{background:#000}
    34%{background:#fff} 37%{background:#000} 48%{background:#7cff6b} 52%{background:#000} 63%{background:#ff1a4b}
    66%{background:#000} 78%{background:#9d4edd} 82%{background:#000} 90%{background:#fff} 93%{background:#0d0714}
  }
  @keyframes eerie {
    0%,100%{background:radial-gradient(circle at 50% 45%,#2a0f3d,#05020a 70%)}
    50%{background:radial-gradient(circle at 50% 45%,#0f3d1a,#05020a 70%)}
  }
  .fog { position:fixed; inset:-20%; z-index:1; pointer-events:none; opacity:.35;
         background:radial-gradient(ellipse at 30% 60%,rgba(124,255,107,.25),transparent 40%),
                    radial-gradient(ellipse at 70% 40%,rgba(157,78,221,.3),transparent 45%);
         animation:drift 9s ease-in-out infinite alternate; }
  @keyframes drift { to { transform:translate(6%,-4%) rotate(8deg); } }
  .stage { position:relative; z-index:2; min-height:100vh; display:flex; flex-direction:column; align-items:center;
           justify-content:center; text-align:center; padding:24px 16px; gap:10px; }
  .spellname { font-family:'Mystery Quest',cursive; font-size:clamp(1.8rem, 9vw, 2.4rem); color:var(--lime); text-shadow:0 0 20px var(--lime);
               opacity:0; animation:rise 1s ease-out 1.2s forwards, pulse 1.6s ease-in-out 2.2s infinite; }
  .for { color:var(--muted); opacity:0; animation:rise .8s ease-out 1.6s forwards; }
  .for b { color:var(--ink); }
  .magic { font-size:clamp(1.6rem, 8vw, 2.5rem); margin:10px 0 0; line-height:1.1; }
  .magic .word { white-space:nowrap; }
  .magic .word span { display:inline-block; opacity:0; animation:pop .5s cubic-bezier(.2,1.8,.4,1) forwards, glow 2s ease-in-out 4s infinite; }
  .cast { font-size:1.5rem; font-style:italic; margin:0; opacity:0; animation:rise 1s ease-out 3.6s forwards; }
  .receipt-btn { max-width:320px; margin-top:18px; opacity:0; animation:rise .8s ease-out 4.4s forwards; }
  .sparkles { position:absolute; top:50%; left:50%; pointer-events:none; }
  .sparkles span { position:absolute; font-size:1.6rem; color:var(--lime); text-shadow:0 0 10px var(--lime); animation:burst 1.4s ease-out forwards; }
  @keyframes burst { from{transform:translate(0,0) scale(.2);opacity:1} to{transform:translate(var(--x),var(--y)) scale(1.2);opacity:0} }
  @keyframes rise { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
  @keyframes pop { from{opacity:0;transform:scale(0) rotate(-30deg)} to{opacity:1;transform:none} }
  @keyframes pulse { 50%{text-shadow:0 0 40px var(--lime),0 0 80px var(--lime)} }
  @keyframes glow { 50%{color:#fff;text-shadow:0 0 18px var(--orange),0 0 36px var(--accent)} }
`
  );
}

function receiptPage(spell) {
  if (!spell) {
    return page("No receipt", `<div class="wrap"><h1>No receipts yet</h1><p class="sub">No spells have been purchased.</p></div>`);
  }
  const s = SPELLS[spell.type];
  const total = s.price.toFixed(2);
  const when = new Date(spell.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return page(
    "Spell Receipt",
    `<div class="wrap">
  <div class="receipt">
    <div class="shop">MADAM MARIE LAVEAU SHOP</div>
    <div class="center small">★★★★★ Star Seller<br>Order #${esc(spell.id)}<br>${esc(when)}</div>
    <hr>
    <div class="row"><span>${esc(spellName(spell))} ×1</span><span>$${s.price.toFixed(2)}</span></div>
    <div class="small indent">Recipient: ${esc(spell.target)}</div>
    ${spell.note ? `<div class="small indent">Request: “${esc(spell.note)}”</div>` : ""}
    <div class="row"><span>Shipping (via broomstick)</span><span>FREE</span></div>
    <hr>
    <div class="row total"><span>TOTAL</span><span>$${total}</span></div>
    <div class="row small"><span>Paid with</span><span>1 soul (partial)</span></div>
    <hr>
    <div class="center small">STATUS: CAST<br>No refunds. All hexes final.<br>Results may take 3–5 business moons.</div>
    <div class="barcode"></div>
    <div class="center small">Leave a 5-star review or be cursed</div>
  </div>
  <p class="center"><a href="/cast">← back to the magic</a></p>
</div>`,
    `
  .receipt { background:#fbf7ee; color:#1b1b1b; font-family:'Courier Prime',monospace; font-size:15px; padding:24px 18px;
             border-radius:4px; box-shadow:0 0 30px rgba(157,78,221,.4); animation:print 1s ease-out;
             -webkit-mask: radial-gradient(circle 6px at 50% 100%, transparent 98%, #000) 0 0/16px 100% repeat-x; }
  @keyframes print { from{transform:translateY(-30px);opacity:0} to{transform:none;opacity:1} }
  .shop { text-align:center; font-weight:700; font-size:1.2rem; margin-bottom:6px; }
  .center { text-align:center; } .small { font-size:13px; color:#555; } .indent { padding-left:12px; }
  hr { border:0; border-top:2px dashed #999; margin:12px 0; }
  .row { display:flex; justify-content:space-between; gap:12px; margin:4px 0; }
  .total { font-weight:700; font-size:1.15rem; }
  .barcode { height:48px; margin:16px 0 8px;
             background:repeating-linear-gradient(90deg,#111 0 2px,transparent 2px 4px,#111 4px 7px,transparent 7px 9px,#111 9px 10px,transparent 10px 13px); }
  p.center { margin-top:20px; }
`
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 10_000) req.destroy();
    });
    req.on("end", () => resolve(new URLSearchParams(data)));
    req.on("error", reject);
  });
}

const send = (res, html, status = 200) => {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname === "/" && req.method === "POST") {
        const body = await readBody(req);
        const type = body.get("spell");
        const target = (body.get("target") || "").trim().slice(0, 60);
        const customName = type === "custom" ? (body.get("customName") || "").trim().slice(0, 40) : "";
        if (!SPELLS[type] || !target || (type === "custom" && !customName)) return send(res, formPage(false), 400);
        await saveLatest({
          id: crypto.randomInt(100000, 999999).toString(),
          type,
          customName,
          target,
          note: (body.get("note") || "").trim().slice(0, 200),
          createdAt: new Date().toISOString(),
        });
        res.writeHead(303, { Location: "/?saved=1" });
        return res.end();
      }
      if (url.pathname === "/") return send(res, formPage(url.searchParams.has("saved")));
      if (url.pathname === "/cast") return send(res, castPage(await loadLatest()));
      if (url.pathname === "/receipt") return send(res, receiptPage(await loadLatest()));
      send(res, page("Lost", `<div class="wrap"><h1>404</h1><p class="sub">This page has been hexed out of existence.</p></div>`), 404);
    } catch (err) {
      console.error(err);
      send(res, "Something went wrong in the cauldron.", 500);
    }
  })
  .listen(PORT, () =>
    console.log(`Madam Marie Laveau Shop open at http://localhost:${PORT} (storage: ${useSupabase ? "Supabase" : DATA_FILE})`)
  );
