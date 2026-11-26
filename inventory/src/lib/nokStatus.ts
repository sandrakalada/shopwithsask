/** Reading the shipping company's status words (e.g. Nok's "Delivery Attempt Unsuccessful"). */
export const FAILED_ATTEMPT = /unsuccess|failed|attempt|not delivered|postpon|reschedul|no answer|customer not available/i;
export const isFailedAttempt = (s?: string | null) => !!s && FAILED_ATTEMPT.test(s);
export const isReturned = (s?: string | null) => !!s && /undeliver|return|refus|rto|lost|damage/i.test(s);
/** delivered only when the word "delivered" (or later money steps) is there and it is not a failed attempt */
export const isDelivered = (s?: string | null) =>
  !!s && !isFailedAttempt(s) && !/undeliver|out for|ready for/i.test(s) && (/\bdelivered\b/i.test(s) || /settled|cashier|operation/i.test(s));
export const isOutForDelivery = (s?: string | null) => !!s && /out for/i.test(s);
