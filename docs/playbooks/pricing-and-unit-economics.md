# Pricing and unit economics

How we priced a productized design subscription, how we thought about the cost of delivery, and the scaling model we wrote to plan growth. It is a template for pricing a service by "slots" instead of by hours.

## How to use this

- Use the plan table as a starting shape: three plans, one clear unit of capacity, one clear delivery promise.
- Use the staffing model as a spreadsheet template. Put your own numbers in.
- Read the "reality check" before you copy any scale target.

## 1. Reality check

Headline numbers from our own run:

- We started at the end of 2024.
- We had no revenue until September 2025.
- Then we made about $7,000 a month for about eight months, with revenue growth between 10% and 40%.
- We closed around April 2026.

The scaling plan in section 6 was a planning exercise. We never came close to its volume. Use it for the method, not as a forecast. The margin figures are targets from planning documents. We do not publish measured margins here. Measure your own.

## 2. The price list

| Plan | Price per month | Price per year | Active slots | Team seats | Scope |
|---|---|---|---|---|---|
| Core | $2,500 | $27,000 | 1 | 2 | Design or motion |
| Ops Base | $4,500 | $48,600 | 2 | 4 | Design and motion |
| Enterprise | From $8,500 | From $91,800 | 3 or more | 5 or more | Design, motion, strategy calls, custom terms |

Notes:

- The annual price is the monthly price times 12, minus 10%.
- We kept the same 48-hour promise on every plan. Enterprise could negotiate priority or custom turnaround.
- Early drafts of the price list had higher tiers and different numbers (for example a higher entry price for Enterprise). Different documents carried different prices at the same time. The list above is the last one we used.

### What is in every plan

- Landing pages, ad creative, pitch decks, social graphics, email design, motion cutdowns, captions, kinetic type, and builds in a no-code site tool from approved designs.
- Unlimited brands in one workspace.
- Unlimited revisions until the brief is matched.
- Delivery in 48 business hours, backed by an SLA with service credits.
- Chat integration and a dashboard.
- Month-to-month billing, no contract.
- 14-day money-back guarantee.
- Pause and resume, with unused days banked.

### What is not included

Heavy 3D or VFX, character animation, full product UX research, engineering, complex CMS builds, migrations, multi-language work, memberships or login features, print design, long-form video.

## 3. How the unit of capacity works

We did not sell hours. We did not sell credits per task. We sold active slots.

- **Active slot:** one job being worked on right now. A plan with two slots has two jobs in progress at the same time.
- **Queue:** the buyer can add as many requests as they like. Only the slot count is active.
- **Day credit:** one working day of the delivery team. When the team works on a job, a day credit is used. When the plan is paused, day credits stop being used.
- **Pause and bank:** unused days stay in the bank. Rollover when paused was three months for monthly plans and six months for annual plans. Credits stay valid for 30 days (monthly) or 365 days (annual).
- **AI credits:** a separate allowance for first-draft generation inside our own AI tool. They never pay for human work.

Why this worked as a sales tool: the buyer can always answer "what am I buying?" ("one job at a time, ready in 48 hours"). It is easier to explain than hours or credits.

Why it is hard: a slot that is not used still costs you a designer. Capacity planning is the real business. See section 5.

## 4. Optional low-cost entry: AI-only plans

We also designed AI-only plans with no human work: a free plan with 10 generations a month, and a paid plan with 100 generations a month from about $20 a month ($240 a year). The idea was to bring in small users and move them up to the human plans. Treat this as an idea we designed, not a proven funnel.

## 5. Cost of delivery: how to model it

### Pod idea

A "pod" is a small delivery team that serves a group of clients from a shared pool of capacity. In our planning model a pod was 10 people:

- 1 lead designer (oversight and quality)
- 3 senior designers (complex work)
- 4 mid-level designers (core delivery)
- 2 motion designers

In real life our team was much smaller. One founder ran four designers. Use the pod idea as a way to think about roles, not as what we ran.

### Capacity rules we wrote

- Designers join a shared pool. They are not tied to one client.
- When pool utilization goes above 80%, flag the need for more capacity.
- When utilization falls below 50%, rebalance work and stop hiring.
- Route each task by complexity, SLA, skill match and current workload.

### Margin targets

Our planning documents used a gross margin target of roughly 60% to 70%. One scaling model showed margins of 75% to 85%, but that figure only subtracted salaries. It left out tools, sales, marketing and overhead. Do not use a salary-only margin to judge your business.

## 6. The scaling model (template)

We built a spreadsheet to answer: "how many clients and how many people do we need at each revenue level?" The inputs:

**Client mix.** We chose 40% Core, 40% middle plan (Ops), 20% Enterprise.

- Core: lowest price (about $2,500 per client per month). Too much of it means a large headcount for little revenue.
- Ops: middle price (about $4,500). The stable middle. Steady, predictable work.
- Enterprise: highest price (about $9,000). Hard to close, but more profit. Do not depend on it early.

With that mix and those prices, the blended revenue per client is about $4,600 a month (0.4 x 2,500 + 0.4 x 4,500 + 0.2 x 9,000). The original plan used a higher blended number, so check yours before you trust any "clients needed" table.

**Clients per delivery person.** Core 8, Ops 5, Enterprise 4. These were assumptions that depended on AI help and good process. We never proved them at scale.

**Salary assumptions (monthly, year 1, India).** Core creative about ₹50,000. Ops creative about ₹1.2 lakh. Enterprise creative about ₹2.5 lakh. Internal staff about ₹75,000. We assumed raises of 20% to 25% for creatives and 15% for internal staff in year 2.

**Internal staff cap.** Internal (non-delivery) staff grew in steps and was capped at 70 people in the plan, even at very large scale.

### Spreadsheet template

1. Choose your plan prices and client mix.
2. Compute blended revenue per client.
3. For a revenue target, compute clients needed = revenue divided by blended revenue.
4. Split clients by mix. Divide each tier by its clients-per-person ratio to get delivery staff.
5. Add internal staff.
6. Multiply staff by salary assumptions. Add tools, sales, marketing and overhead.
7. Compute gross margin and contribution margin.
8. Stress test: lose 20% of clients, or raise salaries 20%. What breaks?

### Reasons not to trust big scale plans

- Every number above is an assumption. Revenue per client depends on win rate. Win rate depends on distribution.
- Hiring ahead of revenue kills small companies. Hire when utilization is above 80%.
- A plan that starts at a high revenue level hides the hardest part, which is the first ten clients.

## 7. Cost comparison used in sales

| | Our Core plan | Freelancers | Agency | In-house hire |
|---|---|---|---|---|
| Monthly cost | $2,500 | $5,000 to $15,000, variable | $10,000 to $25,000 retainer | $12,000 to $20,000 loaded |
| Yearly cost | $30,000 | $60,000 to $180,000 | $120,000 to $300,000 | $144,000 to $240,000 |

These are our estimates for sales use. Replace them with numbers from your market.

## 8. Adapt it

- Pick a unit your buyer understands: slots, outputs, seats. Avoid hours.
- Keep three plans. One entry plan, one "most people" plan, one custom plan.
- Make the delivery promise the same on every plan. Charge for parallel capacity, not for speed.
- Offer a money-back window instead of a free trial. It protects you from tire-kickers and still removes risk.
- Keep one price list in one place. We had three versions in different documents, and it caused confusion.
- Write down what is not included. It protects your margin more than any discount rule.
