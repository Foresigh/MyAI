interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 18, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M32 13 L52 51 L43 51 L32 32 L21 51 L12 51 Z"
        fill="currentColor"
      />
    </svg>
  );
}
