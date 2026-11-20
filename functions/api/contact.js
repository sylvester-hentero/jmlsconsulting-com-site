/**
 * Cloudflare Pages Function: POST /api/contact
 * Handles discovery session inquiries for JMLS Consulting Inc. (info@jmlsconsulting.com)
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    let payload = {};

    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    }

    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim();
    const company = String(payload.company || '').trim();
    const topic = String(payload.topic || 'Fractional CFO Advisory').trim();
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

    const recipient = (env && env.CONTACT_EMAIL) || 'info@jmlsconsulting.com';
    let forwarded = false;

    // If Resend / MailChannels / webhook is configured in Cloudflare environment variables, forward automatically
    if (env && env.RESEND_API_KEY) {
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'JMLS Consulting Website <website@jmlsconsulting.com>',
          to: [recipient],
          reply_to: email,
          subject: `Discovery Session Inquiry: ${name}${company ? ` (${company})` : ''} — ${topic}`,
          text: [
            `New Discovery Session Inquiry from jmlsconsulting.com`,
            `----------------------------------------------------`,
            `Name: ${name}`,
            `Company: ${company || 'Not specified'}`,
            `Email: ${email}`,
            `Area of Interest: ${topic}`,
            ``,
            `Message:`,
            message
          ].join('\n')
        })
      });
      forwarded = resendResp.ok;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        forwarded,
        recipient,
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
