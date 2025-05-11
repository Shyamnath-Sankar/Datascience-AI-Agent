'use client';

import React from 'react';

interface HeatMapGridProps {
  data: number[][];
  xLabels: string[];
  yLabels: string[];
}

export function HeatMapGrid({ data, xLabels, yLabels }: HeatMapGridProps) {
  // Function to determine color based on value
  const getColor = (value: number) => {
    // Normalize value between 0 and 1
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value)));
    
    if (value >= 0) {
      // Blue for positive correlations (0 to 1)
      const r = Math.round(255 * (1 - normalizedValue));
      const g = Math.round(255 * (1 - normalizedValue));
      const b = 255;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Red for negative correlations (-1 to 0)
      const r = 255;
      const g = Math.round(255 * (1 - normalizedValue));
      const b = Math.round(255 * (1 - normalizedValue));
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Function to get text color based on background color
  const getTextColor = (value: number) => {
    const normalizedValue = Math.abs(value);
    return normalizedValue > 0.5 ? 'white' : 'black';
  };

  return (
    <div className="overflow-auto max-h-full">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 border border-gray-200 bg-gray-50"></th>
            {xLabels.map((label, index) => (
              <th key={index} className="p-2 border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th className="p-2 border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 text-left">
                {yLabels[rowIndex]}
              </th>
              {row.map((value, colIndex) => (
                <td 
                  key={colIndex} 
                  className="p-2 border border-gray-200 text-center"
                  style={{ 
                    backgroundColor: getColor(value),
                    color: getTextColor(value)
                  }}
                >
                  {value.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
