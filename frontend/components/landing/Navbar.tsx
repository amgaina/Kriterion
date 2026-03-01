"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/team", label: "Team" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-extrabold text-sm">K</span>
            </div>
            <span className={`text-base font-bold tracking-tight transition-colors ${scrolled ? "text-gray-900" : "text-gray-900"}`}>
              Kriterion
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors"
                >
                  <span className={active ? "text-primary font-semibold" : "text-gray-500 hover:text-gray-900"}>
                    {link.label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 bg-primary/[0.06] rounded-lg"
                      transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Link
              href="/login"
              className="text-[13px] font-medium text-gray-500 hover:text-gray-900 px-3.5 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="text-[13px] font-semibold text-white bg-primary hover:bg-primary-800 px-5 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-5 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-primary/5 text-primary"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-gray-100 mt-2 flex gap-2">
                <Link href="/login" className="flex-1 text-center text-sm font-medium text-gray-600 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 transition-colors">
                  Sign in
                </Link>
                <Link href="/contact" className="flex-1 text-center text-sm font-semibold text-white bg-primary rounded-lg py-2.5 hover:bg-primary-800 transition-colors">
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
