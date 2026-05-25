/**
 * page-renderer.js — renders a page from its block definitions.
 *
 * A page is { slug, name, background, blocks: [...] }.
 * Each block is { id, type, content, style }.
 * Block style { inherit: true } uses global CSS vars; otherwise overrides are applied inline.
 */

// ── Public entry point ────────────────────────────────────────
async function renderCurrentPage() {
  const slug = getCurrentSlug();

  // Fetch page (and the full pages list for nav)
  let pageData, pagesList;
  try {
    const [pRes, allRes] = await Promise.all([
      fetch(`/api/pages/${encodeURIComponent(slug)}`),
      fetch("/api/pages"),
    ]);
    if (pRes.status === 404) {
      // Fall back to home page if slug is missing
      const allJson = await allRes.json();
      pagesList = allJson.pages || [];
      pageData  = pagesList.find((p) => p.isHome) || pagesList[0];
    } else {
      pageData  = await pRes.json();
      pagesList = (await allRes.json()).pages || [];
    }
  } catch (err) {
    console.error("Failed to load page data:", err);
    return;
  }

  if (!pageData) return;

  renderNav(pagesList, pageData.slug);
  applyPageBackground(pageData.background);
  renderPageBlocks(pageData);
  updatePageTitle(pageData);

  // Signal the admin preview that this page has fully rendered.
  // The admin listens for this instead of the iframe "load" event so it
  // knows all async fetches (and the initial render) are complete before
  // pushing a preview-update postMessage.
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "page-ready", slug: pageData.slug }, "*");
    }
  } catch { /* cross-origin guard — same-origin so this is fine */ }
}

