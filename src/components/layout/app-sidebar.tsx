import { SidebarContent } from "./sidebar-content";

/** Sidebar fixa do desktop; abaixo de md a navegação vai para o MobileNav. */
export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 md:block">
      <SidebarContent />
    </aside>
  );
}
