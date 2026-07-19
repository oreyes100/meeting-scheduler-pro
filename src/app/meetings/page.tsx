'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MeetingDashboard } from '@/components/MeetingDashboard';
import { SyncStatus } from '@/components/SyncStatus';
import { Sidebar } from '@/components/Sidebar';
import PrintModal from '@/components/PrintModal';
import { Profile } from '@/types';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [midweekDay, setMidweekDay] = useState<string | null>(null);
  const [auxiliaryRooms, setAuxiliaryRooms] = useState(0);
  const [pending, setPending] = useState(false);
  const flushRef = useRef<(() => void) | null>(null);

  const fetchData = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const meetingsRes = await fetch('/api/meetings');
      const meetingsResult = await meetingsRes.json();
      if (!meetingsRes.ok) throw new Error(meetingsResult.error || 'Failed to fetch meetings');

      let loadedMeetings = meetingsResult.meetings || [];

      // Auto-populate the next 12 weeks if there are gaps
      const existingDates = new Set(loadedMeetings.map((m: any) => m.date?.slice(0, 10)));
      const today = new Date();
      // Find the Monday of this week
      const thisMonday = new Date(today);
      const day = thisMonday.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      thisMonday.setDate(thisMonday.getDate() + diff);
      thisMonday.setHours(0, 0, 0, 0);

      const lookAheadWeeks = 12;
      const created: string[] = [];
      for (let i = 0; i < lookAheadWeeks; i++) {
        const d = new Date(thisMonday);
        d.setDate(d.getDate() + i * 7);
        const iso = d.toISOString().slice(0, 10);
        if (!existingDates.has(iso)) {
          try {
            const r = await fetch('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: iso, duration_minutes: 105 }),
            });
            if (r.ok) {
              const j = await r.json();
              if (j?.meeting?.id) created.push(j.meeting.id);
            }
          } catch {
            // ignore — populate is best-effort
          }
        }
      }
      if (created.length > 0) {
        const refetch = await fetch('/api/meetings');
        const refetched = await refetch.json();
        if (refetched.meetings) loadedMeetings = refetched.meetings;
      }

      setMeetings(loadedMeetings);

      // Select the first meeting by default if none is selected
      if (loadedMeetings.length > 0 && !activeMeetingId) {
        setActiveMeetingId(loadedMeetings[0].id);
      }

      const publishersRes = await fetch('/api/users');
      const publishersResult = await publishersRes.json();
      if (!publishersRes.ok) throw new Error(publishersResult.error || 'Failed to fetch publishers');
      setPublishers(publishersResult.users || []);

      const congRes = await fetch('/api/congregation');
      if (congRes.ok) {
        const congData = await congRes.json();
        const cong = congData.congregation || congData.settings || {};
        setMidweekDay(cong.midweek_meeting_day || null);
        setAuxiliaryRooms(cong.auxiliary_rooms ?? 0);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load scheduling data.';
      console.error('Error fetching scheduling data:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeMeetingId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetchData();
  }, [fetchData]);

  const activeMeeting = meetings.find(m => m.id === activeMeetingId) || null;

  const forceSave = async () => { flushRef.current?.(); };

  const handleSaved = (data: any) => {
    setMeetings(ms => ms.map(m => m.id === data.id ? { ...m, ...data } : m));
  };

  const handleAutoAssign = async () => {
    if (!activeMeetingId) return;
    
    try {
      setAutoAssigning(true);
      setError(null);
      
      const response = await fetch(`/api/meetings/${activeMeetingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to auto-assign parts.');
      }

      const result = await response.json();
      setSuccessMsg(`✅ Success: Auto-assignment completed! ${result.assignedCount} parts assigned.`);
      await fetchData(); // Refresh the UI data

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to auto-assign parts.';
      console.error('Error auto-assigning:', err);
      setError(message);
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleClearAssignments = async () => {
    if (!activeMeetingId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/meetings/${activeMeetingId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to clear assignments.');
      }

      setSuccessMsg('🧹 Success: All assignments cleared!');
      await fetchData();
      
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear assignments.';
      console.error('Error clearing assignments:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRebuildParts = async () => {
    if (!activeMeetingId) return;
    if (!confirm('Rebuild parts from the JW program for this week? Existing assignments will be preserved where possible. This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/meetings/${activeMeetingId}/rebuild-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserveAssignments: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to rebuild parts');
      setSuccessMsg(`✅ Rebuilt ${data.partsCreated} parts from JW program (${data.weekLabel || 'current week'})`);
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rebuild parts';
      setError(message);
    }
  };

  const handleNewMeeting = async (specificDate?: string) => {
    try {
      setIsCreating(true);
      setError(null);

      let formattedDate: string;
      if (specificDate) {
        formattedDate = specificDate;
      } else {
        const nextDate = new Date();
        if (meetings.length > 0) {
          const lastMeeting = meetings[meetings.length - 1];
          const lastDate = new Date(lastMeeting.date);
          nextDate.setTime(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
        formattedDate = nextDate.toISOString().split('T')[0];
      }

      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Life and Ministry Meeting',
          date: formattedDate,
          duration_minutes: 105
        })
      });

      if (!response.ok) throw new Error('Failed to create meeting');
      
      const data = await response.json();
      setSuccessMsg('✅ New meeting created successfully!');
      await fetchData();
      setActiveMeetingId(data.meeting.id);
      
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create meeting.';
      console.error('Error creating meeting:', err);
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900 font-sans pb-[52px] md:pb-0">
      <SyncStatus pending={pending} onSync={forceSave} />
      {/* Sidebar */}
      <Sidebar 
        meetings={meetings}
        activeMeetingId={activeMeetingId} 
        setActiveMeetingId={setActiveMeetingId} 
        onPrint={() => setPrintModalOpen(true)} 
        onNewMeeting={handleNewMeeting}
        isCreating={isCreating}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
          <MeetingDashboard
            meeting={activeMeeting}
            publishers={publishers}
            onAutoAssign={handleAutoAssign}
            onClearAssignments={handleClearAssignments}
            onRebuildParts={handleRebuildParts}
            autoAssigning={autoAssigning}
            loading={loading}
            error={error}
            successMsg={successMsg}
            midweekMeetingDay={midweekDay}
            auxiliaryRooms={auxiliaryRooms}
            onPrint={() => setPrintModalOpen(true)}
            onDirtyChange={setPending}
            registerFlush={(fn) => { flushRef.current = fn; }}
            onSaved={handleSaved}
          />
        </main>
      </div>

      {/* Print Modal */}
      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        selectedMeeting={activeMeeting}
        allMeetings={meetings}
        publishers={publishers}
        auxiliaryRooms={auxiliaryRooms}
      />
    </div>
  );
}