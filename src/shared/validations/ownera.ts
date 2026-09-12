import { z } from 'zod';

export const propertyTypeSchema = z.enum([
  'flat',
  'apartment',
  'tenement',
  'row_house',
  'bungalow',
  'villa',
  'shop',
  'other',
]);

export const onboardingProfileSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15).optional().nullable(),
  propertyType: propertyTypeSchema.default('apartment'),
  unitNumber: z.string().min(1).max(50),
  societyName: z.string().min(2).max(100).optional(),
  societyId: z.string().optional().nullable(),
});

// NOTE: Joining an existing society happens primarily through the
// reusable secretary-managed invite link (see getInviteLinkQuerySchema /
// rotateInviteLinkSchema / joinByInviteTokenSchema below). The legacy
// static schemas are retained for backward compatibility with existing routes.

export const joinSocietySchema = z.object({
  inviteCode: z.string().max(256).optional().nullable(),
  code: z.string().max(256).optional().nullable(),
  invitationToken: z.string().max(256).optional().nullable(),
  token: z.string().max(256).optional().nullable(),
  flatNumber: z.string().max(100).optional().nullable(),
  unitNumber: z.string().max(100).optional().nullable(),
  propertyType: propertyTypeSchema.default('apartment'),
  role: z.enum(['resident', 'secretary', 'committee', 'organizer']).default('resident'),
}).refine(
  (data) => Boolean((data.inviteCode && data.inviteCode.trim()) || (data.code && data.code.trim()) || (data.invitationToken && data.invitationToken.trim()) || (data.token && data.token.trim())),
  { message: 'Please provide a valid society invite code or invitation token' }
);

export const inviteSocietyMemberSchema = z.object({
  societyId: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10).max(15).optional().nullable(),
  role: z.enum(['secretary', 'committee', 'resident']),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10),
  flatNumber: z.string().min(1).max(50),
  propertyType: propertyTypeSchema.default('apartment'),
});

export const getInviteLinkQuerySchema = z.object({
  societyId: z.string().min(1, 'Society ID is required'),
});

export const rotateInviteLinkSchema = z.object({
  societyId: z.string().min(1, 'Society ID is required'),
});

export const validateInviteTokenQuerySchema = z.object({
  token: z.string().min(10, 'Invalid invite token').max(128, 'Invalid invite token'),
});

export const joinByInviteTokenSchema = z.object({
  token: z.string().min(10, 'Invalid invite token').max(128, 'Invalid invite token'),
  flatNumber: z.string().max(50).optional().nullable(),
  unitNumber: z.string().max(50).optional().nullable(),
  propertyType: propertyTypeSchema.optional().nullable(),
});

export const transferSecretarySchema = z.object({
  societyId: z.string().min(1),
  newSecretaryUserId: z.string().min(1),
  oldSecretaryRole: z.enum(['committee', 'resident']).default('committee'),
});

export const updateMemberRoleSchema = z.object({
  societyId: z.string().min(1),
  targetUserId: z.string().min(1),
  newRole: z.enum(['committee', 'resident']),
});

export const createSocietySchema = z.object({
  name: z.string().min(3).max(100).transform((v) => v.trim()),
  address: z.string().optional(),
  city: z.string().min(2).default('Bengaluru'),
  state: z.string().default('Karnataka'),
  pincode: z.string().optional(),
  totalHomes: z.coerce.number().int().positive().default(100),
  secretaryUserId: z.string().optional().nullable(),
  flatNumber: z.string().min(1).max(50).default('Resident Unit'),
  propertyType: propertyTypeSchema.default('apartment'),
});

// -------------------------------------------------------------
// Ownera POLLS & CAMPAIGNS VALIDATIONS
// -------------------------------------------------------------

export const createPollSchema = z.object({
  societyId: z.string().min(1, 'Society ID is required'),
  scope: z.enum(['my_house', 'society']).default('society'),
  targetPropertyUnit: z.string().max(50).optional().nullable(),
  serviceId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  isCustomService: z.boolean().default(false),
  customServiceName: z.string().max(100).optional().nullable(),
  title: z.string().min(2).max(150),
  description: z.string().max(1000).optional().nullable(),
  pollQuestion: z.string().min(3).max(300).default('Who wants this service?'),
  pollOptions: z.array(z.string().min(1).max(100)).min(1).default(['Yes', 'No']),
  pollDeadlineDays: z.coerce.number().int().min(1).max(30).default(5),
  eventDate: z.string().min(1),
  minimumCustomers: z.coerce.number().int().positive().default(10),
  targetCustomers: z.coerce.number().int().positive().default(30),
});

