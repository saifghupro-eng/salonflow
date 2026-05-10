export default function MentionsLegales() {
  return (
    <main className="min-h-screen bg-stone-50 p-4" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div className="max-w-lg mx-auto py-6">

        <a href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors mb-6 inline-block">
          ← Retour
        </a>

        <h1 className="text-2xl font-medium text-stone-800 mb-1">Mentions légales</h1>
        <p className="text-stone-400 text-sm mb-8">Dernière mise à jour : 10 mai 2025</p>

        <div className="space-y-4">

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Éditeur du site</h2>
            <div className="space-y-1 text-sm text-stone-600">
              <p>Ce site est édité à titre personnel et expérimental par :</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-stone-500">
                <li>Responsable : <span className="text-stone-700">[TON PRÉNOM NOM]</span></li>
                <li>Adresse : <span className="text-stone-700">ADRESSE_SALON</span></li>
                <li>E-mail : <span className="text-stone-700">contact@nomsalon.fr</span></li>
                <li>Statut : <span className="text-stone-700">Particulier (aucune société immatriculée)</span></li>
              </ul>
              <p className="mt-2 text-stone-500">Ce site est exploité dans un cadre de test et de développement, sans activité commerciale effective.</p>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Hébergement</h2>
            <div className="space-y-1 text-sm text-stone-500">
              <p><span className="text-stone-700 font-medium">Vercel Inc.</span></p>
              <p>340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis</p>
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer"
                className="text-stone-400 underline hover:text-stone-600">vercel.com</a>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Directeur de la publication</h2>
            <p className="text-sm text-stone-600">[TON PRÉNOM NOM]</p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Propriété intellectuelle</h2>
            <p className="text-sm text-stone-600">
              L'ensemble des contenus présents sur ce site (textes, images, interfaces) est la propriété de l'éditeur.
              Toute reproduction sans autorisation est interdite.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Responsabilité</h2>
            <p className="text-sm text-stone-600">
              Ce site est fourni « en l'état » à des fins de test. L'éditeur ne saurait être tenu
              responsable des éventuelles interruptions de service ou erreurs.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Contact</h2>
            <a href="mailto:contact@nomsalon.fr" className="text-sm text-stone-600 underline hover:text-stone-800">
              contact@nomsalon.fr
            </a>
          </section>

        </div>
      </div>
    </main>
  )
}