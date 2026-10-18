const byMeeting = new Map<string, any>();
let requested: { year: number; month: number } | null = null;

export async function loadMonthRollCalls(year: number, month: number): Promise<void> {
    requested = { year, month };
    const res = await fetch(`/api/attendance/month-rollcalls?year=${year}&month=${month}`);
    if (!res.ok) return;
    const list: any[] = await res.json();
    // Ignore the response if the admin has moved to another month while it was loading
    if (requested?.year !== year || requested?.month !== month) return;
    byMeeting.clear();
    for (const rc of list) byMeeting.set(rc.meeting.id, rc);
}

export function getCachedRollCall(meetingId: string): any | undefined {
    return byMeeting.get(meetingId);
}
