import React from 'react';

interface MetricItem {
    label: string;
    value: string | number;
    change?: number;
    status?: 'good' | 'warning' | 'bad' | 'neutral';
    icon?: string;
}

interface MetricsCardProps {
    title?: string;
    metrics: MetricItem[];
    layout?: 'horizontal' | 'grid' | 'vertical';
    className?: string;
}

const statusColors = {
    good: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    bad: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    neutral: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800',
};

const statusIcons = {
    good: '✓',
    warning: '⚠',
    bad: '✕',
    neutral: '•',
};

export function MetricsCard({ title, metrics, layout = 'horizontal', className = '' }: MetricsCardProps) {
    const layoutClasses = {
        horizontal: 'flex flex-wrap gap-6',
        grid: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
        vertical: 'flex flex-col gap-3',
    };

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
            {title && (
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <span className="text-blue-500">📊</span>
                    {title}
                </h3>
            )}

            <div className={layoutClasses[layout]}>
                {metrics.map((metric, index) => (
                    <MetricItem key={index} {...metric} />
                ))}
            </div>
        </div>
    );
}

function MetricItem({ label, value, change, status = 'neutral', icon }: MetricItem) {
    const formattedValue = typeof value === 'number'
        ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : value;

    const changeDisplay = change !== undefined && (
        <span className={`text-xs font-medium ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </span>
    );

    return (
        <div className="flex flex-col min-w-[120px]">
            <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {label}
            </span>
            <div className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs ${statusColors[status]}`}>
                    {icon || statusIcons[status]}
                </span>
                <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    {formattedValue}
                </span>
                {changeDisplay}
            </div>
        </div>
    );
}

// Specialized metric display components

interface ModelComparisonProps {
    models: Array<{
        name: string;
        r_squared: number;
        prediction: number;
        isBest?: boolean;
    }>;
}

export function ModelComparison({ models }: ModelComparisonProps) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span>📈</span> Model Comparison
            </h3>
            <div className="space-y-2">
                {models.map((model, index) => (
                    <div
                        key={index}
                        className={`flex items-center justify-between p-2 rounded ${model.isBest
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-50 dark:bg-slate-800/50'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            {model.isBest && <span className="text-emerald-500">✓</span>}
                            <span className={`font-medium ${model.isBest ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                {model.name}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-500 dark:text-slate-400">
                                R² = <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{model.r_squared.toFixed(4)}</span>
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                                → <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{model.prediction.toLocaleString()}</span>
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface ConfidenceIntervalProps {
    lower: number;
    upper: number;
    prediction: number;
    confidence?: number;
}

export function ConfidenceInterval({ lower, upper, prediction, confidence = 95 }: ConfidenceIntervalProps) {
    const range = upper - lower;
    const predictionPosition = ((prediction - lower) / range) * 100;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span>🎯</span> {confidence}% Confidence Interval
            </h3>
            <div className="space-y-3">
                <div className="relative h-8 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    {/* Confidence interval bar */}
                    <div
                        className="absolute h-full bg-blue-200 dark:bg-blue-800"
                        style={{ left: '10%', width: '80%' }}
                    />
                    {/* Prediction marker */}
                    <div
                        className="absolute top-0 h-full w-1 bg-blue-600 dark:bg-blue-400"
                        style={{ left: `${10 + predictionPosition * 0.8}%` }}
                    />
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                        {lower.toLocaleString()}
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {prediction.toLocaleString()}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                        {upper.toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
}

interface StatisticalResultProps {
    testName: string;
    statistic: number;
    pValue: number;
    effectSize?: number;
    effectLabel?: string;
    interpretation: string;
}

export function StatisticalResult({
    testName,
    statistic,
    pValue,
    effectSize,
    effectLabel = "Effect Size",
    interpretation
}: StatisticalResultProps) {
    const isSignificant = pValue < 0.05;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span>📊</span> {testName}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Statistic</span>
                    <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {statistic.toFixed(4)}
                    </div>
                </div>
                <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">P-value</span>
                    <div className={`font-mono font-medium ${isSignificant ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {pValue.toFixed(6)}
                    </div>
                </div>
                {effectSize !== undefined && (
                    <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{effectLabel}</span>
                        <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                            {effectSize.toFixed(4)}
                        </div>
                    </div>
                )}
                <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Significance</span>
                    <div className={`font-medium ${isSignificant ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isSignificant ? '✓ Significant' : '○ Not Significant'}
                    </div>
                </div>
            </div>
            <div className={`p-2 rounded text-sm ${isSignificant ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'}`}>
                {interpretation}
            </div>
        </div>
    );
}

export default MetricsCard;
