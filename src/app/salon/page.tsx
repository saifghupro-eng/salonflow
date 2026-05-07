'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RendezVous } from '@/lib/types'
import { format, startOfDay, addDays, isToday, isTomorrow, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

const SALON_ID = '6143f4a8-f4ab-485f-81b8-9bface600335'
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const SERVICES = ['Coupe femme', 'Coupe homme', 'Couleur', 'Balayage', 'Autre']
const HEURES = Array.from({ length: 19 }, (_, i) => {
  const h = Math.floor(i / 2) + 9
  const m = i % 2 === 0 ? '00' : '30'
  return `${h.toString().padStart(2, '0')}:${m}`
})

export default function TableauBordSalon() {
  const [rdvs, setRdvs] = useState<RendezVous[]>([])
  const [semaine, setSemaine] = useState<Date>(new Date())
  const [onglet, setOnglet] = useState<'agenda' | 'nouveau' | 'horaires'>('agenda')
  const [chargement, setChargement] = useState(true)
  const [horaires, setHoraires] = useState(
    JOURS.map((_, i) => ({
      jour_semaine: i,
      heure_ouverture: '09:00',
      heure_fermeture: '18:00',
      est_ferme: i >= 5,
    }))
  )

  const [annulationRdv, setAnnulationRdv] = useState<RendezVous | null>(null)
  const [messageAnnulation, setMessageAnnulation] = useState('')
  const [annulationChargement, setAnnulationChargement] = useState(false)

  const aujourdhui = new Date()
  const [nouveauRdv, setNouveauRdv] = useState({
    client_nom: '',
    client_email: '',
    client_telephone: '',
    service: SERVICES[0],
    duree_minutes: 30,
    date: format(aujourdhui, 'yyyy-MM-dd'),
    heure: '09:00',
  })
  const [rdvEnvoi, setRdvEnvoi] = useState<'idle' | 'chargement' | 'ok' | 'erreur'>('idle')

  // Jours de la semaine affichée
  const debutSemaine = startOfWeek(semaine, { weekStartsOn: 1 })
  const finSemaine = endOfWeek(semaine, { weekStartsOn: 1 })
  const joursSemaine = eachDayOfInterval({ start: debutSemaine, end: finSemaine })

  useEffect(() => { chargerRdvsSemaine() }, [semaine])
  useEffect(() => { chargerHoraires() }, [])

  async function chargerRdvsSemaine() {
    setChargement(true)
    const { data } = await supabase
      .from('rendez_vous').select('*')
      .eq('salon_id', SALON_ID)
      .gte('date_heure', debutSemaine.toISOString())
      .lt('date_heure', addDays(finSemaine, 1).toISOString())
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

  async function confirmerAnnulation() {
    if (!annulationRdv) return
    setAnnulationChargement(true)
    await supabase.from('rendez_vous').update({ statut: 'annule' }).eq('id', annulationRdv.id)
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
    setAnnulationRdv(null)
    setAnnulationChargement(false)
    chargerRdvsSemaine()
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
            date_heure: new Date(`${nouveauRdv.date}T${nouveauRdv.heure}:00`).toISOString(),
          }),
        })
      }
      setRdvEnvoi('ok')
      setNouveauRdv({ client_nom: '', client_email: '', client_telephone: '', service: SERVICES[0], duree_minutes: 30, date: format(aujourdhui, 'yyyy-MM-dd'), heure: '09:00' })
      setTimeout(() => { setRdvEnvoi('idle'); setOnglet('agenda') }, 1500)
    } else {
      setRdvEnvoi('erreur')
    }
  }

  // RDV pour un jour + heure donnés
  function rdvPourCreneau(jour: Date, heure: string) {
    return rdvs.filter(rdv => {
      const d = new Date(rdv.date_heure)
      return format(d, 'yyyy-MM-dd') === format(jour, 'yyyy-MM-dd') &&
        format(d, 'HH:mm') === heure
    })
  }

  function couleurService(service: string) {
    const map: Record<string, string> = {
      'Coupe femme': 'bg-violet-100 text-violet-800 border-violet-200',
      'Coupe homme': 'bg-blue-100 text-blue-800 border-blue-200',
      'Couleur': 'bg-amber-100 text-amber-800 border-amber-200',
      'Balayage': 'bg-rose-100 text-rose-800 border-rose-200',
      'Autre': 'bg-stone-100 text-stone-700 border-stone-200',
    }
    return map[service] || 'bg-stone-100 text-stone-700 border-stone-200'
  }

  function estJourFerme(jour: Date) {
    const jourSemaine = (jour.getDay() + 6) % 7
    const h = horaires.find(h => h.jour_semaine === jourSemaine)
    return h?.est_ferme ?? false
  }

  return (
    <main className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-stone-800">Tableau de bord</h1>
            <p className="text-stone-400 text-xs mt-0.5">Salon Éclat</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
              {(['agenda', 'nouveau', 'horaires'] as const).map(o => (
                <button key={o} onClick={() => setOnglet(o)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    onglet === o ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}>
                  {o === 'agenda' ? 'Agenda' : o === 'nouveau' ? '+ RDV' : 'Horaires'}
                </button>
              ))}
            </div>
            <a href="/" className="text-xs text-stone-400 border border-stone-200 rounded-xl px-3 py-1.5 hover:bg-stone-50">
              Page client
            </a>
          </div>
        </div>
      </div>

      {/* AGENDA SEMAINE */}
      {onglet === 'agenda' && (
        <div className="max-w-6xl mx-auto p-4">

          {/* Navigation semaine */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSemaine(s => addDays(s, -7))}
              className="flex items-center gap-1 text-sm text-stone-500 border border-stone-200 rounded-xl px-3 py-2 hover:bg-white transition-colors">
              ← Semaine préc.
            </button>
            <div className="text-sm font-medium text-stone-700">
              {format(debutSemaine, 'd MMM', { locale: fr })} – {format(finSemaine, 'd MMM yyyy', { locale: fr })}
              {joursSemaine.some(j => isToday(j)) && (
                <span className="ml-2 text-xs bg-stone-800 text-white px-2 py-0.5 rounded-full">Cette semaine</span>
              )}
            </div>
            <button onClick={() => setSemaine(s => addDays(s, 7))}
              className="flex items-center gap-1 text-sm text-stone-500 border border-stone-200 rounded-xl px-3 py-2 hover:bg-white transition-colors">
              Semaine suiv. →
            </button>
          </div>

          {/* Grille agenda */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">

            {/* En-têtes jours */}
            <div className="grid border-b border-stone-100" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
              <div className="p-2 border-r border-stone-100" />
              {joursSemaine.map(jour => (
                <div key={jour.toISOString()}
                  className={`p-2 text-center border-r border-stone-100 last:border-r-0 ${
                    isToday(jour) ? 'bg-stone-800' : estJourFerme(jour) ? 'bg-stone-50' : ''
                  }`}>
                  <p className={`text-xs font-medium ${isToday(jour) ? 'text-white' : 'text-stone-500'}`}>
                    {format(jour, 'EEE', { locale: fr })}
                  </p>
                  <p className={`text-sm font-semibold ${isToday(jour) ? 'text-white' : 'text-stone-800'}`}>
                    {format(jour, 'd')}
                  </p>
                  {estJourFerme(jour) && (
                    <p className="text-xs text-stone-300 mt-0.5">Fermé</p>
                  )}
                </div>
              ))}
            </div>

            {/* Lignes horaires */}
            <div className="overflow-y-auto max-h-[600px]">
              {HEURES.map((heure, hi) => (
                <div key={heure}
                  className="grid border-b border-stone-50 last:border-b-0 hover:bg-stone-50/50 transition-colors"
                  style={{ gridTemplateColumns: '64px repeat(7, 1fr)', minHeight: '52px' }}>

                  {/* Label heure */}
                  <div className={`px-2 py-1 border-r border-stone-100 flex items-start justify-end ${hi % 2 === 0 ? '' : 'opacity-0'}`}>
                    <span className="text-xs text-stone-300 mt-1">{heure}</span>
                  </div>

                  {/* Cellules par jour */}
                  {joursSemaine.map(jour => {
                    const ferme = estJourFerme(jour)
                    const rdvsCreneau = rdvPourCreneau(jour, heure)
                    return (
                      <div key={jour.toISOString()}
                        className={`border-r border-stone-50 last:border-r-0 p-1 ${ferme ? 'bg-stone-50' : ''}`}>
                        {rdvsCreneau.map(rdv => (
                          <button key={rdv.id}
                            onClick={() => { setAnnulationRdv(rdv); setMessageAnnulation('') }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs border transition-all hover:opacity-80 ${couleurService(rdv.service)}`}>
                            <p className="font-medium truncate">{rdv.client_nom}</p>
                            <p className="opacity-70 truncate">{rdv.service}</p>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Légende */}
          <div className="flex flex-wrap gap-2 mt-3">
            {SERVICES.slice(0, 4).map(s => (
              <span key={s} className={`text-xs px-2 py-1 rounded-lg border ${couleurService(s)}`}>{s}</span>
            ))}
            <span className="text-xs text-stone-400 self-center ml-1">· Cliquez sur un RDV pour l'annuler</span>
          </div>

          {/* Résumé semaine */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <p className="text-2xl font-semibold text-stone-800">{rdvs.length}</p>
              <p className="text-xs text-stone-400 mt-1">RDV cette semaine</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <p className="text-2xl font-semibold text-stone-800">
                {rdvs.filter(r => format(new Date(r.date_heure), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
              </p>
              <p className="text-xs text-stone-400 mt-1">RDV aujourd'hui</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <p className="text-2xl font-semibold text-stone-800">
                {rdvs.reduce((acc, r) => acc + r.duree_minutes, 0)} min
              </p>
              <p className="text-xs text-stone-400 mt-1">Temps total</p>
            </div>
          </div>
        </div>
      )}

      {/* NOUVEAU RDV */}
      {onglet === 'nouveau' && (
        <div className="max-w-md mx-auto p-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-700 mb-4">Nouveau rendez-vous</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Nom du client *" value={nouveauRdv.client_nom}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_nom: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400" />
              <input type="email" placeholder="Email (optionnel)" value={nouveauRdv.client_email}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_email: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400" />
              <input type="tel" placeholder="Téléphone (optionnel)" value={nouveauRdv.client_telephone}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_telephone: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400" />
              <select value={nouveauRdv.service}
                onChange={e => setNouveauRdv({ ...nouveauRdv, service: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400">
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-stone-400 mb-1 block">Date (aujourd'hui ou plus tard)</label>
                  <input type="date"
                    value={nouveauRdv.date}
                    min={format(aujourdhui, 'yyyy-MM-dd')}
                    onChange={e => setNouveauRdv({ ...nouveauRdv, date: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-stone-400 mb-1 block">Heure</label>
                  <select value={nouveauRdv.heure}
                    onChange={e => setNouveauRdv({ ...nouveauRdv, heure: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400">
                    {HEURES.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Durée (minutes)</label>
                <input type="number" min={15} step={15} value={nouveauRdv.duree_minutes}
                  onChange={e => setNouveauRdv({ ...nouveauRdv, duree_minutes: Number(e.target.value) })}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400" />
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
          </div>
        </div>
      )}

      {/* HORAIRES */}
      {onglet === 'horaires' && (
        <div className="max-w-md mx-auto p-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-4">Horaires d'ouverture</h2>
            <div className="space-y-3">
              {horaires.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-stone-600 w-16 flex-shrink-0">{JOURS[i]}</span>
                  <input type="time" value={h.heure_ouverture} disabled={h.est_ferme}
                    onChange={e => { const u = [...horaires]; u[i] = { ...u[i], heure_ouverture: e.target.value }; setHoraires(u) }}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm disabled:opacity-30 w-24" />
                  <span className="text-stone-300 text-sm">→</span>
                  <input type="time" value={h.heure_fermeture} disabled={h.est_ferme}
                    onChange={e => { const u = [...horaires]; u[i] = { ...u[i], heure_fermeture: e.target.value }; setHoraires(u) }}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm disabled:opacity-30 w-24" />
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
          </div>
        </div>
      )}

      {/* MODAL ANNULATION */}
      {annulationRdv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-stone-200">
            <h3 className="font-medium text-stone-800 mb-1">Annuler ce rendez-vous ?</h3>
            <p className="text-sm text-stone-500 mb-4">
              {annulationRdv.client_nom} — {annulationRdv.service}<br />
              {format(new Date(annulationRdv.date_heure), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
            </p>
            <label className="text-xs text-stone-400 mb-1 block">Message pour le client (optionnel)</label>
            <textarea value={messageAnnulation} onChange={e => setMessageAnnulation(e.target.value)}
              placeholder="Ex : Nous sommes désolés, le salon sera fermé ce jour-là..."
              rows={3}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400 resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setAnnulationRdv(null)}
                className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2.5 text-sm hover:bg-stone-50">
                Retour
              </button>
              <button onClick={confirmerAnnulation} disabled={annulationChargement}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600 disabled:opacity-40">
                {annulationChargement ? 'Envoi...' : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}