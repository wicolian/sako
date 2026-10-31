import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { features } from '../config/features';
import { apiFetch } from '../lib/http';
import { StudioPlaceholder } from '../components/StudioPlaceholder';
import { Icon } from '../components/Icon';
import { toast } from 'sonner';

// Notification event type categories for grouping in UI
const NOTIFICATION_CATEGORIES = [
  {
    label: 'Task updates',
    description: 'Get notified about task progress and changes',
    events: ['TASK_CREATED', 'TASK_IN_PROGRESS', 'TASK_IN_REVIEW', 'TASK_COMPLETED'] as const,
  },
  {
    label: 'Review & feedback',
    description: 'Notifications for comments and revision requests',
    events: ['TASK_COMMENT', 'REVISION_REQUESTED'] as const,
  },
  {
    label: 'Billing',
    description: 'Payment and subscription updates',
    events: ['PAYMENT_FAILED', 'SUBSCRIPTION_PAUSED', 'SUBSCRIPTION_RESUMED', 'SUBSCRIPTION_CANCELED'] as const,
  },
  {
    label: 'Team',
    description: 'Workspace invites and member changes',
    events: ['WORKSPACE_INVITE', 'MEMBER_JOINED', 'MEMBER_REMOVED'] as const,
  },
];

interface NotificationPreference {
  eventType: string;
  emailEnabled: boolean;
  slackEnabled: boolean;
  inAppEnabled: boolean;
}

