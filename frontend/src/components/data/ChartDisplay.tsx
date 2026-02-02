'use client';

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ScatterController,
  BubbleController,
  RadialLinearScale,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Scatter, Doughnut } from 'react-chartjs-2';
import { HeatMapGrid } from '@/components/data/HeatMapGrid';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ScatterController,
  BubbleController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartDisplayProps {
  chartType: string;
  chartData: any;
  chartConfig: {
    x_column: string;
    y_columns: string[];
    group_by?: string;
    aggregation?: string;
    showLegend?: boolean;
    showGrid?: boolean;
    title?: string;
  };
}

// Modern color palette that works in both light and dark modes
const CHART_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.7)', border: 'rgb(59, 130, 246)' },   // Blue
  { bg: 'rgba(16, 185, 129, 0.7)', border: 'rgb(16, 185, 129)' },   // Emerald
  { bg: 'rgba(249, 115, 22, 0.7)', border: 'rgb(249, 115, 22)' },   // Orange
  { bg: 'rgba(139, 92, 246, 0.7)', border: 'rgb(139, 92, 246)' },   // Violet
  { bg: 'rgba(236, 72, 153, 0.7)', border: 'rgb(236, 72, 153)' },   // Pink
  { bg: 'rgba(20, 184, 166, 0.7)', border: 'rgb(20, 184, 166)' },   // Teal
  { bg: 'rgba(245, 158, 11, 0.7)', border: 'rgb(245, 158, 11)' },   // Amber
  { bg: 'rgba(99, 102, 241, 0.7)', border: 'rgb(99, 102, 241)' },   // Indigo
];

const PIE_COLORS = [
  'rgba(59, 130, 246, 0.85)',
  'rgba(16, 185, 129, 0.85)',
  'rgba(249, 115, 22, 0.85)',
  'rgba(139, 92, 246, 0.85)',
  'rgba(236, 72, 153, 0.85)',
  'rgba(20, 184, 166, 0.85)',
  'rgba(245, 158, 11, 0.85)',
  'rgba(99, 102, 241, 0.85)',
];

