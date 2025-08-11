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
  date: string;        // YYYY-MM-DD
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
  budgetLevel?: 'low'|'mid'|'high';
  notes?: string;
  tags?: string[];
  itinerary?: DayPlan[];
  createdAt: string;
};

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

  useEffect(() => { fetchTrip(); /* eslint-disable-next-line */ }, [id]);

  const days = useMemo(() => {
    return [...(trip?.itinerary || [])].sort((a, b) => a.date.localeCompare(b.date));
  }, [trip]);

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
    <main style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem', fontFamily: 'ui-sans-serif, system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>🗺️ Trip</h1>
        <Link href="/" style={{ textDecoration: 'none', fontSize: 14 }}>← Back</Link>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      {trip && (
        <>
          <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>{trip.destination}</h2>
            <p style={{ margin: 0, color: '#555' }}>
              {new Date(trip.startDate).toISOString().slice(0,10)} → {new Date(trip.endDate).toISOString().slice(0,10)} · {trip.travelers} traveler{trip.travelers>1?'s':''}
            </p>
            {trip.preferences?.length ? (
              <p style={{ marginTop: 6, color: '#555' }}>Preferences: {trip.preferences.join(', ')}</p>
            ) : null}
            {trip.budgetLevel ? <p style={{ marginTop: 6, color: '#555' }}>Budget: {trip.budgetLevel}</p> : null}
            {trip.notes ? <p style={{ marginTop: 6 }}>{trip.notes}</p> : null}

            {trip.tags && trip.tags.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {trip.tags.map((tag) => (
                  <span key={tag} style={pillStyle}>{tag}</span>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <button onClick={() => replan(true)} disabled={planLoading} style={buttonStyle}>
                {planLoading ? 'Re-planning…' : 'Re-plan Itinerary'}
              </button>
            </div>
          </section>

          <section style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0 }}>Itinerary</h3>
            {!days.length ? (
              <p>No itinerary yet. Click “Re-plan Itinerary”.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {days.map((d) => (
                  <div key={d.date} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>{d.date}</strong>
                      {d.summary && <span style={{ color: '#555', fontSize: 14 }}>{d.summary}</span>}
                    </div>
                    {d.activities && d.activities.length > 0 ? (
                      <ul style={{ marginTop: 8 }}>
                        {d.activities.map((a, idx) => (
                          <li key={idx} style={{ marginBottom: 6 }}>
                            <div>
                              {a.time ? <strong>{a.time}</strong> : null} {a.title}
                              {a.location ? <span style={{ color: '#555' }}> — {a.location}</span> : null}
                            </div>
                            <div style={{ fontSize: 13, color: '#666' }}>
                              {a.address ? <span>{a.address}</span> : null}
                              {a.estCost != null ? <span>{a.address ? ' · ' : ''}Est. cost: {a.estCost}</span> : null}
                              {a.bookingLink ? (
                                <>
                                  {(a.address || a.estCost != null) ? ' · ' : ''}<a href={a.bookingLink} target="_blank" rel="noreferrer">Book</a>
                                </>
                              ) : null}
                              {a.notes ? <div style={{ marginTop: 2 }}>{a.notes}</div> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#777' }}>No activities listed.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #000',
  background: '#000',
  color: '#fff',
  cursor: 'pointer'
};

const pillStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '2px 8px',
  borderRadius: 999,
  background: '#f1f1f1'
};