export const StudioSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'integrations'>('profile');
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!features.settings) {
    return (
      <StudioPlaceholder
        title="Settings"
        subtitle="Studio"
        onNavigate={(route) => navigate(route)}
        message="studio settings are handled manually for beta clients. reach out to the team for any changes."
      />
    );
  }

  // Fetch notification preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await apiFetch<NotificationPreference[]>('/notifications/preferences');
        setPreferences(prefs);
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  // Get aggregated preference state for a category
  const getCategoryPreference = (events: readonly string[], channel: 'emailEnabled' | 'slackEnabled' | 'inAppEnabled') => {
    const categoryPrefs = preferences.filter(p => events.includes(p.eventType));
    if (categoryPrefs.length === 0) return true;
    return categoryPrefs.every(p => p[channel]);
  };

  // Toggle all events in a category for a given channel
  const toggleCategory = async (events: readonly string[], channel: 'emailEnabled' | 'slackEnabled' | 'inAppEnabled') => {
    const currentValue = getCategoryPreference(events, channel);
    const newValue = !currentValue;

    const updatedPrefs = preferences.map(p => {
      if (events.includes(p.eventType)) {
        return { ...p, [channel]: newValue };
      }
      return p;
    });

    const existingEventTypes = new Set(preferences.map(p => p.eventType));
    events.forEach(eventType => {
      if (!existingEventTypes.has(eventType)) {
        updatedPrefs.push({
          eventType,
          emailEnabled: channel === 'emailEnabled' ? newValue : true,
          slackEnabled: channel === 'slackEnabled' ? newValue : true,
          inAppEnabled: channel === 'inAppEnabled' ? newValue : true,
        });
      }
    });

    setPreferences(updatedPrefs);

    setSaving(true);
    try {
      await apiFetch('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences: updatedPrefs }),
      });
      toast.success('Preferences saved');
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile' },
    { id: 'notifications' as const, label: 'Notifications' },
    { id: 'integrations' as const, label: 'Integrations' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Studio</p>
        <h2 className="text-[22px] tracking-tight font-semibold">Settings</h2>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-[13px] whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] font-medium'
                : 'bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-6">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {!isLoaded ? (
              <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading profile...</p>
            ) : (
              <>
                {/* Profile Header */}
                <div className="flex items-center gap-4 pb-4 border-b border-[color:var(--border)]">
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.fullName || 'User'}
                      className="h-16 w-16 rounded-full object-cover border-2 border-[color:var(--border)]"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[20px] font-semibold text-[color:var(--foreground)]">
                      {(user?.fullName || user?.primaryEmailAddress?.emailAddress || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-[16px] font-semibold text-[color:var(--foreground)]">
                      {user?.fullName || 'Studio Admin'}
                    </h3>
                    <p className="text-[13px] text-[color:var(--muted-foreground)]">{user?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-[16px] font-semibold mb-4">Profile information</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Full Name</label>
                      <input
                        type="text"
                        value={user?.fullName || ''}
                        readOnly
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] cursor-not-allowed"
                      />
                      <p className="text-[11px] text-[color:var(--muted-foreground)]">Managed via Clerk authentication.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Email</label>
                      <input
                        type="email"
                        value={user?.primaryEmailAddress?.emailAddress || ''}
                        readOnly
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-[16px] font-semibold mb-2 text-[color:var(--foreground)]">Notification preferences</h3>
              <p className="text-[12px] text-[color:var(--muted-foreground)] mb-4">
                Control how you receive updates about tasks, billing, and team activity.
              </p>

              {loading ? (
                <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading preferences...</p>
              ) : (
                <>
                  {/* Header row */}
                  <div className="flex items-center gap-4 mb-3 px-3">
                    <div className="flex-1"></div>
                    <div className="flex items-center gap-6">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] w-16 text-center">Email</span>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] w-16 text-center">Slack</span>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] w-16 text-center">In-app</span>
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="space-y-3">
                    {NOTIFICATION_CATEGORIES.map(category => (
                      <div key={category.label} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-[color:var(--foreground)]">{category.label}</p>
                          <p className="text-[12px] text-[color:var(--muted-foreground)]">{category.description}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          {['emailEnabled', 'slackEnabled', 'inAppEnabled'].map((channel) => (
                            <div key={channel} className="w-16 flex justify-center">
                              <button
                                onClick={() => toggleCategory(category.events, channel as any)}
                                disabled={saving}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                                  getCategoryPreference(category.events, channel as any)
                                    ? 'bg-[color:var(--primary)] border-[color:var(--primary)]'
                                    : 'bg-[color:var(--muted)] border-[color:var(--border)]'
                                } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                    getCategoryPreference(category.events, channel as any) ? 'translate-x-[22px]' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-[color:var(--muted-foreground)] mt-4">
                    {saving ? 'Saving...' : 'Changes are saved automatically.'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-[16px] font-semibold mb-4 text-[color:var(--foreground)]">Integrations</h3>

              <div className="space-y-4">
                {/* Slack Integration */}
                <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[color:var(--card)] border border-[color:var(--border)] flex items-center justify-center">
                      <Icon name="message-circle" className="w-6 h-6 text-[#4A154B]" />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-medium text-[color:var(--foreground)]">Slack</h4>
                      <p className="text-[12px] text-[color:var(--muted-foreground)]">
                        Receive task notifications in Slack channels.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Configured per workspace
                  </span>
                </div>

                {/* Linear Integration (Coming Soon) */}
                <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[color:var(--card)] border border-[color:var(--border)] flex items-center justify-center">
                      <Icon name="layout" className="w-6 h-6 text-[color:var(--foreground)]" />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-medium text-[color:var(--foreground)]">Linear</h4>
                      <p className="text-[12px] text-[color:var(--muted-foreground)]">
                        Sync tasks with Linear issues.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] bg-[color:var(--muted)] text-[color:var(--muted-foreground)]">
                    Coming soon
                  </span>
                </div>

                {/* Figma Integration (Coming Soon) */}
                <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[color:var(--card)] border border-[color:var(--border)] flex items-center justify-center">
                      <Icon name="pen-tool" className="w-6 h-6 text-[#F24E1E]" />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-medium text-[color:var(--foreground)]">Figma</h4>
                      <p className="text-[12px] text-[color:var(--muted-foreground)]">
                        Export designs directly to Figma.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] bg-[color:var(--muted)] text-[color:var(--muted-foreground)]">
                    Coming soon
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
