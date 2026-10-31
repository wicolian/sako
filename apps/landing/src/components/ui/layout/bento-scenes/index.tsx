"use client";

import { lazy, Suspense } from "react";

// Scene imports - using dynamic imports for code splitting
const AdCreativeSetScene = lazy(() => import("./scenes/ad-creative-set").then(m => ({ default: m.AdCreativeSetScene })));
const SlaTimerScene = lazy(() => import("./scenes/sla-timer").then(m => ({ default: m.SlaTimerScene })));
const SlotsQueueScene = lazy(() => import("./scenes/slots-queue").then(m => ({ default: m.SlotsQueueScene })));
const FigmaLandingPageScene = lazy(() => import("./scenes/figma-landing-page").then(m => ({ default: m.FigmaLandingPageScene })));
const DeckRefreshScene = lazy(() => import("./scenes/deck-refresh").then(m => ({ default: m.DeckRefreshScene })));
const VideoCutdownScene = lazy(() => import("./scenes/video-cutdown").then(m => ({ default: m.VideoCutdownScene })));
const SocialSetScene = lazy(() => import("./scenes/social-set").then(m => ({ default: m.SocialSetScene })));
const ReadyScopeScene = lazy(() => import("./scenes/ready-scope").then(m => ({ default: m.ReadyScopeScene })));
const ReadyAssetsScene = lazy(() => import("./scenes/ready-assets").then(m => ({ default: m.ReadyAssetsScene })));
const ReadyOwnerScene = lazy(() => import("./scenes/ready-owner").then(m => ({ default: m.ReadyOwnerScene })));
const ReadyRevisionsScene = lazy(() => import("./scenes/ready-revisions").then(m => ({ default: m.ReadyRevisionsScene })));
const BrandProfilesScene = lazy(() => import("./scenes/brand-profiles").then(m => ({ default: m.BrandProfilesScene })));
const WebBuildScene = lazy(() => import("./scenes/web-build").then(m => ({ default: m.WebBuildScene })));
const BillingPanelScene = lazy(() => import("./scenes/billing-panel").then(m => ({ default: m.BillingPanelScene })));
const SlackDashHandoffScene = lazy(() => import("./scenes/slack-dash-handoff").then(m => ({ default: m.SlackDashHandoffScene })));
const SlaRemedyScene = lazy(() => import("./scenes/sla-remedy").then(m => ({ default: m.SlaRemedyScene })));

// Compare/In-House page scenes
const QueueRealityScene = lazy(() => import("./scenes/queue-reality").then(m => ({ default: m.QueueRealityScene })));
const TasksBounded48hScene = lazy(() => import("./scenes/tasks-bounded-48h").then(m => ({ default: m.TasksBounded48hScene })));
const MotionIncludedPipelineScene = lazy(() => import("./scenes/motion-included-pipeline").then(m => ({ default: m.MotionIncludedPipelineScene })));
const BrandConsistencySystemScene = lazy(() => import("./scenes/brand-consistency-system").then(m => ({ default: m.BrandConsistencySystemScene })));
const PauseAndBankScene = lazy(() => import("./scenes/pause-and-bank").then(m => ({ default: m.PauseAndBankScene })));
const InviteTeamScene = lazy(() => import("./scenes/invite-team").then(m => ({ default: m.InviteTeamScene })));

// Composer page scenes
const ComposerLaunchPageScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerLaunchPageScene })));
const ComposerFeatureShipScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerFeatureShipScene })));
const ComposerPLGPricingScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerPLGPricingScene })));
const ComposerFundraiseDeckScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerFundraiseDeckScene })));
const ComposerAdBundleScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerAdBundleScene })));
const ComposerExperimentPageScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerExperimentPageScene })));
const ComposerHTMLExportScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerHTMLExportScene })));
const ComposerImageExportScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerImageExportScene })));
const ComposerCopyToFigmaScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerCopyToFigmaScene })));
const ComposerPublishDomainScene = lazy(() => import("./scenes/composer-scenes").then(m => ({ default: m.ComposerPublishDomainScene })));

// Team pages scenes (founders, marketing-teams, slack)
const FoundersLaunchPagesScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.FoundersLaunchPagesScene })));
const FoundersInvestorDeckScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.FoundersInvestorDeckScene })));
const FoundersSalesCollateralScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.FoundersSalesCollateralScene })));
const FoundersLaunchPostsScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.FoundersLaunchPostsScene })));
const FoundersMotionCutdownsScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.FoundersMotionCutdownsScene })));
const FoundersWebsiteRefreshScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.FoundersWebsiteRefreshScene })));
const MarketingLandingPagesScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.MarketingLandingPagesScene })));
const MarketingCampaignKitScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.MarketingCampaignKitScene })));
const MarketingMotionVideoScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.MarketingMotionVideoScene })));
const MarketingLifecycleEmailScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.MarketingLifecycleEmailScene })));
const MarketingAdVariantsScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.MarketingAdVariantsScene })));
const SlackFounderApprovalsScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.SlackFounderApprovalsScene })));
const SlackMarketingFlowScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.SlackMarketingFlowScene })));
const SlackEnterpriseHygieneScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.SlackEnterpriseHygieneScene })));
const SlackNoSlackTeamsScene = lazy(() => import("./scenes/team-pages-scenes").then(m => ({ default: m.SlackNoSlackTeamsScene })));

