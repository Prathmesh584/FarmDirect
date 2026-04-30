import Link from 'next/link'
import { Leaf, Mail, Phone } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-soil text-white/70 mt-auto">
      <div className="section py-12">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-serif text-xl text-white mb-4">
              <Leaf size={20} className="text-terra" />
              FarmDirect
            </Link>
            <p className="text-sm leading-relaxed max-w-xs">
              Connecting Bhopal&apos;s farmers directly with consumers. Fresh produce,
              fair prices, no middlemen.
            </p>
            <div className="flex flex-col gap-2 mt-5 text-sm">
              <a href="mailto:support@farmdirect.in" className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail size={14} /> support@farmdirect.in
              </a>
              <a href="tel:+917551234567" className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone size={14} /> +91 755 123 4567
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Marketplace</h4>
            <ul className="space-y-2 text-sm">
              {[
                ['Vegetables', '/marketplace?category=vegetables'],
                ['Fruits', '/marketplace?category=fruits'],
                ['Grains', '/marketplace?category=grains'],
                ['Dairy', '/marketplace?category=dairy'],
                ['Spices', '/marketplace?category=spices'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Farmer links */}
          <div>
            <h4 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Farmers</h4>
            <ul className="space-y-2 text-sm">
              {[
                ['Register as Farmer', '/auth/register?role=farmer'],
                ['Farmer Dashboard', '/dashboard'],
                ['Add Product', '/dashboard/products/new'],
                ['View Orders', '/orders'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} FarmDirect. Made with ❤ in Bhopal, Madhya Pradesh.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
