'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Trash2, Edit3, X, ChevronDown, Save, Phone, Mail, MapPin, Calendar, Heart, ArrowRightLeft, BookOpen, AlertTriangle, UserCircle2, Users as UsersIcon, Filter, ListChecks, User as UserIcon,
} from 'lucide-react';
import type { Person, PersonFilter, PersonStatus, PersonGender } from '@/types';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const FILTER_VALUES: PersonFilter[] = [
  'everyone', 'families', 'active_publishers', 'irregular_publishers', 'inactive_publishers',
  'publishers', 'unbaptized_publishers', 'non_publishers', 'elders', 'ministerial_servants',
  'appointed_brothers', 'non_appointed_active_brothers', 'brothers', 'sisters', 'all_pioneers',
  'special_pioneers', 'regular_pioneers', 'auxiliary_pioneers', 'family_heads', 'elderly',
  'children', 'blind', 'deaf', 'anointed', 'ldc_volunteers', 'kh_key',
  'custom_spiritual_1', 'custom_spiritual_2', 'custom_spiritual_3', 'custom_spiritual_4',
  'custom_spiritual_5', 'custom_spiritual_6', 'reports_directly_to_branch', 'moved', 'removed',
];

type Tab = 'info' | 'spiritual' | 'assign' | 'publisher' | 'emergency';

const TAB_VALUES: Tab[] = ['info', 'spiritual', 'assign', 'publisher', 'emergency'];

