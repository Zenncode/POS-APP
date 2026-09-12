import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-gray-200 disabled:text-gray-400",
  secondary: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50",
  ghost: "text-gray-700 hover:bg-gray-100 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400",
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
  children: ReactNode;
}

export function Button({ variant = "secondary", size = "md", full, children, className = "", ...rest }: Props): JSX.Element {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
