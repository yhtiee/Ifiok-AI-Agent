"use client";

import { Slot, type Label as LabelPrimitive } from "radix-ui";
import { createContext, useContext, useId, type ComponentProps } from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "./label";

// shadcn/ui Form (react-hook-form + a zod resolver). Labels stay ink when a field is invalid: the
// red edge and the message say it (colour is never the only signal). Messages are announced.

const Form = FormProvider;

type FormFieldContextValue = { name: string };
const FormFieldContext = createContext<FormFieldContextValue | null>(null);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

const FormItemContext = createContext<{ id: string }>({ id: "" });

function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const { id } = useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  if (!fieldContext) throw new Error("useFormField must be used inside <FormField>");
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);
  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

function FormItem({ className, ...props }: ComponentProps<"div">) {
  const id = useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid content-start gap-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel(props: ComponentProps<typeof LabelPrimitive.Root>) {
  const { formItemId } = useFormField();
  return <Label data-slot="form-label" htmlFor={formItemId} {...props} />;
}

function FormControl(props: ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();
  return (
    <p data-slot="form-description" id={formDescriptionId} className={cn("text-sm text-ink-2", className)} {...props} />
  );
}

function FormMessage({ className, children, ...props }: ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? "") : children;
  // Always rendered, so screen readers hear the message when it appears.
  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      aria-live="polite"
      className={cn(body ? "text-sm text-bad" : "sr-only", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField };
