import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/src/shared/components/Footer';
import { APP_NAME, SUPPORT_EMAIL } from '@/src/constants';

export const metadata: Metadata = {
  title: `About | ${APP_NAME}`,
  description: `Learn more about ${APP_NAME} and our mission.`,
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121316] text-[#1C1C1C] dark:text-white">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-12 flex-1">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:underline text-[#2CB7A5]">
          ← Back to {APP_NAME}
        </Link>

        <h1 className="font-bold text-4xl tracking-tight mb-4">About {APP_NAME}</h1>

        <div className="prose prose-neutral dark:prose-invert text-[15px] leading-relaxed space-y-6 text-zinc-300">
          <p>
            <strong>{APP_NAME}</strong> is a collective-buying platform for residential societies. We aggregate demand from residents so multiple homes can purchase the same standardized household service together at a better price, while service providers get many customers at one single location.
          </p>

          <h2 className="font-semibold text-2xl tracking-tight mt-8 mb-3 text-white">How We Are Different</h2>
          <p>
            Traditional home service marketplaces treat each house as a standalone trip, which causes high vendor travel overhead and inflated prices. Ownera turns many individual homes into one concentrated bulk deal. Providers compete with structured bids for high-volume society camps, unlocking 25%–40% savings.
          </p>

          <h2 className="font-semibold text-2xl tracking-tight mt-8 mb-3 text-white">Contact &amp; Partnerships</h2>
          <p>
            Want to bring Ownera to your residential society or join as a service provider? Reach our team at <a href={`mailto:${SUPPORT_EMAIL}`} className="underline text-[#2CB7A5]">{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
