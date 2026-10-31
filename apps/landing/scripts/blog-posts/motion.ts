import type { SanityPost } from '../seed-blog';

export const motionPosts: SanityPost[] = [
  {
    title: 'Why Motion in Your Ads Stops the Scroll',
    slug: 'why-motion-in-ads-stops-the-scroll',
    excerpt: 'Static ads are disappearing from high-performing paid programs. Here is what the research shows about motion creative and why it matters for B2B GTM.',
    category: 'Motion',
    keywords: ['motion ads', 'animated ad creative', 'video ads B2B', 'scroll-stopping creative'],
    body: `# Why Motion in Your Ads Stops the Scroll

Static ads are not dying — they're being outcompeted. The average LinkedIn feed contains more motion than it did two years ago. Attention, already scarce, is now being captured before conscious recognition. If your creative isn't moving, it is competing at a structural disadvantage.

This is not a prediction about trends. It's a description of how the human visual system works, applied to the current state of the LinkedIn and Meta feeds.

## The Peripheral Vision Advantage

Human peripheral vision is wired to detect motion. This is evolutionary — movement in the environment is either a threat or an opportunity, and detecting it before consciously focusing on it is a survival advantage. In the context of a social feed, this means that motion triggers a micro-fixation before the viewer decides whether the content is relevant.

Static creative has to earn attention after that fixation point. Motion creates the fixation.

This isn't a small difference. Studies on ad attention tracking consistently show that animated or video ads receive significantly longer dwell time than static equivalents, even when the content is otherwise identical. The motion is doing a job the static version can't do.

## What Works in B2B Motion Creative

Not all motion is equivalent. The motion patterns that perform in B2B paid programs are different from the ones that perform in consumer advertising.

Reveal animations. Showing a stat, quote, or product screen appearing with a clean entrance animation. This works because it creates micro-anticipation — the viewer stays to see what appears.

Product demos in 8–15 seconds. Showing the product working without asking the viewer to do anything. The best B2B motion ads show the outcome — the finished design, the completed workflow, the result state — and work backward to what created it.

Text-driven animations. A single line of copy, animated in on a clean background, with a second line that delivers the punch. This format is highly effective on LinkedIn where many viewers have audio off — it works entirely visually.

What doesn't work: jump cuts, fast transitions, stock footage of people looking at laptops, anything that requires audio to understand, or motion for its own sake without a clear visual hierarchy.

## The Production Reality for B2B Teams

Most B2B SaaS marketing teams don't produce motion creative at scale because the production pipeline is slow and expensive. A 15-second animated ad that would have cost thousands and three weeks from an agency now costs a fraction of that with the right design ops setup — but only if the design team has actual motion expertise.

The teams that are winning on paid right now are the ones who figured out that motion is a production problem, not a strategy problem. They've either built internal motion capability or found a partner who can produce it at the pace campaigns require.

## The Practical Starting Point

If your current ad program runs entirely on static creative, the starting point is not to replace everything at once. Pick your highest-spend campaign, produce one animated version of your best-performing static ad, and run them head-to-head. The test will answer the question faster than any benchmark.

Most teams that run this test find that the motion version wins. The question then becomes a production question: how do we make this repeatable?
    `,
  },
  {
    title: 'Lottie vs. Video in GTM Assets: When to Use Each',
    slug: 'lottie-vs-video-gtm-assets',
    excerpt: 'Both Lottie animations and video have a place in a GTM asset stack. The choice depends on format, file size, interactivity requirements, and production pipeline.',
    category: 'Motion',
    keywords: ['Lottie animation', 'video vs animation', 'GTM motion assets', 'web animation B2B'],
    body: `# Lottie vs. Video in GTM Assets: When to Use Each

When a B2B team decides to add motion to their GTM assets, the first technical question is usually "should this be a video or an animation?" The answer is not preference — it's determined by the format the asset lives in, the production pipeline that needs to support it, and what the asset needs to do.

## What Lottie Is and What It's Good For

Lottie is a JSON-based animation format exported from After Effects that renders at any resolution without quality loss, loops seamlessly, and has a file size that is typically 10–20x smaller than equivalent video. It is the dominant format for web animations that need to be crisp, scalable, and lightweight.

Where Lottie wins:

Website animations. Hero sections, feature demos, icons that come alive on hover, loading states, scroll-triggered animations. Lottie renders natively in the browser without a video player, which means no autoplay restrictions, no buffering, no control bar unless you add one.

App UI demos. Showing a software workflow in a product tour or landing page feature section. Lottie lets you loop specific interactions without the overhead of a video file.

Scalable brand motion. Animated logos, loading indicators, micro-interactions. These need to render perfectly at every screen size. Lottie does this; video does not.

Email animations. GIF-converted Lotties are lighter than video-converted GIFs and maintain better quality at common email dimensions.

Where Lottie doesn't win: anywhere you need realistic footage, voice, complex compositing, or the production qualities of actual video.

## What Video Is and What It's Good For

Video — specifically H.264 or H.265 compressed MP4, or WebM for web — is the right format when Lottie can't do the job.

Testimonials and talking-head content. Real people speaking create trust that motion design cannot replicate. A 60-second customer story video is more persuasive than any animation.

Product demos with real UI complexity. If you're showing an actual product workflow with real data, real interactions, and transitions between screens, video captures it without requiring the motion designer to rebuild the UI in After Effects.

LinkedIn and Meta ads. Most ad platforms natively play MP4. Lottie requires a web embed — it does not run inside a LinkedIn or Meta ad unit. For paid social, video is the format.

Long-form content. Anything over 30 seconds that tells a narrative story is usually better served by video with audio than by a silent animation.

## The Decision Framework

The practical question is usually not "which is better?" but "which do we need for this specific output?"

For website: use Lottie when you can. For paid social ads: use video. For product tours and feature sections: use Lottie. For testimonials: use video. For email: use Lottie exported as GIF if the animation is simple; use a static image linking to video if it's complex. For decks: embed video for plays that need audio; use GIF-converted Lottie for silent loops.

## The Production Implication

Lottie and video have different production pipelines. Lottie is produced in After Effects and exported via the Bodymovin plugin — it requires a motion designer with AE proficiency. Video production requires either a camera setup for live action or a video editing and compositing workflow.

A design team that can produce both is significantly more valuable than one that can only produce one. The GTM asset stack of a well-run B2B SaaS marketing program uses both regularly — and knowing which to use, without calling a meeting about it, is a sign of mature design ops.
    `,
  },
  {
    title: 'The 5 Motion Principles B2B Teams Keep Ignoring',
    slug: '5-motion-principles-b2b-teams-ignore',
    excerpt: 'Motion design in B2B is rarely wrong in an obvious way. It is usually wrong in a subtle way that makes the work feel cheap without the viewer knowing why.',
    category: 'Motion',
    keywords: ['motion design principles', 'B2B motion design', 'animation principles', 'GTM motion creative'],
    body: `# The 5 Motion Principles B2B Teams Keep Ignoring

Most motion design mistakes in B2B are not dramatic failures. They are small violations of motion principles that make the work feel slightly off without the viewer being able to articulate why. The result is creative that looks like it was made by someone who understands the tools but not the craft.

These are the five principles that separate motion that earns attention from motion that wastes it.

## 1. Easing Is Not Optional

Linear animation — where an element moves at constant speed from point A to point B — feels mechanical and cheap. Every physical object in the world accelerates into motion and decelerates out of it. Animation that violates this law registers as wrong, even to viewers who have never thought about animation.

Ease-in-out is the baseline. The element starts slow, accelerates through the middle of the motion, and decelerates before it stops. For entrance animations, ease-out feels natural. For exit animations, ease-in reads as decisive.

The mistake: applying linear motion because the design tool's default is linear. Every tool has easing controls. Use them.

## 2. Duration Is a Communicator

The speed of an animation communicates the nature of the object or action. Fast animations read as responsive and precise. Slow animations read as weighty and significant. The mismatch is where most B2B motion goes wrong.

A button hover animation that takes 400ms feels sluggish — it's communicating weight that a button doesn't have. A feature reveal animation that takes 80ms feels twitchy — it's not giving the viewer time to register what appeared.

The practical guide: interface micro-interactions should run between 80ms and 150ms. Entrance animations for content should run between 300ms and 500ms. Transitions between major states should run between 400ms and 700ms.

## 3. Hierarchy Means One Thing Moves at a Time

The most common motion mistake in B2B marketing animation is animating everything simultaneously. Every element enters at once. The viewer's eye doesn't know where to look. The animation produces cognitive load instead of reducing it.

Effective motion has hierarchy: one element enters, then the next, with small delays of 100–150ms between sibling elements. This guides the eye through the content in the intended order and creates a sense of composition that static design cannot replicate.

The test: mute the sound and watch your animation. Does your eye naturally follow the motion from the most important element to the least important? If not, the hierarchy is wrong.

## 4. Loop Points Need to Be Invisible

Looping animations — which are the dominant format for web and most ad placements — break when the loop point is visible. A visible loop point is usually caused by an animation that has a hard end state that doesn't match the start state, or a transition that happens faster than the eye can smooth over.

The fix is almost always a crossfade at the loop point, or designing the animation so the end state and start state are identical. Most Lottie animations should be seamless loops. Most GIFs should be seamless loops. If the viewer can see the animation restart, the loop is broken.

## 5. Motion Should Have a Reason

The worst motion in B2B creative is motion that exists because the designer could add it, not because it communicates something. Particles floating for no reason. Text that spins before settling. Icons that wiggle when there is no interaction event.

Every piece of motion should answer: what does this animation communicate that a static version could not? If the answer is "nothing," the animation should be removed.

The reason motion works in GTM assets is that it directs attention, communicates change, and reduces the time the viewer needs to understand what's happening. Motion that doesn't do any of these things is noise. In an attention environment that is already saturated, noise is expensive.
    `,
  },
];
