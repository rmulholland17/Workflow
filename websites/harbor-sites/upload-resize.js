/* Shrinks photo uploads in the browser before a form is sent (phone photos are 3-5MB each;
   the form handler emails them as attachments with a size cap). Forms opt in with
   data-resize-uploads. If anything here fails, the form falls back to a normal submit. */
(function () {
  var MAX_SIDE = 2000, QUALITY = 0.85;

  function shrink(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (img) {
      var scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 1500000) return file;
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return new Promise(function (resolve) {
        c.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', QUALITY);
      });
    }).catch(function () { return file; });
  }

  document.querySelectorAll('form[data-resize-uploads]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.fetch || !window.FormData) return;
      var files = form.querySelectorAll('input[type=file]');
      var hasFiles = Array.prototype.some.call(files, function (i) { return i.files && i.files.length; });
      if (!hasFiles) return; // nothing to shrink: let the browser submit normally
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending...'; }
      var data = new FormData(form);
      var jobs = [];
      files.forEach(function (input) {
        data.delete(input.name);
        Array.prototype.forEach.call(input.files, function (f) {
          jobs.push(shrink(f).then(function (small) { return [input.name, small]; }));
        });
      });
      Promise.all(jobs).then(function (pairs) {
        pairs.forEach(function (p) { data.append(p[0], p[1], p[1].name); });
        return fetch(form.action, { method: 'POST', body: data, credentials: 'same-origin' });
      }).then(function (res) {
        if (res.redirected && res.ok) { window.location.href = res.url; return; }
        return res.text().then(function (html) { document.open(); document.write(html); document.close(); });
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
        form.removeAttribute('data-resize-uploads');
        HTMLFormElement.prototype.submit.call(form); // plain submit as a fallback
      });
    });
  });
})();
