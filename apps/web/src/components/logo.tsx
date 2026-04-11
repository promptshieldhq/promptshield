export function Logo({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5L4 6V11.5C4 16.1 7.6 20.1 12 21.5C16.4 20.1 20 16.1 20 11.5V6L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 10.5V9.5C9.5 7.8 10.1 6.5 12 6.5C13.9 6.5 14.5 7.8 14.5 9.5V10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="8.5"
        y="10.5"
        width="7"
        height="5.5"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}
