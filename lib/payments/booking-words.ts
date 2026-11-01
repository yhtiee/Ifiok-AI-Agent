// A booking's state in words (F17, 10 MVP-07), for the learner and the tutor. Never colour alone.

export function bookingStatusText(b: {
  status: string;
  role: "learner" | "tutor";
  other: string;
  tutorPayoutStatus: string | null;
}): string {
  const tutor = b.role === "learner" ? b.other : "you";
  switch (b.status) {
    case "awaiting_payment":
      return b.role === "learner"
        ? "Waiting for you to approve the payment on PayPal"
        : "Waiting for the learner to pay";
    case "authorized":
      return "Paid, held on PayPal until the session ends";
    case "captured":
      return b.role === "tutor" ? "Released. Add your PayPal email on My earnings to be paid" : `Released to ${tutor}`;
    case "paid_out":
      return b.tutorPayoutStatus === "paid"
        ? `Paid to ${tutor}`
        : b.tutorPayoutStatus === "unclaimed" || b.tutorPayoutStatus === "failed" || b.tutorPayoutStatus === "returned"
          ? "PayPal couldn't pay the tutor yet"
          : `Released; PayPal is paying ${tutor}`;
    case "voided":
      return b.role === "learner" ? "Cancelled. The hold was released; you weren't charged" : "Cancelled. No payment";
    case "disputed":
      return "Frozen: an admin is reviewing it";
    case "cancelled":
      return "Cancelled before paying";
    default:
      return "Didn't go through";
  }
}

/** "Tue 3 Nov, 18:00" in Lagos time. */
export const sessionTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
