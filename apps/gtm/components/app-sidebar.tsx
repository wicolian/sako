"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useUser, useClerk } from "@clerk/nextjs"
import {
  Layers,
  Settings,
  LogOut,
  Moon,
  Sun,
  Monitor,
  FileText,
  FileCheck,
  Globe,
  LayoutDashboard,
  Building2,
  BadgeCheck,
  FileSearch,
  ChevronDown,
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  TooltipProvider,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// Navigation structure - Jobs-to-be-Done organization
// Primary actions first, grouped by user intent not system architecture
interface NavItem {
  name: string
  href: string
  icon: typeof Globe
  highlight?: boolean
  description: string
  badge?: number
}

interface NavSection {
  label: string
  collapsed?: boolean
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: "Core flow",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, highlight: false, description: "See the next best step" },
      { name: "Import Brand", href: "/import", icon: Globe, highlight: true, description: "Turn a URL into brand context" },
      { name: "Campaigns", href: "/campaigns", icon: Layers, highlight: false, description: "Open generated assets and next actions" },
      { name: "Claims Review", href: "/claims", icon: FileSearch, highlight: false, description: "Review risky language before shipping" },
    ],
  },
  {
    label: "Ship",
    items: [
      { name: "Validator", href: "/gate", icon: BadgeCheck, highlight: false, description: "Check copy before export or deploy" },
      { name: "Settings", href: "/settings", icon: Settings, highlight: false, description: "Plans, connections, and API access" },
    ],
  },
  {
    label: "Library",
    collapsed: true,
    items: [
      { name: "Brands", href: "/brands", icon: Building2, highlight: false, description: "Manage imported brand profiles" },
      { name: "Evidence", href: "/evidence", icon: FileCheck, highlight: false, description: "Manage proof linked to claims" },
    ],
  },
]

function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const [workspace, setWorkspace] = useState<{ name: string } | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === "collapsed"

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch workspace name
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from("workspace_members")
          .select("workspaces(name)")
          .eq("user_id", user.id)
          .maybeSingle()

        const workspaceData = data as {
          workspaces: { name: string } | { name: string }[] | null
        } | null
        if (workspaceData?.workspaces) {
          const ws = Array.isArray(workspaceData.workspaces)
            ? workspaceData.workspaces[0]
            : workspaceData.workspaces
          if (ws?.name) {
            setWorkspace({ name: ws.name })
          }
        }
      } catch (error) {
        console.error('Failed to fetch workspace:', error)
      }
    }
    
    if (isLoaded && user) {
      fetchWorkspace()
    }
  }, [user, isLoaded])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      router.push("/login")
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setSigningOut(false)
    }
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href || pathname === "/"
    return pathname.startsWith(href)
  }

  // Get display name from Clerk user
  const displayName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "User"
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ""
  const userInitial = displayName.charAt(0).toUpperCase()

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark")
    else if (theme === "dark") setTheme("system")
    else setTheme("light")
  }

  const getThemeIcon = () => {
    if (!mounted) return Sun
    if (theme === "light") return Sun
    if (theme === "dark") return Moon
    return Monitor
  }
  const ThemeIcon = getThemeIcon()
  const themeLabel = mounted ? theme || "system" : "light"

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Header with Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {isCollapsed ? (
              <SidebarMenuButton
                size="lg"
                tooltip="Sako - Click to expand"
                onClick={toggleSidebar}
                className="w-full justify-center"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/40 backdrop-blur-sm">
                  <svg width="20" height="20" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M793.285 871.668C793.285 884.289 783.055 894.52 770.434 894.52H252.851C240.231 894.52 230 884.289 230 871.668L230 531.184V151.851C230 139.231 240.231 129 252.851 129H771.107C793.849 129 802.631 158.603 783.57 171.005L230 531.184H770.434C783.055 531.184 793.285 541.414 793.285 554.035V871.668Z" fill="#9AE83E"/>
                  </svg>
                </div>
              </SidebarMenuButton>
            ) : (
              <div className="flex w-full items-center justify-between gap-2">
                <SidebarMenuButton asChild size="lg" tooltip="Sako" className="flex-1">
                  <Link href="/dashboard" className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/40 backdrop-blur-sm">
                      <svg width="20" height="20" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M793.285 871.668C793.285 884.289 783.055 894.52 770.434 894.52H252.851C240.231 894.52 230 884.289 230 871.668L230 531.184V151.851C230 139.231 240.231 129 252.851 129H771.107C793.849 129 802.631 158.603 783.57 171.005L230 531.184H770.434C783.055 531.184 793.285 541.414 793.285 554.035V871.668Z" fill="#9AE83E"/>
                      </svg>
                    </div>
                    <span className="text-base font-semibold tracking-tight">Sako</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarTrigger className="h-8 w-8 shrink-0" />
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation Content - Progressive Disclosure */}
      <SidebarContent className="gap-1">
        {navSections.map((section, index) => (
          <CollapsibleNavSection
            key={section.label}
            section={section}
            isActive={isActive}
            defaultCollapsed={section.collapsed}
          />
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarSeparator />

        {/* Theme Toggle & Settings */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={cycleTheme}
              tooltip={`Theme: ${themeLabel}`}
              size="sm"
            >
              <ThemeIcon className="size-4" />
              <span className="capitalize">{themeLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip="Settings"
              size="sm"
            >
              <Link href="/settings">
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator />

        {/* User Menu */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip={displayName}
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.imageUrl} alt={displayName} />
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-muted-foreground">{workspace?.name || "Workspace"}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-lg" side="top" align="start" sideOffset={4}>
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={signingOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {signingOut ? "Signing out..." : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

// Collapsible section component for progressive disclosure
function CollapsibleNavSection({
  section,
  isActive,
  defaultCollapsed = false,
}: {
  section: (typeof navSections)[0]
  isActive: (href: string) => boolean
  defaultCollapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed)
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  // When sidebar is collapsed, show all items (tooltips handle the rest)
  if (isCollapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[11px] font-medium text-muted-foreground/60">
          {section.label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {section.items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  tooltip={item.description || item.name}
                  size="sm"
                  className={cn(
                    item.highlight && !isActive(item.href) && "bg-primary/10 text-primary hover:bg-primary/20",
                    item.highlight && isActive(item.href) && "bg-primary text-primary-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="text-[11px] font-medium text-muted-foreground/60 cursor-pointer hover:text-muted-foreground flex items-center justify-between pr-2">
            {section.label}
            <ChevronDown className={cn("size-3 transition-transform", !isOpen && "-rotate-90")} />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.description || item.name}
                    size="sm"
                    className={cn(
                      item.highlight && !isActive(item.href) && "bg-primary/10 text-primary hover:bg-primary/20",
                      item.highlight && isActive(item.href) && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

export function AppSidebar({ children }: { children?: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <SidebarNav />
        {children}
      </SidebarProvider>
    </TooltipProvider>
  )
}
