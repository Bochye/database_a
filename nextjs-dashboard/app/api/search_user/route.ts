'use server'

import { NextResponse, type NextRequest } from "next/server";
const { PrismaClient } = require('@prisma/client') ;
const prisma = new PrismaClient();

//http://localhost:3000/api/search_user?user=hello&pass=word

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const user = searchParams.get('user');
  const pass = searchParams.get('pass');

  const users = await prisma.accounts.findFirst({
  where: {
    userid: user,
  },
  });

  const result = users && users.password === pass;

  return NextResponse.json({ success: result });
}