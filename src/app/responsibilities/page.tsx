'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserCog, MessageSquare, ClipboardList, Home as HomeIcon, Sliders } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { PersonPickerModal } from '@/components/PersonPickerModal';

interface RolePerson { id: string; first_name?: string | null; last_name?: string | null; display_name?: string | null }
interface Role {
  role_key: string;
  label: string;
  custom_label: string | null;
  person: RolePerson | null;
  assistant_1: RolePerson | null;
  assistant_2: RolePerson | null;
}

function personName(p: RolePerson | null): string {
  if (!p) return '';
  return p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

// Qué campo de la fila (person_id / assistant_1_id / assistant_2_id) se está editando
type Slot = { roleKey: string; field: 'person_id' | 'assistant_1_id' | 'assistant_2_id' };

function Slot({ label, person, onClick }: { label?: string; person: RolePerson | null; onClick: () => void }) {
  return (
    <div>
      <button
        onClick={onClick}
        className="w-full text-left px-3 py-2 rounded text-sm bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40"
      >
        {personName(person) || <span className="text-gray-400 italic">— Sin asignar —</span>}
      </button>
      {label && <p className="text-xs text-gray-400 text-center mt-0.5">{label}</p>}
    </div>
  );
}

export default function ResponsibilitiesPage() {
  const router = useRouter();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [persons, setPersons] = useState<RolePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);
  const [customLabel, setCustomLabel] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        fetch('/api/congregation-roles'),
        fetch('/api/users'),
      ]);
      const rData = await rRes.json();
      const pData = await pRes.json();
      const map: Record<string, Role> = {};
      for (const r of rData.roles || []) map[r.role_key] = r;
      setRoles(map);
      setCustomLabel(map.custom?.custom_label || '');
      setPersons(pData.users || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const assign = async (roleKey: string, field: Slot['field'], personId: string | null) => {
    setRoles(prev => {
      const r = prev[roleKey];
      if (!r) return prev;
      const key = field === 'person_id' ? 'person' : field === 'assistant_1_id' ? 'assistant_1' : 'assistant_2';
      const p = persons.find(x => x.id === personId) || null;
      return { ...prev, [roleKey]: { ...r, [key]: p } };
    });
    try {
      await fetch('/api/congregation-roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_key: roleKey, [field]: personId }),
      });
    } catch { /* ignore */ }
  };

  const saveCustomLabel = async () => {
    try {
      await fetch('/api/congregation-roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_key: 'custom', custom_label: customLabel || null }),
      });
    } catch { /* ignore */ }
  };

  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  const meetingRoles: { roleKey: string; icon: React.ReactNode; label: string }[] = [
    { roleKey: 'midweek_overseer', icon: <MessageSquare size={16} />, label: 'Superintendente de la reunión Vida y Ministerio Cristiano' },
    { roleKey: 'auxiliary_counselor', icon: <ClipboardList size={16} />, label: 'Consejero auxiliar' },
    { roleKey: 'watchtower_conductor', icon: <UserCog size={16} />, label: 'Conductor de La Atalaya' },
  ];

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#4BA3E3] to-[#31708f] text-white px-4 py-2 shrink-0">
          <h1 className="font-bold text-lg">Responsabilidades en la Congregación</h1>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
        ) : (
          <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Roles únicos */}
            <div className="space-y-4">
              <div className={`border rounded-lg p-4 ${bgCard}`}>
                <h2 className="font-bold text-sm mb-1">Coordinador del cuerpo de ancianos</h2>
                <Slot person={roles.elders_coordinator?.person || null} onClick={() => setOpenSlot({ roleKey: 'elders_coordinator', field: 'person_id' })} />
              </div>
              <div className={`border rounded-lg p-4 ${bgCard}`}>
                <h2 className="font-bold text-sm mb-1">Secretario</h2>
                <Slot person={roles.secretary?.person || null} onClick={() => setOpenSlot({ roleKey: 'secretary', field: 'person_id' })} />
              </div>
              <div className={`border rounded-lg p-4 ${bgCard}`}>
                <h2 className="font-bold text-sm mb-1">Superintendente de servicio</h2>
                <Slot person={roles.service_overseer?.person || null} onClick={() => setOpenSlot({ roleKey: 'service_overseer', field: 'person_id' })} />
              </div>
            </div>

            {/* Reuniones + otros */}
            <div className="space-y-4">
              <h2 className="font-bold text-sm text-gray-500 dark:text-gray-400">Reuniones</h2>
              {meetingRoles.map(({ roleKey, label }) => {
                const r = roles[roleKey];
                return (
                  <div key={roleKey} className={`border rounded-lg p-4 ${bgCard}`}>
                    <h3 className="font-semibold text-sm mb-2">{label}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <Slot person={r?.person || null} onClick={() => setOpenSlot({ roleKey, field: 'person_id' })} />
                      <Slot label="(Ayudante)" person={r?.assistant_1 || null} onClick={() => setOpenSlot({ roleKey, field: 'assistant_1_id' })} />
                      <Slot label="(Ayudante)" person={r?.assistant_2 || null} onClick={() => setOpenSlot({ roleKey, field: 'assistant_2_id' })} />
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => router.push('/congregation')}
                className={`w-full flex items-center gap-2 border rounded-lg p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${bgCard}`}
              >
                <HomeIcon size={16} /> <span className="font-semibold text-sm">Salón del Reino</span>
                <span className="text-xs text-gray-400 ml-auto">Editar en Información de la Congregación →</span>
              </button>

              <div className={`border rounded-lg p-4 ${bgCard}`}>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Sliders size={16} /> Personalizado</h3>
                <input
                  className="w-full mb-2 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900"
                  placeholder="Nombre de la responsabilidad"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  onBlur={saveCustomLabel}
                />
                <Slot person={roles.custom?.person || null} onClick={() => setOpenSlot({ roleKey: 'custom', field: 'person_id' })} />
              </div>
            </div>
          </div>
        )}
      </div>

      {openSlot && (
        <PersonPickerModal
          title={roles[openSlot.roleKey]?.label || ''}
          persons={persons}
          selectedId={
            openSlot.field === 'person_id' ? roles[openSlot.roleKey]?.person?.id
              : openSlot.field === 'assistant_1_id' ? roles[openSlot.roleKey]?.assistant_1?.id
              : roles[openSlot.roleKey]?.assistant_2?.id
          }
          onSelect={id => assign(openSlot.roleKey, openSlot.field, id)}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
