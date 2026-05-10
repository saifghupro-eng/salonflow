export default function PolitiqueConfidentialite() {
  return (
    <main className="min-h-screen bg-stone-50 p-4" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div className="max-w-lg mx-auto py-6">

        <a href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors mb-6 inline-block">
          ← Retour
        </a>

        <h1 className="text-2xl font-medium text-stone-800 mb-1">Politique de confidentialité</h1>
        <p className="text-stone-400 text-sm mb-8">Dernière mise à jour : 10 mai 2025</p>

        <div className="space-y-4">

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Responsable du traitement</h2>
            <p className="text-sm text-stone-600">
              [TON PRÉNOM NOM] — ADRESSE_SALON — contact@nomsalon.fr
            </p>
            <p className="text-sm text-stone-500 mt-2">
              Ce site est utilisé dans un cadre expérimental pour le salon NOM_SALON.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Données collectées</h2>
            <p className="text-sm text-stone-600 mb-2">
              Dans le cadre de la prise de rendez-vous, les données suivantes sont collectées :
            </p>
            <ul className="space-y-1 text-sm text-stone-500 list-disc list-inside">
              <li>Prénom et nom</li>
              <li>Adresse e-mail</li>
              <li>Numéro de téléphone (optionnel)</li>
              <li>Date, heure et service du rendez-vous</li>
              <li>Données de navigation (logs Vercel / Supabase)</li>
            </ul>
            <p className="text-sm text-stone-500 mt-2">Aucune donnée bancaire n'est collectée.</p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Finalités</h2>
            <ul className="space-y-1 text-sm text-stone-500 list-disc list-inside">
              <li>Gestion des rendez-vous du salon</li>
              <li>Contact en cas de modification ou d'annulation</li>
              <li>Amélioration du service dans un cadre de test</li>
            </ul>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Base légale</h2>
            <p className="text-sm text-stone-600">
              Le traitement est fondé sur votre consentement (art. 6.1.a RGPD) et sur l'exécution
              de mesures pré-contractuelles (art. 6.1.b RGPD).
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Hébergement des données</h2>
            <ul className="space-y-2 text-sm text-stone-500 list-disc list-inside">
              <li>
                <span className="text-stone-700 font-medium">Supabase Inc.</span> — base de données
                PostgreSQL (AWS, région EU)
              </li>
              <li>
                <span className="text-stone-700 font-medium">Vercel Inc.</span> — hébergement de
                l'application (San Francisco, USA)
              </li>
            </ul>
            <p className="text-sm text-stone-500 mt-2">
              Ces prestataires offrent des garanties conformes au RGPD via des clauses contractuelles types.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Durée de conservation</h2>
            <p className="text-sm text-stone-600">
              Les données sont conservées le temps nécessaire à la phase de test, et supprimées
              à l'issue de celle-ci ou à votre demande.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Vos droits</h2>
            <p className="text-sm text-stone-600 mb-2">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="space-y-1 text-sm text-stone-500 list-disc list-inside">
              <li>Accès, rectification et effacement de vos données</li>
              <li>Limitation et opposition au traitement</li>
              <li>Portabilité de vos données</li>
            </ul>
            <p className="text-sm text-stone-500 mt-3">
              Pour exercer vos droits :{' '}
              <a href="mailto:contact@nomsalon.fr" className="underline hover:text-stone-700">
                contact@nomsalon.fr
              </a>
            </p>
            <p className="text-sm text-stone-500 mt-1">
              Vous pouvez également contacter la{' '}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer"
                className="underline hover:text-stone-700">CNIL</a>.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Cookies</h2>
            <p className="text-sm text-stone-600">
              Ce site utilise uniquement des cookies techniques nécessaires à son fonctionnement.
              Aucun cookie publicitaire ou de tracking tiers n'est utilisé.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}