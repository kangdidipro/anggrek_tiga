
import { NextResponse } from 'next/server';

/**
 * Proxy atau Redirect ke endpoint /webhook yang baru untuk kompatibilitas
 */
export async function POST(req: Request) {
  return NextResponse.json({ message: 'Moved to /webhook' }, { status: 308 });
}

export async function GET() {
  return NextResponse.json({ message: 'Moved to /webhook' }, { status: 308 });
}
