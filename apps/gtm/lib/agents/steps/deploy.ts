import { createServiceClient } from '@/lib/supabase/service'
import { getProvider } from '@/lib/providers/registry'
import type { AgentState, StepResult, DeployResult } from '../state'

export async function deployStep(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now()

  if (!state.campaign || !state.pageBlocks) {
    return {
      currentStep: 'error',
      error: 'Missing campaign or page data for deployment',
    }
  }

  const supabase = createServiceClient()
  const providerId = state.targetProvider || 'hubspot'

  try {
    // First, save the campaign to database
    const { data: savedCampaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: state.workspaceId,
        name: state.campaign.name,
        audience: state.campaign.audience,
        goal: state.campaign.goal,
        offer: state.campaign.offer,
        cta: state.campaign.cta,
        status: 'deploying',
      })
      .select()
      .single()

    if (campaignError || !savedCampaign) {
      throw new Error(`Failed to save campaign: ${campaignError?.message}`)
    }

    // Save page blocks
    const blocksToSave = state.pageBlocks.map((block, index) => ({
      campaign_id: savedCampaign.id,
      order: index,
      type: block.type,
      props: block.props,
    }))

    const { error: blocksError } = await supabase.from('page_blocks').insert(blocksToSave)

    if (blocksError) {
      console.error('Failed to save page blocks:', blocksError)
    }

    // Save angles if generated
    if (state.angles && state.angles.length > 0) {
      const anglesToSave = state.angles.map((angle, index) => ({
        campaign_id: savedCampaign.id,
        name: angle.name,
        description: angle.description,
        rank: index,
        trust_score: angle.trust_score,
        payload: angle.payload,
      }))

      const { error: anglesError } = await supabase.from('angles').insert(anglesToSave)

      if (anglesError) {
        console.error('Failed to save angles:', anglesError)
      }

      // Update selected angle
      if (state.selectedAngle) {
        const savedAngle = anglesToSave.find((a) => a.name === state.selectedAngle?.name)
        if (savedAngle) {
          await supabase
            .from('campaigns')
            .update({ selected_angle_id: savedAngle.name })
            .eq('id', savedCampaign.id)
        }
      }
    }

    // Deploy to provider
    const provider = getProvider(providerId as any)
    let deploymentResult: DeployResult

    if (!provider) {
      deploymentResult = {
        success: false,
        provider: providerId,
        error: `Provider ${providerId} not found`,
      }
    } else {
      const isConnected = await provider.isConnected(state.workspaceId)

      if (!isConnected) {
        deploymentResult = {
          success: false,
          provider: providerId,
          error: `${provider.name} is not connected. Please connect it in Settings.`,
        }
      } else if (!provider.deployPage) {
        deploymentResult = {
          success: false,
          provider: providerId,
          error: `${provider.name} does not support page deployment.`,
        }
      } else {
        try {
          // Convert page blocks to HTML (simplified)
          const html = `<!-- Campaign: ${savedCampaign.name} -->`

          const result = await provider.deployPage(html, {
            name: savedCampaign.name,
            slug: savedCampaign.name.toLowerCase().replace(/\s+/g, '-'),
            workspaceId: state.workspaceId,
            campaignId: savedCampaign.id,
            seoTitle: savedCampaign.name,
            seoDescription: savedCampaign.audience || '',
          })

          deploymentResult = {
            success: result.success,
            provider: providerId,
            liveUrl: result.url,
            deploymentId: result.externalId,
            error: result.error,
          }

          // Update campaign status
          await supabase
            .from('campaigns')
            .update({
              status: result.success ? 'deployed' : 'draft',
              deployed_url: result.url,
            })
            .eq('id', savedCampaign.id)

          // Record deployment
          if (result.success) {
            await supabase.from('deployments').insert({
              campaign_id: savedCampaign.id,
              workspace_id: state.workspaceId,
              provider: providerId,
              status: 'success',
              result: result,
            })
          }
        } catch (deployError) {
          deploymentResult = {
            success: false,
            provider: providerId,
            error: deployError instanceof Error ? deployError.message : 'Deployment failed',
          }
        }
      }
    }

    const stepResult: StepResult = {
      step: 'deploy',
      result: deploymentResult,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    }

    return {
      deploymentResult,
      liveUrl: deploymentResult.liveUrl,
      currentStep: deploymentResult.success ? 'complete' : 'error',
      error: deploymentResult.error,
      stepHistory: [...state.stepHistory, stepResult],
    }
  } catch (error) {
    return {
      currentStep: 'error',
      error: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stepHistory: [
        ...state.stepHistory,
        {
          step: 'deploy',
          result: { error: true },
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        },
      ],
    }
  }
}
