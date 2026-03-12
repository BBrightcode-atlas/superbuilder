import type { PaymentCoupon, PaymentCouponRedemption } from "@superbuilder/features-db";

export type CouponWithRedemptions = PaymentCoupon & {
  redemptions?: PaymentCouponRedemption[];
};

export type CouponValidationResult = {
  valid: boolean;
  coupon?: PaymentCoupon;
  error?: string;
  discountPercent?: number;
  durationMonths?: number;
};
