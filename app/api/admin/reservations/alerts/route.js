import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/auth.js';
import { getReservationAlerts, processAutoNoShows } from '@/lib/leads.js';

const authService = new AuthService();

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await authService.verifySession(token);
    if (!user || !['admin', 'waiter'].includes(user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
      await processAutoNoShows();
    } catch {
      /* non-fatal */
    }

    const data = await getReservationAlerts();
    // Waiters only see arrived / VIP / special / arriving soon — not cancel tooling
    if (user.role === 'waiter') {
      data.alerts = (data.alerts || []).filter((a) =>
        [
          'arriving_soon',
          'arrived',
          'vip_arrived',
          'special_request',
          'late',
          'occasion_today',
          'no_show_candidate',
        ].includes(a.type)
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Reservation alerts error:', error);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}
