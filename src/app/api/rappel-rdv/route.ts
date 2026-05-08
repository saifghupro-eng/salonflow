import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, addDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SALON_ID = '6143f4a8-f4ab-485f-81b8-9bface600335'

export async function GET(request: Request) {
  // Sécurité : seul Vercel Cron peut appeler cette route
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const demain = addDays(startOfDay(new Date()), 1)
  const apresdemain = addDays(demain, 1)

  // Récupérer tous les RDV confirmés du lendemain
  const { data: rdvs, error } = await supabase
    .from('rendez_vous')
    .select('*')
    .eq('salon_id', SALON_ID)
    .eq('statut', 'confirme')
    .gte('date_heure', demain.toISOString())
    .lt('date_heure', apresdemain.toISOString())

  if (error) return NextResponse.json({ error }, { status: 500 })
  if (!rdvs || rdvs.length === 0) {
    return NextResponse.json({ message: 'Aucun RDV demain', sent: 0 })
  }

  let sent = 0

  for (const rdv of rdvs) {
    if (!rdv.client_email) continue

    const date = new Date(rdv.date_heure)
    const dateFormatee = format(date, "EEEE d MMMM 'à' HH'h'mm", { locale: fr })

    const { error: emailError } = await resend.emails.send({
      from: 'SalonFlow <onboarding@resend.dev>',
      to: rdv.client_email,
      subject: `Rappel — votre rendez-vous demain à ${format(date, 'HH:mm')}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #292524;">
          <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Rappel de votre rendez-vous 🗓️</h1>
          <p style="color: #78716c; margin-bottom: 24px;">Bonjour ${rdv.client_nom}, nous vous rappelons votre rendez-vous de demain.</p>

          <div style="background: #f5f5f4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #78716c; padding: 4px 0;">Service</td>
                <td style="text-align: right; font-weight: 500;">${rdv.service}</td>
              </tr>
              <tr>
                <td style="color: #78716c; padding: 4px 0;">Date</td>
                <td style="text-align: right; font-weight: 500;">${dateFormatee}</td>
              </tr>
              ${rdv.coiffeur_nom ? `
              <tr>
                <td style="color: #78716c; padding: 4px 0;">Coiffeur</td>
                <td style="text-align: right; font-weight: 500;">${rdv.coiffeur_nom}</td>
              </tr>` : ''}
            </table>
          </div>

          <p style="font-size: 13px; color: #a8a29e;">
            En cas d'empêchement, merci de nous prévenir le plus tôt possible.
          </p>
        </div>
      `,
    })

    if (!emailError) sent++
  }

  return NextResponse.json({ message: `${sent} rappel(s) envoyé(s)` })
}