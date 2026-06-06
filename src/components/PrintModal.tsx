'use client';

import React, { useState } from 'react';
import { X, Printer, FileText, Calendar, UserCheck, ShieldAlert } from 'lucide-react';
import { Profile } from '@/types';

interface User {
  id: string;
  name: string;
}

interface Part {
  id: string;
  meeting_id: string;
  class_type: 'main' | 'aux_1' | 'aux_2';
  part_type: string;
  part_number: number;
  title: string;
  duration_minutes: number;
  assigned_user_id: string | null;
  assistant_user_id: string | null;
  study_point?: string;
  student_part_type?: string;
  users?: User | null;
  assistant?: User | null;
  role?: string;
}

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMeeting: any | null;
  allMeetings: any[];
  publishers: Profile[];
}

type ReportType = 's140' | 's89' | 'chairman' | 'worksheet';

export default function PrintModal({ isOpen, onClose, selectedMeeting, allMeetings }: PrintModalProps) {
  const [reportType, setReportType] = useState<ReportType>('s140');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (selectedMeeting) {
      return selectedMeeting.date.substring(0, 7); // "YYYY-MM"
    }
    return new Date().toISOString().substring(0, 7);
  });

  if (!isOpen) return null;

  // Filter meetings for the selected month (S-140 monthly schedule)
  const monthlyMeetings = allMeetings.filter(m => m.date.startsWith(selectedMonth));

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getMonthName = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Unique months list for selector
  const availableMonths = Array.from(new Set(allMeetings.map(m => m.date.substring(0, 7)))).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in print:p-0 print:bg-white print:relative print:inset-auto">
      {/* Print styles to inject locally */}
      <style jsx global>{`
        @media print {
          header, nav, sidebar, footer, .no-print, button, .modal-sidebar {
            display: none !important;
          }
          .print-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
            background: transparent !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .page-break {
            page-break-after: always;
          }
          .s89-slip {
            page-break-inside: avoid;
            border: 1px solid #000 !important;
            margin-bottom: 20px !important;
          }
        }
      `}</style>

      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 print:h-auto print:shadow-none print:border-none">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold">Print Schedule Reports</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content Split */}
        <div className="flex-1 flex overflow-hidden print:overflow-visible">
          
          {/* Left Sidebar Menu (no-print) */}
          <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-4 no-print flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Report Type</label>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setReportType('s140')}
                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2.5 transition-all ${
                      reportType === 's140' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    S-140 Monthly Schedule
                  </button>
                  <button
                    onClick={() => setReportType('s89')}
                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2.5 transition-all ${
                      reportType === 's89' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    S-89 Assignment Slips
                  </button>
                  <button
                    onClick={() => setReportType('chairman')}
                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2.5 transition-all ${
                      reportType === 'chairman' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    Chairman Outline
                  </button>
                  <button
                    onClick={() => setReportType('worksheet')}
                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2.5 transition-all ${
                      reportType === 'worksheet' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    School Worksheet
                  </button>
                </div>
              </div>

              {/* Month Selector */}
              {reportType === 's140' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    {availableMonths.length > 0 ? (
                      availableMonths.map(m => (
                        <option key={m} value={m}>{getMonthName(m)}</option>
                      ))
                    ) : (
                      <option value={selectedMonth}>{getMonthName(selectedMonth)}</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Print Trigger Button */}
            <button
              onClick={handlePrint}
              className="w-full bg-sky-600 text-white hover:bg-sky-700 py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>

          {/* Right Preview Area */}
          <div className="flex-1 bg-slate-100 p-8 overflow-y-auto print:bg-white print:p-0 print:overflow-visible print:w-full">
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm max-w-3xl mx-auto print:border-none print:shadow-none print:p-0 print:mx-0 print:max-w-none print-area">
              
              {/* Report 1: S-140 Monthly Schedule */}
              {reportType === 's140' && (
                <div>
                  <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 uppercase">Our Christian Life and Ministry Meeting</h1>
                    <h2 className="text-lg font-semibold text-slate-700">{getMonthName(selectedMonth)}</h2>
                  </div>

                  {monthlyMeetings.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      No meetings scheduled for this month.
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {monthlyMeetings.map((m, mIdx) => {
                        const mParts = (m.parts || []) as Part[];
                        const gems = mParts.find((p: Part) => p.part_type === 'spiritual_gems');
                        const treasures = mParts.find((p: Part) => p.part_type === 'treasures_talk');
                        const reading = mParts.find((p: Part) => p.part_type === 'bible_reading');
                        const students = mParts.filter((p: Part) => p.part_type === 'student_part');
                        const livings = mParts.filter((p: Part) => p.part_type === 'living_part');

                        return (
                          <div key={m.id} className={`border border-slate-300 rounded-lg p-4 ${mIdx < monthlyMeetings.length - 1 ? 'page-break' : ''}`}>
                            <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3 text-md uppercase">
                              Week of {formatDate(m.date)}
                            </h3>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              {/* Songs & Main Overseers */}
                              <div className="space-y-1 bg-slate-50 p-2 rounded">
                                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Overview</p>
                                <p><strong>Opening Song:</strong> {m.song_opening || '-'}</p>
                                <p><strong>Middle Song:</strong> {m.song_middle || '-'}</p>
                                <p><strong>Closing Song:</strong> {m.song_closing || '-'}</p>
                                <p><strong>Chairman:</strong> {m.chairman?.name || 'TBD'}</p>
                                <p><strong>Opening Prayer:</strong> {m.opening_prayer?.name || 'TBD'}</p>
                                <p><strong>Closing Prayer:</strong> {m.closing_prayer?.name || 'TBD'}</p>
                              </div>

                              {/* Treasures */}
                              <div className="space-y-1 bg-slate-50 p-2 rounded">
                                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Treasures</p>
                                <p><strong>Talk:</strong> {treasures?.users?.name || 'TBD'}</p>
                                <p className="text-[10px] text-slate-600 truncate">({treasures?.title})</p>
                                <p><strong>Gems:</strong> {gems?.users?.name || 'TBD'}</p>
                                <p><strong>Gems:</strong> {gems?.users?.name || 'TBD'}</p>
                              </div>

                              {/* Student Work */}
                              <div className="space-y-1 bg-slate-50 p-2 rounded col-span-1 md:col-span-2">
                                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Ministry School</p>
                                <p><strong>Reading:</strong> {reading?.users?.name || 'TBD'}</p>
                                {students.map((s, idx) => (
                                  <div key={s.id} className="pt-0.5 border-t border-slate-200 mt-0.5">
                                    <p className="font-medium text-slate-700">Part {idx + 4}: {s.student_part_type}</p>
                                    <p><strong>Student:</strong> {s.users?.name || 'TBD'}</p>
                                    {s.assistant && <p><strong>Assistant:</strong> {s.assistant?.name}</p>}
                                  </div>
                                ))}
                              </div>

                              {/* Living */}
                              <div className="space-y-1 bg-slate-50 p-2 rounded col-span-2 md:col-span-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-2 mt-2">
                                <div>
                                  <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Christian Living</p>
                                  {livings.map(l => (
                                    <p key={l.id}><strong>{l.title}:</strong> {l.users?.name || 'TBD'}</p>
                                  ))}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Bible Study</p>
                                  <p><strong>CBS Conducer:</strong> {m.cbs_conducer?.name || 'TBD'}</p>
                                  <p><strong>CBS Reader:</strong> {m.cbs_reader?.name || 'TBD'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Report 2: S-89 Assignment Slips */}
              {reportType === 's89' && (
                <div className="space-y-6">
                  {selectedMeeting ? (
                    <div>
                      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2 no-print">
                        S-89 Slips for {formatDate(selectedMeeting.date)}
                      </h2>
                      
                      {(selectedMeeting.parts as Part[]).filter((p: Part) => p.role === 'student').length === 0 ? (
                        <p className="text-center py-6 text-slate-400">No student parts assigned in this meeting.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1">
                          {(selectedMeeting.parts as Part[])
                            .filter((p: Part) => p.role === 'student' && p.assigned_user_id)
                            .map((p: Part) => (
                              <div key={p.id} className="border-2 border-slate-800 p-6 rounded-lg bg-slate-50/50 shadow-sm relative s89-slip max-w-sm mx-auto">
                                <div className="text-center border-b border-slate-800 pb-2 mb-4">
                                  <h3 className="font-bold text-sm tracking-wider uppercase">Our Christian Life and Ministry Meeting Assignment</h3>
                                </div>
                                <div className="space-y-2.5 text-xs">
                                  <p><strong>Name:</strong> <span className="underline font-semibold">{p.users?.name}</span></p>
                                  <p><strong>Assistant:</strong> <span className="underline">{p.assistant?.name || 'None'}</span></p>
                                  <p><strong>Date:</strong> <span className="underline">{formatDate(selectedMeeting.date)}</span></p>
                                  <p><strong>Part:</strong> <span className="font-medium underline">{p.title}</span></p>
                                  <p><strong>Hall:</strong> <span className="underline">{p.class_type === 'main' ? 'Main Hall' : 'Auxiliary Classroom 1'}</span></p>
                                  <p><strong>Study Point:</strong> <span className="underline">{p.study_point || 'None'}</span></p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400 text-center uppercase tracking-wider">
                                  S-89 (10/20)
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      Please select a week in the main view first to print S-89 slips.
                    </div>
                  )}
                </div>
              )}

              {/* Report 3: Chairman Outline */}
              {reportType === 'chairman' && (
                <div>
                  {selectedMeeting ? (
                    <div className="space-y-6">
                      <div className="text-center border-b-2 border-slate-800 pb-2 mb-6">
                        <h1 className="text-2xl font-bold">CHAIRMAN OUTLINE</h1>
                        <p className="text-slate-500 font-medium">Week of {formatDate(selectedMeeting.date)}</p>
                      </div>

                      <div className="space-y-4 text-sm">
                        <div className="border-l-4 border-slate-400 pl-4 py-1">
                          <h3 className="font-bold text-slate-800 uppercase">1. Introduction (5 min)</h3>
                          <p><strong>Opening Song:</strong> Song {selectedMeeting.song_opening || 'TBD'}</p>
                          <p><strong>Opening Prayer:</strong> {selectedMeeting.opening_prayer?.name || 'TBD'}</p>
                          <p><strong>Chairman Comments:</strong> {selectedMeeting.chairman?.name || 'TBD'} introduces the week&apos;s program.</p>
                        </div>

                        <div className="border-l-4 border-emerald-500 pl-4 py-1">
                          <h3 className="font-bold text-emerald-800 uppercase">2. Treasures from God&apos;s Word (24 min)</h3>
                          {(selectedMeeting.parts as Part[])
                            .filter((p: Part) => p.part_type === 'treasures_talk' || p.part_type === 'spiritual_gems')
                            .map((p: Part) => (
                              <div key={p.id} className="mt-2">
                                <p><strong>{p.title} ({p.duration_minutes} min):</strong> {p.users?.name || 'TBD'}</p>
                              </div>
                            ))}
                          {(selectedMeeting.parts as Part[])
                            .filter((p: Part) => p.part_type === 'bible_reading')
                            .map((p: Part) => (
                              <div key={p.id} className="mt-2">
                                <p><strong>{p.title} ({p.duration_minutes} min):</strong> {p.users?.name || 'TBD'} (Class: {p.class_type.toUpperCase()})</p>
                              </div>
                            ))}
                        </div>

                        <div className="border-l-4 border-amber-500 pl-4 py-1">
                          <h3 className="font-bold text-amber-800 uppercase">3. Apply Yourself to the Field Ministry (15 min)</h3>
                          {(selectedMeeting.parts as Part[])
                            .filter((p: Part) => p.part_type === 'student_part')
                            .map((p: Part) => (
                              <div key={p.id} className="mt-2">
                                <p><strong>{p.title} ({p.duration_minutes} min):</strong> {p.users?.name || 'TBD'} {p.assistant && `(Assistant: ${p.assistant.name})`} ({p.class_type.toUpperCase()})</p>
                              </div>
                            ))}
                        </div>

                        <div className="border-l-4 border-rose-500 pl-4 py-1">
                          <h3 className="font-bold text-rose-800 uppercase">4. Living as Christians (45 min)</h3>
                          <p><strong>Middle Song:</strong> Song {selectedMeeting.song_middle || 'TBD'}</p>
                          {(selectedMeeting.parts as Part[])
                            .filter((p: Part) => p.part_type === 'living_part')
                            .map((p: Part) => (
                              <div key={p.id} className="mt-2">
                                <p><strong>{p.title} ({p.duration_minutes} min):</strong> {p.users?.name || 'TBD'}</p>
                              </div>
                            ))}
                          <div className="mt-2">
                            <p><strong>Congregation Bible Study (30 min):</strong> Conducer: {selectedMeeting.cbs_conducer?.name || 'TBD'} / Reader: {selectedMeeting.cbs_reader?.name || 'TBD'}</p>
                          </div>
                          <div className="mt-4 pt-2 border-t border-slate-200">
                            <p><strong>Concluding Comments & Announcements:</strong> {selectedMeeting.chairman?.name || 'TBD'}</p>
                            <p><strong>Closing Song:</strong> Song {selectedMeeting.song_closing || 'TBD'}</p>
                            <p><strong>Closing Prayer:</strong> {selectedMeeting.closing_prayer?.name || 'TBD'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      Please select a week in the main view first to print the Chairman Outline.
                    </div>
                  )}
                </div>
              )}

              {/* Report 4: School Worksheet */}
              {reportType === 'worksheet' && (
                <div>
                  {selectedMeeting ? (
                    <div>
                      <div className="text-center border-b-2 border-slate-800 pb-2 mb-6">
                        <h1 className="text-2xl font-bold">SCHOOL WORKSHEET</h1>
                        <p className="text-slate-500 font-medium">Auxiliary Counselor Outline / Worksheet – {formatDate(selectedMeeting.date)}</p>
                      </div>

                      <div className="space-y-6 text-xs">
                        <table className="w-full border-collapse border border-slate-400">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-400 p-2 text-left">Assignment</th>
                              <th className="border border-slate-400 p-2 text-left">Main Hall</th>
                              <th className="border border-slate-400 p-2 text-left">Aux Class 1</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Bible Reading Row */}
                            <tr>
                              <td className="border border-slate-400 p-2 font-bold">Bible Reading (4 min)</td>
                              <td className="border border-slate-400 p-2">
                                {(selectedMeeting.parts as Part[]).find((p: Part) => p.part_type === 'bible_reading' && p.class_type === 'main')?.users?.name || 'Unassigned'}
                              </td>
                              <td className="border border-slate-400 p-2">
                                {(selectedMeeting.parts as Part[]).find((p: Part) => p.part_type === 'bible_reading' && p.class_type === 'aux_1')?.users?.name || '-'}
                              </td>
                            </tr>
                            
                            {/* Student Parts Rows */}
                            {Array.from(new Set((selectedMeeting.parts as Part[]).filter((p: Part) => p.part_type === 'student_part').map((p: Part) => p.part_number))).sort().map((partNum: number) => {
                              const mainPart = (selectedMeeting.parts as Part[]).find((p: Part) => p.part_number === partNum && p.class_type === 'main');
                              const auxPart = (selectedMeeting.parts as Part[]).find((p: Part) => p.part_number === partNum && p.class_type === 'aux_1');
                              
                              return (
                                <tr key={partNum}>
                                  <td className="border border-slate-400 p-2">
                                    <div className="font-bold">{mainPart?.title || auxPart?.title}</div>
                                    <div className="text-[10px] text-slate-500">Duration: {mainPart?.duration_minutes || auxPart?.duration_minutes} min</div>
                                  </td>
                                  <td className="border border-slate-400 p-2">
                                    {mainPart?.users?.name ? (
                                      <div>
                                        <div><strong>Student:</strong> {mainPart.users.name}</div>
                                        {mainPart.assistant && <div><strong>Assistant:</strong> {mainPart.assistant.name}</div>}
                                        {mainPart.study_point && <div><strong>Point:</strong> {mainPart.study_point}</div>}
                                      </div>
                                    ) : 'Unassigned'}
                                  </td>
                                  <td className="border border-slate-400 p-2">
                                    {auxPart?.users?.name ? (
                                      <div>
                                        <div><strong>Student:</strong> {auxPart.users.name}</div>
                                        {auxPart.assistant && <div><strong>Assistant:</strong> {auxPart.assistant.name}</div>}
                                        {auxPart.study_point && <div><strong>Point:</strong> {auxPart.study_point}</div>}
                                      </div>
                                    ) : (auxPart ? 'Unassigned' : '-')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="mt-8 border-2 border-dashed border-slate-300 p-4 rounded bg-slate-50/50 print:bg-transparent">
                          <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2 text-sm">Counselor Observations & Notes</h4>
                          <div className="h-40"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      Please select a week in the main view first to view the School Worksheet.
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
