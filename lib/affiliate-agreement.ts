import { createHash } from 'crypto';

export const AFFILIATE_AGREEMENT_VERSION = 'v1';
export const AFFILIATE_AGREEMENT_EFFECTIVE_DATE = '2026-08-13';

export interface AffiliateAgreementSection {
  heading: string;
  paragraphs: string[];
}

export const AFFILIATE_AGREEMENT_SECTIONS: AffiliateAgreementSection[] = [
  {
    heading: 'Independent Content Creator & Partner',
    paragraphs: [
      'As an affiliate partner ("Affiliate"), you create and publish promotional content ("Content") about the Platform at your own discretion. You are solely and fully responsible for the accuracy, legality, and compliance of your Content, including any claims, demonstrations, or testimonials regarding the Platform\'s features or performance.',
    ],
  },
  {
    heading: 'No Company Liability for Affiliate Content',
    paragraphs: [
      'The Company does not pre-approve, edit, or control Content before publication. The Company is not liable for any claim, dispute, damage, or regulatory action arising from Affiliate\'s Content, including claims of false advertising, defamation, privacy violations, or intellectual property infringement.',
    ],
  },
  {
    heading: 'Truthful, Substantiated Claims Only',
    paragraphs: [
      'Affiliate will not make claims about Platform outcomes (e.g. guaranteed revenue, specific conversion rates, or exaggerated performance) that are false, unsubstantiated, or misleading. Any testimonial must reflect Affiliate\'s genuine use and experience with the product.',
    ],
  },
  {
    heading: 'Age Requirement',
    paragraphs: [
      'Affiliates must be at least 18 years old (or the legal age of majority in their jurisdiction) to participate in this program. The Company reserves the right to terminate any affiliate account found to belong to a minor.',
    ],
  },
  {
    heading: 'Mandatory Advertising Disclosure',
    paragraphs: [
      'Affiliate must clearly and conspicuously disclose the paid/affiliate relationship in every promotional communication or social post using clear labels (e.g., "#ad," "#affiliate," "Sponsored") in compliance with applicable consumer protection and advertising endorsement laws.',
    ],
  },
  {
    heading: 'Content Standards',
    paragraphs: [
      'Content must not be unlawful, deceptive, discriminatory, defamatory, or infringing upon third-party intellectual property or privacy rights.',
    ],
  },
  {
    heading: 'Indemnification',
    paragraphs: [
      'Affiliate agrees to indemnify and hold harmless the Company, its founders, officers, and employees from any losses, claims, damages, or legal fees resulting from Affiliate\'s Content, conduct, or breach of these terms.',
    ],
  },
  {
    heading: 'Termination & Right to Withhold',
    paragraphs: [
      'The Company reserves the right to suspend or terminate affiliate accounts, and void pending commissions, for violations of these terms, fraudulent referral activity, or abuse.',
    ],
  },
  {
    heading: 'No Agency Relationship',
    paragraphs: [
      'This agreement does not create an employment, partnership, joint venture, or agency relationship. Affiliate has no authority to bind the Company to any contract or representation.',
    ],
  },
  {
    heading: 'Acceptance',
    paragraphs: [
      'By registering as an affiliate, you confirm that you have read, understood, and agreed to be bound by these Affiliate Terms.',
    ],
  },
];

function buildAgreementPlainText() {
  return AFFILIATE_AGREEMENT_SECTIONS.map((section) => {
    const body = section.paragraphs.join('\n');
    return `${section.heading}\n${body}`;
  }).join('\n\n');
}

export const AFFILIATE_AGREEMENT_HASH = createHash('sha256')
  .update(
    [
      AFFILIATE_AGREEMENT_VERSION,
      AFFILIATE_AGREEMENT_EFFECTIVE_DATE,
      buildAgreementPlainText(),
    ].join('\n---\n')
  )
  .digest('hex');
