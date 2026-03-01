"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white font-extrabold text-xs">K</span>
              </div>
              <span className="text-sm font-bold text-white">Kriterion</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs text-gray-500">
              Automated grading for programming assignments. Built by educators, for educators.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/#languages" className="hover:text-white transition-colors">Languages</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/team" className="hover:text-white transition-colors">Our Team</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 text-center text-xs text-gray-600">
          &copy; {new Date().getFullYear()} Kriterion. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
