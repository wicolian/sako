import React, { useState } from 'react';
import { Icon } from '../Icon';
import { useWorkspace } from '../../lib/hooks';
import { useWorkspaceContext } from '../../lib/WorkspaceProvider';
import { useUser } from '@clerk/clerk-react';
import { features } from '../../config/features';
import { PLANS, getPlanDisplayName } from '../../config/plans';
import { Workspace } from '../../lib/types';
import { PauseStatus } from './PauseStatus';

import { API_BASE_URL } from '../../lib/config';
import { getSlackStatus, listSlackChannels, setSlackDefaultChannel, sendSlackTestMessage, startSlackOAuth } from '../../lib/api';
import { ApiError } from '../../lib/http';

interface SettingsProps {
  onNavigate: (route: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'organization' | 'team' | 'notifications' | 'security' | 'billing' | 'integrations'>('profile');
  const { data: workspace, loading, refetch } = useWorkspace();
  const { permissions } = useWorkspaceContext();

  // Slack integration state
  const [slackStatus, setSlackStatus] = useState<{
    connected: boolean;
    teamName?: string;
    defaultChannelId?: string;
    defaultChannelName?: string;
  } | null>(null);

  const [channels, setChannels] = useState<Array<{
    id: string;
    name: string;
    isPrivate: boolean;
    isMember?: boolean;
  }>>([]);

  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackSuccess, setSlackSuccess] = useState<string | null>(null);
  const [channelsNextCursor, setChannelsNextCursor] = useState<string | undefined>(undefined);
  const [isChangingChannel, setIsChangingChannel] = useState(false);

  // Restrict access for non-owners
  if (!permissions.canManageSettings) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <Icon name="lock" className="h-12 w-12 text-[color:var(--muted-foreground)] mx-auto mb-4" />
          <h2 className="text-[18px] font-semibold text-[color:var(--foreground)] mb-2">Access restricted</h2>
          <p className="text-[13px] text-[color:var(--muted-foreground)] mb-4">
            Only workspace owners can access settings, billing, and team management.
          </p>
          <button
            onClick={() => onNavigate('/')}
            className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile' },
    { id: 'organization' as const, label: 'Organization' },
    { id: 'team' as const, label: 'Team' },
    { id: 'integrations' as const, label: 'Integrations' },
    {
      id: 'notifications' as const,
      label: features.notifications ? 'Notifications' : 'Notifications (coming soon)',
      disabled: !features.notifications,
    },
    {
      id: 'security' as const,
      label: features.advancedSettings ? 'Security' : 'Security (coming soon)',
      disabled: !features.advancedSettings,
    },
    { id: 'billing' as const, label: 'Billing' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Account</p>
        <h2 className="text-[22px] tracking-tight font-semibold">Settings</h2>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.filter(tab => !tab.disabled).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-[13px] whitespace-nowrap transition ${activeTab === tab.id
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
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'organization' && <OrganizationTab workspace={workspace} loading={loading} onRefresh={refetch} />}
        {activeTab === 'team' && <TeamTab workspace={workspace} loading={loading} />}
        {activeTab === 'integrations' && <IntegrationsTab workspace={workspace} loading={loading} />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'billing' && <BillingTab workspace={workspace} loading={loading} onRefresh={refetch} />}
      </div>
    </div>
  );
};

