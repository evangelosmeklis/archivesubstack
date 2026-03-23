'use strict';

// ── Context menu setup ────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'export-html',
    title: 'Export page as HTML',
    contexts: ['page', 'frame'],
  });
});

// ── Context menu click handler ────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'export-html' || !tab?.id) return;

  // Inject content script (no-op if already present)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (_) { /* already injected */ }

  chrome.tabs.sendMessage(tab.id, { action: 'collectHTML' }, (response) => {
    if (chrome.runtime.lastError || !response || response.error) return;

    const title = response.title || 'article';
    const filename = title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 120)
      .trim() || 'article';

    const encoded = btoa(unescape(encodeURIComponent(response.html)));
    const dataUrl = `data:text/html;charset=utf-8;base64,${encoded}`;

    // saveAs: true opens the native Save dialog so the user can rename the file
    chrome.downloads.download({ url: dataUrl, filename: filename + '.html', saveAs: true });
  });
});

// ── Popup download handler ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'triggerHTMLDownload') return;

  const { html, filename, saveAs } = message;

  const encoded = btoa(unescape(encodeURIComponent(html)));
  const dataUrl = `data:text/html;charset=utf-8;base64,${encoded}`;

  chrome.downloads.download(
    { url: dataUrl, filename, saveAs: saveAs === true },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    }
  );

  return true; // async
});