export const votePollSchema = z.object({
  campaignId: z.string().min(1),
  optionSelected: z.string().min(1).max(100),
  unitIdentifier: z.string().min(1).max(50),
  notes: z.string().max(500).optional().nullable(),
});

export const approvePollSchema = z.object({
  campaignId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional().nullable(),
});

export const inviteVendorSchema = z.object({
  campaignId: z.string().min(1),
  option: z.enum(['existing_provider', 'custom_vendor']),
  providerId: z.string().optional().nullable(),
  businessName: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  whatsappNumber: z.string().min(10).max(15).optional().nullable(),
});

export const submitVendorQuoteSchema = z.object({
  campaignId: z.string().min(1),
  pricePerUnit: z.coerce.number().positive(),
  availableDate: z.string().min(1),
  availableStartTime: z.string().default('10:00 AM'),
  simultaneousCapacity: z.coerce.number().int().positive().default(5),
  techniciansCount: z.coerce.number().int().positive().default(5),
  estimatedDurationMinutes: z.coerce.number().int().positive().default(30),
  totalCapacity: z.coerce.number().int().positive().default(40),
  warrantyDays: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().int().nonnegative().default(0)
  ),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional().nullable(),
  inviteToken: z.string().optional(),
});

export const selectQuoteSchema = z.object({
  campaignId: z.string().min(1),
  bidId: z.string().min(1),
  providerId: z.string().optional().nullable(),
});

export const selectProviderBidSchema = selectQuoteSchema;

export const confirmBookingSchema = z.object({
  campaignId: z.string().min(1),
  flatNumber: z.string().min(1).max(50),
  quantity: z.coerce.number().int().positive().default(1),
  slotId: z.string().optional().nullable(),
  residentNotes: z.string().max(500).optional(),
});

export const selectSlotSchema = z.object({
  bookingId: z.string().min(1),
  slotId: z.string().min(1),
});

export const markCompleteSchema = z.object({
  bookingId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const submitRatingSchema = z.object({
  bookingId: z.string().min(1),
  campaignId: z.string().min(1),
  providerId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
});

export const reportIssueSchema = z.object({
  bookingId: z.string().min(1),
  providerId: z.string().optional().nullable(),
  description: z.string().min(10, 'Please describe the issue in at least 10 characters').max(1000),
  category: z.enum(['quality', 'no_show', 'damage', 'pricing', 'delay', 'other']).default('quality'),
  photoUrl: z.string().optional().nullable(),
});

export const updateServiceIssueSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'escalated']),
  resolutionNotes: z.string().max(1000).optional().nullable(),
});

export const listProviderReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const expressInterestSchema = z.object({
  campaignId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  unitIdentifier: z.string().min(1).max(50),
  notes: z.string().optional(),
});

export const createCampaignSchema = createPollSchema.extend({
  interestDeadline: z.string().optional(),
  bookingDeadline: z.string().optional(),
  maximumCustomers: z.coerce.number().int().positive().optional().nullable(),
  depositAmount: z.coerce.number().default(0),
  pricingTiers: z.array(z.any()).optional(),
});

export const submitBidSchema = submitVendorQuoteSchema.extend({
  maxCapacity: z.coerce.number().int().positive().optional(),
  serviceDurationMinutes: z.coerce.number().int().positive().optional(),
});

export const registerProviderSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name cannot exceed 100 characters'),
  contactPerson: z
    .string()
    .trim()
    .min(2, 'Contact person name must be at least 2 characters')
    .max(60, 'Contact person name cannot exceed 60 characters'),
  phone: z
    .string()
    .trim()
    .transform((val) => val.replace(/[\s\-\(\)]/g, ''))
    .refine(
      (val) => /^(\+91|0)?[6-9]\d{9}$/.test(val),
      'Please enter a valid 10-digit Indian mobile number'
    ),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  servicesOffered: z
    .array(z.string().trim().min(2).max(60))
    .min(1, 'Please select or add at least one service category'),
  operatingCities: z
    .array(z.string().trim().min(2).max(60))
    .min(1, 'Please select at least one operating city'),
  bio: z.string().max(1000).optional().nullable(),
});
