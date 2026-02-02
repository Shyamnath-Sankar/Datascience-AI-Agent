'use client';

import React, { useState, useRef, useEffect } from 'react';

// Selection types
export interface SelectionState {
    type: 'cells' | 'rows' | 'columns' | 'range' | null;
    cells?: Array<{ row: number; col: string; value: any }>;
    rows?: number[];
    columns?: string[];
    range?: { startRow: number; endRow: number; startCol: string; endCol: string };
    data?: any[];
    summary?: {
        count: number;
        numericCount?: number;
        hasNulls?: boolean;
    };
}

interface InlineAIAssistantProps {
    selection: SelectionState | null;
    position: { x: number; y: number } | null;
    onClose: () => void;
    onAction: (action: string, result?: any) => void;
    onAskQuestion: (question: string, selection: SelectionState) => Promise<string>;
    isVisible: boolean;
}

const QUICK_ACTIONS = {
    columns: [
        { id: 'stats', label: '📊 Statistics', prompt: 'Show statistics for this column' },
        { id: 'distribution', label: '📉 Distribution', prompt: 'Analyze the distribution of this column' },
        { id: 'outliers', label: '🔍 Outliers', prompt: 'Detect outliers in this column' },
        { id: 'fill_missing', label: '✨ Fill Missing', prompt: 'Suggest values to fill missing data in this column' },
        { id: 'unique', label: '🏷️ Unique Values', prompt: 'Show unique values in this column' },
    ],
    rows: [
        { id: 'analyze', label: '🔍 Analyze', prompt: 'Analyze this row' },
        { id: 'similar', label: '👥 Find Similar', prompt: 'Find similar rows to this one' },
        { id: 'duplicate', label: '📋 Duplicate', prompt: 'Duplicate this row' },
    ],
    cells: [
        { id: 'explain', label: '💡 Explain', prompt: 'Explain this value' },
        { id: 'validate', label: '✅ Validate', prompt: 'Validate if this value is correct' },
    ],
    range: [
        { id: 'sum', label: '➕ Sum', prompt: 'Calculate the sum of selected values' },
        { id: 'average', label: '📊 Average', prompt: 'Calculate the average of selected values' },
        { id: 'correlate', label: '🔗 Correlate', prompt: 'Find correlation between selected columns' },
        { id: 'trend', label: '📈 Trend', prompt: 'Analyze the trend in selected data' },
    ],
};

export function InlineAIAssistant({
    selection,
    position,
    onClose,
    onAction,
    onAskQuestion,
    isVisible,
}: InlineAIAssistantProps) {
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when panel becomes visible
    useEffect(() => {
        if (isVisible && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isVisible]);

    // Reset state when selection changes
    useEffect(() => {
        setResponse('');
        setQuestion('');
    }, [selection]);

    if (!isVisible || !selection || !position) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || isLoading) return;

        setIsLoading(true);
        setResponse('');

        try {
            const result = await onAskQuestion(question, selection);
            setResponse(result);
        } catch (error) {
            setResponse('Error: Failed to get response. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = async (action: { id: string; prompt: string }) => {
        setIsLoading(true);
        setResponse('');
        setQuestion(action.prompt);

        try {
            const result = await onAskQuestion(action.prompt, selection);
            setResponse(result);
            onAction(action.id, result);
        } catch (error) {
            setResponse('Error: Failed to perform action. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getQuickActions = () => {
        const type = selection.type;
        if (!type) return [];
        return QUICK_ACTIONS[type] || [];
    };

    const getSelectionLabel = () => {
        if (!selection) return '';

        switch (selection.type) {
            case 'columns':
                return `Column: ${selection.columns?.join(', ')} (${selection.summary?.count || 0} values)`;
            case 'rows':
                return `${selection.rows?.length || 0} row(s) selected`;
            case 'cells':
                return `${selection.cells?.length || 0} cell(s) selected`;
            case 'range':
                return `Range: ${selection.range?.startCol}${selection.range?.startRow} to ${selection.range?.endCol}${selection.range?.endRow}`;
            default:
                return 'Selection';
        }
    };

    const [isExpanded, setIsExpanded] = useState(false);

    // Effect to handle visibility changes
    useEffect(() => {
        if (isVisible) {
            // Reset to collapsed/button mode when first shown
            setIsExpanded(false);
        }
    }, [isVisible, selection]);

    if (!isVisible || !selection || !position) return null;

    // Trigger Button Mode (Collapsed)
    if (!isExpanded) {
        return (
            <button
                style={{
                    position: 'fixed',
                    left: Math.min(position.x, window.innerWidth - 40),
                    top: Math.min(position.y - 40, window.innerHeight - 40),
                    zIndex: 1000,
                }}
                onClick={() => setIsExpanded(true)}
                className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-2 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-in zoom-in duration-200"
            >
                <span className="text-xl">✨</span>
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-medium whitespace-nowrap">
                    Ask AI
                </span>
            </button>
        );
    }

    // Full Panel Mode
    const panelStyle: React.CSSProperties = {
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 380),
        top: Math.min(position.y - 20, window.innerHeight - 400),
        zIndex: 1000,
    };

    return (
        <div
            ref={panelRef}
            style={panelStyle}
            className="w-[360px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <span className="font-medium text-sm">AI Assistant</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                        title="Minimize to button"
                    >
                        −
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Content */}
            <>
                {/* Selection Info */}
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                    <span className="text-xs text-slate-600 dark:text-slate-300">{getSelectionLabel()}</span>
                </div>

                {/* Quick Actions */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                    <div className="flex flex-wrap gap-1.5">
                        {getQuickActions().map((action) => (
                            <button
                                key={action.id}
                                onClick={() => handleQuickAction(action)}
                                disabled={isLoading}
                                className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 rounded-full transition-colors disabled:opacity-50"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask about this selection..."
                            disabled={isLoading}
                            className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-slate-400 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !question.trim()}
                            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                            ) : (
                                '→'
                            )}
                        </button>
                    </div>
                </form>

                {/* Response */}
                {(response || isLoading) && (
                    <div className="px-4 py-3 max-h-48 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                                <span>Thinking...</span>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                {response}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer with Apply button */}
                {response && !isLoading && (
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 flex justify-end gap-2">
                        <button
                            onClick={() => {
                                setResponse('');
                                setQuestion('');
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => onAction('apply', response)}
                            className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                )}
            </>
        </div>
    );
}

// Context Menu Component
export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    divider?: boolean;
    action?: () => void;
}

interface SelectionContextMenuProps {
    position: { x: number; y: number } | null;
    items: ContextMenuItem[];
    onClose: () => void;
    isVisible: boolean;
}

export function SelectionContextMenu({
    position,
    items,
    onClose,
    isVisible,
}: SelectionContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isVisible, onClose]);

    if (!isVisible || !position) return null;

    const menuStyle: React.CSSProperties = {
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 200),
        top: Math.min(position.y, window.innerHeight - 300),
        zIndex: 1001,
    };

    return (
        <div
            ref={menuRef}
            style={menuStyle}
            className="min-w-[180px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in zoom-in-95 duration-100"
        >
            {items.map((item, index) => (
                item.divider ? (
                    <div key={index} className="my-1 border-t border-slate-200 dark:border-slate-600" />
                ) : (
                    <button
                        key={item.id}
                        onClick={() => {
                            item.action?.();
                            onClose();
                        }}
                        className="w-full px-3 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                    >
                        {item.icon && <span>{item.icon}</span>}
                        {item.label}
                    </button>
                )
            ))}
        </div>
    );
}

export default InlineAIAssistant;
