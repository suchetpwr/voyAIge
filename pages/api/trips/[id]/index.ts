import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import Trip from '@/models/Trip';
import mongoose from 'mongoose';
import { serializeDate, validateTripInput } from '@/lib/tripValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PATCH', 'PUT'].includes(req.method || '')) return res.status(405).json({ error: 'Method Not Allowed' });
  await connectToDatabase();

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid trip id' });
  }

  const trip = await Trip.findById(id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  if (req.method === 'GET') {
    return res.status(200).json(trip);
  }

  const { input, error } = validateTripInput(req.body);
  if (!input) return res.status(400).json({ error });

  const dateChanged =
    serializeDate(trip.startDate) !== serializeDate(input.startDate) ||
    serializeDate(trip.endDate) !== serializeDate(input.endDate);
  const destinationChanged = trip.destination !== input.destination;

  trip.set({
    ...input,
    ...(dateChanged || destinationChanged ? { itinerary: [], tags: [] } : {})
  });
  await trip.save();

  return res.status(200).json(trip);
}
