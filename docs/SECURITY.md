# NEVU HQ Security Notes

- Never expose service-role or provider API secrets to the browser.
- RLS isolates private Holding tables by Administrator.
- The Boardroom does not use a cross-Holding SELECT policy on private Holding data.
- `nevu_hq_directory()` intentionally exposes only network identity/presence fields needed by HQ.
- The six-digit NEVU code is readable only by its own Administrator through the Holding RLS boundary.
- Personal AI content must be stored only in the current Administrator's Holding context.
- Voice notes and files use the private `nevu-files` bucket.
- Audit records are read only inside the relevant Holding.
- Approval is server-side through `nevu_approve_decision()` and requires the exact phrase for the current Administrator username.
