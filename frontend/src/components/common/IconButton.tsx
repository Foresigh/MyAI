import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import styles from "./IconButton.module.css";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  variant?: "ghost" | "solid";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active, variant = "ghost", className, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={clsx(styles.button, styles[variant], active && styles.active, className)}
      {...rest}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";
