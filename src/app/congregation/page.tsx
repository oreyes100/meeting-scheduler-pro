'use client';

import React from 'react';
import { SyncStatus } from '@/components/SyncStatus';
import { Sidebar } from '@/components/Sidebar';
import { CongregationForm } from '@/components/CongregationForm';

export default function CongregationPage() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans">
      <SyncStatus />
      <Sidebar
        meetings={[]}
        activeMeetingId={null}
        setActiveMeetingId={() => {}}
        onPrint={() => {}}
        onNewMeeting={() => {}}
        isCreating={false}
      />
      <div className="flex-1 overflow-hidden">
        <CongregationForm />
      </div>
    </div>
  );
}
