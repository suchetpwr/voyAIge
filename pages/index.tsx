import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Trip = {
  _id: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  preferences?: string[];
  budgetLevel?: 'low' | 'mid' | 'high';
  notes?: string;
  tags?: string[];
  itinerary?: Array<{
    date: string;
    summary?: string;
    activities?: Array<{
      time?: string;
      title: string;
      location?: string;
      address?: string;
      estCost?: number;
      notes?: string;
      bookingLink?: string;
    }>;
  }>;
  createdAt: string;
};

const budgetOptions = ['low', 'mid', 'high'] as const;
const MAX_TRIP_DAYS = 183;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function getTripDays(trip: Trip) {
  const start = new Date(trip.startDate).getTime();
  const end = new Date(trip.endDate).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export default function HomePage() {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState<number>(1);
  const [preferencesInput, setPreferencesInput] = useState('');
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'mid' | 'high' | ''>('');
  const [notes, setNotes] = useState('');

  const [trips, setTrips] = useState<Trip[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [planLoadingId, setPlanLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'draft'>('all');

  const preferences = useMemo(
    () => preferencesInput.split(',').map((s) => s.trim()).filter(Boolean),
    [preferencesInput]
  );

  const filteredTrips = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return trips.filter((trip) => {
      const planned = (trip.itinerary?.length || 0) > 0;
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'planned' ? planned : !planned);
      const haystack = [
        trip.destination,
        trip.budgetLevel,
        trip.notes,
        ...(trip.preferences || []),
        ...(trip.tags || [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [query, statusFilter, trips]);

  const plannedCount = trips.filter((trip) => (trip.itinerary?.length || 0) > 0).length;
  const totalDays = trips.reduce((sum, trip) => sum + getTripDays(trip), 0);
  const formTitle = editingTripId ? 'Edit trip' : 'Create itinerary';
  const submitLabel = editingTripId ? 'Save changes' : 'Create trip';

  async function fetchTrips() {
    setError(null);
    try {
      const res = await fetch('/api/trips');
      if (!res.ok) throw new Error(`GET /api/trips ${res.status}`);
      const data = await res.json();
      setTrips(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load trips');
    }
  }

  useEffect(() => {
    fetchTrips();
  }, []);

  function resetForm() {
    setDestination('');
    setStartDate('');
    setEndDate('');
    setTravelers(1);
    setPreferencesInput('');
    setBudgetLevel('');
    setNotes('');
    setEditingTripId(null);
  }

  function startEditingTrip(trip: Trip) {
    setError(null);
    setEditingTripId(trip._id);
    setDestination(trip.destination);
    setStartDate(new Date(trip.startDate).toISOString().slice(0, 10));
    setEndDate(new Date(trip.endDate).toISOString().slice(0, 10));
    setTravelers(trip.travelers);
    setPreferencesInput((trip.preferences || []).join(', '));
    setBudgetLevel(trip.budgetLevel || '');
    setNotes(trip.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitTrip(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!destination || !startDate || !endDate || !travelers) {
      setError('Please fill destination, dates, and travelers.');
      return;
    }

    const selectedDays = getTripDays({
      _id: '',
      destination,
      startDate,
      endDate,
      travelers,
      createdAt: ''
    });
    if (selectedDays > MAX_TRIP_DAYS) {
      setError(`Trips can be at most ${MAX_TRIP_DAYS} days, roughly 6 months.`);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(editingTripId ? `/api/trips/${editingTripId}` : '/api/trips', {
        method: editingTripId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          travelers: Number(travelers),
          preferences: preferences.length ? preferences : undefined,
          budgetLevel: budgetLevel || undefined,
          notes: notes || undefined
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `${editingTripId ? 'Update' : 'Create'} failed (${res.status})`);
      }
      resetForm();
      await fetchTrips();
    } catch (e: any) {
      setError(e.message || `Failed to ${editingTripId ? 'update' : 'create'} trip`);
    } finally {
      setCreating(false);
    }
  }

  async function planTrip(id: string, force = false) {
    setPlanLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${id}/plan${force ? '?force=1' : ''}`, {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Plan failed (${res.status})`);
      }
      await fetchTrips();
    } catch (e: any) {
      setError(e.message || 'Failed to plan itinerary');
    } finally {
      setPlanLoadingId(null);
    }
  }

  return (
    <main className="page-shell">
      <section className="app-header">
        <div>
          <p className="eyebrow">AI itinerary workspace</p>
          <h1>voyAIge</h1>
          <p className="lede">Shape trip ideas, generate day plans, and keep every itinerary easy to scan.</p>
        </div>

        <div className="stats-grid" aria-label="Trip stats">
          <div className="stat">
            <span>{trips.length}</span>
            <small>Trips</small>
          </div>
          <div className="stat">
            <span>{plannedCount}</span>
            <small>Planned</small>
          </div>
          <div className="stat">
            <span>{totalDays}</span>
            <small>Days</small>
          </div>
        </div>
      </section>

      {error && <p className="alert">{error}</p>}

      <section className="workspace">
        <form onSubmit={submitTrip} className="planner-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingTripId ? 'Update trip' : 'New trip'}</p>
              <h2>{formTitle}</h2>
            </div>
            <div className="form-actions">
              {editingTripId && (
                <button type="button" onClick={resetForm} className="secondary-action compact">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={creating} className="primary-action">
                {creating ? 'Saving...' : submitLabel}
              </button>
            </div>
          </div>

          <p className="form-note">Trips can be planned for up to roughly 6 months.</p>

          <div className="form-grid">
            <label>
              <span>Destination</span>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Lisbon, Portugal"
                required
              />
            </label>

            <label>
              <span>Travelers</span>
              <input
                type="number"
                min={1}
                value={travelers}
                onChange={(e) => setTravelers(Number(e.target.value))}
                required
              />
            </label>

            <label>
              <span>Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </label>

            <label>
              <span>End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </label>

            <label className="wide">
              <span>Preferences</span>
              <input
                value={preferencesInput}
                onChange={(e) => setPreferencesInput(e.target.value)}
                placeholder="food, museums, outdoors"
              />
            </label>

            <div className="wide">
              <span className="field-label">Budget</span>
              <div className="segment-control">
                {budgetOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={budgetLevel === option ? 'active' : ''}
                    onClick={() => setBudgetLevel(option)}
                  >
                    {option}
                  </button>
                ))}
                <button
                  type="button"
                  className={budgetLevel === '' ? 'active' : ''}
                  onClick={() => setBudgetLevel('')}
                >
                  none
                </button>
              </div>
            </div>

            <label className="wide">
              <span>Notes</span>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mobility needs, allergies, must-see places, pacing..."
              />
            </label>
          </div>
        </form>

        <section className="trip-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h2>Your trips</h2>
            </div>
            <div className="filters">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search trips"
                aria-label="Search trips"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'planned' | 'draft')}
                aria-label="Filter trips"
              >
                <option value="all">All</option>
                <option value="planned">Planned</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {filteredTrips.length === 0 ? (
            <div className="empty-state">
              <strong>No matching trips</strong>
              <span>{trips.length ? 'Try a different search or filter.' : 'Create one to start planning.'}</span>
            </div>
          ) : (
            <div className="trip-list">
              {filteredTrips.map((trip) => {
                const planned = (trip.itinerary?.length || 0) > 0;
                const dayCount = getTripDays(trip);
                const activityCount = trip.itinerary?.reduce((sum, day) => sum + (day.activities?.length || 0), 0) || 0;

                return (
                  <article key={trip._id} className="trip-card">
                    <div className="trip-card-main">
                      <div>
                        <div className="trip-title-row">
                          <h3>{trip.destination}</h3>
                          <span className={planned ? 'status planned' : 'status draft'}>
                            {planned ? 'Planned' : 'Draft'}
                          </span>
                        </div>
                        <p className="trip-meta">
                          {formatDate(trip.startDate)} - {formatDate(trip.endDate)} · {dayCount} day{dayCount === 1 ? '' : 's'} · {trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}
                        </p>
                      </div>

                      <div className="trip-actions">
                        <button
                          type="button"
                          onClick={() => planTrip(trip._id, planned)}
                          disabled={planLoadingId === trip._id}
                          className="primary-action compact"
                        >
                          {planLoadingId === trip._id ? 'Planning...' : planned ? 'Re-plan' : 'Plan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingTrip(trip)}
                          className="secondary-action"
                        >
                          Edit
                        </button>
                        <Link href={`/trips/${trip._id}`} className="secondary-action">
                          Open
                        </Link>
                      </div>
                    </div>

                    <div className="trip-foot">
                      <div className="mini-stats">
                        <span>{activityCount} activities</span>
                        {trip.budgetLevel && <span>{trip.budgetLevel} budget</span>}
                      </div>
                      {trip.tags && trip.tags.length > 0 && (
                        <div className="pill-row">
                          {trip.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="pill">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: #f6f4ef;
          color: #18212a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        :global(*) {
          box-sizing: border-box;
        }

        .page-shell {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
          padding: 36px 0 56px;
        }

        .app-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: end;
          margin-bottom: 24px;
        }

        .eyebrow {
          margin: 0 0 6px;
          color: #667085;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        h1, h2, h3, p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 8px;
          color: #102027;
          font-size: clamp(34px, 7vw, 64px);
          line-height: 0.95;
          letter-spacing: 0;
        }

        h2 {
          margin-bottom: 0;
          font-size: 22px;
          line-height: 1.15;
          letter-spacing: 0;
        }

        h3 {
          margin-bottom: 0;
          font-size: 17px;
          line-height: 1.25;
          letter-spacing: 0;
        }

        .lede {
          max-width: 560px;
          margin-bottom: 0;
          color: #475467;
          font-size: 16px;
          line-height: 1.6;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 92px);
          gap: 10px;
        }

        .stat {
          border: 1px solid #ddd8ce;
          border-radius: 8px;
          background: #fffdf8;
          padding: 12px;
        }

        .stat span {
          display: block;
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
        }

        .stat small {
          color: #667085;
          font-size: 12px;
        }

        .alert {
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fff1f2;
          color: #9f1239;
          padding: 12px 14px;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(320px, 430px) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .planner-panel,
        .trip-panel {
          border: 1px solid #ddd8ce;
          border-radius: 8px;
          background: #fffdf8;
          box-shadow: 0 14px 35px rgba(16, 32, 39, 0.08);
        }

        .planner-panel {
          position: sticky;
          top: 20px;
          padding: 18px;
        }

        .trip-panel {
          padding: 18px;
        }

        .panel-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: start;
          margin-bottom: 18px;
        }

        .form-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .form-note {
          margin: -6px 0 16px;
          color: #667085;
          font-size: 13px;
          line-height: 1.45;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        label,
        .wide {
          min-width: 0;
        }

        label span,
        .field-label {
          display: block;
          margin-bottom: 7px;
          color: #344054;
          font-size: 13px;
          font-weight: 700;
        }

        input,
        textarea,
        select {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: #ffffff;
          color: #18212a;
          font: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }

        input,
        select {
          height: 42px;
          padding: 0 12px;
        }

        textarea {
          min-height: 104px;
          padding: 11px 12px;
          resize: vertical;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
        }

        .wide {
          grid-column: 1 / -1;
        }

        .segment-control {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: #f2f4f7;
          padding: 4px;
        }

        .segment-control button {
          min-height: 34px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #475467;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
        }

        .segment-control button.active {
          background: #ffffff;
          color: #0f766e;
          box-shadow: 0 1px 3px rgba(16, 32, 39, 0.14);
        }

        .primary-action,
        .secondary-action {
          display: inline-flex;
          min-height: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          padding: 0 14px;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .primary-action {
          border: 1px solid #0f766e;
          background: #0f766e;
          color: #ffffff;
          cursor: pointer;
        }

        .primary-action:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .primary-action.compact {
          min-height: 36px;
        }

        .secondary-action.compact {
          min-height: 40px;
        }

        .secondary-action {
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #344054;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) 112px;
          gap: 10px;
          width: min(360px, 100%);
        }

        .trip-list {
          display: grid;
          gap: 12px;
        }

        .trip-card {
          border: 1px solid #e4e0d7;
          border-radius: 8px;
          background: #ffffff;
          padding: 15px;
          transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
        }

        .trip-card:hover {
          border-color: #99b8b3;
          box-shadow: 0 12px 24px rgba(16, 32, 39, 0.08);
          transform: translateY(-1px);
        }

        .trip-card-main {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: start;
        }

        .trip-title-row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .trip-meta {
          margin: 6px 0 0;
          color: #667085;
          font-size: 14px;
          line-height: 1.45;
        }

        .trip-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .trip-foot {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: end;
          margin-top: 16px;
        }

        .mini-stats,
        .pill-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .mini-stats span,
        .pill,
        .status {
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.2;
        }

        .mini-stats span {
          background: #f2f4f7;
          color: #475467;
        }

        .pill {
          background: #e6f4f1;
          color: #0f766e;
        }

        .status.planned {
          background: #dcfce7;
          color: #166534;
        }

        .status.draft {
          background: #fff7ed;
          color: #9a3412;
        }

        .empty-state {
          display: grid;
          place-items: center;
          min-height: 220px;
          border: 1px dashed #d0d5dd;
          border-radius: 8px;
          color: #667085;
          text-align: center;
        }

        .empty-state strong {
          display: block;
          color: #18212a;
          font-size: 18px;
        }

        @media (max-width: 900px) {
          .app-header,
          .workspace {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .planner-panel {
            position: static;
          }
        }

        @media (max-width: 640px) {
          .page-shell {
            width: min(100% - 24px, 1180px);
            padding-top: 24px;
          }

          .panel-heading,
          .trip-card-main,
          .trip-foot {
            flex-direction: column;
            align-items: stretch;
          }

          .form-actions {
            justify-content: stretch;
          }

          .form-actions > * {
            flex: 1;
          }

          .form-grid,
          .filters {
            grid-template-columns: 1fr;
          }

          .trip-actions {
            justify-content: stretch;
          }

          .trip-actions > * {
            flex: 1;
          }
        }
      `}</style>
    </main>
  );
}
