"use client";

import { motion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

const LANGS = [
  { name: "Python", ext: ".py", color: "#3572A5" },
  { name: "Java", ext: ".java", color: "#B07219" },
];

export default function LanguagesSection() {
  return (
    <section className="bg-gray-50 py-24 sm:py-28 relative" id="languages">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 text-center">
        <ScrollReveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/50 mb-3 block">Languages</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            Two languages. One sandbox.
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base mb-14">
            Each language compiles and executes inside a Docker container with configurable time and memory limits.
          </p>
        </ScrollReveal>

        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {LANGS.map((lang, i) => (
            <ScrollReveal key={lang.name} delay={0.05 * i}>
              <motion.div
                whileHover={{ y: -4, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-shadow cursor-default"
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lang.color }} />
                <span className="text-sm font-semibold text-gray-800">{lang.name}</span>
                <span className="text-xs font-mono text-gray-400">{lang.ext}</span>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
