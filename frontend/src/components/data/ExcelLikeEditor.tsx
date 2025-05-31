import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '../ui/Button';

interface ExcelLikeEditorProps {
  data: any[];
  columns: string[];
  onCellUpdate: (rowIndex: number, column: string, value: any) => Promise<void>;
  onAddRow: (data: Record<string, any>) => Promise<void>;
  onDeleteRow: (rowIndex: number) => Promise<void>;
  onAddColumn: (columnName: string, dataType: string) => Promise<void>;
  onDeleteColumn: (columnName: string) => Promise<void>;
  loading?: boolean;
  currentPage: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

interface SelectedCell {
  row: number;
  col: number;
}

interface SelectedRange {
  start: SelectedCell;
  end: SelectedCell;
}

export function ExcelLikeEditor({
  data,
  columns,
  onCellUpdate,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  loading = false,
  currentPage,
  totalPages,
  totalRows,
  onPageChange
}: ExcelLikeEditorProps) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null);
  const [editingCell, setEditingCell] = useState<SelectedCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Column letters like Excel (A, B, C, ..., AA, AB, etc.)
  const getColumnLetter = useCallback((index: number): string => {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }, []);

  // Initialize column widths
  useEffect(() => {
    const initialWidths: Record<string, number> = {};
    columns.forEach(col => {
      initialWidths[col] = 120; // Default width
    });
    setColumnWidths(initialWidths);
  }, [columns]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) {
        if (e.key === 'Enter') {
          e.preventDefault();
          stopEditing(true);
          // Move to next row
          if (selectedCell && selectedCell.row < data.length - 1) {
            setSelectedCell({ row: selectedCell.row + 1, col: selectedCell.col });
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          stopEditing(false);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          stopEditing(true);
          // Move to next column
          if (selectedCell && selectedCell.col < columns.length - 1) {
            setSelectedCell({ row: selectedCell.row, col: selectedCell.col + 1 });
          }
        }
        return;
      }

      if (!selectedCell) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (selectedCell.row > 0) {
            setSelectedCell({ ...selectedCell, row: selectedCell.row - 1 });
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (selectedCell.row < data.length - 1) {
            setSelectedCell({ ...selectedCell, row: selectedCell.row + 1 });
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedCell.col > 0) {
            setSelectedCell({ ...selectedCell, col: selectedCell.col - 1 });
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedCell.col < columns.length - 1) {
            setSelectedCell({ ...selectedCell, col: selectedCell.col + 1 });
          }
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          startEditing(selectedCell.row, selectedCell.col);
          break;
        case 'Delete':
          e.preventDefault();
          if (selectedRange) {
            // Clear selected range
            clearSelectedRange();
          } else {
            // Clear selected cell
            const column = columns[selectedCell.col];
            onCellUpdate(selectedCell.row, column, '');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, selectedRange, data.length, columns.length, columns]);

  const startEditing = useCallback((row: number, col: number) => {
    const column = columns[col];
    const currentValue = data[row]?.[column];
    setEditValue(currentValue?.toString() || '');
    setEditingCell({ row, col });
    setSelectedCell({ row, col });
  }, [data, columns]);

  const stopEditing = useCallback(async (save: boolean = false) => {
    if (!editingCell) return;

    if (save) {
      const column = columns[editingCell.col];
      const currentValue = data[editingCell.row]?.[column];
      if (editValue !== currentValue?.toString()) {
        try {
          await onCellUpdate(editingCell.row, column, editValue);
        } catch (error) {
          console.error('Error updating cell:', error);
        }
      }
    }

    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, data, columns, onCellUpdate]);

  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedCell({ row, col });
    setSelectedRange(null);
    setShowContextMenu(null);
  }, []);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    startEditing(row, col);
  }, [startEditing]);

  const handleCellMouseDown = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (e.shiftKey && selectedCell) {
      // Start range selection
      setSelectedRange({
        start: selectedCell,
        end: { row, col }
      });
    } else {
      setSelectedCell({ row, col });
      setSelectedRange(null);
      setIsSelecting(true);
    }
  }, [selectedCell]);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (isSelecting && selectedCell) {
      setSelectedRange({
        start: selectedCell,
        end: { row, col }
      });
    }
  }, [isSelecting, selectedCell]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    setSelectedCell({ row, col });
    setShowContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const clearSelectedRange = useCallback(async () => {
    if (!selectedRange) return;

    const { start, end } = selectedRange;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const column = columns[col];
        try {
          await onCellUpdate(row, column, '');
        } catch (error) {
          console.error('Error clearing cell:', error);
        }
      }
    }
  }, [selectedRange, columns, onCellUpdate]);

  const isCellSelected = useCallback((row: number, col: number): boolean => {
    if (selectedRange) {
      const { start, end } = selectedRange;
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    }
    return selectedCell?.row === row && selectedCell?.col === col;
  }, [selectedCell, selectedRange]);

  const getCellAddress = useCallback((row: number, col: number): string => {
    return `${getColumnLetter(col)}${row + 1}`;
  }, [getColumnLetter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white" onMouseUp={handleMouseUp}>
      {/* Formula Bar */}
      <div className="border-b border-gray-200 p-2 flex items-center space-x-2 bg-gray-50">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-mono text-gray-600 min-w-16">
            {selectedCell ? getCellAddress(selectedCell.row, selectedCell.col) : ''}
          </span>
          <div className="w-px h-6 bg-gray-300"></div>
          <input
            type="text"
            value={editingCell ? editValue : (selectedCell ? data[selectedCell.row]?.[columns[selectedCell.col]] || '' : '')}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                stopEditing(true);
              } else if (e.key === 'Escape') {
                stopEditing(false);
              }
            }}
            onFocus={() => {
              if (selectedCell && !editingCell) {
                startEditing(selectedCell.row, selectedCell.col);
              }
            }}
            className="flex-1 px-2 py-1 text-sm border-0 outline-none bg-white"
            placeholder="Enter value..."
          />
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        <table className="w-full border-collapse">
          {/* Header Row */}
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              {/* Corner cell */}
              <th className="w-12 h-8 border border-gray-300 bg-gray-200"></th>
              {/* Column headers */}
              {columns.map((column, colIndex) => (
                <th
                  key={column}
                  className="h-8 border border-gray-300 bg-gray-100 text-xs font-medium text-gray-700 px-2 min-w-24 relative"
                  style={{ width: columnWidths[column] || 120 }}
                >
                  <div className="flex items-center justify-between">
                    <span>{getColumnLetter(colIndex)}</span>
                    <span className="text-gray-500 text-xs truncate ml-1">{column}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {/* Row header */}
                <td className="w-12 h-8 border border-gray-300 bg-gray-100 text-xs text-center text-gray-600 font-medium">
                  {(currentPage - 1) * 50 + rowIndex + 1}
                </td>
                {/* Data cells */}
                {columns.map((column, colIndex) => (
                  <td
                    key={`${rowIndex}-${colIndex}`}
                    className={`h-8 border border-gray-300 cursor-cell relative ${
                      isCellSelected(rowIndex, colIndex) 
                        ? 'bg-blue-100 border-blue-500' 
                        : 'hover:bg-gray-50'
                    }`}
                    style={{ width: columnWidths[column] || 120 }}
                    onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                    onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                    onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                    onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                  >
                    {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => stopEditing(true)}
                        className="w-full h-full px-1 text-sm border-0 outline-none bg-white"
                      />
                    ) : (
                      <div className="px-1 text-sm h-full flex items-center truncate">
                        {row[column] !== null && row[column] !== undefined
                          ? String(row[column])
                          : ''}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>Ready</span>
          {selectedCell && (
            <span>
              Cell: {getCellAddress(selectedCell.row, selectedCell.col)}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            variant="outline"
            className="text-xs px-2 py-1"
          >
            ←
          </Button>
          <span className="text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            variant="outline"
            className="text-xs px-2 py-1"
          >
            →
          </Button>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-50"
          style={{ left: showContextMenu.x, top: showContextMenu.y }}
          onBlur={() => setShowContextMenu(null)}
        >
          <button
            className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-100"
            onClick={() => {
              if (selectedCell) {
                onDeleteRow(selectedCell.row);
              }
              setShowContextMenu(null);
            }}
          >
            Delete Row
          </button>
          <button
            className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-100"
            onClick={() => {
              if (selectedCell) {
                const column = columns[selectedCell.col];
                onDeleteColumn(column);
              }
              setShowContextMenu(null);
            }}
          >
            Delete Column
          </button>
        </div>
      )}
    </div>
  );
}
