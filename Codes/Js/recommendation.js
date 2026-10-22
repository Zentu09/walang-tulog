/* Floating sleep recommendation. Runs in the browser only; nothing is stored or sent. */
(function () {
  'use strict';
  var form = document.getElementById('sleepComparisonForm');
  var results = document.getElementById('comparisonResults');
  var fab = document.getElementById('recoButton');
  var overlay = document.getElementById('recoOverlay');
  var panel = document.getElementById('recoPanel');
  var body = document.getElementById('recoBody');
  var closeBtn = document.getElementById('recoClose');
  var rows = document.querySelectorAll('#recoTable tbody tr');
  if (!form || !results || !fab || !overlay || !panel) return;

  // Hours per 24h (CDC / AASM). max = null means "or more".
  var RANGES = {
    '6-12':  { min: 9, max: 12,   text: '9-12 hrs' },
    '13-18': { min: 8, max: 10,   text: '8-10 hrs' },
    '18-60': { min: 7, max: null, text: '7+ hrs' },
    '61-64': { min: 7, max: 9,    text: '7-9 hrs' },
    '65+':   { min: 7, max: 8,    text: '7-8 hrs' }
  };
  var JETLAG_LIMIT = 120; // minutes

  function mins(t) {
    var p = (t || '').split(':');
    return p.length === 2 ? (+p[0]) * 60 + (+p[1]) : null;
  }
  function sleepMins(bed, rise) {
    var b = mins(bed), r = mins(rise);
    if (b === null || r === null) return null;
    var d = r - b;
    if (d <= 0) d += 1440; // crosses midnight
    return d;
  }
  // Social jetlag: difference between weekend and weekday rise times (shortest way round the clock).
  function jetlagMins(wdRise, weRise) {
    var a = mins(wdRise), b = mins(weRise);
    if (a === null || b === null) return null;
    var d = Math.abs(a - b);
    return Math.min(d, 1440 - d);
  }
  function hm(m) { return Math.floor(m / 60) + ' hrs ' + (m % 60) + ' min'; }
  function state(m, r) {
    if (m < r.min * 60) return 'below';
    if (r.max !== null && m > r.max * 60) return 'above';
    return 'within';
  }
  function stat(label, m, r) {
    return '<div class="reco-stat"><span>' + label + ': <strong>' + hm(m) + '</strong></span>' +
           '<span>Recommended: <strong>' + r.text + '</strong></span></div>';
  }
  function msg(cls, text) { return '<p class="reco-msg ' + cls + '">' + text + '</p>'; }

  function render() {
    var f = form.elements;
    var key = f.ageGroup.value, r = RANGES[key];
    var wd = sleepMins(f.weekdayBed.value, f.weekdayRise.value);
    var we = sleepMins(f.weekendBed.value, f.weekendRise.value);
    var jl = jetlagMins(f.weekdayRise.value, f.weekendRise.value);
    if (!r || wd === null || we === null || jl === null) return false;

    rows.forEach(function (tr) {
      var on = tr.getAttribute('data-age') === key;
      tr.classList.toggle('is-match', on);
      if (on) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current');
    });

    var sw = state(wd, r), se = state(we, r);
    var html = stat('Your weekday sleep', wd, r) + stat('Your weekend sleep', we, r) +
               '<div class="reco-stat"><span>Social jetlag: <strong>' + hm(jl) + '</strong></span></div>';

    if (sw === 'within' && se === 'within' && jl < JETLAG_LIMIT) {
      html += msg('good', 'You’re doing very good! Your sleep duration and schedule consistency line up with recommended guidelines.');
    } else {
      if (sw === 'within' && se === 'within') {
        html += msg('tip', 'Your weekday and weekend sleep durations are within the recommended range.');
      }
      if (sw === 'below' || se === 'below') {
        html += msg('tip', 'One or both of your sleep durations are below the recommended range. Try moving your bedtime earlier gradually, 15-30 minutes at a time. Keep a consistent sleep schedule, and limit screens before bed.');
      }
      if (sw === 'above' || se === 'above') {
        html += msg('warn', 'One or both of your sleep durations are above the recommended range. Regularly sleeping much longer than recommended can sometimes reflect poor sleep quality, and may be worth discussing with a health professional.');
      }
      if (jl >= JETLAG_LIMIT) {
        html += msg('tip', 'Your weekend wake time is 2 hours or more different from your weekday wake time. Try keeping weekend wake times closer to your weekday ones.');
      }
    }
    body.innerHTML = html;
    return true;
  }

  var lastFocus = null;
  function openPanel() {
    if (!render()) return;
    lastFocus = fab;
    overlay.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    panel.scrollTop = 0;
    closeBtn.focus();
  }
  function closePanel(returnFocus) {
    if (overlay.hidden) return;
    overlay.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    if (returnFocus !== false && !fab.hidden) fab.focus();
  }

  // Show the button only once results are visible (after "Show my comparison").
  function sync() {
    if (results.hidden || !render()) {
      fab.hidden = true;
      closePanel(false);
      return;
    }
    if (fab.hidden) fab.classList.remove('is-seen'); // fresh results: pulse again
    fab.hidden = false;
  }
  new MutationObserver(sync).observe(results, { attributes: true, attributeFilter: ['hidden'] });
  form.addEventListener('submit', function () { setTimeout(sync, 0); });

  // Changing any bed or rise time makes the button glow again.
  ['weekdayBed', 'weekdayRise', 'weekendBed', 'weekendRise'].forEach(function (name) {
    var input = form.elements[name];
    if (!input) return;
    ['input', 'change'].forEach(function (evt) {
      input.addEventListener(evt, function () {
        if (!fab.hidden) fab.classList.remove('is-seen');
      });
    });
  });

  fab.addEventListener('click', function () {
    fab.classList.add('is-seen'); // stop the pulse for good once clicked
    openPanel();
  });
  closeBtn.addEventListener('click', function () { closePanel(true); });
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closePanel(true); });
  document.addEventListener('keydown', function (e) {
    if (overlay.hidden) return;
    if (e.key === 'Escape') { closePanel(true); return; }
    if (e.key === 'Tab') { // keep focus inside the dialog
      var f = panel.querySelectorAll('a[href], button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();