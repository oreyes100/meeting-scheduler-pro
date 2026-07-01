# Goal Description
The objective is to completely overhaul the `MeetingsPage` and `MeetingDashboard` to replicate the desktop-like interface of "New World Scheduler" for the "Life and Ministry Meeting", as requested in the screenshot. The new UI will directly bind to the existing Supabase backend schema (meetings and meeting_parts).

## User Review Required
> [!IMPORTANT]
> The requested interface is highly specific and desktop-oriented. We will use standard web components (Tailwind CSS) to emulate the look and feel while keeping it responsive.
> We will replace the current `MeetingDashboard` with a structured form that explicitly maps to the three main sections of the meeting.

## Open Questions
> [!WARNING]
> - Do you want the sidebar's months/weeks to be hardcoded for now, or should it dynamically group existing meetings from the database? (For the first version, I will build it dynamically grouping by month, but if no meetings exist, it might look empty).
> - Should changes be saved automatically as the user types/selects, or do you want a "Save" button? (I will implement a "Save" button at the bottom for now to prevent excessive API calls).

## Proposed Changes

### UI / Layout Update

#### [MODIFY] `src/app/meetings/page.tsx`
- Remove the old generic dashboard layout.
- Implement the "Double Sidebar" layout (mini-icons on the far left, secondary sidebar for congregation/months/weeks).

#### [MODIFY] `src/components/Sidebar.tsx`
- Redesign the sidebar to have the left vertical strip of icons.
- Add the collapsible accordion for Months and Weeks (e.g., "January 2024" -> "January 08-14").

#### [MODIFY] `src/components/MeetingDashboard.tsx`
- Completely remove the generic `MeetingPartCard` grid.
- Create a structured form layout matching the screenshot:
  1. **Top Header**: Date range and "Songs" inputs.
  2. **Treasures from God's Word (Grey)**: Chairman, Opening Prayer, Treasures Talk, Spiritual Gems, Bible Reading.
  3. **Apply Yourself to the Field Ministry (Gold)**: Map over student parts (typically 3 parts), rendering the part type dropdown, student input, title, time, and assistant.
  4. **Living as Christians (Crimson)**: Map over living parts, CBS, CBS Reader, Closing Prayer.
- State binding: Form state will be initialized from the active `meeting` and its `parts`. Dropdowns will use the `publishers` list for selection.

### API / Data Binding

#### [MODIFY] `src/components/MeetingDashboard.tsx` (Data logic)
- When a user is selected for a role (e.g. Chairman), it updates the local state for the `meeting` object.
- When a student is selected for a part, it updates the specific `part` within the `meeting.parts` array.

## Verification Plan

### Manual Verification
- Start the development server (`npm run dev`).
- Navigate to the landing page and confirm it renders the new "New World Scheduler" style interface.
- Ensure the dropdowns for Chairman, Prayers, and Parts populate with the available publishers from the database.
- Ensure the layout correctly groups the parts into the three distinct colored sections.
