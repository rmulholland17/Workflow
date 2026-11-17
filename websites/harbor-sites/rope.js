/* Harbor Sites brand motif: a rope down the page margin with the life ring
   riding on it. The rope sways gently; the ring's position is the reader's
   scroll progress through the page. Wide screens only (needs real margin),
   purely decorative, never intercepts clicks. */
(function(){
  var MIN_W = 1300, W = 60, AMP = 10, WL = 280;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paused(){ return reduced || !document.documentElement.classList.contains('is-scrolling'); }

  var rail = document.createElement('div');
  rail.className = 'rope-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML =
    '<svg class="rope-svg"><path class="rope-shadow"/><path class="rope-base"/><path class="rope-strand"/></svg>' +
    '<div class="rope-ring"><svg viewBox="0 0 64 64">' +
      '<circle cx="32" cy="32" r="24" fill="none" stroke="#173B4C" stroke-width="11"/>' +
      '<circle cx="32" cy="32" r="24" fill="none" stroke="#C9A24E" stroke-width="11" stroke-dasharray="12.566 25.133" stroke-dashoffset="6.283"/>' +
    '</svg></div>';
  document.body.appendChild(rail);

  var svg = rail.querySelector('svg'), paths = rail.querySelectorAll('path'), ring = rail.querySelector('.rope-ring');
  var phase = 0, H = 0, raf = null;

  function x(y){ return W / 2 + AMP * Math.sin((y / WL) * 2 * Math.PI + phase); }
  function build(){
    var d = 'M' + x(-20).toFixed(1) + ' -20';
    for (var y = -8; y <= H + 20; y += 12) d += ' L' + x(y).toFixed(1) + ' ' + y;
    paths.forEach(function(p){ p.setAttribute('d', d); });
  }
  function place(){
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var prog = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    var y = 80 + prog * (H - 160);
    var turn = reduced ? 0 : prog * 540;
    ring.style.transform = 'translate(' + (x(y) - 22).toFixed(1) + 'px,' + (y - 22).toFixed(1) + 'px) rotate(' + turn.toFixed(1) + 'deg)';
  }
  function size(){
    H = window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    build(); place();
  }
  function frame(t){ phase = t / 4200; build(); place(); raf = window.requestAnimationFrame(frame); }
  function stop(){ if (raf){ window.cancelAnimationFrame(raf); raf = null; } }
  function toggle(){
    var on = window.innerWidth >= MIN_W && !document.hidden;
    rail.hidden = window.innerWidth < MIN_W;
    if (on){ size(); if (paused()) stop(); else if (!raf) raf = window.requestAnimationFrame(frame); }
    else stop();
  }

  window.addEventListener('scroll', function(){ if (!rail.hidden) place(); }, {passive:true});
  window.addEventListener('resize', toggle);
  document.addEventListener('visibilitychange', toggle);
  document.addEventListener('scrollactive', toggle);
  document.addEventListener('scrollidle', toggle);
  toggle();
})();
