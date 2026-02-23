"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative bg-white overflow-hidden">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #862733 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Gradient blob */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 border border-primary/15 bg-primary/[0.04] rounded-full px-4 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-primary/80 tracking-wide">
                Automated Code Grading
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-6"
          >
            Stop grading code
            <br />
            <span className="text-primary">by hand.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-500 max-w-xl leading-relaxed mb-10"
          >
            Kriterion compiles, executes, and grades student code in sandboxed containers — with plagiarism detection, rubric scoring, and instant feedback.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold text-sm px-7 py-3.5 rounded-xl hover:bg-primary-800 transition-all shadow-lg shadow-primary/20"
            >
              Start for Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/how-it-works"
              className="group inline-flex items-center justify-center gap-2 bg-gray-50 text-gray-700 font-semibold text-sm px-7 py-3.5 rounded-xl hover:bg-gray-100 border border-gray-200 transition-all"
            >
              <Play className="w-3.5 h-3.5 text-primary" />
              How It Works
            </Link>
          </motion.div>
        </div>

        {/* Code card floating on the right (desktop) */}
        <motion.div
          initial={{ opacity: 0, x: 40, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="hidden lg:block absolute right-8 xl:right-16 top-36 w-[420px]"
        >
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 blur-xl" />
            <div className="relative bg-[#1e1e2e] rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#181825] border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f38ba8]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f9e2af]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#a6e3a1]" />
                <span className="ml-3 text-[11px] text-white/25 font-mono">fibonacci.py</span>
              </div>
              <div className="p-4 font-mono text-[12.5px] leading-[22px]">
                <CodeLine n={1}><K>def</K> <F>fibonacci</F><Y>(n: int)</Y> -&gt; int:</CodeLine>
                <CodeLine n={2}><C>    &quot;&quot;&quot;Return nth Fibonacci number.&quot;&quot;&quot;</C></CodeLine>
                <CodeLine n={3}>    <K>if</K> n &lt;= <N>1</N>:</CodeLine>
                <CodeLine n={4}>        <K>return</K> n</CodeLine>
                <CodeLine n={5}>    a, b = <N>0</N>, <N>1</N></CodeLine>
                <CodeLine n={6}>    <K>for</K> _ <K>in</K> <F>range</F>(<N>2</N>, n + <N>1</N>):</CodeLine>
                <CodeLine n={7}>        a, b = b, a + b</CodeLine>
                <CodeLine n={8}>    <K>return</K> b</CodeLine>
              </div>
              <div className="border-t border-white/5 px-4 py-2.5 bg-[#181825]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#a6e3a1] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#a6e3a1]" />
                    3/3 tests passed
                  </span>
                  <span className="text-white/20">Score: 100/100</span>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute -bottom-5 -left-5 bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <span className="text-green-600 text-xs font-bold">A+</span>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-900">Auto-Graded</div>
                  <div className="text-[10px] text-gray-400">0.8s execution</div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Trusted-by strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-20 lg:mt-28 flex flex-wrap items-center gap-8 text-gray-300"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Built with</span>
          {["Next.js", "FastAPI", "PostgreSQL", "Docker", "Celery"].map((t) => (
            <span key={t} className="text-sm font-semibold text-gray-300">{t}</span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CodeLine({ n, children }: { n: number; children?: React.ReactNode }) {
  return (
    <div className="flex text-[#cdd6f4]">
      <span className="w-6 text-right text-white/15 mr-4 select-none text-[11px]">{n}</span>
      <span>{children}</span>
    </div>
  );
}

function K({ children }: { children: React.ReactNode }) {
  return <span className="text-[#cba6f7]">{children}</span>;
}
function F({ children }: { children: React.ReactNode }) {
  return <span className="text-[#89b4fa]">{children}</span>;
}
function Y({ children }: { children: React.ReactNode }) {
  return <span className="text-[#f9e2af]">{children}</span>;
}
function N({ children }: { children: React.ReactNode }) {
  return <span className="text-[#fab387]">{children}</span>;
}
function C({ children }: { children: React.ReactNode }) {
  return <span className="text-[#6c7086] italic">{children}</span>;
}
