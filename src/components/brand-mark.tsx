export function BrandMark({ size = 28, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  const stroke = tone === "light" ? "#E8E6E1" : "#1B1D21";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" stroke={stroke} strokeWidth="1.5" />
      <path d="M9 21V14M16 21V10M23 21V17" stroke="#9FB0D9" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
