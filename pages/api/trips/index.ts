import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import Trip from '@/models/Trip';
import { validateTripInput } from '@/lib/tripValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await connectToDatabase();

    try {
        if (req.method == 'POST') {
            const { input, error } = validateTripInput(req.body);
            if (!input) return res.status(400).json({ error });

            const trip = await Trip.create({
                ...input
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
