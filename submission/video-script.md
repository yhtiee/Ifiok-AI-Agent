# Demo video: script and shot list (target 2:45, hard limit 3:00)

Filmed as a **phone screen recording** of the live site, with your voice over it. No music.

## Before you record

1. The latest code is deployed, with `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` and `PAYPAL_ENV=sandbox` on Vercel.
2. Reset the demo: `node --experimental-transform-types scripts/seed-judges.mts`.
3. On the phone: Do Not Disturb on, battery and Wi-Fi fine, browser zoom normal, no other tabs.
4. Sign in to Ifiok as **Student 1** before recording, so no passwords appear on screen.
5. Know the **Student 1 PayPal sandbox** login (you'll type it on PayPal's page; cut or blur that moment if you like).
6. On a laptop browser, sign in as **Admin** in another window for scene 6, or switch accounts on the phone off-camera.
7. Rehearse once with a timer. Speak slowly; leave a pause where the AI is thinking.

## Script

| Time | On screen | You say |
|---|---|---|
| **0:00–0:15** | The landing page, scroll a little | "Nigerian students learn from handouts and past questions, often on a cheap phone, with no one to ask when they're stuck. Ifiok is an AI learning agent built on your own course, and it pays students when they help each other learn, through PayPal." |
| **0:15–0:40** | **Today** → tap *Continue Kirchhoff's laws* → the lesson, tap *Continue* once or twice | "Amara is studying Electricity and Magnetism. Ifiok built this lesson with AI, but every number in it is checked by a maths engine before it's published. The AI explains; the engine computes." |
| **0:40–1:05** | **Practice** → *Weak areas* shows Kirchhoff's laws, 1 of 5 right → tap **Find me a tutor**, wait for the draft | "She keeps getting Kirchhoff's laws wrong. So she asks Ifiok's tutoring agent. It looks at her weak topics and the tutors who teach them, only within the limit she set, fifteen dollars, and drafts a booking with its reasons." |
| **1:05–1:35** | **Review and approve** → **Approve with PayPal** → PayPal sandbox page, approve → back in Ifiok: *Paid, held on PayPal until the session ends* | "The agent can only propose. Money moves when Amara approves on PayPal. Ifiok uses PayPal Orders with intent authorise, so the payment is held, not taken." |
| **1:35–1:55** | On the booking, tap **The session happened** → status changes to released / paid to Tunde | "After the session, she confirms. Ifiok captures the payment and pays the tutor through PayPal Payouts, minus a fifteen percent commission. If the tutor hadn't shown up, one tap voids the hold and she pays nothing." |
| **1:55–2:25** | Admin **Payouts** grid: **Close month** (pool $50) → **Send payouts** → **Check PayPal** → line shows *Paid* | "Students also earn when their shared notes and explainers help others. Each month the pool is split by usage points in the database, capped at twenty percent per person, and sent as one PayPal Payouts batch. Every step is idempotent, so a replayed webhook never pays twice." |
| **2:25–2:40** | Sign in as **Student 2** → **My earnings** → **Why this amount?** | "Tunde sees what he earned and why, explained by AI, but only with numbers from the ledger." |
| **2:40–2:50** | The landing page or the Ifiok wordmark | "Ifiok: see it, try it, master it. Learn from your own course, and get paid for helping others learn." |

If you're running long, shorten scene 2 (the lesson) first. Never cut scenes 3 to 5; they're the PayPal and agent story.

## Rules check (from the hackathon page)

- Under 3 minutes. Judges stop at 3:00.
- Shows the project **working on the device it was built for**: a phone screen recording of the live site.
- **Public on YouTube**, link pasted in the Devpost form.
- **No third-party trademarks or copyrighted music** without permission. Use no music at all. PayPal's own sandbox pages are the integration being demonstrated.

## YouTube upload

- **Visibility:** Public (not Unlisted or Private).
- **Title:** Ifiok: AI learning agent with PayPal payouts and tutoring (PayPal AI Hackathon)
- **Description:**
  > Ifiok is an AI learning agent for Nigerian university students: lessons checked by a maths engine, practice that finds weak spots, and pay via PayPal when your notes or tutoring help others. All payments run in the PayPal sandbox with test money.
  >
  > Live demo: https://ifiok-ai-agent.vercel.app
  > Code: https://github.com/yhtiee/Ifiok-AI-Agent
- Paste the YouTube link into the Devpost form and the README's "Demo video" line.