export function ChartDisplay({ chartType, chartData, chartConfig }: ChartDisplayProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check for dark mode
    const checkDarkMode = () => {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    
    checkDarkMode();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);
    
    return () => mediaQuery.removeEventListener('change', checkDarkMode);
  }, []);

  const textColor = isDarkMode ? '#ededed' : '#111827';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const tooltipBg = isDarkMode ? '#262626' : '#ffffff';
  const tooltipBorder = isDarkMode ? '#3f3f46' : '#e5e7eb';

  if (!chartData || !chartType) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center rounded-xl bg-[var(--bg-secondary)] border-2 border-dashed border-[var(--border-color)]">
        <div className="text-center px-6 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Create Your Visualization
          </h3>
          <p className="text-sm text-[var(--text-tertiary)]">
            Select a chart type and configure the axes to generate an interactive visualization from your data.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)]">
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">1. Choose chart</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">2. Select columns</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">3. Generate</span>
          </div>
        </div>
      </div>
    );
  }

  // Extract data for the chart
  const getChartData = () => {
    // For simple bar/line charts
    if ((chartType === 'bar' || chartType === 'line') && chartData.chart_data) {
      if (chartData.chart_data.x && chartData.chart_data.y) {
        const labels = chartData.chart_data.x;
        const datasets = Object.entries(chartData.chart_data.y).map(([key, values], index) => ({
          label: key,
          data: values as number[],
          backgroundColor: CHART_COLORS[index % CHART_COLORS.length].bg,
          borderColor: CHART_COLORS[index % CHART_COLORS.length].border,
          borderWidth: 2,
          borderRadius: chartType === 'bar' ? 4 : 0,
          tension: 0.3,
          fill: chartType === 'line' ? 'origin' : false,
        }));

        return { labels, datasets };
      } else if (Array.isArray(chartData.chart_data)) {
        const labels = chartData.chart_data.map((item: any) => item[chartConfig.x_column]);
        const datasets = chartConfig.y_columns.map((column, index) => ({
          label: column,
          data: chartData.chart_data.map((item: any) => item[column]),
          backgroundColor: CHART_COLORS[index % CHART_COLORS.length].bg,
          borderColor: CHART_COLORS[index % CHART_COLORS.length].border,
          borderWidth: 2,
          borderRadius: chartType === 'bar' ? 4 : 0,
          tension: 0.3,
          fill: chartType === 'line' ? 'origin' : false,
        }));

        return { labels, datasets };
      }
    }

    // For pie charts
    if ((chartType === 'pie' || chartType === 'doughnut') && chartData.chart_data) {
      if (chartData.chart_data.labels && chartData.chart_data.values) {
        return {
          labels: chartData.chart_data.labels,
          datasets: [
            {
              data: chartData.chart_data.values,
              backgroundColor: PIE_COLORS.slice(0, chartData.chart_data.labels.length),
              borderColor: isDarkMode ? '#0a0a0a' : '#ffffff',
              borderWidth: 2,
              hoverOffset: 8,
            },
          ],
        };
      }
    }

    // For histogram
    if (chartType === 'histogram' && chartData.chart_data) {
      if (chartData.chart_data.data && chartData.chart_data.bins) {
        const binEdges = chartData.chart_data.bins;
        const labels = [];
        for (let i = 0; i < binEdges.length - 1; i++) {
          const binMiddle = (binEdges[i] + binEdges[i + 1]) / 2;
          labels.push(binMiddle.toFixed(1));
        }

        return {
          labels,
          datasets: [
            {
              label: 'Frequency',
              data: chartData.chart_data.data,
              backgroundColor: CHART_COLORS[0].bg,
              borderColor: CHART_COLORS[0].border,
              borderWidth: 2,
              borderRadius: 4,
            },
          ],
        };
      } else if (chartData.chart_data.labels && chartData.chart_data.values) {
        return {
          labels: chartData.chart_data.labels,
          datasets: [
            {
              label: 'Frequency',
              data: chartData.chart_data.values,
              backgroundColor: CHART_COLORS[0].bg,
              borderColor: CHART_COLORS[0].border,
              borderWidth: 2,
              borderRadius: 4,
            },
          ],
        };
      }
    }

    // For scatter plots
    if (chartType === 'scatter' && chartData.chart_data) {
      if (chartData.chart_data.data) {
        return {
          datasets: chartData.chart_data.data.map((series: any, index: number) => ({
            label: series.name || `Series ${index + 1}`,
            data: series.x.map((x: number, i: number) => ({ x, y: series.y[i] })),
            backgroundColor: CHART_COLORS[index % CHART_COLORS.length].bg,
            borderColor: CHART_COLORS[index % CHART_COLORS.length].border,
            pointRadius: series.size ? series.size.map((s: number) => Math.max(4, s / 4)) : 6,
            pointHoverRadius: 10,
            borderWidth: 2,
          })),
        };
      }
    }

    // Default empty data
    return {
      labels: [],
      datasets: [
        {
          label: 'No data',
          data: [],
          backgroundColor: CHART_COLORS[0].bg,
          borderColor: CHART_COLORS[0].border,
          borderWidth: 2,
        },
      ],
    };
  };

  // Base chart options
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartConfig.showLegend !== false,
        position: 'top' as const,
        labels: {
          color: textColor,
          font: {
            size: 12,
            weight: 500,
          },
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: !!chartConfig.title,
        text: chartConfig.title || '',
        color: textColor,
        font: {
          size: 16,
          weight: 600,
        },
        padding: { bottom: 16 },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        titleFont: {
          size: 13,
          weight: 600,
        },
        bodyFont: {
          size: 12,
        },
      },
    },
    scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
      x: {
        display: true,
        grid: {
          display: chartConfig.showGrid !== false,
          color: gridColor,
          drawBorder: false,
        },
        ticks: {
          color: textColor,
          font: { size: 11 },
          maxRotation: 45,
        },
        title: {
          display: true,
          text: chartConfig.x_column || '',
          color: textColor,
          font: { size: 12, weight: 500 },
        },
      },
      y: {
        display: true,
        grid: {
          display: chartConfig.showGrid !== false,
          color: gridColor,
          drawBorder: false,
        },
        ticks: {
          color: textColor,
          font: { size: 11 },
        },
        title: {
          display: true,
          text: chartConfig.y_columns?.join(', ') || '',
          color: textColor,
          font: { size: 12, weight: 500 },
        },
        beginAtZero: true,
      },
    } : undefined,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    animation: {
      duration: 750,
      easing: 'easeOutQuart' as const,
    },
  };

  // Render the appropriate chart based on type
  const renderChart = () => {
    const data = getChartData();

    // Special handling for heatmap
    if (chartType === 'heatmap' && chartData.chart_data) {
      if (chartData.chart_data.x && chartData.chart_data.y && chartData.chart_data.z) {
        return (
          <HeatMapGrid
            data={chartData.chart_data.z}
            xLabels={chartData.chart_data.x}
            yLabels={chartData.chart_data.y}
          />
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-lg font-medium text-[var(--text-primary)]">Heatmap</p>
          <p className="text-sm text-[var(--text-tertiary)]">Invalid data format for heatmap</p>
        </div>
      );
    }

    switch (chartType) {
      case 'bar':
        return <Bar data={data} options={baseOptions} />;
      case 'line':
        return <Line data={data} options={baseOptions} />;
      case 'pie':
        return (
          <div className="max-w-md mx-auto h-full">
            <Pie 
              data={data} 
              options={{
                ...baseOptions,
                plugins: {
                  ...baseOptions.plugins,
                  legend: {
                    ...baseOptions.plugins.legend,
                    position: 'right',
                  },
                },
              }} 
            />
          </div>
        );
      case 'doughnut':
        return (
          <div className="max-w-md mx-auto h-full">
            <Doughnut 
              data={data} 
              options={{
                ...baseOptions,
                cutout: '60%',
                plugins: {
                  ...baseOptions.plugins,
                  legend: {
                    ...baseOptions.plugins.legend,
                    position: 'right',
                  },
                },
              }} 
            />
          </div>
        );
      case 'histogram':
        return (
          <Bar
            data={data}
            options={{
              ...baseOptions,
              scales: {
                ...baseOptions.scales,
                x: {
                  ...baseOptions.scales?.x,
                  title: {
                    display: true,
                    text: chartConfig.x_column || 'Value',
                    color: textColor,
                    font: { size: 12, weight: 500 },
                  },
                },
                y: {
                  ...baseOptions.scales?.y,
                  title: {
                    display: true,
                    text: 'Frequency',
                    color: textColor,
                    font: { size: 12, weight: 500 },
                  },
                },
              },
            }}
          />
        );
      case 'scatter':
        return (
          <Scatter
            data={data}
            options={{
              ...baseOptions,
              scales: {
                x: {
                  ...baseOptions.scales?.x,
                  type: 'linear',
                  position: 'bottom',
                  title: {
                    display: true,
                    text: chartConfig.x_column || 'X',
                    color: textColor,
                    font: { size: 12, weight: 500 },
                  },
                },
                y: {
                  ...baseOptions.scales?.y,
                  title: {
                    display: true,
                    text: chartConfig.y_columns?.[0] || 'Y',
                    color: textColor,
                    font: { size: 12, weight: 500 },
                  },
                },
              },
            }}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)]">
              {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            </p>
            <p className="text-sm text-[var(--text-tertiary)]">
              This chart type is not yet supported
            </p>
          </div>
        );
    }
  };

  return (
    <div className="h-full min-h-[400px] w-full">
      {renderChart()}
    </div>
  );
}
