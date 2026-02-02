import React, { useMemo } from 'react';
import { MetricsCard, ModelComparison, ConfidenceInterval, StatisticalResult } from './MetricsCard';

interface AnalysisResult {
    type: 'prediction' | 'statistics' | 'eda' | 'correlation' | 'general';
    data: Record<string, unknown>;
}

interface AnalysisPanelProps {
    result: AnalysisResult;
    className?: string;
}

export function AnalysisPanel({ result, className = '' }: AnalysisPanelProps) {
    const content = useMemo(() => {
        switch (result.type) {
            case 'prediction':
                return <PredictionAnalysis data={result.data} />;
            case 'statistics':
                return <StatisticsAnalysis data={result.data} />;
            case 'eda':
                return <EDAAnalysis data={result.data} />;
            case 'correlation':
                return <CorrelationAnalysis data={result.data} />;
            default:
                return <GeneralAnalysis data={result.data} />;
        }
    }, [result]);

    return (
        <div className={`space-y-4 ${className}`}>
            {content}
        </div>
    );
}

// Prediction Analysis Component
function PredictionAnalysis({ data }: { data: Record<string, unknown> }) {
    const models = data.models as Record<string, { r_squared: number; prediction: number }> | undefined;
    const bestModel = data.best_model as string | undefined;
    const prediction = data.prediction as number | undefined;
    const confidenceInterval = data.confidence_interval as [number, number] | undefined;
    const entity = data.entity as string | undefined;
    const targetYear = data.target_year as number | undefined;
    const quality = data.quality as string | undefined;

    const modelList = models ? Object.entries(models).map(([name, stats]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        r_squared: stats.r_squared,
        prediction: stats.prediction,
        isBest: name === bestModel
    })) : [];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Prediction Analysis</h2>
                        <p className="text-blue-100 text-sm">
                            {entity && `${entity} • `}
                            {targetYear && `Target: ${targetYear}`}
                        </p>
                    </div>
                    {quality && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${quality === 'excellent' ? 'bg-emerald-400/20 text-white' :
                                quality === 'good' ? 'bg-blue-400/20 text-white' :
                                    quality === 'moderate' ? 'bg-amber-400/20 text-white' :
                                        'bg-red-400/20 text-white'
                            }`}>
                            {quality.toUpperCase()} FIT
                        </span>
                    )}
                </div>
            </div>

            {/* Main Prediction */}
            {prediction !== undefined && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-blue-500 p-6 text-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Predicted Value</span>
                    <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                        {prediction.toLocaleString()}
                    </div>
                    {bestModel && (
                        <span className="text-sm text-blue-500">using {bestModel} regression</span>
                    )}
                </div>
            )}

            {/* Model Comparison */}
            {modelList.length > 0 && <ModelComparison models={modelList} />}

            {/* Confidence Interval */}
            {confidenceInterval && prediction !== undefined && (
                <ConfidenceInterval
                    lower={confidenceInterval[0]}
                    upper={confidenceInterval[1]}
                    prediction={prediction}
                />
            )}
        </div>
    );
}

// Statistics Analysis Component
function StatisticsAnalysis({ data }: { data: Record<string, unknown> }) {
    const testName = data.test as string || 'Statistical Test';
    const statistic = data.statistic as number || data.t_statistic as number || data.chi2_statistic as number || 0;
    const pValue = data.p_value as number || 0;
    const effectSize = data.cohens_d as number || data.cramers_v as number || data.eta_squared as number;
    const interpretation = data.interpretation as string || '';
    const significant = data.significant as boolean;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg p-4">
                <h2 className="text-lg font-semibold">Statistical Analysis</h2>
                <p className="text-emerald-100 text-sm">{testName}</p>
            </div>

            {/* Result Card */}
            <StatisticalResult
                testName={testName}
                statistic={statistic}
                pValue={pValue}
                effectSize={effectSize}
                interpretation={interpretation}
            />

            {/* Quick Summary */}
            <div className={`p-4 rounded-lg ${significant
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }`}>
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{significant ? '✅' : '⏸️'}</span>
                    <div>
                        <div className={`font-semibold ${significant ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                            {significant ? 'Statistically Significant' : 'Not Statistically Significant'}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            p-value {pValue < 0.05 ? '<' : '≥'} 0.05
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// EDA Analysis Component
function EDAAnalysis({ data }: { data: Record<string, unknown> }) {
    const overview = data.overview as Record<string, number> | undefined;
    const insights = data.insights as string[] | undefined;
    const recommendations = data.recommendations as string[] | undefined;
    const correlations = data.correlations as { top_pairs?: Array<{ column1: string; column2: string; correlation: number }> } | undefined;

    const overviewMetrics = overview ? [
        { label: 'Rows', value: overview.n_rows || 0, status: 'neutral' as const },
        { label: 'Columns', value: overview.n_columns || 0, status: 'neutral' as const },
        { label: 'Memory', value: `${(overview.memory_usage_mb || 0).toFixed(2)} MB`, status: 'neutral' as const },
        { label: 'Duplicates', value: `${(overview.duplicate_pct || 0).toFixed(1)}%`, status: (overview.duplicate_pct || 0) > 5 ? 'warning' as const : 'good' as const },
        { label: 'Missing Cols', value: overview.columns_with_missing || 0, status: (overview.columns_with_missing || 0) > 0 ? 'warning' as const : 'good' as const },
    ] : [];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg p-4">
                <h2 className="text-lg font-semibold">Exploratory Data Analysis</h2>
                <p className="text-purple-100 text-sm">Comprehensive dataset overview</p>
            </div>

            {/* Overview Metrics */}
            {overviewMetrics.length > 0 && (
                <MetricsCard title="Dataset Overview" metrics={overviewMetrics} layout="grid" />
            )}

            {/* Insights */}
            {insights && insights.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <span>💡</span> Key Insights
                    </h3>
                    <ul className="space-y-2">
                        {insights.map((insight, index) => (
                            <li key={index} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                {insight}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Top Correlations */}
            {correlations?.top_pairs && correlations.top_pairs.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <span>🔗</span> Top Correlations
                    </h3>
                    <div className="space-y-2">
                        {correlations.top_pairs.slice(0, 5).map((pair, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">
                                    {pair.column1} ↔ {pair.column2}
                                </span>
                                <span className={`font-mono font-medium ${Math.abs(pair.correlation) > 0.7 ? 'text-emerald-600' :
                                        Math.abs(pair.correlation) > 0.5 ? 'text-blue-600' : 'text-slate-600'
                                    }`}>
                                    r = {pair.correlation.toFixed(3)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            {recommendations && recommendations.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
                    <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3 flex items-center gap-2">
                        <span>📝</span> Recommendations
                    </h3>
                    <ul className="space-y-2">
                        {recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-amber-700 dark:text-amber-300">
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// Correlation Analysis Component
function CorrelationAnalysis({ data }: { data: Record<string, unknown> }) {
    const correlation = data.correlation as number || 0;
    const pValue = data.p_value as number || 0;
    const method = data.method as string || 'pearson';
    const strength = data.strength as string || 'unknown';
    const direction = data.direction as string || 'unknown';
    const interpretation = data.interpretation as string || '';

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg p-4">
                <h2 className="text-lg font-semibold">Correlation Analysis</h2>
                <p className="text-cyan-100 text-sm">{method.charAt(0).toUpperCase() + method.slice(1)} correlation</p>
            </div>

            {/* Main Correlation Value */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">Correlation Coefficient</span>
                <div className={`text-4xl font-bold mt-1 ${correlation > 0 ? 'text-emerald-600' : correlation < 0 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                    {correlation > 0 ? '+' : ''}{correlation.toFixed(4)}
                </div>
                <div className="flex justify-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${direction === 'positive' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {direction}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {strength}
                    </span>
                </div>
            </div>

            {/* Statistical Details */}
            <MetricsCard
                metrics={[
                    { label: 'P-value', value: pValue.toFixed(6), status: pValue < 0.05 ? 'good' : 'neutral' },
                    { label: 'Significant', value: pValue < 0.05 ? 'Yes' : 'No', status: pValue < 0.05 ? 'good' : 'warning' },
                ]}
                layout="horizontal"
            />

            {/* Interpretation */}
            {interpretation && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
                    {interpretation}
                </div>
            )}
        </div>
    );
}

// General Analysis Component
function GeneralAnalysis({ data }: { data: Record<string, unknown> }) {
    // Convert data to displayable metrics
    const metrics = Object.entries(data)
        .filter(([key, value]) => typeof value === 'number' || typeof value === 'string')
        .slice(0, 8)
        .map(([key, value]) => ({
            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: value as string | number,
            status: 'neutral' as const
        }));

    return (
        <div className="space-y-4">
            {metrics.length > 0 && (
                <MetricsCard title="Analysis Results" metrics={metrics} layout="grid" />
            )}
        </div>
    );
}

export default AnalysisPanel;
