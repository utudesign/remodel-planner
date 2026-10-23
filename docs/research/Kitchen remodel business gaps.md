# Fix the contract before adding features

RenoDesign's app already handles the money side of a kitchen deal well: quick estimates, quote versions, document gates and margin recaps. What it is missing is mostly on the legal and job-control side. The biggest gap is the contract itself. Virginia requires **11 specific terms in every residential contract**, including a **separately signed acknowledgment of the DPOR Statement of Consumer Protections** and a **Recovery Fund notice**, and the contract must be signed by both sides **before any payment is accepted** ([18VAC50-22-260](https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/section260/)). Kitchen deals signed at the customer's table also fall under the **FTC 3-business-day cancellation rule**, so nothing should be ordered during that window ([16 CFR 429](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429)). Older Northern Virginia homes (built before 1978) bring **EPA lead-paint (RRP) duties**, where penalties reach **$48,512 per violation** ([J.J. Keller](https://www.jjkeller.com/news/article/EPA-Final-Rule-Civil-Monetary-Penalty-Inflation-Adjustment_JJ131169-L-1736365077257)). After the legal fixes come the operational gates that stop expensive mistakes: a signed change order for every change, an appliance-spec lock before the cabinet order, a delivery inspection inside a **24-hour to 2-business-day claim window**, and permit and inspection tracking. On the software side, the paid suites charge extra for e-sign, change orders, a client portal, ACH payments, selections tracking and QuickBooks sync, and those six are what the app should build next. **This is general information, not legal advice. A Virginia construction lawyer should review the contract template, the cancellation forms and the e-sign flow before they go live.**

**How to read the labels.** **[VERIFY]** means the research could not confirm it from a primary source. **[OPINION]** means practitioner advice, not measured data. **[VENDOR]** means a marketing claim from a lender, agency or software company. **[OLD]** means the source is from before 2024. Anything not labeled comes from a statute, regulation, government page or dated survey.

---

## Must fix before the next contract

These seven items are ranked by legal exposure. Each one can turn a signed kitchen into a DPOR complaint, a consumer-protection lawsuit or a federal fine. Virginia's consumer-protection law lets a homeowner recover **actual damages or $500, whichever is greater**, up to **three times that (minimum $1,000) if the violation is willful, plus attorney fees** ([Va. Code 59.1-204](https://law.lis.virginia.gov/vacode/title59.1/chapter17/section59.1-204/)). Home improvement was the **#5 consumer complaint category** to the Virginia Attorney General in 2024 ([Virginia OAG](https://oag.state.va.us/media-center/news-releases/2843-march-3-2025-attorney-general-miyares-announces-top-10-consumer-complaints)).

### 1. The contract must contain all 11 Virginia terms, signed before any money changes hands

Virginia's Board for Contractors requires a "legible written contract" that is signed by **both the consumer and the licensee before work starts or any payment is accepted**. The consumer must get a fully executed copy before work begins, and contract records must be kept **5 years** ([18VAC50-22-260 B 8, B 10, B 11](https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/section260/)). The regulation was last amended effective Sept 1, 2025. The 11 required terms are listed below.

| # | Required term (18VAC50-22-260 B 9) | What it means for RenoDesign |
|---|---|---|
| a | Start date and estimated completion date | Two date fields on every contract |
| b | Total cost, stated by contract type (fixed price; cost-plus with a **cap**; or time-and-materials with a fixed labor price) | Contract-type picker; cost-plus needs a not-to-exceed number |
| c | Amounts and schedule of progress payments, with a **specific statement of the down payment** | Payment schedule printed on the contract |
| d | List of specified materials and work the consumer requested | Itemized scope and materials pulled from the quote |
| e | Plain-language clause on events beyond your control, stating those delays are **not abandonment** | Standard delay clause |
| f | Assurance you will comply with local permits, inspections and zoning | Standard permit clause |
| g | Disclosure of both parties' cancellation rights | Cancellation clause (see item 2) |
| h | **Signed acknowledgment** that the consumer received and read the DPOR Statement of Consumer Protections | A separate signature, not just a checkbox in the fine print |
| i | Contractor name, address, **license number, class, and specialty** | License block in the template |
| j | Any change to cost, materials, work or completion date must be **in writing and signed by all parties** | Change-order clause |
| k | Notice of the **Virginia Contractor Transaction Recovery Fund** with Board contact info | Recovery Fund paragraph |

Source: [18VAC50-22-260](https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/section260/). A 2023 law-firm summary lists the same terms ([Bean Kinney & Korman](https://www.beankinney.com/news-and-insights/blogs/what-contract-terms-are-legally-required-for-virginia-residential-contracting-projects/)) [OLD].

The Statement of Consumer Protections behind item h is a DPOR PDF, **revised 4/29/2025 and effective 7/1/2025** ([DPOR Statement](https://www.dpor.virginia.gov/sites/default/files/boards/Contractors/Contractor_Consumer_Info.pdf)). It also lists the Recovery Fund phone, **(804) 367-1559**, and DPOR's Board for Contractors page gives the mailing address, **9960 Mayland Drive, Suite 400, Richmond, VA 23233**, and the Board office phone, **(804) 367-2785** ([DPOR Board for Contractors](https://www.dpor.virginia.gov/Boards/Contractors); [Recovery Fund](https://www.dpor.virginia.gov/Boards/Contractors_Recovery_Fund/)). DPOR's landing page describes the Statement as required for door-to-door solicitations, while the regulation requires the acknowledgment in every residential contract. Treat it as required on every contract **[VERIFY with lawyer]**.

The same regulation lists prohibited acts that matter day to day:
- failing to get a **signed** change order (B 31)
- **abandonment**, meaning stopping work without justification for **30 days or more** (B 14)
- keeping funds for work not performed (B 16)
- working without a required permit (B 33)
- hiring unlicensed subs (B 29)
- misclassifying workers (B 37)
- misleading advertising (B 4)

Source: [18VAC50-22-260](https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/section260/).

No legal cap on deposits was found. DPOR recommends a down payment of about **10%, or about 30% when custom-made items are required** ([DPOR Statement](https://www.dpor.virginia.gov/sites/default/files/boards/Contractors/Contractor_Consumer_Info.pdf)). Fairfax County warns homeowners not to pay more than 10% down or let payments get ahead of the work ([Fairfax County](https://www.fairfaxcounty.gov/landdevelopment/sites/landdevelopment/files/assets/documents/forms/license-exemption-affidavit-info-sheet.pdf)).

### 2. In-home signings need the FTC 3-day cancellation notice, and nothing gets ordered during the window

The FTC Cooling-Off Rule covers any sale of **$25 or more** that the buyer agrees to at their own home, and that includes sales made at an appointment. Most RenoDesign kitchens are signed at the customer's table, so the rule applies. The contract must carry this bold statement, in at least 10-point type, near the signature: "You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction." The buyer must also get a **"NOTICE OF CANCELLATION" form in duplicate**. If they cancel, you must **refund every payment within 10 business days** ([16 CFR 429.0–429.1](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429)).

Virginia's Home Solicitation Sales Act covers sales made "without prior invitation or appointment." It requires a "BUYER'S RIGHT TO CANCEL" caption, a refund within 10 days, and **no compensation for any services performed before cancellation**. A violation of this act is automatically a consumer-protection violation ([Va. Code 59.1-21.1 et seq.](https://law.lis.virginia.gov/vacodefull/title59.1/chapter2.1/)).

The practical rule is simple. **Do not order custom cabinets, start demo or treat the deposit as earned until the cancel-by deadline passes.** Contracts signed at the Chantilly office fall outside the FTC rule, so the app should record where each contract was signed. Putting both the FTC and Virginia captions on one form is a common cautious approach **[VERIFY with lawyer]**. Whether Saturdays count as business days under the FTC rule (the notes indicate yes, Sundays and federal holidays no) is **[VERIFY]**. Copy the full Notice of Cancellation text word for word from 16 CFR 429.1(b).

### 3. Pre-1978 homes trigger EPA lead-paint rules on almost every kitchen

The EPA Renovation, Repair and Painting (RRP) rule applies to paid work that disturbs paint in housing built before 1978. The small-job exemption covers only **6 sq ft or less per interior room**, and **demolition of painted surfaces is always covered** ([40 CFR 745 Subpart E](https://www.ecfr.gov/current/title-40/chapter-I/subchapter-R/part-745/subpart-E)). Tearing out kitchen cabinets, backsplash and painted drywall almost always qualifies.

The rule has five requirements:
- an **EPA-certified firm**, with a 5-year term
- a **certified renovator** on the job for setup, containment and cleaning
- delivery of the *Renovate Right* pamphlet **0–60 days before work**, with a signed acknowledgment
- lead-safe work practices and cleaning verification
- **3 years** of records, with a compliance report to the owner with the final invoice or within 30 days

Source: [40 CFR 745.84–745.90](https://www.ecfr.gov/current/title-40/chapter-I/subchapter-R/part-745/subpart-E).

The rule also covers trade subs such as plumbers and electricians, who need their own firm certification ([EPA RRP for contractors, Jan 2025 snapshot](https://19january2025snapshot.epa.gov/lead/renovation-repair-and-painting-program-contractors/index.html)). The maximum civil penalty was **$48,512 per violation** as of January 2025 ([J.J. Keller](https://www.jjkeller.com/news/article/EPA-Final-Rule-Civil-Monetary-Penalty-Inflation-Adjustment_JJ131169-L-1736365077257)). Whether that figure was adjusted again in 2026 is **[VERIFY]**. EPA reached a settlement with a Kitchen Tune-Up franchise in June 2025 ([EPA filing](https://yosemite.epa.gov/OA/RHC/EPAAdmin.nsf/Filings/10CC2626F8368ECE85258CA5006F5D62/$File/Kitchen%20Make%20Over%20LLC%20dba%20Kitchen%20Tune%20Up_TSCA%20Lead%20RRP%20ESA_June%2010%202025_Redacted.pdf)), which shows that enforcement reaches kitchen remodelers.

### 4. Never show sales tax as a separate line on an install job

Virginia treats a contractor who installs materials into real property as the **consumer** of those materials. RenoDesign pays sales or use tax when it buys the materials, and the contractor "does not pass the sales or use tax on to anyone else as a tax." Tax gets built into the price, and that holds for cost-plus contracts too ([23VAC10-210-410](https://law.lis.virginia.gov/admincode/title23/agency10/chapter210/section410/)). The quick-estimate and quote outputs therefore need **one all-in price with no "sales tax" line**.

The exception is a cabinet or materials sale with **no installation**, which is a retail sale. RenoDesign would need to register as a dealer and collect tax on those sales (same source). That matters if the company also sells cabinets on their own **[VERIFY with CPA]**. The Northern Virginia combined rate of 6% is **[VERIFY]**.

### 5. Match each contract's value to the license class

DPOR's 2025 Statement sets the license classes by contract value:
- **Class C**: over $1,000 and under $30,000
- **Class B**: $30,000 to under $150,000
- **Class A**: $150,000 and up

Source: [DPOR Statement](https://www.dpor.virginia.gov/sites/default/files/boards/Contractors/Contractor_Consumer_Info.pdf).

Working outside your class or specialty is a prohibited act (B 27) ([18VAC50-22-260](https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/section260/)). The 2025 median major kitchen remodel was **$55,000** ([GCN, Houzz 2025](https://gcn.com/?p=22064)), so a typical RenoDesign job needs at least Class B. Confirm the firm's class and specialty (for example, Home Improvement Contractor versus Kitchen & Bath Remodeling). The thresholds have not been checked against the current text of 18VAC50-22-30 **[VERIFY]**. Older rules used $10k and $120k.

### 6. Carry workers' comp, because the subs' employees count toward the total

Virginia requires workers' comp once a business has **more than two employees** regularly working in Virginia. Part-time workers and family members count. For a contractor, **the subs' employees count toward the total, whether or not the sub has its own coverage** ([Virginia Workers' Compensation Commission](https://workcomp.virginia.gov/content/employers)). A 3-person firm using installers, a plumber and an electrician will almost certainly cross that line.

Misclassifying workers as independent contractors is also a DPOR violation (B 37) ([18VAC50-22-260](https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/section260/)). DPOR does not require general liability insurance for this license type. It is still customary and often contract-driven, and the requirement for commercial auto is unconfirmed **[VERIFY]**.

### 7. Get separate e-sign consent before anyone signs on the phone

Electronic signatures are valid in Virginia only when both parties have agreed to transact electronically. In a standard-form contract, that agreement must be "conspicuously displayed and separately consented to." The signed record must be something the customer can **print or store**, and other formatting rules still apply, such as the bold 10-point cancellation notice ([Va. Code 59.1-483, 59.1-486](https://law.lis.virginia.gov/vacodefull/title59.1/chapter42.1)). Electronic records also satisfy record-retention rules if they stay accessible and accurate ([Va. Code 59.1-490](https://law.lis.virginia.gov/vacodefull/title59.1/chapter42.1)).

It is unsettled whether e-delivery alone satisfies the FTC's duplicate-notice requirement for in-home sales. The safest course is to also leave a printed copy at the table **[VERIFY with lawyer]**.

### What the app should add (legal)

- **Contract generator that checks for the 11 terms.** Required fields: contract type (fixed, cost-plus with cap, or T&M with fixed labor), start date, estimated completion date, down payment, progress schedule, and itemized scope. The license block and clauses e, f, g, j and k come from the template. Block sending if any term is empty.
- **Separate signature for the DPOR Statement**, with the Statement version (4/29/2025) stored on the deal so the current PDF is always the one attached.
- **"Signed by both parties" gate** in front of accepting any payment and scheduling a start date, plus automatic emailing of the executed PDF.
- **Signing-location field** (customer home vs. office). If signed at home, the app adds the FTC bold statement and two Notice of Cancellation copies, computes the cancel-by deadline, and **locks ordering, scheduling and deposit processing until it passes**. A cancellation creates a 10-business-day refund task.
- **Year-built field at lead intake.** If before 1978, an RRP checklist runs: pamphlet acknowledgment dated 0–60 days before start, certified renovator assigned (with certificate expiry), test or cleaning-verification upload, and a post-job record sent with the final invoice. It blocks the move to "scheduled for demo" until complete.
- **Tax rule in quotes:** no sales-tax line on install jobs. Allow a taxed line only on materials-only sales.
- **License-class check:** warn or block when the contract total exceeds the firm's class limit.
- **E-sign consent screen** shown before the first signature, with an audit trail (timestamp, IP, signer) and downloadable PDFs.
- **Deposit guardrail:** warn when the deposit is over 10% (or 30% when the job includes custom-ordered cabinets) and when payments run ahead of completed milestones.
- **Retention policy:** keep all job files at least 5 years. 7 years is the practical target, since the Virginia tax retention period was not confirmed.

---

## Operations: the job breaks at the handoffs, not the install

Overruns are common. In the 2026 Houzz & Home Study, **37% of recent projects went over budget**. Among those, **35% chose higher-end materials mid-project**, **32% hit unexpected complexity** and **31% changed scope during construction** ([KEYT/Stacker, July 2026](https://keyt.com/stacker-home-garden/2026/07/20/new-data-shows-early-planning-is-reshaping-home-remodeling-outcomes/); a secondary article written by a remodeling company). All three causes can be controlled with a selections-lock date and signed change orders. No source measured how often specific kitchen failures happen (wrong cabinet sizes, damaged boxes, appliance mismatches, re-templates).

### Lead times set the schedule, and the countertop template is the bottleneck

Retailer lead times published in 2026:
- **RTA in stock:** 1–2 weeks
- **Assembled stock:** 2–4 weeks
- **Semi-custom:** 4–6 weeks
- **Custom:** 6–12 weeks

Plan **at least one extra week** for the delivery appointment and damage inspection ([Kitchen Cabinet Kings, 2026](https://kitchencabinetkings.com/blog/kitchen-cabinet-lead-times/)) [VENDOR].

Quartz takes about **10–14 days from template to install**, or **3–4 weeks in peak season**. The template visit "can't happen until cabinets are fully installed and level." Changing the edge, sink or cutouts after templating "resets the fabrication queue" ([Slabwise](https://slabwise.com/guides/how-long-does-it-take-to-install-countertops)) [VENDOR].

A retailer guide from 2024 puts the construction phases of a mid-scope kitchen at roughly 5–9 weeks combined, with permits taking 1–6 weeks ([Kitchen Cabinet Kings, 2024](https://kitchencabinetkings.com/guides/how-long-does-a-kitchen-remodel-take)). No reliable 2025–26 appliance lead-time data was found. The PM has to enter ETAs per model.

### Cabinet damage claims expire in a day or two

Claim windows are short:
- **Ideal Cabinetry:** report damage within **24 hours**, and "don't start demolition or schedule installation until you've inspected the entire order" ([Ideal Cabinetry](https://warranty.idealcabinetry.com/PreparingForDelivery)).
- **Cabinetmaker Warehouse:** **2 business days**. Claims may be denied if the damage was not noted on the delivery ticket ([Cabinetmaker Warehouse](https://cabinetmakerwarehouse.com/pages/shipping-policies)).
- **RTA Cabinet Store:** do not refuse a shipment for box damage. Note it on the bill of lading and photograph each item by SKU ([RTA Cabinet Store](https://blog.rtacabinetstore.com/?p=4971)).

TimberPeak's window was not researched. Get it in writing and treat 24 hours as the default until then.

### Change orders, permits and liens need hard stops

Every change to cost, materials, scope or date must be a **written change order signed by both sides** ([18VAC50-22-260 B 9 j, B 31](https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/section260/)). Practitioner advice, from 11 remodelers interviewed in 2015, is to use a standard form, **extend the completion date in every change order** ("Waive it at your peril"), price direct cost plus markup plus prep cost, and collect payment before the change work starts ([Pro Remodeler](https://www.proremodeler.com/10-rules-change-orders)) [OPINION, OLD]. The same source says change orders often add **10% or more** to project cost [OPINION, OLD].

Mechanics' liens work on fixed deadlines. A memorandum of lien must be recorded within **90 days after the last day of the month of last work**, and no later than 90 days after completion. It can cover only the **150 days** before last work ([Va. Code 43-4](https://law.lis.virginia.gov/vacode/title43/chapter1/section43-4/)). On one- and two-family homes, the permit may name a **mechanics' lien agent**, and subs who don't notify that agent within 30 days lose lien rights for earlier work ([Va. Code 43-4.01](https://law.lis.virginia.gov/vacode/title43/chapter1/section43-4.01/)). Virginia has no statutory lien-waiver form. Collecting a waiver with each sub payment is standard protection ([Siteline](https://www.siteline.com/mechanics-lien-rights/virginia)). In Fairfax, the licensed contractor should pull the permit, and the County lists a contractor saying "the permit should be issued to the homeowner" as a **scam warning sign** ([Fairfax County](https://www.fairfaxcounty.gov/landdevelopment/sites/landdevelopment/files/assets/documents/forms/license-exemption-affidavit-info-sheet.pdf)).

### Communication cadence, punch list and warranty

Practitioner consensus, all of it [OPINION, OLD]:
- Hold a **pre-construction meeting about a week before start**, covering access, pets, bathroom use, dumpster, protection, schedule and communication channel ([JLC 2013](https://www.jlconline.com/business/preconstruction-meeting-a-key-element-to-a-successful-remodeling-job/)).
- Send a **weekly four-part update**: work done, work next week, selections needed, open issues ([JLC 2007](https://www.jlconline.com/business/sales-marketing/keeping-clients-informed)).
- Keep a **rolling punch list from day one**, run an internal walkthrough 1–2 weeks before completion, and charge subs for missed rework. Interviewed firms reached zero punch items on about **60% of jobs** ([Pro Remodeler 2019](https://www.proremodeler.com/home-improvement/article/55184363/punch-out-the-punch-list)).

A **1-year workmanship warranty** is the common norm, anchored by NAHB's Residential Construction Performance Guidelines ([NAHB 2022](https://www.nahb.org/blog/2022/08/new-edition-residential-construction-guidelines)) [OLD]. Virginia does not set a warranty term, but failing to honor a warranty you gave is a DPOR violation (B 30).

### What the app should add (operations)

- **Change orders as their own object:** number, reason (client request, hidden condition, design error), cost lines, markup, schedule days, new completion date, client e-signature, and payment status. A change order cannot reach "approved for work" without a signature. Report change-order total as a percent of contract.
- **Order-line dates:** ordered, confirmed ship date, delivery appointment, inspected, and claim deadline. Add a "needed on site by" date computed backward from install with a buffer of 1 week or more, and alert when a ship date slips.
- **Delivery receiving record:** expected vs. received SKU count, photos (truck, pallets, labels, damage, signed delivery slip), who received it, and an automatic claim deadline from the supplier profile (default 24 hours). Block cabinet-install scheduling until inspection is complete.
- **Gates:** "cabinets set and level" before booking the template; countertop selections locked at template; "rough-in inspections passed" before closing walls; "permit issued" before demo.
- **Permit panel:** permit number, jurisdiction (Fairfax County vs. City of Fairfax, Herndon, Vienna, Alexandria), status, inspections with results, and the mechanics' lien agent named on the permit.
- **Sub records:** DPOR license number, class and expiry; general liability and workers' comp certificates with expiry alerts at 30 days; W-9; RRP certificate; callback and no-show counts. Per job: confirmation at 3 days and 1 day before, conditional and unconditional lien waivers, and an alert if a payment is released without a waiver.
- **Lien clock:** last-work date, automatic lien deadline, and aging of unpaid balances against it. Final lien waivers available for the homeowner.
- **Stalled-job alert:** no activity for 20+ days requires a written reason, as a defense against an abandonment claim at 30 days.
- **Demo-day hidden-conditions checklist** (subfloor at sink and dishwasher, plumbing wall, panel and wiring) that drafts a change order automatically when something is found. Add an allowance or contingency line in estimates.
- **Pre-con checklist, daily log and automatic weekly update** in the four-part format. The PM writes the content, and the Philippines admin can send it.
- **Punch list and warranty:** items with photo, owner, due date and sign-off; a substantial-completion date that starts the warranty clock; warranty tickets; and an 11-month check-in alert.

---

## Sales and marketing: measure cost per signed job, not lead count

Independent channel data is thin, and the spread between channels is wide:
- **Google paid search**, general contracting and remodeling: **$165.67 cost per lead** and a 2.61% conversion rate, about 1.8 times the home-services average. The page's own CPC and conversion numbers imply about $203, which is not explained ([Web Tonic citing LocalIQ 2025](https://www.webtonic.io/blog/general-contracting-remodeling-google-ads-statistics)).
- **Google Local Services Ads:** call leads **$49–112**, per an agency's paid press release ([Norfolk Daily News release](https://norfolkdailynews.com/online_features/press_releases/kitchen-remodeling-seo-releases-2026-lead-cost-benchmarks-across-nine-marketing-channels/article_49c8528d-b91b-5216-a155-e8437ceb9295.html)) [VENDOR].
- **Angi/HomeAdvisor shared leads:** **$150–600+** per lead, closing at **5–12%**, from the same press release [VENDOR]. Block Renovation puts shared-lead conversion at 5–15% ([Block Renovation](https://www.blockrenovation.com/guides/buying-leads-for-remodeling-projects-what-to-know)) [VENDOR].

No Northern Virginia or DC figures were found. Only RenoDesign's own per-source numbers can show where its money works.

**Speed matters most for a phone-only owner with a day job.** The only remodeling-specific claim is that responding after five minutes "slashes conversion rates in half" ([JLC 2023](https://www.jlconline.com/business/sales/to-convert-leads-engage-them-first_o)) [OPINION, no published method]. It is still the strongest reason to have the app send an instant acknowledgment and to have the admin respond while Tugu is at work. Check that the admin's hours cover Eastern-time business hours.

**Reviews:** only **4% of consumers never read reviews**, **96% are open to leaving one**, and an **email request works best (40%)**, ahead of asking in person (27%) ([BrightLocal 2025](https://brightlocal.com/research/local-consumer-review-survey-2025/)). Consumers expect a reply to a review within 2–3 days to a week (same source).

**Financing has a hidden cost.** Standard loan plans carry a 0–2.75% dealer fee, but "true 0%" promotional plans carry **11.5–18.5%** (GreenSky 2022 rate sheet, as reported by competitor Hearth) ([Hearth](https://gethearth.com/contractor-financing-fees-explained/)) [VENDOR, OLD rate sheet]. On a $55k kitchen, that is roughly $6,300–10,200. The often-quoted lift from offering financing, **+18% close rate and +30% job size**, comes from a lender in 2018 ([JLC 2018](https://www.jlconline.com/remodeling/heres-why-most-top-contractors-offer-financing_o)) [VENDOR, OLD].

**Design fees** are an established way to qualify buyers. DC-area firms historically charged **0.5–2% for preliminary design and 4–8% for detailed design**, often credited toward construction ([JLC 2005](https://www.jlconline.com/business/charging-up-front-for-design/)) [OLD].

**Benchmarks for the margin screen:** remodeler gross margin averaged **29.9%** and net margin **6.3%** in 2024 ([NAHB 2026 Cost of Doing Business](https://www.nahb.org/blog/2026/04/home-remodeling-profit-margin)). Nationally, a midrange **minor** kitchen recoups **112.9%** at resale, versus **50.9%** for a midrange major kitchen ([JLC Cost vs Value 2025](https://www.jlconline.com/cost-vs-value/2025/national/)). DC-specific Cost vs Value figures could not be retrieved.

**Market direction:** Houzz respondents plan a **25% lower** median renovation spend in 2026 ($15k vs. $20k) ([GCN](https://gcn.com/?p=22064)). NAHB says economic uncertainty is making some customers hesitant ([NAHB RMI Q3 2026](https://www.nahb.org/news-and-economics/press-releases/2026/10/remodeling-market-sentiment-remains-stable-in-third-quarter-despite-headwinds)). That argues for disciplined follow-up and a smaller "phased" kitchen offer.

### What the app should add (sales and marketing)

- **Lead source on every deal**, plus marketing spend per source, so the app reports cost per lead, per appointment and per signed contract, and revenue per source. Flag junk Local Services Ads leads for dispute.
- **Speed-to-lead:** timestamp lead arrival and first response, show a 5-minute response timer, and send an automatic acknowledgment text or email. Route leads to the admin when Tugu is unavailable.
- **Qualification fields:** budget range, desired start, decision makers, cash/HELOC/financing, scope (layout change, plumbing moves), home age, HOA, and other bids.
- **Pipeline stages with conversion rates and days in each stage:** Lead → Qualified → Site visit → Design agreement → Selections → Proposal → Contract → Production → Closeout.
- **Design retainer line** with a "credit toward construction" flag.
- **Financing fields:** offered, used, lender, plan type and dealer fee %, plus **margin after the fee**, shown before anyone offers a 0% promo. Show a monthly payment next to the total on proposals.
- **Review engine:** email a review request (Google first, then Houzz) at final sign-off, follow up with a nudge, and alert when a new review needs a reply within 2–3 days.
- **Referral source field and referral-reward ledger.** No benchmark reward amounts were found.
- **Monthly leads and contracts report**, so RenoDesign learns its own seasonality. No sourced seasonality data was found.

---

## Design and code checklist: the misses that force a reorder

Virginia's code in force is the **2021 USBC**, effective Jan 18, 2024. That puts residential work on the **2021 Virginia Residential Code** and electrical work on the **2020 NEC**, not the 2023 NEC ([Virginia DHCD](https://dhcd.virginia.gov/codes); [IAEI](https://www.iaei.org/page/virginia-electrical-ceus)). The next cycle is expected to take effect around **Oct 2027** ([DHCD memo](https://dhcd.ar.virginia.gov/sites/default/files/DocX/2024-code-development-cycle/2024-CDC-Stakeholder-Memo-2.pdf)).

**Fairfax permits catch more jobs than people expect.** Cabinets, countertops, flooring and paint are exempt on their own. A permit **is** required for:
- kitchen renovations and wall removal (bearing or not)
- new or relocated electrical, plumbing or gas fixtures
- **range hoods and ductwork**
- **direct replacement of a stove or oven**

Source: [Fairfax LDS](https://www.fairfaxcounty.gov/landdevelopment/when-permit-required). The City of Fairfax, Herndon, Vienna and Alexandria each run their own building departments ([City of Fairfax](https://fairfaxva.gov/home/showpublisheddocument/1219/638107789584400000); [Herndon](https://herndon-va.gov/home/showpublisheddocument/16122/637825069339270000); [Alexandria](https://alexandriava.gov/go/1824)).

**Hoods are the biggest surprise cost.** Under the IRC, a kitchen exhaust capable of **more than 400 CFM requires makeup air** with a damper that opens automatically ([Green Building Advisor](https://greenbuildingadvisor.com/article/makeup-air-for-kitchen-exhaust)). That source cites older IRC editions, so the matching section in the 2021 VRC is [VERIFY]. Picking a 400 CFM hood or smaller avoids the requirement. No reliable installed cost for makeup air was found.

**2020 NEC kitchen rules:**
- Dishwashers need GFCI protection.
- A range receptacle within 6 ft of the sink needs GFCI.
- Islands need **one receptacle for the first 9 sq ft of countertop plus one per additional 18 sq ft**. A 9.5×3 ft island needs three ([IAEI Magazine](https://iaeimagazine.org/columns/nfpa-code-talk/three-key-changes-to-the-2020-nec-that-improve-the-recipe-for-residential-kitchen-safety/)).

Culpeper County lets contractors use the 2023 NEC island rule instead, where island receptacles are optional but a box for future use is required ([Culpeper County](https://web.culpepercounty.gov/sites/default/files/fileattachments/building_department/page/3497/approved_2021_blanket_code_mod_island_and_peninsula_receptacles.pdf)). No equivalent Fairfax policy was found [VERIFY with Fairfax LDS].

The notes' AFCI, dedicated-circuit and gas-to-induction panel-upgrade points come from training knowledge rather than sources. They are **[VERIFY]**, but worth a line in the estimate checklist. The same applies to the dishwasher air gap vs. high loop question **[VERIFY with Fairfax inspector]**.

**NKBA planning guidelines are not code**, but missing them means reordering cabinets or tops. The key numbers, from a secondary summary of NKBA ([CRD Design Build](https://www.crddesignbuild.com/blog/kitchen-dimensions-code-requirements-nkba-guidelines)):
- work aisle **42" for one cook, 48" for two**, measured from the fronts of counters and appliances
- dishwasher within **36" of the sink**, with 21" standing space at a corner
- sink landing 24"/18"
- cooktop landing 12"/15"
- refrigerator handle-side landing 15"
- seating clearance 32"–44"
- where two landing areas meet, use **the longer requirement plus 12"**

Verify the numbering against the official NKBA text before hard-coding these rules. The official guidelines were not retrieved.

**Asbestos:** Virginia's asbestos inspection required at permit **exempts single-family homes and buildings with 4 or fewer units** ([Charlottesville summary of Va. Code 36-99.7](https://charlottesville.gov/DocumentCenter/View/392/Asbestos-Inspection-and-Abatement-Certification-PDF)). Testing old vinyl, mastic and joint compound before demo is still prudent practice [OPINION].

### What the app should add (design and code)

- **Code-edition field per project** (2021 VRC / 2020 NEC until the 2024 USBC takes effect).
- **Permit-trigger checklist on every estimate:** moved or added outlets or lights, plumbing or gas moves, hood or duct, wall changes, stove or oven swap. Any yes means a permit line plus a jurisdiction lookup.
- **Appliance-spec lock before the cabinet order:** model numbers, spec sheets and cutouts for fridge, range, wall oven, microwave, hood and dishwasher, plus panel-ready yes/no and sink model and base. Also verify the field measurements (re-measure, walls plumb and square, ceiling and soffits).
- **Hood rule:** if max CFM is over 400, flag "makeup air required" and add a line item.
- **Island receptacle calculator** using the 2020 NEC count, and a GFCI flag on the dishwasher.
- **NKBA layout validator** for aisles, dishwasher distance, landing areas, combined landings, and seating clearance and overhang.
- **Countertop template checklist:** sink on site, faucet hole count and spacing, cooktop cutout, backsplash type, pop-up receptacle locations.
- **Pre-1980 home prompt:** asbestos test line and abatement contingency; soffit exploratory allowance.
- **Universal-design options** (wider aisles, knee space, microwave drawer, wall oven) with cost flags, offered early because late decisions are expensive.

---

## Software: build the six features the suites charge extra for

The paid suites cost a 3-person shop roughly **$240/month (JobTread) to $600/month (Projul Core+) or more**, and Buildertrend runs about **$339–$1,099/month** ([SuperDupr on JobTread](https://superdupr.com/blog/jobtread-review); [Projul pricing guide](https://projul.com/blog/construction-software-pricing-guide-2026/) [VENDOR]; [OneCrew on Buildertrend](https://www.getonecrew.com/post/buildertrend-pricing) [VENDOR]). The features they gate to upper tiers show what contractors value:
- e-sign and change orders: Buildertrend Advanced, Joist Elite, CompanyCam Scale ([OneCrew](https://www.getonecrew.com/post/buildertrend-pricing); [OneCrew Joist](https://www.getonecrew.com/post/joist-pricing); [CompanyCam](https://companycam.com/pricing))
- **selections and allowance tracking**: Buildertrend Complete, Houzz Designer tier ([Capterra Houzz Pro](https://www.capterra.com/p/199689/Houzz-Pro/pricing/))
- review requests: a $79–99 add-on at CompanyCam ([CompanyCam](https://companycam.com/pricing))

**Payment fees can cost more than the subscription.** Buildertrend charges clients **2.99% by card versus a $15 flat fee for ACH** ([Buildertrend Payments FAQ](https://buildertrend.com/help-article/buildertrend-payments-faqs/)). On a $40k kitchen, the card fee is about $1,196. Defaulting clients to ACH is the single cheapest win. Stripe ACH pricing was not verified in this research.

**What users reward and punish:** users reward ease of use and support (JobTread **5.0/5 on G2** vs. Buildertrend 4.3) and punish price creep and complexity ([G2](https://www.g2.com/compare/jobtread)). Photo-app users praise before/after reports and client sharing, and complain about **accidentally deleted photos and poor loading on weak signal** ([Capterra CompanyCam](https://capterra.com/p/171143/CompanyCam/)). A phone-first app therefore needs offline capture and photos that cannot be lost.

### What the app should add (software)

Ranked by value for a 3-person kitchen shop. The ranking is the research team's judgment, not measured data.

1. **E-sign** on quotes, contracts and change orders, with the Virginia consent screen.
2. **Change orders as a first-class object** (see Operations).
3. **Client portal or live update link:** schedule, photos, decisions due, documents, payments.
4. **ACH-first online payments** on a milestone schedule (deposit after the cancel window, cabinets ordered, install, final), with card fees passed through.
5. **Selections and allowances tracker** with lock dates, tied to the appliance-spec and template gates.
6. **QuickBooks Online sync** for invoices, payments and job costs.
7. **Schedule and calendar** with sub assignment and dependencies (template follows cabinets set and level; tops follow fabrication).
8. **Punch list and warranty tickets** on the deal jacket.
9. **Purchase orders and vendor bills** tied to job costing, with deposit-to-PO tracking to defend against a misapplied-funds claim.
10. **Photo upgrades:** server timestamp and GPS, before/during/after/issue tags, markup, one-tap photo report, and an offline queue.
11. **Lead capture form, two-way text and automated follow-up.**
12. **Review requests** at closeout.
13. Daily logs and time tracking (lower value while the owners are on site).
14. Homeowner financing link with dealer-fee margin view.
15. AI voice- or photo-to-estimate. Vendors sell this at $119–239/month ([Handoff](https://www.handoff.ai/pricing)) [VENDOR]. Treat it as a later addition.

---

## Consolidated priority table

P0 = before the next contract is signed. P1 = within the next few jobs. P2 = when time allows.

| Feature / requirement | Why (one line) | Priority | App module |
|---|---|---|---|
| Contract template with all 11 VA terms, completeness check | Required by 18VAC50-22-260 B 9; missing terms are a DPOR violation | P0 | Contracts |
| Separate signed DPOR Statement acknowledgment + version tracking | Term h needs a signed acknowledgment of the current (7/1/2025) Statement | P0 | Contracts |
| Recovery Fund notice with Board contact info | Term k is mandatory | P0 | Contracts |
| "Both signed" gate before payment or start date; auto-send executed copy | B 8 and B 10: no payment or work before signatures; copy before work | P0 | Contracts / Payments |
| Signing location + FTC notice + 2 cancellation forms + cancel-by date | In-home sales $25+ fall under 16 CFR 429 | P0 | Contracts |
| Lock ordering, scheduling and deposit during the 3-day window; 10-day refund task | Refund duty; VA allows no pay for work done before cancellation | P0 | Deal gates / Orders |
| Year-built field + RRP checklist gate before demo | Pre-1978 demo is covered; up to $48,512 per violation | P0 | Site visit / Compliance |
| No sales-tax line on install quotes | Contractor is the taxable consumer (23VAC10-210-410) | P0 | Quotes / Estimate |
| License-class check vs contract total | Working above class is prohibited (B 27) | P0 | Contracts |
| Workers' comp on file; sub COI tracking with expiry alerts | Subs' employees count toward the more-than-2 threshold | P0 | Subs / Compliance |
| E-sign consent screen + audit trail + printable PDFs | Va. UETA requires separate consent and a retainable record | P0 | E-sign |
| Signed change orders with schedule impact | B 31 violation without them; drives overruns | P0 | Change orders |
| Deposit guardrail (10% / 30% custom) and payments-vs-work check | DPOR and Fairfax guidance; B 16 misapplied funds | P1 | Payments |
| Permit panel: jurisdiction, number, status, inspections, lien agent | B 33 violation; Fairfax permits catch hoods and stove swaps | P1 | Permits |
| Permit-trigger checklist on every estimate | Most Fairfax kitchens need a permit | P1 | Estimate |
| Appliance-spec and selections lock before cabinet order | Late selections drive 35% of overruns and force reorders | P1 | Selections |
| Delivery receiving record + claim-deadline clock | Claims expire in 24 hours to 2 business days | P1 | Orders |
| Order-line dates + needed-on-site-by alerts | Lead times run 1–12 weeks; tops wait on cabinets | P1 | Orders / Schedule |
| Template gate (cabinets set and level) + countertop selections lock | Post-template changes reset fabrication | P1 | Schedule |
| Sub records: license, COIs, W-9, RRP cert; lien waivers per payment | Unlicensed subs violate B 29; waivers limit lien exposure | P1 | Subs |
| Lien deadline clock on unpaid balances | 90-day recording deadline under Va. Code 43-4 | P1 | Payments |
| Stalled-job alert at 20 days | Abandonment is 30+ days of unjustified stoppage | P1 | Schedule |
| ACH-first milestone payments, card fee pass-through | Card fees about $1,196 on a $40k job vs about $15 for ACH | P1 | Payments |
| Client portal / live update link + weekly 4-part update | Communication is the top satisfaction driver (opinion) | P1 | Client portal |
| Lead source, spend and cost-per-signed-job reporting | Channel costs run $10–600 per lead | P1 | CRM / Reports |
| Speed-to-lead timer + auto-acknowledgment + admin routing | Owner on phone only with a day job; 5-minute claim (opinion) | P1 | CRM |
| QuickBooks Online sync | Avoids double entry; a top suite feature | P1 | Integrations |
| Hood over 400 CFM makeup-air flag; island receptacle and GFCI checks | Hidden code costs found late | P1 | Estimate / Design |
| Demo-day hidden-conditions checklist that drafts a change order | Unexpected complexity drives 32% of overruns | P1 | Site visit / Change orders |
| Punch list, substantial-completion date, warranty tickets, 11-month alert | Honoring warranties is required (B 30); referral touch | P2 | Closeout |
| Review request by email at sign-off + reply alerts | Email asks produce the most reviews (40%) | P2 | Closeout / CRM |
| Financing fields with margin after dealer fee | Promo plans cost 11.5–18.5% (vendor, old) | P2 | Quotes |
| Design retainer line with construction credit | Qualifies buyers; established practice (old) | P2 | Quotes |
| Pipeline stage conversion and days-in-stage | No reliable external benchmark; measure your own | P2 | Reports |
| NKBA layout validator | Prevents cabinet and top reorders | P2 | Design |
| Photo upgrades: GPS, tags, markup, offline queue, photo report | Lost photos are a top user complaint | P2 | Jacket / Photos |
| Code-edition field per project | Code changes expected around Oct 2027 | P2 | Design |
| 5–7 year record retention policy | DPOR 5 years; RRP 3 years | P2 | Admin |
| AI voice/photo-to-estimate | Nice to have; vendor-priced at $119–239/month | P2 | Estimate |

## Conclusion

RenoDesign's real exposure is not missing features. Its current gates check that a contract, deposit and design exist, but not that the contract is **legally complete** or that money and orders wait for the **cancellation window and signatures**. Turning those document checklists into enforced rules covers most of the P0 list: required terms, the separate DPOR signature, the in-home cancel window, the year-built RRP gate, no tax line, and the class limit. That is mostly template and gate logic on screens the app already has. The cheapest high-value move is to have a Virginia construction lawyer review one contract template and one cancellation form, then encode them, rather than building more estimating features.

The second lesson is that the paid suites' premium tiers are a map of where kitchens go wrong: change orders, selections, schedules that depend on earlier steps, and client communication. A 3-person shop with a phone-only owner and a remote admin benefits most from features that **block the next step** (no cabinet order without locked appliance specs, no template before cabinets are level, no payment to a sub without a lien waiver) rather than features that only record data. Most benchmarks in this report are national, vendor-sourced or older. RenoDesign's own pipeline, change-order and margin data, captured by the app, will soon be the most reliable benchmark it has.
