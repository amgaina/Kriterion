'use client';

import React from 'react';
import { BookOpen, FileCode, ShieldCheck, Search, ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { helpGuides, HelpGuide } from '@/lib/help-guides';

const guideStyles: Record<HelpGuide['key'], { bg: string; icon: React.ReactNode }> = {
    student: {
        bg: 'from-[#862733] via-[#4a1d2a] to-[#122c4c]',
        icon: <BookOpen className="w-8 h-8 text-white" />,
    },
    faculty: {
        bg: 'from-[#7a1f2b] via-[#3d2237] to-[#1a3d5a]',
        icon: <FileCode className="w-8 h-8 text-white" />,
    },
    admin: {
        bg: 'from-[#6f1c28] via-[#33253f] to-[#13415f]',
        icon: <ShieldCheck className="w-8 h-8 text-white" />,
    },
    documentation: {
        bg: 'from-[#5b2d12] via-[#4a2c2a] to-[#1f3f5a]',
        icon: <FileText className="w-8 h-8 text-white" />,
    },
};

export default function HelpPage() {
    const [query, setQuery] = React.useState('');

    const normalizedQuery = query.trim().toLowerCase();
    const visibleGuides = React.useMemo(() => {
        if (!normalizedQuery) {
            return helpGuides.map((guide) => ({
                guide,
                matchedScenarios: guide.scenarios,
            }));
        }

        return helpGuides
            .map((guide) => {
                const matchedScenarios = guide.scenarios.filter((scenario) => {
                    const haystack = [
                        scenario.category,
                        scenario.title,
                        scenario.summary,
                        scenario.useCaseRef,
                        ...scenario.keywords,
                        ...scenario.instructions,
                    ]
                        .join(' ')
                        .toLowerCase();

                    return haystack.includes(normalizedQuery);
                });

                return {
                    guide,
                    matchedScenarios,
                };
            })
            .filter(({ matchedScenarios }) => matchedScenarios.length > 0);
    }, [normalizedQuery]);

    const directoryGuides = React.useMemo(
        () => visibleGuides.filter(({ guide }) => guide.key !== 'documentation'),
        [visibleGuides]
    );

    return (
        <div className="max-w-6xl mx-auto">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-6 sm:px-8 sm:py-8 bg-gradient-to-r from-slate-50 to-white border-b border-gray-200">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Knowledge Base Directory</h1>
                    <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-3xl">
                        Search by scenario, then open the guide that matches your workflow. Topics are mapped from the student, faculty, and administrator use cases.
                    </p>

                    <div className="mt-5 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search scenarios like submit assignment, override grade, audit logs..."
                            className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#862733]"
                        />
                    </div>
                </div>

                <div className="p-5 sm:p-8">
                    {directoryGuides.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                            <p className="text-lg font-semibold text-gray-900">No scenarios match your search</p>
                            <p className="mt-2 text-sm text-gray-600">Try terms like grading, schedule, users, audit logs, or publish assignment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                            {directoryGuides.map(({ guide, matchedScenarios }) => {
                                const style = guideStyles[guide.key];
                                const scenarioCount = normalizedQuery ? matchedScenarios.length : guide.scenarios.length;

                                return (
                                    <div key={guide.key} className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                                        <div className={`px-5 py-4 bg-gradient-to-r ${style.bg} relative`}>
                                            <div className="absolute right-0 top-0 h-full w-20 bg-white/5" />
                                            <div className="flex items-center justify-between relative z-10">
                                                {style.icon}
                                                <span className="text-xs font-semibold text-white/90 bg-white/10 px-2.5 py-1 rounded-full">
                                                    {scenarioCount} topics
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-5">
                                            <h2 className="text-xl font-bold text-gray-900">{guide.title}</h2>
                                            <p className="text-sm text-gray-500 mt-1">{guide.subtitle}</p>
                                            <p className="text-sm text-gray-600 mt-3 leading-relaxed min-h-[48px]">{guide.description}</p>

                                            <div className="mt-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Top matched scenarios</p>
                                                <ul className="space-y-1.5">
                                                    {(normalizedQuery ? matchedScenarios : guide.scenarios).slice(0, 3).map((scenario) => (
                                                        <li key={scenario.id} className="text-sm text-gray-700 truncate">
                                                            {scenario.title}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <Link
                                                href={`/help/${guide.key}`}
                                                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#862733] hover:text-[#6a1f28]"
                                            >
                                                Open Guide
                                                <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-8 rounded-2xl border border-[#d8c3a8] bg-gradient-to-r from-[#fdf7ef] to-[#f7efe5] p-5 sm:p-6">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 rounded-lg bg-[#5b2d12]/10 p-2">
                                <FileText className="w-5 h-5 text-[#5b2d12]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-xl font-bold text-gray-900">Documentation Standards Hub</h2>
                                <p className="mt-1 text-sm text-gray-700 max-w-4xl">
                                    This is the real project handover section: what the system does today, how it is deployed, how grading flows work,
                                    which APIs and settings matter, and what instructors/admins need to run and support it.
                                </p>

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-gray-700">
                                    <div className="rounded-lg border border-[#e6d8c6] bg-white/80 px-3 py-2">What is implemented now and for which roles</div>
                                    <div className="rounded-lg border border-[#e6d8c6] bg-white/80 px-3 py-2">Architecture, API routes, storage, queue, and sandbox</div>
                                    <div className="rounded-lg border border-[#e6d8c6] bg-white/80 px-3 py-2">Deployment/env setup, run commands, and incident basics</div>
                                    <div className="rounded-lg border border-[#e6d8c6] bg-white/80 px-3 py-2">UAT checklist, release notes, and final handover pack</div>
                                </div>

                                <Link
                                    href="/help/documentation"
                                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#5b2d12] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a240f]"
                                >
                                    Open Documentation Guide
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}