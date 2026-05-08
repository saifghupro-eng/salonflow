'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RendezVous, Coiffeur } from '@/lib/types'
import {
  format, startOfDay, addDays, isToday, isTomorrow,
  startOfWeek, endOfWeek, eachDayOfInterval
} from 'date-fns'
import { fr } from 'date-fns/locale'

const SALON_ID = '6143f4a8-f4ab-485f-81b8-9bface600335'
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const SERVICES = ['Coupe femme', 'Coupe homme', 'Couleur', 'Balayage', 'Autre']
const HEURES = Array.from({ length: 19 }, (_, i) => {
  const h = Math.floor(i / 2) + 9
  const m = i % 2 === 0 ? '00' : '30'
  return `${h.toString().padStart(2, '0')}:${m}`
})
const MESSAGES_AUTO = [
  'Le salon sera fermé exceptionnellement ce jour-là.',
  'Le coiffeur est absent, nous sommes désolés.',
  'Suite à un imprévu, nous devons annuler votre rendez-vous.',
  'Nous avons un problème technique ce jour-là.',
  'Autre (message personnalisé)',
]

type VueType = 'semaine' | 'jour'
type OngletType = 'agenda' | 'horaires' | 'coiffeurs'

type CreneauCoiffeur = {
  id: string
  coiffeur_id: string
  jour_semaine: number
  heure_debut: string
  heure_fin: string
}

