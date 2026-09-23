import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/ui/primitives/field";
import { Input } from "@/ui/primitives/input";

export function TextField({
  id,
  label,
  description,
  error,
  required,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "id" | "required"> & {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
}) {
  const describedBy =
    [description && `${id}-description`, error && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </FieldLabel>
      {description && (
        <FieldDescription id={`${id}-description`}>
          {description}
        </FieldDescription>
      )}
      <Input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

export function ErrorSummary({
  errors,
}: {
  errors: { id: string; message: string }[];
}) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      className="rounded-xl border border-destructive p-4"
    >
      <p className="font-semibold">Please fix these fields</p>
      <ul className="mt-2 list-inside list-disc text-sm">
        {errors.map((error) => (
          <li key={error.id}>
            <a className="underline" href={`#${error.id}`}>
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
