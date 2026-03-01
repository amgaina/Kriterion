"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, BookOpen, GraduationCap } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

type Role = "admin" | "faculty" | "student";

const TABS: { id: Role; label: string; icon: React.ReactNode }[] = [
  { id: "admin", label: "Admin", icon: <Shield className="w-4 h-4" /> },
  { id: "faculty", label: "Faculty", icon: <BookOpen className="w-4 h-4" /> },
  { id: "student", label: "Student", icon: <GraduationCap className="w-4 h-4" /> },
];

const SCREENS: Record<Role, { subtitle: string; features: string[]; ui: React.ReactNode }> = {
  admin: {
    subtitle: "Manage courses, assign languages, control everything.",
    features: ["Course management", "Role assignment", "Language configuration", "Platform analytics"],
    ui: <AdminScreen />,
  },
  faculty: {
    subtitle: "Create assignments, auto-grade, and detect plagiarism.",
    features: ["Assignment builder", "Auto-grading", "Plagiarism reports", "Score override"],
    ui: <FacultyScreen />,
  },
  student: {
    subtitle: "Write code, submit, and get instant feedback.",
    features: ["VS Code editor", "Instant compilation", "Test results", "Grade tracking"],
    ui: <StudentScreen />,
  },
};

export default function DeviceShowcase() {
  const [active, setActive] = useState<Role>("faculty");
  const screen = SCREENS[active];

  return (
    <section className="bg-gray-950 py-24 sm:py-32 relative overflow-hidden" id="showcase">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-400 mb-3 block">See It in Action</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Three Roles. One Platform.
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          {/* Tab bar */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-white/[0.06] border border-white/[0.08] rounded-xl p-1">
              {TABS.map((tab) => {
                const isActive = active === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActive(tab.id)}
                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "text-white" : "text-white/40 hover:text-white/60"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="showcase-tab"
                        className="absolute inset-0 bg-primary rounded-lg shadow-lg shadow-primary/30"
                        transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                      />
                    )}
                    <span className="relative z-10">{tab.icon}</span>
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        {/* MacBook */}
        <ScrollReveal delay={0.2}>
          <div className="max-w-5xl mx-auto">
            <div className="relative bg-gray-900 rounded-t-2xl border border-white/[0.06] border-b-0 p-2 sm:p-2.5">
              <div className="absolute top-[7px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/[0.06]" />
              <div className="rounded-lg overflow-hidden bg-[#0d0d14] aspect-[16/10] relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 p-3 sm:p-5"
                  >
                    {screen.ui}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div className="h-3 sm:h-4 bg-gradient-to-b from-gray-800 to-gray-850 rounded-b-lg border border-t-0 border-white/[0.06]" />
            <div className="h-1 bg-gray-800 rounded-b-2xl mx-[18%] border border-t-0 border-white/[0.04]" />
          </div>
        </ScrollReveal>

        {/* Feature chips + subtitle */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-10 text-center"
          >
            <p className="text-white/40 text-sm mb-4 max-w-md mx-auto">{screen.subtitle}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {screen.features.map((f) => (
                <span key={f} className="text-xs font-medium text-white/50 bg-white/[0.05] border border-white/[0.08] rounded-full px-3.5 py-1.5">
                  {f}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ---- Mock screens ---- */

function Pill({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div className={`px-2.5 py-1 rounded text-[10px] sm:text-[11px] font-medium truncate cursor-default ${active ? "bg-white/10 text-white/70" : "text-white/25"}`}>
      {children}
    </div>
  );
}

function AdminScreen() {
  return (
    <div className="h-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-cyan-500/20 flex items-center justify-center"><Shield className="w-3 h-3 text-cyan-400" /></div>
          <span className="text-white/60 text-[11px] sm:text-xs font-semibold">Admin Panel</span>
        </div>
        <div className="flex gap-1.5">
          <Pill active>Courses</Pill><Pill>Users</Pill><Pill>Settings</Pill>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 flex-shrink-0">
        {[
          { label: "Courses", val: "12", color: "text-cyan-400" },
          { label: "Faculty", val: "8", color: "text-violet-400" },
          { label: "Students", val: "214", color: "text-emerald-400" },
          { label: "Languages", val: "5", color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 sm:p-3 text-center">
            <div className={`text-base sm:text-lg font-bold ${s.color}`}>{s.val}</div>
            <div className="text-[9px] sm:text-[10px] text-white/25">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 overflow-hidden">
        <div className="text-[10px] text-white/25 font-semibold uppercase tracking-wider mb-2">Active Courses</div>
        {["CS 101 - Intro to Programming", "CS 201 - Data Structures", "CS 301 - Algorithms", "CS 401 - Software Engineering"].map((c, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
            <span className="text-[10px] sm:text-[11px] text-white/40">{c}</span>
            <span className="text-[9px] text-white/15">Python, Java</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FacultyScreen() {
  return (
    <div className="h-full flex gap-2.5">
      <div className="w-40 sm:w-48 shrink-0 bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 flex flex-col">
        <div className="text-[10px] text-white/25 font-semibold uppercase tracking-wider mb-2 px-1">Assignments</div>
        {["HW1 - Fibonacci", "HW2 - Sorting", "HW3 - Linked Lists", "Lab - Binary Search"].map((a, i) => (
          <Pill key={a} active={i === 0}>{a}</Pill>
        ))}
        <div className="mt-auto pt-2 border-t border-white/[0.04]">
          <div className="text-[10px] text-primary-400 font-medium px-2.5 py-1 cursor-default">+ New Assignment</div>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-[11px] sm:text-xs font-semibold">HW1 - Fibonacci</span>
          <span className="text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Published</span>
        </div>
        <div className="flex-1 bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 overflow-hidden">
          <div className="text-[10px] text-white/25 font-semibold uppercase tracking-wider mb-2">Student Submissions</div>
          {[
            { name: "Alex M.", score: "95/100", flag: false },
            { name: "Sara K.", score: "88/100", flag: false },
            { name: "John D.", score: "72/100", flag: true },
            { name: "Priya R.", score: "92/100", flag: false },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
              <span className="text-[10px] sm:text-[11px] text-white/40">{s.name}</span>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-white/30 font-mono">{s.score}</span>
                {s.flag && <span className="text-[9px] font-semibold text-red-400">Flagged</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
            <div className="text-sm sm:text-base font-bold text-white">86.8</div>
            <div className="text-[9px] text-white/20">Avg</div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
            <div className="text-sm sm:text-base font-bold text-emerald-400">31</div>
            <div className="text-[9px] text-white/20">Graded</div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
            <div className="text-sm sm:text-base font-bold text-red-400">1</div>
            <div className="text-[9px] text-white/20">Flagged</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentScreen() {
  return (
    <div className="h-full flex gap-2.5">
      <div className="w-28 sm:w-36 shrink-0 bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 flex flex-col">
        <div className="text-[10px] text-white/25 font-semibold uppercase tracking-wider mb-2 px-1">Explorer</div>
        <Pill active>main.py</Pill>
        <Pill>utils.py</Pill>
        <Pill>tests/</Pill>
      </div>
      <div className="flex-1 flex flex-col gap-2.5">
        <div className="flex-1 bg-[#1e1e2e] border border-white/[0.04] rounded-lg overflow-hidden">
          <div className="flex items-center px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.04]">
            <span className="text-[10px] text-emerald-400/80 font-medium">main.py</span>
          </div>
          <div className="p-3 font-mono text-[10px] sm:text-[11px] leading-[18px] text-[#cdd6f4]">
            <div><span className="text-white/15 mr-2 select-none">1</span><span className="text-[#cba6f7]">def</span> <span className="text-[#89b4fa]">quicksort</span>(arr):</div>
            <div><span className="text-white/15 mr-2 select-none">2</span>    <span className="text-[#cba6f7]">if</span> len(arr) &lt;= <span className="text-[#fab387]">1</span>:</div>
            <div><span className="text-white/15 mr-2 select-none">3</span>        <span className="text-[#cba6f7]">return</span> arr</div>
            <div><span className="text-white/15 mr-2 select-none">4</span>    pivot = arr[<span className="text-[#fab387]">0</span>]</div>
            <div><span className="text-white/15 mr-2 select-none">5</span>    left = [x <span className="text-[#cba6f7]">for</span> x <span className="text-[#cba6f7]">in</span> arr[<span className="text-[#fab387]">1</span>:] <span className="text-[#cba6f7]">if</span> x &lt; pivot]</div>
            <div><span className="text-white/15 mr-2 select-none">6</span>    right = [x <span className="text-[#cba6f7]">for</span> x <span className="text-[#cba6f7]">in</span> arr[<span className="text-[#fab387]">1</span>:] <span className="text-[#cba6f7]">if</span> x &gt;= pivot]</div>
            <div><span className="text-white/15 mr-2 select-none">7</span>    <span className="text-[#cba6f7]">return</span> quicksort(left) + [pivot] + quicksort(right)</div>
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/25 font-semibold">Test Results</span>
            <span className="text-[9px] text-emerald-400 font-semibold">3/3 Passed</span>
          </div>
          {["sort([3,1,2]) → [1,2,3]", "sort([]) → []", "sort([5,5]) → [5,5]"].map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-white/30 py-0.5">
              <span className="text-emerald-400">✓</span><span className="font-mono">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
