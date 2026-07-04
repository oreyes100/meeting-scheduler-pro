'use client';

import React from 'react';
import { SyncStatus } from '@/components/SyncStatus';
import { IconSidebar } from '@/components/IconSidebar';
import { CongregationForm } from '@/components/CongregationForm';

export default function CongregationPage() {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900 font-sans pb-[52px] md:pb-0">
      <SyncStatus />
      <IconSidebar />
      <div className="flex-1 overflow-y-auto">
        <CongregationForm />
      </div>
    </div>
  );
}
