"use server";

import { revalidatePath } from "next/cache";
import { parseNames, type NameField } from "@/lib/auth/names";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

// Me → Your name (12 §4 Q30). Written as the student under RLS (column grant on first/last name);
// the database derives the "Ada O." display name other students see.

export type NameState =
  | { status: "idle" }
  | { status: "saved"; savedAt: number }
  | { status: "error"; field: NameField | null; message: string };

export async function updateName(_prev: NameState, form: FormData): Promise<NameState> {
  const viewer = await getViewer();
  if (!viewer) return { status: "error", field: null, message: "Your session has ended. Sign in again to save." };

  const names = parseNames(form.get("first_name"), form.get("last_name"));
  if (!names.ok) return { status: "error", field: names.field, message: names.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: names.first, last_name: names.last })
    .eq("id", viewer.userId);
  if (error) {
    return { status: "error", field: null, message: "Couldn't save your name. Check your connection and try again." };
  }
  // The greeting and initials in every page header use the name.
  revalidatePath("/", "layout");
  return { status: "saved", savedAt: Date.now() };
}
