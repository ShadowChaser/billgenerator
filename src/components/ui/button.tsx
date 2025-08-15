"use client";

import * as React from "react";

export type ButtonVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "outline"
  | "ghost"
  | "link"
  | "gradient";

export type ButtonSize = "sm" | "default" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50";

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3",
  default: "h-10 px-4",
  lg: "h-11 px-6 text-base",
  icon: "h-10 w-10",
};

const variants: Record<ButtonVariant, string> = {
  default: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-green-600 text-white hover:bg-green-700",
  outline:
    "border border-gray-300 bg-transparent hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100",
  ghost:
    "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100",
  link: "text-blue-600 underline-offset-4 hover:underline",
  gradient:
    "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[base, sizes[size], variants[variant], className].join(" ")}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export default Button;
