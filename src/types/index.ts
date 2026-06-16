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

// ─── Persons List (NW Scheduler-style) ────────────────────────────────────────

export type PersonGender = 'male' | 'female';
export type PersonStatus = 'active' | 'moved' | 'removed';

export interface Person {
  id: string;
  // Names
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  display_name: string | null;
  // Contact
  phone1: string | null;
  phone2: string | null;
  address: string | null;
  lat_lng: string | null;
  email1: string | null;
  email2: string | null;
  // Personal
  gender: PersonGender;
  date_of_birth: string | null; // ISO date (YYYY-MM-DD)
  family_id: string | null;
  is_family_head: boolean;
  notes: string | null;
  // Status
  status: PersonStatus;
  moved_date: string | null;
  moved_to_congregation: string | null;
  is_active: boolean;
  // Spiritual privileges
  is_publisher: boolean;
  is_unbaptized_publisher: boolean;
  is_elder: boolean;
  is_ministerial_servant: boolean;
  // Pioneers
  is_regular_pioneer: boolean;
  is_auxiliary_pioneer: boolean;
  is_special_pioneer: boolean;
  auxiliary_pioneer_this_month: boolean;
  // Assignment capabilities (used by auto-assign)
  can_be_chairman: boolean;
  can_be_speaker: boolean;
  speaker_local?: boolean;
  speaker_visiting?: boolean;
  can_do_gems: boolean;
  can_do_bible_reading: boolean;
  can_do_student_parts: boolean;
  can_be_assistant: boolean;
  can_do_prayers: boolean;
  can_be_cbs_conductor: boolean;
  can_be_cbs_reader: boolean;
  // Other person information
  is_elderly: boolean;
  is_infirm: boolean;
  is_child: boolean;
  is_deaf: boolean;
  is_blind: boolean;
  is_anointed: boolean;
  has_kh_key: boolean;
  is_ldc_volunteer: boolean;
  reports_directly_to_branch: boolean;
  custom_information: boolean;
  custom_spiritual_1: boolean;
  custom_spiritual_2: boolean;
  custom_spiritual_3: boolean;
  custom_spiritual_4: boolean;
  custom_spiritual_5: boolean;
  custom_spiritual_6: boolean;
  disable_app_access: boolean;
  // Availability (legacy)
  available_start: string | null;
  available_end: string | null;
  // Convenience computed fields
  family_head?: boolean; // alias for is_family_head
  person_type?: 'elder' | 'ministerial_servant' | 'special_pioneer' | 'regular_pioneer' | 'auxiliary_pioneer' | 'publisher' | 'unbaptized_publisher' | 'child';
}

// ─── Weekend Meeting / Public Talks ───────────────────────────────────────────

export interface PublicTalkOutline {
  id: string;
  number: number;
  title: string;
  created_at?: string;
  updated_at?: string;
  // joined from history
  last_given_date?: string | null;
  last_given_speaker?: string | null;
}

export interface PublicSpeaker {
  id: string;
  name: string;
  congregation: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  outline_numbers: number[];
  notes?: string | null;
  created_at?: string;
  // joined
  last_given_date?: string | null;
}

export type WeekendSpeakerType = 'local' | 'visiting' | 'other';

export interface WeekendMeeting {
  id: string;
  date: string;
  speaker_type: WeekendSpeakerType;
  local_speaker_id?: string | null;
  visiting_speaker_id?: string | null;
  other_speaker_name?: string | null;
  outline_id?: string | null;
  special_talk_title?: string | null;
  song?: number | null;
  speaker_confirmed?: boolean;
  notes?: string | null;
  chairman_id?: string | null;
  wt_conductor_id?: string | null;
  wt_reader_id?: string | null;
  hospitality_person_id?: string | null;
  hospitality_text?: string | null;
  cleaning_group?: string | null;
  // joined
  outline?: PublicTalkOutline | null;
  local_speaker?: Pick<Person, 'id' | 'first_name' | 'last_name' | 'display_name'> | null;
  visiting_speaker?: PublicSpeaker | null;
  chairman?: Pick<Person, 'id' | 'first_name' | 'last_name'> | null;
  wt_conductor?: Pick<Person, 'id' | 'first_name' | 'last_name'> | null;
  wt_reader?: Pick<Person, 'id' | 'first_name' | 'last_name'> | null;
  hospitality_person?: Pick<Person, 'id' | 'first_name' | 'last_name'> | null;
}

export type PersonFilter =
  | 'everyone'
  | 'families'
  | 'active_publishers'
  | 'irregular_publishers'
  | 'inactive_publishers'
  | 'publishers'
  | 'unbaptized_publishers'
  | 'non_publishers'
  | 'elders'
  | 'ministerial_servants'
  | 'appointed_brothers'
  | 'non_appointed_active_brothers'
  | 'brothers'
  | 'sisters'
  | 'all_pioneers'
  | 'special_pioneers'
  | 'regular_pioneers'
  | 'auxiliary_pioneers'
  | 'family_heads'
  | 'elderly'
  | 'children'
  | 'blind'
  | 'deaf'
  | 'anointed'
  | 'ldc_volunteers'
  | 'kh_key'
  | 'custom_spiritual_1'
  | 'custom_spiritual_2'
  | 'custom_spiritual_3'
  | 'custom_spiritual_4'
  | 'custom_spiritual_5'
  | 'custom_spiritual_6'
  | 'reports_directly_to_branch'
  | 'removed'
  | 'moved';

export interface CongregationSettings {
  id: string;
  name: string | null;
  number: string | null;
  congregation_id: string | null;
  language: string | null;
  time_zone: string | null;
  weekend_meeting_day: string | null;
  weekend_meeting_time: string | null;
  midweek_meeting_day: string | null;
  midweek_meeting_time: string | null;
  zoom_meeting_id: string | null;
  zoom_password: string | null;
  zoom_link: string | null;
  dial_in_number: string | null;
  kingdom_hall_address: string | null;
  circuit: string | null;
  co_name: string | null;
  co_contact_details: string | null;
}
