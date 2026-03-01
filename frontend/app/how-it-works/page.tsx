"use client";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollReveal from "@/components/landing/ScrollReveal";
import PageTransition from "@/components/landing/PageTransition";
import { ArrowRight, ArrowDown, BookOpen, Code2, Upload, Cpu, BarChart3, Shield, Database, Server, Container, Workflow, Globe, Lock } from "lucide-react";
import Link from "next/link";

/* ---- Steps ---- */
const STEPS = [
  {
    num: "01",
    icon: <BookOpen className="w-5 h-5" />,
    title: "Professor Creates Assignment",
    desc: "Define rubrics, upload test cases, set deadlines, and choose allowed languages. Starter code and attachments are stored on S3.",
    color: "border-cyan-200 bg-cyan-50 text-cyan-600",
  },
  {
    num: "02",
    icon: <Code2 className="w-5 h-5" />,
    title: "Student Writes Code",
    desc: "An in-browser VS Code-like editor with syntax highlighting, file explorer, and multi-file support. Or just upload files directly.",
    color: "border-violet-200 bg-violet-50 text-violet-600",
  },
  {
    num: "03",
    icon: <Upload className="w-5 h-5" />,
    title: "Submission & Compilation",
    desc: "Code is sent to a Celery worker, compiled inside a sandboxed Docker container. Instant feedback: compiled successfully or full error output.",
    color: "border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  {
    num: "04",
    icon: <Cpu className="w-5 h-5" />,
    title: "Test Case Execution",
    desc: "Each test case runs against the student's code with time limits. Outputs are compared line-by-line. Partial credit is calculated automatically.",
    color: "border-amber-200 bg-amber-50 text-amber-600",
  },
  {
    num: "05",
    icon: <Shield className="w-5 h-5" />,
    title: "Plagiarism Detection",
    desc: "JPlag's Greedy String Tiling algorithm runs across all submissions. Matching code regions are identified with line numbers and similarity scores.",
    color: "border-red-200 bg-red-50 text-red-600",
  },
  {
    num: "06",
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Review & Final Grade",
    desc: "Faculty review auto-grades, run student code interactively, override scores, and publish final grades - all from one unified grading interface.",
    color: "border-blue-200 bg-blue-50 text-blue-600",
  },
];

