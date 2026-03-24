import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { ThemeSettingsPanel } from "@/components/settings/theme-settings-panel"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function SettingsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="safe-area-top bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b border-border/70 backdrop-blur md:static md:h-16 md:min-h-16 md:bg-transparent md:pt-0 md:backdrop-blur-none">
          <div className="flex w-full min-w-0 items-center gap-2 px-3 py-2 sm:px-4 md:py-0">
            <SidebarTrigger className="-ml-1 h-10 w-10 rounded-full md:h-7 md:w-7" />
            <Separator
              orientation="vertical"
              className="mr-2 hidden data-[orientation=vertical]:h-4 md:block"
            />
            <div className="min-w-0 md:hidden">
              <h1 className="truncate text-sm font-semibold">Settings</h1>
              <p className="text-muted-foreground text-[11px]">Appearance preferences</p>
            </div>
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Settings</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem className="hidden sm:block">
                  <BreadcrumbPage>Appearance</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="mobile-page-shell flex flex-1 flex-col gap-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:pb-6">
          <ThemeSettingsPanel />
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
