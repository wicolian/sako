
const IntegrationsTab: React.FC<{ workspace: any; loading: boolean }> = ({ workspace, loading }) => {
  if (loading) {
    return <div className="text-[13px] text-[color:var(--muted-foreground)]">Loading...</div>;
  }

  const slackIntegration = workspace?.slackIntegration;
  const apiUrl = API_BASE_URL; // Assuming this is available or imported from config

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[16px] font-semibold mb-4">Integrations</h3>
        <div className="space-y-4">
          
          {/* Slack Integration Card */}
          <div className="p-4 rounded-xl border border-[#e1eaef] bg-[#fafafa] flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Slack Logo placeholder or simple icon */}
              <div className="w-10 h-10 rounded-lg bg-white border border-[#e1eaef] flex items-center justify-center">
                <Icon name="message-circle" className="w-6 h-6 text-[#4A154B]" /> 
              </div>
              <div>
                <h4 className="text-[14px] font-medium text-[#1a1a1a] flex items-center gap-2">
                  Slack
                  {slackIntegration && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                      Connected
                    </span>
                  )}
                </h4>
                <p className="text-[12px] text-neutral-500">
                  {slackIntegration 
                    ? `Connected to team ID: ${slackIntegration.slackTeamId}` 
                    : 'Connect your workspace to receive task updates in Slack channels.'}
                </p>
              </div>
            </div>

            <div>
              {slackIntegration ? (
                <button disabled className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-neutral-100 text-neutral-500 cursor-not-allowed">
                  Connected
                </button>
              ) : (
                <a 
                  href={`${apiUrl}/integrations/slack/oauth/start?workspaceId=${workspace.id}`}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-[12px] font-medium rounded-md bg-[#4A154B] text-white hover:bg-[#3a113b] transition"
                >
                  Connect Slack
                </a>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

