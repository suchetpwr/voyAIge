import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Trip = {
  _id: string;
  destination: string;
  startDate: string; // ISO from API
  endDate: string;   // ISO from API
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

export default function HomePage() {
  // form state
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');     // YYYY-MM-DD
  const [travelers, setTravelers] = useState<number>(1);
  const [preferencesInput, setPreferencesInput] = useState(''); // comma-separated
  const [budgetLevel, setBudgetLevel] = useState<'low'|'mid'|'high'|''>('');
  const [notes, setNotes] = useState('');

  // ui state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [creating, setCreating] = useState(false);
  const [planLoadingId, setPlanLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preferences = useMemo(
    () => preferencesInput.split(',').map(s => s.trim()).filter(Boolean),
    [preferencesInput]
  );

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

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!destination || !startDate || !endDate || !travelers) {
      setError('Please fill destination, dates, and travelers.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
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
        throw new Error(err.error || `Create failed (${res.status})`);
      }
      // clear some fields (keep destination if you like)
      setDestination('');
      setStartDate('');
      setEndDate('');
      setTravelers(1);
      setPreferencesInput('');
      setBudgetLevel('');
      setNotes('');
      await fetchTrips();
    } catch (e: any) {
      setError(e.message || 'Failed to create trip');
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
    <main style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ marginBottom: 8 }}>🗺️ voyAIge</h1>
      <p style={{ color: '#555', marginTop: 0, marginBottom: '1.25rem' }}>
        Create a trip, then generate a day-by-day itinerary with AI.
      </p>

      {/* Create Trip Form */}
      <form onSubmit={createTrip} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Destination</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Lisbon, Portugal"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label>Travelers</label>
            <input
              type="number"
              min={1}
              value={travelers}
              onChange={(e) => setTravelers(Number(e.target.value))}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label>Preferences (comma-separated)</label>
            <input
              value={preferencesInput}
              onChange={(e) => setPreferencesInput(e.target.value)}
              placeholder="food, museums, outdoors"
              style={inputStyle}
            />
          </div>

          <div>
            <label>Budget</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              {(['low', 'mid', 'high'] as const).map((b) => (
                <label key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="budget"
                    value={b}
                    checked={budgetLevel === b}
                    onChange={() => setBudgetLevel(b)}
                  />
                  {b}
                </label>
              ))}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="budget"
                  value=""
                  checked={budgetLevel === ''}
                  onChange={() => setBudgetLevel('')}
                />
                none
              </label>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label>Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the model should consider (mobility, allergies, must-see spots)..."
              style={{ ...inputStyle, minHeight: 72 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={creating} style={buttonStyle}>
            {creating ? 'Creating…' : 'Create Trip'}
          </button>
        </div>
      </form>

      {error && (
        <p style={{ color: '#b00020', marginTop: -8, marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* Trips List */}
      <h2 style={{ marginTop: 0 }}>Your Trips</h2>
      {trips.length === 0 ? (
        <p>No trips yet. Create one above.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {trips.map((t) => {
            const planned = (t.itinerary?.length || 0) > 0;
            return (
              <div key={t._id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.destination}</div>
                    <div style={{ fontSize: 14, color: '#555' }}>
                      {new Date(t.startDate).toISOString().slice(0,10)} → {new Date(t.endDate).toISOString().slice(0,10)} · {t.travelers} traveler{t.travelers>1?'s':''}
                    </div>
                    {t.tags && t.tags.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {t.tags.map((tag) => (
                          <span key={tag} style={pillStyle}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => planTrip(t._id, false)}
                      disabled={planLoadingId === t._id}
                      style={buttonStyle}
                    >
                      {planLoadingId === t._id ? 'Planning…' : planned ? 'Re-plan' : 'Plan'}
                    </button>
                    {planned && (
                      <button
                        onClick={() => planTrip(t._id, true)}
                        disabled={planLoadingId === t._id}
                        style={{ ...buttonStyle, background: '#444' }}
                      >
                        {planLoadingId === t._id ? 'Planning…' : 'Force Re-plan'}
                      </button>
                    )}
                    <Link href={`/trips/${t._id}`} style={{ ...buttonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  marginTop: 6,
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14
};

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
