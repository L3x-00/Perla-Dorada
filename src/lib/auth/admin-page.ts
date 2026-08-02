import "server-only";

import { redirect } from "next/navigation";

import { requireActiveAdmin } from "@/lib/auth/admin";

/** Protects Server Components that render sensitive admin information. */
export async function requireActiveAdminPage(): Promise<string> {
  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    redirect("/admin/login");
  }

  return adminUserId;
}
