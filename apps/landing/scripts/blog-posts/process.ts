import type { SanityPost } from '../seed-blog';

export const processPosts: SanityPost[] = [
  {
    title: 'How to Brief a Design Team Without Wasting a Week',
    slug: 'how-to-brief-a-design-team',
    excerpt: 'Most creative briefs are either one line or ten pages. Both waste time. Here is the brief format that actually ships work fast.',
    category: 'Process',
    keywords: ['creative brief', 'design process', 'design brief template', 'design ops workflow'],
    body: `# How to Brief a Design Team Without Wasting a Week

A bad creative brief doesn't look like a bad creative brief. It looks like a one-line Slack message: "Can you make a landing page for this?" Or it looks like a seven-page deck that buries the actual ask under four slides of market context. Both burn the same amount of time — just on different things.

Most briefing problems are not writing problems. They're thinking problems. The team writing the brief hasn't decided what success looks like before handing off to design. So the designer makes a decision, the brief-writer says "that's not what I meant," and the team starts over.

## The Brief Is a Decision Document, Not a Wishlist

The job of a brief is not to describe what you want. It is to document what you've already decided — so design doesn't have to guess. That means before you open a doc, you need to answer four questions:

- What are we making, exactly?
- Who is it for, and where will they see it?
- What do we want them to feel or do after seeing it?
- What does "good" look like — and how will we know?

If you can't answer all four, the brief isn't ready. The thing to do is not brief the designer — it's finish deciding.

## The Format That Works

A brief that ships fast has five sections, no more:

Goal in one sentence. "This landing page should convert cold traffic from our LinkedIn ads into booked demos." If you can't say it in one sentence, the goal isn't clear yet.

Audience in two sentences. Who is seeing this, what do they already know, and what objection are they most likely to have? "VP of Marketing at a 50–200 person B2B SaaS company. They've seen our ads but don't know how we're different from an in-house designer."

Must-haves. The three to five things that must be in the output. Not style preferences — functional requirements. "Must include customer logo row. Must have a primary CTA above the fold. Must reference the 48-hour delivery."

Do-not-cross lines. Anything off-limits. Brand guidelines, compliance language, competitor mentions to avoid. If there are none, say "none" so the designer knows you thought about it.

Reference. One to three examples of the tone, layout, or energy you're going for. Not "make it look like this" — "this is the feeling I want to hit."

## The Handoff That Saves the Most Time

Before the designer starts, run a five-minute alignment call or async Loom to confirm two things: the designer can restate the goal in their own words, and they know what to do if they get stuck. That's it. If both answers are clear, start the clock.

The biggest time waste in creative work is not revision — it's the silence between a brief dropping and the designer asking the question they should have asked on day one. Build the ask into the process.

## When the Brief Is Done Right

You know a brief worked when the first round of work lands within the range you expected. Not perfect — in range. The designer made choices you can react to, not choices that require restarting the conversation.

That's the goal of a brief: not to eliminate judgment, but to give judgment the right constraints to work inside.
    `,
  },
  {
    title: 'The Async Design Review That Actually Works',
    slug: 'async-design-review-that-works',
    excerpt: 'Most design reviews are 45-minute meetings that could have been a Loom. Here is how to run async reviews that ship faster and get better feedback.',
    category: 'Process',
    keywords: ['async design review', 'design feedback process', 'design ops', 'remote design team'],
    body: `# The Async Design Review That Actually Works

The design review exists to do one thing: help the team decide whether the work is ready to ship. Everything else — the alignment, the discussion, the "wait let me pull up the brand guide" — is overhead. Most design reviews are full of overhead.

The async review isn't a replacement for collaboration. It's a replacement for the 45-minute meeting where half the attendees didn't look at the work before joining and the other half are giving feedback on the wrong version.

## Why Synchronous Reviews Break Down

Live reviews have a structural problem: the feedback quality depends on who speaks first. The loudest voice in the room anchors the conversation. People who disagree with the anchor often don't push back in real time — they send a Slack message afterward. That message spawns a follow-up call. The cycle continues.

Async review inverts this. Everyone gives feedback independently, which means every perspective is equal before anyone else's opinion sets the frame.

## The Stack That Works

You need three things:

A Loom walkthrough. The designer records a 5–10 minute video walking through the work: what they were asked to make, the decisions they made, and the specific things they want feedback on. This is critical — "what do you think?" produces rambling; "does this CTA placement work for the audience we briefed?" produces useful answers.

A Figma link or static preview with comments enabled. Reviewers drop feedback directly on the design, timestamped and threaded. No paraphrasing, no "the button in the top left" — click, comment, done.

A deadline. Async reviews without a time limit produce late feedback that blocks the next stage. "Leave feedback by EOD Thursday" is enough. If the feedback isn't in by the deadline, the work moves forward.

## What Reviewers Need to Know Before They Feedback

Most design feedback is bad because the reviewer doesn't know what they're evaluating. Before the review starts, every reviewer should know:

- What the brief was (goal, audience, must-haves)
- What stage this is (concept, first draft, final check)
- What kind of feedback is useful right now

Directional feedback on a final-check review is not useful. Execution feedback on a concept is premature. Say explicitly which stage you're in and what you want.

## Handling Disagreements Without a Meeting

The most common failure mode in async review is a comment thread that spirals into a debate. The rule: if a thread has more than three replies, it's a decision that needs an owner, not more discussion. The designer flags it, the relevant decision-maker makes the call, and the thread closes.

One decision-maker per design. Not the whole team. If there are five people who can all say "change this," the review will never end.

## What Good Async Review Looks Like

A good async review cycle runs in 24 hours or less. The designer posts the Loom and Figma link, reviewers comment by the deadline, the designer addresses feedback or flags decisions, and the work moves to the next stage. No meeting required unless there's a real conflict.

The goal is not to eliminate human contact from design work. It is to make human contact deliberate and time-efficient. An async review is not a cold process — it is a fast one.
    `,
  },
  {
    title: 'SOPs That Make GTM Creative Repeatable',
    slug: 'sops-for-gtm-creative',
    excerpt: 'Most creative teams reinvent the wheel on every campaign. SOPs are not bureaucracy — they are the system that lets you ship faster without sacrificing quality.',
    category: 'Process',
    keywords: ['GTM creative process', 'design SOP', 'creative operations', 'design ops repeatability'],
    body: `# SOPs That Make GTM Creative Repeatable

Every time a marketing team launches a campaign without documented process, they pay a hidden tax. The designer has to ask what sizes are needed. The copywriter has to ask what the CTA policy is. The PM has to chase down approvals they've chased down before. The output arrives late and inconsistent with the last campaign.

SOPs — standard operating procedures — have a reputation as the bureaucratic tool of large, slow organizations. That reputation is wrong. A well-scoped SOP is the thing that lets a small team move at speed without producing chaos.

## The SOP That's Actually Worth Writing

Not every process deserves documentation. The value of an SOP is proportional to how often the process repeats and how costly variation is. For GTM creative, three processes meet that bar:

Campaign asset production. Every campaign needs a defined spec: which formats, which sizes, what copy character limits, what approval chain. If this is undocumented, every campaign starts with a scoping call that should have been a template.

Brand review. Who checks for brand consistency? What do they check? What is the sign-off path? Without this, brand review becomes a last-minute scramble or gets skipped entirely.

Launch handoff. How does finished creative get to the channels team? What file format? What naming convention? Where does it live? The launch handoff is where most campaigns lose a day.

## What a Good SOP Contains

An SOP that works has four elements:

Trigger. What starts this process? "When a campaign brief is approved" or "When a landing page goes to final review."

Steps. Numbered, in order, with the owner of each step named by role, not person. Roles don't quit; people do.

Inputs and outputs. What does each step require to start, and what does it produce? This is what makes handoffs clean.

Exceptions. What happens when the standard path breaks? "If the brief arrives with less than 5 business days to launch, escalate to the relevant role before proceeding." Unhandled exceptions are where SOPs fall apart.

## How to Write SOPs That People Actually Use

Most SOPs fail because they're written by someone who already knows the process and skips the steps that feel obvious. The test for a usable SOP: can a competent person with no context in this specific process follow it and produce acceptable output?

Write the first draft, then hand it to someone who hasn't done the process before. Watch where they get stuck. Fix those spots. Repeat once. That's your SOP.

Keep SOPs short. A campaign asset production SOP should fit on one screen. If it doesn't, it's covering too many scenarios. Split it.

## When to Update an SOP

An SOP is not a constitution. Update it when the process changes, when it produces a bad output, or when someone following it gets stuck in a predictable way. The SOP owner reviews every SOP quarterly and asks one question: is this still how we actually work?

If the answer is no, update it. An outdated SOP is worse than no SOP — it teaches the wrong process with the authority of documentation.
    `,
  },
];
