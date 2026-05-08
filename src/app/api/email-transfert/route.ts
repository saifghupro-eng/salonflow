import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { client_nom, client_email, service, ancienne_date_heure, nouvelle_date_heure, coiffeur_nom } = await req.json()

  const ancienneDate = format(new Date(ancienne_date_heure), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })
  const nouvelleDate = format(new Date(nouvelle_date_heure), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })

  const { error } = await resend.emails.send({
    from: 'SalonFlow <onboarding@resend.dev>',
    to: 'saif.ghu.pro@gmail.com', // remplacer par client_email après vérification domaine
    subject: `Votre rendez-vous a été déplacé — ${service}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #292524;">
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Rendez-vous déplacé 📅</h1>
        <p style="color: #78716c; margin-bottom: 24px;">Bonjour ${client_nom}, votre rendez-vous a été modifié.</p>

        <div style="background: #f5f5f4; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <p style="font-size: 12px; color: #a8a29e; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Ancien créneau</p>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="color: #78716c; padding: 3px 0;">Service</td>
              <td style="text-align:right; font-weight:500; text-decoration: line-through; color: #a8a29e">${service}</td>
            </tr>
            <tr>
              <td style="color: #78716c; padding: 3px 0;">Date</td>
              <td style="text-align:right; font-weight:500; text-decoration: line-through; color: #a8a29e">${ancienneDate}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="font-size: 12px; color: #16a34a; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Nouveau créneau</p>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="color: #78716c; padding: 3px 0;">Service</td>
              <td style="text-align:right; font-weight:500; color: #15803d">${service}</td>
            </tr>
            <tr>
              <td style="color: #78716c; padding: 3px 0;">Date</td>
              <td style="text-align:right; font-weight:500; color: #15803d">${nouvelleDate}</td>
            </tr>
            ${coiffeur_nom ? `
            <tr>
              <td style="color: #78716c; padding: 3px 0;">Coiffeur</td>
              <td style="text-align:right; font-weight:500; color: #15803d">${coiffeur_nom}</td>
            </tr>` : ''}
          </table>
        </div>

        <p style="font-size: 13px; color: #a8a29e;">
          Pour toute question, contactez directement le salon.
        </p>
      </div>
    `,
  })

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ success: true })
}