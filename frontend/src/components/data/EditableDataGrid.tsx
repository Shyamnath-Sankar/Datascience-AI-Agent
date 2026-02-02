import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/Button';
import { InlineAIAssistant, SelectionState, SelectionContextMenu, ContextMenuItem } from '../agent/InlineAIAssistant';

interface EditableDataGridProps {
  data: any[];
  columns: string[];
  onCellUpdate: (rowIndex: number, column: string, value: any) => Promise<void>;
  onAddRow: (data: Record<string, any>) => Promise<void>;
  onDeleteRow: (rowIndex: number) => Promise<void>;
  onAddColumn: (columnName: string, dataType: string) => Promise<void>;
  onDeleteColumn: (columnName: string) => Promise<void>;
  loading?: boolean;
  className?: string;
  // AI Assistant props
  sessionId?: string;
  fileId?: string;
  onAIAction?: (action: string, result: any) => void;
}

interface EditingCell {
  rowIndex: number;
  column: string;
}

export function EditableDataGrid({
  data,
  columns,
  onCellUpdate,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  loading = false,
  className = '',
  sessionId,
  fileId,
  onAIAction
}: EditableDataGridProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: string } | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<{ row: number, col: string } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ startRow: number, endRow: number, startCol: string, endCol: string } | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('string');
  const inputRef = useRef<HTMLInputElement>(null);

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAssistantPosition, setAIAssistantPosition] = useState<{ x: number, y: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<SelectionState | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number, y: number } | null>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Handle cell click (selection)
  const handleCellClick = useCallback((rowIndex: number, column: string, event: React.MouseEvent) => {
    // 1. Shift + Click: Range Selection
    if (event.shiftKey && selectionAnchor) {
      const startRowIdx = Math.min(selectionAnchor.row, rowIndex);
      const endRowIdx = Math.max(selectionAnchor.row, rowIndex);

      const anchorColIdx = columns.indexOf(selectionAnchor.col);
      const currentColIdx = columns.indexOf(column);

      if (anchorColIdx !== -1 && currentColIdx !== -1) {
        const startColIdx = Math.min(anchorColIdx, currentColIdx);
        const endColIdx = Math.max(anchorColIdx, currentColIdx);

        const startCol = columns[startColIdx];
        const endCol = columns[endColIdx];

        setSelectedRange({
          startRow: startRowIdx,
          endRow: endRowIdx,
          startCol,
          endCol
        });
        setSelectedCell(null); // Clear single cell selection
        setSelectedColumns(new Set()); // Clear column selection

        // Analyze Range for AI
        if (sessionId && event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          setAIAssistantPosition({ x: rect.right + 10, y: rect.top });

          // Gather data in range
          const flatData = [];
          for (let r = startRowIdx; r <= endRowIdx; r++) {
            for (let c = startColIdx; c <= endColIdx; c++) {
              flatData.push(data[r]?.[columns[c]]);
            }
          }

          setCurrentSelection({
            type: 'range',
            range: { startRow: startRowIdx, endRow: endRowIdx, startCol, endCol },
            data: flatData,
            summary: { count: flatData.length }
          });
          setShowAIAssistant(true);
        }
        return;
      }
    }

    // 2. Normal Click: Single Cell Selection
    setSelectedCell({ row: rowIndex, col: column });
    setSelectionAnchor({ row: rowIndex, col: column }); // Set anchor
    setSelectedRange(null); // Clear range
    setSelectedColumns(new Set()); // Clear column selection

    // Position and show AI assistant
    if (sessionId && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      setAIAssistantPosition({ x: rect.right + 10, y: rect.top });

      const value = data[rowIndex]?.[column];
      setCurrentSelection({
        type: 'cells',
        cells: [{ row: rowIndex, col: column, value }],
        data: [value],
        summary: {
          count: 1,
          numericCount: typeof value === 'number' ? 1 : 0,
          hasNulls: value === null || value === undefined
        }
      });
      setShowAIAssistant(true);
    }
  }, [data, sessionId, selectionAnchor, columns]);

  // Handle double click (edit)
  const handleCellDoubleClick = useCallback((rowIndex: number, column: string) => {
    const currentValue = data[rowIndex]?.[column];
    setEditValue(currentValue?.toString() || '');
    setEditingCell({ rowIndex, column });
    // Hide AI when editing starts
    setShowAIAssistant(false);
  }, [data]);

  const stopEditing = useCallback(async (save: boolean = false) => {
    if (!editingCell) return;

    if (save) {
      const currentValue = data[editingCell.rowIndex]?.[editingCell.column];
      if (editValue !== currentValue?.toString()) {
        try {
          await onCellUpdate(editingCell.rowIndex, editingCell.column, editValue);
        } catch (error) {
          console.error('Error updating cell:', error);
          // Optionally show error message to user
        }
      }
    }

    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, data, onCellUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      stopEditing(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      stopEditing(false);
    }
  }, [stopEditing]);

  const startEditing = useCallback((rowIndex: number, column: string) => {
    const currentValue = data[rowIndex]?.[column];
    setEditValue(currentValue?.toString() || '');
    setEditingCell({ rowIndex, column });
  }, [data]);

  const handleRowSelect = useCallback((rowIndex: number, isSelected: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(rowIndex);
      } else {
        newSet.delete(rowIndex);
      }
      return newSet;
    });
  }, []);

  const handleDeleteSelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) return;

    const sortedRows = Array.from(selectedRows).sort((a, b) => b - a); // Delete from bottom to top
    for (const rowIndex of sortedRows) {
      try {
        await onDeleteRow(rowIndex);
      } catch (error) {
        console.error('Error deleting row:', error);
      }
    }
    setSelectedRows(new Set());
  }, [selectedRows, onDeleteRow]);

  const handleAddNewRow = useCallback(async () => {
    const newRowData: Record<string, any> = {};
    columns.forEach(col => {
      newRowData[col] = '';
    });

    try {
      await onAddRow(newRowData);
    } catch (error) {
      console.error('Error adding row:', error);
    }
  }, [columns, onAddRow]);

  const handleAddColumn = useCallback(async () => {
    if (!newColumnName.trim()) return;

    try {
      await onAddColumn(newColumnName.trim(), newColumnType);
      setNewColumnName('');
      setShowAddColumn(false);
    } catch (error) {
      console.error('Error adding column:', error);
    }
  }, [newColumnName, newColumnType, onAddColumn]);

  // Column selection handling
  const handleColumnClick = useCallback((column: string, event: React.MouseEvent) => {
    event.preventDefault();

    setSelectedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        newSet.delete(column);
      } else {
        newSet.clear(); // Single column selection
        newSet.add(column);
      }
      return newSet;
    });

    // Show AI assistant if sessionId is available
    if (sessionId && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      setAIAssistantPosition({ x: rect.right + 10, y: rect.top });

      // Build selection state
      const columnData = data.map(row => row[column]);
      setCurrentSelection({
        type: 'columns',
        columns: [column],
        data: columnData,
        summary: {
          count: columnData.length,
          numericCount: columnData.filter(v => typeof v === 'number').length,
          hasNulls: columnData.some(v => v === null || v === undefined)
        }
      });
      setShowAIAssistant(true);
    }
  }, [data, sessionId]);

  // Handle AI question
  const handleAskQuestion = useCallback(async (question: string, selection: SelectionState): Promise<string> => {
    if (!sessionId) return "Session not available";

    try {
      const { askSelectionContext } = await import('@/lib/api');
      const response = await askSelectionContext(sessionId, selection, question, undefined, fileId);
      return response.response || "No response from AI";
    } catch (error) {
      console.error('Error asking AI:', error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }, [sessionId, fileId]);

  // Handle AI action
  const handleAIAction = useCallback((action: string, result: any) => {
    console.log('AI Action:', action, result);
    onAIAction?.(action, result);
  }, [onAIAction]);

  // Context menu items
  const contextMenuItems: ContextMenuItem[] = [
    { id: 'ask-ai', label: 'Ask AI about selection', icon: '🤖', action: () => setShowAIAssistant(true) },
    { id: 'stats', label: 'Quick Stats', icon: '📊', action: () => { } },
    { divider: true } as ContextMenuItem,
    { id: 'copy', label: 'Copy', icon: '📋', action: () => { } },
  ];

  // Handle right-click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (selectedColumns.size > 0 || selectedRows.size > 0) {
      e.preventDefault();
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    }
  }, [selectedColumns, selectedRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white h-full flex flex-col ${className}`}>
      {/* Toolbar */}
      <div className="px-2 py-1 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center space-x-1">
          <Button
            onClick={handleAddNewRow}
            className="text-xs px-2 py-1"
            variant="outline"
          >
            + Row
          </Button>
          <Button
            onClick={() => setShowAddColumn(true)}
            className="text-xs px-2 py-1"
            variant="outline"
          >
            + Column
          </Button>
          {selectedRows.size > 0 && (
            <Button
              onClick={handleDeleteSelectedRows}
              className="text-xs px-2 py-1"
              variant="outline"
            >
              Delete ({selectedRows.size})
            </Button>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {data.length} rows × {columns.length} columns
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddColumn && (
        <div className="px-2 py-1 border-b border-gray-200 bg-gray-100">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Column name"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs"
            />
            <select
              value={newColumnType}
              onChange={(e) => setNewColumnType(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs"
            >
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>
            <Button onClick={handleAddColumn} className="text-xs px-2 py-1">
              Add
            </Button>
            <Button
              onClick={() => setShowAddColumn(false)}
              className="text-xs px-2 py-1"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Data Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 sticky top-0 md:z-10 z-0">
            <tr>
              <th className="w-8 p-1 border border-gray-300 bg-gray-200">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRows(new Set(data.map((_, idx) => idx)));
                    } else {
                      setSelectedRows(new Set());
                    }
                  }}
                  className="rounded"
                />
              </th>
              <th className="w-12 p-1 border border-gray-300 bg-gray-100 text-xs font-medium text-gray-600">
                #
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  onClick={(e) => handleColumnClick(column, e)}
                  className={`p-1 border border-gray-300 text-left text-xs font-medium min-w-24 cursor-pointer hover:bg-blue-100 transition-colors ${selectedColumns.has(column)
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                    }`}
                  title="Click to select column and open AI assistant"
                >
                  <div className="flex items-center justify-between group">
                    <span className="truncate">{column}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteColumn(column);
                      }}
                      className="ml-1 text-red-500 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100"
                      title="Delete column"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-blue-50">
                <td className="p-1 border border-gray-300 bg-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rowIndex)}
                    onChange={(e) => handleRowSelect(rowIndex, e.target.checked)}
                    className="rounded"
                  />
                </td>
                <td className="p-1 border border-gray-300 bg-gray-100 text-xs text-gray-600 text-center font-medium">
                  {rowIndex + 1}
                </td>
                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column}`}
                    className={`border border-gray-300 cursor-cell relative ${selectedColumns.has(column) ||
                      (selectedCell?.row === rowIndex && selectedCell?.col === column) ||
                      (selectedRange &&
                        rowIndex >= selectedRange.startRow && rowIndex <= selectedRange.endRow &&
                        columns.indexOf(column) >= columns.indexOf(selectedRange.startCol) &&
                        columns.indexOf(column) <= columns.indexOf(selectedRange.endCol))
                      ? 'bg-blue-50 border-blue-500 z-10' // Highlight selection
                      : 'hover:bg-blue-50'
                      }`}
                    onClick={(e) => handleCellClick(rowIndex, column, e)}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, column)}
                  >
                    {editingCell?.rowIndex === rowIndex && editingCell?.column === column ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => stopEditing(true)}
                        onKeyDown={handleKeyDown}
                        className="w-full h-full px-1 py-1 text-sm border-0 outline-none bg-white"
                      />
                    ) : (
                      <div className="px-1 py-1 text-sm min-h-6 h-6 flex items-center">
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

      {/* Inline AI Assistant */}
      {sessionId && (
        <>
          <InlineAIAssistant
            selection={currentSelection}
            position={aiAssistantPosition}
            onClose={() => {
              setShowAIAssistant(false);
              setSelectedColumns(new Set());
            }}
            onAction={handleAIAction}
            onAskQuestion={handleAskQuestion}
            isVisible={showAIAssistant}
          />

          <SelectionContextMenu
            position={contextMenuPosition}
            items={contextMenuItems}
            onClose={() => setShowContextMenu(false)}
            isVisible={showContextMenu}
          />
        </>
      )}
    </div>
  );
}