export default function TableauBordSalon() {
  const [rdvs, setRdvs] = useState<RendezVous[]>([])
  const [coiffeurs, setCoiffeurs] = useState<Coiffeur[]>([])
  const [creneauxCoiffeurs, setCreneauxCoiffeurs] = useState<CreneauCoiffeur[]>([])
  const [semaine, setSemaine] = useState<Date>(new Date())
  const [jourSelectionne, setJourSelectionne] = useState<Date>(new Date())
  const [vue, setVue] = useState<VueType>('semaine')
  const [filtreCoiffeur, setFiltreCoiffeur] = useState<string>('tous')
  const [onglet, setOnglet] = useState<OngletType>('agenda')
  const [chargement, setChargement] = useState(true)
  const [horaires, setHoraires] = useState(
    JOURS.map((_, i) => ({
      jour_semaine: i, heure_ouverture: '09:00', heure_fermeture: '18:00', est_ferme: i >= 5,
    }))
  )

  // Modal RDV info / annulation / transfert
  const [rdvSelectionne, setRdvSelectionne] = useState<RendezVous | null>(null)
  const [modeModal, setModeModal] = useState<'info' | 'annulation' | 'transfert'>('info')
  const [messagePreset, setMessagePreset] = useState(MESSAGES_AUTO[0])
  const [messagePersonnalise, setMessagePersonnalise] = useState('')
  const [annulationChargement, setAnnulationChargement] = useState(false)
  const [transfertCoiffeurId, setTransfertCoiffeurId] = useState('')
  const [transfertDate, setTransfertDate] = useState('')
  const [transfertHeure, setTransfertHeure] = useState('')
  const [transfertChargement, setTransfertChargement] = useState(false)

  // Modal nouveau RDV depuis calendrier
  const [nouveauRdvModal, setNouveauRdvModal] = useState<{ jour: Date; heure: string } | null>(null)
  const [nouveauRdv, setNouveauRdv] = useState({
    client_nom: '', client_email: '', client_telephone: '',
    service: SERVICES[0], duree_minutes: 30, coiffeur_id: '',
  })
  const [rdvEnvoi, setRdvEnvoi] = useState<'idle' | 'chargement' | 'ok'>('idle')

  // Coiffeur form
  const [nouveauCoiffeur, setNouveauCoiffeur] = useState({ nom: '', couleur: '#6366f1' })
  const [coiffeurEnvoi, setCoiffeurEnvoi] = useState<'idle' | 'chargement' | 'ok'>('idle')

  // Créneaux spécifiques coiffeur
  const [coiffeurEdite, setCoiffeurEdite] = useState<string>('')
  const [nouveauCreneau, setNouveauCreneau] = useState({ jour_semaine: 0, heure_debut: '09:00', heure_fin: '18:00' })
  const [creneauEnvoi, setCreneauEnvoi] = useState<'idle' | 'chargement' | 'ok'>('idle')

  const aujourdhui = new Date()
  const debutSemaine = startOfWeek(semaine, { weekStartsOn: 1 })
  const finSemaine = endOfWeek(semaine, { weekStartsOn: 1 })
  const joursSemaine = eachDayOfInterval({ start: debutSemaine, end: finSemaine })

  const rdvsFiltres = filtreCoiffeur === 'tous'
    ? rdvs
    : rdvs.filter(r => r.coiffeur_id === filtreCoiffeur)

  const chargerRdvs = useCallback(async () => {
    setChargement(true)
    const debut = vue === 'semaine' ? debutSemaine : startOfDay(jourSelectionne)
    const fin = vue === 'semaine' ? addDays(finSemaine, 1) : addDays(startOfDay(jourSelectionne), 1)
    const { data } = await supabase
      .from('rendez_vous').select('*')
      .eq('salon_id', SALON_ID)
      .gte('date_heure', debut.toISOString())
      .lt('date_heure', fin.toISOString())
      .eq('statut', 'confirme')
      .order('date_heure')
    setRdvs(data || [])
    setChargement(false)
  }, [vue, semaine, jourSelectionne])

  useEffect(() => { chargerRdvs() }, [chargerRdvs])
  useEffect(() => { chargerCoiffeurs(); chargerHoraires(); chargerCreneauxCoiffeurs() }, [])

  async function chargerCoiffeurs() {
    const { data } = await supabase.from('coiffeurs').select('*').eq('salon_id', SALON_ID).eq('actif', true)
    setCoiffeurs(data || [])
  }

  async function chargerHoraires() {
    const { data } = await supabase.from('horaires').select('*').eq('salon_id', SALON_ID)
    if (data && data.length > 0) setHoraires(data)
  }

  async function chargerCreneauxCoiffeurs() {
    const { data } = await supabase.from('creneaux_coiffeur').select('*').eq('salon_id', SALON_ID)
    setCreneauxCoiffeurs(data || [])
  }

  async function sauvegarderHoraires() {
    for (const h of horaires) {
      await supabase.from('horaires').upsert({ salon_id: SALON_ID, ...h })
    }
    alert('Horaires sauvegardés !')
  }

  async function ajouterCoiffeur() {
    if (!nouveauCoiffeur.nom) return
    setCoiffeurEnvoi('chargement')
    await supabase.from('coiffeurs').insert({ salon_id: SALON_ID, ...nouveauCoiffeur })
    setCoiffeurEnvoi('ok')
    setNouveauCoiffeur({ nom: '', couleur: '#6366f1' })
    chargerCoiffeurs()
    setTimeout(() => setCoiffeurEnvoi('idle'), 2000)
  }

  async function supprimerCoiffeur(id: string) {
    if (!confirm('Supprimer ce coiffeur ?')) return
    await supabase.from('coiffeurs').update({ actif: false }).eq('id', id)
    chargerCoiffeurs()
  }

  async function ajouterCreneauCoiffeur() {
    if (!coiffeurEdite) return
    setCreneauEnvoi('chargement')
    await supabase.from('creneaux_coiffeur').upsert({
      coiffeur_id: coiffeurEdite,
      salon_id: SALON_ID,
      ...nouveauCreneau,
    })
    setCreneauEnvoi('ok')
    chargerCreneauxCoiffeurs()
    setTimeout(() => setCreneauEnvoi('idle'), 2000)
  }

  async function supprimerCreneauCoiffeur(id: string) {
    await supabase.from('creneaux_coiffeur').delete().eq('id', id)
    chargerCreneauxCoiffeurs()
  }

  async function confirmerAnnulation() {
    if (!rdvSelectionne) return
    setAnnulationChargement(true)
    const message = messagePreset === MESSAGES_AUTO[4] ? messagePersonnalise : messagePreset
    await supabase.from('rendez_vous').update({ statut: 'annule' }).eq('id', rdvSelectionne.id)
    await fetch('/api/email-annulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_nom: rdvSelectionne.client_nom,
        client_email: rdvSelectionne.client_email,
        service: rdvSelectionne.service,
        date_heure: rdvSelectionne.date_heure,
        message,
      }),
    })
    setRdvSelectionne(null)
    setModeModal('info')
    setAnnulationChargement(false)
    chargerRdvs()
  }

