const { processLLMResponse } = require('../backend/src/services/responseProcessor');
const raw = `Key Points
• **Detection** – Abnormal VPN authentication monitoring flagged 47 suspicious attempts, 2 of which succeeded.
• **Containment** – The affected account was disabled, active sessions terminated, and VPN access rules updated to block the source IP at 08:17 UTC.
• **Remediation** – Multi‑factor authentication was enforced for all remote‑access users; stronger conditional‑access rules are being implemented.
• **Investigation** – Credential reset completed; endpoint and email account reviews are in progress. No confirmed access to customer databases or production systems has been identified.
• **Next Steps** – Ongoing forensic analysis to determine the credential‑compromise mechanism; enhanced monitoring will continue until the investigation concludes.
-------------------------------------
• | Metric | Observation |
• |
• --|
• -|
• | Affected account | 1 employee account |
• | Suspicious login attempts | 47 |
• | Successful VPN authentications | 2 |
• | Confirmed production access | None identified |
• | Customer database access | No evidence |
• | Containment time | ~35 minutes |
-----------------------------------------------------`;
const result = processLLMResponse(raw, 'summary');
console.log('Cleaned Content:\n', result.cleanedContent);
