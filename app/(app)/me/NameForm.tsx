"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/mini";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { NAME_MAX } from "@/lib/auth/name-limits";
import { updateName } from "./actions";

// Me → Your name (12 §4 Q30). The form checks length here; the server action checks everything
// again (letters only, NFC) and its message lands on the field it belongs to.

const name = (label: string) =>
  z
    .string()
    .check(
      z.trim(),
      z.minLength(1, `Enter your ${label}.`),
      z.maxLength(NAME_MAX, `Keep your ${label} to ${NAME_MAX} characters or fewer.`),
    );
const schema = z.object({ first_name: name("first name"), last_name: name("last name") });
type Values = z.infer<typeof schema>;

export function NameForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [saved, setSaved] = useState({ first_name: firstName, last_name: lastName });
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: saved });
  const values = useWatch({ control: form.control });
  const changed =
    (values.first_name ?? "").trim() !== saved.first_name || (values.last_name ?? "").trim() !== saved.last_name;

  const onSubmit = (v: Values) => {
    setError(null);
    const data = new FormData();
    data.set("first_name", v.first_name);
    data.set("last_name", v.last_name);
    startSaving(async () => {
      const result = await updateName({ status: "idle" }, data);
      if (result.status === "saved") {
        const next = { first_name: v.first_name.trim(), last_name: v.last_name.trim() };
        setSaved(next);
        form.reset(next);
        toast("Name saved.");
      } else if (result.status === "error") {
        if (result.field) form.setError(result.field, { message: result.message }, { shouldFocus: true });
        else setError(result.message);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input autoComplete="given-name" autoCapitalize="words" maxLength={NAME_MAX} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input autoComplete="family-name" autoCapitalize="words" maxLength={NAME_MAX} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="text-sm text-ink-2">
          Other students only see your first name and last initial, for example on course outline history.
        </p>
        {error ? (
          <p role="alert" className="text-base text-bad">
            {error}
          </p>
        ) : null}
        <SubmitButton
          full={false}
          className="justify-self-start"
          pending={saving}
          spinner={false}
          pendingLabel="Saving…"
          disabled={!changed}
        >
          Save name
        </SubmitButton>
      </form>
    </Form>
  );
}
