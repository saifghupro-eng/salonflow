'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RendezVous } from '@/lib/types'
import { format, startOfDay, addDays, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'

const SALON_ID = '6143f4a8-f4ab-485f-81b8-9bface600335'
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const SERVICES = ['Coupe femme', 'Coupe homme', 'Couleur', 'Balayage', 'Autre']

export default function TableauBordSalon() {
  const [rdvs, setRdvs] = useState<RendezVous[]>([])
  const [jourSelectionne, setJourSelectionne] = useState<Date>(new Date())
  const [onglet, setOnglet] = useState<'agenda' | 'horaires' | 'nouveau'>('agenda')
  const [chargement, setChargement] = useState(true)
  const [horaires, setHoraires] = useState(
    JOURS.map((_, i) => ({
      jour_semaine: i,
      heure_ouverture: '09:00',
      heure_fermeture: '18:00',
      est_ferme: i >= 5,
    }))
  )

  // Annulation
  const [annulationId, setAnnulationId] = useState<string | null>(null)
  const [annulationRdv, setAnnulationRdv] = useState<RendezVous | null>(null)
  const [messageAnnulation, setMessageAnnulation] = useState('')
  const [annulationChargement, setAnnulationChargement] = useState(false)

  // Nouveau RDV manuel
  const [nouveauRdv, setNouveauRdv] = useState({
    client_nom: '',
    client_email: '',
    client_telephone: '',
    service: SERVICES[0],
    duree_minutes: 30,
    date: format(new Date(), 'yyyy-MM-dd'),
    heure: '09:00',
  })
  const [rdvEnvoi, setRdvEnvoi] = useState<'idle' | 'chargement' | 'ok' | 'erreur'>('idle')

  const jours = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i))

  useEffect(() => { chargerRdvs() }, [jourSelectionne])
  useEffect(() => { chargerHoraires() }, [])

  async function chargerRdvs() {
    setChargement(true)
    const debut = startOfDay(jourSelectionne)
    const fin = addDays(debut, 1)
    const { data } = await supabase
      .from('rendez_vous').select('*')
      .eq('salon_id', SALON_ID)
      .gte('date_heure', debut.toISOString())
      .lt('date_heure', fin.toISOString())
      .eq('statut', 'confirme')
      .order('date_heure')
    setRdvs(data || [])
    setChargement(false)
  }

  async function chargerHoraires() {
    const { data } = await supabase.from('horaires').select('*').eq('salon_id', SALON_ID)
    if (data && data.length > 0) setHoraires(data)
  }

  async function sauvegarderHoraires() {
    for (const h of horaires) {
      await supabase.from('horaires').upsert({ salon_id: SALON_ID, ...h })
    }
    alert('Horaires sauvegardés !')
  }

  function ouvrirAnnulation(rdv: RendezVous) {
    setAnnulationId(rdv.id)
    setAnnulationRdv(rdv)
    setMessageAnnulation('')
  }

  async function confirmerAnnulation() {
    if (!annulationId || !annulationRdv) return
    setAnnulationChargement(true)
    await supabase.from('rendez_vous').update({ statut: 'annule' }).eq('id', annulationId)
    await fetch('/api/email-annulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_nom: annulationRdv.client_nom,
        client_email: annulationRdv.client_email,
        service: annulationRdv.service,
        date_heure: annulationRdv.date_heure,
        message: messageAnnulation,
      }),
    })
    setAnnulationId(null)
    setAnnulationRdv(null)
    setAnnulationChargement(false)
    chargerRdvs()
  }

  async function ajouterRdvManuel() {
    setRdvEnvoi('chargement')
    const dateHeure = new Date(`${nouveauRdv.date}T${nouveauRdv.heure}:00`)
    const { error } = await supabase.from('rendez_vous').insert({
      salon_id: SALON_ID,
      client_nom: nouveauRdv.client_nom,
      client_email: nouveauRdv.client_email,
      client_telephone: nouveauRdv.client_telephone,
      service: nouveauRdv.service,
      duree_minutes: nouveauRdv.duree_minutes,
      date_heure: dateHeure.toISOString(),
      statut: 'confirme',
    })
    if (!error) {
      if (nouveauRdv.client_email) {
        await fetch('/api/email-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_nom: nouveauRdv.client_nom,
            client_email: nouveauRdv.client_email,
            service: nouveauRdv.service,
            date_heure: dateHeure.toISOString(),
          }),
        })
      }
      setRdvEnvoi('ok')
      setNouveauRdv({ client_nom: '', client_email: '', client_telephone: '', service: SERVICES[0], duree_minutes: 30, date: format(new Date(), 'yyyy-MM-dd'), heure: '09:00' })
      setTimeout(() => setRdvEnvoi('idle'), 3000)
    } else {
      setRdvEnvoi('erreur')
    }
  }

  function labelJour(date: Date) {
    if (isToday(date)) return "Aujourd'hui"
    if (isTomorrow(date)) return 'Demain'
    return format(date, 'EEE d MMM', { locale: fr })
  }

  return (
    <main className="min-h-screen bg-stone-50 p-4">
      <div className="max-w-lg mx-auto">

        <div className="pt-6 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-stone-800">Tableau de bord</h1>
            <p className="text-stone-500 text-sm mt-1">Gérez vos rendez-vous</p>
          </div>
          <a href="/" className="text-sm text-stone-500 border border-stone-200 rounded-xl px-4 py-2 hover:bg-stone-100 transition-colors">
            Page client
          </a>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 mb-4 bg-stone-100 p-1 rounded-xl">
          {(['agenda', 'nouveau', 'horaires'] as const).map(o => (
            <button key={o} onClick={() => setOnglet(o)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                onglet === o ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}>
              {o === 'agenda' ? 'Agenda' : o === 'nouveau' ? '+ Nouveau RDV' : 'Horaires'}
            </button>
          ))}
        </div>

        {/* AGENDA */}
        {onglet === 'agenda' && (
          <>
            <section className="bg-white rounded-2xl p-5 mb-4 border border-stone-200">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {jours.map(jour => (
                  <button key={jour.toISOString()} onClick={() => setJourSelectionne(jour)}
                    className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl text-sm border transition-all w-14 ${
                      format(jour, 'yyyy-MM-dd') === format(jourSelectionne, 'yyyy-MM-dd')
                        ? 'border-stone-800 bg-stone-800 text-white'
                        : 'border-stone-200 text-stone-600 hover:border-stone-400'
                    }`}>
                    <span className="text-xs opacity-60">{format(jour, 'EEE', { locale: fr })}</span>
                    <span className="font-medium mt-0.5">{format(jour, 'd')}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl p-5 border border-stone-200">
              <h2 className="text-sm font-medium text-stone-500 mb-4">
                {labelJour(jourSelectionne)} — {rdvs.length} rendez-vous
              </h2>
              {chargement ? (
                <p className="text-sm text-stone-400 text-center py-6">Chargement...</p>
              ) : rdvs.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">Aucun rendez-vous ce jour</p>
              ) : (
                <div className="space-y-3">
                  {rdvs.map(rdv => (
                    <div key={rdv.id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
                      <div className="text-sm font-medium text-stone-800 w-12 flex-shrink-0 pt-0.5">
                        {format(new Date(rdv.date_heure), 'HH:mm')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800">{rdv.client_nom}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{rdv.service} · {rdv.duree_minutes} min</p>
                        <p className="text-xs text-stone-400 mt-0.5">{rdv.client_email}</p>
                      </div>
                      <button onClick={() => ouvrirAnnulation(rdv)}
                        className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">
                        Annuler
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* NOUVEAU RDV MANUEL */}
        {onglet === 'nouveau' && (
          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-4">Ajouter un rendez-vous</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Nom du client" value={nouveauRdv.client_nom}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_nom: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
              <input type="email" placeholder="Email (optionnel)" value={nouveauRdv.client_email}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_email: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
              <input type="tel" placeholder="Téléphone (optionnel)" value={nouveauRdv.client_telephone}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_telephone: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
              <select value={nouveauRdv.service}
                onChange={e => setNouveauRdv({ ...nouveauRdv, service: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400">
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-stone-400 mb-1 block">Date</label>
                  <input type="date" value={nouveauRdv.date}
                    onChange={e => setNouveauRdv({ ...nouveauRdv, date: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-stone-400 mb-1 block">Heure</label>
                  <input type="time" value={nouveauRdv.heure}
                    onChange={e => setNouveauRdv({ ...nouveauRdv, heure: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Durée (minutes)</label>
                <input type="number" min={15} step={15} value={nouveauRdv.duree_minutes}
                  onChange={e => setNouveauRdv({ ...nouveauRdv, duree_minutes: Number(e.target.value) })}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400" />
              </div>
              <button onClick={ajouterRdvManuel}
                disabled={!nouveauRdv.client_nom || rdvEnvoi === 'chargement'}
                className="w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-stone-700 transition-colors">
                {rdvEnvoi === 'chargement' ? 'Ajout en cours...' : rdvEnvoi === 'ok' ? '✓ RDV ajouté !' : 'Ajouter le rendez-vous'}
              </button>
              {nouveauRdv.client_email && (
                <p className="text-xs text-stone-400 text-center">Un email de confirmation sera envoyé au client</p>
              )}
            </div>
          </section>
        )}

        {/* HORAIRES */}
        {onglet === 'horaires' && (
          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-4">Horaires d'ouverture</h2>
            <div className="space-y-3">
              {horaires.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-stone-600 w-16 flex-shrink-0">{JOURS[i]}</span>
                  <input type="time" value={h.heure_ouverture} disabled={h.est_ferme}
                    onChange={e => { const u = [...horaires]; u[i] = { ...u[i], heure_ouverture: e.target.value }; setHoraires(u) }}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-stone-700 disabled:opacity-30 w-24" />
                  <span className="text-stone-300 text-sm">→</span>
                  <input type="time" value={h.heure_fermeture} disabled={h.est_ferme}
                    onChange={e => { const u = [...horaires]; u[i] = { ...u[i], heure_fermeture: e.target.value }; setHoraires(u) }}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-stone-700 disabled:opacity-30 w-24" />
                  <button
                    onClick={() => { const u = [...horaires]; u[i] = { ...u[i], est_ferme: !u[i].est_ferme }; setHoraires(u) }}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-all ${
                      h.est_ferme ? 'border-red-200 bg-red-50 text-red-500' : 'border-stone-200 text-stone-500'
                    }`}>
                    {h.est_ferme ? 'Fermé' : 'Ouvert'}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={sauvegarderHoraires}
              className="mt-6 w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 transition-colors">
              Sauvegarder les horaires
            </button>
          </section>
        )}
      </div>

      {/* MODAL ANNULATION */}
      {annulationId && annulationRdv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-stone-200">
            <h3 className="font-medium text-stone-800 mb-1">Annuler ce rendez-vous ?</h3>
            <p className="text-sm text-stone-500 mb-4">
              {annulationRdv.client_nom} — {annulationRdv.service}<br />
              {format(new Date(annulationRdv.date_heure), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
            </p>
            <label className="text-xs text-stone-400 mb-1 block">Message pour le client (optionnel)</label>
            <textarea
              value={messageAnnulation}
              onChange={e => setMessageAnnulation(e.target.value)}
              placeholder="Ex : Nous sommes désolés, le salon sera fermé ce jour-là..."
              rows={3}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setAnnulationId(null); setAnnulationRdv(null) }}
                className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2.5 text-sm hover:bg-stone-50">
                Retour
              </button>
              <button onClick={confirmerAnnulation} disabled={annulationChargement}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600 disabled:opacity-40">
                {annulationChargement ? 'Envoi...' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}