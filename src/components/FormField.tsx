interface FormFieldProps {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "date" | "time" | "select" | "textarea";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  containerClassName?: string;
  options?: { value: string; label: string }[];
  rows?: number;
  error?: string;
  helpText?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

export function FormField({
  name,
  label,
  type = "text",
  placeholder,
  required,
  disabled,
  readOnly,
  className = "",
  containerClassName = "",
  options = [],
  rows = 3,
  error,
  helpText,
  autoComplete,
  value,
  onChange,
  onBlur,
}: FormFieldProps) {
  const fieldId = name;
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;

  const hasError = !!error;
  const isRequired = required;

  const inputClasses = `
    mono-input w-full
    ${hasError ? "border-red-500 focus:border-red-500 focus:ring-red-200" : ""}
    ${disabled ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}
    ${readOnly ? "bg-gray-50 cursor-not-allowed" : ""}
    ${className}
  `;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-[var(--mono-text-muted)] mb-1.5">
        {label}
        {isRequired && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>

      {type === "textarea" ? (
        <textarea
          id={fieldId}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={hasError ? errorId : helpText ? helpId : undefined}
          rows={rows}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={inputClasses}
        />
      ) : type === "select" ? (
        <select
          id={fieldId}
          disabled={disabled}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={hasError ? errorId : helpText ? helpId : undefined}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={inputClasses}
        >
          <option value="">{placeholder || "Select..."}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          id={fieldId}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={hasError ? errorId : helpText ? helpId : undefined}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={inputClasses}
        />
      )}

      {hasError && (
        <p id={errorId} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {!hasError && helpText && (
        <p id={helpId} className="text-xs text-[var(--mono-text-soft)]">
          {helpText}
        </p>
      )}
    </div>
  );
}

interface CheckboxFieldProps {
  name: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CheckboxField({
  name,
  label,
  checked,
  disabled,
  className = "",
  error,
  onChange,
}: CheckboxFieldProps) {
  const fieldId = name;
  const errorId = `${fieldId}-error`;
  const hasError = !!error;

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <input
        type="checkbox"
        id={fieldId}
        checked={checked}
        disabled={disabled}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={hasError ? errorId : undefined}
        onChange={onChange}
        className={`mt-1 w-4 h-4 rounded border-[var(--mono-border)] text-[var(--mono-accent)] focus:ring-[var(--mono-ring)] ${hasError ? "border-red-500" : ""}`}
      />
      <div className="flex flex-col">
        <label htmlFor={fieldId} className="text-sm text-[var(--mono-text)] cursor-pointer">
          {label}
        </label>
        {hasError && (
          <p id={errorId} className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

interface RadioGroupFieldProps {
  name: string;
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  value?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function RadioGroupField({
  name,
  label,
  options,
  value,
  disabled,
  className = "",
  error,
  onChange,
}: RadioGroupFieldProps) {
  const fieldId = name;
  const errorId = `${fieldId}-error`;
  const hasError = !!error;

  return (
    <div className={className}>
      <fieldset>
        <legend className="block text-sm font-medium text-[var(--mono-text-muted)] mb-2">
          {label}
        </legend>
        <div className="flex flex-wrap gap-4">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 cursor-pointer ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name={fieldId}
                value={opt.value}
                checked={value === opt.value}
                disabled={disabled || opt.disabled}
                aria-invalid={hasError ? "true" : undefined}
                aria-describedby={hasError ? errorId : undefined}
                onChange={onChange}
                className="w-4 h-4 border-[var(--mono-border)] text-[var(--mono-accent)] focus:ring-[var(--mono-ring)]"
              />
              <span className="text-sm text-[var(--mono-text)]">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {hasError && (
        <p id={errorId} className="text-xs text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
