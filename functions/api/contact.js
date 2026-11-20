/**
 * Cloudflare Pages Function: POST /api/contact
 * Sends an actual email natively through Cloudflare Email Routing (`cloudflare:email`)
 * via the bound `EMAIL_WORKER` service (`jmlsconsulting-email-worker` -> `env.SEND_EMAIL`),
 * delivering to the verified destination `jmlsconsulting@gmail.com` (the inbox for `info@jmlsconsulting.com`).
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    let payload = {};

    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    }

    const name = String(payload.name || '').trim().replace(/[\r\n]+/g, ' ');
    const email = String(payload.email || '').trim().replace(/[\r\n]+/g, '');
    const company = String(payload.company || '').trim().replace(/[\r\n]+/g, ' ');
    const topic = String(payload.topic || 'Fractional CFO Advisory').trim().replace(/[\r\n]+/g, ' ');
    const message = String(payload.message || '').trim();

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Please provide your name, a valid email address, and a brief message.'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const senderAddress = 'website@jmlsconsulting.com';
    const verifiedDestination = (env && env.DESTINATION_EMAIL) || 'jmlsconsulting@gmail.com';
    const subjectLine = `[jmlsconsulting.com] Discovery Inquiry: ${name}${company ? ` (${company})` : ''} - ${topic}`;
    const msgId = `<${crypto.randomUUID()}@jmlsconsulting.com>`;
    const dateHeader = new Date().toUTCString();

    const bodyText = [
      `New Discovery Session Inquiry from jmlsconsulting.com`,
      `=====================================================`,
      `Name:             ${name}`,
      `Company:          ${company || 'Not specified'}`,
      `Email:            ${email}`,
      `Area of Interest: ${topic}`,
      `Submitted At:     ${new Date().toISOString()}`,
      ``,
      `Message:`,
      `-----------------------------------------------------`,
      message,
      `-----------------------------------------------------`,
      ``,
      `Reply directly to this email to respond to ${name} <${email}>.`
    ].join('\r\n');

    const rawMime = [
      `From: "JMLS Consulting Website" <${senderAddress}>`,
      `To: "John Scalise - JMLS Consulting" <${verifiedDestination}>`,
      `Reply-To: "${name.replace(/"/g, '')}" <${email}>`,
      `Subject: ${subjectLine}`,
      `Message-ID: ${msgId}`,
      `Date: ${dateHeader}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      bodyText
    ].join('\r\n');

    let forwarded = false;
    let deliveryMethod = 'none';
    let deliveryError = null;

    // 1. Primary: Native Cloudflare Email Routing via EMAIL_WORKER Service Binding (env.SEND_EMAIL)
    if (env && env.EMAIL_WORKER && typeof env.EMAIL_WORKER.fetch === 'function') {
      try {
        const workerRes = await env.EMAIL_WORKER.fetch('https://email-worker.internal/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderAddress,
            verifiedDestination,
            rawMime
          })
        });
        const workerJson = await workerRes.json().catch(() => ({ ok: false }));
        if (workerRes.ok && workerJson.ok) {
          forwarded = true;
          deliveryMethod = 'cloudflare_send_email';
        } else {
          deliveryError = workerJson.error || `Worker returned HTTP ${workerRes.status}`;
        }
      } catch (wErr) {
        deliveryError = String(wErr?.message || wErr);
      }
    }

    // 2. Secondary fallback: Resend API if RESEND_API_KEY is configured
    if (!forwarded && env && env.RESEND_API_KEY) {
      try {
        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'JMLS Consulting Website <onboarding@resend.dev>',
            to: ['info@jmlsconsulting.com', verifiedDestination],
            reply_to: email,
            subject: subjectLine,
            text: bodyText
          })
        });
        if (resendResp.ok) {
          forwarded = true;
          deliveryMethod = 'resend';
        }
      } catch (rErr) {
        deliveryError = String(rErr?.message || rErr);
      }
    }

    if (!forwarded) {
      return new Response(
        JSON.stringify({
          ok: false,
          forwarded: false,
          error: deliveryError || 'Email delivery service unavailable.'
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        forwarded: true,
        deliveryMethod,
        recipient: 'info@jmlsconsulting.com',
        summary: {
          name,
          company,
          email,
          topic,
          receivedAt: new Date().toISOString()
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Unable to process your request at the moment. Please email info@jmlsconsulting.com directly.'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8'
        }
      }
    );
  }
}
