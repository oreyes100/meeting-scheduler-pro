export type UserRole = 'admin' | 'secretary' | 'publisher';

export interface Congregation {
  id: string;
  name: string;
  address?: string;
  timezone?: string;
}

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  congregation_id: string;
}

export interface MeetingType {
  id: string;
  date: Date;
  congregation_id: string;
  status: 'draft' | 'published';
}

export interface MeetingPart {
  id: string;
  meeting_id: string;
  title: string;
  speaker_id?: string; // Reference to Profile.id
  student_id?: string; // Reference to Profile.id
  order: number;
}
