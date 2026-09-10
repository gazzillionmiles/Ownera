/**
 * src/types/ownera.ts
 * Core domain types for the Ownera collective-buying platform.
 */

export type PlatformRole = 'platform_admin' | 'support_admin';

export type SocietyRole = 'secretary' | 'committee' | 'resident';

export type UserRole = 'resident' | 'secretary' | 'committee' | 'organizer' | 'provider' | 'admin';

export type PropertyType =
  | 'flat'
  | 'apartment'
  | 'tenement'
  | 'row_house'
  | 'bungalow'
  | 'villa'
  | 'shop'
  | 'other';

export type PollScope = 'my_house' | 'society';

export type SecretaryApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface PlatformAdmin {
  id: string;
  user_id: string;
  role: PlatformRole;
  status: 'active' | 'suspended';
  created_at: string;
  created_by?: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

export interface SocietyInvitation {
  id: string;
  society_id: string;
  email?: string | null;
  phone?: string | null;
  role: SocietyRole;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invited_by: string;
  created_at: string;
  expires_at: string;
  society?: Society;
}

export interface SocietyInviteLink {
  id: string;
  society_id: string;
  token: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  rotated_at?: string | null;
  society?: Society;
}

export interface Society {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  address?: string | null;
  city: string;
  state?: string | null;
  pincode?: string | null;
  total_homes: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  secretary?: SocietyMember | null;
  user_role?: SocietyRole | string;
  flat_number?: string;
  property_type?: string;
  member_count?: number;
}

export interface SocietyMember {
  id: string;
  society_id: string;
  user_id: string;
  flat_number: string;
  unit_number?: string | null;
  property_type?: PropertyType | string;
  role: SocietyRole | 'organizer';
  status: 'active' | 'pending' | 'inactive';
  joined_at?: string;
  society?: Society;
  user_profile?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  typical_duration_minutes: number;
  suggested_campaign_days: number;
  suggested_slot_duration_minutes: number;
  base_price_estimate: number;
  icon?: string;
  created_at?: string;
}

export type CampaignStatus =
  | 'draft'
  | 'poll_active'
  | 'pending_secretary_approval'
  | 'approved'
  | 'quotes_invited'
  | 'quote_selected'
  | 'open'
  | 'threshold_reached'
  | 'bidding'
  | 'provider_selected'
  | 'booking_open'
  | 'confirmed'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface PricingTier {
  id: string;
  campaign_id: string;
  min_quantity: number;
  max_quantity: number | null;
  price_per_unit: number;
  tier_order: number;
  created_at?: string;
}

export interface Provider {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  services_offered: string[];
  operating_cities: string[];
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'banned';
  rating: number;
  total_jobs_completed: number;
  completion_rate: number;
  bio?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProviderBid {
  id: string;
  campaign_id: string;
  provider_id?: string | null;
  provider?: Provider;
  price_per_unit: number;
  available_date: string;
  available_start_time?: string;
  simultaneous_capacity?: number;
  technicians_count?: number;
  estimated_duration_minutes?: number;
  total_capacity?: number;
  max_capacity?: number;
  service_duration_minutes?: number;
  warranty_days?: number | string | null;
  inclusions?: string[];
  exclusions?: string[];
  notes?: string | null;
  vendor_invite_id?: string | null;
  status: 'submitted' | 'accepted' | 'rejected' | 'withdrawn';
  created_at?: string;
  updated_at?: string;
}

export interface CampaignVendorInvite {
  id: string;
  campaign_id: string;
  provider_id?: string | null;
  business_name: string;
  phone: string;
  whatsapp_number?: string | null;
  invited_by: string;
  status: 'invited' | 'quote_submitted' | 'declined';
  invite_token: string;
  created_at: string;
}

export interface PollVote {
  id: string;
  campaign_id: string;
  user_id: string;
  option_selected: string;
  unit_identifier: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  user_profile?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export type ParticipantStatus =
  | 'interested'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'issue_reported';

export interface CampaignParticipant {
  id: string;
  campaign_id: string;
  user_id: string;
  quantity: number;
  unit_identifier: string;
  status: ParticipantStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  user_name?: string;
  user_email?: string;
}

export interface BookingSlot {
  id: string;
  campaign_id: string;
  slot_time: string;
  max_capacity: number;
  booked_count: number;
  created_at?: string;
}

export type BookingStatus =
  | 'confirmed'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export interface Booking {
  id: string;
  society_id: string;
  campaign_id: string;
  user_id: string;
  provider_id?: string | null;
  slot_id?: string | null;
  quantity: number;
  flat_number: string;
  unit_price: number;
  deposit_paid: number;
  balance_amount: number;
  total_amount: number;
  payment_mode?: 'direct_to_provider' | 'online';
  status: BookingStatus;
  resident_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  society?: Society;
  campaign?: ServiceCampaign;
  provider?: Provider;
  slot?: BookingSlot;
  service_issue?: ServiceIssue | null;
  service_rating?: ServiceRating | null;
  user_profile?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

export interface ServiceCampaign {
  id: string;
  society_id: string;
  organizer_id: string;
  service_id: string;
  title: string;
  description?: string | null;
  scope?: PollScope;
  target_property_unit?: string | null;
  poll_question?: string;
  poll_options?: string[];
  poll_deadline?: string;
  secretary_approval_status?: SecretaryApprovalStatus;
  secretary_reviewed_by?: string | null;
  secretary_reviewed_at?: string | null;
  rejection_reason?: string | null;
  is_custom_service?: boolean;
  custom_service_name?: string | null;
  event_date: string;
  interest_deadline?: string;
  booking_deadline?: string;
  minimum_customers: number;
  target_customers: number;
  maximum_customers?: number | null;
  deposit_amount?: number;
  status: CampaignStatus;
  selected_provider_id?: string | null;
  selected_bid_id?: string | null;
  current_price: number;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  society?: Society;
  service?: ServiceCatalogItem;
  selected_provider?: Provider;
  selected_bid?: ProviderBid;
  pricing_tiers?: PricingTier[];
  interested_count?: number;
  confirmed_count?: number;
  completed_count?: number;
  total_votes?: number;
  vote_breakdown?: Record<string, number>;
  bids_count?: number;
  bids?: ProviderBid[];
  vendor_invites?: CampaignVendorInvite[];
  poll_votes?: PollVote[];
  slots?: BookingSlot[];
  price_info?: {
    currentPrice: number;
    basePrice: number;
    maxSavings: number;
    currentSavings: number;
    nextTier: { neededCount: number; price: number; savings: number } | null;
    isThresholdReached: boolean;
  };
  user_vote?: PollVote | null;
  user_participant?: CampaignParticipant | null;
  user_booking?: Booking | null;
  creator_profile?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export interface ServiceCompletion {
  id: string;
  booking_id: string;
  provider_id: string;
  marked_completed_at: string;
  resident_confirmed_at?: string | null;
  resident_status: 'unconfirmed' | 'confirmed' | 'disputed';
  notes?: string | null;
}

export interface ServiceIssue {
  id: string;
  society_id: string;
  booking_id: string;
  user_id: string;
  provider_id?: string | null;
  description: string;
  category: 'quality' | 'no_show' | 'damage' | 'pricing' | 'delay' | 'other';
  photo_url?: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  resolution_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceRating {
  id: string;
  society_id?: string;
  booking_id: string;
  user_id: string;
  provider_id: string;
  campaign_id: string;
  rating: number;
  review?: string | null;
  created_at?: string;
}

export interface OwneraNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  type: 'campaign' | 'booking' | 'bid' | 'completion' | 'general' | 'poll';
  created_at: string;
}
