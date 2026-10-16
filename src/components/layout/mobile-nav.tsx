"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { SidebarContent } from "./sidebar-content";

/** Navegação em painel lateral para telas abaixo de md (docs/UI-MOCKUPS.md §10). */
export function MobileNav({ adminSlot }: { adminSlot?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menu de navegação"
          />
        }
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-none p-0 sm:max-w-72"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SidebarContent
          onNavigate={() => setOpen(false)}
          // Os links do grupo vêm do servidor; o clique fecha o menu aqui.
          adminSlot={<div onClick={() => setOpen(false)}>{adminSlot}</div>}
        />
      </SheetContent>
    </Sheet>
  );
}
