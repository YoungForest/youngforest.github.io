/* NeXT v8.27.0 UI adapter. LocalSearch/searchdb 1.5.0 still owns matching and highlighting. */
(() => {
  'use strict';
  function normalizeRecords(rows, strip) {
    if (!Array.isArray(rows)) throw new Error('Search index must be an array');
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof row.title !== 'string' ||
          typeof row.url !== 'string' || (row.content != null && typeof row.content !== 'string')) {
        throw new Error('Invalid search record');
      }
      if (/^\s*(?:javascript|data|vbscript):/i.test(row.url)) throw new Error('Invalid result URL');
    }
    // Same normalization as the retained fetchData; keep input order and metadata.
    return rows.filter(row => row.title).map(row => ({
      ...row, title: row.title.trim(),
      content: row.content ? strip(row.content.trim()) : '',
      url: decodeURIComponent(row.url).replace(/\/{2,}/g, '/')
    }));
  }
  const rank = (left, right) => right.includedCount - left.includedCount ||
    right.hitCount - left.hitCount || right.id - left.id;
  if (typeof module === 'object' && module.exports) {
    module.exports = {normalizeRecords, rank};
    return;
  }
  function initialize() {
    const dialog = document.querySelector('dialog.search-dialog');
    if (!dialog || dialog.dataset.initialized || typeof dialog.showModal !== 'function') return;
    dialog.dataset.initialized = 'true';
    const input = dialog.querySelector('.search-input');
    const results = dialog.querySelector('.search-result-container');
    const status = dialog.querySelector('.search-status');
    const retry = dialog.querySelector('.search-retry');
    const reload = dialog.querySelector('.search-reload');
    const triggers = [...document.querySelectorAll('[data-search-trigger]')];
    const search = typeof LocalSearch === 'function' && typeof striptags === 'function'
      ? new LocalSearch({path: CONFIG.path, top_n_per_article: CONFIG.localsearch.top_n_per_article, unescape: CONFIG.localsearch.unescape})
      : null;
    let pending = null, generation = 0, previous = null, composing = false;
    let compositionEnded = -Infinity, announcement = 0, gutter = '';
    function say(message, delayed = false) {
      clearTimeout(announcement);
      if (delayed) announcement = setTimeout(() => { status.textContent = message; }, 180);
      else status.textContent = message;
    }
    function setState(next) {
      dialog.dataset.state = next;
      retry.hidden = next !== 'error';
      retry.disabled = next === 'loading';
      reload.hidden = next !== 'libraryError';
      results.setAttribute('aria-busy', String(next === 'loading'));
    }
    function render() {
      if (composing || !search?.isfetched) return;
      const query = input.value.trim().toLowerCase();
      const keywords = query.split(/[-\s]+/);
      const items = query ? search.getResultItems(keywords) : [];
      items.sort(rank);
      setState('ready');
      if (!query) {
        results.replaceChildren();
        say(status.dataset.empty);
      } else if (!items.length) {
        results.replaceChildren();
        say(status.dataset.none);
      } else {
        // Only the retained matcher's build-generated snippets enter HTML, never raw queries/errors.
        results.innerHTML = '<ul class="search-result-list">' + items.map(item => item.item).join('') + '</ul>';
        say(CONFIG.i18n.hits.replace('$' + '{hits}', items.length), true);
        if (typeof pjax === 'object') pjax.refresh(results);
      }
    }
    async function load() {
      if (pending || search?.isfetched) { render(); return; }
      if (!search || !CONFIG.path) {
        setState('libraryError');
        say(status.dataset.libraryError);
        return;
      }
      const token = ++generation;
      const controller = new AbortController();
      pending = controller;
      setState('loading');
      results.replaceChildren();
      say(status.dataset.loading);
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(CONFIG.path, {signal: controller.signal});
        if (!response.ok) throw new Error('Search HTTP ' + response.status);
        const data = normalizeRecords(await response.json(), striptags);
        if (token !== generation) return;
        if (controller.signal.aborted) throw new Error('Search timeout');
        search.datas = data;
        search.isfetched = true;
        render();
      } catch {
        if (token !== generation) return;
        search.isfetched = false;
        setState('error');
        say(status.dataset.error);
      } finally {
        clearTimeout(timer);
        if (token === generation) pending = null;
      }
    }
    function open(trigger) {
      if (!dialog.open) {
        previous = trigger || document.activeElement;
        if (!document.body.classList.contains('search-active')) gutter = document.body.style.getPropertyValue('--dialog-scrollgutter');
        if (typeof NexT !== 'undefined') NexT.utils.setGutter();
        dialog.showModal();
        document.body.classList.add('search-active');
      }
      input.focus({preventScroll: true});
      void load();
    }
    function visible(element) {
      return element?.isConnected && !element.hidden && element.getClientRects().length;
    }
    dialog.addEventListener('close', () => {
      if (dialog.open) return; // Ignore a queued close event from an immediate reopen.
      document.body.classList.remove('search-active');
      document.body.style.setProperty('--dialog-scrollgutter', gutter);
      const target = visible(previous) ? previous : triggers.find(visible);
      target?.focus({preventScroll: true});
      clearTimeout(announcement);
    });
    dialog.querySelector('.popup-btn-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => {
      if (composing || performance.now() - compositionEnded < 100) event.preventDefault();
    });
    let backdropDown = false;
    const outside = event => {
      const box = dialog.getBoundingClientRect();
      return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    };
    dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog && outside(event); });
    dialog.addEventListener('click', event => {
      if (backdropDown && event.target === dialog && outside(event)) dialog.close();
      backdropDown = false;
    });
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; compositionEnded = performance.now(); render(); });
    input.addEventListener('input', event => { if (!event.isComposing && !composing) render(); });
    retry.addEventListener('click', () => { void load(); });
    reload.addEventListener('click', () => location.reload());
    dialog.addEventListener('keydown', event => {
      if (event.isComposing || composing || event.keyCode === 229) return;
      // Chrome consumes Escape on a populated type=search input before native dialog cancel.
      // Close once and retain the query, except immediately after an IME candidate is dismissed.
      if (event.key === 'Escape') {
        event.preventDefault();
        if (performance.now() - compositionEnded >= 100) dialog.close();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), input, a[href], [tabindex="0"]')].filter(visible);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    for (const trigger of triggers) {
      trigger.hidden = false;
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', dialog.id);
      trigger.addEventListener('click', () => open(trigger));
    }
    document.querySelectorAll('[data-search-fallback]').forEach(link => { link.hidden = true; });
    window.addEventListener('keydown', event => {
      if (event.isComposing || composing || event.keyCode === 229 || event.repeat) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open(dialog.open ? previous : document.activeElement);
      }
    });
    if (search) search.highlightSearchWords(document.querySelector('.post-body'));
    document.addEventListener('pjax:success', () => {
      if (dialog.open) dialog.close();
      search?.highlightSearchWords(document.querySelector('.post-body'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
})();
