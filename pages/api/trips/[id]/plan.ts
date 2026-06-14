import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import Trip from '@/models/Trip';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import { daysBetween, MAX_TRIP_DAYS } from '@/lib/tripValidation';
// import OpenAI from 'openai'  // we’ll init Groq-compatible client

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    await connectToDatabase();

    const { id } = req.query;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid trip id' });
    }

    // 1) load trip
    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const force = req.query.force === '1';
    if (!force && trip.itinerary?.length) {
        return res.status(200).json(trip); // already planned
    }

    const requestedDays = daysBetween(trip.startDate, trip.endDate);
    if (requestedDays > MAX_TRIP_DAYS) {
        return res.status(400).json({ error: `Trips can be at most ${MAX_TRIP_DAYS} days, roughly 6 months.` });
    }

    // 2) build prompt
    const prompt = `
Return ONLY minified JSON: {"tags":["tag1","tag2"],"itinerary":[{"date":"YYYY-MM-DD","summary":"...","activities":[{"time":"09:00","title":"...","location":"...","address":"...","estCost":20}]}]}

Inputs:
- destination: ${trip.destination}
- dates: ${trip.startDate.toISOString().slice(0, 10)} to ${trip.endDate.toISOString().slice(0, 10)} (inclusive)
- travelers: ${trip.travelers}
- preferences: ${(trip.preferences || []).join(', ') || 'none'}
- budget: ${trip.budgetLevel || 'unspecified'}
- notes: ${trip.notes || 'none'}

Rules:
- One day object per calendar day in the range with "date":"YYYY-MM-DD".
- Use realistic times; short titles; include addresses when possible.
- estCost is a number (omit if unsure). No extra keys or prose.
`.trim();

    // 3) call LLM


    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
    }

    const groq = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    });

    let raw = '';
    try {
        const completion = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }], 
            temperature: 0.2,
        });
        raw = completion.choices[0]?.message?.content ?? '';
    } catch (e: any) {
        console.error('LLM error:', e?.message || e);
        return res.status(502).json({
            error: 'Planner service failed',
            ...(process.env.NODE_ENV !== 'production' && { detail: e?.message || String(e) })
        });
    }

    // 4) extract + validate JSON

    function extractJson(text: string) {
        try { return JSON.parse(text); } catch { }
        const m1 = text.match(/```json\s*([\s\S]*?)\s*```/i);
        if (m1) { try { return JSON.parse(m1[1]); } catch { } }
        const m2 = text.match(/\{[\s\S]*\}/);
        if (m2) { try { return JSON.parse(m2[0]); } catch { } }
        return null;
    }

    const parsed = extractJson(raw);
    if (!parsed) return res.status(502).json({ error: 'Bad LLM response (no JSON)', raw });


    // 5) save itinerary + tags

    const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (!Array.isArray(parsed.itinerary) || parsed.itinerary.length === 0)
        return res.status(502).json({ error: 'No itinerary in response', raw });

    const startISO = trip.startDate.toISOString().slice(0, 10);
    const endISO = trip.endDate.toISOString().slice(0, 10);
    const expectedDays = daysBetween(new Date(startISO), new Date(endISO));

    // date count sanity (allow off-by-one once; models aren’t perfect)
    if (parsed.itinerary.length < expectedDays - 1 || parsed.itinerary.length > expectedDays + 1) {
        return res.status(502).json({ error: 'Itinerary length mismatch', expectedDays, got: parsed.itinerary.length, raw });
    }

    for (const day of parsed.itinerary) {
        if (!isISO(day.date)) return res.status(502).json({ error: 'Invalid day.date format', day });
        if (!Array.isArray(day.activities)) return res.status(502).json({ error: 'day.activities must be array', day });
        for (const a of day.activities) {
            if (!a.title || typeof a.title !== 'string') return res.status(502).json({ error: 'activity.title required', a });
            if (a.time && !/^\d{2}:\d{2}$/.test(a.time)) return res.status(502).json({ error: 'activity.time must be HH:MM', a });
            if (a.estCost != null && typeof a.estCost !== 'number') return res.status(502).json({ error: 'activity.estCost must be number', a });
        }
    }

    const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).map((t: string) => t.trim()).filter(Boolean) : [];


    trip.set({ itinerary: parsed.itinerary, tags });
    await trip.save();
    return res.status(200).json(trip);

}
