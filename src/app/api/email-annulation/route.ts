import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { client_nom, client_email, service, date_heure, message } = await req.json()

  const dateFormatee = format(new Date(date_heure), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })

  const { error } = await resend.emails.send({
    from: 'SalonFlow <onboarding@resend.dev>',
    to: 'saif.ghu.pro@gmail.com', // remplacer par client_email après vérification domaine
    subject: `Votre rendez-vous a été annulé — ${service}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #292524;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Rendez-vous annulé</h1>
        <p style="color: #78716c; margin-bottom: 24px;">Bonjour ${client_nom}, votre rendez-vous a été annulé.</p>
        <div style="background: #f5f5f4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="color: #78716c; padding: 4px 0;">Service</td><td style="text-align:right;font-weight:500">${service}</td></tr>
            <tr><td style="color: #78716c; padding: 4px 0;">Date</td><td style="text-align:right;font-weight:500">${dateFormatee}</td></tr>
          </table>
        </div>
        ${message ? `<div style="background:#fef3c7;border-radius:12px;padding:16px;margin-bottom:24px;font-size:14px;color:#92400e">${message}</div>` : ''}
        <p style="font-size: 13px; color: #a8a29e;">Pour reprendre un rendez-vous, visitez notre page de réservation.</p>
      </div>
    `,
  })

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ success: true })
} 