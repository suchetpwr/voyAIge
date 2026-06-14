import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Activity = {
  time?: string;
  title: string;
  location?: string;
  address?: string;
  estCost?: number;
  notes?: string;
  bookingLink?: string;
};

type DayPlan = {
  date: string;
  summary?: string;
  activities?: Activity[];
};

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
  itinerary?: DayPlan[];
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function getTripDays(trip: Trip) {
  const start = new Date(trip.startDate).getTime();
  const end = new Date(trip.endDate).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export default function TripDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTrip() {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `GET /api/trips/${id} failed (${res.status})`);
      }
      const data = await res.json();
      setTrip(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const days = useMemo(() => {
    return [...(trip?.itinerary || [])].sort((a, b) => a.date.localeCompare(b.date));
  }, [trip]);

  const activityCount = useMemo(() => {
    return days.reduce((sum, day) => sum + (day.activities?.length || 0), 0);
  }, [days]);

  async function replan(force = true) {
    if (!id || typeof id !== 'string') return;
    setPlanLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${id}/plan${force ? '?force=1' : ''}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Plan failed (${res.status})`);
      }
      await fetchTrip();
    } catch (e: any) {
      setError(e.message || 'Failed to re-plan itinerary');
    } finally {
      setPlanLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <nav className="top-bar">
        <Link href="/" className="back-link">Back to trips</Link>
        {trip && (
          <button onClick={() => replan(true)} disabled={planLoading} className="primary-action">
            {planLoading ? 'Re-planning...' : days.length ? 'Re-plan itinerary' : 'Plan itinerary'}
          </button>
        )}
      </nav>

      {loading && <div className="state-panel">Loading trip...</div>}
      {error && <p className="alert">{error}</p>}

      {trip && (
        <>
          <section className="trip-hero">
            <div>
              <p className="eyebrow">Trip itinerary</p>
              <h1>{trip.destination}</h1>
              <p className="trip-meta">
                {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
              </p>
            </div>

            <div className="stats-grid" aria-label="Trip overview">
              <div className="stat">
                <span>{getTripDays(trip)}</span>
                <small>Days</small>
              </div>
              <div className="stat">
                <span>{trip.travelers}</span>
                <small>Travelers</small>
              </div>
              <div className="stat">
                <span>{activityCount}</span>
                <small>Activities</small>
              </div>
            </div>
          </section>

          <section className="summary-grid">
            <div className="summary-panel">
              <p className="eyebrow">Preferences</p>
              <div className="pill-row">
                {(trip.preferences?.length ? trip.preferences : ['No preferences yet']).map((item) => (
                  <span key={item} className="pill">{item}</span>
                ))}
              </div>
            </div>

            <div className="summary-panel">
              <p className="eyebrow">Planning notes</p>
              <p>{trip.notes || 'No notes added.'}</p>
            </div>

            <div className="summary-panel">
              <p className="eyebrow">Budget</p>
              <p className="budget-text">{trip.budgetLevel || 'Not specified'}</p>
            </div>
          </section>

          <section className="itinerary-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Day by day</p>
                <h2>Itinerary</h2>
              </div>
              {trip.tags && trip.tags.length > 0 && (
                <div className="pill-row align-right">
                  {trip.tags.map((tag) => (
                    <span key={tag} className="pill accent">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {!days.length ? (
              <div className="empty-state">
                <strong>No itinerary yet</strong>
                <span>Use the planning action above to generate the first version.</span>
              </div>
            ) : (
              <div className="timeline">
                {days.map((day, dayIndex) => (
                  <article key={day.date} className="day-card">
                    <div className="day-marker">
                      <span>{dayIndex + 1}</span>
                    </div>
                    <div className="day-content">
                      <div className="day-header">
                        <div>
                          <p className="eyebrow">Day {dayIndex + 1}</p>
                          <h3>{formatDate(day.date)}</h3>
                        </div>
                        {day.summary && <p className="day-summary">{day.summary}</p>}
                      </div>

                      {day.activities && day.activities.length > 0 ? (
                        <div className="activity-list">
                          {day.activities.map((activity, idx) => (
                            <div key={`${activity.title}-${idx}`} className="activity-row">
                              <div className="activity-time">{activity.time || 'Anytime'}</div>
                              <div className="activity-body">
                                <div className="activity-title">
                                  <strong>{activity.title}</strong>
                                  {activity.estCost != null && <span>${activity.estCost}</span>}
                                </div>
                                {activity.location && <p>{activity.location}</p>}
                                {activity.address && <p className="muted">{activity.address}</p>}
                                {activity.notes && <p className="muted">{activity.notes}</p>}
                                {activity.bookingLink && (
                                  <a href={activity.bookingLink} target="_blank" rel="noreferrer">
                                    Book activity
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No activities listed.</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

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
          width: min(1040px, calc(100% - 32px));
          margin: 0 auto;
          padding: 28px 0 56px;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
        }

        .back-link {
          color: #344054;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
        }

        .primary-action {
          display: inline-flex;
          min-height: 40px;
          align-items: center;
          justify-content: center;
          border: 1px solid #0f766e;
          border-radius: 8px;
          background: #0f766e;
          color: #ffffff;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          padding: 0 14px;
          white-space: nowrap;
        }

        .primary-action:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .trip-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: end;
          margin-bottom: 18px;
        }

        .eyebrow {
          margin: 0 0 6px;
          color: #667085;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 10px;
          color: #102027;
          font-size: clamp(34px, 7vw, 58px);
          line-height: 0.98;
          letter-spacing: 0;
        }

        h2 {
          margin-bottom: 0;
          font-size: 26px;
          letter-spacing: 0;
        }

        h3 {
          margin-bottom: 0;
          font-size: 20px;
          letter-spacing: 0;
        }

        .trip-meta {
          margin-bottom: 0;
          color: #475467;
          font-size: 16px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 96px);
          gap: 10px;
        }

        .stat,
        .summary-panel,
        .day-content,
        .state-panel,
        .empty-state {
          border: 1px solid #ddd8ce;
          border-radius: 8px;
          background: #fffdf8;
          box-shadow: 0 14px 35px rgba(16, 32, 39, 0.08);
        }

        .stat {
          padding: 12px;
        }

        .stat span {
          display: block;
          font-size: 25px;
          font-weight: 900;
          line-height: 1;
        }

        .stat small {
          color: #667085;
          font-size: 12px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: 1.2fr 1.6fr 0.8fr;
          gap: 12px;
          margin-bottom: 26px;
        }

        .summary-panel {
          padding: 16px;
        }

        .summary-panel p:last-child {
          margin-bottom: 0;
        }

        .budget-text {
          color: #0f766e;
          font-weight: 900;
          text-transform: capitalize;
        }

        .pill-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .pill {
          border-radius: 999px;
          background: #f2f4f7;
          color: #475467;
          padding: 4px 9px;
          font-size: 12px;
          font-weight: 800;
        }

        .pill.accent {
          background: #e6f4f1;
          color: #0f766e;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: end;
          margin-bottom: 16px;
        }

        .align-right {
          justify-content: flex-end;
        }

        .timeline {
          display: grid;
          gap: 14px;
          position: relative;
        }

        .day-card {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }

        .day-marker {
          display: flex;
          justify-content: center;
          padding-top: 16px;
          position: relative;
        }

        .day-marker span {
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border-radius: 999px;
          background: #0f766e;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
        }

        .day-content {
          padding: 16px;
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: start;
          margin-bottom: 14px;
        }

        .day-summary {
          max-width: 420px;
          margin-bottom: 0;
          color: #667085;
          font-size: 14px;
          line-height: 1.5;
          text-align: right;
        }

        .activity-list {
          display: grid;
          gap: 10px;
        }

        .activity-row {
          display: grid;
          grid-template-columns: 82px minmax(0, 1fr);
          gap: 12px;
          border-top: 1px solid #ece7dc;
          padding-top: 10px;
        }

        .activity-time {
          color: #0f766e;
          font-size: 13px;
          font-weight: 900;
        }

        .activity-body p {
          margin: 5px 0 0;
          color: #475467;
          font-size: 14px;
          line-height: 1.45;
        }

        .activity-title {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
        }

        .activity-title span {
          border-radius: 999px;
          background: #fff7ed;
          color: #9a3412;
          padding: 3px 8px;
          font-size: 12px;
          font-weight: 900;
        }

        .activity-body a {
          display: inline-flex;
          margin-top: 8px;
          color: #0f766e;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
        }

        .muted {
          color: #667085;
        }

        .alert {
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fff1f2;
          color: #9f1239;
          padding: 12px 14px;
        }

        .state-panel,
        .empty-state {
          display: grid;
          place-items: center;
          min-height: 220px;
          color: #667085;
          text-align: center;
        }

        .empty-state strong {
          display: block;
          color: #18212a;
          font-size: 18px;
        }

        @media (max-width: 820px) {
          .trip-hero,
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .section-heading,
          .day-header {
            flex-direction: column;
            align-items: stretch;
          }

          .day-summary {
            max-width: none;
            text-align: left;
          }
        }

        @media (max-width: 560px) {
          .page-shell {
            width: min(100% - 24px, 1040px);
            padding-top: 20px;
          }

          .top-bar {
            align-items: stretch;
            flex-direction: column;
          }

          .day-card {
            grid-template-columns: 1fr;
          }

          .day-marker {
            justify-content: flex-start;
            padding-top: 0;
          }

          .activity-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
