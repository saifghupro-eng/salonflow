export default function CGU() {
  return (
    <main className="min-h-screen bg-stone-50 p-4" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div className="max-w-lg mx-auto py-6">

        <a href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors mb-6 inline-block">
          ← Retour
        </a>

        <h1 className="text-2xl font-medium text-stone-800 mb-1">Conditions générales d'utilisation</h1>
        <p className="text-stone-400 text-sm mb-8">Dernière mise à jour : 10 mai 2025</p>

        <div className="space-y-4">

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Objet</h2>
            <p className="text-sm text-stone-600">
              Les présentes CGU régissent l'accès et l'utilisation du site de réservation en ligne
              de NOM_SALON, situé ADRESSE_SALON. Ce site est en phase expérimentale et n'est pas
              ouvert au public général.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Accès au site</h2>
            <p className="text-sm text-stone-600">
              L'accès au site est libre. L'utilisation du formulaire de réservation requiert la
              saisie d'un nom et d'un e-mail, utilisés uniquement pour la gestion du rendez-vous.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Utilisation acceptable</h2>
            <p className="text-sm text-stone-600 mb-2">En utilisant ce site, vous vous engagez à :</p>
            <ul className="space-y-1 text-sm text-stone-500 list-disc list-inside">
              <li>Ne pas tenter d'accéder à des données qui ne vous appartiennent pas</li>
              <li>Ne pas perturber le fonctionnement du site</li>
              <li>Ne pas utiliser le site à des fins illicites</li>
              <li>Fournir des informations exactes lors de la réservation</li>
              <li>Signaler tout bug ou dysfonctionnement</li>
            </ul>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Données personnelles</h2>
            <p className="text-sm text-stone-600">
              Le traitement de vos données est décrit dans notre{' '}
              <a href="/legal/politique-confidentialite" className="underline hover:text-stone-800">
                politique de confidentialité
              </a>.
              En utilisant le site, vous acceptez ce traitement.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Disponibilité</h2>
            <p className="text-sm text-stone-600">
              Le site est fourni « en l'état » dans le cadre d'un test. L'éditeur ne garantit pas
              une disponibilité continue et peut interrompre le service à tout moment.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Limitation de responsabilité</h2>
            <p className="text-sm text-stone-600">
              L'éditeur ne saurait être tenu responsable de tout dommage direct ou indirect résultant
              de l'utilisation ou de l'impossibilité d'utiliser ce site durant la phase de test.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Droit applicable</h2>
            <p className="text-sm text-stone-600">
              Les présentes CGU sont soumises au droit français. Tout litige relève de la compétence
              des tribunaux français.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-5 border border-stone-200">
            <h2 className="text-sm font-medium text-stone-500 mb-3">Contact</h2>
            <a href="mailto:contact@nomsalon.fr" className="text-sm text-stone-600 underline hover:text-stone-800">
              contact@nomsalon.fr
            </a>
          </section>

          <div className="bg-stone-100 rounded-2xl p-4 text-center">
            <p className="text-xs text-stone-500">
              L'utilisation du site vaut acceptation pleine et entière des présentes CGU.
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}