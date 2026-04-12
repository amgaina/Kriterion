'use client';

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

/* ====================================================================
   TYPES
   ==================================================================== */

export type InteractiveLine =
    | { type: 'stdout'; text: string }
    | { type: 'stderr'; text: string }
    | { type: 'input'; text: string }
    | { type: 'exit'; text: string; code?: number }
    | { type: 'error'; text: string };

export interface InteractiveTerminalProps {
    output: InteractiveLine[];
    running: boolean;
    exitCode: number | null;
    onSendStdin: (line: string) => void;
    outputEndRef?: React.RefObject<HTMLDivElement | null>;
    emptyMessage?: string;
    placeholder?: string;
    className?: string;
    minHeight?: string;
    maxHeight?: string;
}

export interface InteractiveTerminalRef {
    focusInput: () => void;
}

/* ====================================================================
   COMPONENT – Student-style: single scroll area, output + inline prompt + input
   ==================================================================== */

const InteractiveTerminalInner = forwardRef<InteractiveTerminalRef, InteractiveTerminalProps>(
    (
        {
            output,
            running,
            exitCode,
            onSendStdin,
            outputEndRef: outputEndRefProp,
            emptyMessage = 'Click Run Code to start. When the program asks for input, type below and press Enter.',
            placeholder = 'Press "Run Code" to start, then type when program asks...',
            className = '',
            minHeight = '220px',
            maxHeight = '50vh',
        },
        ref
    ) => {
        const [inputLine, setInputLine] = React.useState('');
        const inputRef = useRef<HTMLInputElement>(null);
        const localOutputEndRef = useRef<HTMLDivElement>(null);
        const outputEndRef = outputEndRefProp ?? localOutputEndRef;
        const scrollContainerRef = useRef<HTMLDivElement | null>(null);

        useImperativeHandle(ref, () => ({
            focusInput: () => inputRef.current?.focus(),
        }), []);

        useEffect(() => {
            const container = scrollContainerRef.current;
            if (!container) return;
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distanceFromBottom <= 80) {
                container.scrollTop = container.scrollHeight;
            }
        }, [output]);

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const t = inputLine;
                if (running) {
                    onSendStdin(t);
                    inputRef.current?.focus();
                }
                setInputLine('');
            }
        };

        return (
            <div
                className={`flex flex-col min-h-0 flex-1 rounded-lg border border-[#3c3c3c] bg-[#0c0c0c] overflow-hidden ${className}`}
                style={{ minHeight, maxHeight }}
            >
                <div
                    ref={scrollContainerRef}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2 font-mono text-[12px] leading-relaxed"
                    role="log"
                    aria-label="Terminal output"
                >
                    {output.length === 0 && !running && exitCode === null && (
                        <p className="text-[#505050] text-[11px]">{emptyMessage}</p>
                    )}
                    {output.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-words">
                            {line.type === 'stdout' && <span className="text-[#d4d4d4]">{line.text}</span>}
                            {line.type === 'stderr' && <span className="text-[#f44747]">{line.text}</span>}
                            {line.type === 'input' && (
                                <>
                                    <span className="text-[#4ec9b0] select-none">{'>'} </span>
                                    <span className="text-[#858585]">{line.text}</span>
                                </>
                            )}
                            {line.type === 'exit' && (
                                <span className="text-[#858585] text-[11px]">
                                    Process exited with code {line.code ?? '?'}
                                </span>
                            )}
                            {line.type === 'error' && <span className="text-[#f44747]">{line.text}</span>}
                        </div>
                    ))}
                    <div className="whitespace-pre-wrap break-words flex items-center gap-1 mt-1">
                        <span className="text-[#4ec9b0] select-none">{'>'}</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputLine}
                            onChange={(e) => setInputLine(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={running ? '' : placeholder}
                            className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono text-[12px] text-[#d4d4d4] placeholder-[#505050]"
                            spellCheck={false}
                            aria-label="Interactive terminal input"
                        />
                    </div>
                    <div ref={outputEndRef} />
                </div>
            </div>
        );
    }
);

InteractiveTerminalInner.displayName = 'InteractiveTerminal';

export const InteractiveTerminal = InteractiveTerminalInner;
