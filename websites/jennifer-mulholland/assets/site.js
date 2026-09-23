document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-newsletter]').forEach((form) => {
    const success = form.parentElement.querySelector('[data-newsletter-success]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]').value;
      form.hidden = true;
      if (success) {
        success.textContent = `Thank you — we'll send Soul Notes to ${email}.`;
        success.hidden = false;
      }
    });
  });
});
