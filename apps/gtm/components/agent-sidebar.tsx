"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Home,
  Bot,
  Settings,
  LogOut,
  Moon,
  Sun,
  Monitor,
  ChevronRight,
  LayoutGrid,
} from "lucide-react"
import { signOut } from "@/lib/supabase/auth"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { useTheme } from "next-themes"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// Minimal navigation for Agent View
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Agent", href: "/agent", icon: Bot, primary: true },
]

function AgentSidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [workspace, setWorkspace] = useState<{ name: string } | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === "collapsed"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      }
    }
    fetchData()
  }, [])

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
    if (href === "/dashboard") return pathname === href
    return pathname.startsWith(href)
  }

  const userName = user?.email?.split("@")[0] || "User"
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1)

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
                className="w-full"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/40 backdrop-blur-sm">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 1024 1024"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M793.285 871.668C793.285 884.289 783.055 894.52 770.434 894.52H252.851C240.231 894.52 230 884.289 230 871.668L230 531.184V151.851C230 139.231 240.231 129 252.851 129H771.107C793.849 129 802.631 158.603 783.57 171.005L230 531.184H770.434C783.055 531.184 793.285 541.414 793.285 554.035V871.668Z"
                      fill="#9AE83E"
                    />
                  </svg>
                </div>
              </SidebarMenuButton>
            ) : (
              <div className="flex w-full items-center justify-between gap-2">
                <SidebarMenuButton asChild size="lg" tooltip="Sako" className="flex-1">
                  <Link href="/agent" className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/40 backdrop-blur-sm">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 1024 1024"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M793.285 871.668C793.285 884.289 783.055 894.52 770.434 894.52H252.851C240.231 894.52 230 884.289 230 871.668L230 531.184V151.851C230 139.231 240.231 129 252.851 129H771.107C793.849 129 802.631 158.603 783.57 171.005L230 531.184H770.434C783.055 531.184 793.285 541.414 793.285 554.035V871.668Z"
                          fill="#9AE83E"
                        />
                      </svg>
                    </div>
                    <span className="text-lg font-semibold tracking-tight">
                      Sako
                    </span>
                  </Link>
                </SidebarMenuButton>
                <SidebarTrigger className="h-8 w-8 shrink-0" />
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Minimal Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.name}
                    size="default"
                    className={cn(
                      item.primary && !isActive(item.href) && "bg-primary/10 hover:bg-primary/20",
                      item.primary && isActive(item.href) && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarSeparator />

        {/* Advanced View Link */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Switch to Advanced View"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link href="/dashboard?view=advanced">
                <LayoutGrid className="size-4" />
                <span>Advanced View</span>
                <ChevronRight className="ml-auto size-4" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

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
                    <AvatarFallback className="rounded-lg bg-linear-to-br from-primary to-emerald-400 text-primary-foreground">
                      {displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                    <span className="truncate text-muted-foreground">
                      {workspace?.name || "Workspace"}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="text-destructive focus:text-destructive"
                >
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

export function AgentSidebar({ children }: { children?: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <AgentSidebarNav />
        {children}
      </SidebarProvider>
    </TooltipProvider>
  )
}
