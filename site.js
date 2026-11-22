/* site.js: the one script shared by every page (index.html, admin-links.html,
   student-websites.html, make-videos-with-claude.html and privacy.html).

   What it does, in two parts:
   1. Header: shows the header links inline when they fit and collapses them into a
      popover menu when they do not (measured, so there is no fixed breakpoint), closes the
      menu after a link is chosen, and loads a small popover polyfill only in browsers that
      have no native popover support.
   2. Motion effects: uses the Motion library (motion.dev, loaded from jsDelivr by a script tag
      just before this file on every page) for scroll reveals, number count-ups and the
      ranking bar fills. See the comment above that block, at the end of this file.

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

/* Motion effects (Motion is loaded from the CDN just before this file).

   Kept quiet to suit the theme: things below the fold rise into place as they scroll into view,
   with the same short lift and easing the hero uses; the big numbers count up once; the ranking
   bars fill. Anything already on screen when the page opens is left alone, so nothing flashes.
   Nothing runs with reduced motion or if the CDN fails, and printing shows everything at once. */
(function () {
  if (!window.Motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var animate = Motion.animate, inView = Motion.inView, stagger = Motion.stagger;
  var EASE = [0.2, 0.7, 0.2, 1];   /* the hero's rise easing */
  var running = [];

  /* Only below the fold: not already on screen, and not hidden (display:none has no box) */
  function below(el) {
    if (!el.getClientRects().length) return false;
    return el.getBoundingClientRect().top > innerHeight;
  }

  /* Rise into view. Elements that enter together are staggered slightly, in page order. */
  var REVEAL = [
    '.section-head', '.pinned', '.classes', '.step', '.feature', '.mini-doc', '.group-title',
    '.doc', '.fact', '.quarters li', '.batch h3', '.note',                 /* home */
    '.shead', '.rank .blurb', '.rank .rl', '.method',                      /* student websites */
    'main h2', '.videos figure', 'figure.result', '.table-wrap'            /* make videos */
  ].join(',');
  var queue = [];
  function flush() {
    var els = queue.splice(0);
    running.push(animate(els, { opacity: [0, 1], y: [16, 0] }, { duration: 0.7, ease: EASE, delay: stagger(0.06) }));
  }
  document.querySelectorAll(REVEAL).forEach(function (el) {
    if (el.closest('.card, .site-header, .site-footer') || !below(el)) return;
    el.style.opacity = '0';
    var stop = inView(el, function () {
      stop();
      if (!queue.length) requestAnimationFrame(flush);
      queue.push(el);
    }, { amount: 0.15 });
  });

  /* Count the big numbers up from zero, once, when they come into view */
  document.querySelectorAll('.doc .big, .stat b').forEach(function (el) {
    var text = el.textContent.trim(), end = parseInt(text, 10);
    if (!/^\d+$/.test(text) || end < 2) return;
    var stop = inView(el, function () {
      stop();
      running.push(animate(0, end, {
        duration: Math.min(1.4, 0.6 + end / 300), ease: [0.16, 1, 0.3, 1],
        onUpdate: function (v) { el.textContent = Math.round(v); },
        onComplete: function () { el.textContent = text; }
      }));
    }, { amount: 0.6 });
  });

  /* Student websites: each ranking list's bars fill in turn when the list scrolls into view */
  document.querySelectorAll('.rank .rl').forEach(function (list) {
    var bars = Array.prototype.filter.call(list.querySelectorAll('.bar2 i'), below);
    if (!bars.length) return;
    bars.forEach(function (b) { b.style.width = '0%'; });
    var stop = inView(list, function () {
      stop();
      bars.forEach(function (b, i) {
        running.push(animate(b, { width: ['0%', b.style.getPropertyValue('--v')] }, { duration: 0.9, ease: EASE, delay: 0.2 + Math.min(i, 12) * 0.04 }));
      });
    }, { amount: 0.1 });
  });

  /* Printing: finish everything and show all content */
  addEventListener('beforeprint', function () {
    running.forEach(function (a) { try { a.complete(); } catch (e) {} });
    document.querySelectorAll('[style*="opacity"], .bar2 i[style]').forEach(function (el) {
      el.style.removeProperty('opacity'); el.style.removeProperty('transform'); el.style.removeProperty('width');
    });
  });
})();