async function confirmerTransfert() {
  if (!rdvSelectionne || !transfertDate || !transfertHeure) return
  setTransfertChargement(true)
  const [h, m] = transfertHeure.split(':').map(Number)
  const nouvelleDateHeure = new Date(transfertDate)
  nouvelleDateHeure.setHours(h, m, 0, 0)
  const coiffeur = coiffeurs.find(c => c.id === transfertCoiffeurId)

  await supabase.from('rendez_vous').update({
    date_heure: nouvelleDateHeure.toISOString(),
    coiffeur_id: transfertCoiffeurId || null,
    coiffeur_nom: coiffeur?.nom || null,
  }).eq('id', rdvSelectionne.id)

  // Notifier le client par email
  await fetch('/api/email-transfert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_nom: rdvSelectionne.client_nom,
      client_email: rdvSelectionne.client_email,
      service: rdvSelectionne.service,
      ancienne_date_heure: rdvSelectionne.date_heure,
      nouvelle_date_heure: nouvelleDateHeure.toISOString(),
      coiffeur_nom: coiffeur?.nom || null,
    }),
  })

  setRdvSelectionne(null)
  setModeModal('info')
  setTransfertChargement(false)
  chargerRdvs()
}

  async function ajouterRdvDepuisCalendrier() {
    if (!nouveauRdvModal || !nouveauRdv.client_nom) return
    setRdvEnvoi('chargement')
    const [h, m] = nouveauRdvModal.heure.split(':').map(Number)
    const dateHeure = new Date(nouveauRdvModal.jour)
    dateHeure.setHours(h, m, 0, 0)
    const coiffeur = coiffeurs.find(c => c.id === nouveauRdv.coiffeur_id)
    await supabase.from('rendez_vous').insert({
      salon_id: SALON_ID,
      ...nouveauRdv,
      coiffeur_nom: coiffeur?.nom || null,
      date_heure: dateHeure.toISOString(),
      statut: 'confirme',
    })
    if (nouveauRdv.client_email) {
      await fetch('/api/email-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: nouveauRdv.client_nom,
          client_email: nouveauRdv.client_email,
          service: nouveauRdv.service,
          date_heure: dateHeure.toISOString(),
          coiffeur_nom: coiffeur?.nom || null,
        }),
      })
    }
    setRdvEnvoi('ok')
    setTimeout(() => {
      setNouveauRdvModal(null)
      setNouveauRdv({ client_nom: '', client_email: '', client_telephone: '', service: SERVICES[0], duree_minutes: 30, coiffeur_id: '' })
      setRdvEnvoi('idle')
      chargerRdvs()
    }, 1000)
  }

  function rdvPourCreneau(jour: Date, heure: string) {
    return rdvs.filter(rdv => {
      const d = new Date(rdv.date_heure)
      const matchJour = format(d, 'yyyy-MM-dd') === format(jour, 'yyyy-MM-dd')
      const matchHeure = format(d, 'HH:mm') === heure
      const matchCoiffeur = filtreCoiffeur === 'tous' || rdv.coiffeur_id === filtreCoiffeur
      return matchJour && matchHeure && matchCoiffeur
    })
  }

  function couleurCoiffeur(coiffeurId: string | null) {
    const c = coiffeurs.find(c => c.id === coiffeurId)
    return c?.couleur || '#8b5cf6'
  }

  function estJourFerme(jour: Date) {
    const jourSemaine = (jour.getDay() + 6) % 7
    return horaires.find(h => h.jour_semaine === jourSemaine)?.est_ferme ?? false
  }

  function labelJour(date: Date) {
    if (isToday(date)) return "Aujourd'hui"
    if (isTomorrow(date)) return 'Demain'
    return format(date, 'EEEE d MMM', { locale: fr })
  }

  // Stats filtrées selon le filtre coiffeur
  const rdvsStats = rdvsFiltres
  const joursAffichage = vue === 'semaine' ? joursSemaine : [jourSelectionne]

  return (
    <main className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-medium text-stone-800">Tableau de bord</h1>
            <p className="text-stone-400 text-xs">Salon Éclat</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
              {(['agenda', 'horaires', 'coiffeurs'] as const).map(o => (
                <button key={o} onClick={() => setOnglet(o)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    onglet === o ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}>
                  {o === 'agenda' ? 'Agenda' : o === 'horaires' ? 'Horaires' : 'Coiffeurs'}
                </button>
              ))}
            </div>
            <a href="/" className="text-xs text-stone-400 border border-stone-200 rounded-xl px-3 py-1.5 hover:bg-stone-50">
              Page client
            </a>
          </div>
        </div>
      </div>

      {/* AGENDA */}
      {onglet === 'agenda' && (
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-white border border-stone-200 p-1 rounded-xl">
                {(['semaine', 'jour'] as const).map(v => (
                  <button key={v} onClick={() => setVue(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      vue === v ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-700'
                    }`}>
                    {v === 'semaine' ? 'Semaine' : 'Jour'}
                  </button>
                ))}
              </div>
              {vue === 'semaine' ? (
                <>
                  <button onClick={() => setSemaine(s => addDays(s, -7))}
                    className="text-xs text-stone-500 border border-stone-200 bg-white rounded-xl px-3 py-2 hover:bg-stone-50">← Préc.</button>
                  <span className="text-xs font-medium text-stone-600">
                    {format(debutSemaine, 'd MMM', { locale: fr })} – {format(finSemaine, 'd MMM', { locale: fr })}
                  </span>
                  <button onClick={() => setSemaine(s => addDays(s, 7))}
                    className="text-xs text-stone-500 border border-stone-200 bg-white rounded-xl px-3 py-2 hover:bg-stone-50">Suiv. →</button>
                </>
              ) : (
                <>
                  <button onClick={() => setJourSelectionne(d => addDays(d, -1))}
                    className="text-xs text-stone-500 border border-stone-200 bg-white rounded-xl px-3 py-2 hover:bg-stone-50">← Préc.</button>
                  <span className="text-xs font-medium text-stone-600 capitalize">{labelJour(jourSelectionne)}</span>
                  <button onClick={() => setJourSelectionne(d => addDays(d, 1))}
                    className="text-xs text-stone-500 border border-stone-200 bg-white rounded-xl px-3 py-2 hover:bg-stone-50">Suiv. →</button>
                </>
              )}
            </div>

            {/* Filtre coiffeur */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-400">Coiffeur :</span>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setFiltreCoiffeur('tous')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    filtreCoiffeur === 'tous' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 bg-white'
                  }`}>Tous</button>
                {coiffeurs.map(c => (
                  <button key={c.id} onClick={() => setFiltreCoiffeur(c.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                      filtreCoiffeur === c.id ? 'text-white border-transparent' : 'border-stone-200 text-stone-500 bg-white'
                    }`}
                    style={filtreCoiffeur === c.id ? { background: c.couleur } : {}}>
                    <span className="w-2 h-2 rounded-full" style={{ background: c.couleur }} />
                    {c.nom}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grille */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="grid border-b border-stone-100"
              style={{ gridTemplateColumns: `64px repeat(${joursAffichage.length}, 1fr)` }}>
              <div className="p-2 border-r border-stone-100" />
              {joursAffichage.map(jour => (
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
                  {estJourFerme(jour) && <p className="text-xs text-stone-300">Fermé</p>}
                </div>
              ))}
            </div>

            <div className="overflow-y-auto max-h-[580px]">
              {HEURES.map((heure, hi) => (
                <div key={heure} className="grid border-b border-stone-50 last:border-b-0"
                  style={{ gridTemplateColumns: `64px repeat(${joursAffichage.length}, 1fr)`, minHeight: '52px' }}>
                  <div className={`px-2 py-1 border-r border-stone-100 flex items-start justify-end ${hi % 2 !== 0 ? 'opacity-0' : ''}`}>
                    <span className="text-xs text-stone-300 mt-1">{heure}</span>
                  </div>
                  {joursAffichage.map(jour => {
                    const ferme = estJourFerme(jour)
                    const rdvsCreneau = rdvPourCreneau(jour, heure)
                    return (
                      <div key={jour.toISOString()}
                        className={`border-r border-stone-50 last:border-r-0 p-1 group relative ${
                          ferme ? 'bg-stone-50' : 'hover:bg-stone-50 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (!ferme && rdvsCreneau.length === 0) {
                            setNouveauRdvModal({ jour, heure })
                            setNouveauRdv({ client_nom: '', client_email: '', client_telephone: '', service: SERVICES[0], duree_minutes: 30, coiffeur_id: coiffeurs[0]?.id || '' })
                          }
                        }}>
                        {!ferme && rdvsCreneau.length === 0 && (
                          <div className="absolute inset-1 rounded-lg border-2 border-dashed border-stone-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs text-stone-300">+</span>
                          </div>
                        )}
                        {rdvsCreneau.map(rdv => (
                          <button key={rdv.id}
                            onClick={e => {
                              e.stopPropagation()
                              setRdvSelectionne(rdv)
                              setModeModal('info')
                              setTransfertCoiffeurId(rdv.coiffeur_id || '')
                              setTransfertDate(format(new Date(rdv.date_heure), 'yyyy-MM-dd'))
                              setTransfertHeure(format(new Date(rdv.date_heure), 'HH:mm'))
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-white transition-all hover:opacity-80 mb-0.5"
                            style={{ background: couleurCoiffeur(rdv.coiffeur_id) }}>
                            <p className="font-medium truncate">{rdv.client_nom}</p>
                            <p className="opacity-80 truncate">{rdv.service}</p>
                            {rdv.coiffeur_nom && <p className="opacity-60 truncate">{rdv.coiffeur_nom}</p>}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Stats filtrées */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <p className="text-2xl font-semibold text-stone-800">{rdvsStats.length}</p>
              <p className="text-xs text-stone-400 mt-1">
                {filtreCoiffeur !== 'tous' ? `RDV — ${coiffeurs.find(c => c.id === filtreCoiffeur)?.nom}` : vue === 'semaine' ? 'RDV cette semaine' : 'RDV ce jour'}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <p className="text-2xl font-semibold text-stone-800">
                {rdvsStats.filter(r => format(new Date(r.date_heure), 'yyyy-MM-dd') === format(aujourdhui, 'yyyy-MM-dd')).length}
              </p>
              <p className="text-xs text-stone-400 mt-1">RDV aujourd'hui</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <p className="text-2xl font-semibold text-stone-800">
                {Math.round(rdvsStats.reduce((a, r) => a + r.duree_minutes, 0) / 60 * 10) / 10}h
              </p>
              <p className="text-xs text-stone-400 mt-1">Temps total</p>
            </div>
          </div>
        </div>
      )}

      {/* HORAIRES */}
      {onglet === 'horaires' && (
        <div className="max-w-md mx-auto p-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-700 mb-4">Horaires d'ouverture</h2>
            <div className="space-y-3">
              {horaires.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-stone-700 w-16 flex-shrink-0">{JOURS[i]}</span>
                  <input type="time" value={h.heure_ouverture}
                    disabled={h.est_ferme}
                    onChange={e => { const u = [...horaires]; u[i] = { ...u[i], heure_ouverture: e.target.value }; setHoraires(u) }}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-stone-700 disabled:opacity-30 disabled:bg-stone-50 w-24" />
                  <span className="text-stone-300">→</span>
                  <input type="time" value={h.heure_fermeture}
                    disabled={h.est_ferme}
                    onChange={e => { const u = [...horaires]; u[i] = { ...u[i], heure_fermeture: e.target.value }; setHoraires(u) }}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-stone-700 disabled:opacity-30 disabled:bg-stone-50 w-24" />
                  <button onClick={() => { const u = [...horaires]; u[i] = { ...u[i], est_ferme: !u[i].est_ferme }; setHoraires(u) }}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-all ${
                      h.est_ferme ? 'border-red-200 bg-red-50 text-red-500' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                    }`}>
                    {h.est_ferme ? 'Fermé' : 'Ouvert'}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={sauvegarderHoraires}
              className="mt-6 w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 transition-colors">
              Sauvegarder
            </button>
          </div>
        </div>
      )}

      {/* COIFFEURS */}
      {onglet === 'coiffeurs' && (
        <div className="max-w-2xl mx-auto p-4 space-y-4">

          {/* Liste coiffeurs */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-700 mb-4">Coiffeurs actifs</h2>
            {coiffeurs.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">Aucun coiffeur</p>
            ) : (
              <div className="space-y-2">
                {coiffeurs.map(c => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: c.couleur }} />
                        <span className="text-sm font-medium text-stone-700">{c.nom}</span>
                        <span className="text-xs text-stone-400">
                          {creneauxCoiffeurs.filter(cc => cc.coiffeur_id === c.id).length} créneau(x) perso
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCoiffeurEdite(coiffeurEdite === c.id ? '' : c.id)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                            coiffeurEdite === c.id
                              ? 'bg-stone-800 text-white border-stone-800'
                              : 'border-stone-200 text-stone-500 hover:border-stone-400'
                          }`}>
                          {coiffeurEdite === c.id ? 'Fermer' : 'Créneaux'}
                        </button>
                        <button onClick={() => supprimerCoiffeur(c.id)}
                          className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                      </div>
                    </div>

                    {/* Créneaux spécifiques de ce coiffeur */}
                    {coiffeurEdite === c.id && (
                      <div className="mt-2 ml-4 p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-3">
                        <p className="text-xs font-medium text-stone-500">Créneaux spécifiques de {c.nom}</p>

                        {/* Créneaux existants */}
                        {creneauxCoiffeurs.filter(cc => cc.coiffeur_id === c.id).length === 0 ? (
                          <p className="text-xs text-stone-400">Aucun créneau personnalisé — utilise les horaires du salon</p>
                        ) : (
                          <div className="space-y-1">
                            {creneauxCoiffeurs.filter(cc => cc.coiffeur_id === c.id).map(cc => (
                              <div key={cc.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                                <span className="text-xs text-stone-600">
                                  {JOURS[cc.jour_semaine]} : {cc.heure_debut} → {cc.heure_fin}
                                </span>
                                <button onClick={() => supprimerCreneauCoiffeur(cc.id)}
                                  className="text-xs text-red-400 hover:text-red-600">✕</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Ajouter un créneau */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <select value={nouveauCreneau.jour_semaine}
                            onChange={e => setNouveauCreneau({ ...nouveauCreneau, jour_semaine: Number(e.target.value) })}
                            className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-700 bg-white outline-none focus:border-stone-400">
                            {JOURS.map((j, i) => <option key={i} value={i}>{j}</option>)}
                          </select>
                          <input type="time" value={nouveauCreneau.heure_debut}
                            onChange={e => setNouveauCreneau({ ...nouveauCreneau, heure_debut: e.target.value })}
                            className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-700 bg-white outline-none focus:border-stone-400 w-24" />
                          <span className="text-stone-300 text-xs">→</span>
                          <input type="time" value={nouveauCreneau.heure_fin}
                            onChange={e => setNouveauCreneau({ ...nouveauCreneau, heure_fin: e.target.value })}
                            className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-700 bg-white outline-none focus:border-stone-400 w-24" />
                          <button onClick={ajouterCreneauCoiffeur}
                            disabled={creneauEnvoi === 'chargement'}
                            className="text-xs bg-stone-800 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700 disabled:opacity-40 transition-colors">
                            {creneauEnvoi === 'ok' ? '✓' : '+ Ajouter'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ajouter coiffeur */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-700 mb-4">Ajouter un coiffeur</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Prénom du coiffeur" value={nouveauCoiffeur.nom}
                onChange={e => setNouveauCoiffeur({ ...nouveauCoiffeur, nom: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 placeholder:text-stone-400" />
              <div className="flex items-center gap-3">
                <label className="text-xs text-stone-500">Couleur dans l'agenda :</label>
                <input type="color" value={nouveauCoiffeur.couleur}
                  onChange={e => setNouveauCoiffeur({ ...nouveauCoiffeur, couleur: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-stone-200 cursor-pointer p-0.5 bg-white" />
                <span className="text-xs text-stone-500">{nouveauCoiffeur.couleur}</span>
              </div>
              <button onClick={ajouterCoiffeur}
                disabled={!nouveauCoiffeur.nom || coiffeurEnvoi === 'chargement'}
                className="w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-stone-700 transition-colors">
                {coiffeurEnvoi === 'chargement' ? 'Ajout...' : coiffeurEnvoi === 'ok' ? '✓ Ajouté !' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INFO / ANNULATION / TRANSFERT RDV */}
      {rdvSelectionne && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-stone-200 max-h-[90vh] overflow-y-auto">

            {/* MODE INFO */}
            {modeModal === 'info' && (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-stone-800 text-base">{rdvSelectionne.client_nom}</h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {format(new Date(rdvSelectionne.date_heure), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                    </p>
                  </div>
                  <button onClick={() => setRdvSelectionne(null)}
                    className="text-stone-300 hover:text-stone-500 text-lg leading-none">✕</button>
                </div>
                <div className="bg-stone-50 rounded-xl p-4 space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Service</span>
                    <span className="font-medium text-stone-700">{rdvSelectionne.service}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Durée</span>
                    <span className="font-medium text-stone-700">{rdvSelectionne.duree_minutes} min</span>
                  </div>
                  {rdvSelectionne.coiffeur_nom && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">Coiffeur</span>
                      <span className="font-medium text-stone-700">{rdvSelectionne.coiffeur_nom}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Email</span>
                    <span className="font-medium text-stone-700">{rdvSelectionne.client_email}</span>
                  </div>
                  {rdvSelectionne.client_telephone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">Tél.</span>
                      <span className="font-medium text-stone-700">{rdvSelectionne.client_telephone}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setModeModal('transfert')}
                    className="w-full bg-stone-100 text-stone-700 border border-stone-200 rounded-xl py-2.5 text-sm font-medium hover:bg-stone-200 transition-colors">
                    Déplacer / Réassigner
                  </button>
                  <button onClick={() => setModeModal('annulation')}
                    className="w-full bg-red-50 text-red-500 border border-red-200 rounded-xl py-2.5 text-sm font-medium hover:bg-red-100 transition-colors">
                    Annuler ce rendez-vous
                  </button>
                </div>
              </>
            )}

            {/* MODE TRANSFERT */}
            {modeModal === 'transfert' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-stone-800">Déplacer / Réassigner</h3>
                  <button onClick={() => setModeModal('info')} className="text-stone-300 hover:text-stone-500 text-lg leading-none">✕</button>
                </div>
                <p className="text-xs text-stone-400 mb-4">{rdvSelectionne.client_nom} — {rdvSelectionne.service}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Coiffeur</label>
                    <select value={transfertCoiffeurId}
                      onChange={e => setTransfertCoiffeurId(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400">
                      <option value="">Sans préférence</option>
                      {coiffeurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Nouvelle date</label>
                    <input type="date" value={transfertDate}
                      min={format(aujourdhui, 'yyyy-MM-dd')}
                      onChange={e => setTransfertDate(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Nouvelle heure</label>
                    <select value={transfertHeure}
                      onChange={e => setTransfertHeure(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400">
                      {HEURES.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setModeModal('info')}
                      className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2.5 text-sm hover:bg-stone-50">
                      Retour
                    </button>
                    <button onClick={confirmerTransfert}
                      disabled={!transfertDate || !transfertHeure || transfertChargement}
                      className="flex-1 bg-stone-800 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-stone-700 disabled:opacity-40">
                      {transfertChargement ? 'Enregistrement...' : 'Confirmer'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* MODE ANNULATION */}
            {modeModal === 'annulation' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-stone-800">Motif d'annulation</h3>
                  <button onClick={() => setModeModal('info')} className="text-stone-300 hover:text-stone-500 text-lg leading-none">✕</button>
                </div>
                <p className="text-xs text-stone-400 mb-4">Un email sera envoyé à {rdvSelectionne.client_email}</p>
                <div className="space-y-2 mb-4">
                  {MESSAGES_AUTO.map(msg => (
                    <button key={msg} onClick={() => setMessagePreset(msg)}
                      className={`w-full text-left text-xs px-3 py-2.5 rounded-xl border transition-all ${
                        messagePreset === msg
                          ? 'border-stone-800 bg-stone-800 text-white'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                      }`}>
                      {msg}
                    </button>
                  ))}
                </div>
                {messagePreset === MESSAGES_AUTO[4] && (
                  <textarea
                    value={messagePersonnalise}
                    onChange={e => setMessagePersonnalise(e.target.value)}
                    placeholder="Votre message personnalisé..."
                    rows={3}
                    className="w-full border border-stone-200 bg-white rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400 resize-none mb-4 placeholder:text-stone-400"
                  />
                )}
                <div className="flex gap-2">
                  <button onClick={() => setModeModal('info')}
                    className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2.5 text-sm hover:bg-stone-50">
                    Retour
                  </button>
                  <button onClick={confirmerAnnulation} disabled={annulationChargement}
                    className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600 disabled:opacity-40">
                    {annulationChargement ? 'Envoi...' : 'Confirmer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL NOUVEAU RDV DEPUIS CALENDRIER */}
      {nouveauRdvModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-stone-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium text-stone-800">Nouveau rendez-vous</h3>
                <p className="text-xs text-stone-400 mt-0.5 capitalize">
                  {format(nouveauRdvModal.jour, 'EEEE d MMMM', { locale: fr })} à {nouveauRdvModal.heure}
                </p>
              </div>
              <button onClick={() => setNouveauRdvModal(null)}
                className="text-stone-300 hover:text-stone-500 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Nom du client *" value={nouveauRdv.client_nom}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_nom: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 placeholder:text-stone-400" />
              <input type="email" placeholder="Email (optionnel)" value={nouveauRdv.client_email}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_email: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 placeholder:text-stone-400" />
              <input type="tel" placeholder="Téléphone (optionnel)" value={nouveauRdv.client_telephone}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_telephone: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 placeholder:text-stone-400" />
              <select value={nouveauRdv.service}
                onChange={e => setNouveauRdv({ ...nouveauRdv, service: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400">
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={nouveauRdv.coiffeur_id}
                onChange={e => setNouveauRdv({ ...nouveauRdv, coiffeur_id: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400">
                <option value="">Sans préférence</option>
                {coiffeurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <input type="number" min={15} step={15} value={nouveauRdv.duree_minutes}
                onChange={e => setNouveauRdv({ ...nouveauRdv, duree_minutes: Number(e.target.value) })}
                placeholder="Durée (min)"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400" />
              <button onClick={ajouterRdvDepuisCalendrier}
                disabled={!nouveauRdv.client_nom || rdvEnvoi === 'chargement'}
                className="w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-stone-700 transition-colors">
                {rdvEnvoi === 'chargement' ? 'Ajout...' : rdvEnvoi === 'ok' ? '✓ Ajouté !' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}