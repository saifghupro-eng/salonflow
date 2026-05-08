'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RendezVous, Coiffeur } from '@/lib/types'
import {
  format, startOfDay, addDays, isToday, isTomorrow,
  startOfWeek, endOfWeek, eachDayOfInterval
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

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
// Couleurs pastel par coiffeur (fallback)
const PASTEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '#6366f1': { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  '#ec4899': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  '#f59e0b': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  '#10b981': { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  '#3b82f6': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  '#8b5cf6': { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  '#ef4444': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  '#06b6d4': { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
}
type VueType = 'semaine' | 'jour'
type OngletType = 'agenda' | 'horaires' | 'coiffeurs'

type CreneauCoiffeur = {
  id: string
  coiffeur_id: string
  jour_semaine: number
  heure_debut: string
  heure_fin: string
}

type JourOff = {
  id: string
  coiffeur_id: string
  date: string
  raison: string | null
}

function hexToPastel(hex: string): { bg: string; text: string; border: string } {
  if (PASTEL_COLORS[hex]) return PASTEL_COLORS[hex]
  // Génère un pastel à partir de n'importe quelle couleur hex
  return { bg: hex + '22', text: hex, border: hex + '66' }
}

export default function TableauBordSalon() {
  const router = useRouter()

  const [rdvs, setRdvs] = useState<RendezVous[]>([])
  const [coiffeurs, setCoiffeurs] = useState<Coiffeur[]>([])
  const [creneauxCoiffeurs, setCreneauxCoiffeurs] = useState<CreneauCoiffeur[]>([])
  const [joursOff, setJoursOff] = useState<JourOff[]>([])
  const [semaine, setSemaine] = useState<Date>(new Date())
  const [jourSelectionne, setJourSelectionne] = useState<Date>(new Date())
  const [vue, setVue] = useState<VueType>('semaine')
  const [filtreCoiffeur, setFiltreCoiffeur] = useState<string>('tous')
  const [onglet, setOnglet] = useState<OngletType>('agenda')
  const [chargement, setChargement] = useState(true)
  const [nomUtilisateur, setNomUtilisateur] = useState<string>('')
  const [horaires, setHoraires] = useState(
    JOURS.map((_, i) => ({
      jour_semaine: i, heure_ouverture: '09:00', heure_fermeture: '18:00', est_ferme: i >= 5,
    }))
  )

  // Modal RDV
  const [rdvSelectionne, setRdvSelectionne] = useState<RendezVous | null>(null)
  const [modeModal, setModeModal] = useState<'info' | 'annulation' | 'transfert'>('info')
  const [messagePreset, setMessagePreset] = useState(MESSAGES_AUTO[0])
  const [messagePersonnalise, setMessagePersonnalise] = useState('')
  const [annulationChargement, setAnnulationChargement] = useState(false)
  const [transfertCoiffeurId, setTransfertCoiffeurId] = useState('')
  const [transfertDate, setTransfertDate] = useState('')
  const [transfertHeure, setTransfertHeure] = useState('')
  const [transfertChargement, setTransfertChargement] = useState(false)

  // Modal nouveau RDV
  const [nouveauRdvModal, setNouveauRdvModal] = useState<{ jour: Date; heure: string } | null>(null)
  const [nouveauRdv, setNouveauRdv] = useState({
    client_nom: '', client_email: '', client_telephone: '',
    service: SERVICES[0], duree_minutes: 30, coiffeur_id: '',
  })
  const [rdvEnvoi, setRdvEnvoi] = useState<'idle' | 'chargement' | 'ok'>('idle')

  // Coiffeur form
  const [nouveauCoiffeur, setNouveauCoiffeur] = useState({ nom: '', couleur: '#6366f1' })
  const [coiffeurEnvoi, setCoiffeurEnvoi] = useState<'idle' | 'chargement' | 'ok'>('idle')

  // Créneaux coiffeur
  const [coiffeurEdite, setCoiffeurEdite] = useState<string>('')
  const [nouveauCreneau, setNouveauCreneau] = useState({ jour_semaine: 0, heure_debut: '09:00', heure_fin: '13:00' })
  const [creneauEnvoi, setCreneauEnvoi] = useState<'idle' | 'chargement' | 'ok'>('idle')

  // Jours off
  const [nouveauJourOff, setNouveauJourOff] = useState({ coiffeur_id: '', date: '', raison: '' })
  const [jourOffEnvoi, setJourOffEnvoi] = useState<'idle' | 'chargement' | 'ok'>('idle')

  const aujourdhui = new Date()
  const debutSemaine = startOfWeek(semaine, { weekStartsOn: 1 })
  const finSemaine = endOfWeek(semaine, { weekStartsOn: 1 })
  const joursSemaine = eachDayOfInterval({ start: debutSemaine, end: finSemaine })
  const joursAffichage = vue === 'semaine' ? joursSemaine : [jourSelectionne]
  const rdvsFiltres = filtreCoiffeur === 'tous' ? rdvs : rdvs.filter(r => r.coiffeur_id === filtreCoiffeur)

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
  useEffect(() => {
    chargerCoiffeurs()
    chargerHoraires()
    chargerCreneauxCoiffeurs()
    chargerJoursOff()
  }, [])
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const nom = data.user?.user_metadata?.nom || data.user?.email?.split('@')[0] || 'Utilisateur'
      setNomUtilisateur(nom)
    })
  }, [])

  async function seDeconnecter() {
    await supabase.auth.signOut()
    router.push('/login')
  }

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

  async function chargerJoursOff() {
    const { data } = await supabase.from('jours_off_coiffeur').select('*').eq('salon_id', SALON_ID)
    setJoursOff(data || [])
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

  // FIX : INSERT au lieu de UPSERT pour permettre plusieurs créneaux par jour
  async function ajouterCreneauCoiffeur() {
    if (!coiffeurEdite) return
    setCreneauEnvoi('chargement')
    await supabase.from('creneaux_coiffeur').insert({
      coiffeur_id: coiffeurEdite,
      salon_id: SALON_ID,
      jour_semaine: nouveauCreneau.jour_semaine,
      heure_debut: nouveauCreneau.heure_debut,
      heure_fin: nouveauCreneau.heure_fin,
    })
    setCreneauEnvoi('ok')
    chargerCreneauxCoiffeurs()
    setTimeout(() => setCreneauEnvoi('idle'), 2000)
  }

  async function supprimerCreneauCoiffeur(id: string) {
    await supabase.from('creneaux_coiffeur').delete().eq('id', id)
    chargerCreneauxCoiffeurs()
  }

  async function ajouterJourOff() {
    if (!nouveauJourOff.coiffeur_id || !nouveauJourOff.date) return
    setJourOffEnvoi('chargement')
    await supabase.from('jours_off_coiffeur').insert({
      coiffeur_id: nouveauJourOff.coiffeur_id,
      salon_id: SALON_ID,
      date: nouveauJourOff.date,
      raison: nouveauJourOff.raison || null,
    })
    setJourOffEnvoi('ok')
    setNouveauJourOff({ coiffeur_id: nouveauJourOff.coiffeur_id, date: '', raison: '' })
    chargerJoursOff()
    setTimeout(() => setJourOffEnvoi('idle'), 2000)
  }

  async function supprimerJourOff(id: string) {
    await supabase.from('jours_off_coiffeur').delete().eq('id', id)
    chargerJoursOff()
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
    const couleur = c?.couleur || '#8b5cf6'
    return hexToPastel(couleur)
  }

  function estJourFerme(jour: Date) {
    const jourSemaine = (jour.getDay() + 6) % 7
    return horaires.find(h => h.jour_semaine === jourSemaine)?.est_ferme ?? false
  }

  // Vérifie si un coiffeur est en congé ce jour
  function estEnConge(coiffeurId: string, jour: Date): boolean {
    return joursOff.some(j =>
      j.coiffeur_id === coiffeurId &&
      j.date === format(jour, 'yyyy-MM-dd')
    )
  }

  // Coiffeurs absents ce jour
  function coiffeursAbsents(jour: Date): string[] {
    return joursOff
      .filter(j => j.date === format(jour, 'yyyy-MM-dd'))
      .map(j => j.coiffeur_id)
  }

  function labelJour(date: Date) {
    if (isToday(date)) return "Aujourd'hui"
    if (isTomorrow(date)) return 'Demain'
    return format(date, 'EEEE d MMM', { locale: fr })
  }

  const rdvsStats = rdvsFiltres

  return (
    <main className="min-h-screen bg-stone-50" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        .cal-row-full { border-top: 1px solid #d6d3d1; }
        .cal-row-half { border-top: 1px dashed #e7e5e4; }
  .cal-time-label {
  font-family: 'Noto Sans', sans-serif;
  font-size: 10px;
  font-weight: 400;
  color: #a8a29e;
  letter-spacing: 0;
  transform: translateY(-7px);
}
.cal-time-label-half {
  font-family: 'Noto Sans', sans-serif;
  font-size: 10px;
  color: transparent;
}
        .rdv-card { border-left-width: 2px !important; border-top-width: 0 !important; border-right-width: 0 !important; border-bottom-width: 0 !important; border-radius: 6px !important; }
        .absent-hatch { background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px); }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-stone-800">Tableau de bord</h1>
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
            <span className="text-xs text-stone-500 hidden sm:block">👤 {nomUtilisateur}</span>
            <a href="/" className="text-xs text-stone-400 border border-stone-200 rounded-xl px-3 py-1.5 hover:bg-stone-50">
              Page client
            </a>
            <button onClick={seDeconnecter}
              className="text-xs text-stone-400 border border-stone-200 rounded-xl px-3 py-1.5 hover:bg-stone-50 transition-colors">
              Déconnexion
            </button>
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

            {/* Filtre coiffeur en boutons (pas de liste déroulante) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-400">Coiffeur :</span>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setFiltreCoiffeur('tous')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    filtreCoiffeur === 'tous'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-200 text-stone-500 bg-white hover:border-stone-400'
                  }`}>Tous</button>
                {coiffeurs.map(c => (
                  <button key={c.id} onClick={() => setFiltreCoiffeur(c.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                      filtreCoiffeur === c.id
                        ? 'text-white border-transparent'
                        : 'border-stone-200 text-stone-500 bg-white hover:border-stone-400'
                    }`}
                    style={filtreCoiffeur === c.id ? { background: c.couleur } : {}}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.couleur }} />
                    {c.nom}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'RDV cette période', val: rdvsStats.length },
              { label: "Aujourd'hui", val: rdvsStats.filter(r => isToday(new Date(r.date_heure))).length },
              { label: 'Cette semaine', val: rdvsStats.filter(r => { const d = new Date(r.date_heure); return d >= debutSemaine && d <= finSemaine }).length },
            ].map(s => (
              <div key={s.label} className="bg-white border border-stone-200 rounded-2xl p-4">
                <p className="text-2xl font-semibold text-stone-800">{s.val}</p>
                <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Calendrier */}
          {chargement ? (
            <div className="text-center py-16 text-stone-400 text-sm">Chargement...</div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              {/* En-têtes jours */}
              <div className={`grid border-b border-stone-100 ${vue === 'semaine' ? 'grid-cols-8' : 'grid-cols-2'}`}>
                <div className="py-2 px-3 text-xs text-stone-300 border-r border-stone-100" />
                {joursAffichage.map(jour => {
                  const absents = coiffeursAbsents(jour)
                  return (
                    <div key={jour.toISOString()}
                      className={`py-2 px-3 text-center border-r border-stone-100 last:border-0 ${
                        isToday(jour) ? 'bg-stone-800' : estJourFerme(jour) ? 'bg-stone-50 opacity-50' : ''
                      }`}>
                      <p className={`text-xs font-medium capitalize ${isToday(jour) ? 'text-stone-300' : 'text-stone-500'}`}>
                        {format(jour, 'EEE', { locale: fr })}
                      </p>
                      <p className={`text-sm font-semibold ${isToday(jour) ? 'text-white' : 'text-stone-800'}`}>
                        {format(jour, 'd')}
                      </p>
                      {estJourFerme(jour) && <p className="text-xs text-stone-300">Fermé</p>}
                      {absents.length > 0 && (
                        <p className="text-xs text-amber-500 mt-0.5">{absents.length} absent{absents.length > 1 ? 's' : ''}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Lignes horaires — heures à gauche de chaque ligne */}
              <div className="overflow-y-auto max-h-[60vh]">
                {HEURES.map(heure => {
                  const isHalfHour = heure.endsWith(':30')
                  return (
                    <div key={heure} className={`grid ${isHalfHour ? 'cal-row-half' : 'cal-row-full'} ${vue === 'semaine' ? 'grid-cols-8' : 'grid-cols-2'}`}>
                      {/* Heure à gauche */}
                      <div className={`py-2 px-2 border-r border-stone-100 whitespace-nowrap flex items-start ${isHalfHour ? 'cal-time-label-half' : 'cal-time-label'}`}>
                        {heure}
                      </div>
                      {joursAffichage.map(jour => {
                        const rdvsDuCreneau = rdvPourCreneau(jour, heure)
                        const ferme = estJourFerme(jour)
                        const absentsJour = coiffeursAbsents(jour)
                        const tousEnConge = coiffeurs.length > 0 && absentsJour.length === coiffeurs.length
                        const coiffeurFiltreEnConge = filtreCoiffeur !== 'tous' && absentsJour.includes(filtreCoiffeur)
                        const hachure = ferme || tousEnConge || coiffeurFiltreEnConge
                        return (
                          <div key={jour.toISOString()}
                            onClick={() => {
                              if (!hachure) {
                                setNouveauRdvModal({ jour, heure })
                                setNouveauRdv({ client_nom: '', client_email: '', client_telephone: '', service: SERVICES[0], duree_minutes: 30, coiffeur_id: coiffeurs[0]?.id || '' })
                              }
                            }}
                            className={`py-1 px-1 border-r border-stone-100 last:border-0 min-h-[40px] group relative ${
                              hachure ? 'absent-hatch cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-stone-50'
                            }`}>
                            {!hachure && rdvsDuCreneau.length === 0 && (
                              <div className="absolute inset-0.5 rounded border border-dashed border-stone-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-xs text-stone-300">+</span>
                              </div>
                            )}
                            {rdvsDuCreneau.map(rdv => {
                              const style = couleurCoiffeur(rdv.coiffeur_id)
                              return (
                                <div key={rdv.id}
                                  onClick={e => {
                                    e.stopPropagation()
                                    setRdvSelectionne(rdv)
                                    setModeModal('info')
                                    setTransfertCoiffeurId(rdv.coiffeur_id || '')
                                    setTransfertDate(format(new Date(rdv.date_heure), 'yyyy-MM-dd'))
                                    setTransfertHeure(format(new Date(rdv.date_heure), 'HH:mm'))
                                  }}
                                  className="rdv-card px-1.5 py-1 mb-0.5 cursor-pointer transition-opacity hover:opacity-80 border"
                                  style={{ backgroundColor: style.bg, borderColor: style.border }}>
                                  <p className="sans font-medium truncate text-xs" style={{ color: style.text }}>{rdv.client_nom}</p>
                                  <p className="sans truncate opacity-70 hidden sm:block" style={{ fontSize: '10px', color: style.text }}>{rdv.service}</p>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Légende */}
              <div className="px-4 py-3 border-t border-stone-100 flex items-center gap-5 flex-wrap">
                {coiffeurs.map(c => {
                  const style = hexToPastel(c.couleur)
                  return (
                    <div key={c.id} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: style.bg, borderLeft: `2px solid ${style.border}` }} />
                      <span className="text-xs text-stone-500">{c.nom}</span>
                    </div>
                  )
                })}
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 absent-hatch border border-stone-200" />
                  <span className="text-xs text-stone-400">Fermé / Congé</span>
                </div>
                <div className="flex items-center gap-4 ml-auto">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-px bg-stone-400" />
                    <span className="text-xs text-stone-300">heure</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 border-t border-dashed border-stone-300" />
                    <span className="text-xs text-stone-300">demie</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HORAIRES */}
      {onglet === 'horaires' && (
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">Horaires d'ouverture</h2>
              <p className="text-xs text-stone-400 mt-0.5">Définissez les horaires hebdomadaires du salon</p>
            </div>
            <div className="divide-y divide-stone-50">
              {horaires.map((h, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-stone-700 w-24 shrink-0">{JOURS[h.jour_semaine]}</span>
                  <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                    <input type="checkbox" checked={h.est_ferme}
                      onChange={e => {
                        const copy = [...horaires]
                        copy[i] = { ...copy[i], est_ferme: e.target.checked }
                        setHoraires(copy)
                      }}
                      className="rounded accent-stone-800" />
                    Fermé
                  </label>
                  {!h.est_ferme && (
                    <div className="flex items-center gap-2">
                      <input type="time" value={h.heure_ouverture}
                        onChange={e => {
                          const copy = [...horaires]
                          copy[i] = { ...copy[i], heure_ouverture: e.target.value }
                          setHoraires(copy)
                        }}
                        className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-700 bg-white outline-none focus:border-stone-400" />
                      <span className="text-stone-300 text-xs">→</span>
                      <input type="time" value={h.heure_fermeture}
                        onChange={e => {
                          const copy = [...horaires]
                          copy[i] = { ...copy[i], heure_fermeture: e.target.value }
                          setHoraires(copy)
                        }}
                        className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-700 bg-white outline-none focus:border-stone-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-stone-100">
              <button onClick={sauvegarderHoraires}
                className="bg-stone-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-stone-700 transition-colors">
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COIFFEURS */}
      {onglet === 'coiffeurs' && (
        <div className="max-w-2xl mx-auto p-4 space-y-4">

          {/* Liste coiffeurs */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">Équipe</h2>
            </div>
            {coiffeurs.length === 0 ? (
              <p className="text-center text-stone-400 text-sm py-8">Aucun coiffeur enregistré</p>
            ) : (
              <div className="divide-y divide-stone-50">
                {coiffeurs.map(c => (
                  <div key={c.id}>
                    <div className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.couleur }} />
                        <span className="text-sm text-stone-700">{c.nom}</span>
                        <span className="text-xs text-stone-300">
                          {creneauxCoiffeurs.filter(cc => cc.coiffeur_id === c.id).length} créneau(x) ·{' '}
                          {joursOff.filter(j => j.coiffeur_id === c.id).length} congé(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCoiffeurEdite(coiffeurEdite === c.id ? '' : c.id)
                            setNouveauJourOff(j => ({ ...j, coiffeur_id: c.id }))
                          }}
                          className={`text-xs border rounded-lg px-2 py-1 transition-all ${
                            coiffeurEdite === c.id
                              ? 'bg-stone-800 text-white border-stone-800'
                              : 'border-stone-200 text-stone-400 hover:border-stone-400'
                          }`}>
                          {coiffeurEdite === c.id ? 'Fermer' : 'Gérer'}
                        </button>
                        <button onClick={() => supprimerCoiffeur(c.id)}
                          className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2 py-1">
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Panel gestion coiffeur */}
                    {coiffeurEdite === c.id && (
                      <div className="mx-4 mb-3 rounded-xl border border-stone-100 overflow-hidden bg-stone-50">

                        {/* Créneaux horaires */}
                        <div className="px-4 py-3 border-b border-stone-100">
                          <p className="text-xs font-semibold text-stone-600 mb-1">Créneaux de travail</p>
                          <p className="text-xs text-stone-400 mb-3">Plusieurs créneaux par jour = pauses définies (ex: 9h–12h puis 14h–18h)</p>

                          {creneauxCoiffeurs.filter(cr => cr.coiffeur_id === c.id).length === 0 ? (
                            <p className="text-xs text-stone-300 mb-2">Aucun créneau — utilise les horaires salon</p>
                          ) : (
                            <div className="space-y-1 mb-3">
                              {creneauxCoiffeurs
                                .filter(cr => cr.coiffeur_id === c.id)
                                .sort((a, b) => a.jour_semaine - b.jour_semaine || a.heure_debut.localeCompare(b.heure_debut))
                                .map(cr => (
                                  <div key={cr.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-stone-100">
                                    <span className="text-xs text-stone-600 font-medium w-20">{JOURS[cr.jour_semaine]}</span>
                                    <span className="text-xs text-stone-400">{cr.heure_debut} → {cr.heure_fin}</span>
                                    <button onClick={() => supprimerCreneauCoiffeur(cr.id)}
                                      className="text-xs text-red-300 hover:text-red-500">✕</button>
                                  </div>
                                ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
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
                              className="bg-stone-800 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-stone-700 disabled:opacity-40 transition-colors">
                              {creneauEnvoi === 'ok' ? '✓' : '+ Ajouter'}
                            </button>
                          </div>
                        </div>

                        {/* Jours off */}
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold text-stone-600 mb-1">Jours de congé</p>

                          {joursOff.filter(j => j.coiffeur_id === c.id).length > 0 && (
                            <div className="space-y-1 mb-3">
                              {joursOff
                                .filter(j => j.coiffeur_id === c.id)
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map(j => (
                                  <div key={j.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                                    <span className="text-xs text-stone-600 font-medium">
                                      {format(new Date(j.date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
                                    </span>
                                    {j.raison && <span className="text-xs text-stone-400 truncate max-w-[100px]">{j.raison}</span>}
                                    <button onClick={() => supprimerJourOff(j.id)}
                                      className="text-xs text-red-300 hover:text-red-500">✕</button>
                                  </div>
                                ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="date" value={nouveauJourOff.date}
                              min={format(aujourdhui, 'yyyy-MM-dd')}
                              onChange={e => setNouveauJourOff({ ...nouveauJourOff, date: e.target.value })}
                              className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-700 bg-white outline-none focus:border-stone-400" />
                            <input type="text" placeholder="Motif (optionnel)" value={nouveauJourOff.raison}
                              onChange={e => setNouveauJourOff({ ...nouveauJourOff, raison: e.target.value })}
                              className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-stone-700 bg-white outline-none focus:border-stone-400 flex-1 min-w-24 placeholder:text-stone-300" />
                            <button onClick={ajouterJourOff}
                              disabled={!nouveauJourOff.date || jourOffEnvoi === 'chargement'}
                              className="bg-amber-500 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-amber-600 disabled:opacity-40 transition-colors">
                              {jourOffEnvoi === 'ok' ? '✓' : '+ Congé'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ajouter coiffeur */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">Ajouter un coiffeur</h2>
            </div>
            <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
              <input type="text" placeholder="Nom" value={nouveauCoiffeur.nom}
                onChange={e => setNouveauCoiffeur({ ...nouveauCoiffeur, nom: e.target.value })}
                className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 flex-1 min-w-32 placeholder:text-stone-300" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-stone-500">Couleur</label>
                <input type="color" value={nouveauCoiffeur.couleur}
                  onChange={e => setNouveauCoiffeur({ ...nouveauCoiffeur, couleur: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-stone-200 cursor-pointer" />
              </div>
              <button onClick={ajouterCoiffeur}
                disabled={!nouveauCoiffeur.nom || coiffeurEnvoi === 'chargement'}
                className="bg-stone-800 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors">
                {coiffeurEnvoi === 'chargement' ? 'Ajout...' : coiffeurEnvoi === 'ok' ? '✓ Ajouté !' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RDV */}
      {rdvSelectionne && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-stone-200">

            {modeModal === 'info' && (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-stone-800">{rdvSelectionne.client_nom}</h3>
                    <p className="text-xs text-stone-400 mt-0.5 capitalize">
                      {format(new Date(rdvSelectionne.date_heure), 'EEEE d MMMM à HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <button onClick={() => setRdvSelectionne(null)}
                    className="text-stone-300 hover:text-stone-500 text-lg leading-none">✕</button>
                </div>
                <div className="space-y-2 mb-4 bg-stone-50 rounded-xl p-3">
                  {[
                    { label: 'Service', val: rdvSelectionne.service },
                    { label: 'Durée', val: `${rdvSelectionne.duree_minutes} min` },
                    { label: 'Coiffeur', val: rdvSelectionne.coiffeur_nom || 'Sans préférence' },
                    { label: 'Email', val: rdvSelectionne.client_email || '—' },
                    { label: 'Téléphone', val: rdvSelectionne.client_telephone || '—' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-sm">
                      <span className="text-stone-400 text-xs">{row.label}</span>
                      <span className="text-stone-700 text-xs font-medium">{row.val}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModeModal('transfert')}
                    className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2.5 text-sm hover:bg-stone-50">
                    Déplacer
                  </button>
                  <button onClick={() => setModeModal('annulation')}
                    className="flex-1 bg-red-50 text-red-500 border border-red-200 rounded-xl py-2.5 text-sm font-medium hover:bg-red-100 transition-colors">
                    Annuler
                  </button>
                </div>
              </>
            )}

            {modeModal === 'transfert' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-stone-800">Déplacer / Réassigner</h3>
                  <button onClick={() => setModeModal('info')} className="text-stone-300 hover:text-stone-500 text-lg leading-none">✕</button>
                </div>
                <p className="text-xs text-stone-400 mb-4">{rdvSelectionne.client_nom} — {rdvSelectionne.service}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Coiffeur</label>
                    <select value={transfertCoiffeurId} onChange={e => setTransfertCoiffeurId(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400">
                      <option value="">Sans préférence</option>
                      {coiffeurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Nouvelle date</label>
                    <input type="date" value={transfertDate} min={format(aujourdhui, 'yyyy-MM-dd')}
                      onChange={e => setTransfertDate(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Nouvelle heure</label>
                    <select value={transfertHeure} onChange={e => setTransfertHeure(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400">
                      {HEURES.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setModeModal('info')}
                      className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2.5 text-sm hover:bg-stone-50">Retour</button>
                    <button onClick={confirmerTransfert}
                      disabled={!transfertDate || !transfertHeure || transfertChargement}
                      className="flex-1 bg-stone-800 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-stone-700 disabled:opacity-40">
                      {transfertChargement ? 'Enregistrement...' : 'Confirmer'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {modeModal === 'annulation' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-stone-800">Motif d'annulation</h3>
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
                  <textarea value={messagePersonnalise} onChange={e => setMessagePersonnalise(e.target.value)}
                    placeholder="Votre message personnalisé..."
                    rows={3}
                    className="w-full border border-stone-200 bg-white rounded-xl px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-400 resize-none mb-4 placeholder:text-stone-400" />
                )}
                <div className="flex gap-2">
                  <button onClick={() => setModeModal('info')}
                    className="flex-1 border border-stone-200 text-stone-600 rounded-xl py-2.5 text-sm hover:bg-stone-50">Retour</button>
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

      {/* MODAL NOUVEAU RDV */}
      {nouveauRdvModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-stone-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-stone-800">Nouveau rendez-vous</h3>
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
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 placeholder:text-stone-300" />
              <input type="email" placeholder="Email (optionnel)" value={nouveauRdv.client_email}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_email: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 placeholder:text-stone-300" />
              <input type="tel" placeholder="Téléphone (optionnel)" value={nouveauRdv.client_telephone}
                onChange={e => setNouveauRdv({ ...nouveauRdv, client_telephone: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400 placeholder:text-stone-300" />
              <select value={nouveauRdv.service} onChange={e => setNouveauRdv({ ...nouveauRdv, service: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 bg-white outline-none focus:border-stone-400">
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={nouveauRdv.coiffeur_id} onChange={e => setNouveauRdv({ ...nouveauRdv, coiffeur_id: e.target.value })}
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