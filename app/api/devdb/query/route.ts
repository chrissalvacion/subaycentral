import { NextResponse } from "next/server";
import { queryTable } from "@/lib/sqlite";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = queryTable(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { data: null, count: null, error: { message: (error as Error).message } },
      { status: 500 }
    );
  }
}
