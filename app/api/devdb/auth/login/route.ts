import { NextResponse } from "next/server";
import { findProfileByEmailPassword } from "@/lib/sqlite";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { data: null, error: { message: "Email and password are required." } },
        { status: 400 }
      );
    }

    const profile = findProfileByEmailPassword(email, password);
    if (!profile) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid email or password." } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      data: {
        user: {
          id: profile.id,
          email: profile.email,
        },
      },
      error: null,
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { message: (error as Error).message } },
      { status: 500 }
    );
  }
}
