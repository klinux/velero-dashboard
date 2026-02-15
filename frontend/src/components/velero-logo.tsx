export function VeleroLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="sail-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--mantine-color-indigo-6)" />
          <stop offset="100%" stopColor="var(--mantine-color-blue-5)" />
        </linearGradient>
        <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--mantine-color-cyan-5)" />
          <stop offset="100%" stopColor="var(--mantine-color-blue-4)" />
        </linearGradient>
      </defs>

      {/* Background circle - subtle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="url(#sail-gradient)"
        opacity="0.08"
      />

      {/* Main sail - large triangular sail */}
      <path
        d="M48 25 L48 62 L72 62 Z"
        fill="url(#sail-gradient)"
        opacity="0.85"
      />

      {/* Secondary sail - smaller front sail (jib) */}
      <path
        d="M48 30 L48 55 L32 55 Z"
        fill="url(#sail-gradient)"
        opacity="0.6"
      />

      {/* Mast - vertical line */}
      <line
        x1="48"
        y1="25"
        x2="48"
        y2="68"
        stroke="url(#sail-gradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Hull - boat body */}
      <path
        d="M35 68 L61 68 Q64 68 62 71 L34 71 Q32 68 35 68 Z"
        fill="url(#sail-gradient)"
        opacity="0.9"
      />

      {/* Waves - three stylized waves */}
      <path
        d="M20 78 Q25 75 30 78 T40 78 T50 78 T60 78 T70 78 T80 78"
        stroke="url(#wave-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M15 85 Q20 82 25 85 T35 85 T45 85 T55 85 T65 85 T75 85 T85 85"
        stroke="url(#wave-gradient)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}