// ROI and Growth teams scenes
const RoiTimeSavedScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.RoiTimeSavedScene })));
const RoiThroughputScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.RoiThroughputScene })));
const RoiCostDeltaScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.RoiCostDeltaScene })));
const RoiRiskRemovedScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.RoiRiskRemovedScene })));
const GrowthLPVariantsScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.GrowthLPVariantsScene })));
const GrowthAdSuitesScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.GrowthAdSuitesScene })));
const GrowthExperimentKitScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.GrowthExperimentKitScene })));
const GrowthMotionCutdownsScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.GrowthMotionCutdownsScene })));
const GrowthSalesEnablementScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.GrowthSalesEnablementScene })));
const GrowthLifecycleAssetsScene = lazy(() => import("./scenes/roi-scenes").then(m => ({ default: m.GrowthLifecycleAssetsScene })));

// Scene type for MDX pages
export type BentoSceneType = {
  type: "scene";
  id: SceneId;
  props?: Record<string, unknown>;
};

// Available scene IDs
export type SceneId =
  // Pricing: 48h standard tasks
  | "adCreativeSet"
  | "socialSet"
  | "deckRefresh"
  | "figmaLandingPage"
  | "videoCutdown"
  | "webBuild"
  // Pricing: When the 48h clock starts
  | "readyScope"
  | "readyAssets"
  | "readyOwner"
  | "readyRevisions"
  // Pricing: SLA and risk removal
  | "slaTimer"
  | "slaRemedy"
  | "slaCreditClaim"
  | "creditMeter"
  | "webBoundaries"
  // Product: Command center
  | "slotsQueue"
  | "taskTimers"
  | "versionsTimeline"
  | "billingPanel"
  // Product: Unlimited brands
  | "brandProfiles"
  | "brandAwareTask"
  | "voiceGuidance"
  | "referenceLibrary"
  // Composer & misc
  | "experimentVariant"
  | "exportHtml"
  | "exportImages"
  | "publishDomain"
  | "pauseBank"
  | "teamRoles"
  | "slackDashHandoff"
  // Compare/In-House page
  | "queueReality"
  | "tasksBounded48h"
  | "motionIncludedPipeline"
  | "brandConsistencySystem"
  | "pauseAndBank"
  | "inviteTeam"
  // Composer page - recipes
  | "composerLaunchPage"
  | "composerFeatureShip"
  | "composerPLGPricing"
  | "composerFundraiseDeck"
  | "composerAdBundle"
  | "composerExperimentPage"
  // Composer page - exports
  | "composerHTMLExport"
  | "composerImageExport"
  | "composerCopyToFigma"
  | "composerPublishDomain"
  // Founders page
  | "foundersLaunchPages"
  | "foundersInvestorDeck"
  | "foundersSalesCollateral"
  | "foundersLaunchPosts"
  | "foundersMotionCutdowns"
  | "foundersWebsiteRefresh"
  // Marketing teams page
  | "marketingLandingPages"
  | "marketingCampaignKit"
  | "marketingSalesCollateral"
  | "marketingMotionVideo"
  | "marketingLifecycleEmail"
  | "marketingAdVariants"
  // Slack page
  | "slackFounderApprovals"
  | "slackMarketingFlow"
  | "slackEnterpriseHygiene"
  | "slackNoSlackTeams"
  // Growth teams page
  | "growthLPVariants"
  | "growthAdSuites"
  | "growthExperimentKit"
  | "growthMotionCutdowns"
  | "growthSalesEnablement"
  | "growthLifecycleAssets"
  // ROI calculator page
  | "roiTimeSaved"
  | "roiThroughput"
  | "roiCostDelta"
  | "roiRiskRemoved";

