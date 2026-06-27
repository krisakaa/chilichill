import { clearAdminCookie, isAdminSession, setAdminCookie } from '../../../lib/server-data';

export async function GET() {
  return Response.json({ admin: await isAdminSession() });
}

export async function POST(request: Request) {
  const { password } = await request.json();
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return Response.json({ error: 'Admin auth env is not configured' }, { status: 503 });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
  await setAdminCookie();
  return Response.json({ admin: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return Response.json({ admin: false });
}

