import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { client_nom, client_email, service, date_heure } = await req.json()

  const date = new Date(date_heure)
  const dateFormatee = format(date, "EEEE d MMMM 'à' HH'h'mm", { locale: fr })

  const { error } = await resend.emails.send({
    from: 'SalonFlow <onboarding@resend.dev>',
    to: client_email,
    subject: `Votre rendez-vous est confirmé — ${service}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #292524;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Réservation confirmée ✓</h1>
        <p style="color: #78716c; margin-bottom: 24px;">Bonjour ${client_nom}, votre rendez-vous est bien enregistré.</p>

        <div style="background: #f5f5f4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="color: #78716c; padding: 4px 0;">Service</td>
              <td style="text-align: right; font-weight: 500;">${service}</td>
            </tr>
            <tr>
              <td style="color: #78716c; padding: 4px 0;">Date</td>
              <td style="text-align: right; font-weight: 500;">${dateFormatee}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #a8a29e;">
          Pour annuler ou modifier votre rendez-vous, contactez directement le salon.
        </p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}