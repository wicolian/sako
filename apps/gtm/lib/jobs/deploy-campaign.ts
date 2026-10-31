import { task, retry } from "@trigger.dev/sdk/v3";
import { createServiceClient } from "@/lib/supabase/service";
import { getProvider } from "@/lib/providers/registry";
import type { ProviderType } from "@/lib/providers/types";
import { createHash } from "crypto";

export interface DeployCampaignPayload {
  campaignId: string;
  workspaceId: string;
  destination: ProviderType; // e.g., 'hubspot', 'webflow', 'figma'
  version: number;
}

export const deployCampaignTask = task({
  id: "deploy-campaign",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: DeployCampaignPayload, { ctx }) => {
    const { campaignId, workspaceId, destination, version } = payload;
    const supabase = createServiceClient();

    console.log(`[Job ${ctx.run.id}] Deploying campaign ${campaignId} to ${destination}`);

    // Generate idempotency key
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ campaignId, destination, version }))
      .digest("hex");
    const idempotencyKey = `${workspaceId}-${campaignId}-${version}-${destination}-${payloadHash.slice(0, 8)}`;

    // Check for existing successful deployment
    const { data: existingDeployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingDeployment?.status === "success") {
      console.log(`[Job ${ctx.run.id}] Campaign already deployed (idempotent)`);
      return {
        success: true,
        idempotent: true,
        deploymentId: existingDeployment.id,
      };
    }

    // Get campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Get provider
    const provider = getProvider(destination);
    if (!provider) {
      throw new Error(`Unknown deployment provider: ${destination}`);
    }

    // Check provider connection
    const isConnected = await provider.isConnected(workspaceId);
    if (!isConnected) {
      throw new Error(`${provider.name} not connected for workspace ${workspaceId}`);
    }

    // Create/update deployment record
    const { data: deployment, error: deployError } = await supabase
      .from("deployments")
      .upsert({
        campaign_id: campaignId,
        angle_id: campaign.selected_angle_id,
        idempotency_key: idempotencyKey,
        status: "in_progress",
      })
      .select()
      .single();

    if (deployError) {
      throw new Error(`Failed to create deployment record: ${deployError.message}`);
    }

    const deployResults: Record<string, any> = { errors: [] };

    // Deploy form if provider supports it
    if (provider.deployForm) {
      try {
        const formFields = [
          { name: "email", label: "Email", fieldType: "email", required: true, objectTypeId: "0-1", validation: { blockedEmailDomains: [], useDefaultBlockList: true } },
          { name: "firstname", label: "First Name", fieldType: "single_line_text", required: true, objectTypeId: "0-1", validation: {} },
          { name: "lastname", label: "Last Name", fieldType: "single_line_text", required: false, objectTypeId: "0-1", validation: {} },
          { name: "company", label: "Company", fieldType: "single_line_text", required: false, objectTypeId: "0-1", validation: {} },
          { 
            name: "sako_campaign_id", 
            label: "Sako Campaign ID", 
            fieldType: "hidden_field", 
            defaultValue: campaignId, 
            objectTypeId: "0-1", 
            validation: {} 
          },
        ];

        const formResult = await provider.deployForm(
          formFields as any, // FormField[] - simplified for compatibility
          {
            name: `${campaign.name} - Lead Capture`,
            campaignId,
            workspaceId,
          }
        );
        deployResults.form = formResult;
        if (!formResult.success) {
          deployResults.errors.push(`Form: ${formResult.error}`);
        }
      } catch (error: any) {
        console.error(`[Job ${ctx.run.id}] Form deployment failed:`, error.message);
        deployResults.errors.push(`Form: ${error.message}`);
      }
    }

    // Deploy page if provider supports it
    if (provider.deployPage) {
      try {
        const { data: blocks } = await supabase
          .from("page_blocks")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("order");

        const heroBlock = blocks?.find((b: any) => b.type === "hero");
        const htmlContent = generateLandingPageHtml(campaign, blocks || [], heroBlock);

        const pageMetadata = {
          name: `${campaign.name} Landing Page`,
          slug: campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          campaignId,
          workspaceId,
        };

        const pageResult = await provider.deployPage(htmlContent, pageMetadata);
        deployResults.page = pageResult;
        if (!pageResult.success) {
          deployResults.errors.push(`Page: ${pageResult.error}`);
        }
      } catch (error: any) {
        console.error(`[Job ${ctx.run.id}] Page deployment failed:`, error.message);
        deployResults.errors.push(`Page: ${error.message}`);
      }
    }

    // Determine final status
    const status = deployResults.errors.length === 0 ? "success" : "partial";

    // Update deployment record
    await supabase
      .from("deployments")
      .update({
        status,
        hubspot_result: deployResults,
      })
      .eq("id", deployment.id);

    // Update campaign status
    if (status === "success" || status === "partial") {
      await supabase
        .from("campaigns")
        .update({ status: "published" })
        .eq("id", campaignId);
    }

    console.log(`[Job ${ctx.run.id}] Deployment complete with status: ${status}`);

    return {
      success: status === "success",
      partial: status === "partial",
      deploymentId: deployment.id,
      results: deployResults,
    };
  },
});

function generateLandingPageHtml(campaign: any, blocks: any[], heroBlock: any): string {
  const heroProps = (heroBlock?.props as Record<string, unknown>) || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <title>${campaign.name}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .hero { padding: 80px 20px; text-align: center; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); }
    .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #1a1a1a; }
    .hero p { font-size: 1.25rem; color: #666; margin-bottom: 2rem; }
    .cta-button { background: #9ae83e; color: #1a1a1a; padding: 12px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; }
    .section { padding: 60px 20px; max-width: 1200px; margin: 0 auto; }
    .benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
    .benefit-card { padding: 2rem; border-radius: 12px; background: #f9f9f9; }
    .footer { padding: 40px 20px; text-align: center; background: #1a1a1a; color: #fff; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${heroProps.headline || campaign.name}</h1>
    <p>${heroProps.subheadline || campaign.goal}</p>
    <a href="#form" class="cta-button">${heroProps.cta_text || campaign.cta || "Get Started"}</a>
  </section>
  
  <section class="section">
    <div class="benefits">
      ${blocks
        .filter((b: any) => b.type === "benefits")
        .map((b: any) => {
          const props = b.props as Record<string, unknown>;
          return `
          <div class="benefit-card">
            <h3>${(props as any).title || "Benefit"}</h3>
            <p>${(props as any).description || ""}</p>
          </div>
        `;
        })
        .join("")}
    </div>
  </section>
  
  <section id="form" class="section">
    <div id="hubspot-form-container"></div>
  </section>
  
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} All rights reserved.</p>
  </footer>
</body>
</html>
  `.trim();
}