function getCurrentSlug() {
  const m = window.location.pathname.match(/^\/p\/([^/?#]+)/);
  if (m) return m[1];
  return "home";
}

function updatePageTitle(page) {
  const storeName = (window.STORE_CONFIG && window.STORE_CONFIG.name) || "Store";
  const titleEl = document.getElementById("page-title");
  const suffix  = page.isHome ? "" : ` — ${page.name}`;
  if (titleEl) titleEl.textContent = storeName + suffix;
}

// ── Navigation with dropdown ──────────────────────────────────
function renderNav(pages, currentSlug) {
  const nav = document.getElementById("nav-links");
  if (!nav) return;
  nav.innerHTML = "";

  const visible = pages.filter((p) => p.showInNav);
  if (visible.length <= 1) return; // no menu if only one page

  // Home link first
  const home = visible.find((p) => p.isHome) || visible[0];
  const others = visible.filter((p) => p !== home);

  const homeLink = document.createElement("a");
  homeLink.href = "/";
  homeLink.textContent = home.navLabel || home.name;
  homeLink.className = "nav-link" + (currentSlug === home.slug ? " active" : "");
  nav.appendChild(homeLink);

  if (others.length === 0) return;

  // Dropdown for the rest (or render as flat list if 3 or fewer)
  if (others.length <= 3) {
    others.forEach((p) => nav.appendChild(makePageLink(p, currentSlug)));
  } else {
    const dd = document.createElement("div");
    dd.className = "nav-dropdown";
    dd.innerHTML = `
      <button class="nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false">
        Pages
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="nav-dropdown-menu" role="menu"></div>
    `;
    const menu = dd.querySelector(".nav-dropdown-menu");
    others.forEach((p) => {
      const a = makePageLink(p, currentSlug);
      a.classList.add("nav-dropdown-item");
      menu.appendChild(a);
    });
    const toggle = dd.querySelector(".nav-dropdown-toggle");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = dd.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", () => {
      dd.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
    nav.appendChild(dd);
  }
}

function makePageLink(page, currentSlug) {
  const a = document.createElement("a");
  a.href = page.isHome ? "/" : `/p/${page.slug}`;
  a.textContent = page.navLabel || page.name;
  a.className = "nav-link" + (currentSlug === page.slug ? " active" : "");
  return a;
}

// ── Background ────────────────────────────────────────────────
function applyPageBackground(bg, target) {
  const el = target || document.body;
  // Clear previous inline bg
  el.style.backgroundImage      = "";
  el.style.backgroundSize       = "";
  el.style.backgroundPosition   = "";
  el.style.backgroundRepeat     = "";
  el.style.backgroundAttachment = "";
  el.style.backgroundColor      = "";

  // Remove video / slideshow if previously injected
  document.querySelectorAll(".page-bg-media").forEach((m) => m.remove());

  if (!bg || bg.inherit) {
    // Apply global bg from STORE_CONFIG (via applyBranding from store.js)
    if (typeof applyBackground === "function") {
      applyBackground(window.STORE_CONFIG || {});
    }
    return;
  }

  const type = bg.type || "color";
  if (type === "color") {
    if (bg.color) el.style.backgroundColor = bg.color;
  } else if (type === "image" && bg.imageUrl) {
    el.style.backgroundImage      = `url('${bg.imageUrl}')`;
    el.style.backgroundSize       = bg.imageSize || "cover";
    el.style.backgroundPosition   = bg.imagePosition || "center";
    el.style.backgroundAttachment = bg.parallax ? "fixed" : "scroll";
    el.style.backgroundRepeat     = "no-repeat";
  } else if (type === "gradient" && bg.gradientFrom && bg.gradientTo) {
    el.style.backgroundImage = `linear-gradient(${bg.gradientDir || "to bottom"}, ${bg.gradientFrom}, ${bg.gradientTo})`;
  } else if (type === "video" && bg.videoUrl) {
    injectVideoBg(bg.videoUrl);
  } else if (type === "slideshow" && Array.isArray(bg.slideshowImages) && bg.slideshowImages.length) {
    injectSlideshowBg(bg.slideshowImages, Number(bg.slideshowInterval) || 5);
  }
}

function injectVideoBg(url) {
  const wrap = document.createElement("div");
  wrap.className = "page-bg-media page-bg-video";
  wrap.innerHTML = `<video autoplay loop muted playsinline><source src="${escAttr(url)}"></video>`;
  document.body.prepend(wrap);
}

function injectSlideshowBg(imgs, interval) {
  const wrap = document.createElement("div");
  wrap.className = "page-bg-media page-bg-slideshow";
  imgs.forEach((src, i) => {
    const layer = document.createElement("div");
    layer.className = "page-bg-slide" + (i === 0 ? " active" : "");
    layer.style.backgroundImage = `url('${src}')`;
    wrap.appendChild(layer);
  });
  document.body.prepend(wrap);
  let idx = 0;
  setInterval(() => {
    const slides = wrap.querySelectorAll(".page-bg-slide");
    slides[idx].classList.remove("active");
    idx = (idx + 1) % slides.length;
    slides[idx].classList.add("active");
  }, Math.max(1, interval) * 1000);
}

// ── Block rendering ───────────────────────────────────────────
const BLOCK_RENDERERS = {
  hero:          renderHeroBlock,
  text:          renderTextBlock,
  banner:        renderBannerBlock,
  image:         renderImageBlock,
  "button-row":  renderButtonRowBlock,
  "product-grid":renderProductGridBlock,
  spacer:        renderSpacerBlock,
  divider:       renderDividerBlock,
};

function renderPageBlocks(page) {
  const main = document.getElementById("page-main");
  if (!main) return;
  main.innerHTML = "";
  (page.blocks || []).forEach((block) => {
    const renderer = BLOCK_RENDERERS[block.type];
    if (!renderer) return;
    const el = renderer(block);
    if (el) {
      el.classList.add("block");
      el.dataset.blockId   = block.id;
      el.dataset.blockType = block.type;
      applyBlockStyle(el, block);
      main.appendChild(el);
    }
  });
}

// Per-block style: merge global (CSS vars) with block-level overrides via inline style.
function applyBlockStyle(el, block) {
  const s = block.style || {};
  if (s.inherit) return;
  if (s.bgColor)        el.style.backgroundColor = s.bgColor;
  if (s.textColor)      el.style.color           = s.textColor;
  if (s.fontFamily)     el.style.fontFamily      = `'${s.fontFamily}', system-ui, sans-serif`;
  if (s.paddingTop)     el.style.paddingTop      = s.paddingTop + "px";
  if (s.paddingBottom)  el.style.paddingBottom   = s.paddingBottom + "px";
  if (s.textAlign)      el.style.textAlign       = s.textAlign;
  if (s.borderRadius)   el.style.borderRadius    = s.borderRadius + "px";
  if (s.accentColor)    el.style.setProperty("--accent", s.accentColor);
}

// ── Block: hero ───────────────────────────────────────────────
function renderHeroBlock(block) {
  const c = block.content || {};
  const sec = document.createElement("section");
  sec.className = "hero container block-hero";
  sec.innerHTML = `
    ${c.eyebrow ? `<div class="hero-eyebrow">${escHtml(c.eyebrow)}</div>` : ""}
    ${c.title   ? `<h1>${escHtml(c.title)}</h1>` : ""}
    ${c.tagline ? `<p>${escHtml(c.tagline)}</p>` : ""}
    ${c.showButton && c.buttonText
      ? `<a class="block-button" href="${escAttr(c.buttonUrl || "#")}">${escHtml(c.buttonText)}</a>`
      : ""}
  `;
  return sec;
}

// ── Block: text ───────────────────────────────────────────────
function renderTextBlock(block) {
  const c = block.content || {};
  const sec = document.createElement("section");
  sec.className = "container block-text";
  const html = (c.text || "")
    .split(/\n\n+/)
    .map((p) => `<p>${escHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  sec.innerHTML = html;
  return sec;
}

// ── Block: banner ─────────────────────────────────────────────
function renderBannerBlock(block) {
  const c = block.content || {};
  const sec = document.createElement("section");
  sec.className = "block-banner";
  sec.innerHTML = `
    <div class="container block-banner-inner">
      ${c.title    ? `<h2 class="block-banner-title">${escHtml(c.title)}</h2>` : ""}
      ${c.subtitle ? `<p class="block-banner-subtitle">${escHtml(c.subtitle)}</p>` : ""}
      ${c.buttonText
        ? `<a class="block-button" href="${escAttr(c.buttonUrl || "#")}">${escHtml(c.buttonText)}</a>`
        : ""}
    </div>
  `;
  return sec;
}

// ── Block: image ──────────────────────────────────────────────
function renderImageBlock(block) {
  const c = block.content || {};
  if (!c.url) return null;
  const sec = document.createElement("section");
  sec.className = "container block-image";
  const inner = `
    <img src="${escAttr(c.url)}" alt="${escAttr(c.alt || "")}" loading="lazy">
    ${c.caption ? `<figcaption>${escHtml(c.caption)}</figcaption>` : ""}
  `;
  if (c.linkUrl) {
    sec.innerHTML = `<figure><a href="${escAttr(c.linkUrl)}">${inner}</a></figure>`;
  } else {
    sec.innerHTML = `<figure>${inner}</figure>`;
  }
  return sec;
}

// ── Block: button-row ─────────────────────────────────────────
function renderButtonRowBlock(block) {
  const c = block.content || {};
  const buttons = Array.isArray(c.buttons) ? c.buttons : [];
  if (buttons.length === 0) return null;
  const sec = document.createElement("section");
  sec.className = "container block-button-row";
  sec.innerHTML = buttons.map((b) =>
    `<a class="block-button ${b.variant === "outline" ? "outline" : ""}"
        href="${escAttr(b.url || "#")}">${escHtml(b.label || "Button")}</a>`
  ).join("");
  return sec;
}

// ── Block: product-grid ───────────────────────────────────────
function renderProductGridBlock(block) {
  const c = block.content || {};
  const sec = document.createElement("section");
  sec.className = "container block-product-grid";
  sec.innerHTML = `
    ${c.showFilters ? '<div class="filter-bar" data-role="filter-bar" role="tablist"></div>' : ""}
    <div class="product-grid" data-role="product-grid" role="list"></div>
  `;
  // Defer rendering until DOM attached
  setTimeout(() => {
    const gridEl = sec.querySelector('[data-role="product-grid"]');
    const filterEl = sec.querySelector('[data-role="filter-bar"]');
    initProductSection({
      gridEl, filterEl,
      categoryFilter: c.categoryFilter || "all",
      limit:          Number(c.limit) || 0,
      showSearch:     c.showSearch !== false,
    });
  }, 0);
  return sec;
}

// ── Block: spacer ─────────────────────────────────────────────
function renderSpacerBlock(block) {
  const c = block.content || {};
  const div = document.createElement("div");
  div.className = "block-spacer";
  div.style.height = (Number(c.height) || 40) + "px";
  return div;
}

// ── Block: divider ────────────────────────────────────────────
function renderDividerBlock() {
  const wrap = document.createElement("div");
  wrap.className = "container block-divider";
  wrap.innerHTML = "<hr>";
  return wrap;
}

// ── Escapers ──────────────────────────────────────────────────
function escAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                  .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Live preview support (from admin iframe) ──────────────────
let PREVIEW_PAGES = null;

window.addEventListener("message", (ev) => {
  if (!ev.data || typeof ev.data !== "object") return;
  if (ev.origin !== window.location.origin) return;

  if (ev.data.type === "preview-update") {
    PREVIEW_PAGES = ev.data.pages;
    window.STORE_CONFIG = ev.data.config;
    if (typeof applyBranding === "function") applyBranding(ev.data.config);
    const page = (ev.data.pages || []).find((p) => p.slug === ev.data.slug);
    if (page) {
      renderNav(ev.data.pages, page.slug);
      applyPageBackground(page.background);
      renderPageBlocks(page);
      updatePageTitle(page);
    }
  } else if (ev.data.type === "highlight-block") {
    const el = document.querySelector(`[data-block-id="${ev.data.blockId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("block-highlighted");
      setTimeout(() => el.classList.remove("block-highlighted"), 1800);
    }
  }
});
