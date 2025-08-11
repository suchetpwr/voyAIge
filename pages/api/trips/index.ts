import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import Trip from '@/models/Trip';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await connectToDatabase();

    try {
        if (req.method == 'POST') {
            const { destination, startDate, endDate, travelers, preferences, budgetLevel, notes } = req.body || {};
            if (!destination || typeof destination !== 'string') return res.status(400).json({ error: 'Destination is required' });
            if (!startDate || !isISODate(startDate)) return res.status(400).json({ error: 'Date is missing or date format is not correct' });
            if (!endDate || !isISODate(endDate)) return res.status(400).json({ error: 'Date is missing or date format is not correct' });
            const t = Number(travelers);
            if (!Number.isInteger(t) || t < 1) {
                return res.status(400).json({ error: 'travelers must be a positive integer.' });
            }
            if (new Date(endDate) < new Date(startDate)) {
                return res.status(400).json({ error: 'endDate must be on or after startDate.' });
            }

            const destinationNorm = destination.trim();
            const toUTC = (iso: string) => new Date(iso + 'T00:00:00.000Z');
            const start = toUTC(startDate);
            const end = toUTC(endDate);
            const prefs = Array.isArray(preferences) ? preferences.map(p => String(p).trim()).filter(Boolean) : undefined;
            const budget = budgetLevel ?? undefined;
            const notesStr = notes?.trim() || undefined;

            const trip = await Trip.create({
                destination: destinationNorm,
                startDate: start,
                endDate: end,
                travelers,
                ...(prefs && { preferences: prefs }),
                ...(budget && { budgetLevel: budget }),
                ...(notesStr && { notes: notesStr })
                // itinerary, tags will be added later by /plan
            });

            return res.status(201).json(trip);
        }
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to create trip' });
    }


    if (req.method == 'GET') {
        const docs = await Trip.find().sort({ createdAt: -1 });
        return res.status(200).json(docs);
    }
    return res.status(405).json({ error: 'Method Not Allowed' });

}
function isISODate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }