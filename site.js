/* site.js: the one script shared by index.html, admin-links.html and student-websites.html.

   What it does: shows the header links inline when they fit and collapses them into a
   popover menu when they do not (measured, so there is no fixed breakpoint), closes the
   menu after a link is chosen, and loads a small popover polyfill only in browsers that
   have no native popover support.

   It is a classic script, not a module, so the pages also work when opened from disk. */
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
  /* The fonts load without blocking, so the header may first be measured in the fallback font.
     Measure again once the real fonts have swapped in, and once everything has loaded. */
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { update(true); });
  addEventListener('load', function () { update(true); });
  update(true);

  /* In the inline layout the Class resources group is a dropdown: close it on outside click or Escape */
  var group = menu.querySelector('.menu-group details');
  if (group) {
    document.addEventListener('click', function (event) {
      if (header.classList.contains('is-wide') && group.open && !group.contains(event.target)) group.open = false;
    });
    group.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { group.open = false; group.querySelector('summary').focus(); }
    });
  }

  /* A menu link should close the menu in the collapsed layout */
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a') && menu.hasAttribute('popover') && menu.hidePopover) menu.hidePopover();
  });
})();
