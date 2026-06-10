(function() {
  'use strict';

  const STORAGE_KEY = 'web_highlighter_highlights';

  // ─── DOM References ─────────────────────────────────────────────────────
  const highlightsList = document.getElementById('highlightsList');
  const emptyState = document.getElementById('emptyState');
  const countEl = document.getElementById('count');
  const exportBtn = document.getElementById('exportBtn');

  // ─── Initialize ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', loadHighlights);

  // ─── Load Highlights ────────────────────────────────────────────────────
  function loadHighlights() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const highlights = result[STORAGE_KEY] || [];
      renderHighlights(highlights);
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  function renderHighlights(highlights) {
    // Update count
    countEl.textContent = highlights.length;

    if (highlights.length === 0) {
      emptyState.style.display = 'flex';
      highlightsList.innerHTML = '';
      return;
    }

    emptyState.style.display = 'none';

    // Sort by timestamp (newest first)
    const sorted = [...highlights].sort((a, b) => b.timestamp - a.timestamp);

    highlightsList.innerHTML = sorted.map(h => createHighlightHTML(h)).join('');

    // Attach event listeners
    sorted.forEach(h => {
      const item = document.getElementById(`hl-${h.id}`);
      if (!item) return;

      // Click on item (but not on buttons) → open URL
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete') || e.target.closest('.btn-open')) return;
        openHighlight(h.url);
      });

      // Delete button
      const deleteBtn = item.querySelector('.btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteHighlight(h.id);
        });
      }

      // Open button
      const openBtn = item.querySelector('.btn-open');
      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openHighlight(h.url);
        });
      }
    });
  }

  function createHighlightHTML(h) {
    const date = new Date(h.timestamp);
    const dateStr = date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const displayUrl = h.title || h.url;

    return `
      <div class="highlight-item" id="hl-${h.id}">
        <div class="highlight-text">${escapeHtml(h.text)}</div>
        <div class="highlight-meta">
          <span class="highlight-source" title="${escapeHtml(h.url)}">${escapeHtml(displayUrl)}</span>
          <span class="highlight-date">${dateStr}</span>
        </div>
        <div class="highlight-actions">
          <button class="btn-open" title="Открыть страницу">🔗 Открыть</button>
          <button class="btn-delete" title="Удалить выделение">🗑 Удалить</button>
        </div>
      </div>
    `;
  }

  // ─── Actions ────────────────────────────────────────────────────────────
  function deleteHighlight(id) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      let highlights = result[STORAGE_KEY] || [];
      highlights = highlights.filter(h => h.id !== id);
      chrome.storage.local.set({ [STORAGE_KEY]: highlights }, () => {
        renderHighlights(highlights);
      });
    });
  }

  function openHighlight(url) {
    chrome.tabs.create({ url: url });
  }

  // ─── Export ─────────────────────────────────────────────────────────────
  function exportToMarkdown() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const highlights = result[STORAGE_KEY] || [];
      
      if (highlights.length === 0) {
        showExportMessage('Нет выделений для экспорта');
        return;
      }

      // Group by URL
      const grouped = {};
      highlights.forEach(h => {
        if (!grouped[h.url]) {
          grouped[h.url] = {
            url: h.url,
            title: h.title,
            highlights: []
          };
        }
        grouped[h.url].highlights.push(h);
      });

      let md = `# Экспорт выделений\n\n`;
      md += `*Дата экспорта: ${new Date().toLocaleDateString('ru-RU', { 
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })}*\n\n`;
      md += `---\n\n`;

      Object.values(grouped).forEach(group => {
        md += `## ${group.title || group.url}\n\n`;
        md += `*Источник: ${group.url}*\n\n`;
        
        group.highlights
          .sort((a, b) => a.timestamp - b.timestamp)
          .forEach((h, i) => {
            const date = new Date(h.timestamp);
            const dateStr = date.toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
            md += `### ${i + 1}. Выделение\n\n`;
            md += `> ${h.text}\n\n`;
            md += `*Сохранено: ${dateStr}*\n\n`;
          });
      });

      // Create download
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `web-highlights-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);

      showExportMessage('✅ Экспорт завершён!');
    });
  }

  function showExportMessage(msg) {
    const originalText = exportBtn.textContent;
    exportBtn.textContent = msg;
    exportBtn.disabled = true;
    setTimeout(() => {
      exportBtn.textContent = originalText;
      exportBtn.disabled = false;
    }, 2000);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Event Listeners ────────────────────────────────────────────────────
  exportBtn.addEventListener('click', exportToMarkdown);

})();