// Scene loading placeholder
function SceneLoading() {
  return (
    <div className="w-full h-full min-h-[160px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
        <div className="w-16 h-2 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}

// Scene registry mapping IDs to components
const sceneRegistry: Record<SceneId, React.LazyExoticComponent<React.ComponentType>> = {
  // Implemented scenes
  adCreativeSet: AdCreativeSetScene,
  socialSet: SocialSetScene,
  deckRefresh: DeckRefreshScene,
  figmaLandingPage: FigmaLandingPageScene,
  videoCutdown: VideoCutdownScene,
  webBuild: WebBuildScene,
  readyScope: ReadyScopeScene,
  slaTimer: SlaTimerScene,
  slotsQueue: SlotsQueueScene,
  brandProfiles: BrandProfilesScene,
  billingPanel: BillingPanelScene,
  slackDashHandoff: SlackDashHandoffScene,
  
  // Ready rules scenes (distinct implementations)
  readyAssets: ReadyAssetsScene,
  readyOwner: ReadyOwnerScene,
  readyRevisions: ReadyRevisionsScene,
  slaRemedy: SlaRemedyScene, // Late -> Request credit -> Approval -> Credit applied
  slaCreditClaim: SlaRemedyScene, // Use dedicated remedy scene
  creditMeter: BillingPanelScene,
  webBoundaries: WebBuildScene,
  taskTimers: SlaTimerScene,
  versionsTimeline: DeckRefreshScene,
  brandAwareTask: BrandConsistencySystemScene,
  voiceGuidance: BrandProfilesScene,
  referenceLibrary: DeckRefreshScene,
  experimentVariant: AdCreativeSetScene,
  exportHtml: WebBuildScene,
  exportImages: AdCreativeSetScene,
  publishDomain: WebBuildScene,
  pauseBank: PauseAndBankScene,
  teamRoles: InviteTeamScene,
  
  // Compare/In-House page scenes
  queueReality: QueueRealityScene,
  tasksBounded48h: TasksBounded48hScene,
  motionIncludedPipeline: MotionIncludedPipelineScene,
  brandConsistencySystem: BrandConsistencySystemScene,
  pauseAndBank: PauseAndBankScene,
  inviteTeam: InviteTeamScene,
  
  // Composer page scenes
  composerLaunchPage: ComposerLaunchPageScene,
  composerFeatureShip: ComposerFeatureShipScene,
  composerPLGPricing: ComposerPLGPricingScene,
  composerFundraiseDeck: ComposerFundraiseDeckScene,
  composerAdBundle: ComposerAdBundleScene,
  composerExperimentPage: ComposerExperimentPageScene,
  composerHTMLExport: ComposerHTMLExportScene,
  composerImageExport: ComposerImageExportScene,
  composerCopyToFigma: ComposerCopyToFigmaScene,
  composerPublishDomain: ComposerPublishDomainScene,
  
  // Founders page scenes
  foundersLaunchPages: FoundersLaunchPagesScene,
  foundersInvestorDeck: FoundersInvestorDeckScene,
  foundersSalesCollateral: FoundersSalesCollateralScene,
  foundersLaunchPosts: FoundersLaunchPostsScene,
  foundersMotionCutdowns: FoundersMotionCutdownsScene,
  foundersWebsiteRefresh: FoundersWebsiteRefreshScene,
  
  // Marketing teams page scenes
  marketingLandingPages: MarketingLandingPagesScene,
  marketingCampaignKit: MarketingCampaignKitScene,
  marketingSalesCollateral: FoundersSalesCollateralScene, // Reuse
  marketingMotionVideo: MarketingMotionVideoScene,
  marketingLifecycleEmail: MarketingLifecycleEmailScene,
  marketingAdVariants: MarketingAdVariantsScene,
  
  // Slack page scenes
  slackFounderApprovals: SlackFounderApprovalsScene,
  slackMarketingFlow: SlackMarketingFlowScene,
  slackEnterpriseHygiene: SlackEnterpriseHygieneScene,
  slackNoSlackTeams: SlackNoSlackTeamsScene,
  
  // Growth teams page scenes
  growthLPVariants: GrowthLPVariantsScene,
  growthAdSuites: GrowthAdSuitesScene,
  growthExperimentKit: GrowthExperimentKitScene,
  growthMotionCutdowns: GrowthMotionCutdownsScene,
  growthSalesEnablement: GrowthSalesEnablementScene,
  growthLifecycleAssets: GrowthLifecycleAssetsScene,
  
  // ROI calculator page scenes
  roiTimeSaved: RoiTimeSavedScene,
  roiThroughput: RoiThroughputScene,
  roiCostDelta: RoiCostDeltaScene,
  roiRiskRemoved: RoiRiskRemovedScene,
};

/**
 * Main scene renderer component
 * Renders the appropriate scene based on ID with lazy loading
 */
export function BentoSceneRenderer({ 
  id, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  props 
}: { 
  id: SceneId; 
  props?: Record<string, unknown>;
}) {
  const SceneComponent = sceneRegistry[id];
  
  if (!SceneComponent) {
    console.warn(`Unknown scene ID: ${id}`);
    return <SceneLoading />;
  }

  return (
    <Suspense fallback={<SceneLoading />}>
      <SceneComponent />
    </Suspense>
  );
}

// Re-export scene components for direct imports if needed
export * from "./scene-layers";
export * from "./use-bento-motion";

