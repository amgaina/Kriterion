"use client";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import PageTransition from "@/components/landing/PageTransition";
import { Github, Linkedin, Mail } from "lucide-react";

const TEAM = [
  {
    name: "Abhishek Amgain",
    role: "Team Lead & Head Programmer",
    bio: "Architects the full-stack platform end-to-end - backend API design, grading engine, sandbox orchestration, and frontend integration.",
    initials: "AA",
    gradient: "from-primary to-red-600",
  },
  {
    name: "Aryan Mainali",
    role: "System Lead",
    bio: "Manages infrastructure, Docker environments, CI/CD pipelines, and deployment. Keeps the platform reliable and production-ready.",
    initials: "AM",
    gradient: "from-violet-600 to-purple-700",
  },
  {
    name: "Sulav Dhakal",
    role: "UI Lead",
    bio: "Crafts the visual identity - component systems, responsive layouts, and interaction design. Every pixel is purposeful.",
    initials: "SD",
    gradient: "from-emerald-600 to-teal-700",
  },
  {
    name: "Niraj Tulachan",
    role: "Frontend Lead & Documentation",
    bio: "Builds interactive client-side features and maintains comprehensive project documentation. Bridges design and engineering.",
    initials: "NT",
    gradient: "from-amber-600 to-orange-700",
  },
];

export default function TeamPage() {
  return (
    <PageTransition>
      <main className="min-h-screen bg-white">
        <Navbar />

        {/* Hero */}
        <section className="pt-28 pb-16 sm:pt-36 sm:pb-20 px-5 sm:px-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2 -translate-x-1/4" />
          <div className="relative max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/50 mb-3 block">Who We Are</span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight mb-5">
                Our Team
              </h1>
              <p className="text-gray-500 max-w-lg mx-auto text-base sm:text-lg">
                Four engineers building the grading platform every CS department deserves.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Cards */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-24 sm:pb-32">
          <div className="grid sm:grid-cols-2 gap-5">
            {TEAM.map((member, i) => (
              <ScrollReveal key={member.name} delay={0.08 * i}>
                <div className="group rounded-2xl border border-gray-100 p-6 sm:p-7 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/60 transition-all duration-300">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${member.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                      <span className="text-white font-extrabold text-sm">{member.initials}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{member.name}</h3>
                      <p className="text-xs font-medium text-gray-400">{member.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-5">{member.bio}</p>
                  <div className="flex items-center gap-2">
                    {[Github, Linkedin, Mail].map((Icon, j) => (
                      <a
                        key={j}
                        href="#"
                        className="w-8 h-8 rounded-lg border border-gray-100 flex items-center justify-center text-gray-300 hover:text-gray-600 hover:border-gray-200 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </a>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Values */}
          <ScrollReveal delay={0.2}>
            <div className="mt-20 rounded-2xl bg-gray-50 border border-gray-100 p-8 sm:p-10">
              <h3 className="text-lg font-bold text-gray-900 mb-6">What Drives Us</h3>
              <div className="grid sm:grid-cols-3 gap-6">
                {[
                  { title: "Automate the tedious", desc: "Professors should teach, not compare output strings. We automate the mechanical so humans focus on what matters." },
                  { title: "Security-first execution", desc: "Student code is untrusted by default. Every submission runs in an isolated container with strict resource limits." },
                  { title: "Transparency", desc: "Students see exactly why they got their score - test results, error output, and rubric breakdowns." },
                ].map((v) => (
                  <div key={v.title}>
                    <h4 className="text-sm font-bold text-gray-900 mb-1.5">{v.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>

        <Footer />
      </main>
    </PageTransition>
  );
}
