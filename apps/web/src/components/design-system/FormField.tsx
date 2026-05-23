import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LucideIcon } from "lucide-react";

interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

function FormField({ label, description, error, hint, required, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {description && (
          <span className="text-xs text-muted-foreground">({description})</span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: LucideIcon;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, error, icon: Icon, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50", className)}
        {...props}
      />
    );
  }
);
InputField.displayName = "InputField";

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <Textarea
        ref={ref}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50", className)}
        {...props}
      />
    );
  }
);
TextareaField.displayName = "TextareaField";

export { FormField, InputField, TextareaField };