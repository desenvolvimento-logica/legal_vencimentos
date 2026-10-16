"use client";

import { Pencil, UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ProfileFormSheet, type ProfileOption } from "./profile-form-sheet";

export function AddProfileButton({ profiles }: { profiles: ProfileOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        Adicionar usuário
      </Button>
      {open && (
        <ProfileFormSheet open onOpenChange={setOpen} profiles={profiles} />
      )}
    </>
  );
}

export function EditProfileButton({
  profiles,
  profile,
  isSelf,
}: {
  profiles: ProfileOption[];
  profile: {
    id: string;
    name: string;
    email: string;
    jobTitle: string | null;
    level: ProfileOption["level"];
    managerId: string | null;
    active: boolean;
  };
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${profile.name}`}
      >
        <Pencil aria-hidden />
      </Button>
      {open && (
        <ProfileFormSheet
          open
          onOpenChange={setOpen}
          profiles={profiles}
          isSelf={isSelf}
          profile={{
            id: profile.id,
            email: profile.email,
            active: profile.active,
            values: {
              name: profile.name,
              jobTitle: profile.jobTitle ?? "",
              level: profile.level,
              managerId: profile.managerId ?? "",
            },
          }}
        />
      )}
    </>
  );
}
