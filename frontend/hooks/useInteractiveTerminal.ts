'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import type { InteractiveLine } from '@/components/InteractiveTerminal';

export interface UseInteractiveTerminalOptions {
    assignmentId: number;
    onError?: (message: string) => void;
}

export function useInteractiveTerminal({ assignmentId, onError }: UseInteractiveTerminalOptions) {
    const [output, setOutput] = useState<InteractiveLine[]>([]);
    const [running, setRunning] = useState(false);
    const [exitCode, setExitCode] = useState<number | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const outputEndRef = useRef<HTMLDivElement>(null);

    const start = useCallback(
        (files: { name: string; content: string }[]) => {
            if (!files.length) return;

            setOutput([{ type: 'stdout', text: 'Starting interactive run...\n' }]);
            setExitCode(null);
            setRunning(true);

            const url = apiClient.getInteractiveRunWebSocketUrl(assignmentId);
            let ws: WebSocket;
            try {
                ws = new WebSocket(url);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to open interactive session.';
                setOutput((prev) => [...prev, { type: 'error', text: msg }]);
                setRunning(false);
                onError?.(msg);
                return;
            }
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({ action: 'start', files }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'stdout' && msg.data != null) {
                        setOutput((prev) => [...prev, { type: 'stdout', text: msg.data }]);
                    } else if (msg.type === 'stderr' && msg.data != null) {
                        setOutput((prev) => [...prev, { type: 'stderr', text: msg.data }]);
                    } else if (msg.type === 'exit') {
                        const code = typeof msg.code === 'number' ? msg.code : null;
                        setOutput((prev) => [...prev, { type: 'exit', text: '', code: code ?? undefined }]);
                        setExitCode(code);
                        setRunning(false);
                        wsRef.current = null;
                        ws.close();
                    } else if (msg.type === 'error' && msg.message) {
                        setOutput((prev) => [...prev, { type: 'error', text: msg.message }]);
                        setRunning(false);
                        wsRef.current = null;
                        ws.close();
                        onError?.(msg.message);
                    }
                } catch {
                    // ignore parse errors
                }
            };

            ws.onerror = () => {
                setOutput((prev) => [...prev, { type: 'error', text: 'WebSocket error' }]);
                setRunning(false);
                wsRef.current = null;
                onError?.('WebSocket error');
            };

            ws.onclose = () => {
                if (wsRef.current === ws) wsRef.current = null;
                setRunning((prev) => {
                    if (prev) setExitCode(-1);
                    return false;
                });
            };
        },
        [assignmentId, onError]
    );

    const sendStdin = useCallback((line: string) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ action: 'stdin', data: line }));
        setOutput((prev) => [...prev, { type: 'input', text: line }]);
    }, []);

    const close = useCallback(() => {
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch {
                // ignore
            }
            wsRef.current = null;
        }
        setRunning(false);
    }, []);

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    return { output, running, exitCode, setOutput, setExitCode, start, sendStdin, close, outputEndRef };
}
