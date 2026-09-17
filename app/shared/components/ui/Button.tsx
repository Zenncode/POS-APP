import type { ButtonHTMLAttributes, ReactNode, ForwardRefExoticComponent, RefAttributes } from "react";
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Spinner } from "./Feedback";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)]",
  secondary: "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50",
  ghost: "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50",
  danger: "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  asChild?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  function Button({ variant = "secondary", size = "md", full, loading, icon, iconPosition = "left", asChild, children, className = "", disabled, ...rest }, ref) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] focus-visible:ring-offset-1 ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading}
        {...rest}
      >
        {loading && <Spinner className="size-4" bare />}
        {!loading && icon && iconPosition === "left" && <span aria-hidden="true">{icon}</span>}
        {children}
        {!loading && icon && iconPosition === "right" && <span aria-hidden="true">{icon}</span>}
      </Comp>
    );
  }
) as ForwardRefExoticComponent<RefAttributes<HTMLButtonElement> & Props>;

Button.displayName = "Button";