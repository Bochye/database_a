// pages/api/items.ts
import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const items = await prisma.items.findMany();
    res.status(200).json(items);
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}