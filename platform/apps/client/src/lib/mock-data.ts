// ⚠️ DEPRECATED: This file is no longer used in the application.
// All data now comes from the real NestJS API via lib/api.ts and lib/hooks.ts.
// This file is kept for reference only.

import { Brand, Task, Event, Comment, Workspace } from './types';

export const mockWorkspace: Workspace = {
  id: '1',
  name: 'sako studio',
  plan: 'Studio Plus',
  dayCredits: 18,
  dayCreditsTotal: 30,
  aiCredits: 120,
  aiCreditsTotal: 160,
  activeSlots: 2,
  billingPeriodStart: 'Apr 01',
  billingPeriodEnd: 'Apr 30',
};

export const mockBrands: Brand[] = [
  {
    id: '1',
    workspaceId: '1',
    name: 'Nova – Product',
    shortName: 'Nova',
    primaryColor: '#9ae83e',
    secondaryColor: '#283711',
    typography: 'Inter, San Francisco',
    tone: ['Professional', 'Confident', 'Modern'],
    toneTags: ['Professional', 'Confident', 'Modern'],
    isDefault: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    workspaceId: '1',
    name: 'Orbit – Brand',
    shortName: 'Orbit',
    primaryColor: '#283711',
    secondaryColor: '#9ae83e',
    typography: 'Inter, Helvetica',
    tone: ['Bold', 'Minimal', 'Editorial'],
    toneTags: ['Bold', 'Minimal', 'Editorial'],
    isDefault: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

export const mockTasks: Task[] = [
  {
    id: '42',
    title: 'Q2 launch visuals for mobile app',
    brandId: '1',
    category: 'design',
    status: 'in-review',
    priority: 'high',
    createdAt: 'Apr 04',
    dueDate: 'Apr 06',
    estimatedDays: 1,
    hoursLeft: 18,
    totalHours: 48,
    commentCount: 5,
    revisionNumber: 2,
    brief: 'Launch a refreshed visual system for the mobile paywall and onboarding flow that feels confident, premium, and aligned with Nova\'s updated brand.',
    goals: [
      'Create hero concepts that feel confident and premium',
      'Align visual language with Nova\'s updated brand',
      'Optimize for mobile-first experience',
      'Drive conversion through clear value props',
    ],
    targetAudience: 'New users signing up from paid campaigns in US & EU, primarily mobile-first professionals.',
    deliverables: [
      '3–4 hero concepts for paywall (mobile)',
      'Supporting illustration system for onboarding states',
      'Source files in Figma with documented components',
    ],
    requirements: [
      'Support dark mode variants',
      'Ensure accessibility (WCAG AA)',
      'Include hover/pressed states',
      'Export as SVG + PNG assets',
    ],
    tags: ['Launch', 'Q2'],
    assets: [
      { id: 'a1', type: 'image', name: 'hero-concept-v2.png', thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80', isDeliverable: true },
      { id: 'a2', type: 'figma', name: 'nova-paywall-system.fig', url: 'https://figma.com/...', isDeliverable: true },
      { id: 'a3', type: 'pdf', name: 'brand-guidelines.pdf', isDeliverable: false },
    ],
    pinnedComments: [
      { id: 'p1', pinNumber: 1, x: 35, y: 25, author: 'Alex Johnson', content: 'The logo feels a bit too large here. Can we scale it down by 20%?', tag: 'hero section', timestamp: '2h ago' },
      { id: 'p2', pinNumber: 2, x: 50, y: 55, author: 'Sarah Chen', content: 'Love the CTA color! Make sure it passes contrast ratio.', tag: 'CTA', timestamp: '1h ago' },
      { id: 'p3', pinNumber: 3, x: 60, y: 75, author: 'Alex Johnson', content: 'Can we try a different illustration style here?', tag: 'illustration', timestamp: '45m ago' },
    ],
    revisions: [
      { id: 'r1', number: 1, status: 'completed', requestedBy: 'Alex Johnson', requestedAt: 'Yesterday', summary: 'Initial concepts look great. Minor adjustments to typography hierarchy.' },
      { id: 'r2', number: 2, status: 'in-progress', requestedBy: 'Alex Johnson', requestedAt: '2h ago', summary: 'Logo sizing and CTA adjustments based on latest feedback.', isMajor: false },
    ],
    linkedCallId: 'e1',
  },
  {
    id: '43',
    title: 'Onboarding motion for pricing page',
    brandId: '2',
    category: 'motion',
    status: 'in-progress',
    priority: 'rush',
    createdAt: 'Apr 03',
    dueDate: 'Apr 05',
    estimatedDays: 1,
    hoursLeft: 3,
    totalHours: 48,
    commentCount: 4,
    revisionNumber: 2,
  },
  {
    id: '44',
    title: 'Homepage hero refresh',
    brandId: '1',
    category: 'design',
    status: 'queued',
    priority: 'normal',
    createdAt: 'Apr 02',
    dueDate: 'Apr 09',
    estimatedDays: 1,
    commentCount: 0,
    revisionNumber: 0,
  },
  {
    id: '45',
    title: 'Product explainer storyboard',
    brandId: '2',
    category: 'motion',
    status: 'in-review',
    priority: 'normal',
    createdAt: 'Mar 29',
    dueDate: 'Apr 05',
    estimatedDays: 1,
    commentCount: 6,
    revisionNumber: 1,
    brief: '30-second product explainer video for Orbit\'s homepage. Should feel energetic but not overwhelming.',
    goals: [
      'Explain core value prop in first 5 seconds',
      'Show product UI in action',
      'End with clear CTA',
      'Match Orbit brand energy',
    ],
    requirements: [
      'Export as MP4 (1080p)',
      'Include caption file (SRT)',
      'Background music track',
      'Version with/without voiceover',
    ],
    assets: [
      { id: 'v1', type: 'video', name: 'explainer-v1.mp4', thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80', isDeliverable: true },
      { id: 'v2', type: 'lottie', name: 'button-hover.json', isDeliverable: false },
    ],
    timecodedComments: [
      { id: 'tc1', timecode: '00:03', author: 'Alex Johnson', content: 'Logo animation feels too slow. Speed it up by 0.2s?', timestamp: '3h ago' },
      { id: 'tc2', timecode: '00:12', author: 'Sarah Chen', content: 'This transition is perfect! 🎉', timestamp: '2h ago' },
      { id: 'tc3', timecode: '00:18', author: 'Alex Johnson', content: 'CTA text is hard to read. Can we increase the contrast?', timestamp: '2h ago' },
      { id: 'tc4', timecode: '00:24', author: 'Mike Foster', content: 'Music volume drops too much here.', timestamp: '1h ago' },
    ],
    revisions: [
      { id: 'r1', number: 1, status: 'in-progress', requestedBy: 'Alex Johnson', requestedAt: '3h ago', summary: 'Timing adjustments and CTA contrast improvements.' },
    ],
  },
  {
    id: '46',
    title: 'Brand system refresh',
    brandId: '1',
    category: 'design',
    status: 'completed',
    priority: 'normal',
    createdAt: 'Mar 15',
    dueDate: 'Mar 22',
    estimatedDays: 2,
    commentCount: 8,
    revisionNumber: 2,
  },
  {
    id: '47',
    title: 'Explainer motion script polish',
    brandId: '2',
    category: 'motion',
    status: 'queued',
    priority: 'low',
    createdAt: 'Apr 01',
    dueDate: 'Apr 11',
    estimatedDays: 1,
    commentCount: 1,
    revisionNumber: 0,
  },
];

export const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Strategy call · Q2 launch',
    date: 'Tue, Apr 09',
    time: '4:00–4:45pm',
    type: 'call',
  },
  {
    id: '2',
    title: 'Async review · Motion checkpoint',
    date: 'Wed, Apr 10',
    type: 'review',
    isAsync: true,
  },
];

export const mockComments: Comment[] = [
  {
    id: '1',
    taskId: '42',
    author: 'Sara',
    authorRole: 'Designer',
    content: 'Shared first pass of hero concepts in the Figma file. Next up: onboarding illustrations.',
    timestamp: '2h ago',
    avatar: 'SA',
  },
  {
    id: '2',
    taskId: '42',
    author: 'Alex',
    authorRole: 'You',
    content: 'Left comments on concepts B & C. Let\'s lean into the cleaner, more editorial direction.',
    timestamp: 'Yesterday · 4:12pm',
    avatar: 'AL',
  },
  {
    id: '3',
    taskId: '42',
    author: 'System',
    authorRole: 'System',
    content: 'Status changed from Queued to In progress.',
    timestamp: 'Yesterday · 10:03am',
    avatar: 'SS',
  },
];

export function getBrandById(id: string): Brand | undefined {
  return mockBrands.find(b => b.id === id);
}

export function getTaskById(id: string): Task | undefined {
  return mockTasks.find(t => t.id === id);
}

export function getTasksByStatus(status: TaskStatus): Task[] {
  return mockTasks.filter(t => t.status === status);
}

export function getCommentsByTaskId(taskId: string): Comment[] {
  return mockComments.filter(c => c.taskId === taskId);
}
