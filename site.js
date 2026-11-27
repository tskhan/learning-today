/* site.js: the one script shared by every page (index.html, admin-links.html,
   student-websites.html, make-videos-with-claude.html and privacy.html).

   What it does, in two parts:
   1. Header: shows the header links inline when they fit and collapses them into a
      popover menu when they do not (measured, so there is no fixed breakpoint), closes the
      menu after a link is chosen, and loads a small, self-hosted popover polyfill only in browsers that
      have no native popover support.
   2. Motion effects: scroll reveals, number count-ups and the ranking bar fills, made with the
      browser's own Web Animations API and IntersectionObserver (no library). See the comment
      above that block, at the end of this file.

   It never measures the page while the script runs: sizes and positions come from
   ResizeObserver and IntersectionObserver, which report them after the browser's own layout,
   so loading the script doesn't force an extra layout of the whole page.

   It is a classic script, not a module, so the pages also work when opened from disk. */
(function () {
  /* Popover polyfill, loaded only where the browser has no native popover. It is served from this
     site (assets/vendor, BSD-3-Clause licence alongside) rather than a CDN, so nobody else can change it. */
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
    import('./assets/vendor/popover-polyfill-0.5.2.min.js');
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
  /* No first measurement here: the ResizeObserver above reports the header's size right after
     the browser's first layout (before it paints), and update() runs then. */

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

/* Motion effects, with the browser's Web Animations API (element.animate) and IntersectionObserver.

   Kept quiet to suit the theme: things below the fold rise into place as they scroll into view,
   with the same short lift and easing the hero uses; the big numbers count up once; the ranking
   bars fill. Anything already on screen when the page opens is left alone, so nothing flashes.
   Nothing runs with reduced motion or in browsers without these APIs, and printing shows
   everything at once. Whether something starts below the fold is read from the observer's first
   report, so no positions are measured by hand. */
(function () {
  if (!('IntersectionObserver' in window) || !Element.prototype.animate ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';   /* the hero's rise easing */
  var running = [];
  var hidden = [];                                /* elements waiting to be revealed */

  /* From an observer's first report: the element has a box and starts below the visible area
     (not on screen, not above it, and not display:none, which has no box) */
  function startsBelow(entry) {
    var r = entry.boundingClientRect;
    return (r.width || r.height) && !entry.isIntersecting && r.top > (entry.rootBounds ? entry.rootBounds.height : innerHeight);
  }

  /* Watch elements: `first` gets each one's first report; later reports go to `later` */
  function watch(els, threshold, first, later) {
    var seen = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!seen.has(entry.target)) {
          seen.add(entry.target);
          if (!first(entry)) io.unobserve(entry.target);
        } else if (entry.isIntersecting && later(entry)) {
          io.unobserve(entry.target);
        }
      });
    }, { threshold: threshold });
    els.forEach(function (el) { io.observe(el); });
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
    queue.splice(0).forEach(function (el, i) {
      el.style.removeProperty('opacity');
      running.push(el.animate(
        [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }],
        { duration: 700, easing: EASE, delay: i * 60, fill: 'backwards' }));
    });
  }
  var reveal = Array.prototype.filter.call(document.querySelectorAll(REVEAL), function (el) {
    return !el.closest('.card, .site-header, .site-footer');
  });
  watch(reveal, 0.15, function (entry) {
    if (!startsBelow(entry)) return false;
    entry.target.style.opacity = '0';
    hidden.push(entry.target);
    return true;
  }, function (entry) {
    if (!queue.length) requestAnimationFrame(flush);
    queue.push(entry.target);
    return true;
  });

  /* Count the big numbers up from zero, once, when they come into view */
  var numbers = Array.prototype.filter.call(document.querySelectorAll('.doc .big, .stat b'), function (el) {
    var text = el.textContent.trim();
    return /^\d+$/.test(text) && parseInt(text, 10) >= 2;
  });
  function countUp(el) {
    var text = el.textContent.trim(), end = parseInt(text, 10);
    var duration = Math.min(1400, 600 + end * 10 / 3), start = performance.now();
    var job = { finish: function () { job.done = true; el.textContent = text; } };
    running.push(job);
    (function tick(now) {
      if (job.done) return;
      var t = Math.min(1, (now - start) / duration);
      el.textContent = t < 1 ? Math.round(end * (1 - Math.pow(2, -10 * t))) : text;   /* ease-out */
      if (t < 1) requestAnimationFrame(tick); else job.done = true;
    })(start);
  }
  watch(numbers, 0.6, function (entry) {
    if (entry.isIntersecting && entry.intersectionRatio >= 0.6) { countUp(entry.target); return false; }
    return true;
  }, function (entry) {
    if (entry.intersectionRatio < 0.6) return false;
    countUp(entry.target);
    return true;
  });

  /* Student websites: each ranking list's bars fill in turn when the list scrolls into view.
     The bars' first reports say which start below the fold; only those are emptied. */
  var lists = document.querySelectorAll('.rank .rl');
  if (lists.length) {
    var bars = [];
    lists.forEach(function (list) { bars.push.apply(bars, list.querySelectorAll('.bar2 i')); });
    var waiting = new Map();                       /* list -> its bars waiting to fill */
    watch(bars, 0, function (entry) {
      if (!startsBelow(entry)) return false;
      var b = entry.target, list = b.closest('.rl');
      b.style.width = '0%';
      hidden.push(b);
      if (!waiting.has(list)) { waiting.set(list, []); watchList(list); }
      waiting.get(list).push(b);
      return false;
    }, function () { return true; });
    function watchList(list) {
      watch([list], 0.1, function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.1) return true;
        fill(list);
        return false;
      }, function (entry) {
        if (entry.intersectionRatio < 0.1) return false;
        fill(list);
        return true;
      });
    }
    function fill(list) {
      var listBars = waiting.get(list) || [];
      waiting.delete(list);
      listBars.forEach(function (b, i) {
        var to = b.style.getPropertyValue('--v');
        b.style.removeProperty('width');
        running.push(b.animate([{ width: '0%' }, { width: to }],
          { duration: 900, easing: EASE, delay: 200 + Math.min(i, 12) * 40, fill: 'backwards' }));
      });
    }
  }

  /* Printing: finish everything and show all content */
  addEventListener('beforeprint', function () {
    running.forEach(function (a) { try { a.finish(); } catch (e) {} });
    hidden.forEach(function (el) { el.style.removeProperty('opacity'); el.style.removeProperty('width'); });
  });
})();
