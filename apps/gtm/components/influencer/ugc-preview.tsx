'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  Copy,
  Download,
  Share2,
  ThumbsUp,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Music2,
  Volume2,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { UGCGenerationResult, UGCFormat } from '@/lib/assets/influencer-generator'

interface UGCPreviewProps {
  result: UGCGenerationResult
  onCopy: (text: string) => void
}

export function UGCPreview({ result, onCopy }: UGCPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Phone Mockup Preview */}
      <div className="flex justify-center">
        <PhoneMockup
          platform={result.platform}
          format={result.format}
          isPlaying={isPlaying}
          onPlayToggle={() => setIsPlaying(!isPlaying)}
        />
      </div>

      {/* Content Details */}
      <div className="space-y-4">
        <Tabs defaultValue="script">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
            <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          </TabsList>

          <TabsContent value="script" className="mt-4">
            <ScriptPreview
              format={result.format}
              script={result.script}
              onCopy={onCopy}
            />
          </TabsContent>

          <TabsContent value="tips" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Posting Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.postingTips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5 shrink-0">
                      {idx + 1}
                    </Badge>
                    <p className="text-sm">{tip}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Music2 className="h-4 w-4" />
                  Sound Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.soundSuggestions.map((sound, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{sound}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hashtags" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Hashtags</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopy(result.hashtags.map((h) => `#${h}`).join(' '))}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.hashtags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary/20"
                      onClick={() => onCopy(`#${tag}`)}
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Alternative Hooks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.hooks.map((hook, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <p className="text-sm">{hook}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopy(hook)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Duration Badge */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">
            Estimated duration: ~{result.estimatedDuration} seconds
          </span>
        </div>
      </div>
    </div>
  )
}

interface PhoneMockupProps {
  platform: string
  format: UGCFormat
  isPlaying: boolean
  onPlayToggle: () => void
}

function PhoneMockup({ platform, format, isPlaying, onPlayToggle }: PhoneMockupProps) {
  const isTikTok = platform === 'tiktok'
  const isReels = platform === 'instagram_reels'
  const isStories = platform === 'instagram_stories'

  return (
    <div className="relative">
      {/* Phone Frame */}
      <div className="w-[280px] h-[560px] bg-black rounded-[40px] p-3 shadow-2xl">
        <div className="w-full h-full bg-gradient-to-b from-gray-900 to-gray-800 rounded-[32px] overflow-hidden relative">
          {/* Status Bar */}
          <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center z-10">
            <div className="w-20 h-5 bg-black rounded-full" />
          </div>

          {/* Content Area */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
              transition={{ repeat: isPlaying ? Infinity : 0, duration: 2 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-4 mx-auto">
                {isPlaying ? (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-card rounded"
                        animate={{ height: [8, 20, 8] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.5,
                          delay: i * 0.1,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Play className="h-8 w-8 text-white ml-1" />
                )}
              </div>
              <p className="text-white/60 text-sm">
                {format.replace('_', ' ')} preview
              </p>
            </motion.div>
          </div>

          {/* Platform UI Overlay */}
          {isTikTok && <TikTokOverlay />}
          {isReels && <ReelsOverlay />}
          {isStories && <StoriesOverlay />}

          {/* Play Button Overlay */}
          <button
            className="absolute inset-0 z-20 flex items-center justify-center"
            onClick={onPlayToggle}
          >
            <span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
        </div>
      </div>

      {/* Platform Badge */}
      <Badge className="absolute -top-2 -right-2 capitalize">
        {platform.replace('_', ' ')}
      </Badge>
    </div>
  )
}

function TikTokOverlay() {
  return (
    <>
      {/* Right Side Actions */}
      <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
        {[
          { icon: ThumbsUp, label: '42.3K' },
          { icon: MessageCircle, label: '892' },
          { icon: Bookmark, label: '1.2K' },
          { icon: Share2, label: 'Share' },
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-card/10 flex items-center justify-center">
              <item.icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-xs mt-1">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom Info */}
      <div className="absolute left-3 right-16 bottom-4 z-10">
        <p className="text-white font-semibold text-sm">@creator_name</p>
        <p className="text-white/80 text-xs mt-1 line-clamp-2">
          This is where the caption goes... #fyp #viral
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Music2 className="h-3 w-3 text-white" />
          <p className="text-white/60 text-xs">Original sound - creator</p>
        </div>
      </div>
    </>
  )
}

function ReelsOverlay() {
  return (
    <>
      {/* Right Side Actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
        {[ThumbsUp, MessageCircle, Send, Bookmark, MoreHorizontal].map(
          (Icon, idx) => (
            <div
              key={idx}
              className="w-8 h-8 flex items-center justify-center"
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
          )
        )}
      </div>

      {/* Bottom Info */}
      <div className="absolute left-3 right-16 bottom-4 z-10">
        <p className="text-white font-semibold text-sm">creator_name</p>
        <p className="text-white/80 text-xs mt-1 line-clamp-2">
          Caption text here...
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Music2 className="h-3 w-3 text-white" />
          <p className="text-white/60 text-xs truncate">Audio name</p>
        </div>
      </div>
    </>
  )
}

function StoriesOverlay() {
  return (
    <>
      {/* Progress Bar */}
      <div className="absolute top-10 left-2 right-2 flex gap-1 z-10">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-0.5 flex-1 rounded-full',
              i === 1 ? 'bg-card' : 'bg-card/30'
            )}
          />
        ))}
      </div>

      {/* User Info */}
      <div className="absolute top-14 left-3 flex items-center gap-2 z-10">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50" />
        <span className="text-white text-sm font-medium">creator_name</span>
        <span className="text-white/60 text-xs">4h</span>
      </div>
    </>
  )
}

interface ScriptPreviewProps {
  format: UGCFormat
  script: UGCGenerationResult['script']
  onCopy: (text: string) => void
}

function ScriptPreview({ format, script, onCopy }: ScriptPreviewProps) {
  const getScriptText = (): string => {
    if ('hook' in script) {
      // Talking head
      const s = script as { hook: string; problem: string; solution: string; proof: string; cta: string }
      return `HOOK: ${s.hook}\n\nPROBLEM: ${s.problem}\n\nSOLUTION: ${s.solution}\n\nPROOF: ${s.proof}\n\nCTA: ${s.cta}`
    }
    if ('opener' in script) {
      // Product review
      const s = script as { opener: string; firstImpression: string; verdict: string; cta: string }
      return `OPENER: ${s.opener}\n\nFIRST IMPRESSION: ${s.firstImpression}\n\nVERDICT: ${s.verdict}\n\nCTA: ${s.cta}`
    }
    if ('slides' in script) {
      // Carousel
      const s = script as { slides: Array<{ slideNumber: number; headline: string; body: string }>; caption: string }
      return s.slides.map((slide) => `SLIDE ${slide.slideNumber}:\n${slide.headline}\n${slide.body}`).join('\n\n') + `\n\nCAPTION: ${s.caption}`
    }
    return JSON.stringify(script, null, 2)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Script</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onCopy(getScriptText())}>
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4 pr-4">
            {'hook' in script && (
              <>
                <ScriptSection title="HOOK (0-3s)" content={(script as { hook: string }).hook} highlight />
                <ScriptSection title="Problem" content={(script as { problem: string }).problem} />
                <ScriptSection title="Solution" content={(script as { solution: string }).solution} />
                <ScriptSection title="Proof" content={(script as { proof: string }).proof} />
                <ScriptSection title="CTA" content={(script as { cta: string }).cta} highlight />
                {'visualCues' in script && (script as { visualCues: string[] }).visualCues.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      VISUAL CUES
                    </p>
                    <ul className="text-sm space-y-1">
                      {(script as { visualCues: string[] }).visualCues.map((cue, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {cue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {'opener' in script && (
              <>
                <ScriptSection title="Opener" content={(script as { opener: string }).opener} highlight />
                <ScriptSection title="First Impression" content={(script as { firstImpression: string }).firstImpression} />
                {'features' in script && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      FEATURES
                    </p>
                    {(script as { features: Array<{ feature: string; reaction: string }> }).features.map((f, i) => (
                      <div key={i} className="mb-2 p-2 bg-muted/50 rounded">
                        <p className="text-sm font-medium">{f.feature}</p>
                        <p className="text-sm text-muted-foreground">{f.reaction}</p>
                      </div>
                    ))}
                  </div>
                )}
                <ScriptSection title="Verdict" content={(script as { verdict: string }).verdict} />
                <ScriptSection title="CTA" content={(script as { cta: string }).cta} highlight />
              </>
            )}
            {'slides' in script && (
              <div className="space-y-3">
                {(script as { slides: Array<{ slideNumber: number; headline: string; body: string; visualDescription: string }> }).slides.map((slide) => (
                  <div key={slide.slideNumber} className="p-3 border rounded-lg">
                    <Badge variant="outline" className="mb-2">
                      Slide {slide.slideNumber}
                    </Badge>
                    <p className="font-medium text-sm">{slide.headline}</p>
                    <p className="text-sm text-muted-foreground mt-1">{slide.body}</p>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Visual: {slide.visualDescription}
                    </p>
                  </div>
                ))}
                <ScriptSection title="Caption" content={(script as { caption: string }).caption} />
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function ScriptSection({
  title,
  content,
  highlight,
}: {
  title: string
  content: string
  highlight?: boolean
}) {
  return (
    <div className={cn(highlight && 'p-2 bg-primary/5 rounded-lg border border-primary/20')}>
      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">
        {title}
      </p>
      <p className="text-sm">{content}</p>
    </div>
  )
}
