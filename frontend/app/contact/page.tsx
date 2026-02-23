"use client";

import { useState } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { Mail, MessageSquare, MapPin, Send, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CHANNELS = [
  { icon: <Mail className="w-5 h-5" />, title: "Email", detail: "support@kriterion.dev", color: "bg-cyan-50 text-cyan-600 border-cyan-100" },
  { icon: <MessageSquare className="w-5 h-5" />, title: "Live Chat", detail: "Weekdays 9–5 EST", color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { icon: <MapPin className="w-5 h-5" />, title: "Office", detail: "CS Department, Campus", color: "bg-violet-50 text-violet-600 border-violet-100" },
];

const FAQ = [
  { q: "How do I create my first course?", a: "Admins can create courses from the Admin Dashboard → Courses → New Course. Select supported languages, set the semester, and invite faculty." },
  { q: "Which programming languages are supported?", a: "Python, Java, C++, C#, and JavaScript. Each language runs inside an isolated Docker container with configurable time limits." },
  { q: "How does plagiarism detection work?", a: "Kriterion uses JPlag (Greedy String Tiling) to compare all submissions. Suspicious pairs are flagged automatically with line-level detail and similarity percentages." },
  { q: "Can faculty override auto-generated grades?", a: "Yes. Faculty can adjust individual test case scores, modify rubric grades, and override the final score from the grading interface." },
  { q: "Is student code secure?", a: "Absolutely. Every submission compiles and runs inside a sandboxed Docker container with no network access, limited memory, and strict time limits." },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-20 px-5 sm:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="relative max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/50 mb-3 block">Get in Touch</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight mb-5">
              Contact Support
            </h1>
            <p className="text-gray-500 max-w-lg mx-auto text-base sm:text-lg">
              Found a bug, need help, or have a question? We respond within 24 hours.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Channels */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 mb-20">
        <div className="grid sm:grid-cols-3 gap-4">
          {CHANNELS.map((ch, i) => (
            <ScrollReveal key={ch.title} delay={0.06 * i}>
              <div className="rounded-2xl border border-gray-100 p-5 text-center hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/60 transition-all duration-300">
                <div className={`w-10 h-10 rounded-xl border ${ch.color} flex items-center justify-center mx-auto mb-3`}>
                  {ch.icon}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-0.5">{ch.title}</h3>
                <p className="text-xs text-gray-500">{ch.detail}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Form + FAQ */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-24 sm:pb-32">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Form */}
          <ScrollReveal>
            <div className="rounded-2xl border border-gray-100 p-6 sm:p-7">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Send a Message</h2>

              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center py-14 text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
                      <Check className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Sent!</h3>
                    <p className="text-sm text-gray-500">We&apos;ll get back to you soon.</p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="space-y-4"
                  >
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input label="Name" placeholder="Your name" required />
                      <Input label="Email" type="email" placeholder="you@example.com" required />
                    </div>
                    <Input label="Subject" placeholder="What's this about?" required />
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Message</label>
                      <textarea
                        required
                        rows={5}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all resize-none"
                        placeholder="Describe your question or issue..."
                      />
                    </div>
                    <button
                      type="submit"
                      className="group w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold text-sm py-3 rounded-xl hover:bg-primary-800 transition-all shadow-lg shadow-primary/15"
                    >
                      Send Message
                      <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </ScrollReveal>

          {/* FAQ */}
          <ScrollReveal delay={0.1}>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-5">Frequently Asked Questions</h2>
              <div className="space-y-2.5">
                {FAQ.map((item, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border transition-all duration-200 ${
                        isOpen ? "border-gray-200 shadow-sm" : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
                      >
                        <span className="text-sm font-semibold text-gray-900 pr-4">{item.q}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{item.a}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">{label}</label>
      <input
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all"
        {...props}
      />
    </div>
  );
}
