import OnlineCheckout from '@/components/online-order/online-checkout.jsx';
import { getPublicMenuCategories } from '@/lib/public-menu.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order Online | Kathmandu Momo', description: 'Send a pickup request by website or WhatsApp.' };

export default async function OrderOnlinePage() {
  return <OnlineCheckout categories={await getPublicMenuCategories()} />;
}
