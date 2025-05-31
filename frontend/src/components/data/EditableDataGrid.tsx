import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/Button';

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
  className = ''
}: EditableDataGridProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('string');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const startEditing = useCallback((rowIndex: number, column: string) => {
    const currentValue = data[rowIndex]?.[column];
    setEditValue(currentValue?.toString() || '');
    setEditingCell({ rowIndex, column });
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
          <thead className="bg-gray-100 sticky top-0">
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
                  className="p-1 border border-gray-300 bg-gray-100 text-left text-xs font-medium text-gray-600 min-w-24"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{column}</span>
                    <button
                      onClick={() => onDeleteColumn(column)}
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
                    className="border border-gray-300 cursor-cell hover:bg-blue-50 relative"
                    onClick={() => startEditing(rowIndex, column)}
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
    </div>
  );
}
