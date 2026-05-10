export default function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-100 py-6">
      <div className="flex justify-center items-center gap-2 text-xs text-stone-400">
        <a href="/legal/mentions-legales" className="hover:text-stone-600 transition-colors">
          Mentions légales
        </a>
        <span className="text-stone-200">|</span>
        <a href="/legal/politique-confidentialite" className="hover:text-stone-600 transition-colors">
          Confidentialité
        </a>
        <span className="text-stone-200">|</span>
        <a href="/legal/cgu" className="hover:text-stone-600 transition-colors">
          CGU
        </a>
      </div>
    </footer>
  )
}