// Harbor Sites form handler (Cloudflare Pages Function at /api/contact).
// Copied into each client site by new-client-site.sh. Emails each submission
// to the client through Resend and redirects to the site's thank-you page.
//
// Project secrets/vars (set by new-client-site.sh, never in files):
//   RESEND_API_KEY   Resend key (secret)
//   FORM_TO          client's email; sample/test sites use harborsitess@gmail.com
//   FORM_FROM        e.g. "Website form <forms@harborsites.org>" (verified in Resend)
//   FORM_BCC         optional, harborsitess@gmail.com
//   SITE_NAME        business name for the subject line
//   TURNSTILE_SECRET optional; when set, the Turnstile check is required. Confirmation
//                    emails to the visitor only go out after it passes (no backscatter spam).
// Optional KV binding:
//   RATE_LIMIT       per-IP counter (RATE_MAX submissions per 10 minutes); skipped if not bound
//
// HARBOR'S OWN COPY (harborsites.org): unlike the client template, this one also
// attaches uploaded images (questionnaire logo/photos, Launch Kit photos) to the email.
// upload-resize.js shrinks them in the browser first; the caps below are the backstop.
//
// Form markup: <form method="POST" action="/api/contact">, a hidden
// input "form-name", optional hidden "_next" (thank-you path), and the
// honeypot <p hidden><label>Leave blank <input name="bot-field"></label></p>.
// _headers rules don't apply to Function responses, so headers are set here.

const MAX_FIELDS = 40, MAX_NAME = 60, MAX_VALUE = 5000;
const MAX_FILES = 15, MAX_FILE_BYTES = 8 * 1024 * 1024, MAX_TOTAL_BYTES = 24 * 1024 * 1024; // Resend: 40MB after base64
const MAX_BODY = 25 * 1024 * 1024; // whole request, checked before parsing
const RATE_MAX = 5, RATE_WINDOW = 600; // submissions per IP per 10 minutes
const SKIP = new Set(['bot-field', '_next', 'form-name', 'cf-turnstile-response']);
const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeFile = s => String(s).replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';

function toBase64(buf) {
  const u = new Uint8Array(buf);
  if (typeof u.toBase64 === 'function') return u.toBase64();
  let bin = '';
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(bin);
}
const oneLine = s => String(s).replace(/[\r\n]+/g, ' ').slice(0, 120);
const hostOf = s => { try { return new URL(s).host; } catch { return ''; } };

// True when this IP is over RATE_MAX in the current window. KV is eventually consistent, so a burst
// can slip a few extra through; Turnstile is the main spam check, this just caps floods.
async function overLimit(kv, ip) {
  if (!kv || !ip) return false;
  const key = `contact:${ip}:${Math.floor(Date.now() / 1000 / RATE_WINDOW)}`;
  const n = parseInt(await kv.get(key).catch(() => null), 10) || 0;
  if (n >= RATE_MAX) return true;
  await kv.put(key, String(n + 1), { expirationTtl: RATE_WINDOW * 2 }).catch(() => {});
  return false;
}

