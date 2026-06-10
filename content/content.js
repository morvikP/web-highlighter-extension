(function() {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────
  let saveButton = null;
  let currentSelection = null;
  let currentRange = null;
  let isSaving = false;
  const STORAGE_KEY = 'web_highlighter_highlights';
  const HIGHLIGHT_CLASS = 'web-highlighter-mark';

  // ─── Initialization ──────────────────────────────────────────────────────
  function init() {
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousedown', onMouseDown);
    restoreHighlights();
  }

  // ─── Selection Handling ──────────────────────────────────────────────────
  function onMouseUp(e) {
    // Don't show button if we just saved (block for a short time)
    if (isSaving) {
      return;
    }

    // Don't show button if clicking inside our own UI
    if (saveButton && saveButton.contains(e.target)) {
      return;
    }

    // Don't show button if clicking on an already highlighted text
    if (e.target && e.target.classList && e.target.classList.contains(HIGHLIGHT_CLASS)) {
      return;
    }

    // Small delay to let the browser finalize the selection
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (!text || text.length === 0) {
        removeSaveButton();
        return;
      }

      currentSelection = text;
      currentRange = selection.getRangeAt(0);
      showSaveButton(e);
    }, 10);
  }

  function onMouseDown(e) {
    // Remove save button when clicking elsewhere, unless clicking the button itself
    if (saveButton && !saveButton.contains(e.target)) {
      removeSaveButton();
    }
  }

  // ─── Save Button ─────────────────────────────────────────────────────────
  function showSaveButton(e) {
    removeSaveButton();

    saveButton = document.createElement('div');
    saveButton.className = 'web-highlighter-save-btn';
    saveButton.textContent = '✏️ Сохранить';
    saveButton.addEventListener('click', onSaveClick);

    // Position near the mouse or selection
    const x = Math.min(e.clientX, window.innerWidth - 150);
    const y = Math.max(e.clientY - 40, 10);
    saveButton.style.left = x + 'px';
    saveButton.style.top = y + 'px';

    document.body.appendChild(saveButton);
  }

  function removeSaveButton() {
    if (saveButton) {
      saveButton.remove();
      saveButton = null;
    }
  }

  // ─── Save Highlight ──────────────────────────────────────────────────────
  function onSaveClick(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!currentSelection || !currentRange) {
      removeSaveButton();
      return;
    }

    // Apply highlight to the selected text
    highlightRange(currentRange);

    // Save to storage
    const highlight = {
      id: generateId(),
      text: currentSelection,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      // Store the text context for potential re-highlighting
      textContext: getTextContext(currentRange)
    };

    saveHighlight(highlight);

    // Show toast
    showToast('✅ Выделение сохранено!');

    // Clean up
    currentSelection = null;
    currentRange = null;
    removeSaveButton();

    // Set saving flag to prevent button reappearing from the mouseup event
    // that triggered this click. Reset after a short delay.
    isSaving = true;
    setTimeout(() => {
      isSaving = false;
    }, 300);
  }

  function highlightRange(range) {
    try {
      const span = document.createElement('span');
      span.className = HIGHLIGHT_CLASS;
      span.setAttribute('data-highlight-id', generateId());
      range.surroundContents(span);
    } catch (err) {
      // If surroundContents fails (e.g., across element boundaries),
      // use a more robust approach
      try {
        const fragment = range.extractContents();
        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASS;
        span.setAttribute('data-highlight-id', generateId());
        span.appendChild(fragment);
        range.insertNode(span);
      } catch (err2) {
        console.warn('Web Highlighter: Could not highlight selection', err2);
      }
    }
  }

  // ─── Storage ─────────────────────────────────────────────────────────────
  function saveHighlight(highlight) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const highlights = result[STORAGE_KEY] || [];
      highlights.push(highlight);
      chrome.storage.local.set({ [STORAGE_KEY]: highlights }, () => {
        if (chrome.runtime.lastError) {
          console.error('Web Highlighter: Storage error', chrome.runtime.lastError);
        }
      });
    });
  }

  function getTextContext(range) {
    // Get surrounding text for context (for potential re-highlighting)
    const container = range.commonAncestorContainer;
    const text = container.textContent || '';
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    
    // Get some context before and after
    const contextBefore = text.substring(Math.max(0, startOffset - 50), startOffset);
    const contextAfter = text.substring(endOffset, Math.min(text.length, endOffset + 50));
    
    return {
      before: contextBefore,
      after: contextAfter,
      fullText: text.substring(startOffset, endOffset)
    };
  }

  // ─── Restore Highlights on Page Load ─────────────────────────────────────
  function restoreHighlights() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const highlights = result[STORAGE_KEY] || [];
      const currentUrl = window.location.href;
      
      // Filter highlights for this page
      const pageHighlights = highlights.filter(h => h.url === currentUrl);
      
      if (pageHighlights.length === 0) return;

      // Try to find and highlight text on the page
      pageHighlights.forEach(highlight => {
        highlightTextOnPage(highlight);
      });
    });
  }

  function highlightTextOnPage(highlight) {
    try {
      const body = document.body;
      const treeWalker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      const textNodes = [];
      while (treeWalker.nextNode()) {
        textNodes.push(treeWalker.currentNode);
      }

      for (const node of textNodes) {
        const text = node.textContent;
        const index = text.indexOf(highlight.text);
        
        if (index !== -1) {
          // Check if this is the right context
          const context = highlight.textContext;
          if (context) {
            const beforeText = text.substring(Math.max(0, index - 50), index);
            const afterText = text.substring(
              index + highlight.text.length,
              Math.min(text.length, index + highlight.text.length + 50)
            );
            
            // If context doesn't match well, skip
            if (context.before && context.after) {
              const beforeMatch = beforeText.includes(context.before.substring(0, 20));
              const afterMatch = afterText.includes(context.after.substring(0, 20));
              if (!beforeMatch && !afterMatch) continue;
            }
          }

          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + highlight.text.length);
          
          const span = document.createElement('span');
          span.className = HIGHLIGHT_CLASS;
          span.setAttribute('data-highlight-id', highlight.id);
          
          try {
            range.surroundContents(span);
          } catch (e) {
            // If it fails, try extractContents approach
            try {
              const fragment = range.extractContents();
              span.appendChild(fragment);
              range.insertNode(span);
            } catch (e2) {
              // Skip this one
            }
          }
          
          // Only highlight first occurrence to avoid duplicates
          break;
        }
      }
    } catch (err) {
      console.warn('Web Highlighter: Could not restore highlight', err);
    }
  }

  // ─── Toast Notification ──────────────────────────────────────────────────
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'web-highlighter-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────
  function generateId() {
    return 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ─── Start ───────────────────────────────────────────────────────────────
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
