export default function NexusIcon({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="100" height="100" rx="22" fill="#0f0e0c" />
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke="#f07830"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <circle
        cx="60"
        cy="40"
        r="29"
        fill="none"
        stroke="#f07830"
        strokeWidth="2"
        opacity="0.6"
      />
      <circle
        cx="38"
        cy="62"
        r="17"
        fill="none"
        stroke="#f07830"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <circle cx="60" cy="40" r="5" fill="#f07830" />
    </svg>
  );
}
