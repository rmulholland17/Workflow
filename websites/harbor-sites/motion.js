/* Motion policy: decorative animation (the rope, the flowing margin lines) only
   runs while the visitor is scrolling and for about a second after. Nothing
   moves on its own for more than 5 seconds, so no pause button is needed
   (WCAG 2.2.2). Visitors who ask for reduced motion get none at all. */
(function(){
  var root = document.documentElement, t = null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function idle(){
    root.classList.remove('is-scrolling');
    document.dispatchEvent(new CustomEvent('scrollidle'));
  }
  window.addEventListener('scroll', function(){
    if (!root.classList.contains('is-scrolling')){
      root.classList.add('is-scrolling');
      document.dispatchEvent(new CustomEvent('scrollactive'));
    }
    clearTimeout(t);
    t = setTimeout(idle, 1200);
  }, {passive:true});
})();
