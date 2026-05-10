'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Coiffeur, RendezVous } from '@/lib/types'
import { format, addMinutes, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const SALON_ID = '6143f4a8-f4ab-485f-81b8-9bface600335'
const SERVICES = ['Coupe homme', 'Coupe femme', 'Couleur', 'Balayage', 'Autre']
const DUREE: Record<string, number> = {
  'Coupe homme': 30, 'Coupe femme': 45, 'Couleur': 90, 'Balayage': 120, 'Autre': 30,
}
const PASTEL: Record<string, { bg: string; text: string; dot: string }> = {
  '#6366f1': { bg: '#ede9fe', text: '#5b21b6', dot: '#6366f1' },
  '#ec4899': { bg: '#fce7f3', text: '#9d174d', dot: '#ec4899' },
  '#f59e0b': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  '#10b981': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  '#3b82f6': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  '#8b5cf6': { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  '#ef4444': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  '#06b6d4': { bg: '#cffafe', text: '#155e75', dot: '#06b6d4' },
}
const pc = (hex: string) => PASTEL[hex] || { bg: hex + '22', text: hex, dot: hex }

type Etape = 'coiffeurs' | 'service' | 'nom' | 'ticket'
type CoiffeurAvecDispo = Coiffeur & {
  attente_minutes: number
  nb_en_attente: number
  heure_dispo: string
  dispo_date: Date
}
type Ticket = {
  id: string
  nom: string
  service: string
  coiffeur_nom: string
  coiffeur_id: string | null
  heure: string
  position: number
  attente_minutes: number
}

export default function BorneSalon() {
  const [etape, setEtape] = useState<Etape>('coiffeurs')
  const [coiffeurs, setCoiffeurs] = useState<CoiffeurAvecDispo[]>([])
  const [rdvsDuJour, setRdvsDuJour] = useState<RendezVous[]>([])
  const [chargement, setChargement] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [salonFerme, setSalonFerme] = useState(false) // ✅ état déplacé ici

  const [coiffeurChoisi, setCoiffeurChoisi] = useState<CoiffeurAvecDispo | null>(null)
  const [sansPref, setSansPref] = useState(false)
  const [service, setService] = useState('Coupe homme')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [ticket, setTicket] = useState<Ticket | null>(null)

  const [vueFile, setVueFile] = useState<'global' | string>('global')
  const [vueFileAccueil, setVueFileAccueil] = useState<'global' | string>('global')

  const getNow = () => new Date()

  const charger = useCallback(async () => {
    const today = new Date()
    const debut = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const fin = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

    // ✅ horaires chargés dans le même Promise.all
    const [{ data: rawCoiffeurs }, { data: rawRdvs }, { data: horaires }] = await Promise.all([
      supabase.from('coiffeurs').select('*').eq('salon_id', SALON_ID).eq('actif', true),
      supabase.from('rendez_vous').select('*')
        .eq('salon_id', SALON_ID).eq('statut', 'confirme')
        .gte('date_heure', debut.toISOString())
        .lte('date_heure', fin.toISOString())
        .order('date_heure'),
      supabase.from('horaires').select('*').eq('salon_id', SALON_ID),
    ])

    // ✅ Vérifier si le salon est fermé aujourd'hui
    const now = new Date()
    const jourSemaine = (now.getDay() + 6) % 7 // 0=lundi ... 6=dimanche
    const horaireAujourdhui = (horaires as any[])?.find((h: any) => h.jour_semaine === jourSemaine)
    const heureCourante = now.getHours() * 60 + now.getMinutes()
    const heureOuverture = horaireAujourdhui ? parseInt(horaireAujourdhui.heure_ouverture.split(':')[0]) * 60 : 0
    const heureFermeture = horaireAujourdhui ? parseInt(horaireAujourdhui.heure_fermeture.split(':')[0]) * 60 : 0
    const ferme = !horaireAujourdhui
      || horaireAujourdhui.est_ferme
      || heureCourante < heureOuverture
      || heureCourante >= heureFermeture
    setSalonFerme(ferme)

    const rdvs: RendezVous[] = rawRdvs || []
    setRdvsDuJour(rdvs)

    const coiffeursAvecDispo: CoiffeurAvecDispo[] = (rawCoiffeurs || []).map(c => {
      const currentNow = getNow()
      let dispoMin = new Date(currentNow)
      const mins = dispoMin.getMinutes()
      const reste = 15 - (mins % 15)
      if (reste < 15) dispoMin = addMinutes(dispoMin, reste)
      dispoMin.setSeconds(0, 0)

      const rdvsC = rdvs.filter(r => r.coiffeur_id === c.id)
        .sort((a, b) => new Date(a.date_heure).getTime() - new Date(b.date_heure).getTime())
      const rdvsFuturs = rdvsC.filter(r => new Date(r.date_heure) >= currentNow)

      let dispo = new Date(dispoMin)
      for (const r of rdvsC) {
        const debutRdv = parseISO(r.date_heure)
        const finRdv = addMinutes(debutRdv, r.duree_minutes || 30)
        if (dispo >= debutRdv && dispo < finRdv) {
          dispo = new Date(finRdv)
          const m = dispo.getMinutes()
          const r15 = 15 - (m % 15)
          if (r15 < 15) dispo = addMinutes(dispo, r15)
          dispo.setSeconds(0, 0)
        }
      }

      const attente_minutes = Math.max(0, Math.round((dispo.getTime() - currentNow.getTime()) / 60000))
      return {
        ...c,
        attente_minutes,
        nb_en_attente: rdvsFuturs.length,
        heure_dispo: format(dispo, 'HH:mm'),
        dispo_date: dispo,
      }
    })

    coiffeursAvecDispo.sort((a, b) => a.attente_minutes - b.attente_minutes)
    setCoiffeurs(coiffeursAvecDispo)
    setChargement(false)
  }, [])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 20_000)
    return () => clearInterval(t)
  }, [charger])

  useEffect(() => {
    const channel = supabase.channel('borne-rdv-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rendez_vous',
        filter: `salon_id=eq.${SALON_ID}`,
      }, () => { charger() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [charger])

  const plusRapide = coiffeurs[0] || null
  const salonVide = coiffeurs.every(c => c.nb_en_attente === 0)

  function choisirCoiffeur(c: CoiffeurAvecDispo) { setCoiffeurChoisi(c); setSansPref(false); setEtape('service') }
  function choisirSansPref() { setSansPref(true); setCoiffeurChoisi(null); setEtape('service') }

  async function inscrire() {
    const nomTrim = nom.trim()
    if (!nomTrim) return

    setEnvoi(true)
    setErreur(null)

    const coiffeurFinal = sansPref ? plusRapide : coiffeurChoisi
    const dateHeure = coiffeurFinal?.dispo_date || new Date()

    const payload: Record<string, unknown> = {
      salon_id: SALON_ID,
      client_nom: nomTrim,
      client_email: email.trim() || '',
      client_telephone: telephone.trim() || '',
      service,
      date_heure: dateHeure.toISOString(),
      duree_minutes: DUREE[service] || 30,
      statut: 'confirme',
      coiffeur_id: coiffeurFinal?.id || null,
      coiffeur_nom: coiffeurFinal?.nom || null,
    }

    const { data, error } = await supabase
      .from('rendez_vous')
      .insert(payload)
      .select()
      .single()

    setEnvoi(false)

    if (error || !data) {
      console.error('Supabase insert error:', error)
      setErreur(`Erreur : ${error?.message || "Impossible d'enregistrer"}`)
      return
    }

    if (email.trim()) {
      fetch('/api/email-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: nomTrim,
          client_email: email.trim(),
          service,
          date_heure: dateHeure.toISOString(),
          coiffeur_nom: coiffeurFinal?.nom || null,
        }),
      }).catch(() => {})
    }

    const rdvsAvant = rdvsDuJour.filter(
      r => new Date(r.date_heure) < dateHeure && (!coiffeurFinal || r.coiffeur_id === coiffeurFinal.id)
    ).length

    setTicket({
      id: data.id,
      nom: nomTrim,
      service,
      coiffeur_nom: coiffeurFinal?.nom || 'Premier disponible',
      coiffeur_id: coiffeurFinal?.id || null,
      heure: format(dateHeure, 'HH:mm'),
      position: rdvsAvant + 1,
      attente_minutes: coiffeurFinal?.attente_minutes || 0,
    })
    setEtape('ticket')

    setTimeout(() => charger(), 800)
  }

  function reset() {
    setEtape('coiffeurs'); setCoiffeurChoisi(null); setSansPref(false)
    setService('Coupe homme'); setNom(''); setEmail(''); setTelephone('')
    setTicket(null); setErreur(null); setVueFile('global')
    charger()
  }

  function formatAttente(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60); const m = minutes % 60
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
  }

  function statutLabel(c: CoiffeurAvecDispo): { label: string; color: string; dot: string } {
    if (c.attente_minutes === 0) return { label: 'Disponible maintenant', color: '#065f46', dot: '#10b981' }
    if (c.attente_minutes <= 15) return { label: `Disponible dans ${formatAttente(c.attente_minutes)}`, color: '#065f46', dot: '#10b981' }
    return { label: `Disponible à ${c.heure_dispo}`, color: '#92400e', dot: '#f59e0b' }
  }

  function rdvsFiltrés() {
    const now = getNow()
    const futurs = rdvsDuJour.filter(r => new Date(r.date_heure) >= now)
    return vueFile === 'global' ? futurs : futurs.filter(r => r.coiffeur_id === vueFile)
  }

  function rdvsFiltrésAccueil() {
    const now = getNow()
    const futurs = rdvsDuJour.filter(r => new Date(r.date_heure) >= now)
    return vueFileAccueil === 'global' ? futurs : futurs.filter(r => r.coiffeur_id === vueFileAccueil)
  }

  if (chargement) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ✅ Bloquer la réservation si le salon est fermé
  if (salonFerme) return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
      <div style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: 20, padding: '40px 32px', textAlign: 'center', maxWidth: 360 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#1c1917' }}>Salon fermé</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#a8a29e' }}>Les réservations ne sont pas disponibles pour le moment. Revenez pendant les heures d'ouverture.</p>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-stone-50 pb-10" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { font-family: 'Noto Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        .fade { animation: fadeUp .3s ease both; }
        .dot-live { animation: blink 2s ease-in-out infinite; }
        .btn-main { width:100%; padding:12px; border-radius:14px; background:#1c1917; color:white; border:none; font-size:14px; font-weight:500; cursor:pointer; transition:background .15s; font-family:'Noto Sans',sans-serif; }
        .btn-main:hover { background:#292524; }
        .btn-main:disabled { opacity:.45; cursor:default; }
        .btn-sec { width:100%; padding:12px; border-radius:14px; background:transparent; color:#78716c; border:1px solid #e7e5e4; font-size:13px; cursor:pointer; transition:background .15s; font-family:'Noto Sans',sans-serif; }
        .btn-sec:hover { background:#f5f5f4; }
        .card { background:white; border:1px solid #e7e5e4; border-radius:18px; padding:16px; display:flex; flex-direction:column; gap:12px; }
        .card:hover { border-color:#d6d3d1; }
        input, select { font-family:'Noto Sans',sans-serif; }
        .inp { width:100%; padding:12px 16px; border-radius:14px; border:1px solid #e7e5e4; font-size:14px; color:#1c1917; background:white; outline:none; box-sizing:border-box; }
        .inp:focus { border-color:#a8a29e; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e7e5e4', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917' }}>Salon Éclat</p>
            <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>{format(getNow(), "EEEE d MMMM · HH'h'mm", { locale: fr })}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dot-live" style={{ width: 7, height: 7, borderRadius: '50%', background: salonVide ? '#10b981' : '#f59e0b', display: 'block' }} />
            <span style={{ fontSize: 12, color: '#78716c' }}>
              {salonVide ? 'Aucune attente' : `${rdvsDuJour.length} RDV aujourd'hui`}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px' }}>

        {/* CHOIX COIFFEUR */}
        {etape === 'coiffeurs' && (
          <div className="fade">
            {salonVide && (
              <div style={{ marginTop: 16, marginBottom: 4, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#15803d' }}>Aucune attente — passez directement !</p>
              </div>
            )}
            <p style={{ margin: '20px 0 12px', fontSize: 13, color: '#a8a29e', fontWeight: 500 }}>Choisissez votre coiffeur</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>

              {/* Sans préférence */}
              <div className="card" style={{ background: '#fafaf9', cursor: 'pointer' }} onClick={choisirSansPref}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1c1917' }}>Sans préférence</p>
                    {plusRapide && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#059669' }}>{plusRapide.nom} libre à {plusRapide.heure_dispo}</span>
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#a8a29e', borderTop: '1px solid #f5f5f4', paddingTop: 10 }}>On vous attribue le coiffeur le plus rapidement disponible.</p>
                <button className="btn-main">Choisir cette option</button>
              </div>

              {/* Coiffeurs */}
              {coiffeurs.map(c => {
                const col = pc(c.couleur || '#8b5cf6')
                const statut = statutLabel(c)
                const barreW = Math.min(100, Math.round((c.nb_en_attente / 5) * 100))
                return (
                  <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => choisirCoiffeur(c)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: col.text, flexShrink: 0 }}>
                        {c.nom.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1c1917' }}>{c.nom}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span className="dot-live" style={{ width: 7, height: 7, borderRadius: '50%', background: statut.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: statut.color }}>{statut.label}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #f5f5f4', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#a8a29e' }}>En attente</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{c.nb_en_attente} personne{c.nb_en_attente > 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#a8a29e' }}>Temps estimé</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{c.attente_minutes === 0 ? 'Maintenant' : `~${formatAttente(c.attente_minutes)}`}</span>
                      </div>
                      <div style={{ width: '100%', height: 3, background: '#f5f5f4', borderRadius: 99, marginTop: 2 }}>
                        <div style={{ width: `${barreW}%`, height: 3, background: statut.dot, borderRadius: 99, transition: 'width .3s' }} />
                      </div>
                    </div>
                    <button className="btn-main" onClick={e => { e.stopPropagation(); choisirCoiffeur(c) }}>Réserver</button>
                  </div>
                )
              })}
            </div>

            {/* File d'attente accueil */}
            {rdvsDuJour.length > 0 && (
              <div style={{ marginTop: 20, background: 'white', border: '1px solid #e7e5e4', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ borderBottom: '1px solid #f5f5f4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>File d'attente</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#a8a29e' }}>
                      <span className="dot-live" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'block' }} />live
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', overflowX: 'auto' }}>
                    <button onClick={() => setVueFileAccueil('global')} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: vueFileAccueil === 'global' ? '1.5px solid #1c1917' : '1px solid #e7e5e4', background: vueFileAccueil === 'global' ? '#1c1917' : 'white', color: vueFileAccueil === 'global' ? 'white' : '#78716c', fontFamily: "'Noto Sans',sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>Tous</button>
                    {coiffeurs.map(c => {
                      const col = pc(c.couleur || '#8b5cf6'); const actif = vueFileAccueil === c.id
                      return (
                        <button key={c.id} onClick={() => setVueFileAccueil(c.id)} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: actif ? `1.5px solid ${c.couleur || '#8b5cf6'}` : '1px solid #e7e5e4', background: actif ? col.bg : 'white', color: actif ? col.text : '#78716c', fontFamily: "'Noto Sans',sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {c.nom}{c.nb_en_attente > 0 && <span style={{ marginLeft: 5, background: c.couleur || '#8b5cf6', color: 'white', borderRadius: 99, fontSize: 10, padding: '1px 5px' }}>{c.nb_en_attente}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {rdvsFiltrésAccueil().length === 0 ? (
                    <p style={{ margin: 0, padding: '16px', fontSize: 13, color: '#a8a29e', textAlign: 'center' }}>Aucune personne en attente</p>
                  ) : rdvsFiltrésAccueil().map((r, index) => {
                    const c = coiffeurs.find(c => c.id === r.coiffeur_id); const col = pc(c?.couleur || '#8b5cf6')
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f5f5f4' }}>
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: '#d6d3d1', width: 20, flexShrink: 0, textAlign: 'right' }}>{index + 1}</span>
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: '#a8a29e', width: 36, flexShrink: 0 }}>{format(parseISO(r.date_heure), 'HH:mm')}</span>
                        <span style={{ fontSize: 13, flex: 1, fontWeight: 500, color: '#57534e' }}>{r.client_nom}</span>
                        {c && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: col.bg, color: col.text }}>{c.nom}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHOIX SERVICE */}
        {etape === 'service' && (
          <div className="fade" style={{ marginTop: 24 }}>
            <button onClick={() => setEtape('coiffeurs')} style={{ fontSize: 12, color: '#a8a29e', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Noto Sans',sans-serif" }}>← Retour</button>
            <div style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              {coiffeurChoisi ? (
                <>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: pc(coiffeurChoisi.couleur || '#8b5cf6').bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, color: pc(coiffeurChoisi.couleur || '#8b5cf6').text }}>{coiffeurChoisi.nom.charAt(0).toUpperCase()}</div>
                  <div><p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1c1917' }}>{coiffeurChoisi.nom}</p><p style={{ margin: 0, fontSize: 11, color: '#a8a29e' }}>Disponible à {coiffeurChoisi.heure_dispo}</p></div>
                </>
              ) : (
                <>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  </div>
                  <div><p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1c1917' }}>Sans préférence</p><p style={{ margin: 0, fontSize: 11, color: '#a8a29e' }}>{plusRapide?.nom} sera attribué</p></div>
                </>
              )}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#a8a29e', fontWeight: 500 }}>Quel service ?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {SERVICES.map(s => (
                <button key={s} onClick={() => setService(s)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', border: service === s ? '1.5px solid #1c1917' : '1px solid #e7e5e4', background: service === s ? '#1c1917' : 'white', color: service === s ? 'white' : '#1c1917', fontSize: 13, fontWeight: service === s ? 500 : 400, transition: 'all .15s', fontFamily: "'Noto Sans',sans-serif" }}>
                  <span>{s}</span>
                  <span style={{ fontSize: 11, opacity: .65, fontFamily: "'DM Mono',monospace" }}>~{DUREE[s]}min</span>
                </button>
              ))}
            </div>
            <button className="btn-main" onClick={() => setEtape('nom')}>Continuer</button>
          </div>
        )}

        {/* PRÉNOM + CONTACT */}
        {etape === 'nom' && (
          <div className="fade" style={{ marginTop: 24 }}>
            <button onClick={() => setEtape('service')} style={{ fontSize: 12, color: '#a8a29e', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, fontFamily: "'Noto Sans',sans-serif" }}>← Retour</button>
            <div style={{ background: '#f5f5f4', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>Réservation</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 500, color: '#1c1917' }}>{service} · {coiffeurChoisi?.nom || plusRapide?.nom || '—'}</p>
              </div>
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: '#1c1917' }}>{coiffeurChoisi?.heure_dispo || plusRapide?.heure_dispo || '—'}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#a8a29e', fontWeight: 500 }}>Prénom *</p>
                <input type="text" className="inp" placeholder="Votre prénom" value={nom} autoFocus onChange={e => setNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && !envoi && nom.trim() && inscrire()} />
              </div>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#a8a29e', fontWeight: 500 }}>Email <span style={{ fontWeight: 400, opacity: .7 }}>(optionnel)</span></p>
                <input type="email" className="inp" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#a8a29e', fontWeight: 500 }}>Téléphone <span style={{ fontWeight: 400, opacity: .7 }}>(optionnel)</span></p>
                <input type="tel" className="inp" placeholder="06 00 00 00 00" value={telephone} onChange={e => setTelephone(e.target.value)} />
              </div>
            </div>

            {erreur && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>{erreur}</p>
              </div>
            )}
            <button className="btn-main" onClick={inscrire} disabled={!nom.trim() || envoi}>
              {envoi ? 'En cours...' : 'Confirmer'}
            </button>
          </div>
        )}

        {/* TICKET */}
        {etape === 'ticket' && ticket && (
          <div className="fade" style={{ marginTop: 20 }}>
            <div style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 0 #d6d3d1', marginBottom: 12 }}>
              <div style={{ background: '#1c1917', padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Votre numéro</p>
                <p style={{ margin: 0, fontSize: 72, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: 'white', lineHeight: 1 }}>#{String(ticket.position).padStart(2, '0')}</p>
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#a8a29e' }}>{ticket.nom}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: -12, width: 24, height: 24, borderRadius: '50%', background: '#f5f5f4', border: '1px solid #e7e5e4' }} />
                <div style={{ flex: 1, borderTop: '2px dashed #e7e5e4', margin: '0 16px' }} />
                <div style={{ position: 'absolute', right: -12, width: 24, height: 24, borderRadius: '50%', background: '#f5f5f4', border: '1px solid #e7e5e4' }} />
              </div>
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {[
                    { label: 'Service', val: ticket.service },
                    { label: 'Coiffeur', val: ticket.coiffeur_nom },
                    { label: 'Heure estimée', val: ticket.heure, mono: true, big: true },
                    { label: 'Personnes devant', val: String(Math.max(0, ticket.position - 1)), mono: true, big: true },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ margin: 0, fontSize: 11, color: '#a8a29e' }}>{item.label}</p>
                      <p style={{ margin: '2px 0 0', fontWeight: 500, color: '#1c1917', fontSize: item.big ? 22 : 13, fontFamily: item.mono ? "'DM Mono',monospace" : "'Noto Sans',sans-serif" }}>{item.val}</p>
                    </div>
                  ))}
                </div>
                {ticket.attente_minutes > 0 && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12, padding: '10px 14px', textAlign: 'center', marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 500 }}>Temps d'attente estimé : ~{formatAttente(ticket.attente_minutes)}</p>
                  </div>
                )}
                <div style={{ background: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#78716c', fontWeight: 500 }}>Restez dans le salon — votre prénom sera appelé</p>
                </div>
              </div>
            </div>

            {/* File d'attente */}
            <div style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ borderBottom: '1px solid #f5f5f4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 10px' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>File d'attente</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#a8a29e' }}>
                    <span className="dot-live" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'block' }} />live
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', overflowX: 'auto' }}>
                  <button onClick={() => setVueFile('global')} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: vueFile === 'global' ? '1.5px solid #1c1917' : '1px solid #e7e5e4', background: vueFile === 'global' ? '#1c1917' : 'white', color: vueFile === 'global' ? 'white' : '#78716c', fontFamily: "'Noto Sans',sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>Tous</button>
                  {coiffeurs.map(c => {
                    const col = pc(c.couleur || '#8b5cf6'); const actif = vueFile === c.id
                    return (
                      <button key={c.id} onClick={() => setVueFile(c.id)} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: actif ? `1.5px solid ${c.couleur || '#8b5cf6'}` : '1px solid #e7e5e4', background: actif ? col.bg : 'white', color: actif ? col.text : '#78716c', fontFamily: "'Noto Sans',sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>{c.nom}</button>
                    )
                  })}
                </div>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {rdvsFiltrés().length === 0 ? (
                  <p style={{ margin: 0, padding: '20px 16px', fontSize: 13, color: '#a8a29e', textAlign: 'center' }}>Aucune personne en attente</p>
                ) : rdvsFiltrés().map((r, index) => {
                  const c = coiffeurs.find(c => c.id === r.coiffeur_id); const col = pc(c?.couleur || '#8b5cf6')
                  const isMe = r.id === ticket.id
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f5f5f4', background: isMe ? '#1c1917' : 'white' }}>
                      <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: isMe ? '#a8a29e' : '#d6d3d1', width: 20, flexShrink: 0, textAlign: 'right' }}>{index + 1}</span>
                      <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: '#a8a29e', width: 36, flexShrink: 0 }}>{format(parseISO(r.date_heure), 'HH:mm')}</span>
                      <span style={{ fontSize: 13, flex: 1, fontWeight: isMe ? 600 : 500, color: isMe ? 'white' : '#57534e' }}>{r.client_nom}{isMe ? ' ← vous' : ''}</span>
                      {c && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: isMe ? 'rgba(255,255,255,0.15)' : col.bg, color: isMe ? 'white' : col.text }}>{c.nom}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            <button className="btn-sec" onClick={reset}>Nouvelle inscription</button>
          </div>
        )}
      </div>
    </main>
  )
}