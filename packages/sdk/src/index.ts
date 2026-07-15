/**
 * @chrono/sdk — headless domain layer for Chrono.
 *
 * Pure TypeScript: schema types, Supabase query functions, and pure helpers.
 * No React, no UI. Consumed by the mobile app's TanStack Query hooks.
 */

// Schema + shared constants
export * from './schema';
export * from './constants';

// Profile
export * from './profile/profile.entity';
export * from './profile/profile.queries';
export * from './profile/profile.lib';

// Company
export * from './company/company.entity';
export * from './company/company.queries';
export * from './company/company.lib';

// Company members
export * from './company-member/company-member.entity';
export * from './company-member/company-member.queries';
export * from './company-member/company-member.lib';

// Projects
export * from './project/project.entity';
export * from './project/project.queries';
export * from './project/project.lib';

// Project members
export * from './project-member/project-member.entity';
export * from './project-member/project-member.queries';
export * from './project-member/project-member.lib';

// Revenue sources
export * from './revenue-source/revenue-source.entity';
export * from './revenue-source/revenue-source.queries';
export * from './revenue-source/revenue-source.lib';

// Revenue entries
export * from './revenue-entry/revenue-entry.entity';
export * from './revenue-entry/revenue-entry.queries';
export * from './revenue-entry/revenue-entry.lib';

// Project fixed costs
export * from './project-fixed-cost/project-fixed-cost.entity';
export * from './project-fixed-cost/project-fixed-cost.queries';
export * from './project-fixed-cost/project-fixed-cost.lib';

// Project expenses
export * from './project-expense/project-expense.entity';
export * from './project-expense/project-expense.queries';
export * from './project-expense/project-expense.lib';

// Capacity / utilization
export * from './capacity/capacity.lib';

// Business days (working-weekday cap math)
export * from './business-days/business-days.lib';

// Company holidays
export * from './company-holiday/company-holiday.entity';
export * from './company-holiday/company-holiday.queries';
export * from './company-holiday/company-holiday.lib';

// Member time off (self-service day/partial-day/hours off)
export * from './time-off/time-off.entity';
export * from './time-off/time-off.queries';
export * from './time-off/time-off.lib';

// Project referrals
export * from './project-referral/project-referral.entity';
export * from './project-referral/project-referral.queries';
export * from './project-referral/project-referral.lib';

// Referral earnings
export * from './referral-earning/referral-earning.entity';
export * from './referral-earning/referral-earning.queries';
export * from './referral-earning/referral-earning.lib';

// Time entries
export * from './time-entry/time-entry.entity';
export * from './time-entry/time-entry.queries';
export * from './time-entry/time-entry.lib';

// Invoices
export * from './invoice/invoice.entity';
export * from './invoice/invoice.queries';
export * from './invoice/invoice.lib';

// Notifications
export * from './notification/notification.entity';
export * from './notification/notification.queries';
export * from './notification/notification.lib';

// Device tokens (push)
export * from './device-token/device-token.entity';
export * from './device-token/device-token.queries';

// Company invites
export * from './invite/invite.entity';
export * from './invite/invite.queries';
export * from './invite/invite.lib';

// Invoice payments (manual disbursements)
export * from './invoice-payment/invoice-payment.entity';
export * from './invoice-payment/invoice-payment.queries';
export * from './invoice-payment/invoice-payment.lib';

// Audit log
export * from './audit/audit.entity';
export * from './audit/audit.queries';
export * from './audit/audit.lib';

// Global search
export * from './search/search.queries';

// Blog
export * from './blog/blog.entity';
export * from './blog/blog.queries';
export * from './blog/blog.lib';
