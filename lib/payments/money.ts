// Money formatting shared by server and client (10 MVP-07). Sandbox amounts are USD cents (12 §4 Q61).

/** "$10.00" from cents. */
export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Shown on every money screen (10 MVP-07 Done when). */
export const SANDBOX_LABEL = "Sandbox: test money";