function page(status, title, msg) {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>` +
    `<body style="font:18px/1.5 system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#1a1a1a"><h1>${esc(title)}</h1><p>${esc(msg)}</p><p><a href="/">Back to the home page</a></p></body></html>`,
    { status, headers: HEADERS });
}

function redirect(url, next, query) {
  // Only same-site paths, so the form can't be used to bounce visitors elsewhere.
  let path = typeof next === 'string' && /^\/(?!\/)[\w\-./]*$/.test(next) ? next : '/thank-you.html';
  if (query) path += '?' + new URLSearchParams(query).toString();
  // Relative Location: the browser stays on whatever host the form was sent from (harborsites.org is
  // proxied here from Netlify until its nameservers move, so the function sees harbor-sites.pages.dev).
  return new Response(null, { status: 303, headers: { ...HEADERS, Location: path } });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const ALLOWED = new Set([url.host, 'harborsites.org', 'www.harborsites.org']);
  // Browsers always send Origin on a form POST; a missing one means a script, not a visitor.
  if (!origin || !ALLOWED.has(hostOf(origin))) return page(403, 'Not sent', 'This form can only be sent from its own website.');

  // A missing Content-Length (chunked upload, or a proxy re-sending it) falls through; Cloudflare caps
  // request bodies at 100MB anyway, and the per-file caps below still apply.
  const size = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (size > MAX_BODY) return page(413, 'Not sent', 'That was too much to send at once. Please send fewer or smaller photos, and email us the rest.');

  // Through the Netlify proxy (until the nameservers move) every visitor shares Netlify's IP, so use the
  // client IP Netlify forwards. A faked header only dodges this cap; Turnstile still has to pass.
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('CF-Connecting-IP') || '';
  if (await overLimit(env.RATE_LIMIT, ip)) return page(429, 'Not sent', 'Too many forms sent from here in the last few minutes. Please wait 10 minutes and try again, or email us.');

  let form;
  try { form = await request.formData(); } catch { return page(400, 'Not sent', 'The form could not be read. Please try again.'); }

  // Honeypot filled in: a bot. Pretend it worked so it doesn't retry.
  if ((form.get('bot-field') || '').toString().trim()) return redirect(url, form.get('_next'));

  let verified = false;
  if (env.TURNSTILE_SECRET) {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', (form.get('cf-turnstile-response') || '').toString());
    // No remoteip: behind the Netlify proxy it would be Netlify's address, not the visitor's.
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
      .then(r => r.json()).catch(() => ({ success: false }));
    if (!check.success) return page(400, 'Not sent', 'The spam check did not pass. Please go back and try again.');
    verified = true;
  }

  const fields = [], attachments = [], skipped = [];
  let total = 0;
  for (const [name, value] of form.entries()) {
    if (SKIP.has(name)) continue;
    if (typeof value !== 'string') {
      if (!value || !value.size) continue; // empty file input
      const ok = /^image\//.test(value.type) && attachments.length < MAX_FILES &&
                 value.size <= MAX_FILE_BYTES && total + value.size <= MAX_TOTAL_BYTES;
      if (!ok) { skipped.push(value.name || name); continue; }
      total += value.size;
      attachments.push({ filename: `${safeFile(name)}-${attachments.length + 1}-${safeFile(value.name)}`,
                         content: toBase64(await value.arrayBuffer()) });
      continue;
    }
    if (fields.length >= MAX_FIELDS) break;
    fields.push([name.slice(0, MAX_NAME), value.slice(0, MAX_VALUE).trim()]);
  }
  if (attachments.length) fields.push(['attachments', attachments.map(a => a.filename).join('\n')]);
  if (skipped.length) fields.push(['files NOT attached (too big, too many, or not images): ask for these by email', skipped.join('\n')]);
  if (!fields.some(([, v]) => v)) return page(400, 'Not sent', 'The form was empty. Please go back and fill it in.');

  if (!env.RESEND_API_KEY || !env.FORM_TO || !env.FORM_FROM) {
    console.error('contact: missing RESEND_API_KEY, FORM_TO or FORM_FROM');
    return page(500, 'Not sent', 'Sorry, the form is not working right now. Please call or email us instead.');
  }

  const site = env.SITE_NAME || url.host;
  const formName = oneLine(form.get('form-name') || 'contact');
  const email = fields.find(([n]) => /e-?mail/i.test(n))?.[1] || '';
  const get = n => (fields.find(([k]) => k === n) || [])[1] || '';
  const biz = oneLine(get('business_name') || get('legal_business_name') || '');
  const person = oneLine(get('contact_name') || get('signer_name') || '');
  const who = biz || person || fields.find(([n]) => /name/i.test(n))?.[1] || 'someone';
  // Reference number shown to the visitor, put in their confirmation email and in your notification.
  const ref = 'HS-' + crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  fields.unshift(['reference', ref]);
  const text = fields.map(([n, v]) => `${n}: ${v}`).join('\n') + `\n\nSent from the ${formName} form on ${url.host}`;
  const html = '<table cellpadding="6" style="border-collapse:collapse;font:15px/1.4 sans-serif">' +
    fields.map(([n, v]) => `<tr><th align="left" valign="top" style="border-bottom:1px solid #ddd">${esc(n)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${esc(v)}</td></tr>`).join('') +
    `</table><p style="font:13px sans-serif;color:#555">Sent from the ${esc(formName)} form on ${esc(url.host)}</p>`;

  const msg = {
    from: env.FORM_FROM,
    to: env.FORM_TO.split(',').map(s => s.trim()),
    subject: oneLine(`${site}: new ${formName} from ${who} (${ref})`),
    text, html,
  };
  if (attachments.length) msg.attachments = attachments;
  if (env.FORM_BCC) msg.bcc = env.FORM_BCC.split(',').map(s => s.trim());
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) msg.reply_to = email;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
  if (!res.ok) {
    console.error('contact: Resend failed', res.status, await res.text());
    return page(502, 'Not sent', 'Sorry, your message did not go through. Please call or email us instead.');
  }

  // Confirmation to the person who filled in the form (Harbor's own intake and Launch Kit forms only).
  // Fixed wording; the only thing echoed back is their business name. A failure here never blocks the visitor.
  // Only after Turnstile passed, so nobody can use the form to send our email to strangers.
  const replyTo = env.FORM_TO.split(',')[0].trim();
  const confirm = CONFIRMATIONS[formName];
  if (confirm && verified && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    const first = (person.split(' ')[0] || 'there').slice(0, 40);
    const c = confirm({ first, biz: biz || 'your business', ref });
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Harbor Sites <forms@harborsites.org>', to: [email], reply_to: replyTo,
        subject: c.subject, text: c.text, html: c.html }),
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    if (!sent.ok) console.error('contact: confirmation email failed', sent.status, await sent.text());
  }
  return redirect(url, form.get('_next'), { ref, biz: biz.slice(0, 80) });
}

function confirmationEmail(title, intro, steps, ref) {
  const text = `${intro}\n\nReference: ${ref}\n\nWhat happens next:\n` +
    steps.map((x, i) => `${i + 1}. ${x}`).join('\n') +
    `\n\nQuestions, or something you forgot? Just reply to this email.\n\nHarbor Sites\nhttps://harborsites.org`;
  const html = `<div style="font:16px/1.55 Arial,sans-serif;color:#10222D;max-width:560px">` +
    `<p style="font-size:20px;font-weight:bold;color:#173B4C;margin:0 0 12px">${esc(title)}</p>` +
    `<p>${esc(intro)}</p>` +
    `<p style="background:#F4EFE3;border-left:4px solid #C9A24E;padding:10px 14px">Reference: <strong>${esc(ref)}</strong></p>` +
    `<p style="margin-bottom:6px"><strong>What happens next</strong></p><ol style="padding-left:20px;margin-top:0">` +
    steps.map(x => `<li style="margin-bottom:6px">${esc(x)}</li>`).join('') + `</ol>` +
    `<p>Questions, or something you forgot? Just reply to this email.</p>` +
    `<p style="color:#5A666D">Harbor Sites<br><a href="https://harborsites.org" style="color:#173B4C">harborsites.org</a></p></div>`;
  return { text, html };
}

const CONFIRMATIONS = {
  intake: ({ first, biz, ref }) => ({
    subject: `We got your questionnaire (${ref})`,
    ...confirmationEmail('Your questionnaire is in.',
      `Hi ${first}, thanks for telling us about ${biz}. This confirms we received your questionnaire.`,
      ['We look up your business and build a free sample homepage, usually within a few days.',
       'We email you a private link so you can see it.',
       'If you like it, we send you the next steps. If not, there is no charge.'], ref),
  }),
  'launch-kit': ({ first, biz, ref }) => ({
    subject: `We got your Launch Kit (${ref})`,
    ...confirmationEmail('Your Launch Kit is in.',
      `Hi ${first}, thanks for sending the details for ${biz}. This confirms we received your Launch Kit.`,
      ['We review your answers, usually within a business day or two.',
       'We email you to set up a short call if your domain or email needs connecting.',
       'We build the full site and send it to you for review before it goes live.'], ref),
  }),
};
