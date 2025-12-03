import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// User submits changes
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { itemId, userId, newStatus, newLocation, note } = body;
  const request = await prisma.inventoryRequests.create({
    data: { itemId, userId, newStatus, newLocation, note }
  });
  return NextResponse.json({ request });
}

// Admin fetches all requests
export async function GET() {
  const requests = await prisma.inventoryRequests.findMany({
    where: { status: 'PENDING' },
    include: { item: true },
    orderBy: { createdAt: 'asc' }
  });
  return NextResponse.json({ requests });
}

// Admin approves/resubmits
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, action } = body; // action = 'APPROVE' | 'RESUBMIT'
  if (action === 'APPROVE') {
    const reqData = await prisma.inventoryRequests.update({
      where: { id },
      data: { status: 'APPROVED' }
    });
    // Apply changes to Items
    await prisma.items.update({
      where: { id: reqData.itemId },
      data: {
        status: reqData.newStatus || undefined,
        location: reqData.newLocation || undefined
      }
    });
    return NextResponse.json({ ok: true });
  } else {
    await prisma.inventoryRequests.update({
      where: { id },
      data: { status: 'RESUBMIT' }
    });
    return NextResponse.json({ ok: true });
  }
}