const ProfileTab: React.FC = () => {
  const { user, isLoaded } = useUser();
  
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? '';
  const userName = user?.fullName || user?.firstName || '';
  const userAvatar = user?.imageUrl;
  
  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading profile...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-[color:var(--border)]">
        {userAvatar ? (
          <img 
            src={userAvatar} 
            alt={userName || 'User'} 
            className="h-16 w-16 rounded-full object-cover border-2 border-[color:var(--border)]"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[20px] font-semibold text-[color:var(--foreground)]">
            {(userName || userEmail || 'U')[0].toUpperCase()}
          </div>
        )}
        <div>
          <h3 className="text-[16px] font-semibold text-[color:var(--foreground)]">
            {userName || 'User'}
          </h3>
          <p className="text-[13px] text-[color:var(--muted-foreground)]">{userEmail}</p>
        </div>
      </div>
      
      <div>
        <h3 className="text-[16px] font-semibold mb-4">Profile information</h3>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Full Name</label>
            <input
              type="text"
              value={userName}
              readOnly
              className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] cursor-not-allowed"
            />
            <p className="text-[11px] text-[color:var(--muted-foreground)]">Managed via Clerk authentication.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Email</label>
            <input
              type="email"
              value={userEmail}
              readOnly
              className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] cursor-not-allowed"
            />
            <p className="text-[11px] text-[color:var(--muted-foreground)]">Contact support to change your email.</p>
          </div>
          {user?.createdAt && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Member Since</label>
              <input
                type="text"
                value={new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                readOnly
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] cursor-not-allowed"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const OrganizationTab: React.FC<{ workspace: Workspace | null; loading: boolean; onRefresh: () => void }> = ({ workspace, loading, onRefresh }) => {
  const [orgName, setOrgName] = React.useState('');
  const [orgTimezone, setOrgTimezone] = React.useState('UTC');
  const [savedOrgName, setSavedOrgName] = React.useState('');
  const [savedOrgTimezone, setSavedOrgTimezone] = React.useState('UTC');
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Initialize state when workspace loads
  React.useEffect(() => {
    if (workspace) {
      const name = workspace.name || '';
      const timezone = workspace.timezone || 'UTC';
      setOrgName(name);
      setOrgTimezone(timezone);
      setSavedOrgName(name);
      setSavedOrgTimezone(timezone);
    }
  }, [workspace]);

  const hasChanges = () => {
    return orgName !== savedOrgName || orgTimezone !== savedOrgTimezone;
  };

  const handleSave = async () => {
    if (!hasChanges() || !workspace) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const { updateWorkspace } = await import('../../lib/api');

      // Only send changed fields
      const updates: { name?: string; timezone?: string } = {};
      if (orgName !== savedOrgName) updates.name = orgName;
      if (orgTimezone !== savedOrgTimezone) updates.timezone = orgTimezone;

      const updatedWorkspace = await updateWorkspace(updates);
      const updatedName = updatedWorkspace.name || '';
      const updatedTimezone = updatedWorkspace.timezone || 'UTC';

      setSavedOrgName(updatedName);
      setSavedOrgTimezone(updatedTimezone);
      setOrgName(updatedName);
      setOrgTimezone(updatedTimezone);
      onRefresh();
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || err.body?.message || 'Failed to update workspace');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[16px] font-semibold mb-4">Organization settings</h3>
        {loading ? (
          <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading workspace...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Workspace name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--input-background)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30 focus:border-[color:var(--ring)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Timezone</label>
              <input
                type="text"
                value={orgTimezone}
                onChange={(e) => setOrgTimezone(e.target.value)}
                placeholder="e.g. America/New_York, Europe/London, Asia/Tokyo"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--input-background)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30 focus:border-[color:var(--ring)]"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSave}
                disabled={loading || !hasChanges() || isSaving}
                className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:bg-[color:var(--primary)]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>

              {saveSuccess && (
                <p className="text-[12px] text-green-600 mt-2">
                  ✓ Workspace settings updated successfully
                </p>
              )}

              {saveError && (
                <p className="text-[12px] text-red-600 mt-2">
                  {saveError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TeamTab: React.FC<{ workspace: any; loading: boolean }> = ({ workspace, loading }) => {
  const [members, setMembers] = React.useState<any>(null);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [showInviteForm, setShowInviteForm] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('MEMBER');
  const [isInviting, setIsInviting] = React.useState(false);

  const fetchMembers = React.useCallback(async () => {
    if (!workspace) return;
    setLoadingMembers(true);
    try {
      const { apiFetch } = await import('../../lib/http');
      const data = await apiFetch('/workspace/members', { method: 'GET' });
      setMembers(data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [workspace]);

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from the workspace?')) return;
    try {
      const { apiFetch } = await import('../../lib/http');
      await apiFetch(`/workspace/members/${memberId}`, { method: 'DELETE' });
      await fetchMembers();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove member');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { apiFetch } = await import('../../lib/http');
      await apiFetch(`/workspace/members/${memberId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole }),
      });
      await fetchMembers();
    } catch (err: any) {
      alert(err?.message || 'Failed to update role');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const { apiFetch } = await import('../../lib/http');
      await apiFetch('/workspace/members/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      alert('Member invited successfully!');
      setInviteEmail('');
      setShowInviteForm(false);
      await fetchMembers();
    } catch (err: any) {
      alert(err?.message || 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };

  if (loading || loadingMembers) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading team members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold">Team members</h3>
          {members && (
            <span className="text-[12px] text-[color:var(--muted-foreground)]">
              {members.seatsUsed} of {members.seatLimit} seats used
            </span>
          )}
        </div>

        {members && members.members && members.members.length > 0 ? (
          <div className="space-y-2 mb-4">
            {members.members.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[color:var(--foreground)]">{member.user.name || member.user.email}</p>
                  <p className="text-[12px] text-[color:var(--muted-foreground)]">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    disabled={member.role === 'OWNER'}
                    className="px-2 py-1.5 rounded-md bg-[color:var(--card)] border border-[color:var(--border)] text-[11px] text-[color:var(--primary)] font-medium outline-none focus:border-[color:var(--ring)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="SUBMITTER">SUBMITTER</option>
                    <option value="MEMBER">MEMBER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                  {member.role !== 'OWNER' && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 bg-red-50 text-[12px] font-medium text-red-700 hover:bg-red-100 transition"
                      title="Remove member"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[color:var(--muted-foreground)] mb-4">No team members yet.</p>
        )}

        {showInviteForm ? (
          <form onSubmit={handleInvite} className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30 focus:border-[color:var(--ring)]"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30 focus:border-[color:var(--ring)]"
              >
                <option value="SUBMITTER">Submitter</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isInviting}
                className="px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:bg-[color:var(--primary)]/90 transition disabled:opacity-50"
              >
                {isInviting ? 'Inviting...' : 'Send Invite'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail('');
                }}
                className="px-4 py-2 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] text-[13px] hover:bg-[color:var(--accent)] transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowInviteForm(true)}
            disabled={members && members.seatsAvailable === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:bg-[color:var(--primary)]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={members && members.seatsAvailable === 0 ? 'All seats are in use. Upgrade your plan to add more members.' : undefined}
          >
            <Icon name="user-plus" className="h-4 w-4" />
            Invite Team Member
          </button>
        )}

        {members && members.seatsAvailable === 0 && !showInviteForm && (
          <p className="mt-2 text-[12px] text-amber-700">
            You've reached your seat limit. Upgrade your plan to add more team members.
          </p>
        )}
      </div>
    </div>
  );
};

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

type NotificationEventType = typeof NOTIFICATION_CATEGORIES[number]['events'][number];

interface NotificationPreference {
  eventType: string;
  emailEnabled: boolean;
  slackEnabled: boolean;
  inAppEnabled: boolean;
}

const NotificationsTab: React.FC = () => {
  const [preferences, setPreferences] = React.useState<NotificationPreference[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch preferences on mount
  React.useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { fetchNotificationPreferences } = await import('../../lib/api');
        const prefs = await fetchNotificationPreferences();
        setPreferences(prefs);
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
        setError('Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  // Get aggregated preference state for a category
  const getCategoryPreference = (events: readonly string[], channel: 'emailEnabled' | 'slackEnabled' | 'inAppEnabled') => {
    const categoryPrefs = preferences.filter(p => events.includes(p.eventType));
    if (categoryPrefs.length === 0) return true; // Default to enabled
    return categoryPrefs.every(p => p[channel]);
  };

  // Toggle all events in a category for a given channel
  const toggleCategory = async (events: readonly string[], channel: 'emailEnabled' | 'slackEnabled' | 'inAppEnabled') => {
    const currentValue = getCategoryPreference(events, channel);
    const newValue = !currentValue;

    // Update local state immediately for responsiveness
    const updatedPrefs = preferences.map(p => {
      if (events.includes(p.eventType)) {
        return { ...p, [channel]: newValue };
      }
      return p;
    });

    // For events that don't exist in preferences yet, create them
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

    // Save to API
    setSaving(true);
    try {
      const { updateNotificationPreferences } = await import('../../lib/api');
      await updateNotificationPreferences(updatedPrefs as any);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      // Revert on error (in production, we'd show a toast)
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 text-[13px] text-[color:var(--muted-foreground)]">
        <p>Loading notification preferences...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 text-[13px] text-[color:var(--destructive)]">
        <h3 className="text-[16px] font-semibold text-[color:var(--foreground)]">Notification preferences</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[16px] font-semibold mb-2 text-[color:var(--foreground)]">Notification preferences</h3>
        <p className="text-[12px] text-[color:var(--muted-foreground)] mb-4">
          Control how you receive updates about tasks, billing, and team activity.
        </p>

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
                {/* Email toggle */}
                <div className="w-16 flex justify-center">
                  <button
                    onClick={() => toggleCategory(category.events, 'emailEnabled')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      getCategoryPreference(category.events, 'emailEnabled')
                        ? 'bg-[color:var(--primary)] border-[color:var(--primary)]'
                        : 'bg-[color:var(--muted)] border-[color:var(--border)]'
                    } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        getCategoryPreference(category.events, 'emailEnabled') ? 'translate-x-[22px]' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Slack toggle */}
                <div className="w-16 flex justify-center">
                  <button
                    onClick={() => toggleCategory(category.events, 'slackEnabled')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      getCategoryPreference(category.events, 'slackEnabled')
                        ? 'bg-[color:var(--primary)] border-[color:var(--primary)]'
                        : 'bg-[color:var(--muted)] border-[color:var(--border)]'
                    } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        getCategoryPreference(category.events, 'slackEnabled') ? 'translate-x-[22px]' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* In-app toggle */}
                <div className="w-16 flex justify-center">
                  <button
                    onClick={() => toggleCategory(category.events, 'inAppEnabled')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      getCategoryPreference(category.events, 'inAppEnabled')
                        ? 'bg-[color:var(--primary)] border-[color:var(--primary)]'
                        : 'bg-[color:var(--muted)] border-[color:var(--border)]'
                    } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        getCategoryPreference(category.events, 'inAppEnabled') ? 'translate-x-[22px]' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-[color:var(--muted-foreground)] mt-4">
          {saving ? 'Saving...' : 'Changes are saved automatically.'}
        </p>
      </div>
    </div>
  );
};

const SecurityTab: React.FC = () => {
  if (!features.advancedSettings) {
    return (
      <div className="space-y-4 text-[13px] text-[color:var(--muted-foreground)]">
        <h3 className="text-[16px] font-semibold text-[color:var(--foreground)]">security</h3>
        <p>self-serve security settings are on the roadmap. email support if you need a password reset or SSO enabled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[16px] font-semibold mb-4">Security</h3>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Change password</label>
            <button className="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition">
              <Icon name="lock" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
              Update password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const BillingTab: React.FC<{ workspace: Workspace | null; loading: boolean; onRefresh: () => void }> = ({ workspace, loading, onRefresh }) => {
  const [isProcessing, setIsProcessing] = React.useState(false);
  // Optimistic subscription status to fix UI delay after pause/resume
  const [optimisticStatus, setOptimisticStatus] = React.useState<string | null>(null);
  const slaHours = Math.round(((workspace?.effectiveSlaSeconds ?? 172800) / 3600));

  // Clear optimistic status when workspace data updates (refresh completed)
  React.useEffect(() => {
    if (workspace?.subscription?.status) {
      setOptimisticStatus(null);
    }
  }, [workspace?.subscription?.status]);

  const handlePauseSubscription = async () => {
    if (!confirm('Are you sure you want to pause your subscription? This will stop day credit burn but you can resume anytime.')) {
      return;
    }

    setIsProcessing(true);
    try {
      const { pauseSubscription } = await import('../../lib/api');
      await pauseSubscription({ reason: 'User requested pause' });
      // Set optimistic status immediately so button updates before refresh completes
      setOptimisticStatus('PAUSED');
      onRefresh();
    } catch (error) {
      alert('Failed to pause subscription: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? Your subscription will remain active until the end of the billing period.')) {
      return;
    }

    const reason = prompt('Please tell us why you\'re canceling (optional):');

    setIsProcessing(true);
    try {
      const { cancelSubscription } = await import('../../lib/api');
      await cancelSubscription({ reason: reason || undefined });
      alert('Subscription canceled successfully');
      onRefresh();
    } catch (error) {
      alert('Failed to cancel subscription: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!confirm('Resume your subscription? Day credit burn will restart.')) {
      return;
    }

    setIsProcessing(true);
    try {
      const { resumeSubscription } = await import('../../lib/api');
      await resumeSubscription({ note: 'User resumed from settings' });
      // Set optimistic status immediately so button updates before refresh completes
      setOptimisticStatus('ACTIVE');
      onRefresh();
    } catch (error) {
      alert('Failed to resume subscription: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUncancelSubscription = async () => {
    if (!confirm('Keep your subscription and continue automatic renewals?')) {
      return;
    }

    setIsProcessing(true);
    try {
      const { uncancelSubscription } = await import('../../lib/api');
      await uncancelSubscription({ note: 'User kept subscription from settings' });
      alert('Subscription cancellation undone. Your plan will continue renewing.');
      onRefresh();
    } catch (error) {
      alert('Failed to undo cancellation: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePortalSession = async () => {
    setIsProcessing(true);
    try {
      const { createPortalSession } = await import('../../lib/api');
      const { url } = await createPortalSession(window.location.href);
      window.location.href = url;
    } catch (error) {
      alert('Failed to open billing portal: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async (planCode: string, billingInterval: 'MONTHLY' | 'YEARLY' = 'MONTHLY') => {
    setIsProcessing(true);
    try {
      const { createCheckoutSession } = await import('../../lib/api');
      const { url } = await createCheckoutSession({
        planCode,
        billingInterval,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
      });
      window.location.href = url;
    } catch (error) {
      alert('Failed to start checkout: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpgrade = async (planCode: string, billingInterval: 'MONTHLY' | 'YEARLY' = 'MONTHLY') => {
    setIsProcessing(true);
    try {
      const { createCheckoutSession } = await import('../../lib/api');
      const { url } = await createCheckoutSession({
        planCode,
        billingInterval,
        successUrl: window.location.href + '?upgrade=success',
        cancelUrl: window.location.href + '?upgrade=cancel',
      });
      window.location.href = url;
    } catch (error) {
      alert('Failed to start upgrade: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading billing information...</p>
      </div>
    );
  }

  const plan = workspace?.plan;
  const subscription = workspace?.subscription;
  const legacyDayCredit = (workspace as any)?.credits?.dayCredits?.[0];
  const legacyAiCredit = (workspace as any)?.credits?.aiCredits?.[0];
  const latestDayCredit = legacyDayCredit || (workspace?.dayCredit && {
    total: workspace.dayCredit.totalCredits,
    used: workspace.dayCredit.usedCredits,
    remaining: workspace.dayCredit.totalCredits - workspace.dayCredit.usedCredits,
    periodEnd: workspace.dayCredit.periodEnd,
  });
  const latestAiCredit = legacyAiCredit || (workspace?.aiCredit && {
    total: workspace.aiCredit.totalCredits,
    used: workspace.aiCredit.usedCredits,
    remaining: workspace.aiCredit.totalCredits - workspace.aiCredit.usedCredits,
    periodEnd: workspace.aiCredit.periodEnd,
  });
  // Use optimistic status for immediate UI feedback after pause/resume
  const effectiveStatus = optimisticStatus ?? subscription?.status;
  const isActive = effectiveStatus === 'ACTIVE';
  const isPaused = effectiveStatus === 'PAUSED';
  const isCanceled = subscription?.status === 'CANCELED';
  const isPastDue = subscription?.status === 'PAST_DUE';
  const isCancelAtPeriodEnd = subscription?.status === 'CANCEL_AT_PERIOD_END';
  const hasActiveSubscription = isActive || isPaused || (isCanceled && subscription?.billingPeriodEnd && new Date(subscription.billingPeriodEnd) > new Date());

  return (
    <div className="space-y-6">
      <PlanUsageCard
        workspace={workspace}
        onUpgrade={workspace?.subscription?.stripeSubscriptionId ? handlePortalSession : undefined}
        isProcessing={isProcessing}
      />

      <div>
        <h3 className="text-[16px] font-semibold mb-4">Billing & subscription</h3>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-medium text-[color:var(--foreground)]">{getPlanDisplayName(workspace)}</p>
                <p className="text-[12px] text-[color:var(--muted-foreground)]">Status + limits pulled directly from the api.</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1">Status</p>
                <p className="text-[13px] font-medium text-[color:var(--foreground)]">
                  {subscription?.status || 'NO SUBSCRIPTION'}
                </p>
              </div>
            </div>
            <div className="text-[12px] text-[color:var(--muted-foreground)] space-y-1">
              {latestDayCredit && (
                <p>
                  • <strong className="text-[color:var(--foreground)]">Day credits:</strong> {latestDayCredit.used}/{latestDayCredit.totalCredits} days used this period
                  <span className="block text-[11px] text-[color:var(--muted-foreground)] ml-4">You burn 1 day credit per calendar day while your subscription is active</span>
                </p>
              )}
              {/* Composer credits are effectively unlimited for the client UI */}
              <p>• Composer credits: <strong className="text-[color:var(--foreground)]">Unlimited</strong> through the AI Composer</p>
              {workspace?.effectiveActiveTaskLimit && <p>• {workspace.effectiveActiveTaskLimit} active task slots</p>}
              <p>• {slaHours}-hour SLA per active slot</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Section - Show if active subscription */}
      {hasActiveSubscription && isActive && (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Upgrade Options</p>
            <p className="text-[12px] text-[color:var(--muted-foreground)]">Upgrade to a higher tier plan for more features.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {PLANS.filter(p => {
              // Filter to show only upgrade options based on current plan
              const currentPlanCode = subscription?.planCode;

              // If on CORE, show OPS and ENTERPRISE as upgrade options
              if (currentPlanCode === 'CORE') {
                return ['ops', 'enterprise'].includes(p.id);
              }
              // If on OPS, show Enterprise only
              if (currentPlanCode === 'OPS') {
                return p.id === 'enterprise';
              }
              // If on Enterprise, no upgrades
              return false;
            }).map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] flex flex-col gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--foreground)]">{p.name}</p>
                  <p className="text-[12px] text-[color:var(--muted-foreground)]">${p.priceMonthly / 100} / mo</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">{p.description}</p>
                </div>
                <button
                  onClick={() => handleUpgrade((p as any).planCode, 'MONTHLY')}
                  disabled={isProcessing}
                  className="mt-auto inline-flex items-center justify-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] font-medium hover:bg-[color:var(--primary)]/90 transition disabled:opacity-50"
                >
                  Upgrade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscribe Section - shown if no subscription, canceled, or past_due */}
      {(!subscription || isCanceled || isPastDue) && (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Available Plans</p>
            <p className="text-[12px] text-[color:var(--muted-foreground)]">Upgrade your workspace to start creating tasks.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] flex flex-col gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--foreground)]">{p.name}</p>
                  <p className="text-[12px] text-[color:var(--muted-foreground)]">${p.priceMonthly / 100} / mo</p>
                </div>
                <button
                  onClick={() => handleSubscribe((p as any).planCode, 'MONTHLY')}
                  disabled={isProcessing}
                  className="mt-auto inline-flex items-center justify-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] font-medium hover:bg-[color:var(--primary)]/90 transition disabled:opacity-50"
                >
                  Subscribe
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pause Status - show when subscription is paused */}
      {subscription && isPaused && (
        <PauseStatus subscription={subscription} isPaused={isPaused} />
      )}

      {/* Subscription controls - pause/resume/cancel */}
      {subscription && !isPastDue && (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">subscription controls</p>
            <p className="text-[12px] text-[color:var(--muted-foreground)]">these buttons call the same pause / resume / cancel endpoints available in the api.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {/* Portal Button */}
            <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] space-y-3">
              <div>
                <p className="text-[13px] font-medium text-[color:var(--foreground)]">billing portal</p>
                <p className="text-[12px] text-[color:var(--muted-foreground)]">
                  update payment methods, download invoices, and view billing history.
                </p>
              </div>
              <button
                onClick={handlePortalSession}
                disabled={isProcessing || !workspace?.subscription?.stripeSubscriptionId}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Manage Subscription'}
              </button>
            </div>

            {/* Pause/Resume */}
            {!isCanceled && (
              <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--foreground)]">{isPaused ? 'resume subscription' : 'pause subscription'}</p>
                  <p className="text-[12px] text-[color:var(--muted-foreground)]">
                    {isPaused
                      ? 'resuming restarts day credit burn and opens your active slot again.'
                      : 'pausing halts day credit burn and freezes active work until you resume.'}
                  </p>
                </div>
                <button
                  onClick={isPaused ? handleResumeSubscription : handlePauseSubscription}
                  disabled={isProcessing}
                  className={`inline-flex items-center justify-center px-4 py-2 rounded-full text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed ${isPaused
                    ? 'border border-[color:var(--primary)]/40 bg-[color:var(--accent)] text-[color:var(--accent-foreground)] hover:bg-[color:var(--accent)]/80'
                    : 'border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
                    }`}
                >
                  {isProcessing ? 'Processing...' : isPaused ? 'Resume subscription' : 'Pause subscription'}
                </button>
              </div>
            )}

            {/* Cancel / Uncancel */}
            <div className="p-4 rounded-xl border border-[color:var(--destructive)]/20 bg-[color:var(--destructive)]/5 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-[color:var(--destructive)]">
                  {isCancelAtPeriodEnd ? 'keep subscription' : 'cancel subscription'}
                </p>
                <p className="text-[12px] text-[color:var(--destructive)]/80">
                  {isCancelAtPeriodEnd
                    ? 'you have already scheduled cancellation. click below to keep your subscription and continue automatic renewals.'
                    : 'cancelling stops future billing. you keep any remaining day credits until the current period ends, but new tasks won’t auto-start.'}
                </p>
              </div>
              {isCanceled ? (
                <p className="text-[12px] text-[color:var(--destructive)]/70">subscription already canceled.</p>
              ) : (
                <button
                  onClick={isCancelAtPeriodEnd ? handleUncancelSubscription : handleCancelSubscription}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-[color:var(--destructive)]/30 bg-[color:var(--destructive)]/10 text-[13px] text-[color:var(--destructive)] hover:bg-[color:var(--destructive)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing
                    ? 'Processing...'
                    : isCancelAtPeriodEnd
                      ? "Don't cancel"
                      : 'Cancel subscription'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PlanUsageCard: React.FC<{
  workspace: Workspace | null;
  onUpgrade?: () => void;
  isProcessing: boolean;
}> = ({ workspace, onUpgrade, isProcessing }) => {
  if (!workspace) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading plan usage…</p>
      </div>
    );
  }

  const planName = getPlanDisplayName(workspace);
  const planDescription = getPlanDescription(workspace);
  const activeLimit = workspace.effectiveActiveTaskLimit ?? workspace.plan?.activeTaskLimit ?? 0;
  const activeCount = workspace.taskCounts?.inProgress ?? 0;
  const slaHours = workspace.effectiveSlaSeconds
    ? Math.round(workspace.effectiveSlaSeconds / 3600)
    : 48;

  const aiTotal = workspace.aiCredit?.totalCredits ?? 0;
  const aiUsed = workspace.aiCredit?.usedCredits ?? 0;
  const aiRemaining = Math.max(0, aiTotal - aiUsed);

  const dayTotal = workspace.dayCredit?.totalCredits ?? 0;
  const dayUsed = workspace.dayCredit?.usedCredits ?? 0;
  const dayRemaining = Math.max(0, dayTotal - dayUsed);

  const handleUpgradeClick = () => {
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = 'mailto:team@sako.design?subject=Sako%20plan%20upgrade';
    }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            Plan & usage
          </p>
          <p className="text-[16px] font-semibold text-[color:var(--foreground)]">{planName}</p>
          <p className="text-[12px] text-[color:var(--muted-foreground)]">{planDescription}</p>
        </div>
        <button
          onClick={handleUpgradeClick}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] text-[12px] font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {onUpgrade ? 'Manage or upgrade' : 'Contact Sako'}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Active tasks</p>
          <p className="text-[20px] font-semibold text-[color:var(--foreground)]">{activeCount} / {activeLimit}</p>
          <p className="text-[12px] text-[color:var(--muted-foreground)]">Standard SLA {slaHours}h</p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Composer credits</p>
          <p className="text-[20px] font-semibold text-[color:var(--foreground)]">Unlimited</p>
          <p className="text-[12px] text-[color:var(--muted-foreground)]">Included with your plan via Composer AI</p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Day credits</p>
          <p className="text-[20px] font-semibold text-[color:var(--foreground)]">{dayRemaining} / {dayTotal}</p>
          <p className="text-[12px] text-[color:var(--muted-foreground)]">{dayUsed} burned this period</p>
        </div>
      </div>
    </div>
  );
};

const getPlanDescription = (workspace: Workspace | null) => {
  if (!workspace) return 'Plan details are loading';
  const planCode = workspace.plan?.code || workspace.subscription?.planCode;
  if (planCode === 'CORE') {
    return '1 active task slot · design + motion scope';
  }
  if (planCode === 'OPS') {
    return '2 active tasks · full-scope ops plan';
  }
  if (planCode === 'ENTERPRISE') {
    return 'Custom enterprise limits pulled from your contract';
  }
  return workspace.plan?.name || 'Custom workspace configuration';
};

const IntegrationsTab: React.FC<{ workspace: any; loading: boolean }> = ({ workspace, loading }) => {
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Slack integration state
  const [slackStatus, setSlackStatus] = React.useState<{
    connected: boolean;
    teamName?: string;
    defaultChannelId?: string;
    defaultChannelName?: string;
  } | null>(null);

  const [channels, setChannels] = React.useState<Array<{
    id: string;
    name: string;
    isPrivate: boolean;
    isMember?: boolean;
  }>>([]);

  const [selectedChannelId, setSelectedChannelId] = React.useState<string>('');
  const [isLoadingChannels, setIsLoadingChannels] = React.useState(false);
  const [isSavingChannel, setIsSavingChannel] = React.useState(false);
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [slackError, setSlackError] = React.useState<string | null>(null);
  const [slackSuccess, setSlackSuccess] = React.useState<string | null>(null);
  const [channelsNextCursor, setChannelsNextCursor] = React.useState<string | undefined>(undefined);
  const [isChangingChannel, setIsChangingChannel] = React.useState(false);

  if (loading) {
    return <div className="text-[13px] text-[color:var(--muted-foreground)]">Loading...</div>;
  }

  // Load Slack status on mount and after OAuth redirect
  React.useEffect(() => {
    loadSlackStatus();

    // Check for OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    const slackParam = params.get('slack');
    if (slackParam === 'connected') {
      loadSlackStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (slackParam === 'error') {
      const reason = params.get('reason');
      setSlackError(getOAuthErrorMessage(reason));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadSlackStatus = async () => {
    try {
      const status = await getSlackStatus();
      setSlackStatus(status);

      // If connected but no channel, load channels list
      if (status.connected && !status.defaultChannelId) {
        loadChannels();
      }
    } catch (err) {
      console.error('Failed to load Slack status:', err);
    }
  };

  const handleConnectSlack = async () => {
    setIsProcessing(true);
    try {
      const { url } = await startSlackOAuth(workspace.id);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to start Slack OAuth:', error);
      setSlackError('Failed to connect Slack. Please try again.');
      setIsProcessing(false);
    }
  };

  const loadChannels = async (cursor?: string, append = false) => {
    setIsLoadingChannels(true);
    setSlackError(null);
    try {
      const result = await listSlackChannels({ cursor, limit: 100 });

      // Filter out archived channels
      const activeChannels = result.channels.filter(ch => !ch.isArchived);

      if (append) {
        setChannels(prev => [...prev, ...activeChannels]);
      } else {
        setChannels(activeChannels);
      }

      setChannelsNextCursor(result.nextCursor);
    } catch (err: any) {
      const apiError = err as ApiError;
      if (apiError.code === 'TOKEN_REVOKED' || apiError.code === 'NOT_AUTHED' || apiError.code === 'INVALID_AUTH') {
        setSlackError('Slack connection expired. Please reconnect.');
        setSlackStatus(prev => prev ? { ...prev, connected: false } : null);
      } else {
        setSlackError(apiError.message || 'Failed to load channels. Please try again.');
      }
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const handleSaveChannel = async () => {
    if (!selectedChannelId) return;

    setIsSavingChannel(true);
    setSlackError(null);
    setSlackSuccess(null);

    try {
      const result = await setSlackDefaultChannel(selectedChannelId);

      setSlackSuccess(`Notifications will be sent to #${result.channelName}`);

      // Refetch status to ensure state transitions correctly to State 2
      await loadSlackStatus();

      // Auto-send test message after save
      setTimeout(() => handleSendTest(), 1000);
    } catch (err: any) {
      const apiError = err as ApiError;
      switch (apiError.code) {
        case 'NOT_IN_CHANNEL':
          setSlackError('Invite @Sakobot to this channel first, then try again.');
          break;
        case 'MISSING_SCOPE':
          setSlackError('Slack permissions out of date. Please reconnect Slack (this will ask for updated permissions).');
          break;
        case 'CHANNEL_NOT_FOUND':
          setSlackError('Channel not found or not accessible. Please select a different channel.');
          break;
        case 'IS_ARCHIVED':
          setSlackError('Channel is archived. Please select an active channel.');
          break;
        default:
          setSlackError(apiError.message || 'Failed to save channel. Please try again.');
      }
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setSlackError(null);
    setSlackSuccess(null);

    try {
      await sendSlackTestMessage();
      setSlackSuccess('Test message sent! Check your Slack channel.');
    } catch (err: any) {
      const apiError = err as ApiError;
      switch (apiError.code) {
        case 'NOT_IN_CHANNEL':
          setSlackError('Invite @Sakobot to this channel using /invite @Sakobot');
          break;
        case 'CHANNEL_NOT_FOUND':
          setSlackError('Channel not found. Please select a different channel.');
          break;
        default:
          setSlackError(apiError.message || 'Failed to send test message.');
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleChangeChannel = () => {
    setIsChangingChannel(true);
    setSelectedChannelId('');
    // Don't clear backend state - just show picker again
  };

  const getOAuthErrorMessage = (reason?: string): string => {
    switch (reason) {
      case 'missing_scope':
        return 'Slack permissions out of date. Please reconnect Slack (this will ask for updated permissions).';
      case 'workspace_conflict':
        return 'This Slack workspace is already connected to another Sako workspace.';
      case 'invalid_workspace':
        return 'Invalid workspace. Please try again.';
      default:
        return 'Failed to connect Slack. Please try again.';
    }
  };

  const handleLoadMoreChannels = () => {
    if (channelsNextCursor) {
      loadChannels(channelsNextCursor, true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[16px] font-semibold mb-4 text-foreground">Integrations</h3>

        <div className="space-y-4">
          {/* Slack Integration Card */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent border border-border flex items-center justify-center">
                  <Icon name="message-circle" className="w-6 h-6 text-[color:#4A154B]" />
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-foreground flex items-center gap-2">
                    Slack
                    {slackStatus?.connected && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                        Connected
                      </span>
                    )}
                  </h4>
                  {slackStatus?.teamName && (
                    <p className="text-[12px] text-muted-foreground">
                      Connected to {slackStatus.teamName}
                    </p>
                  )}
                  {!slackStatus?.connected && (
                    <p className="text-[12px] text-muted-foreground">
                      Connect your workspace to receive task updates in Slack channels.
                    </p>
                  )}
                </div>
              </div>

              {!slackStatus?.connected && (
                <button
                  onClick={handleConnectSlack}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-[12px] font-medium rounded-full bg-secondary text-secondary-foreground hover:opacity-90 transition disabled:opacity-70"
                >
                  {isProcessing ? 'Connecting…' : 'Connect Slack'}
                </button>
              )}
            </div>

            {/* State 1: Connected but no channel configured OR changing channel */}
            {(slackStatus?.connected && (!slackStatus.defaultChannelId || isChangingChannel)) && (
              <div className="space-y-3">
                {/* Warning Banner */}
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-2">
                    <Icon name="alert-triangle" className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-medium text-yellow-900 dark:text-yellow-200">
                        Pick a channel to activate notifications
                      </p>
                      <p className="text-[11px] text-yellow-700 dark:text-yellow-300 mt-1">
                        Slack is connected but notifications won't be sent until you choose a channel.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Channel Picker */}
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-foreground">
                    Choose notification channel
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedChannelId}
                      onChange={(e) => setSelectedChannelId(e.target.value)}
                      disabled={isLoadingChannels}
                      className="flex-1 px-3 py-2 text-[12px] rounded-lg border border-border bg-background text-foreground disabled:opacity-50"
                    >
                      <option value="">Select a channel...</option>
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          #{ch.name} {ch.isPrivate ? '(Private)' : ''} {ch.isMember === false ? '(Invite bot)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => loadChannels()}
                      disabled={isLoadingChannels}
                      className="px-3 py-2 text-[12px] rounded-lg border border-border bg-background hover:bg-accent transition disabled:opacity-50"
                    >
                      {isLoadingChannels ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                  {/* Helper Text */}
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      Recommended: Create #sako-notifs in Slack, then refresh this list
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Private channels only appear after you invite @Sakobot to them
                    </p>
                  </div>

                  {/* Load More Button */}
                  {channelsNextCursor && (
                    <button
                      onClick={handleLoadMoreChannels}
                      disabled={isLoadingChannels}
                      className="w-full px-3 py-2 text-[11px] font-medium rounded-lg border border-border bg-background hover:bg-accent transition disabled:opacity-50"
                    >
                      {isLoadingChannels ? 'Loading...' : 'Load More Channels'}
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveChannel}
                    disabled={!selectedChannelId || isSavingChannel}
                    className="px-4 py-2 text-[12px] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingChannel ? 'Saving...' : 'Save Channel'}
                  </button>
                  {isChangingChannel && (
                    <button
                      onClick={() => {
                        setIsChangingChannel(false);
                        setSelectedChannelId('');
                      }}
                      className="px-4 py-2 text-[12px] font-medium rounded-lg border border-border bg-background hover:bg-accent transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* State 2: Connected + Configured */}
            {slackStatus?.connected && slackStatus.defaultChannelId && (
              <div className="space-y-3">
                {/* Success State */}
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <Icon name="check-circle" className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <p className="text-[12px] font-medium text-green-900 dark:text-green-200">
                      Posting notifications to #{slackStatus.defaultChannelName || 'channel'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleChangeChannel}
                    className="px-4 py-2 text-[12px] font-medium rounded-lg border border-border bg-background hover:bg-accent transition"
                  >
                    Change Channel
                  </button>
                  <button
                    onClick={handleSendTest}
                    disabled={isSendingTest}
                    className="px-4 py-2 text-[12px] font-medium rounded-lg border border-border bg-background hover:bg-accent transition disabled:opacity-50"
                  >
                    {isSendingTest ? 'Sending...' : 'Send Test Message'}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {slackError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-2">
                  <Icon name="alert-circle" className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-red-900 dark:text-red-200">{slackError}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {slackSuccess && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <Icon name="check-circle" className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-[12px] text-green-900 dark:text-green-200">{slackSuccess}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

  );
};
