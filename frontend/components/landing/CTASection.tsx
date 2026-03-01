"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

export default function CTASection() {
  return (
    <section className="bg-primary py-20 sm:py-24 relative overflow-hidden">
      {/* Subtle shapes */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.04] rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/[0.03] rounded-full translate-y-1/2 -translate-x-1/3" />

      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 text-center">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to stop grading by hand?
          </h2>
          <p className="text-white/60 text-base mb-10 max-w-lg mx-auto">
            Set up a course, create an assignment, and let Kriterion handle the rest. Five minutes to get started.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2 bg-white text-primary font-semibold text-sm px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all shadow-lg shadow-black/10"
            >
              Create Your Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border border-white/25 text-white font-medium text-sm px-8 py-3.5 rounded-xl hover:bg-white/10 transition-all"
            >
              Contact Us
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
