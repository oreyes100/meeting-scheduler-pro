'use client';

import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';

function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface PersonOption {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
}

function personName(p: PersonOption): string {
  return p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

export function PersonPickerModal({
  title, persons, selectedId, onSelect, onClose,
}: {
  title: string;
  persons: PersonOption[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return persons;
    const q = deaccent(search);
    return persons.filter(p => deaccent(personName(p)).includes(q));
  }, [persons, search]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
          <h3 className="font-bold text-sm">Seleccionar persona — {title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={16} /></button>
        </div>
        <div className="p-3 border-b dark:border-gray-700">
          <input
            autoFocus
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className="w-full text-left px-3 py-2 text-sm italic text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            — Ninguno —
          </button>
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); onClose(); }}
              className={`w-full text-left px-3 py-2 text-sm ${
                p.id === selectedId ? 'bg-yellow-100 dark:bg-yellow-900/30 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {personName(p)}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-4 text-sm text-gray-400 text-center">Sin resultados</div>}
        </div>
        <div className="flex justify-end gap-2 p-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
