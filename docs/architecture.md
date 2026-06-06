# Meeting Scheduler Pro (MSP) - Architecture Document

## 1. Project Overview
A cloud-based, multi-tenant web application designed to automate the scheduling and management of congregation activities (CLM meetings, Public Talks, Territory, Secretary duties).

**Goal:** Replace legacy desktop software with a modern, responsive, and collaborative web experience.

---

## 2. Technical Stack
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | [Next.js 14 (App Router)](https://nextjs.org/) | Core UI & Routing |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Modern, accessible component library |
| **Database & Backend** | [Supabase](https://supabase.com/) (PostgreSQL) | Relational data, Auth, Realtime, Storage |
| **State Management** | [TanStack Query](https://tanstack.com/query/latest) + [Zustand](https://github.com/pmndrs/zustand) | Server state & Client global state |
| **PDF Generation** | [@react-pdf/renderer](https://react-pdf.org/) | Generating meeting schedules and reports |
| **Email Service** | [Resend](https://resend.com/) | Transactional emails (notifications, alerts) |
    | **Icons** | [Lucide React](https://lucide.dev/) | Clean, lightweight iconography |

---

## 3. High-Level Architecture
The system follows a **Client-Server-Database** pattern with heavy reliance on **Supabase Row Level Security (RLS)** for multi-tenancy.

1.  **Client (Next.js):** Interacts with Supabase via the `@supabase/auth-helpers-nextjs` and fetches data using TanStack Query.
2.  **Edge Logic (Supabase Edge Functions / Next.js API):** Handles heavy computations like PDF generation and triggers email workflows via Resend.
3.  **Security Layer:** Every table in PostgreSQL has RLS enabled. Users can only access data belonging to their `congregation_id`.

---

## 4. Database Schema (ERD - Logical View)

### Core Modules & Entities

#### 👤 Identity & Access (IAM)
- **`profiles`**: `id (uuid, PK)`, `first_name`, `last_name`, `email`, `phone`, `role (enum: admin, secretary, publisher)`, `congregation_id (FK)`.
- **`congregations`**: `id (uuid, PK)`, `name`, `address`, `timezone`.

#### 📅 CLM Meeting Module
- **`clm_meetings`**: `id (uuid, PK)`, `date (timestamp)`, `congregation_id (FK)`, `status (draft, published)`.
- **`meeting_parts`**: `id (uuid, PK)`, `meeting_id (FK)`, `title`, `speaker_id (FK -> profiles.id)`, `student_id (FK -> profiles.id, nullable)`, `order (int)`.

#### 🗺️ Territory & Service Module
- **`territories`**: `id (uuid, PK)`, `name`, `description`, `congregation_id (FK)`.
- **`field_service_reports`**: `id (uuid, PK)`, `date (date)`, `congregation_id (FK)`, `total_hours (float)`, `publisher_count (int)`.

#### 🎤 Public Talk Module
- **`public_talks`**: `id (uuid, PK)`, `date (timestamp)`, `speaker_id (FK)`, `title`, `congregation_id (FK)`.

---

## 5. Key Workflows & Features

### 🤖 Auto-Assignment Algorithm (The "Magic")
1.  **Input:** List of available students and speakers for a specific date.
2.  **Logic:** 
    *   Filter publishers by `role = 'publisher'` and availability.
    *   Check `meeting_parts.history` to ensure rotation (don't assign the same person too frequently).
    *   Prioritize "Students" for auxiliary classes.
3.  **Output:** A populated `meeting_parts` table entry.

### 📧 Notification Pipeline
1.  **Event:** Secretary updates a meeting part.
2.  **Trigger:** Next.js Route Handler / Supabase Webhook.
3.  **Action:** Call Resend API $\rightarrow$ Send email to `speaker_id.email`.

### 📄 PDF Generation Workflow
1.  **Request:** User clicks "Download Schedule".
2.  **Process:** Frontend fetches all `meeting_parts` for the date $\rightarrow$ `@react-pdf/renderer` renders the component in a worker thread $\rightarrow$ Blob generated.
3.  **Delivery:** Trigger browser download.

---

## 6. Security & Multi-tenancy Strategy
All queries must include `WHERE congregation_id = current_user.congregation_id`.
Supabase RLS Policies:
```sql
CREATE POLICY "Users can view their own congregation data"
ON profiles FOR SELECT
USING (congregation_id = (SELECT congregation_id FROM profiles WHERE id = auth.uid()));
```
