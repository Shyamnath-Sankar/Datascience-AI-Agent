'use client';

import React from 'react';
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
} from 'chart.js';
import { Bar, Line, Pie, Scatter, Bubble } from 'react-chartjs-2';
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
  Legend
);

interface ChartDisplayProps {
  chartType: string;
  chartData: any;
  chartConfig: {
    x_column: string;
    y_columns: string[];
    group_by?: string;
    aggregation?: string;
  };
}

export function ChartDisplay({ chartType, chartData, chartConfig }: ChartDisplayProps) {
  if (!chartData || !chartType) {
    return (
      <div className="h-96 bg-gray-50 p-4 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">
          Configure and generate a chart to see the visualization
        </p>
      </div>
    );
  }

  // Extract data for the chart
  const getChartData = () => {
    // Default colors for datasets
    const colors = [
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 99, 132, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
    ];

    // For simple bar/line charts
    if ((chartType === 'bar' || chartType === 'line') && chartData.chart_data) {
      // Handle different data structures
      if (chartData.chart_data.x && chartData.chart_data.y) {
        // Simple x and y structure
        const labels = chartData.chart_data.x;
        const datasets = Object.entries(chartData.chart_data.y).map(([key, values], index) => ({
          label: key,
          data: values as number[],
          backgroundColor: colors[index % colors.length],
          borderColor: colors[index % colors.length].replace('0.6', '1'),
          borderWidth: 1,
        }));

        return { labels, datasets };
      } else if (Array.isArray(chartData.chart_data)) {
        // Array of records
        const labels = chartData.chart_data.map((item: any) => item[chartConfig.x_column]);
        const datasets = chartConfig.y_columns.map((column, index) => ({
          label: column,
          data: chartData.chart_data.map((item: any) => item[column]),
          backgroundColor: colors[index % colors.length],
          borderColor: colors[index % colors.length].replace('0.6', '1'),
          borderWidth: 1,
        }));

        return { labels, datasets };
      }
    }

    // For pie charts
    if (chartType === 'pie' && chartData.chart_data) {
      if (chartData.chart_data.labels && chartData.chart_data.values) {
        return {
          labels: chartData.chart_data.labels,
          datasets: [
            {
              data: chartData.chart_data.values,
              backgroundColor: colors.slice(0, chartData.chart_data.labels.length),
              borderColor: colors.map(color => color.replace('0.6', '1')).slice(0, chartData.chart_data.labels.length),
              borderWidth: 1,
            },
          ],
        };
      }
    }

    // For histogram
    if (chartType === 'histogram' && chartData.chart_data) {
      if (chartData.chart_data.data && chartData.chart_data.bins) {
        // Create labels from bin edges (use middle of each bin)
        const binEdges = chartData.chart_data.bins;
        const labels = [];
        for (let i = 0; i < binEdges.length - 1; i++) {
          const binMiddle = (binEdges[i] + binEdges[i + 1]) / 2;
          labels.push(binMiddle.toFixed(2));
        }

        return {
          labels,
          datasets: [
            {
              label: 'Frequency',
              data: chartData.chart_data.data,
              backgroundColor: colors[0],
              borderColor: colors[0].replace('0.6', '1'),
              borderWidth: 1,
            },
          ],
        };
      } else if (chartData.chart_data.labels && chartData.chart_data.values) {
        // For categorical histograms
        return {
          labels: chartData.chart_data.labels,
          datasets: [
            {
              label: 'Frequency',
              data: chartData.chart_data.values,
              backgroundColor: colors[0],
              borderColor: colors[0].replace('0.6', '1'),
              borderWidth: 1,
            },
          ],
        };
      }
    }

    // For scatter plots
    if (chartType === 'scatter' && chartData.chart_data) {
      if (chartData.chart_data.data) {
        // Handle multiple series
        return {
          datasets: chartData.chart_data.data.map((series: any, index: number) => ({
            label: series.name || `Series ${index + 1}`,
            data: series.x.map((x: number, i: number) => ({ x, y: series.y[i] })),
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length].replace('0.6', '1'),
            pointRadius: series.size ? series.size.map((s: number) => Math.max(3, s / 5)) : 5,
            pointHoverRadius: 7,
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
          backgroundColor: colors[0],
          borderColor: colors[0].replace('0.6', '1'),
          borderWidth: 1,
        },
      ],
    };
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
        font: {
          size: 16,
        },
      },
      tooltip: {
        enabled: true,
      },
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
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">
            Heatmap
          </p>
          <p className="text-sm text-gray-500">
            Invalid data format for heatmap
          </p>
        </div>
      );
    }

    switch (chartType) {
      case 'bar':
        return <Bar data={data} options={options} />;
      case 'line':
        return <Line data={data} options={options} />;
      case 'pie':
        return <Pie data={data} options={options} />;
      case 'histogram':
        // Histograms are rendered as bar charts
        return <Bar
          data={data}
          options={{
            ...options,
            scales: {
              x: {
                title: {
                  display: true,
                  text: chartConfig.x_column || 'Value'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Frequency'
                }
              }
            }
          }}
        />;
      case 'scatter':
        return <Scatter
          data={data}
          options={{
            ...options,
            scales: {
              x: {
                title: {
                  display: true,
                  text: chartConfig.x_column || 'X'
                }
              },
              y: {
                title: {
                  display: true,
                  text: chartConfig.y_columns[0] || 'Y'
                }
              }
            }
          }}
        />;
      default:
        return (
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">
              {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            </p>
            <p className="text-sm text-gray-500">
              Chart type not supported for visualization
            </p>
          </div>
        );
    }
  };

  return (
    <div className="h-96 bg-gray-50 p-4 rounded-lg">
      {renderChart()}
    </div>
  );
}
