/**
 * GradingEnhancements.tsx
 * 
 * Enhanced components for the grading page:
 * 1. RubricGrader - Rubric-based grading with auto-calculation
 * 2. TestDataCreator - Create test cases in the grading view
 * 3. TerminalInputComponent - Enhanced terminal with input at top
 * 4. ScrollableTestResults - Virtualized, scrollable test results display
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    Plus,
    X,
    Upload,
    Trash2,
    FileCode,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    AlertCircle,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// ============================================================================
// 1. RUBRIC GRADER - Auto-calculating rubric scores
// ============================================================================

interface RubricItemScore {
    itemId: number;
    name: string;
    description?: string;
    weight: number;
    maxPoints: number;
    earnedPoints: number;
    override?: number;
}

interface RubricGraderProps {
    rubricItems: RubricItemScore[];
    mode: 'weight' | 'points';
    maxScore: number;
    onScoreChange: (itemId: number, score: number) => void;
    onTotalScoreChange: (total: number) => void;
    onCalculate?: () => void;
}

export const RubricGrader: React.FC<RubricGraderProps> = ({
    rubricItems,
    mode,
    maxScore,
    onScoreChange,
    onTotalScoreChange,
    onCalculate,
}) => {
    // Calculate total automatically based on mode
    const calculatedTotal = useMemo(() => {
        if (mode === 'points') {
            // Sum all earned points
            return rubricItems.reduce((sum, item) => sum + (item.override ?? item.earnedPoints), 0);
        } else {
            // Weight mode: (earned / max) * weight, then sum
            return rubricItems.reduce((sum, item) => {
                const percentage = item.maxPoints > 0 ? (item.override ?? item.earnedPoints) / item.maxPoints : 0;
                return sum + ((item.weight / 100) * maxScore * percentage);
            }, 0);
        }
    }, [rubricItems, mode, maxScore]);

    useEffect(() => {
        onTotalScoreChange(calculatedTotal);
    }, [calculatedTotal, onTotalScoreChange]);

    return (
        <div className="space-y-3">
            {/* Rubric Items - Clean and focused */}
            <div className="space-y-2">
                {rubricItems.map((item) => {
                    const displayScore = item.override !== undefined ? item.override : item.earnedPoints;
                    const percentage = item.maxPoints > 0 ? (displayScore / item.maxPoints) * 100 : 0;

                    return (
                        <div
                            key={item.itemId}
                            className="bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] p-3 hover:border-[#505050] transition-colors"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[12px] font-semibold text-[#d4d4d4]">{item.name}</p>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3c3c3c] text-[#858585] shrink-0">
                                            {mode === 'weight' ? `${item.weight}%` : `${item.maxPoints} pts`}
                                        </span>
                                    </div>
                                </div>

                                {/* Score input */}
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={displayScore}
                                            onChange={(e) => onScoreChange(item.itemId, parseFloat(e.target.value) || 0)}
                                            step="0.5"
                                            min="0"
                                            max={item.maxPoints}
                                            className="w-14 bg-[#252526] border border-[#505050] rounded px-2 py-1.5 text-[12px] font-medium text-[#d4d4d4] text-center focus:outline-none focus:ring-1 focus:ring-[#862733] focus:border-[#862733]"
                                        />
                                        <span className="text-[11px] text-[#858585] w-10 text-left">/{item.maxPoints}</span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-24 h-1.5 bg-[#333] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${percentage >= 80
                                                ? 'bg-[#4ec9b0]'
                                                : percentage >= 60
                                                    ? 'bg-[#dcdcaa]'
                                                    : percentage > 0
                                                        ? 'bg-[#f44747]'
                                                        : 'bg-[#505050]'
                                                }`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Info tooltip and Calculate button */}
            <div className="space-y-2.5">
                <div className="text-[10px] text-[#858585] bg-[#0c0c0c] border border-[#3c3c3c] rounded-lg p-2.5">
                    {mode === 'weight' ? (
                        <div>
                            <strong className="text-[#cccccc]"> Weighted Mode:</strong> Score = (earned/max) × weight × total score
                        </div>
                    ) : (
                        <div>
                            <strong className="text-[#cccccc]"> Points Mode:</strong> Score = sum of all earned points
                        </div>
                    )}
                </div>
                {onCalculate && (
                    <button
                        onClick={onCalculate}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-[#862733] to-[#a83d4a] hover:from-[#9d3340] hover:to-[#b94a55] text-white text-[12px] font-semibold rounded-lg border border-[#c85060]/50 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        <span> Calculate Total Score</span>
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// 2. TEST DATA CREATOR - Create test cases from grading view
// ============================================================================

interface TestDataCreatorProps {
    assignmentId: number;
    onTestCaseAdded: (testCase: any) => Promise<void>;
}

interface InputOutputFile {
    filename: string;
    content: string;
}

export const TestDataCreator: React.FC<TestDataCreatorProps> = ({ assignmentId, onTestCaseAdded }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputMode, setInputMode] = useState<'stdin' | 'file'>('stdin');
    const [outputMode, setOutputMode] = useState<'stdout' | 'files'>('stdout');
    const [testName, setTestName] = useState('');
    const [testDescription, setTestDescription] = useState('');
    const [stdinData, setStdinData] = useState('');
    const [expectedStdout, setExpectedStdout] = useState('');
    const [isHidden, setIsHidden] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputFileRef = useRef<HTMLInputElement>(null);
    const outputFileRef = useRef<HTMLInputElement>(null);
    const [inputFiles, setInputFiles] = useState<InputOutputFile[]>([]);
    const [outputFiles, setOutputFiles] = useState<InputOutputFile[]>([]);

    const handleAddInputFile = () => {
        inputFileRef.current?.click();
    };

    const handleInputFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = (ev.target?.result ?? '') as string;
                setInputFiles(prev => [...prev, { filename: file.name, content }]);
            };
            reader.readAsText(file);
        }
        if (inputFileRef.current) inputFileRef.current.value = '';
    };

    const handleAddOutputFile = () => {
        outputFileRef.current?.click();
    };

    const handleOutputFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = (ev.target?.result ?? '') as string;
                setOutputFiles(prev => [...prev, { filename: file.name, content }]);
            };
            reader.readAsText(file);
        }
        if (outputFileRef.current) outputFileRef.current.value = '';
    };

    const handleAddTestCase = async () => {
        if (!testName.trim()) {
            alert('Please enter a test case name');
            return;
        }

        // Validate input
        if (inputMode === 'stdin' && !stdinData.trim()) {
            alert('Please enter stdin or switch to file mode');
            return;
        }
        if (inputMode === 'file' && inputFiles.length === 0) {
            alert('Please add input files');
            return;
        }

        // Validate output
        if (outputMode === 'stdout' && !expectedStdout.trim()) {
            alert('Please enter expected stdout or switch to files mode');
            return;
        }
        if (outputMode === 'files' && outputFiles.length === 0) {
            alert('Please add output files');
            return;
        }

        setLoading(true);
        try {
            const payload: any = {
                name: testName.trim(),
                description: testDescription.trim() || undefined,
                input_type: inputMode,
                output_type: outputMode,
                is_hidden: isHidden,
            };

            // Handle input
            if (inputMode === 'stdin') {
                payload.input_data = stdinData;
            } else {
                payload.input_files = inputFiles.map(f => ({
                    filename: f.filename,
                    content_base64: btoa(f.content),
                }));
            }

            // Handle output
            if (outputMode === 'stdout') {
                payload.expected_output = expectedStdout;
            } else {
                payload.output_files = outputFiles.map(f => ({
                    filename: f.filename,
                    content_base64: btoa(f.content),
                }));
            }

            await onTestCaseAdded(payload);

            // Reset form and close dialog only on success
            setTestName('');
            setTestDescription('');
            setStdinData('');
            setExpectedStdout('');
            setIsHidden(false);
            setInputFiles([]);
            setOutputFiles([]);
            setIsOpen(false);
        } catch (err) {
            console.error('Error adding test case:', err);
            alert('Error adding test case');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setIsOpen(false);
        setTestName('');
        setTestDescription('');
        setStdinData('');
        setExpectedStdout('');
        setInputFiles([]);
        setOutputFiles([]);
        setIsHidden(false);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-[#3c3c3c] text-[#858585] hover:border-[#862733] hover:text-[#cccccc] transition-colors text-[11px] font-medium"
            >
                <Plus className="w-4 h-4" />
                Add Test Case
            </button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="bg-[#1e1e1e] border border-[#3c3c3c] max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-[#d4d4d4]">Add Test Case</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[65vh] overflow-y-auto">
                    {/* Test name */}
                    <div>
                        <label className="text-[10px] text-[#858585] uppercase tracking-wider mb-1 block">
                            Test Name *
                        </label>
                        <input
                            type="text"
                            value={testName}
                            onChange={(e) => setTestName(e.target.value)}
                            placeholder="e.g., Test Case 1"
                            className="w-full bg-[#252526] border border-[#3c3c3c] rounded px-3 py-2 text-[11px] text-[#d4d4d4] placeholder-[#505050] focus:outline-none focus:border-[#862733]"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] text-[#858585] uppercase tracking-wider mb-1 block">
                            Description (optional)
                        </label>
                        <textarea
                            value={testDescription}
                            onChange={(e) => setTestDescription(e.target.value)}
                            placeholder="Describe test case purpose..."
                            rows={2}
                            className="w-full bg-[#252526] border border-[#3c3c3c] rounded px-3 py-2 text-[11px] text-[#d4d4d4] placeholder-[#505050] focus:outline-none focus:border-[#862733] resize-none"
                        />
                    </div>

                    {/* INPUT SECTION */}
                    <div className="border-t border-[#3c3c3c] pt-3">
                        <label className="text-[10px] font-semibold text-[#cccccc] uppercase tracking-wider mb-2 block">
                            📥 Input Configuration
                        </label>

                        {/* Input mode toggle */}
                        <div className="flex gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setInputMode('stdin');
                                    setInputFiles([]);
                                }}
                                className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${inputMode === 'stdin'
                                    ? 'bg-[#862733]/30 border border-[#862733] text-[#cccccc]'
                                    : 'bg-[#252526] border border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                    }`}
                            >
                                Stdin
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setInputMode('file');
                                    setStdinData('');
                                }}
                                className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${inputMode === 'file'
                                    ? 'bg-[#862733]/30 border border-[#862733] text-[#cccccc]'
                                    : 'bg-[#252526] border border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                    }`}
                            >
                                Files
                            </button>
                        </div>

                        {/* Input content */}
                        {inputMode === 'stdin' ? (
                            <div>
                                <textarea
                                    value={stdinData}
                                    onChange={(e) => setStdinData(e.target.value)}
                                    placeholder="Enter stdin input..."
                                    rows={3}
                                    className="w-full bg-[#252526] border border-[#3c3c3c] rounded px-3 py-2 text-[11px] text-[#d4d4d4] placeholder-[#505050] focus:outline-none focus:border-[#862733] font-mono resize-none"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={handleAddInputFile}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-[#3c3c3c] text-[#858585] hover:border-[#862733] hover:text-[#d4d4d4] transition-colors text-[11px]"
                                >
                                    <Upload className="w-4 h-4" />
                                    Add Input File(s)
                                </button>
                                <input
                                    ref={inputFileRef}
                                    type="file"
                                    multiple
                                    hidden
                                    onChange={handleInputFileSelect}
                                />
                                {inputFiles.length > 0 && (
                                    <div className="space-y-1">
                                        {inputFiles.map((f, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded bg-[#252526] border border-[#3c3c3c]">
                                                <span className="text-[10px] text-[#cccccc] font-mono truncate">{f.filename}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setInputFiles(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-[#858585] hover:text-[#f44747]"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* OUTPUT SECTION */}
                    <div className="border-t border-[#3c3c3c] pt-3">
                        <label className="text-[10px] font-semibold text-[#cccccc] uppercase tracking-wider mb-2 block">
                            📤 Expected Output Configuration
                        </label>

                        {/* Output mode toggle */}
                        <div className="flex gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setOutputMode('stdout');
                                    setOutputFiles([]);
                                }}
                                className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${outputMode === 'stdout'
                                    ? 'bg-[#862733]/30 border border-[#862733] text-[#cccccc]'
                                    : 'bg-[#252526] border border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                    }`}
                            >
                                Stdout
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setOutputMode('files');
                                    setExpectedStdout('');
                                }}
                                className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${outputMode === 'files'
                                    ? 'bg-[#862733]/30 border border-[#862733] text-[#cccccc]'
                                    : 'bg-[#252526] border border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                    }`}
                            >
                                Files
                            </button>
                        </div>

                        {/* Output content */}
                        {outputMode === 'stdout' ? (
                            <div>
                                <textarea
                                    value={expectedStdout}
                                    onChange={(e) => setExpectedStdout(e.target.value)}
                                    placeholder="Enter expected stdout..."
                                    rows={3}
                                    className="w-full bg-[#252526] border border-[#3c3c3c] rounded px-3 py-2 text-[11px] text-[#d4d4d4] placeholder-[#505050] focus:outline-none focus:border-[#862733] font-mono resize-none"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={handleAddOutputFile}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-[#3c3c3c] text-[#858585] hover:border-[#862733] hover:text-[#d4d4d4] transition-colors text-[11px]"
                                >
                                    <Upload className="w-4 h-4" />
                                    Add Output File(s)
                                </button>
                                <input
                                    ref={outputFileRef}
                                    type="file"
                                    multiple
                                    hidden
                                    onChange={handleOutputFileSelect}
                                />
                                {outputFiles.length > 0 && (
                                    <div className="space-y-1">
                                        {outputFiles.map((f, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded bg-[#252526] border border-[#3c3c3c]">
                                                <span className="text-[10px] text-[#cccccc] font-mono truncate">{f.filename}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setOutputFiles(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-[#858585] hover:text-[#f44747]"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Options */}
                    <div className="flex items-center gap-2 border-t border-[#3c3c3c] pt-3">
                        <input
                            type="checkbox"
                            id="is_hidden"
                            checked={isHidden}
                            onChange={(e) => setIsHidden(e.target.checked)}
                            className="w-3 h-3 rounded bg-[#252526] border border-[#505050]"
                        />
                        <label
                            htmlFor="is_hidden"
                            className="text-[10px] text-[#858585] cursor-pointer"
                        >
                            🔒 Hidden from students
                        </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2 border-t border-[#3c3c3c]">
                        <button
                            onClick={handleAddTestCase}
                            disabled={loading || !testName.trim()}
                            className="flex-1 py-2 px-3 rounded bg-gradient-to-r from-[#862733] to-[#a83d4a] hover:from-[#9d3340] hover:to-[#b94a55] disabled:opacity-50 text-white border border-[#c85060]/50 text-[11px] font-medium transition-all"
                        >
                            {loading ? 'Adding...' : '➕ Add Test Case'}
                        </button>
                        <button
                            onClick={resetForm}
                            className="flex-1 py-2 px-3 rounded bg-[#3c3c3c] border border-[#3c3c3c] text-[#858585] hover:bg-[#505050] text-[11px] font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

// ============================================================================
// 3. TERMINAL INPUT COMPONENT - Input at the top
// ============================================================================

interface TerminalInputComponentProps {
    isRunning: boolean;
    onSubmit: (input: string) => void;
    output: any[];
    outputEndRef: React.RefObject<HTMLDivElement>;
}

export const TerminalInputComponent: React.FC<TerminalInputComponentProps> = ({
    isRunning,
    onSubmit,
    output,
    outputEndRef,
}) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col min-h-0 flex-1 bg-[#0c0c0c] rounded-lg border border-[#3c3c3c] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-3 py-2 bg-gradient-to-r from-[#1e1e1e] to-[#252526] border-b border-[#3c3c3c]">
                <div className="flex items-center gap-2">
                    <div className="text-[10px] font-semibold text-[#858585] uppercase tracking-wider">💻 Interactive Terminal</div>
                    <div className="flex-1" />
                    {isRunning && (
                        <span className="text-[10px] text-[#4ec9b0] font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#4ec9b0] rounded-full animate-pulse" />
                            Running
                        </span>
                    )}
                </div>
            </div>

            {/* Output area - scrollable with best UI */}
            <div
                className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-[13px] leading-[1.6] space-y-0"
                role="log"
                aria-label="Terminal output"
            >
                {output.length === 0 && !isRunning && (
                    <div className="text-[#505050] text-[12px] space-y-2">
                        <p>💡 Click "Run" to start the program.</p>
                        <p>When the program asks for input, type in the box below and press Enter.</p>
                    </div>
                )}
                {output.length === 0 && isRunning && (
                    <p className="text-[#569cd6] text-[12px] animate-pulse">Waiting for output...</p>
                )}
                {output.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-words">
                        {line.type === 'stdout' && <span className="text-[#d4d4d4]">{line.text}</span>}
                        {line.type === 'stderr' && <span className="text-[#f44747]">{line.text}</span>}
                        {line.type === 'input' && (
                            <>
                                <span className="text-[#862733] select-none">{'>'} </span>
                                <span className="text-[#858585]">{line.text}</span>
                            </>
                        )}
                        {line.type === 'exit' && (
                            <div className="mt-2 pt-2 border-t border-[#3c3c3c]">
                                <span className="text-[#858585] text-[12px] flex items-center gap-1">
                                    ✓ Process exited with code <span className="font-semibold">{line.code ?? '?'}</span>
                                </span>
                            </div>
                        )}
                        {line.type === 'error' && <span className="text-[#f44747]">{line.text}</span>}
                    </div>
                ))}
                <div ref={outputEndRef} />
            </div>

            {/* Input box at BOTTOM */}
            <div className="shrink-0 border-t border-[#3c3c3c] bg-[#1a1a1e] px-4 py-3">
                <div className="flex items-center gap-2 bg-[#252526] border border-[#3c3c3c] rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-[#862733] focus-within:border-[#862733] transition-all">
                    <span className="text-[#862733] select-none shrink-0 font-mono text-[13px] font-bold">{'>'}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (isRunning && inputValue.length > 0) {
                                    onSubmit(inputValue);
                                    setInputValue('');
                                    inputRef.current?.focus();
                                }
                            }
                        }}
                        placeholder={
                            isRunning
                                ? 'Type input and press Enter...'
                                : 'Awaiting program...'
                        }
                        disabled={!isRunning}
                        className="flex-1 min-w-0 bg-transparent font-mono text-[13px] text-[#d4d4d4] placeholder-[#505050] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    {isRunning && inputValue.length > 0 && (
                        <span className="text-[10px] text-[#858585]">Press Enter</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default {
    RubricGrader,
    TestDataCreator,
    TerminalInputComponent,
};
