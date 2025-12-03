'use server'

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get('user');
  const pass = searchParams.get('pass');

  const account = await prisma.accounts.findFirst({
    where: { userid: user },
  });

  const result = !!account && account.password === pass;

  return NextResponse.json({ success: result, isAdmin: account?.isadmin === true });
}