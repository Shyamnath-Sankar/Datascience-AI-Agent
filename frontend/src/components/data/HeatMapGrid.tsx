'use client';

import React, { useEffect, useState } from 'react';

interface HeatMapGridProps {
  data: number[][];
  xLabels: string[];
  yLabels: string[];
  title?: string;
}

export function HeatMapGrid({ data, xLabels, yLabels, title }: HeatMapGridProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    
    checkDarkMode();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);
    
    return () => mediaQuery.removeEventListener('change', checkDarkMode);
  }, []);

  // Function to determine color based on value with improved gradient
  const getColor = (value: number) => {
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value)));
    
    if (value >= 0) {
      // Blue gradient for positive correlations (0 to 1)
      if (isDarkMode) {
        const r = Math.round(26 + (59 - 26) * normalizedValue);
        const g = Math.round(26 + (130 - 26) * normalizedValue);
        const b = Math.round(46 + (246 - 46) * normalizedValue);
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        const r = Math.round(239 - 180 * normalizedValue);
        const g = Math.round(246 - 116 * normalizedValue);
        const b = 255;
        return `rgb(${r}, ${g}, ${b})`;
      }
    } else {
      // Red/Orange gradient for negative correlations (-1 to 0)
      if (isDarkMode) {
        const r = Math.round(46 + (239 - 46) * normalizedValue);
        const g = Math.round(26 + (68 - 26) * normalizedValue);
        const b = Math.round(26 + (68 - 26) * normalizedValue);
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        const r = 255;
        const g = Math.round(239 - 161 * normalizedValue);
        const b = Math.round(239 - 181 * normalizedValue);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
  };

  // Function to get text color based on background intensity
  const getTextColor = (value: number) => {
    const normalizedValue = Math.abs(value);
    if (isDarkMode) {
      return normalizedValue > 0.3 ? '#ffffff' : '#a1a1aa';
    }
    return normalizedValue > 0.5 ? '#ffffff' : '#374151';
  };

  // Get min and max for the legend
  const allValues = data.flat();
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  return (
    <div className="w-full h-full flex flex-col">
      {title && (
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 text-center">
          {title}
        </h3>
      )}
      
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] min-w-[60px]"></th>
                {xLabels.map((label, index) => (
                  <th 
                    key={index} 
                    className="p-2 border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] min-w-[60px] max-w-[100px] truncate"
                    title={label}
                  >
                    {label.length > 10 ? `${label.slice(0, 10)}...` : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th 
                    className="sticky left-0 z-10 p-2 border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] text-left min-w-[60px] max-w-[100px] truncate"
                    title={yLabels[rowIndex]}
                  >
                    {yLabels[rowIndex]?.length > 10 ? `${yLabels[rowIndex].slice(0, 10)}...` : yLabels[rowIndex]}
                  </th>
                  {row.map((value, colIndex) => (
                    <td 
                      key={colIndex} 
                      className="p-2 border border-[var(--border-color)] text-center transition-all duration-150 hover:ring-2 hover:ring-[var(--accent-primary)] hover:ring-inset cursor-default"
                      style={{ 
                        backgroundColor: getColor(value),
                        color: getTextColor(value),
                      }}
                      title={`${yLabels[rowIndex]} / ${xLabels[colIndex]}: ${value.toFixed(3)}`}
                    >
                      <span className="text-xs font-medium">
                        {value.toFixed(2)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Color Legend */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">{minValue.toFixed(2)}</span>
          <div className="w-32 h-3 rounded-full overflow-hidden flex">
            <div 
              className="flex-1" 
              style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(to right, rgb(239, 68, 68), rgb(26, 26, 46), rgb(59, 130, 246))'
                  : 'linear-gradient(to right, rgb(255, 78, 58), rgb(255, 255, 255), rgb(59, 130, 246))'
              }}
            />
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">{maxValue.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: isDarkMode ? 'rgb(239, 68, 68)' : 'rgb(255, 78, 58)' }}></span>
            Negative
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(59, 130, 246)' }}></span>
            Positive
          </span>
        </div>
      </div>
    </div>
  );
}
