'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Creneau } from '@/lib/types'
import { format, addDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'

const SALON_ID = '6143f4a8-f4ab-485f-81b8-9bface600335'
const SERVICES = [
  { nom: 'Coupe femme', duree: 45 },
  { nom: 'Coupe homme', duree: 30 },
  { nom: 'Couleur', duree: 90 },
  { nom: 'Balayage', duree: 120 },
]

function isEmailValide(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function PageReservation() {
  const [jourSelectionne, setJourSelectionne] = useState<Date>(new Date())
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [creneauChoisi, setCreneauChoisi] = useState<string | null>(null)
  const [serviceChoisi, setServiceChoisi] = useState(SERVICES[0])
  const [form, setForm] = useState({ nom: '', email: '', telephone: '' })
  const [emailErreur, setEmailErreur] = useState('')
  const [etape, setEtape] = useState<'choix' | 'form' | 'confirme'>('choix')
  const [chargement, setChargement] = useState(false)

  const jours = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i))

  useEffect(() => { chargerCreneaux() }, [jourSelectionne, serviceChoisi])

  async function chargerCreneaux() {
    const debut = startOfDay(jourSelectionne)
    const fin = addDays(debut, 1)
    const jourSemaine = (jourSelectionne.getDay() + 6) % 7 // 0=lundi

    // Récupérer les horaires du salon pour ce jour
    const { data: horaireJour } = await supabase
      .from('horaires')
      .select('*')
      .eq('salon_id', SALON_ID)
      .eq('jour_semaine', jourSemaine)
      .single()

    // Si fermé ou pas d'horaire → aucun créneau
    if (!horaireJour || horaireJour.est_ferme) {
      setCreneaux([])
      return
    }

    const [hOuvre] = horaireJour.heure_ouverture.split(':').map(Number)
    const [hFerme] = horaireJour.heure_fermeture.split(':').map(Number)

    // Récupérer les RDV existants
    const { data: rdvExistants } = await supabase
      .from('rendez_vous')
      .select('date_heure, duree_minutes')
      .eq('salon_id', SALON_ID)
      .gte('date_heure', debut.toISOString())
      .lt('date_heure', fin.toISOString())
      .eq('statut', 'confirme')

    const creneauxGeneres: Creneau[] = []
    for (let h = hOuvre; h < hFerme; h++) {
      for (let m = 0; m < 60; m += 30) {
        // Ne pas afficher si le créneau + durée dépasse la fermeture
        const finCreneau = h + (m + serviceChoisi.duree) / 60
        if (finCreneau > hFerme) continue

        const heure = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        const dateHeure = new Date(jourSelectionne)
        dateHeure.setHours(h, m, 0, 0)

        // Ne pas afficher les créneaux passés
        if (dateHeure < new Date()) continue

        const occupe = (rdvExistants || []).some(rdv => {
          const debutRdv = new Date(rdv.date_heure)
          const finRdv = new Date(debutRdv.getTime() + rdv.duree_minutes * 60000)
          const finNouveauRdv = new Date(dateHeure.getTime() + serviceChoisi.duree * 60000)
          return dateHeure < finRdv && finNouveauRdv > debutRdv
        })

        creneauxGeneres.push({ heure, disponible: !occupe })
      }
    }
    setCreneaux(creneauxGeneres)
  }

  async function confirmerReservation() {
    if (!creneauChoisi || !form.nom || !form.email) return
    if (!isEmailValide(form.email)) {
      setEmailErreur('Veuillez entrer un email valide')
      return
    }
    setChargement(true)

    const [h, m] = creneauChoisi.split(':').map(Number)
    const dateHeure = new Date(jourSelectionne)
    dateHeure.setHours(h, m, 0, 0)

    const { error } = await supabase.from('rendez_vous').insert({
      salon_id: SALON_ID,
      client_nom: form.nom,
      client_email: form.email,
      client_telephone: form.telephone,
      service: serviceChoisi.nom,
      duree_minutes: serviceChoisi.duree,
      date_heure: dateHeure.toISOString(),
      statut: 'confirme',
    })

    if (!error) {
      await fetch('/api/email-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: form.nom,
          client_email: form.email,
          service: serviceChoisi.nom,
          date_heure: dateHeure.toISOString(),
        }),
      })
      setEtape('confirme')
    }
    setChargement(false)
  }

  if (etape === 'confirme') {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-stone-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-medium text-stone-800 mb-2">Réservation confirmée !</h1>
          <p className="text-stone-500 text-sm mb-1">Un email de confirmation a été envoyé à</p>
          <p className="font-medium text-stone-700 mb-6">{form.email}</p>
          <div className="bg-stone-50 rounded-xl p-4 text-left text-sm text-stone-600 space-y-1">
            <p><span className="font-medium">Service :</span> {serviceChoisi.nom}</p>
            <p><span className="font-medium">Date :</span> {format(jourSelectionne, 'EEEE d MMMM', { locale: fr })}</p>
            <p><span className="font-medium">Heure :</span> {creneauChoisi}</p>
          </div>
          <button
            onClick={() => { setEtape('choix'); setCreneauChoisi(null); setForm({ nom: '', email: '', telephone: '' }) }}
            className="mt-6 text-sm text-stone-400 underline"
          >
            Faire une autre réservation
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8 pt-6">
          <h1 className="text-2xl font-medium text-stone-800">Prendre rendez-vous</h1>
          <p className="text-stone-500 text-sm mt-1">Choisissez un créneau disponible</p>
        </div>

        {/* Service */}
        <section className="bg-white rounded-2xl p-5 mb-4 border border-stone-200">
          <h2 className="text-sm font-medium text-stone-500 mb-3">Service</h2>
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map(s => (
              <button
                key={s.nom}
                onClick={() => { setServiceChoisi(s); setCreneauChoisi(null); setEtape('choix') }}
                className={`p-3 rounded-xl text-left text-sm border transition-all ${
                  serviceChoisi.nom === s.nom
                    ? 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-200 text-stone-600 hover:border-stone-400'
                }`}
              >
                <div className="font-medium">{s.nom}</div>
                <div className="text-xs opacity-60 mt-0.5">{s.duree} min</div>
              </button>
            ))}
          </div>
        </section>

        {/* Jour */}
        <section className="bg-white rounded-2xl p-5 mb-4 border border-stone-200">
          <h2 className="text-sm font-medium text-stone-500 mb-3">Jour</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {jours.map(jour => (
              <button
                key={jour.toISOString()}
                onClick={() => { setJourSelectionne(jour); setCreneauChoisi(null); setEtape('choix') }}
                className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl text-sm border transition-all w-14 ${
                  format(jour, 'yyyy-MM-dd') === format(jourSelectionne, 'yyyy-MM-dd')
                    ? 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-200 text-stone-600 hover:border-stone-400'
                }`}
              >
                <span className="text-xs opacity-60">{format(jour, 'EEE', { locale: fr })}</span>
                <span className="font-medium mt-0.5">{format(jour, 'd')}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Créneaux */}
        <section className="bg-white rounded-2xl p-5 mb-4 border border-stone-200">
          <h2 className="text-sm font-medium text-stone-500 mb-3">Créneau</h2>
          {creneaux.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">Aucun créneau disponible ce jour</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {creneaux.filter(c => c.disponible).map(c => (
                <button
                  key={c.heure}
                  onClick={() => { setCreneauChoisi(c.heure); setEtape('form') }}
                  className={`p-2 rounded-xl text-sm border transition-all ${
                    creneauChoisi === c.heure
                      ? 'border-stone-800 bg-stone-800 text-white'
                      : 'border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {c.heure}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Formulaire */}
        {etape === 'form' && (
          <section className="bg-white rounded-2xl p-5 mb-4 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Vos coordonnées</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Votre prénom et nom"
                value={form.nom}
                onChange={e => setForm({ ...form, nom: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400"
              />
              <div>
                <input
                  type="email"
                  placeholder="Votre email"
                  value={form.email}
                  onChange={e => {
                    setForm({ ...form, email: e.target.value })
                    setEmailErreur('')
                  }}
                  onBlur={() => {
                    if (form.email && !isEmailValide(form.email)) {
                      setEmailErreur('Veuillez entrer un email valide')
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-stone-700 outline-none transition-colors ${
                    emailErreur ? 'border-red-300 focus:border-red-400' : 'border-stone-200 focus:border-stone-400'
                  }`}
                />
                {emailErreur && (
                  <p className="text-xs text-red-400 mt-1 ml-1">{emailErreur}</p>
                )}
              </div>
              <input
                type="tel"
                placeholder="Votre téléphone (optionnel)"
                value={form.telephone}
                onChange={e => setForm({ ...form, telephone: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400"
              />
              <button
                onClick={confirmerReservation}
                disabled={chargement || !form.nom || !form.email || !!emailErreur}
                className="w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-stone-700 transition-colors"
              >
                {chargement ? 'Envoi en cours...' : 'Confirmer la réservation'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}