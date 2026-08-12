import { createClient } from '@supabase/supabase-js';

/**
 * Executes the auto-assignment logic for a specific meeting ID.
 *
 * The app runs self-hosted over a local SQLite database reached through the
 * supabase-compatible shim in `@/lib/db`. Every other route uses `sb()` (the
 * shim), so the auto-assign route MUST pass `sb()` as `customClient` — otherwise
 * assignments are written to a different store than the one the UI reads and
 * they silently appear as "not assigned".
 *
 * @param {string} meetingId
 * @param {any} [customClient]
 * @returns {Promise<{ assignedCount: number, totalCount: number, logs: string[] }>}
 */
export async function runAutoAssignment(meetingId, customClient) {
  const supabase = customClient || createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  const logs = [];
  logs.push(`🤖 Starting auto-assignment for meeting: ${meetingId}`);

  // 1. Fetch the meeting details
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (meetingError || !meeting) {
    throw new Error(`Failed to fetch meeting: ${meetingError?.message || 'Meeting not found'}`);
  }

  if (meeting.assembly_type) {
    logs.push(`ℹ️ Skipping auto-assignment — this week is ${meeting.assembly_type === 'regional' ? 'Asamblea Regional' : 'Asamblea de Circuito'}`);
    return { assignedCount: 0, totalCount: 0, logs };
  }

  // 2. Fetch meeting parts for this meeting
  const { data: parts, error: partsError } = await supabase
    .from('meeting_parts')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('part_number', { ascending: true });

  if (partsError) {
    throw new Error(`Failed to fetch meeting parts: ${partsError.message}`);
  }

  if (!parts || parts.length === 0) {
    logs.push('⚠️ No parts found for this meeting.');
    return { assignedCount: 0, totalCount: 0, logs };
  }

  // 3. Fetch all active publishers (scoped to the congregation when possible)
  let users = [];
  let usersQuery = supabase.from('users').select('*').eq('is_active', true);
  if (meeting.congregation_id) usersQuery = usersQuery.eq('congregation_id', meeting.congregation_id);
  const { data: activeUsers, error: usersError } = await usersQuery;

  if (usersError) {
    // Fallback in case is_active / congregation_id columns don't exist
    const { data: usersFallback, error: fallbackError } = await supabase.from('users').select('*');
    if (fallbackError) throw new Error(`Failed to fetch users: ${fallbackError.message}`);
    users = usersFallback || [];
  } else {
    users = activeUsers || [];
  }

  logs.push(`👥 Loaded ${users.length} active publishers for scheduling.`);

  // 4. Gather assignment history per ROLE so the same person is not picked for
  //    the same assignment two weeks in a row.
  //    historyByRole: "user_id:part_type" -> date string of the last time that
  //    user filled that exact role. Falls back to alphabetical order if no
  //    candidate has any history for the role.
  const historyByRole = {}; // "user_id:part_type" -> ISO date of last assignment
  const bumpHistory = (userId, partType, date) => {
    if (!userId || !partType || !date) return;
    const key = `${userId}:${partType}`;
    const prev = historyByRole[key];
    if (!prev || new Date(date) > new Date(prev)) {
      historyByRole[key] = date;
    }
  };

  // 4a. Pull every past meeting_part with its part_type so we know which role
  //     each assignee last filled. (The previous version omitted part_type and
  //     collapsed all roles into a single per-user date, which caused the same
  //     person to keep landing on the same slot every week.)
  //     Uses explicit queries instead of a nested fkey join (`meetings (date)`)
  //     because the local SQLite shim cannot execute that syntax.
  let pastParts = [];
  const { data: allMeetingDates, error: allMeetingsError } = await supabase
    .from('meetings')
    .select('id, date');
  if (!allMeetingsError && allMeetingDates) {
    const dateByMeetingId = {};
    for (const m of allMeetingDates) dateByMeetingId[m.id] = m.date;

    const { data: pastAssigned } = await supabase
      .from('meeting_parts')
      .select('id, meeting_id, assigned_user_id, assistant_user_id, part_type')
      .not('assigned_user_id', 'is', null);
    const { data: pastAssistants } = await supabase
      .from('meeting_parts')
      .select('id, meeting_id, assigned_user_id, assistant_user_id, part_type')
      .not('assistant_user_id', 'is', null);

    const seen = new Set();
    for (const p of [...(pastAssigned || []), ...(pastAssistants || [])]) {
      if (!p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      pastParts.push({ ...p, date: dateByMeetingId[p.meeting_id] });
    }

    pastParts.forEach(p => {
      const meetingDate = p.date;
      if (!meetingDate) return;
      if (p.part_type && p.assigned_user_id) {
        bumpHistory(p.assigned_user_id, p.part_type, meetingDate);
      }
      // Assistants are logged under their own role key so they don't get
      // pinned back-to-back as assistant on consecutive weeks.
      if (p.assistant_user_id) {
        bumpHistory(p.assistant_user_id, 'assistant', meetingDate);
      }
    });
  }

  // 4b. Also pull part_history which holds meeting-level roles
  //     (chairman, opening_prayer, closing_prayer, cbs_conducer, cbs_reader).
  const { data: customHistory } = await supabase
    .from('part_history')
    .select('user_id, part_type, assigned_date');
  if (customHistory) {
    customHistory.forEach(h => {
      bumpHistory(h.user_id, h.part_type, h.assigned_date);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. MONTH-LEVEL RULE: a publisher must not be used more than once in the
  //    same calendar month — whether as the primary, helper (assistant) or any
  //    meeting-level role (chairman, prayers, CBS). Build the set of user ids
  //    already occupied in the target meeting's month so they are excluded
  //    from every candidate pool.
  // ─────────────────────────────────────────────────────────────────────────
  const targetMonth = meeting.date ? String(meeting.date).slice(0, 7) : null; // "YYYY-MM"
  const usedThisMonth = new Set();
  const markUsed = (uid) => { if (uid) usedThisMonth.add(uid); };

  if (targetMonth) {
    let monthMeetingsQuery = supabase.from('meetings').select('id').ilike('date', `${targetMonth}-%`);
    if (meeting.congregation_id) monthMeetingsQuery = monthMeetingsQuery.eq('congregation_id', meeting.congregation_id);
    const { data: monthMeetings } = await monthMeetingsQuery;
    const monthIds = (monthMeetings || []).map(m => m.id);

    if (monthIds.length) {
      const { data: monthParts } = await supabase
        .from('meeting_parts')
        .select('assigned_user_id, assistant_user_id')
        .in('meeting_id', monthIds);
      (monthParts || []).forEach(p => {
        markUsed(p.assigned_user_id);
        markUsed(p.assistant_user_id);
      });

      const { data: monthHistory } = await supabase
        .from('part_history')
        .select('user_id')
        .in('meeting_id', monthIds);
      (monthHistory || []).forEach(h => markUsed(h.user_id));
    }
  }

  logs.push(`📅 Month rule for ${targetMonth || '(no date)'}: ${usedThisMonth.size} publisher(s) already used this month.`);

  // Array of logs emitted when the strict month rule is broken out of necessity.
  const fallbackLogs = [];

  // Candidate pool builder. Strict = not used in this meeting AND not used this
  // month. If the strict pool is empty we RELAX the month rule (still never
  // double-book within the meeting) so an unassigned part is not left hanging —
  // the alternative would be permanently unassignable parts late in the month.
  const poolFor = (filterFn) => {
    const strict = users.filter(u => !assignedInThisMeeting.has(u.id) && !usedThisMonth.has(u.id) && filterFn(u));
    if (strict.length > 0) return { candidates: strict, monthOverride: false };
    const relaxed = users.filter(u => !assignedInThisMeeting.has(u.id) && filterFn(u));
    return { candidates: relaxed, monthOverride: true };
  };

  // Helper: sort candidates Least-Recently-Assigned for a SPECIFIC role.
  // Users who never did this role come first, then oldest-dated users, with
  // alphabetical name as a stable tie-breaker.
  const getLRASortedUsers = (filteredUsers, partType) => {
    return [...filteredUsers].sort((a, b) => {
      const dateA = partType ? historyByRole[`${a.id}:${partType}`] : null;
      const dateB = partType ? historyByRole[`${b.id}:${partType}`] : null;
      const nameA = a.name || a.display_name || '';
      const nameB = b.name || b.display_name || '';
      if (!dateA && !dateB) return nameA.localeCompare(nameB);
      if (!dateA) return -1; // never did this role → first
      if (!dateB) return 1;
      const diff = new Date(dateA).getTime() - new Date(dateB).getTime();
      if (diff !== 0) return diff; // oldest (least recent) first
      return nameA.localeCompare(nameB);
    });
  };

  // Set of user IDs assigned in THIS meeting to avoid double-booking
  const assignedInThisMeeting = new Set();

  // Pre-fill already manually assigned users
  if (meeting.chairman_id) assignedInThisMeeting.add(meeting.chairman_id);
  if (meeting.opening_prayer_id) assignedInThisMeeting.add(meeting.opening_prayer_id);
  if (meeting.closing_prayer_id) assignedInThisMeeting.add(meeting.closing_prayer_id);
  if (meeting.cbs_conductor_id) assignedInThisMeeting.add(meeting.cbs_conductor_id);
  if (meeting.cbs_reader_id) assignedInThisMeeting.add(meeting.cbs_reader_id);

  parts.forEach(p => {
    if (p.assigned_user_id) assignedInThisMeeting.add(p.assigned_user_id);
    if (p.assistant_user_id) assignedInThisMeeting.add(p.assistant_user_id);
  });

  // Mark the current meeting's pre-existing assignments as used this month too.
  assignedInThisMeeting.forEach(markUsed);

  // --- Assign Meeting-Level Roles first (Chairman, CBS, Prayers) ---
  // The 4th arg is the part_type key used to look up per-role LRA history.
  // If `mirrorAs` is provided, the same user is also written to that other
  // meeting-level field and logged under both role keys. Used to tie the
  // opening prayer to the chairman (per user spec: opening prayer is ALWAYS
  // the chairman).
  const assignMeetingRole = async (field, roleName, partType, filterFn, mirrorAs) => {
    if (!meeting[field]) {
      const { candidates, monthOverride } = poolFor(filterFn);
      const sorted = getLRASortedUsers(candidates, partType);
      if (sorted.length > 0) {
        const chosen = sorted[0];
        const updateObj = {};
        updateObj[field] = chosen.id;
        if (mirrorAs) updateObj[mirrorAs.field] = chosen.id;

        const { error } = await supabase
          .from('meetings')
          .update(updateObj)
          .eq('id', meetingId);

        if (!error) {
          if (monthOverride && usedThisMonth.has(chosen.id)) {
            fallbackLogs.push(`⚠️ Month rule relaxed for ${roleName}: reused ${chosen.name} (no fresh candidate).`);
          }
          meeting[field] = chosen.id;
          assignedInThisMeeting.add(chosen.id);
          markUsed(chosen.id);
          if (mirrorAs) {
            meeting[mirrorAs.field] = chosen.id;
            logs.push(`✅ Assigned ${chosen.name} as ${roleName} (and ${mirrorAs.label})`);
          } else {
            logs.push(`✅ Assigned ${chosen.name} as ${roleName}`);
          }

          // Log in part_history (use the explicit partType so the per-role
          // history lookup on the next run is consistent)
          await supabase.from('part_history').insert({
            meeting_id: meetingId,
            user_id: chosen.id,
            role: partType,
            part_type: partType,
            assigned_date: meeting.date
          });
          if (mirrorAs) {
            await supabase.from('part_history').insert({
              meeting_id: meetingId,
              user_id: chosen.id,
              role: mirrorAs.partType,
              part_type: mirrorAs.partType,
              assigned_date: meeting.date
            });
          }
        } else {
          logs.push(`❌ Error assigning ${chosen.name} as ${roleName}: ${error.message}`);
        }
      } else {
        logs.push(`⚠️ No available candidate for ${roleName}`);
      }
    } else {
      logs.push(`ℹ️ ${roleName} already assigned.`);
    }
  };

  // Chairman (Male, can_be_chairman). The opening prayer is ALWAYS the
  // chairman per the user spec, so we mirror the assignment through the
  // 5th arg.
  await assignMeetingRole(
    'chairman_id', 'Chairman', 'chairman',
    u => u.gender === 'male' && u.can_be_chairman,
    { field: 'opening_prayer_id', partType: 'opening_prayer', label: 'Opening Prayer' }
  );

  // CBS Conducer (Male, can_be_cbs_conductor)
  await assignMeetingRole('cbs_conductor_id', 'CBS Conducer', 'cbs_conductor', u => u.gender === 'male' && u.can_be_cbs_conductor);

  // CBS Reader (Male, can_be_cbs_reader)
  await assignMeetingRole('cbs_reader_id', 'CBS Reader', 'cbs_reader', u => u.gender === 'male' && u.can_be_cbs_reader);

  // Closing Prayer (Male, can_do_prayers)
  await assignMeetingRole('closing_prayer_id', 'Closing Prayer', 'closing_prayer', u => u.gender === 'male' && u.can_do_prayers);

  // Sync CBS conductor to the cbs meeting_part so the assigned count is accurate.
  // The UI reads conductor/reader from meeting-level fields; this write keeps
  // meeting_parts.assigned_user_id consistent with that assignment.
  if (meeting.cbs_conductor_id) {
    const cbsPart = parts.find(p => p.part_type === 'cbs');
    if (cbsPart && !cbsPart.assigned_user_id) {
      await supabase
        .from('meeting_parts')
        .update({ assigned_user_id: meeting.cbs_conductor_id })
        .eq('id', cbsPart.id);
      cbsPart.assigned_user_id = meeting.cbs_conductor_id;
    }
  }

  // --- Assign Part-Level Roles (Treasures talk, Gems, Bible Reading, Student Parts, Living) ---
  let newlyAssignedCount = 0;

  for (const part of parts) {
    // 1. Treasures Talk (Male, can_be_speaker)
    if (part.part_type === 'treasures_talk' && !part.assigned_user_id) {
      const { candidates, monthOverride } = poolFor(u => u.gender === 'male' && u.can_be_speaker);
      const sorted = getLRASortedUsers(candidates, 'treasures_talk');
      if (sorted.length > 0) {
        const chosen = sorted[0];
        const { error } = await supabase
          .from('meeting_parts')
          .update({ assigned_user_id: chosen.id })
          .eq('id', part.id);

        if (!error) {
          if (monthOverride && usedThisMonth.has(chosen.id)) {
            fallbackLogs.push(`⚠️ Month rule relaxed for Treasures Talk: reused ${chosen.name} (no fresh candidate).`);
          }
          assignedInThisMeeting.add(chosen.id);
          markUsed(chosen.id);
          part.assigned_user_id = chosen.id;
          newlyAssignedCount++;
          logs.push(`✅ Assigned ${chosen.name} to Treasures Talk: "${part.title}"`);

          await supabase.from('part_history').insert({
            meeting_id: meetingId,
            user_id: chosen.id,
            role: 'treasures_talk',
            part_type: 'treasures_talk',
            assigned_date: meeting.date
          });
        }
      } else {
        logs.push(`⚠️ No candidate found for Treasures Talk: "${part.title}"`);
      }
    }

    // 2. Spiritual Gems (Male, can_do_gems)
    if (part.part_type === 'spiritual_gems' && !part.assigned_user_id) {
      const { candidates, monthOverride } = poolFor(u => u.gender === 'male' && u.can_do_gems);
      const sorted = getLRASortedUsers(candidates, 'spiritual_gems');
      if (sorted.length > 0) {
        const chosen = sorted[0];
        const { error } = await supabase
          .from('meeting_parts')
          .update({ assigned_user_id: chosen.id })
          .eq('id', part.id);

        if (!error) {
          if (monthOverride && usedThisMonth.has(chosen.id)) {
            fallbackLogs.push(`⚠️ Month rule relaxed for Spiritual Gems: reused ${chosen.name} (no fresh candidate).`);
          }
          assignedInThisMeeting.add(chosen.id);
          markUsed(chosen.id);
          part.assigned_user_id = chosen.id;
          newlyAssignedCount++;
          logs.push(`✅ Assigned ${chosen.name} to Spiritual Gems`);

          await supabase.from('part_history').insert({
            meeting_id: meetingId,
            user_id: chosen.id,
            role: 'spiritual_gems',
            part_type: 'spiritual_gems',
            assigned_date: meeting.date
          });
        }
      } else {
        logs.push(`⚠️ No candidate found for Spiritual Gems`);
      }
    }

    // 3. Bible Reading (brothers only — women are excluded per congregation policy)
    if (part.part_type === 'bible_reading' && !part.assigned_user_id) {
      const { candidates, monthOverride } = poolFor(u => u.can_do_bible_reading && u.gender === 'male');
      const sorted = getLRASortedUsers(candidates, 'bible_reading');
      if (sorted.length > 0) {
        const chosen = sorted[0];
        const { error } = await supabase
          .from('meeting_parts')
          .update({ assigned_user_id: chosen.id })
          .eq('id', part.id);

        if (!error) {
          if (monthOverride && usedThisMonth.has(chosen.id)) {
            fallbackLogs.push(`⚠️ Month rule relaxed for Bible Reading (${part.class_type.toUpperCase()}): reused ${chosen.name} (no fresh candidate).`);
          }
          assignedInThisMeeting.add(chosen.id);
          markUsed(chosen.id);
          part.assigned_user_id = chosen.id;
          newlyAssignedCount++;
          logs.push(`✅ Assigned ${chosen.name} to Bible Reading (${part.class_type.toUpperCase()})`);

          await supabase.from('part_history').insert({
            meeting_id: meetingId,
            user_id: chosen.id,
            role: 'bible_reading',
            part_type: 'bible_reading',
            assigned_date: meeting.date
          });
        }
      } else {
        logs.push(`⚠️ No candidate found for Bible Reading (${part.class_type.toUpperCase()})`);
      }
    }

    // 4. Student Parts (Apply Yourself to the Field Ministry)
    if (part.part_type === 'student_part' && !part.assigned_user_id) {
      const isTalk = part.student_part_type === 'talk';
      const { candidates, monthOverride } = poolFor(u => u.can_do_student_parts && (!isTalk || u.gender === 'male'));
      const sorted = getLRASortedUsers(candidates, 'student_part');
      if (sorted.length > 0) {
        const student = sorted[0];

        // Find assistant if needed
        let assistantId = part.assistant_user_id || null;
        let assistantOverride = false;
        if (!assistantId && part.student_part_type !== 'talk') {
          // Rule: assistant must have same gender as student
          const { candidates: assistantCandidates, monthOverride: asstOverride } = poolFor(
            u => u.id !== student.id && u.gender === student.gender && u.can_be_assistant
          );
          const sortedAssistants = getLRASortedUsers(assistantCandidates, 'assistant');
          if (sortedAssistants.length > 0) {
            assistantId = sortedAssistants[0].id;
            assistantOverride = asstOverride;
          }
        }

        const { error } = await supabase
          .from('meeting_parts')
          .update({
            assigned_user_id: student.id,
            assistant_user_id: assistantId
          })
          .eq('id', part.id);

        if (!error) {
          if (monthOverride && usedThisMonth.has(student.id)) {
            fallbackLogs.push(`⚠️ Month rule relaxed for Student Part: reused ${student.name} (no fresh candidate).`);
          }
          assignedInThisMeeting.add(student.id);
          markUsed(student.id);
          part.assigned_user_id = student.id;

          let assistantMsg = '';
          if (assistantId) {
            if (assistantOverride && usedThisMonth.has(assistantId)) {
              const asstName = users.find(u => u.id === assistantId)?.name;
              fallbackLogs.push(`⚠️ Month rule relaxed for assistant: reused ${asstName} (no fresh candidate).`);
            }
            assignedInThisMeeting.add(assistantId);
            markUsed(assistantId);
            part.assistant_user_id = assistantId;
            const assistantName = users.find(u => u.id === assistantId)?.name;
            assistantMsg = ` with assistant ${assistantName}`;

            await supabase.from('part_history').insert({
              meeting_id: meetingId,
              user_id: assistantId,
              role: 'assistant',
              part_type: 'assistant',
              assigned_date: meeting.date
            });
          }

          newlyAssignedCount++;
          logs.push(`✅ Assigned ${student.name}${assistantMsg} to Student Part: "${part.title}" (${part.class_type.toUpperCase()})`);

          await supabase.from('part_history').insert({
            meeting_id: meetingId,
            user_id: student.id,
            role: 'student_part',
            part_type: 'student_part',
            assigned_date: meeting.date
          });
        }
      } else {
        logs.push(`⚠️ No candidate found for Student Part: "${part.title}"`);
      }
    }

    // 5. Living as Christians Parts (Male, can_be_speaker OR can_be_chairman)
    //    Living parts ("Nuestra vida cristiana") are given by any qualified
    //    brother. If the can_be_speaker pool is exhausted by chairman,
    //    prayers, and treasures talk, fall back to brothers eligible to
    //    preside — they are typically the same elders/MS pool.
    if (part.part_type === 'living_part' && !part.assigned_user_id) {
      const { candidates, monthOverride } = poolFor(u =>
        u.gender === 'male' &&
        (u.can_be_speaker || u.can_be_chairman)
      );
      const sorted = getLRASortedUsers(candidates, 'living_part');
      if (sorted.length > 0) {
        const chosen = sorted[0];
        const { error } = await supabase
          .from('meeting_parts')
          .update({ assigned_user_id: chosen.id })
          .eq('id', part.id);

        if (!error) {
          if (monthOverride && usedThisMonth.has(chosen.id)) {
            fallbackLogs.push(`⚠️ Month rule relaxed for Living Part: reused ${chosen.name} (no fresh candidate).`);
          }
          assignedInThisMeeting.add(chosen.id);
          markUsed(chosen.id);
          part.assigned_user_id = chosen.id;
          newlyAssignedCount++;
          logs.push(`✅ Assigned ${chosen.name} to Living Part: "${part.title}"`);

          await supabase.from('part_history').insert({
            meeting_id: meetingId,
            user_id: chosen.id,
            role: 'living_part',
            part_type: 'living_part',
            assigned_date: meeting.date
          });
        }
      } else {
        logs.push(`⚠️ No candidate found for Living Part: "${part.title}"`);
      }
    }
  }

  // --- Auto-assign cleaning_group (sequential 1→2→3→4→1) ---
  if (!meeting.cleaning_group) {
    const { data: prevMeetings } = await supabase
      .from('meetings')
      .select('cleaning_group, date')
      .lt('date', meeting.date)
      .not('cleaning_group', 'is', null)
      .order('date', { ascending: false })
      .limit(1);

    const lastGroup = prevMeetings?.[0]?.cleaning_group;
    const lastNum = parseInt(lastGroup) || 0;
    const nextGroup = String((lastNum % 4) + 1);

    const { error: cleanErr } = await supabase
      .from('meetings')
      .update({ cleaning_group: nextGroup })
      .eq('id', meetingId);

    if (!cleanErr) {
      meeting.cleaning_group = nextGroup;
      logs.push(`✅ Assigned cleaning group: ${nextGroup}`);
    }
  }

  // Refetch parts to see final count
  const { data: finalParts } = await supabase
    .from('meeting_parts')
    .select('assigned_user_id')
    .eq('meeting_id', meetingId);
  const assignedCount = finalParts ? finalParts.filter(p => p.assigned_user_id).length : 0;

  if (fallbackLogs.length) {
    logs.push('━━━ Month-rule overrides (no fresh candidate available) ━━━');
    logs.push(...fallbackLogs);
  }

  logs.push(`🎉 Assignment complete. Total assigned parts: ${assignedCount}/${parts.length}.`);
  return {
    assignedCount,
    totalCount: parts.length,
    logs
  };
}