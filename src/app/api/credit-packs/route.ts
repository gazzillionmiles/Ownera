import { NextRequest, NextResponse } from 'next/server';
import { getAllPacks } from '@/src/config/creditPacks';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const basePacks = getAllPacks();

  let hasDiscount = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getVerifiedUser(request, supabase);

    if (user) {
      const serviceSupabase = createAdminClient();
      const { data: activeRef } = await serviceSupabase
        .from('referrals')
        .select('id')
        .eq('referred_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (activeRef) {
        hasDiscount = true;
      }
    }
  } catch {
    // Non-fatal if unauthenticated
  }

  const packs = basePacks.map((pack) => {
    if (!hasDiscount) return pack;
    const discountedPrice = Math.floor(pack.price * 0.8);
    return {
      ...pack,
      originalPrice: pack.price,
      price: discountedPrice,
      costPerCredit: Number((discountedPrice / pack.credits).toFixed(2)),
      isDiscounted: true,
      discountPercent: 20,
    };
  });

  return NextResponse.json({
    packs,
    currency: 'INR',
    symbol: '₹',
    hasDiscount,
    discountPercent: hasDiscount ? 20 : 0,
  });
}
