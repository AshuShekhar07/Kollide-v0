// Delivers queued rows from public.email_outbox (PLAN.md §5.6).
//
// Called by the email_outbox_dispatch trigger via pg_net with
// {"id": "<outbox id>"} and an `x-kollide-secret` header. Called with an empty
// body it drains up to 20 pending rows (for a retry cron).
import nodemailer from 'npm:nodemailer@6'
import { serviceClient } from '../_shared/admin.ts'
import { json, requireEnv, safeEqual, UUID_RE } from '../_shared/http.ts'

const MAX_ATTEMPTS = 3

type Outbox = {
  id: string
  to_email: string
  template: string
  payload: Record<string, unknown>
  attempts: number
}

const siteUrl = () => requireEnv('SITE_URL').replace(/\/$/, '')

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function layout(title: string, body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#262626">
  <h2 style="color:#7a1f5c">${title}</h2>
  ${body}
  <p style="color:#888;font-size:12px;margin-top:32px">Kollide · Bangalore · Where paths collide</p>
</div>`
}

function button(href: string, label: string): string {
  return `<p><a href="${esc(href)}" style="display:inline-block;background:#a3246a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">${esc(label)}</a></p>`
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  snapchat: 'Snapchat',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

function render(row: Outbox): { subject: string; html: string } {
  const p = row.payload
  const name = esc(p.first_name || 'there')

  switch (row.template) {
    case 'account_shared': {
      const socials = Object.entries((p.socials as Record<string, string>) ?? {})
        .map(([k, v]) => `<li>${esc(SOCIAL_LABELS[k] ?? k)}: ${esc(v)}</li>`)
        .join('')
      return {
        subject: 'Your Kollide account details',
        html: layout(
          `Hi ${name}, your details were shared with Kollide`,
          `<p>This confirms you shared the following with Kollide when you signed up:</p>
<ul>
  <li>Email: ${esc(p.email)}</li>
  <li>Phone: ${esc(p.phone)}</li>
  <li>Date of birth: ${esc(p.dob)}</li>
  <li>Photos: ${esc(p.photo_count)}</li>
  ${socials}
</ul>
<p>Your email, phone and social handles stay private. They're only shown to someone after you both kollide or join the same group.</p>
<p>Next step: record your short verification video so our team can verify you, usually within 24 hours.</p>
${button(`${siteUrl()}/onboarding`, 'Continue to Kollide')}
<p style="color:#666;font-size:13px">If you didn't create this account, reply to this email and we'll remove it.</p>`,
        ),
      }
    }
    case 'verification_approved':
      return {
        subject: "You're verified on Kollide",
        html: layout(
          `You're in, ${name}!`,
          `<p>Your profile is verified. Any kollides you sent while waiting are being delivered now, and you'll appear to others for Garba.</p>
${button(`${siteUrl()}/discover`, 'Start discovering')}`,
        ),
      }
    case 'verification_rejected': {
      const resubmit = p.can_resubmit
        ? `<p>You can record a new video once.</p>${button(`${siteUrl()}/onboarding`, 'Record a new video')}`
        : `<p>If you think this is a mistake, reply to this email.</p>`
      return {
        subject: "We couldn't verify your Kollide profile",
        html: layout(
          `Hi ${name}, we couldn't verify your video`,
          `<p>Reason: <strong>${esc(p.reason)}</strong></p>
<p>Make sure your face is well lit and clearly visible, and follow the prompts: look straight, then turn left, then right.</p>
${resubmit}`,
        ),
      }
    }
    default:
      throw new Error(`Unknown template ${row.template}`)
  }
}

function transport() {
  const secure = (Deno.env.get('SMTP_SECURE') ?? 'true') === 'true'
  const user = Deno.env.get('SMTP_USER') ?? ''
  return nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? (secure ? 465 : 587)),
    secure,
    auth: user ? { user, pass: requireEnv('SMTP_PASS') } : undefined,
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!safeEqual(req.headers.get('x-kollide-secret') ?? '', requireEnv('EMAIL_HOOK_SECRET'))) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null

  const db = serviceClient()
  let query = db
    .from('email_outbox')
    .select('id, to_email, template, payload, attempts')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
  query = id ? query.eq('id', id) : query.order('created_at').limit(20)
  const { data: rows, error } = await query
  if (error) return json({ error: error.message }, 500)

  const mailer = transport()
  const from = requireEnv('SMTP_FROM')
  const results: Record<string, string> = {}

  for (const row of (rows ?? []) as Outbox[]) {
    // Claim the row so a concurrent run doesn't send it twice.
    const { data: claimed } = await db
      .from('email_outbox')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('attempts', row.attempts)
      .eq('status', 'pending')
      .select('id')
    if (!claimed?.length) continue

    try {
      const { subject, html } = render(row)
      await mailer.sendMail({ from, to: row.to_email, subject, html })
      await db.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id)
      results[row.id] = 'sent'
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await db
        .from('email_outbox')
        .update({ status: row.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending', last_error: message.slice(0, 500) })
        .eq('id', row.id)
      results[row.id] = 'error'
    }
  }

  return json({ results }, 200)
})