/* ---- Tech stack ---- */
const TECH = [
  {
    layer: "Frontend",
    color: "border-l-blue-500",
    items: [
      { name: "Next.js 14", desc: "React framework with App Router, SSR, and file-based routing" },
      { name: "TypeScript", desc: "Type safety across all components and API calls" },
      { name: "Tailwind CSS", desc: "Utility-first CSS with shadcn/ui component library" },
      { name: "React Query", desc: "Server-state management, caching, and automatic refetching" },
    ],
  },
  {
    layer: "Backend",
    color: "border-l-emerald-500",
    items: [
      { name: "FastAPI", desc: "Async Python framework with OpenAPI docs and dependency injection" },
      { name: "SQLAlchemy", desc: "ORM with relationship loading, migrations, and PostgreSQL support" },
      { name: "Pydantic v2", desc: "Data validation and serialization for all request/response models" },
      { name: "Celery + Redis", desc: "Distributed task queue for async grading and plagiarism jobs" },
    ],
  },
  {
    layer: "Infrastructure",
    color: "border-l-amber-500",
    items: [
      { name: "Docker", desc: "Containerized services and sandboxed student code execution" },
      { name: "PostgreSQL", desc: "Primary database for courses, assignments, submissions, and grades" },
      { name: "AWS S3", desc: "Object storage for starter code, solution files, and submission artifacts" },
      { name: "JPlag", desc: "Java-based plagiarism engine using Greedy String Tiling (CLI subprocess)" },
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <PageTransition>
      <main className="min-h-screen bg-white">
        <Navbar />

        {/* Hero */}
        <section className="pt-28 pb-16 sm:pt-36 sm:pb-20 px-5 sm:px-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="relative max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/50 mb-3 block">Under the Hood</span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight mb-5">
                How Kriterion Works
              </h1>
              <p className="text-gray-500 max-w-xl mx-auto text-base sm:text-lg">
                From assignment creation to final grades - here&apos;s every step, plus the architecture powering it.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ──── WORKFLOW STEPS ──── */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-24 sm:pb-32">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-12">
              The Workflow
            </h2>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STEPS.map((step, i) => (
              <ScrollReveal key={step.num} delay={0.06 * i}>
                <div className="group h-full rounded-2xl border border-gray-100 p-6 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/60 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl border ${step.color} flex items-center justify-center`}>
                      {step.icon}
                    </div>
                    <span className="text-xs font-bold text-gray-300 tracking-widest">STEP {step.num}</span>
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ──── ARCHITECTURE DIAGRAM ──── */}
        <section className="bg-gray-950 py-24 sm:py-32 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
            <ScrollReveal>
              <div className="text-center mb-16">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-400 mb-3 block">Architecture</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                  How Everything Connects
                </h2>
                <p className="text-white/40 max-w-lg mx-auto text-sm sm:text-base">
                  A multi-tier architecture with async task processing, sandboxed execution, and cloud storage.
                </p>
              </div>
            </ScrollReveal>

            {/* The diagram */}
            <ScrollReveal delay={0.15}>
              <div className="max-w-4xl mx-auto">
                {/* Row 1: Client */}
                <ArchRow>
                  <ArchBox icon={<Globe className="w-4 h-4" />} label="Browser" sub="Next.js App" color="border-blue-500/30 bg-blue-500/5" />
                </ArchRow>
                <ArchConnector />

                {/* Row 2: API + Auth */}
                <ArchRow>
                  <ArchBox icon={<Server className="w-4 h-4" />} label="FastAPI" sub="REST API" color="border-emerald-500/30 bg-emerald-500/5" />
                  <ArchBox icon={<Lock className="w-4 h-4" />} label="Auth" sub="JWT + RBAC" color="border-yellow-500/30 bg-yellow-500/5" />
                </ArchRow>
                <ArchConnector multi />

                {/* Row 3: Workers + DB + Storage */}
                <ArchRow>
                  <ArchBox icon={<Workflow className="w-4 h-4" />} label="Celery" sub="Task Queue" color="border-green-500/30 bg-green-500/5" />
                  <ArchBox icon={<Database className="w-4 h-4" />} label="PostgreSQL" sub="Primary DB" color="border-cyan-500/30 bg-cyan-500/5" />
                  <ArchBox icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>} label="AWS S3" sub="File Storage" color="border-orange-500/30 bg-orange-500/5" />
                </ArchRow>
                <ArchConnector />

                {/* Row 4: Sandbox + JPlag */}
                <ArchRow>
                  <ArchBox icon={<Container className="w-4 h-4" />} label="Docker Sandbox" sub="Code Execution" color="border-violet-500/30 bg-violet-500/5" />
                  <ArchBox icon={<Shield className="w-4 h-4" />} label="JPlag Engine" sub="Plagiarism Detection" color="border-red-500/30 bg-red-500/5" />
                </ArchRow>
              </div>
            </ScrollReveal>

            {/* Data flow explanation */}
            <ScrollReveal delay={0.25}>
              <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {[
                  { title: "Submit → Queue", desc: "Student submits code via the API. FastAPI dispatches a Celery task with submission metadata." },
                  { title: "Queue → Sandbox", desc: "Celery worker pulls code from S3, writes it to a temp directory, and runs it inside a Docker container." },
                  { title: "Sandbox → Grade", desc: "Test results are captured, scores calculated, plagiarism checked, and the submission record is updated in PostgreSQL." },
                ].map((flow, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary-300 text-xs font-bold">{i + 1}</span>
                      <h4 className="text-sm font-bold text-white">{flow.title}</h4>
                    </div>
                    <p className="text-xs text-white/35 leading-relaxed">{flow.desc}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ──── TECH STACK ──── */}
        <section className="bg-gray-50 py-24 sm:py-32">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <ScrollReveal>
              <div className="max-w-2xl mb-14">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/50 mb-3 block">Tech Stack</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                  Tools & Technologies
                </h2>
                <p className="text-gray-500 text-base">
                  Every layer of Kriterion is built with production-grade open-source tools.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid lg:grid-cols-3 gap-6">
              {TECH.map((group, gi) => (
                <ScrollReveal key={group.layer} delay={0.1 * gi}>
                  <div className={`border-l-2 ${group.color} pl-5`}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">{group.layer}</h3>
                    <div className="space-y-4">
                      {group.items.map((item) => (
                        <div key={item.name}>
                          <div className="text-sm font-bold text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white py-20 sm:py-24 border-t border-gray-100">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                See it for yourself.
              </h2>
              <p className="text-gray-500 text-base mb-8 max-w-md mx-auto">
                Create an account and set up your first assignment in under five minutes.
              </p>
              <Link
                href="/contact"
                className="group inline-flex items-center gap-2 bg-primary text-white font-semibold text-sm px-8 py-3.5 rounded-xl hover:bg-primary-800 transition-all shadow-lg shadow-primary/20"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </ScrollReveal>
          </div>
        </section>

        <Footer />
      </main>
    </PageTransition>
  );
}

/* ---- Architecture diagram helpers ---- */

function ArchRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center gap-3 sm:gap-4">
      {children}
    </div>
  );
}

function ArchBox({ icon, label, sub, color }: { icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 ${color} min-w-[140px] sm:min-w-[160px]`}>
      <span className="text-white/60">{icon}</span>
      <div>
        <div className="text-sm font-bold text-white">{label}</div>
        <div className="text-[10px] text-white/30">{sub}</div>
      </div>
    </div>
  );
}

function ArchConnector({ multi }: { multi?: boolean }) {
  return (
    <div className="flex justify-center py-2">
      <div className="flex flex-col items-center">
        <div className="w-px h-5 bg-white/10" />
        <ArrowDown className="w-3.5 h-3.5 text-white/15" />
        {multi && (
          <div className="flex items-center gap-12 sm:gap-20 mt-0.5">
            <div className="w-px h-3 bg-white/10" />
            <div className="w-px h-3 bg-white/10" />
          </div>
        )}
      </div>
    </div>
  );
}
