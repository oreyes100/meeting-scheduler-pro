import React from 'react';

interface MeetingOverviewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meeting: any;
  onEdit?: () => void;
}

export function MeetingOverview({ meeting, onEdit }: MeetingOverviewProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-border p-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-text">{meeting.title}</h2>
          <p className="text-text-secondary mt-1">
            {new Date(meeting.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Edit
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-secondary p-4 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-text-secondary">Status</h3>
          <p className="mt-1 text-lg font-semibold">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              meeting.status === 'published' 
                ? 'bg-success-bg text-success border border-success-border' 
                : 'bg-warning-bg text-warning border border-warning-border'
            }`}>
              {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
            </span>
          </p>
        </div>

        <div className="bg-surface-secondary p-4 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-text-secondary">Duration</h3>
          <p className="mt-1 text-lg font-semibold">{meeting.duration_minutes} minutes</p>
        </div>

        <div className="bg-surface-secondary p-4 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-text-secondary">Congregation</h3>
          <p className="mt-1 text-lg font-semibold">Main Hall</p>
        </div>
      </div>
    </div>
  );
}