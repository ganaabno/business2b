import { useCallback } from "react";
import {
  useForm as useReactHookForm,
  type SubmitHandler,
  type FieldErrors,
  type Control,
  type UseFormRegister,
  type UseFormWatch,
  type UseFormReset,
  type UseFormSetValue,
  type UseFormHandleSubmit,
  type FieldValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType, ZodError } from "zod";

export interface UseZodFormOptions<T extends FieldValues> {
  schema: ZodType<T>;
  defaultValues?: Partial<T>;
  mode?: "onSubmit" | "onBlur" | "onChange";
  reValidateMode?: "onSubmit" | "onBlur" | "onChange";
}

export interface UseZodFormReturn<T extends FieldValues> {
  register: UseFormRegister<T>;
  watch: UseFormWatch<T>;
  setValue: UseFormSetValue<T>;
  setError: (name: string, error: any) => void;
  clearErrors: (name?: string | string[]) => void;
  reset: UseFormReset<T>;
  control: Control<T>;
  handleSubmit: UseFormHandleSubmit<T>;
  formState: {
    isSubmitting: boolean;
    isValid: boolean;
    isDirty: boolean;
    errors: FieldErrors<T>;
    touchedFields: Record<string, boolean>;
  };
  getValues: () => T;
  trigger: (fields?: string[]) => Promise<boolean>;
}

export function useZodForm<T extends FieldValues>(options: UseZodFormOptions<T>): UseZodFormReturn<T> {
  const { schema, defaultValues, mode = "onSubmit", reValidateMode = "onSubmit" } = options;

  const {
    register,
    watch,
    setValue,
    setError,
    clearErrors,
    reset,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty, touchedFields },
    getValues,
    trigger,
  } = useReactHookForm<T>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: defaultValues as any,
    mode,
    reValidateMode,
  });

  return {
    register,
    watch,
    setValue,
    setError: setError as any,
    clearErrors: clearErrors as any,
    reset,
    control: control as any,
    handleSubmit,
    formState: {
      isSubmitting,
      isValid,
      isDirty,
      errors,
      touchedFields: touchedFields as any,
    },
    getValues,
    trigger: trigger as any,
  };
}

export function getZodErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  return fieldErrors;
}
