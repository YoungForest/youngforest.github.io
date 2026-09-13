/* Native links/details work without this progressive enhancement. No tracking. */
(() => {
  const toc = document.querySelector('.mobile-toc');
  toc?.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !toc.contains(link) || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    toc.open = false;
    toc.querySelector('summary').focus({preventScroll:true});
    // Keep native fragment navigation and browser history, after the panel has closed.
  });
  document.querySelectorAll('[data-copy-feed]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const status = button.parentElement.querySelector('.subscription-status');
      status.textContent = '';
      try {
        await navigator.clipboard.writeText(button.dataset.copyFeed);
        status.textContent = button.dataset.copied;
      } catch {
        status.textContent = button.dataset.copyFailed;
      }
    });
  });

  // Copy only legitimate code content; a pre used as prose/art is not a code block.
  const english = document.documentElement.lang.toLowerCase().startsWith('en');
  const copyLabel = english ? 'Copy code' : '复制代码';
  function codeText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeName === 'BR') return '\n';
    return Array.from(node.childNodes, codeText).join('');
  }
  document.querySelectorAll('.main-inner.post .post-body figure.highlight, .main-inner.post .post-body pre > code').forEach((block, index) => {
    if (block.closest('.legacy-comments, .mermaid') || block.querySelector('.mermaid') ||
        block.matches('.language-mermaid') || block.closest('figure.highlight') && block.tagName === 'CODE') return;
    const content = block.matches('figure.highlight') ? block.querySelector('.code pre, pre code, code.highlight') : block;
    if (!content || !codeText(content).trim()) return;
    const anchor = block.tagName === 'CODE' ? block.parentElement : block;
    if (anchor.previousElementSibling?.classList.contains('code-copy-tools')) return;
    const bar = document.createElement('div');
    bar.className = 'code-copy-tools';
    const status = document.createElement('span');
    status.className = 'code-copy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = copyLabel;
    button.setAttribute('aria-label', copyLabel + (english ? ' · block ' : ' · 代码块 ') + (index + 1));
    button.addEventListener('click', async () => {
      status.textContent = '';
      try {
        await navigator.clipboard.writeText(codeText(content));
        status.textContent = english ? 'Copied.' : '已复制。';
      } catch {
        status.textContent = english ? 'Copy failed. Select the code below and copy it manually.' : '复制失败，请选中下方代码手动复制。';
      }
    });
    bar.append(status, button);
    anchor.before(bar);
  });
  // A reload can restore a pixel offset captured before the new toolbars existed.
  // Align only the entry fragment after enhancement; never intercept clicks/history.
  const entryHash = location.hash;
  let readerMoved = false;
  for (const event of ['wheel', 'touchstart', 'keydown']) {
    window.addEventListener(event, () => { readerMoved = true; }, {once:true, passive:true});
  }
  window.addEventListener('load', () => {
    if (!entryHash || location.hash !== entryHash || readerMoved ||
        performance.getEntriesByType('navigation')[0]?.type === 'back_forward') return;
    let target;
    try { target = document.getElementById(decodeURIComponent(entryHash.slice(1))); } catch { return; }
    if (target?.matches('.post-body h2, .post-body h3') && document.querySelector('.code-copy-tools')) {
      target.scrollIntoView({block:'start', behavior:'instant'});
    }
  }, {once:true});

})();
