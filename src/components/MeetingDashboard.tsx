'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Profile } from '@/types';
import { Plus, Minus, FileText } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { formatWeekRange } from '@/lib/weekLabel';

interface DashboardProps {
  meeting: any | null;
  publishers: Profile[];
  onAutoAssign: () => void;
  onClearAssignments: () => void;
  onRebuildParts: () => void;
  autoAssigning: boolean;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
}

export function MeetingDashboard({
  meeting,
  publishers,
  onAutoAssign,
  onClearAssignments,
  onRebuildParts,
  autoAssigning,
}: DashboardProps) {
  const [formData, setFormData] = useState<any>(null);
  const { t, locale } = useT();

  useEffect(() => {
    if (meeting) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(JSON.parse(JSON.stringify(meeting)));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(null);
    }
  }, [meeting]);

  const saveMeetingData = useCallback(async (dataToSave: any) => {
    if (!dataToSave || !dataToSave.id) return;
    try {
      await fetch(`/api/meetings/${dataToSave.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
    } catch (err) {
      console.error('Save error', err);
    }
  }, []);

  useEffect(() => {
    if (!formData || !meeting) return;
    if (JSON.stringify(formData) === JSON.stringify(meeting)) return;
    const handler = setTimeout(() => { saveMeetingData(formData); }, 1000);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [formData, meeting, saveMeetingData]);

  const handleMeetingChange = (field: string, value: any) => {
    setFormData((prev: any) => {
      const next = { ...prev, [field]: value };
      // Per the user spec: the opening prayer is ALWAYS the chairman.
      // Auto-mirror the chairman onto the opening prayer so the two never
      // drift apart. The opening prayer dropdown is left in place so an
      // elder can still manually override in special cases.
      if (field === 'chairman_id') {
        next.opening_prayer_id = value;
      }
      return next;
    });
  };

  const handlePartChange = (partId: string, field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      parts: prev.parts.map((p: any) => p.id === partId ? { ...p, [field]: value } : p)
    }));
  };

  // Always call hooks first; only render JSX conditionally below
  const allParts = React.useMemo(() => {
    if (!formData?.parts) return [];
    return [...formData.parts].sort((a: any, b: any) => (a.part_number || 0) - (b.part_number || 0));
  }, [formData]);

  if (!formData) {
    return <div className="p-8 text-center text-gray-500">{t('meeting.selectMeeting')}</div>;
  }

  const getWeekLabel = (dateString: string) => {
    if (!dateString) return '';
    // The meeting's date is already a Monday; pass it straight in
    return formatWeekRange(dateString.slice(0, 10), locale);
  };

  const treasuresTalk = allParts.find((p: any) => p.part_type === 'treasures_talk');
  const spiritualGems = allParts.find((p: any) => p.part_type === 'spiritual_gems');
  const bibleReading = allParts.find((p: any) => p.part_type === 'bible_reading');
  const studentParts = allParts.filter((p: any) => p.part_type === 'student_part');
  const livingParts = allParts.filter((p: any) => p.part_type === 'living_part');

  // Build labels that use {n} = part_number
  const num = (n: number) => String(n);
  const treasuresLabel = treasuresTalk ? t('meeting.treasuresTalk', { n: num(treasuresTalk.part_number) }) : '';
  const gemsLabel = spiritualGems ? t('meeting.spiritualGems', { n: num(spiritualGems.part_number) }) : '';
  const bibleReadingLabel = bibleReading ? t('meeting.bibleReading', { n: num(bibleReading.part_number) }) : '';
  const cbsLabel = t('meeting.cbsLabel');

  return (
    <div className="flex flex-col h-full bg-white text-[13px] font-sans">
      {/* Top Title Bar - Gradient Blue */}
      <div className="bg-gradient-to-r from-[#4BA3E3] to-[#31708f] text-white px-3 py-1 flex justify-between items-center shrink-0 border-b border-[#2a6480]">
        <div className="flex items-center gap-2">
           <span className="font-bold text-base tracking-wide">{t('meeting.title')}</span>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-sm">{t('meeting.congregation').split(' ')[0]} <span className="bg-white/20 px-1 rounded-full text-xs">{t('meeting.congregation').split(' ')[1] || ''}</span></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Date and Songs Header */}
        <div className="flex justify-between items-center mb-2 px-2 border-b border-gray-200 pb-1 relative">
           <div className="w-1/3 flex gap-2">
             <button onClick={onAutoAssign} className="bg-blue-100 border border-blue-400 text-blue-800 px-2 py-0.5 rounded text-xs hover:bg-blue-200 shadow-sm">{t('meeting.autoAssign')}</button>
             <button onClick={onClearAssignments} className="bg-gray-100 border border-gray-400 text-gray-800 px-2 py-0.5 rounded text-xs hover:bg-gray-200 shadow-sm">{t('meeting.clear')}</button>
             <button onClick={onRebuildParts} title={t('meeting.rebuildFromJW')} className="bg-amber-100 border border-amber-400 text-amber-800 px-2 py-0.5 rounded text-xs hover:bg-amber-200 shadow-sm">{t('meeting.rebuildFromJW')}</button>
             {autoAssigning && <span className="text-blue-600 font-bold ml-2">...</span>}
           </div>
           <h2 className="w-1/3 text-center text-lg font-bold text-[#d93025]">{getWeekLabel(formData.date)}</h2>
           <div className="w-1/3 flex items-center justify-end gap-1">
              <span className="text-gray-700 font-medium mr-1 text-xs">{t('meeting.songs')}</span>
              <input type="number" className="w-12 border border-gray-300 bg-white p-0.5 text-center text-xs h-6" value={formData.song_opening || ''} onChange={e => handleMeetingChange('song_opening', parseInt(e.target.value))} />
              <input type="number" className="w-12 border border-gray-300 bg-white p-0.5 text-center text-xs h-6" value={formData.song_middle || ''} onChange={e => handleMeetingChange('song_middle', parseInt(e.target.value))} />
              <input type="number" className="w-12 border border-gray-300 bg-white p-0.5 text-center text-xs h-6" value={formData.song_closing || ''} onChange={e => handleMeetingChange('song_closing', parseInt(e.target.value))} />
           </div>
        </div>

        {/* Treasures from God's Word */}
        <div className="mb-2">
           <div className="bg-gradient-to-r from-[#6e6e6e] to-[#8c8c8c] text-white font-bold px-2 py-1 flex items-center gap-2 mb-1">
             <span className="text-sm">{t('meeting.treasuresFromGodsWord')}</span>
           </div>
           <div className="px-1 flex flex-col gap-1.5">
             <div className="flex items-center">
                <label className="w-[120px] text-gray-700 text-right pr-2">{t('meeting.chairman')}</label>
                <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={formData.chairman_id || ''} onChange={e => handleMeetingChange('chairman_id', e.target.value)}>
                  <option value=""></option>
                  {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
                <FileText size={14} className="text-[#3b82f6] ml-1" />
                <div className="flex-1"></div>
                <label className="w-[120px] text-gray-700 text-right pr-2">{t('meeting.openingPrayer')}</label>
                <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={formData.opening_prayer_id || ''} onChange={e => handleMeetingChange('opening_prayer_id', e.target.value)}>
                  <option value=""></option>
                  {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
             </div>

              <div className="flex items-center">
                <div className="w-[120px]"></div>
                <div className="w-[180px]"></div>
                <div className="flex-1"></div>
                <label className="w-[120px] text-gray-700 text-right pr-2">{t('meeting.closingPrayer')}</label>
                <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={formData.closing_prayer_id || ''} onChange={e => handleMeetingChange('closing_prayer_id', e.target.value)}>
                  <option value=""></option>
                  {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </div>

             {treasuresTalk && (
               <div className="flex items-center">
                 <label className="w-[120px] text-gray-700 text-right pr-2">{treasuresLabel}</label>
                 <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={treasuresTalk.assigned_user_id || ''} onChange={e => handlePartChange(treasuresTalk.id, 'assigned_user_id', e.target.value)}>
                     <option value=""></option>
                     {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                 </select>
                 <input type="text" className="w-[300px] border border-gray-300 p-0.5 h-6 ml-2 text-xs" value={treasuresTalk.title || ''} onChange={e => handlePartChange(treasuresTalk.id, 'title', e.target.value)} />
                 <input type="number" className="w-12 border border-gray-300 p-0.5 h-6 text-center text-xs ml-1" value={treasuresTalk.duration_minutes || ''} onChange={e => handlePartChange(treasuresTalk.id, 'duration_minutes', parseInt(e.target.value))} />
                 <span className="text-gray-600 text-xs ml-1">{t('meeting.min')}</span>
                 <div className="flex-1"></div>
                 <label className="w-[120px] text-gray-700 text-right pr-2">{gemsLabel}</label>
                 <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={spiritualGems?.assigned_user_id || ''} onChange={e => spiritualGems && handlePartChange(spiritualGems.id, 'assigned_user_id', e.target.value)}>
                     <option value=""></option>
                     {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                 </select>
                 <FileText size={14} className="text-[#3b82f6] ml-1" />
                 <input type="number" className="w-12 border border-gray-300 p-0.5 h-6 text-center text-xs ml-1" value={spiritualGems?.duration_minutes || ''} onChange={e => spiritualGems && handlePartChange(spiritualGems.id, 'duration_minutes', parseInt(e.target.value))} />
                 <span className="text-gray-600 text-xs ml-1">{t('meeting.min')}</span>
               </div>
             )}

             {bibleReading && (
               <div className="mt-1 border border-[#64a5d8]">
                 <div className="flex border-b border-[#64a5d8] bg-white h-7">
                   <button className="px-4 text-[#005c9e] border-b-[3px] border-[#3eb5f1] font-bold text-xs flex-1 max-w-[100px]">{t('meeting.main')}</button>
                   <button className="px-4 text-white bg-gradient-to-b from-[#40b1e9] to-[#2591ca] text-xs font-semibold flex-1 max-w-[100px]">{t('meeting.aux1')}</button>
                   <div className="flex-1 border-b-[3px] border-[#3eb5f1]"></div>
                   <div className="flex items-center pr-1 border-b-[3px] border-[#3eb5f1]">
                     <span className="text-[11px] text-gray-600 mr-1">{t('meeting.usualNumber')}</span>
                     <button className="bg-gradient-to-b from-[#4fb8ef] to-[#2697ce] text-white border border-[#1b73a2] rounded-sm mr-1 shadow-sm"><Plus size={14}/></button>
                     <button className="bg-gradient-to-b from-[#e3f4fc] to-[#aee1f8] text-[#1b73a2] border border-[#7fcceb] rounded-sm shadow-sm"><Minus size={14}/></button>
                   </div>
                 </div>
                 <div className="p-1.5 flex items-center bg-white h-9">
                    <label className="w-[120px] text-gray-700 text-right pr-2 text-xs font-semibold">{bibleReadingLabel}</label>
                    <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={bibleReading.assigned_user_id || bibleReading.student_id || ''} onChange={e => handlePartChange(bibleReading.id, 'assigned_user_id', e.target.value)}>
                       <option value=""></option>
                       {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                    </select>
                    <input type="text" className="w-[300px] border border-gray-300 p-0.5 h-6 ml-2 text-xs" value={bibleReading.title || ''} onChange={e => handlePartChange(bibleReading.id, 'title', e.target.value)} />
                    <FileText size={14} className="text-[#3b82f6] ml-1" />
                 </div>
               </div>
             )}
           </div>
        </div>

        {/* Apply Yourself to the Field Ministry */}
        <div className="mb-2">
           <div className="bg-gradient-to-r from-[#bc8f27] to-[#d6af53] text-white font-bold px-2 py-1 flex items-center gap-2 mb-1">
             <span className="text-sm">{t('meeting.applyYourself')}</span>
           </div>
            <div className="px-1 flex flex-col gap-1.5">
              {studentParts.map((part: any) => (
                <div key={part.id} className="flex items-center">
                  <label className="w-[28px] text-gray-700 text-right pr-2 text-xs font-semibold">{part.part_number}.</label>
                  <select className="w-[170px] border border-gray-300 p-0.5 h-6 text-xs bg-white text-gray-800" value={part.student_part_type || ''} onChange={e => handlePartChange(part.id, 'student_part_type', e.target.value)}>
                    <option value="starting_conversation">{t('meeting.startingConversation')}</option>
                    <option value="following_up">{t('meeting.followingUp')}</option>
                    <option value="making_disciples">{t('meeting.makingDisciples')}</option>
                    <option value="explaining_beliefs">{t('meeting.explainingBeliefs')}</option>
                    <option value="talk">{t('meeting.talk')}</option>
                  </select>
                  <select className="w-[170px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs ml-1" value={part.assigned_user_id || part.student_id || ''} onChange={e => handlePartChange(part.id, 'assigned_user_id', e.target.value)}>
                       <option value=""></option>
                       {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                  <input type="text" className="w-[260px] border border-gray-300 p-0.5 h-6 ml-2 text-xs" value={part.title || ''} onChange={e => handlePartChange(part.id, 'title', e.target.value)} />
                  <FileText size={14} className="text-[#3b82f6] ml-1" />
                  <input type="number" className="w-10 border border-gray-300 p-0.5 h-6 text-center text-xs ml-1" value={part.duration_minutes || ''} onChange={e => handlePartChange(part.id, 'duration_minutes', parseInt(e.target.value))} />
                  <span className="text-gray-600 text-xs ml-1">{t('meeting.min')}</span>

                  <div className="flex-1"></div>

                  <label className="text-gray-700 text-right pr-2 text-xs">{t('meeting.assistant')}</label>
                  <select className="w-[170px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={part.assistant_user_id || ''} onChange={e => handlePartChange(part.id, 'assistant_user_id', e.target.value)}>
                       <option value=""></option>
                       {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
              ))}
           </div>
        </div>

        {/* Living as Christians */}
        <div className="mb-2">
           <div className="bg-gradient-to-r from-[#942735] to-[#b34856] text-white font-bold px-2 py-1 flex items-center gap-2 mb-1">
             <span className="text-sm">{t('meeting.livingAsChristians')}</span>
           </div>
           <div className="px-1 flex flex-col gap-1.5">
              {livingParts.map((part: any, index: number) => {
                // Alternating bg colors for living parts based on screenshot (blue then yellow then yellow)
                const isBlue = index === 0;
                const inputBg = isBlue ? "bg-[#b4d5eb]" : "bg-[#fdfad4]";
                const titleBg = "bg-white";

                return (
                  <div key={part.id} className="flex items-center">
                    <label className="w-[120px] text-gray-700 pr-2 text-xs">{t('meeting.living', { n: part.part_number })}</label>
                    <select className={`w-[180px] border border-gray-300 ${inputBg} p-0.5 h-6 text-xs`} value={part.assigned_user_id || part.student_id || ''} onChange={e => handlePartChange(part.id, 'assigned_user_id', e.target.value)}>
                         <option value=""></option>
                         {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                    </select>
                    <input type="text" className={`w-[360px] border border-gray-300 p-0.5 h-6 ml-2 text-xs ${titleBg}`} value={part.title || ''} onChange={e => handlePartChange(part.id, 'title', e.target.value)} />
                    <FileText size={14} className="text-[#3b82f6] ml-1" />
                    <input type="number" className="w-10 border border-gray-300 p-0.5 h-6 text-center text-xs ml-1" value={part.duration_minutes || ''} onChange={e => handlePartChange(part.id, 'duration_minutes', parseInt(e.target.value))} />
                    <span className="text-gray-600 text-xs ml-1">{t('meeting.min')}</span>

                    <div className="flex-1"></div>
                   </div>
                 );
               })}
            </div>
         </div>

         {/* Congregation Bible Study — always-visible Conductor + Reader rows */}
         <div className="mb-2">
            <div className="bg-gradient-to-r from-[#942735] to-[#b34856] text-white font-bold px-2 py-1 flex items-center gap-2 mb-1">
              <span className="text-sm">{t('meeting.cbsLabel')}</span>
            </div>
            <div className="px-1 flex flex-col gap-1.5">
              <div className="flex items-center">
                <label className="w-[120px] text-gray-700 text-right pr-2 text-xs">{t('meeting.cbsConductor')}</label>
                <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={formData.cbs_conductor_id || ''} onChange={e => handleMeetingChange('cbs_conductor_id', e.target.value)}>
                  <option value=""></option>
                  {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
                <FileText size={14} className="text-[#3b82f6] ml-1" />
                <span className="w-10 text-center text-gray-600 text-xs ml-1">30</span>
                <span className="text-gray-600 text-xs ml-1">{t('meeting.min')}</span>
              </div>
              <div className="flex items-center">
                <label className="w-[120px] text-gray-700 text-right pr-2 text-xs">{t('meeting.cbsReader')}</label>
                <select className="w-[180px] border border-gray-300 bg-[#b4d5eb] p-0.5 h-6 text-xs" value={formData.cbs_reader_id || ''} onChange={e => handleMeetingChange('cbs_reader_id', e.target.value)}>
                  <option value=""></option>
                  {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
                <div className="w-[66px]"></div>
              </div>
            </div>
         </div>

      </div>
    </div>
  );
}
