/* ================================================================
   nav.js — builds the sticky site nav and marks the current page.
   Each page lives in its own folder at bass/pages/<slug>/index.html
   (with its page-specific style.css alongside), and loads this file
   from ../../shared/nav.js. Add a new page by creating
   bass/pages/<slug>/ and appending one { slug, label } entry to
   NAV_PAGES.
   ================================================================ */

var NAV_PAGES = [
  { slug: 'interval-map',    label: 'Interval Map'    },
  { slug: 'intervals',       label: 'Intervals'       },
  { slug: 'triads',          label: 'Triads'          },
  { slug: 'note-randomizer', label: 'Note Randomizer' }
];

/* Pages are sibling folders under bass/pages/, so '../<slug>/' reaches
   any other page. Links name index.html explicitly so they work from
   file:// as well as on a web server (e.g. GitHub Pages). */
function pageHref(slug) {
  return '../' + slug + '/index.html';
}

/* The current page's slug is its folder name: the last non-empty path
   segment, ignoring a trailing index.html. Handles /bass/pages/triads/,
   /bass/pages/triads/index.html and
   file:///.../bass/pages/triads/index.html. */
function currentSlug(pathname) {
  var parts = pathname.split('/').filter(function(s) { return s !== ''; });
  if (parts.length && parts[parts.length - 1] === 'index.html') parts.pop();
  return parts.length ? parts[parts.length - 1] : '';
}

function buildNav() {
  var current = currentSlug(window.location.pathname);

  var nav = document.createElement('nav');
  nav.className = 'site-nav';

  var brand = document.createElement('a');
  brand.className = 'nav-brand';
  brand.href = pageHref('interval-map');
  brand.textContent = 'Bass';
  nav.appendChild(brand);

  NAV_PAGES.forEach(function(page) {
    var a = document.createElement('a');
    a.className = 'nav-link' + (current === page.slug ? ' active' : '');
    a.href = pageHref(page.slug);
    a.textContent = page.label;
    nav.appendChild(a);
  });

  document.body.insertBefore(nav, document.body.firstChild);
}

document.addEventListener('DOMContentLoaded', buildNav);
