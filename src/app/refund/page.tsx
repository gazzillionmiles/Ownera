import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/src/shared/components/Footer';
import { APP_NAME, SUPPORT_EMAIL } from '@/src/constants';

export const metadata: Metadata = {
  title: `Refund Policy | ${APP_NAME}`,
  description: `Refund and cancellation terms for ${APP_NAME}.`,
};

export default function RefundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121316] text-[#1C1C1C] dark:text-white">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-12 flex-1">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:underline text-[#2CB7A5]">
          ← Back to {APP_NAME}
        </Link>

        <h1 className="font-bold text-4xl tracking-tight mb-4">Refund Policy</h1>
        <p className="text-sm text-zinc-500 mb-8">Effective Date: [INSERT DATE, e.g. August 2026]</p>

        <div className="prose prose-neutral dark:prose-invert text-[15px] leading-relaxed space-y-6">
          <p>
            {APP_NAME} uses a one-time digital credit purchase model. Because digital credits are consumable assets made immediately available upon payment, purchases are generally non-refundable once credited.
          </p>

          <h2 className="font-semibold text-xl tracking-tight mt-6 mb-2">Technical Errors &amp; Automated Refunds</h2>
          <p>
            If a system error or unrecoverable API failure occurs during an operation, your credits are automatically refunded to your balance via atomic database ledger transactions.
          </p>

          <h2 className="font-semibold text-xl tracking-tight mt-6 mb-2">Manual Refund Requests</h2>
          <p>
            If you experienced an unfulfilled payment or billing discrepancy, please contact <a href={`mailto:${SUPPORT_EMAIL}`} className="underline text-[#2CB7A5]">{SUPPORT_EMAIL}</a> within 7 days of purchase with your payment order ID.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
