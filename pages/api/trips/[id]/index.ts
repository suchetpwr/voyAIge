import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import Trip from '@/models/Trip';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  await connectToDatabase();

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid trip id' });
  }

  const trip = await Trip.findById(id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  return res.status(200).json(trip);
}
