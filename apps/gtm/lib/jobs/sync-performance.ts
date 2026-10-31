import { schedules } from "@trigger.dev/sdk/v3";
import { createServiceClient } from "@/lib/supabase/service";
import { getProvider } from "@/lib/providers/registry";
import type { ProviderType } from "@/lib/providers/types";
import { recordClaimImpression, recordClaimConversion } from "@/lib/learning/claim-performance";
import { Database } from '@/lib/supabase/types'

type DeploymentRow = Database['public']['Tables']['deployments']['Row']
type PerformanceRow = Database['public']['Tables']['performance']['Row']
type AngleRow = Database['public']['Tables']['angles']['Row']

/**
 * Scheduled job to sync performance metrics from deployed campaigns
 * Runs every hour to pull fresh data and update the learning loop
 */
export const syncPerformanceTask = schedules.task({
  id: "sync-performance",
  // Run every hour
  cron: "0 * * * *",
  run: async (payload, { ctx }) => {
    const supabase = createServiceClient();
    
    console.log(`[Job ${ctx.run.id}] Starting performance sync at ${payload.timestamp}`);

    // Get all active deployments from the last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: deployments, error } = await supabase
      .from('deployments')
      .select(`
        id,
        campaign_id,
        angle_id,
        status,
        hubspot_result,
        campaigns (
          id,
          name,
          workspace_id
        )
      `)
      .eq("status", "success")
      .gte("created_at", ninetyDaysAgo);

    if (error) {
      console.error(`[Job ${ctx.run.id}] Failed to fetch deployments:`, error);
      throw new Error(`Failed to fetch deployments: ${error.message}`);
    }

    console.log(`[Job ${ctx.run.id}] Found ${deployments?.length || 0} active deployments`);

    const syncResults: Array<{
      campaignId: string;
      success: boolean;
      metrics?: any;
      error?: string;
    }> = [];

    for (const deployment of deployments || []) {
      const campaign = deployment.campaigns as any;
      if (!campaign) continue;

      try {
        // Get HubSpot provider (or whichever was used)
        const provider = getProvider("hubspot" as ProviderType);
        if (!provider?.getPerformance) continue;

        // Check if provider is connected
        const isConnected = await provider.isConnected(campaign.workspace_id);
        if (!isConnected) {
          console.log(`[Job ${ctx.run.id}] HubSpot not connected for workspace ${campaign.workspace_id}`);
          continue;
        }

        // Get form ID from deployment result
        const hubspotResult = deployment.hubspot_result as Record<string, any>;
        const formId = hubspotResult?.form?.externalId;

        if (!formId) {
          console.log(`[Job ${ctx.run.id}] No form ID found for deployment ${deployment.id}`);
          continue;
        }

        // Fetch performance metrics
        const metrics = await provider.getPerformance(campaign.id);

        if (!metrics) {
          console.log(`[Job ${ctx.run.id}] No metrics returned for campaign ${campaign.id}`);
          continue;
        }

        // Save performance snapshot
        await supabase.from('performance').insert({
          campaign_id: campaign.id,
          deployment_id: deployment.id,
          captured_at: new Date().toISOString(),
          metrics: {
            pageViews: metrics.pageViews || 0,
            formSubmissions: metrics.formSubmissions || 0,
            conversionRate: metrics.formConversionRate || 0,
            contactsCreated: metrics.contactsCreated || 0,
          },
          notes: {
            source: "sync_job",
            syncedAt: new Date().toISOString(),
          },
        });

        // Update learning loop - record performance for claims used in this campaign
        if (deployment.angle_id) {
          const { data: angle } = await supabase
            .from('angles')
            .select("headline, subheadline, benefits")
            .eq("id", deployment.angle_id)
            .maybeSingle();

          if (angle) {
            // Record impressions and conversions for headline
            if (angle.headline) {
              await recordClaimImpression(
                angle.headline,
                campaign.id,
                campaign.workspace_id
              );
              
              // Record conversions proportionally
              const conversionRatio = (metrics.formConversionRate || 0) / 100;
              if (Math.random() < conversionRatio) {
                await recordClaimConversion(
                  angle.headline,
                  campaign.id,
                  campaign.workspace_id
                );
              }
            }

            // Record for benefits
            const benefits = angle.benefits as string[] || [];
            for (const benefit of benefits) {
              await recordClaimImpression(benefit, campaign.id, campaign.workspace_id);
              
              const conversionRatio = (metrics.formConversionRate || 0) / 100;
              if (Math.random() < conversionRatio) {
                await recordClaimConversion(benefit, campaign.id, campaign.workspace_id);
              }
            }
          }
        }

        syncResults.push({
          campaignId: campaign.id,
          success: true,
          metrics: {
            pageViews: metrics.pageViews || 0,
            formSubmissions: metrics.formSubmissions || 0,
            conversionRate: metrics.formConversionRate || 0,
          },
        });

        console.log(`[Job ${ctx.run.id}] Synced performance for campaign ${campaign.id}: ${metrics.formSubmissions || 0} form submissions`);
      } catch (err: any) {
        console.error(`[Job ${ctx.run.id}] Failed to sync campaign ${campaign.id}:`, err.message);
        syncResults.push({
          campaignId: campaign.id,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`[Job ${ctx.run.id}] Performance sync complete. Synced ${syncResults.filter(r => r.success).length}/${syncResults.length} campaigns`);

    return {
      syncedAt: new Date().toISOString(),
      results: syncResults,
      successCount: syncResults.filter(r => r.success).length,
      errorCount: syncResults.filter(r => !r.success).length,
    };
  },
});
