/* learning-today.com shared header behaviour. Classic script so it also works when a page is opened from disk. */
(function () {
  /* Popover polyfill, loaded only where the browser has no native popover */
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
    import('https://unpkg.com/@oddbird/popover-polyfill@0.5.2/dist/popover.min.js');
  }

  var header = document.querySelector('.site-header');
  if (!header) return;
  var inner = header.querySelector('.header-inner');
  var menu = document.getElementById('site-menu');
  var lastWidth = 0;

  function isOpen() {
    try { return menu.matches(':popover-open'); } catch (e) { return false; }
  }

  /* Show the links inline when the header row fits; otherwise keep them in the menu popover */
  function update(force) {
    var width = header.clientWidth;
    var wide = header.classList.contains('is-wide');
    if (!wide && !force && width <= lastWidth) { lastWidth = width; return; }
    lastWidth = width;
    var wasOpen = isOpen();
    header.classList.add('is-measuring', 'is-wide');
    menu.removeAttribute('popover');
    var fits = inner.scrollWidth <= inner.clientWidth;
    if (!fits) {
      header.classList.remove('is-wide');
      menu.setAttribute('popover', 'auto');
      if (wasOpen && menu.showPopover) menu.showPopover();
    }
    requestAnimationFrame(function () { header.classList.remove('is-measuring'); });
  }

  new ResizeObserver(function () { update(false); }).observe(header);
  new ResizeObserver(function () { update(false); }).observe(menu);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { update(true); });
  update(true);

  /* A menu link should close the menu in the collapsed layout */
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a') && menu.hasAttribute('popover') && menu.hidePopover) menu.hidePopover();
  });
})();
