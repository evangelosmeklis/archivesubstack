'use strict';

// ── Helpers ────────────────────────────────────────────────────────────────

function isSubstackPage() {
  if (window.location.hostname.includes('substack.com')) return true;
  const generator = document.querySelector('meta[name="generator"]');
  if (generator && generator.content && generator.content.toLowerCase().includes('substack')) return true;
  // Detect custom-domain Substack sites by their DOM fingerprint
  if (document.querySelector('div#entry') || document.querySelector('article.post')) return true;
  if (document.querySelector('meta[property="og:site_name"][content*="Substack"]')) return true;
  return false;
}

function getPageInfo() {
  const isSubstack = isSubstackPage();
  const titleEl =
    document.querySelector('h1.post-title') ||
    document.querySelector('h1[class*="post-title"]') ||
    document.querySelector('h1[class*="title"]') ||
    document.querySelector('h1');

  const title = titleEl ? titleEl.textContent.trim() : document.title || 'Untitled Article';
  const authorEl =
    document.querySelector('.byline-names a') ||
    document.querySelector('a[class*="author"]') ||
    document.querySelector('[class*="byline"] a');
  const author = authorEl ? authorEl.textContent.trim() : '';

  return { isSubstack, title, author, url: window.location.href };
}

// Convert all relative/protocol-relative URLs in an HTML string to absolute
function makeAbsoluteURLs(html, base) {
  return html
    .replace(/(src|href|action)="(\/\/[^"]+)"/g, (_, attr, url) => `${attr}="https:${url}"`)
    .replace(/(src|href|action)="(\/[^/"\/][^"]*?)"/g, (_, attr, path) => {
      try { return `${attr}="${new URL(path, base).href}"`; } catch { return _; }
    });
}

// Inline all stylesheets we can access into a single <style> block
async function collectInlineCSS() {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      // Same-origin: rules are directly readable
      const rules = Array.from(sheet.cssRules || []);
      css += rules.map(r => r.cssText).join('\n') + '\n';
    } catch (_) {
      // Cross-origin: try fetching
      if (sheet.href) {
        try {
          const res = await fetch(sheet.href, { credentials: 'omit' });
          if (res.ok) css += (await res.text()) + '\n';
        } catch (_2) { /* skip unfetchable sheets */ }
      }
    }
  }
  return css;
}

// Build a self-contained HTML archive of the current page
async function buildHTMLArchive() {
  const base = window.location.href;

  // Snapshot the live DOM (includes JS-rendered content, paid articles, etc.)
  let html = document.documentElement.outerHTML;

  // Fix all relative / protocol-relative links
  html = makeAbsoluteURLs(html, base);

  // Gather inlined CSS
  const inlinedCSS = await collectInlineCSS();

  // Strip existing <link rel="stylesheet"> tags so we don't double-load
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '');

  // Remove any <script> tags — keep it as a static document
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script\b[^>]*\/>/gi, '');

  // Add archive metadata and inlined CSS before </head>
  const archiveMeta = `
<!-- ========================================================
     Archived by Substack Archiver extension
     Source  : ${base}
     Archived: ${new Date().toISOString()}
     ======================================================== -->
<meta name="substack-archiver" content="true">
<style id="substack-archiver-inline-css">
/* ── Inlined styles ── */
${inlinedCSS}
/* ── Archiver overrides ── */
.subscription-widget, .paywall-container, .metered-paywall,
[class*="subscribe-widget"], [class*="paywall"], .post-paywall,
.modal, .modal-overlay, .cookie-banner { display: none !important; }

/* ── Responsive iframes (YouTube, Vimeo, etc.) ── */
iframe[src*="youtube.com"],
iframe[src*="youtube-nocookie.com"],
iframe[src*="youtu.be"],
iframe[src*="vimeo.com"] {
  display: block;
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  aspect-ratio: 16 / 9;
}
</style>`;

  html = html.replace(/<\/head>/i, archiveMeta + '\n</head>');

  return html;
}

// ── Message handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {
    case 'ping':
      sendResponse({ alive: true });
      break;

    case 'getPageInfo':
      sendResponse(getPageInfo());
      break;

    case 'collectHTML': {
      buildHTMLArchive()
        .then(html => sendResponse({ html, title: document.title || 'article' }))
        .catch(err => sendResponse({ error: err.message }));
      return true; // keep channel open for async response
    }
  }
});