function fullName(p: Person | null | undefined): string {
  if (!p) return '';
  return [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(' ') || p.display_name || 'Unnamed';
}

function initials(p: Person | null | undefined): string {
  if (!p) return '?';
  const f = (p.first_name || '')[0] || '';
  const l = (p.last_name || '')[0] || '';
  return (f + l).toUpperCase() || '?';
}

function personRole(p: Person, t: (k: string) => string): string {
  if (p.is_elder) return t('persons.role.elder');
  if (p.is_ministerial_servant) return t('persons.role.ms');
  if (p.is_special_pioneer) return t('persons.role.specialPioneer');
  if (p.is_regular_pioneer) return t('persons.role.regularPioneer');
  if (p.is_auxiliary_pioneer || p.auxiliary_pioneer_this_month) return t('persons.role.auxPioneer');
  if (p.is_publisher) return t('persons.role.publisher');
  if (p.is_unbaptized_publisher) return t('persons.role.unbaptized');
  if (p.is_child) return t('persons.role.child');
  return p.gender === 'male' ? t('persons.role.brother') : t('persons.role.sister');
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

interface PersonEditorProps {
  person: Partial<Person> | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function PersonEditor({ person, isNew, onClose, onSaved }: PersonEditorProps) {
  const { t } = useT();
  const [form, setForm] = useState<Partial<Person>>(person || { gender: 'male', is_active: true, is_publisher: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('info');

  const handleChange = (k: keyof Person | string, v: unknown) => {
    setForm((prev) => ({ ...prev, [k]: v as Person[keyof Person] }));
  };

  const handleSave = async () => {
    if (!form.first_name || !form.first_name.trim()) {
      setError(t('persons.firstNameRequired'));
      setTab('info');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isNew ? '/api/persons' : `/api/persons/${person!.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Save failed');
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-semibold">
              {initials(form as Person)}
            </div>
            <div>
              <div className="font-semibold">{isNew ? t('persons.newPersonTitle') : fullName(form as Person)}</div>
              {!isNew && person?.id && (
                <div className="text-xs text-gray-500">{person.id.slice(0, 8)}…</div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          {TAB_VALUES.map((v) => {
            const icons: Record<Tab, React.ReactNode> = {
              info: <UserIcon size={14} />,
              spiritual: <Heart size={14} />,
              assign: <ListChecks size={14} />,
              publisher: <BookOpen size={14} />,
              emergency: <AlertTriangle size={14} />,
            };
            return (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-colors ${
                  tab === v
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {icons[v]}
                {t(`persons.tab.${v}`)}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}

          {tab === 'info' && (
            <div className="space-y-3">
              <Section title={t('persons.section.name')}>
                <Grid>
                  <Field label={t('persons.firstName')}>
                    <input className={inputCls} value={form.first_name || ''} onChange={(e) => handleChange('first_name', e.target.value)} />
                  </Field>
                  <Field label={t('persons.middleName')}>
                    <input className={inputCls} value={form.middle_name || ''} onChange={(e) => handleChange('middle_name', e.target.value)} />
                  </Field>
                  <Field label={t('persons.lastName')}>
                    <input className={inputCls} value={form.last_name || ''} onChange={(e) => handleChange('last_name', e.target.value)} />
                  </Field>
                  <Field label={t('persons.suffix')}>
                    <input className={inputCls} value={form.suffix || ''} onChange={(e) => handleChange('suffix', e.target.value)} />
                  </Field>
                </Grid>
              </Section>

              <Section title={t('persons.section.personal')}>
                <Grid>
                  <Field label={t('persons.gender')}>
                    <select className={inputCls} value={form.gender || 'male'} onChange={(e) => handleChange('gender', e.target.value as PersonGender)}>
                      <option value="male">{t('persons.gender.male')}</option>
                      <option value="female">{t('persons.gender.female')}</option>
                    </select>
                  </Field>
                  <Field label={t('persons.dob')}>
                    <input type="date" className={inputCls} value={form.date_of_birth || ''} onChange={(e) => handleChange('date_of_birth', e.target.value)} />
                  </Field>
                  <Field label={t('persons.familyHead')}>
                    <Toggle value={!!form.is_family_head} onChange={(v) => handleChange('is_family_head', v)} />
                  </Field>
                </Grid>
              </Section>

              <Section title={t('persons.section.contact')}>
                <Grid>
                  <Field label={t('persons.phone1')}>
                    <input className={inputCls} value={form.phone1 || ''} onChange={(e) => handleChange('phone1', e.target.value)} />
                  </Field>
                  <Field label={t('persons.phone2')}>
                    <input className={inputCls} value={form.phone2 || ''} onChange={(e) => handleChange('phone2', e.target.value)} />
                  </Field>
                  <Field label={t('persons.email1')}>
                    <input className={inputCls} value={form.email1 || ''} onChange={(e) => handleChange('email1', e.target.value)} />
                  </Field>
                  <Field label={t('persons.email2')}>
                    <input className={inputCls} value={form.email2 || ''} onChange={(e) => handleChange('email2', e.target.value)} />
                  </Field>
                </Grid>
                <Field label={t('persons.address')}>
                  <input className={inputCls} value={form.address || ''} onChange={(e) => handleChange('address', e.target.value)} />
                </Field>
                <Field label={t('persons.latLng')}>
                  <input className={inputCls} placeholder="40.7128, -74.0060" value={form.lat_lng || ''} onChange={(e) => handleChange('lat_lng', e.target.value)} />
                </Field>
              </Section>

              <Section title={t('persons.section.status')}>
                <Grid>
                  <Field label={t('persons.status')}>
                    <select className={inputCls} value={form.status || 'active'} onChange={(e) => handleChange('status', e.target.value as PersonStatus)}>
                      <option value="active">{t('persons.status.active')}</option>
                      <option value="moved">{t('persons.status.moved')}</option>
                      <option value="removed">{t('persons.status.removed')}</option>
                    </select>
                  </Field>
                  <Field label={t('persons.movedDate')}>
                    <input type="date" className={inputCls} value={form.moved_date || ''} onChange={(e) => handleChange('moved_date', e.target.value)} />
                  </Field>
                  <Field label={t('persons.movedTo')} className="col-span-2">
                    <input className={inputCls} value={form.moved_to_congregation || ''} onChange={(e) => handleChange('moved_to_congregation', e.target.value)} />
                  </Field>
                </Grid>
                <Field label={t('persons.notes')}>
                  <textarea rows={2} className={inputCls} value={form.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} />
                </Field>
              </Section>
            </div>
          )}

          {tab === 'spiritual' && (
            <div className="space-y-3">
              <Section title={t('persons.section.privileges')}>
                <Grid>
                  <Field label={t('persons.publisher')}><Toggle value={!!form.is_publisher} onChange={(v) => handleChange('is_publisher', v)} /></Field>
                  <Field label={t('persons.unbaptized')}><Toggle value={!!form.is_unbaptized_publisher} onChange={(v) => handleChange('is_unbaptized_publisher', v)} /></Field>
                  <Field label={t('persons.elder')}><Toggle value={!!form.is_elder} onChange={(v) => handleChange('is_elder', v)} /></Field>
                  <Field label={t('persons.ms')}><Toggle value={!!form.is_ministerial_servant} onChange={(v) => handleChange('is_ministerial_servant', v)} /></Field>
                </Grid>
              </Section>
              <Section title={t('persons.section.pioneers')}>
                <Grid>
                  <Field label={t('persons.specialPioneer')}><Toggle value={!!form.is_special_pioneer} onChange={(v) => handleChange('is_special_pioneer', v)} /></Field>
                  <Field label={t('persons.regularPioneer')}><Toggle value={!!form.is_regular_pioneer} onChange={(v) => handleChange('is_regular_pioneer', v)} /></Field>
                  <Field label={t('persons.auxPioneer')}><Toggle value={!!form.is_auxiliary_pioneer} onChange={(v) => handleChange('is_auxiliary_pioneer', v)} /></Field>
                  <Field label={t('persons.auxThisMonth')}><Toggle value={!!form.auxiliary_pioneer_this_month} onChange={(v) => handleChange('auxiliary_pioneer_this_month', v)} /></Field>
                </Grid>
              </Section>
              <Section title={t('persons.section.other')}>
                <Grid>
                  <Field label={t('persons.anointed')}><Toggle value={!!form.is_anointed} onChange={(v) => handleChange('is_anointed', v)} /></Field>
                  <Field label={t('persons.reportsToBranch')}><Toggle value={!!form.reports_directly_to_branch} onChange={(v) => handleChange('reports_directly_to_branch', v)} /></Field>
                  <Field label={t('persons.ldcVolunteer')}><Toggle value={!!form.is_ldc_volunteer} onChange={(v) => handleChange('is_ldc_volunteer', v)} /></Field>
                  <Field label={t('persons.hasKhKey')}><Toggle value={!!form.has_kh_key} onChange={(v) => handleChange('has_kh_key', v)} /></Field>
                </Grid>
              </Section>
              <Section title={t('persons.section.customSpiritual')}>
                <Grid>
                  <Field label={t('persons.custom1')}><Toggle value={!!form.custom_spiritual_1} onChange={(v) => handleChange('custom_spiritual_1', v)} /></Field>
                  <Field label={t('persons.custom2')}><Toggle value={!!form.custom_spiritual_2} onChange={(v) => handleChange('custom_spiritual_2', v)} /></Field>
                  <Field label={t('persons.custom3')}><Toggle value={!!form.custom_spiritual_3} onChange={(v) => handleChange('custom_spiritual_3', v)} /></Field>
                  <Field label={t('persons.custom4')}><Toggle value={!!form.custom_spiritual_4} onChange={(v) => handleChange('custom_spiritual_4', v)} /></Field>
                  <Field label={t('persons.custom5')}><Toggle value={!!form.custom_spiritual_5} onChange={(v) => handleChange('custom_spiritual_5', v)} /></Field>
                  <Field label={t('persons.custom6')}><Toggle value={!!form.custom_spiritual_6} onChange={(v) => handleChange('custom_spiritual_6', v)} /></Field>
                </Grid>
              </Section>
            </div>
          )}

          {tab === 'assign' && (
            <div className="space-y-3">
              <Section title={t('persons.section.assignment')}>
                <Grid>
                  <Field label={t('persons.chairman')}><Toggle value={!!form.can_be_chairman} onChange={(v) => handleChange('can_be_chairman', v)} /></Field>
                  <Field label={t('persons.speaker')}><Toggle value={!!form.can_be_speaker} onChange={(v) => handleChange('can_be_speaker', v)} /></Field>
                  <Field label={t('persons.gems')}><Toggle value={!!form.can_do_gems} onChange={(v) => handleChange('can_do_gems', v)} /></Field>
                  <Field label={t('persons.bibleReadingAssign')}><Toggle value={!!form.can_do_bible_reading} onChange={(v) => handleChange('can_do_bible_reading', v)} /></Field>
                  <Field label={t('persons.studentParts')}><Toggle value={!!form.can_do_student_parts} onChange={(v) => handleChange('can_do_student_parts', v)} /></Field>
                  <Field label={t('persons.assistantAssign')}><Toggle value={!!form.can_be_assistant} onChange={(v) => handleChange('can_be_assistant', v)} /></Field>
                  <Field label={t('persons.prayers')}><Toggle value={!!form.can_do_prayers} onChange={(v) => handleChange('can_do_prayers', v)} /></Field>
                  <Field label={t('persons.cbsConductorAssign')}><Toggle value={!!form.can_be_cbs_conductor} onChange={(v) => handleChange('can_be_cbs_conductor', v)} /></Field>
                  <Field label={t('persons.cbsReaderAssign')}><Toggle value={!!form.can_be_cbs_reader} onChange={(v) => handleChange('can_be_cbs_reader', v)} /></Field>
                </Grid>
                <p className="text-xs text-gray-500 mt-1">These settings are used by the auto-assign feature on the Meetings page.</p>
              </Section>
            </div>
          )}

          {tab === 'publisher' && (
            <div className="space-y-3">
              <Section title={t('persons.section.personalStatus')}>
                <Grid>
                  <Field label={t('persons.active')}><Toggle value={!!form.is_active} onChange={(v) => handleChange('is_active', v)} /></Field>
                  <Field label={t('persons.elderly')}><Toggle value={!!form.is_elderly} onChange={(v) => handleChange('is_elderly', v)} /></Field>
                  <Field label={t('persons.infirm')}><Toggle value={!!form.is_infirm} onChange={(v) => handleChange('is_infirm', v)} /></Field>
                  <Field label={t('persons.child')}><Toggle value={!!form.is_child} onChange={(v) => handleChange('is_child', v)} /></Field>
                  <Field label={t('persons.blind')}><Toggle value={!!form.is_blind} onChange={(v) => handleChange('is_blind', v)} /></Field>
                  <Field label={t('persons.deaf')}><Toggle value={!!form.is_deaf} onChange={(v) => handleChange('is_deaf', v)} /></Field>
                </Grid>
              </Section>
              <Section title={t('persons.section.availability')}>
                <Grid>
                  <Field label={t('persons.availFrom')}>
                    <input type="time" className={inputCls} value={form.available_start || ''} onChange={(e) => handleChange('available_start', e.target.value)} />
                  </Field>
                  <Field label={t('persons.availUntil')}>
                    <input type="time" className={inputCls} value={form.available_end || ''} onChange={(e) => handleChange('available_end', e.target.value)} />
                  </Field>
                </Grid>
              </Section>
            </div>
          )}

          {tab === 'emergency' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Use the Contact section on the Information tab to store primary phone numbers used in emergencies. An Emergency Contact reference can be added later in a follow-up update.</p>
              <Section title={t('persons.section.emergency')}>
                <Grid>
                  <Field label={t('persons.phone1')}><div className="text-sm text-gray-700">{form.phone1 || '—'}</div></Field>
                  <Field label={t('persons.phone2')}><div className="text-sm text-gray-700">{form.phone2 || '—'}</div></Field>
                  <Field label={t('persons.email1')}><div className="text-sm text-gray-700">{form.email1 || '—'}</div></Field>
                </Grid>
              </Section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">{t('persons.cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50 flex items-center gap-1">
            <Save size={14} />
            {saving ? t('persons.saving') : t('persons.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-400';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-600 mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-sky-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

export default function PersonsPage() {
  const { t } = useT();
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PersonFilter>('everyone');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPerson, setEditorPerson] = useState<Partial<Person> | null>(null);
  const [editorIsNew, setEditorIsNew] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const [detailTab, setDetailTab] = useState<Tab>('info');

  const fetchPersons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filter) params.set('filter', filter);
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/persons?${params.toString()}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to fetch persons');
      setPersons(result.persons || []);
      setMigrationPending(!!result.migrationPending);
      // Auto-select first
      if (!selectedId && (result.persons || []).length > 0) {
        setSelectedId(result.persons[0].id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter, search, selectedId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetchPersons();
  }, [fetchPersons]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const selected = useMemo(() => persons.find((p) => p.id === selectedId) || null, [persons, selectedId]);

  const handleAdd = () => {
    setEditorPerson({ gender: 'male', is_active: true, is_publisher: true, status: 'active' });
    setEditorIsNew(true);
    setEditorOpen(true);
  };

  const handleEdit = (p: Person) => {
    setEditorPerson(p);
    setEditorIsNew(false);
    setEditorOpen(true);
  };

  const handleDelete = async (p: Person) => {
    if (!confirm(`Delete ${fullName(p)}? If they are assigned to meetings, they will be marked as removed instead.`)) return;
    try {
      const res = await fetch(`/api/persons/${p.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Delete failed');
      if (result.soft) alert(result.message);
      if (selectedId === p.id) setSelectedId(null);
      fetchPersons();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleMove = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/persons/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selected, status: 'moved', moved_date: new Date().toISOString().split('T')[0], moved_to_congregation: moveTo || null }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Move failed');
      setMoveOpen(false);
      setMoveTo('');
      fetchPersons();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Move failed');
    }
  };

  const detailTabIcons: Record<Tab, React.ReactNode> = {
    info: <UserIcon size={14} />,
    spiritual: <Heart size={14} />,
    assign: <ListChecks size={14} />,
    publisher: <BookOpen size={14} />,
    emergency: <AlertTriangle size={14} />,
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-sky-500 text-white shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Link href="/meetings" className="text-white/90 hover:text-white text-sm flex items-center gap-1">
              <ChevronDown className="rotate-90" size={16} /> Meetings
            </Link>
            <span className="text-white/60">|</span>
            <h1 className="font-semibold flex items-center gap-2"><UsersIcon size={18} /> Persons</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} className="bg-white text-sky-600 px-3 py-1 rounded text-sm font-medium hover:bg-sky-50 flex items-center gap-1">
              <Plus size={14} /> New Person
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {migrationPending && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 mt-2 max-w-2xl">
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded p-3 shadow flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Database migration not yet applied.</div>
                <div>Open the Supabase SQL Editor and paste the contents of <code className="bg-amber-100 px-1 rounded">update_schema_clm.sql</code>, then click Run. After it completes, refresh this page to enable all fields and filters.</div>
              </div>
            </div>
          </div>
        )}
        {/* Filter sidebar */}
        <aside className="w-60 bg-white border-r flex-shrink-0 overflow-y-auto">
          <div className="p-2 border-b">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><Filter size={12} /> {t('persons.filter')}</div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as PersonFilter)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              {FILTER_VALUES.map((v) => (
                <option key={v} value={v}>{t(`filter.${v}`)}</option>
              ))}
            </select>
          </div>
          <div className="p-2 text-xs text-gray-500">
            {t('persons.count', {
              n: persons.length,
              noun: persons.length === 1 ? t('persons.count.person') : t('persons.count.people'),
            })}
          </div>
        </aside>

        {/* List */}
        <div className="w-80 bg-white border-r flex-shrink-0 flex flex-col">
          <div className="p-2 border-b">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name…"
                className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
            {error && <div className="p-4 text-sm text-red-600">{error}</div>}
            {!loading && !error && persons.length === 0 && (
              <div className="p-4 text-sm text-gray-500 text-center">
                No people found.
                <div className="mt-2">
                  <button onClick={handleAdd} className="text-sky-600 hover:underline text-sm">+ Add the first one</button>
                </div>
              </div>
            )}
            {persons.map((p) => {
              const isActive = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full flex items-center gap-2 p-2 border-b hover:bg-gray-50 text-left ${isActive ? 'bg-sky-50' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {initials(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{fullName(p)}</div>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                      <span>{personRole(p, t)}</span>
                      {p.status === 'moved' && <span className="text-amber-600">• Moved</span>}
                      {p.status === 'removed' && <span className="text-red-600">• Removed</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <main className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <UserCircle2 size={64} className="mb-2 text-gray-300" />
              <div>Select a person from the list to see details</div>
              <button onClick={handleAdd} className="mt-3 text-sky-600 hover:underline text-sm">+ New Person</button>
            </div>
          ) : (
            <div className="p-4 max-w-4xl">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-sky-500 text-white flex items-center justify-center text-xl font-semibold flex-shrink-0">
                  {initials(selected)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-gray-900">{fullName(selected)}</h2>
                  <div className="text-sm text-gray-600">{personRole(selected, t)} • {selected.gender === 'male' ? t('persons.role.brother') : t('persons.role.sister')}</div>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs">
                    {selected.status === 'moved' && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">Moved</span>}
                    {selected.status === 'removed' && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded">Removed</span>}
                    {selected.status === 'active' && <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Active</span>}
                    {ageFromDob(selected.date_of_birth) != null && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{ageFromDob(selected.date_of_birth)} years old</span>
                    )}
                    {selected.is_elder && <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded">Elder</span>}
                    {selected.is_ministerial_servant && <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded">MS</span>}
                    {selected.is_special_pioneer && <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Special Pioneer</span>}
                    {selected.is_regular_pioneer && <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Regular Pioneer</span>}
                    {(selected.is_auxiliary_pioneer || selected.auxiliary_pioneer_this_month) && <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Aux. Pioneer</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleEdit(selected)} className="p-2 hover:bg-gray-100 rounded" title="Edit"><Edit3 size={16} /></button>
                  <button onClick={() => setMoveOpen(true)} className="p-2 hover:bg-gray-100 rounded" title="Move"><ArrowRightLeft size={16} /></button>
                  <button onClick={() => handleDelete(selected)} className="p-2 hover:bg-gray-100 rounded text-red-600" title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>

              {/* Detail tabs */}
              <div className="flex border-b mb-3 overflow-x-auto">
                {TAB_VALUES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setDetailTab(v)}
                    className={`px-3 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-colors ${
                      detailTab === v ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {detailTabIcons[v]} {t(`persons.tab.${v}`)}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="space-y-4">
                {detailTab === 'info' && (
                  <div className="space-y-3">
                    <DetailRow icon={<UserIcon size={14} />} label="Name" value={fullName(selected)} />
                    <DetailRow icon={<Calendar size={14} />} label="Date of birth" value={selected.date_of_birth || '—'} />
                    <DetailRow icon={<Phone size={14} />} label="Phone 1" value={selected.phone1 || '—'} />
                    {selected.phone2 && <DetailRow icon={<Phone size={14} />} label="Phone 2" value={selected.phone2} />}
                    <DetailRow icon={<Mail size={14} />} label="Email" value={selected.email1 || '—'} />
                    {selected.email2 && <DetailRow icon={<Mail size={14} />} label="Email 2" value={selected.email2} />}
                    {selected.address && <DetailRow icon={<MapPin size={14} />} label="Address" value={selected.address} />}
                    {selected.notes && <div className="text-sm"><div className="text-xs text-gray-500">Notes</div><div className="whitespace-pre-wrap">{selected.notes}</div></div>}
                  </div>
                )}

                {detailTab === 'spiritual' && (
                  <div className="space-y-3">
                    <BoolSection title="Privileges" items={[
                      ['Publisher', selected.is_publisher],
                      ['Unbaptized publisher', selected.is_unbaptized_publisher],
                      ['Elder', selected.is_elder],
                      ['Ministerial servant', selected.is_ministerial_servant],
                      ['Anointed', selected.is_anointed],
                    ]} />
                    <BoolSection title="Pioneer service" items={[
                      ['Special pioneer', selected.is_special_pioneer],
                      ['Regular pioneer', selected.is_regular_pioneer],
                      ['Auxiliary pioneer', selected.is_auxiliary_pioneer],
                      ['Auxiliary this month', selected.auxiliary_pioneer_this_month],
                    ]} />
                    <BoolSection title="Other" items={[
                      ['LDC volunteer', selected.is_ldc_volunteer],
                      ['Has KH key', selected.has_kh_key],
                      ['Reports directly to branch', selected.reports_directly_to_branch],
                    ]} />
                  </div>
                )}

                {detailTab === 'assign' && (
                  <BoolSection title="Can be assigned to" items={[
                    ['Chairman', selected.can_be_chairman],
                    ['Speaker', selected.can_be_speaker],
                    ['Treasures (gems)', selected.can_do_gems],
                    ['Bible reading', selected.can_do_bible_reading],
                    ['Student parts', selected.can_do_student_parts],
                    ['Assistant', selected.can_be_assistant],
                    ['Opening/closing prayer', selected.can_do_prayers],
                    ['CBS conductor', selected.can_be_cbs_conductor],
                    ['CBS reader', selected.can_be_cbs_reader],
                  ]} />
                )}

                {detailTab === 'publisher' && (
                  <div className="space-y-3">
                    <BoolSection title="Personal status" items={[
                      ['Active publisher', selected.is_active],
                      ['Elderly', selected.is_elderly],
                      ['Infirm', selected.is_infirm],
                      ['Child', selected.is_child],
                      ['Blind', selected.is_blind],
                      ['Deaf', selected.is_deaf],
                    ]} />
                    <div className="text-sm">
                      <div className="text-xs text-gray-500 mb-1">Availability</div>
                      <div>
                        {selected.available_start && selected.available_end
                          ? `${selected.available_start} – ${selected.available_end}`
                          : 'No availability restrictions set'}
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === 'emergency' && (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">Primary contact information used in emergencies:</div>
                    <DetailRow icon={<Phone size={14} />} label="Phone 1" value={selected.phone1 || '—'} />
                    {selected.phone2 && <DetailRow icon={<Phone size={14} />} label="Phone 2" value={selected.phone2} />}
                    <DetailRow icon={<Mail size={14} />} label="Email" value={selected.email1 || '—'} />
                    {selected.address && <DetailRow icon={<MapPin size={14} />} label="Address" value={selected.address} />}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Editor modal */}
      {editorOpen && (
        <PersonEditor
          key={editorIsNew ? 'new' : (editorPerson?.id || 'edit')}
          person={editorPerson}
          isNew={editorIsNew}
          onClose={() => { setEditorOpen(false); setEditorPerson(null); }}
          onSaved={() => { fetchPersons(); }}
        />
      )}

      {/* Move modal */}
      {moveOpen && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
            <div className="text-lg font-semibold mb-2 flex items-center gap-2"><ArrowRightLeft size={18} /> Move {fullName(selected)}</div>
            <div className="text-sm text-gray-600 mb-3">Mark this person as moved. Their record is kept for history but they will no longer appear in the active list.</div>
            <label className="text-xs text-gray-600">Destination congregation (optional)</label>
            <input
              className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              placeholder="e.g. Eastside Congregation"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setMoveOpen(false); setMoveTo(''); }} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">Cancel</button>
              <button onClick={handleMove} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600">Mark as Moved</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function BoolSection({ title, items }: { title: string; items: [string, boolean | null | undefined][] }) {
  const truthy = items.filter(([, v]) => !!v);
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{title}</div>
      {truthy.length === 0 ? (
        <div className="text-sm text-gray-400 italic">None</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {truthy.map(([label]) => (
            <span key={label} className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded">{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
