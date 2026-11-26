/* Native scroll helper — a ~1 KB stand-in for the Lenis smooth-scroll library.
   The wheel, trackpad and touch scroll natively (fast, never blocked); only the page's own
   programmatic glides (anchors, story chapters, "next project") are animated here.
   It keeps the small part of the Lenis API the pages use: scroll, limit, on('scroll'),
   scrollTo(target,{offset,duration,easing,immediate,lock,onComplete}), stop(), start(), raf(). */
(function () {
  var root = document.documentElement;
  var easeOut = function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var block = function (e) { if (e.cancelable) e.preventDefault(); };

  function NativeScroll() {
    var self = this;
    this.isStopped = false;
    this._fns = [];
    this._tw = null;
    addEventListener('scroll', function () {
      for (var i = 0; i < self._fns.length; i++) self._fns[i](self);
    }, { passive: true });
    // a user gesture cancels an unlocked glide
    var cancel = function () { if (self._tw && !self._tw.lock) self._end(false); };
    addEventListener('wheel', cancel, { passive: true });
    addEventListener('touchstart', cancel, { passive: true });
  }
  var P = NativeScroll.prototype;
  Object.defineProperty(P, 'scroll', { get: function () { return window.scrollY; } });
  Object.defineProperty(P, 'actualScroll', { get: function () { return window.scrollY; } });
  Object.defineProperty(P, 'targetScroll', { get: function () { return this._tw ? this._tw.to : window.scrollY; } });
  Object.defineProperty(P, 'limit', { get: function () { return Math.max(0, root.scrollHeight - innerHeight); } });
  P.on = function (ev, fn) { if (ev === 'scroll') this._fns.push(fn); return this; };
  P.raf = function () {};   // animation runs on its own requestAnimationFrame
  P.stop = function () { this.isStopped = true; root.style.overflow = 'hidden'; };
  P.start = function () { this.isStopped = false; root.style.overflow = ''; };
  P._jump = function (y) { window.scrollTo({ top: y, behavior: 'instant' }); };
  P._end = function (done) {
    var tw = this._tw; if (!tw) return;
    this._tw = null; cancelAnimationFrame(tw.raf);
    if (tw.lock) { removeEventListener('wheel', block, { passive: false }); removeEventListener('touchmove', block, { passive: false }); }
    if (done && tw.onComplete) tw.onComplete();
  };
  P.scrollTo = function (target, o) {
    o = o || {};
    var y = target;
    if (typeof target === 'string') target = document.querySelector(target);
    if (target && target.nodeType === 1) y = target.getBoundingClientRect().top + window.scrollY;
    if (typeof y !== 'number' || isNaN(y)) return;
    y = Math.max(0, Math.min(this.limit, y + (o.offset || 0)));
    this._end(false);
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (o.immediate || reduce) { this._jump(y); if (o.onComplete) o.onComplete(); return; }
    var from = window.scrollY, dist = y - from;
    var dur = (o.duration != null ? o.duration : Math.min(1.2, Math.max(.4, Math.abs(dist) / 2000))) * 1000;
    var ease = o.easing || easeOut, self = this;
    var tw = this._tw = { to: y, lock: !!o.lock, onComplete: o.onComplete, raf: 0 };
    if (tw.lock) { addEventListener('wheel', block, { passive: false }); addEventListener('touchmove', block, { passive: false }); }
    var t0 = performance.now();
    (function step(now) {
      if (self._tw !== tw) return;
      var t = dur > 0 ? Math.min(1, (now - t0) / dur) : 1;
      self._jump(from + dist * ease(t));
      if (t < 1) tw.raf = requestAnimationFrame(step); else self._end(true);
    })(t0);
  };
  window.Lenis = NativeScroll;
})();
