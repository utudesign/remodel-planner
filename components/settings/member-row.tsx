"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";
import { saveMember } from "@/server/actions/settings";

export function MemberRow({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone?: string | null;
    role: string;
    active: boolean;
    is_default_owner: boolean;
  };
  isSelf: boolean;
}) {
  const [role, setRole] = useState(user.role as Role);
  const [active, setActive] = useState(user.active);
  const [owner, setOwner] = useState(user.is_default_owner);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {user.name || "—"}{" "}
          {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="h-9 w-28"
          aria-label="Role"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="h-9 w-32"
        />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={owner}
            onChange={(e) => setOwner(e.target.checked)}
          />
          Gets new leads
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveMember({
                user_id: user.id,
                role,
                active,
                is_default_owner: owner,
                phone,
              });
              setMsg({ ok: !!r?.ok, text: r?.ok ? "Saved" : (r?.error ?? "Could not save") });
            })
          }
        >
          Save
        </Button>
      </div>
      {msg ? (
        <p className={msg.ok ? "text-xs text-success" : "text-xs text-destructive"}>{msg.text}</p>
      ) : null}
    </li>
  );
}
