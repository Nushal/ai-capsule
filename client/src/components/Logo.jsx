export default function Logo({ size = 28 }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#16132b" />
        <g transform="rotate(-40 16 16)">
          <path d="M9.5 11h6.5v10H9.5a5 5 0 0 1 0-10z" fill="#8b7dff" />
          <path d="M16 11h6.5a5 5 0 0 1 0 10H16z" fill="#e9e5ff" />
        </g>
      </svg>
      <span className="logo-text">AI Capsule</span>
    </span>
  );
}
