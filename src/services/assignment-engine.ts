import { MeetingPart, Profile } from '@/types';

interface AssignmentEngineInput {
  parts: MeetingPart[];
  publishers: Profile[];
}

export interface AssignmentEngineOutput {
  assignedParts: MeetingPart[];
  logs: string[];
}

/**
 * Auto-Assignment Engine for CLM Meetings.
 * Uses a greedy selection strategy with availability constraints.
 */
export function autoAssignParts(input: AssignmentEngineInput): AssignmentEngineOutput {
  const { parts, publishers } = input;
  const logs: string[] = [];
  
  // Create a pool of available publishers to prevent double-booking in the same meeting
  const availablePool = [...publishers];
  
  // Deep copy parts to avoid mutating original data
  const updatedParts = parts.map(p => ({ ...p }));

  updatedParts.forEach((part) => {
    // If part already has a speaker or student assigned, skip it
    if (part.speaker_id || part.student_id) {
      logs.push(`Part "${part.title}" already has an assignment. Skipping.`);
      return;
    }

    // 1. Assign a Speaker
    const speakerIndex = availablePool.findIndex(p => p.id !== undefined);
    
    if (speakerIndex !== -1) {
      const speaker = availablePool[speakerIndex];
      part.speaker_id = speaker.id;
      logs.push(`Assigned speaker ${speaker.first_name} to part: ${part.title}`);
      
      // Remove from pool for this meeting iteration to prevent double assignment
      availablePool.splice(speakerIndex, 1);
    } else {
      logs.push(`Warning: No available speaker found for part: ${part.title}`);
    }
  });

  return {
    assignedParts: updatedParts,
    logs
  };
}
