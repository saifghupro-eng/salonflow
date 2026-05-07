export type Salon = {
  id: string
  nom: string
  email: string
  telephone: string
  adresse: string
}

export type Horaire = {
  id: string
  salon_id: string
  jour_semaine: number
  heure_ouverture: string
  heure_fermeture: string
  est_ferme: boolean
}

export type Coiffeur = {
  id: string
  salon_id: string
  nom: string
  couleur: string
  actif: boolean
}

export type RendezVous = {
  id: string
  salon_id: string
  client_nom: string
  client_email: string
  client_telephone: string
  service: string
  duree_minutes: number
  date_heure: string
  statut: string
  coiffeur_id: string | null
  coiffeur_nom: string | null
}

export type Creneau = {
  heure: string
  disponible: boolean
  coiffeur_id?: string
}