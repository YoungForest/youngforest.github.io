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
})();
