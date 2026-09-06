import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/src/shared/components/Footer';
import { APP_NAME, SUPPORT_EMAIL } from '@/src/constants';

export const metadata: Metadata = {
  title: `Contact Us | ${APP_NAME}`,
  description: `Get in touch with the ${APP_NAME} support team.`,
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121316] text-[#1C1C1C] dark:text-white">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-12 flex-1">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:underline text-[#2CB7A5]">
          ← Back to {APP_NAME}
        </Link>

        <h1 className="font-bold text-4xl tracking-tight mb-4">Contact Support</h1>
        <p className="text-zinc-400 mb-8">We are here to assist with billing, technical issues, or platform inquiries.</p>

        <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-4">
          <h2 className="text-lg font-semibold text-white">Email Us</h2>
          <p className="text-sm text-zinc-400">
            Send your inquiries directly to:
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-lg font-mono text-[#2CB7A5] underline block"
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="text-xs text-zinc-500 pt-2">
            Typical response time: [INSERT RESPONSE TIME, e.g. within 24-48 business hours]
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
