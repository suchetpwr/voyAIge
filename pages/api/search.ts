import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import mongoose from 'mongoose';
import Document from '@/models/Trip';

const INDEX_NAME = process.env.ATLAS_SEARCH_INDEX || 'text_index'; // ensure this matches Atlas

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectToDatabase();
  const q = String(req.query.q || '').trim();

  // Return everything if no query
  if (!q) {
    const docs = await Document.find().sort({ createdAt: -1 });
    return res.status(200).json(docs);
  }

  try {
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'Database not initialized' });

    const result = await db.collection('documents')
      .aggregate([
        {
          $search: {
            index: INDEX_NAME,
            compound: {
              should: [
                {
                  text: {
                    query: q,
                    path: 'tags',
                    score: { boost: { value: 3 } }
                  }
                },
                {
                  text: {
                    query: q,
                    path: 'content'
                  }
                }
              ],
              minimumShouldMatch: 1
            }
          }
        },
        { $limit: 50 },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();

    // If Atlas Search returns empty, fall back to regex to verify data shape
    if (!result || result.length === 0) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const fallback = await Document.find({
        $or: [
          { tags: { $elemMatch: { $regex: rx } } },
          { content: { $regex: rx } }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(50);

      return res.status(200).json(fallback);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Search error:', err?.message || err);
    return res.status(500).json({ error: 'Search pipeline error', detail: String(err) });
  }
}
