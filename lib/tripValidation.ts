export const MAX_TRIP_DAYS = 183;

export type TripInput = {
  destination: string;
  startDate: Date;
  endDate: Date;
  travelers: number;
  preferences?: string[];
  budgetLevel?: 'low' | 'mid' | 'high';
  notes?: string;
};

export function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function toUTCDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function daysBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function serializeDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function validateTripInput(body: any): { input?: TripInput; error?: string } {
  const { destination, startDate, endDate, travelers, preferences, budgetLevel, notes } = body || {};

  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    return { error: 'Destination is required' };
  }
  if (!startDate || typeof startDate !== 'string' || !isISODate(startDate)) {
    return { error: 'Start date is missing or date format is not correct' };
  }
  if (!endDate || typeof endDate !== 'string' || !isISODate(endDate)) {
    return { error: 'End date is missing or date format is not correct' };
  }

  const travelerCount = Number(travelers);
  if (!Number.isInteger(travelerCount) || travelerCount < 1) {
    return { error: 'travelers must be a positive integer.' };
  }

  const start = toUTCDate(startDate);
  const end = toUTCDate(endDate);
  if (end < start) {
    return { error: 'endDate must be on or after startDate.' };
  }

  const tripDays = daysBetween(start, end);
  if (tripDays > MAX_TRIP_DAYS) {
    return { error: `Trips can be at most ${MAX_TRIP_DAYS} days, roughly 6 months.` };
  }

  if (budgetLevel && !['low', 'mid', 'high'].includes(String(budgetLevel))) {
    return { error: 'budgetLevel must be low, mid, or high.' };
  }

  const prefs = Array.isArray(preferences)
    ? preferences.map((p) => String(p).trim()).filter(Boolean)
    : undefined;
  const notesStr = typeof notes === 'string' && notes.trim() ? notes.trim() : undefined;

  return {
    input: {
      destination: destination.trim(),
      startDate: start,
      endDate: end,
      travelers: travelerCount,
      ...(prefs && { preferences: prefs }),
      ...(budgetLevel && { budgetLevel }),
      ...(notesStr && { notes: notesStr })
    }
  };
}
