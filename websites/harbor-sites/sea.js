/* Harbor Sites water + scroll reveals.

   Water: any element with data-water gets a WebGL canvas behind its content
   that draws soft sunlight caustics (the moving light on a harbor floor).
   It drifts slowly all the time it's on screen, bends around the mouse like
   a hand trailing in water, and rings out a ripple where you click or tap.
   Because it moves continuously, every water section has a pause button
   (WCAG 2.2.2); the choice is remembered on this device. Reduced motion
   gets one still frame and no button. No WebGL keeps the CSS gradient.

   Reveals: elements with data-reveal rise into place the first time they
   scroll into view. Children of data-reveal-group are staggered. Without JS
   or with reduced motion everything is simply visible. */
(function(){
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ---------- Reveals ---------- */
  if (!reduced && hasIO){
    root.classList.add('has-reveal');
    document.querySelectorAll('[data-reveal-group]').forEach(function(g){
      Array.prototype.forEach.call(g.children, function(c, i){
        c.setAttribute('data-reveal', '');
        c.style.setProperty('--i', i);
      });
    });
    var rio = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        rio.unobserve(e.target);
      });
    }, {threshold:0.18, rootMargin:'0px 0px -6% 0px'});
    document.querySelectorAll('[data-reveal]').forEach(function(el){ rio.observe(el); });
  }

  /* ---------- Water ---------- */
  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FRAG = [
    'precision mediump float;',
    'uniform vec2 r,m;uniform float t,k,mp;uniform vec3 deep,mid,hi;uniform vec3 rip[4];',
    'vec2 h(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);',
    ' return mix(mix(dot(h(i),f),dot(h(i+vec2(1.,0.)),f-vec2(1.,0.)),u.x),',
    '            mix(dot(h(i+vec2(0.,1.)),f-vec2(0.,1.)),dot(h(i+1.),f-1.),u.x),u.y);}',
    /* Ridges of warped noise read as the web of caustic light. */
    'float caust(vec2 p){',
    ' vec2 q=vec2(n(p*.7+vec2(0.,t*.11)),n(p*.7+vec2(5.2,1.3)-t*.09));',
    ' p+=q*1.5;',
    ' float a=1.-abs(n(p+t*.06));',
    ' float b=1.-abs(n(p*1.9-t*.08+3.7));',
    ' return pow(a,10.)*.9+pow(b,13.)*.5;}',
    'void main(){',
    ' vec2 fc=gl_FragCoord.xy;',
    ' vec2 uv=fc/r;',
    ' float s=k*200.;',
    ' vec2 p=fc/s;',
    /* Mouse: push the pattern outward around the pointer, fading with distance. */
    ' vec2 dm=(fc-m)/s;float lm=length(dm);',
    ' p-=normalize(dm+1e-4)*mp*.34*exp(-lm*lm*2.)*sin(lm*9.-t*3.);',
    /* Clicks: expanding rings that bend the light and add a faint crest. */
    ' float ring=0.;',
    ' for(int i=0;i<4;i++){vec3 R=rip[i];float age=t-R.z;if(age<0.||age>4.)continue;',
    '  vec2 dr=(fc-R.xy)/s;float l=length(dr);float w=l-age*.9;',
    '  float amp=exp(-age*1.1)*exp(-w*w*18.);',
    '  p+=normalize(dr+1e-4)*amp*.2;ring+=amp;}',
    ' float c=caust(p);',
    ' float depth=smoothstep(0.,1.,uv.y);',
    ' vec3 col=mix(deep,mid,depth*.85+.1*n(p*.35+t*.03));',
    ' col+=hi*c*(.17+.33*depth);',
    ' col+=hi*ring*.2;',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  function hex(h){ return [parseInt(h.substr(1,2),16)/255, parseInt(h.substr(3,2),16)/255, parseInt(h.substr(5,2),16)/255]; }

  var KEY = 'harbor-water-paused', paused = false, waters = [];
  try { paused = localStorage.getItem(KEY) === '1'; } catch(e){}
  function setPaused(v){
    paused = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch(e){}
    waters.forEach(function(w){ w.sync(); });
  }

  function Water(el){
    var cv = document.createElement('canvas');
    cv.className = 'water-canvas';
    cv.setAttribute('aria-hidden', 'true');
    var gl = cv.getContext('webgl', {antialias:false, alpha:false, premultipliedAlpha:false});
    if (!gl) return;
    function sh(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    function U(n){ return gl.getUniformLocation(pr, n); }
    var uR = U('r'), uT = U('t'), uK = U('k'), uM = U('m'), uMP = U('mp'), uRip = U('rip');
    var cs = getComputedStyle(el);
    function col(name, fb){ var v = cs.getPropertyValue(name).trim(); return hex(/^#[0-9a-f]{6}$/i.test(v) ? v : fb); }
    gl.uniform3fv(U('deep'), col('--water-deep', '#0B2A36'));
    gl.uniform3fv(U('mid'),  col('--water-mid',  '#1D6670'));
    gl.uniform3fv(U('hi'),   col('--water-hi',   '#9EE3DA'));
    el.insertBefore(cv, el.firstChild);
    el.classList.add('has-water');

    var t = parseFloat(el.getAttribute('data-water-seed')) || 6, last = 0, raf = 0, visible = true;
    var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.65;
    var mouse = [-9999, -9999], mPow = 0, mTarget = 0;
    var rips = new Float32Array(12), ripN = 0;
    for (var i = 0; i < 4; i++) rips[i*3+2] = -99;

    function size(){
      var w = Math.max(1, Math.round(el.clientWidth * scale)), h = Math.max(1, Math.round(el.clientHeight * scale));
      if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uK, scale * (el.clientWidth < 600 ? .8 : 1));
    }
    function draw(){
      gl.uniform1f(uT, t); gl.uniform2f(uM, mouse[0], mouse[1]); gl.uniform1f(uMP, mPow);
      gl.uniform3fv(uRip, rips);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function running(){ return !reduced && !paused && visible && !document.hidden; }
    function frame(now){
      raf = 0;
      if (!running()){ last = 0; return; }
      if (last){
        var dt = Math.min(now - last, 50) / 1000;
        t += dt * 0.55;                       /* slow, calm drift */
        mPow += (mTarget - mPow) * Math.min(1, dt * 4);
        mTarget *= Math.pow(0.35, dt);        /* the wake fades when the mouse rests */
      }
      last = now;
      draw();
      raf = requestAnimationFrame(frame);
    }
    function sync(){ if (running() && !raf) raf = requestAnimationFrame(frame); }
    function local(e){
      var b = el.getBoundingClientRect();
      return [(e.clientX - b.left) * scale, (b.bottom - e.clientY) * scale];
    }

    size(); draw();
    if ('ResizeObserver' in window) new ResizeObserver(function(){ size(); draw(); }).observe(el);
    if (hasIO) new IntersectionObserver(function(es){ visible = es[0].isIntersecting; sync(); }, {threshold:0}).observe(el);
    document.addEventListener('visibilitychange', sync);
    el.addEventListener('pointermove', function(e){
      if (e.pointerType !== 'mouse' || reduced) return;
      mouse = local(e); mTarget = 1;
    });
    el.addEventListener('pointerleave', function(){ mTarget = 0; });
    el.addEventListener('pointerdown', function(e){
      if (reduced || paused) return;
      var p = local(e), j = (ripN++ % 4) * 3;
      rips[j] = p[0]; rips[j+1] = p[1]; rips[j+2] = t;
    });

    /* Pause / play control, shared by every water section on the page. */
    if (!reduced){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'water-toggle';
      el.appendChild(btn);
      btn.addEventListener('click', function(){ setPaused(!paused); });
      var label = function(){
        btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
        btn.innerHTML = paused
          ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>Play water'
          : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>Pause water';
      };
      label();
      waters.push({sync:function(){ label(); sync(); }});
    }
    sync();
  }

  function start(){ document.querySelectorAll('[data-water]').forEach(function(el){ try { Water(el); } catch(e){} }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
