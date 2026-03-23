'use strict';

// ── Utilities ─────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')  // illegal chars
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120)                            // keep it reasonable
    .trim() || 'article';
}

function setStatus(msg, type = 'info') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = `status visible ${type}`;
}

function clearStatus() {
  const el = document.getElementById('status');
  el.className = 'status';
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  if (loading) {
    btn.dataset.origTitle = btn.querySelector('.btn-title').textContent;
    btn.querySelector('.btn-title').textContent = 'Working…';
  } else {
    btn.querySelector('.btn-title').textContent = btn.dataset.origTitle || '';
  }
}

// ── Render helpers ────────────────────────────────────────────────────────

function renderNotSubstack() {
  document.getElementById('content').innerHTML = `
    <div class="not-substack">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 12h6m-3-3v6M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/>
      </svg>
      <p>Navigate to a Substack article<br>to archive it.</p>
    </div>`;
}

function renderArticleUI(info) {
  const meta = [info.author, new URL(info.url).hostname].filter(Boolean).join(' · ');
  const defaultFilename = sanitizeFilename(info.title);

  document.getElementById('content').innerHTML = `
    <div class="article-info">
      <div class="article-title" title="${escapeAttr(info.title)}">${escapeHTML(info.title)}</div>
      <div class="article-meta">${escapeHTML(meta)}</div>
    </div>

    <div class="filename-row">
      <label class="filename-label" for="filename-input">Export filename</label>
      <div class="filename-input-wrap">
        <input
          id="filename-input"
          class="filename-input"
          type="text"
          value="${escapeAttr(defaultFilename)}"
          spellcheck="false"
          autocomplete="off"
        >
        <span class="filename-ext">.html</span>
      </div>
    </div>

    <div class="btn-group">
      <button class="btn btn-html" id="btn-html">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        <div class="btn-label">
          <span class="btn-title">Download HTML</span>
          <span class="btn-sub">Self-contained file, opens offline</span>
        </div>
      </button>
    </div>

    <div class="status" id="status"></div>`;

  document.getElementById('btn-html').addEventListener('click', () => downloadHTML());
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

// ── Download handlers ─────────────────────────────────────────────────────

async function downloadHTML() {
  clearStatus();
  setLoading('btn-html', true);
  setStatus('Collecting page content…', 'info');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Ensure content script is injected (handles navigation after initial load)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (_) { /* already injected */ }

  chrome.tabs.sendMessage(tab.id, { action: 'collectHTML' }, async (response) => {
    if (chrome.runtime.lastError || !response) {
      setStatus('Could not reach page. Try reloading the tab.', 'error');
      setLoading('btn-html', false);
      return;
    }

    if (response.error) {
      setStatus(`Error: ${response.error}`, 'error');
      setLoading('btn-html', false);
      return;
    }

    // Use whatever name the user typed; fall back to a safe default
    const inputEl = document.getElementById('filename-input');
    const rawName = inputEl ? inputEl.value.trim() : '';
    const filename = (sanitizeFilename(rawName) || 'article') + '.html';

    setStatus('Saving file…', 'info');

    chrome.runtime.sendMessage(
      { action: 'triggerHTMLDownload', html: response.html, filename },
      (dlResponse) => {
        setLoading('btn-html', false);
        if (chrome.runtime.lastError || !dlResponse?.success) {
          setStatus('Download failed. Check browser download settings.', 'error');
        } else {
          setStatus(`Saved as "${filename}"`, 'success');
        }
      }
    );
  });
}

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) {
    renderNotSubstack();
    return;
  }

  // Inject content script in case it hasn't run yet (e.g. extension just installed)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (_) { /* already present */ }

  chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, (info) => {
    if (chrome.runtime.lastError || !info || !info.isSubstack) {
      renderNotSubstack();
      return;
    }
    renderArticleUI(info);
  });
}

document.addEventListener('DOMContentLoaded', init);
