'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Creneau, Coiffeur } from '@/lib/types'
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
  const [coiffeurs, setCoiffeurs] = useState<Coiffeur[]>([])
  const [coiffeurChoisi, setCoiffeurChoisi] = useState<string>('auto')
  const [form, setForm] = useState({ nom: '', email: '', telephone: '' })
  const [emailErreur, setEmailErreur] = useState('')
  const [etape, setEtape] = useState<'choix' | 'form' | 'confirme'>('choix')
  const [chargement, setChargement] = useState(false)
  const [confirmationData, setConfirmationData] = useState<{
    nom: string; email: string; service: string; heure: string; coiffeur: string; jour: Date
  } | null>(null)

  const [semaineOffset, setSemaineOffset] = useState(0)
  const jours = Array.from({ length: 7 }, (_, i) =>
    addDays(new Date(), semaineOffset * 7 + i)
  )

  useEffect(() => { chargerCoiffeurs() }, [])
  
  const chargerCreneaux = useCallback(async () => {
    const debut = startOfDay(jourSelectionne)
    const fin = addDays(debut, 1)
    const jourSemaine = (jourSelectionne.getDay() + 6) % 7

    const { data: horaireJour } = await supabase
      .from('horaires').select('*')
      .eq('salon_id', SALON_ID)
      .eq('jour_semaine', jourSemaine)
      .single()

    if (!horaireJour || horaireJour.est_ferme) { setCreneaux([]); return }

    const [hOuvre] = horaireJour.heure_ouverture.split(':').map(Number)
    const [hFerme] = horaireJour.heure_fermeture.split(':').map(Number)

    const { data: rdvExistants } = await supabase
      .from('rendez_vous').select('date_heure, duree_minutes, coiffeur_id')
      .eq('salon_id', SALON_ID)
      .gte('date_heure', debut.toISOString())
      .lt('date_heure', fin.toISOString())
      .eq('statut', 'confirme')

    const { data: coiffeursActifs } = await supabase
      .from('coiffeurs').select('id')
      .eq('salon_id', SALON_ID)
      .eq('actif', true)

    const nbCoiffeurs = coiffeursActifs?.length || 1

    const creneauxGeneres: Creneau[] = []
    for (let h = hOuvre; h < hFerme; h++) {
      for (let m = 0; m < 60; m += 30) {
        const finCreneau = h + (m + serviceChoisi.duree) / 60
        if (finCreneau > hFerme) continue

        const heure = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        const dateHeure = new Date(jourSelectionne)
        dateHeure.setHours(h, m, 0, 0)
        if (dateHeure < new Date()) continue

        // Compter combien de coiffeurs sont occupés sur ce créneau
        const rdvSurCreneau = (rdvExistants || []).filter(rdv => {
          const debutRdv = new Date(rdv.date_heure)
          const finRdv = new Date(debutRdv.getTime() + rdv.duree_minutes * 60000)
          const finNouveauRdv = new Date(dateHeure.getTime() + serviceChoisi.duree * 60000)
          return dateHeure < finRdv && finNouveauRdv > debutRdv
        })

        // Si coiffeur spécifique choisi, vérifier sa dispo
        let disponible = false
        if (coiffeurChoisi !== 'auto') {
          disponible = !rdvSurCreneau.some(r => r.coiffeur_id === coiffeurChoisi)
        } else {
          disponible = rdvSurCreneau.length < nbCoiffeurs
        }

        creneauxGeneres.push({ heure, disponible })
      }
    }
    setCreneaux(creneauxGeneres)
  }, [jourSelectionne, serviceChoisi, coiffeurChoisi])

  useEffect(() => { chargerCreneaux() }, [chargerCreneaux])

  async function chargerCoiffeurs() {
    const { data } = await supabase
      .from('coiffeurs').select('*')
      .eq('salon_id', SALON_ID)
      .eq('actif', true)
    setCoiffeurs(data || [])
  }

  async function confirmerReservation() {
    if (!creneauChoisi || !form.nom || !form.email) return
    if (!isEmailValide(form.email)) { setEmailErreur('Veuillez entrer un email valide'); return }
    setChargement(true)

    const [h, m] = creneauChoisi.split(':').map(Number)
    const dateHeure = new Date(jourSelectionne)
    dateHeure.setHours(h, m, 0, 0)

    // Choisir le coiffeur automatiquement si besoin
    let coiffeurId = coiffeurChoisi !== 'auto' ? coiffeurChoisi : null
    let coiffeurNom = coiffeurs.find(c => c.id === coiffeurId)?.nom || null

    if (coiffeurChoisi === 'auto') {
      // Trouver le coiffeur avec le moins de RDV aujourd'hui
      const debutJour = startOfDay(dateHeure)
      const finJour = addDays(debutJour, 1)
      const { data: rdvsJour } = await supabase
        .from('rendez_vous').select('coiffeur_id')
        .eq('salon_id', SALON_ID)
        .gte('date_heure', debutJour.toISOString())
        .lt('date_heure', finJour.toISOString())
        .eq('statut', 'confirme')

      const compteParCoiffeur = coiffeurs.reduce((acc, c) => {
        acc[c.id] = (rdvsJour || []).filter(r => r.coiffeur_id === c.id).length
        return acc
      }, {} as Record<string, number>)

      const coiffeurDisponible = coiffeurs
        .filter(c => {
          // Vérifier que ce coiffeur n'est pas déjà pris sur ce créneau
          return true
        })
        .sort((a, b) => (compteParCoiffeur[a.id] || 0) - (compteParCoiffeur[b.id] || 0))[0]

      if (coiffeurDisponible) {
        coiffeurId = coiffeurDisponible.id
        coiffeurNom = coiffeurDisponible.nom
      }
    }

    const { error } = await supabase.from('rendez_vous').insert({
      salon_id: SALON_ID,
      client_nom: form.nom,
      client_email: form.email,
      client_telephone: form.telephone,
      service: serviceChoisi.nom,
      duree_minutes: serviceChoisi.duree,
      date_heure: dateHeure.toISOString(),
      statut: 'confirme',
      coiffeur_id: coiffeurId,
      coiffeur_nom: coiffeurNom,
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
          coiffeur_nom: coiffeurNom,
        }),
      })
      setConfirmationData({
        nom: form.nom,
        email: form.email,
        service: serviceChoisi.nom,
        heure: creneauChoisi,
        coiffeur: coiffeurNom || 'Au choix du salon',
        jour: new Date(jourSelectionne),
      })
      setEtape('confirme')
    }
    setChargement(false)
  }

  function reset() {
    setEtape('choix')
    setCreneauChoisi(null)
    setForm({ nom: '', email: '', telephone: '' })
    setEmailErreur('')
    chargerCreneaux() // ← recharge les créneaux après réservation
  }

  if (etape === 'confirme' && confirmationData) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-stone-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-medium text-stone-800 mb-2">Réservation confirmée !</h1>
          <p className="text-stone-500 text-sm mb-1">Un email a été envoyé à</p>
          <p className="font-medium text-stone-700 mb-6">{confirmationData.email}</p>
          <div className="bg-stone-50 rounded-xl p-4 text-left text-sm text-stone-600 space-y-2">
            <p><span className="font-medium">Service :</span> {confirmationData.service}</p>
            <p><span className="font-medium">Date :</span> {format(confirmationData.jour, 'EEEE d MMMM', { locale: fr })}</p>
            <p><span className="font-medium">Heure :</span> {confirmationData.heure}</p>
            <p><span className="font-medium">Coiffeur :</span> {confirmationData.coiffeur}</p>
          </div>
          <button onClick={reset} className="mt-6 text-sm text-stone-400 underline">
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
              <button key={s.nom} onClick={() => { setServiceChoisi(s); setCreneauChoisi(null); setEtape('choix') }}
                className={`p-3 rounded-xl text-left text-sm border transition-all ${
                  serviceChoisi.nom === s.nom
                    ? 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-200 text-stone-600 hover:border-stone-400'
                }`}>
                <div className="font-medium">{s.nom}</div>
                <div className="text-xs opacity-60 mt-0.5">{s.duree} min</div>
              </button>
            ))}
          </div>
        </section>

        {/* Coiffeur */}
        {coiffeurs.length > 0 && (
          <section className="bg-white rounded-2xl p-5 mb-4 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Coiffeur</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setCoiffeurChoisi('auto'); setCreneauChoisi(null) }}
                className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                  coiffeurChoisi === 'auto'
                    ? 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-200 text-stone-600 hover:border-stone-400'
                }`}>
                Sans préférence
              </button>
              {coiffeurs.map(c => (
                <button key={c.id}
                  onClick={() => { setCoiffeurChoisi(c.id); setCreneauChoisi(null) }}
                  className={`px-4 py-2 rounded-xl text-sm border transition-all flex items-center gap-2 ${
                    coiffeurChoisi === c.id
                      ? 'border-stone-800 bg-stone-800 text-white'
                      : 'border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.couleur }} />
                  {c.nom}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Jour */}
             <section className="bg-white rounded-2xl p-5 mb-4 border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-stone-500">Jour</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSemaineOffset(o => Math.max(0, o - 1))}
              disabled={semaineOffset === 0}
              className="text-xs px-2 py-1 rounded-lg border border-stone-200 text-stone-500 disabled:opacity-30 hover:border-stone-400"
            >
              ← Sem. préc.
            </button>
            <button
              onClick={() => setSemaineOffset(o => o + 1)}
              className="text-xs px-2 py-1 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400"
            >
              Sem. suiv. →
            </button>
          </div>
        </div>
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
          {creneaux.filter(c => c.disponible).length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">Aucun créneau disponible ce jour</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {creneaux.filter(c => c.disponible).map(c => (
                <button key={c.heure}
                  onClick={() => { setCreneauChoisi(c.heure); setEtape('form') }}
                  className={`p-2 rounded-xl text-sm border transition-all ${
                    creneauChoisi === c.heure
                      ? 'border-stone-800 bg-stone-800 text-white'
                      : 'border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}>
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
              <input type="text" placeholder="Votre prénom et nom" value={form.nom}
                onChange={e => setForm({ ...form, nom: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
              <div>
                <input type="email" placeholder="Votre email" value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setEmailErreur('') }}
                  onBlur={() => { if (form.email && !isEmailValide(form.email)) setEmailErreur('Email invalide') }}
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-stone-700 outline-none transition-colors ${
                    emailErreur ? 'border-red-300' : 'border-stone-200 focus:border-stone-400'
                  }`} />
                {emailErreur && <p className="text-xs text-red-400 mt-1 ml-1">{emailErreur}</p>}
              </div>
              <input type="tel" placeholder="Téléphone (optionnel)" value={form.telephone}
                onChange={e => setForm({ ...form, telephone: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
              <button onClick={confirmerReservation}
                disabled={chargement || !form.nom || !form.email || !!emailErreur}
                className="w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-stone-700 transition-colors">
                {chargement ? 'Envoi en cours...' : 'Confirmer la réservation'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}