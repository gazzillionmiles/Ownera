import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/src/shared/components/Footer';
import { APP_NAME, SUPPORT_EMAIL } from '@/src/constants';

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: `How ${APP_NAME} collects, handles, and protects your personal data.`,
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121316] text-[#1C1C1C] dark:text-white">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-12 flex-1">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-8 hover:underline text-[#2CB7A5]">
          ← Back to {APP_NAME}
        </Link>

        <h1 className="font-bold text-4xl tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-8">Last Updated: [INSERT DATE, e.g. August 2026]</p>

        <div className="prose prose-neutral dark:prose-invert text-[15px] leading-relaxed space-y-8">
          <section>
            <h2 className="font-semibold text-xl tracking-tight mb-2">1. Overview</h2>
            <p>
              This Privacy Policy explains how [INSERT COMPANY NAME OR LEGAL ENTITY] (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and safeguards information when you use {APP_NAME}.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl tracking-tight mb-2">2. Information We Collect</h2>
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li><strong>Account Data:</strong> Email address and authentication provider identifiers.</li>
              <li><strong>Transaction Data:</strong> Payment transaction records and credit balance ledgers.</li>
              <li><strong>Usage Data:</strong> Anonymized operational metrics and feature interactions.</li>
              <li><strong>User Content:</strong> [DESCRIBE USER UPLOADS / INPUT DATA PROCESSED BY YOUR SAAS]</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-xl tracking-tight mb-2">3. Sub-Processors &amp; Infrastructure</h2>
            <p>We process data with trusted infrastructure partners under strict data protection terms:</p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li>Authentication &amp; Database: Supabase</li>
              <li>Payment Processing: Razorpay / Stripe</li>
              <li>Cloud Storage: Amazon Web Services (AWS S3)</li>
              <li>Rate Limiting &amp; Caching: Upstash Redis</li>
              <li>[LIST YOUR SUB-PROCESSORS: e.g., OpenAI, Anthropic, Google Cloud]</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-xl tracking-tight mb-2">4. Data Retention &amp; Account Deletion</h2>
            <p>
              You may request deletion of your account and associated personal data at any time through account settings or by contacting <a href={`mailto:${SUPPORT_EMAIL}`} className="underline text-[#2CB7A5]">{SUPPORT_EMAIL}</a>. We support a 30-day grace period before permanent data purging.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl tracking-tight mb-2">5. Security Safeguards</h2>
            <p>
              We implement industry-standard encryption in transit (HTTPS/TLS) and at rest, alongside Row Level Security (RLS) on all database tables.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-xl tracking-tight mb-2">6. Contact Us</h2>
            <p>
              For any privacy inquiries or to exercise your data rights, reach us at <a href={`mailto:${SUPPORT_EMAIL}`} className="underline text-[#2CB7A5]">{SUPPORT_EMAIL}</a>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
