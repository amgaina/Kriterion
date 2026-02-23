"use client";

import { Code2, Shield, BarChart3, Clock, Cpu, AlertTriangle } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const FEATURES = [
  {
    icon: <Cpu className="w-5 h-5" />,
    title: "Sandboxed Execution",
    desc: "Every submission runs in an isolated Docker container — no security risks, no system access.",
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
  },
  {
    icon: <Code2 className="w-5 h-5" />,
    title: "Multi-Language",
    desc: "Python, Java, C++, C#, and JavaScript with per-language compilation and runtime handling.",
    color: "bg-violet-50 text-violet-600 border-violet-100",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Auto-Grading",
    desc: "Test-case driven evaluation with rubric scoring. Grades appear the moment code is submitted.",
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    title: "Plagiarism Detection",
    desc: "JPlag's Greedy String Tiling finds copied code and automatically flags suspicious pairs.",
    color: "bg-red-50 text-red-600 border-red-100",
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: "Real-Time Feedback",
    desc: "Students see compilation results and test output instantly — no waiting for manual review.",
    color: "bg-amber-50 text-amber-600 border-amber-100",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Role-Based Access",
    desc: "Admin, Faculty, and Student roles each get purpose-built dashboards with permission checks.",
    color: "bg-blue-50 text-blue-600 border-blue-100",
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-white py-24 sm:py-32 relative" id="features">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <ScrollReveal>
          <div className="max-w-2xl mb-14">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/50 mb-3 block">Features</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
              Everything you need to grade code at scale.
            </h2>
            <p className="text-gray-500 text-base">
              Built for CS departments that want to automate the tedious parts without losing control.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={i} delay={0.06 * i}>
              <div className="group rounded-2xl border border-gray-100 p-6 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
                <div className={`w-10 h-10 rounded-xl ${f.color} border flex items-center justify-center mb-4`}>
                  {f.icon}
                </div>
                <h3 className="text-[15px] font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
