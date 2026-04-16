'use client';

import React from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { helpGuideMap, HelpGuideKey, isHelpGuideKey } from '@/lib/help-guides';

export default function HelpGuidePage() {
    const params = useParams<{ guide: string }>();
    const guideParam = params?.guide ?? '';

    if (!isHelpGuideKey(guideParam)) {
        notFound();
    }

    const guideKey = guideParam as HelpGuideKey;
    const guide = helpGuideMap[guideKey];
    const [query, setQuery] = React.useState('');
    const [openTopics, setOpenTopics] = React.useState<Record<string, boolean>>({});

    const expandTopic = React.useCallback((topicId: string) => {
        setOpenTopics((prev) => ({
            ...prev,
            [topicId]: true,
        }));

        if (typeof window !== 'undefined') {
            const hash = `topic-${topicId}`;
            if (window.location.hash !== `#${hash}`) {
                window.history.replaceState(null, '', `#${hash}`);
            }

            // Wait for state update before scrolling to the now-expanded item.
            setTimeout(() => {
                const el = document.getElementById(hash);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 0);
        }
    }, []);

    const normalizedQuery = query.trim().toLowerCase();
    const visibleScenarios = React.useMemo(() => {
        if (!normalizedQuery) return guide.scenarios;

        return guide.scenarios.filter((scenario) => {
            const haystack = [
                scenario.category,
                scenario.title,
                scenario.summary,
                scenario.useCaseRef,
                ...scenario.keywords,
                ...scenario.instructions,
                ...(scenario.tips ?? []),
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }, [guide.scenarios, normalizedQuery]);

    const groupedScenarios = React.useMemo(() => {
        const groups = new Map<string, typeof visibleScenarios>();
        visibleScenarios.forEach((scenario) => {
            const existing = groups.get(scenario.category) ?? [];
            groups.set(scenario.category, [...existing, scenario]);
        });
        return Array.from(groups.entries());
    }, [visibleScenarios]);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const rawHash = window.location.hash.replace('#topic-', '');
        if (!rawHash) return;

        const exists = guide.scenarios.some((scenario) => scenario.id === rawHash);
        if (exists) {
            setOpenTopics((prev) => ({
                ...prev,
                [rawHash]: true,
            }));
        }
    }, [guide.scenarios]);

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-6 sm:px-8 sm:py-8 bg-gradient-to-r from-[#862733] via-[#5b2132] to-[#12324f] text-white">
                    <Link
                        href="/help"
                        className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/90 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Help Directory
                    </Link>

                    <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">{guide.title}</h1>
                    <p className="mt-2 text-sm sm:text-base text-white/90 max-w-3xl">{guide.description}</p>
                </div>

                <div className="p-5 sm:p-8 space-y-8">
                    <div className="relative mb-6">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search chapters and articles..."
                            className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#862733]"
                        />
                    </div>

                    {visibleScenarios.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                            <p className="text-lg font-semibold text-gray-900">No matching scenarios in this guide</p>
                            <p className="mt-2 text-sm text-gray-600">Try broader terms like grading, schedule, settings, or export.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-7">
                                {groupedScenarios.map(([category, scenarios]) => (
                                    <section key={category}>
                                        <h2 className="text-2xl font-bold text-gray-900">{category}</h2>
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-2">
                                            {scenarios.map((scenario) => (
                                                <button
                                                    key={`${scenario.id}-link`}
                                                    type="button"
                                                    onClick={() => expandTopic(scenario.id)}
                                                    className="text-left text-[15px] text-[#2f67ad] hover:underline"
                                                >
                                                    {scenario.title}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>

                            <div className="border-t border-gray-200 pt-6 space-y-3">
                                {visibleScenarios.map((scenario) => (
                                    <details
                                        id={`topic-${scenario.id}`}
                                        key={scenario.id}
                                        open={Boolean(openTopics[scenario.id])}
                                        onToggle={(e) => {
                                            const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                                            setOpenTopics((prev) => ({
                                                ...prev,
                                                [scenario.id]: isOpen,
                                            }));
                                        }}
                                        className="group rounded-xl border border-gray-200 bg-white open:shadow-sm scroll-mt-24"
                                    >
                                        <summary className="list-none cursor-pointer px-4 py-4 sm:px-5 sm:py-5 flex items-center gap-3">
                                            <ChevronDown className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{scenario.title}</h3>
                                                    <span className="text-xs font-semibold rounded-full bg-[#862733]/10 text-[#862733] px-2 py-0.5">
                                                        {scenario.useCaseRef}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{scenario.summary}</p>
                                            </div>
                                        </summary>

                                        <div className="px-4 pb-5 sm:px-5 sm:pb-6 border-t border-gray-100">
                                            <h4 className="mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Instructions</h4>
                                            <ol className="mt-3 space-y-2">
                                                {scenario.instructions.map((step, index) => (
                                                    <li key={`${scenario.id}-step-${index}`} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                                                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 mt-0.5">
                                                            {index + 1}
                                                        </span>
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ol>

                                            {scenario.tips && scenario.tips.length > 0 ? (
                                                <>
                                                    <h4 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-500">Helpful Notes</h4>
                                                    <ul className="mt-2 space-y-2">
                                                        {scenario.tips.map((tip, index) => (
                                                            <li key={`${scenario.id}-tip-${index}`} className="text-sm text-gray-700 leading-relaxed">
                                                                • {tip}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </>
                                            ) : null}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
