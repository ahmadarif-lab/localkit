/** Decorative hero illustration: floating document cards on an orbit. */
export function HeroArt() {
  const lines = (x: number, y: number, widths: number[], gap = 14) =>
    widths.map((w, i) => <rect key={i} x={x} y={y + i * gap} width={w} height="6" rx="3" fill="#d9d4cb" />);
  return (
    <svg class="hero-art" viewBox="0 0 560 360" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="ha-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" stop-opacity="0" />
          <stop offset="1" stop-color="var(--accent)" stop-opacity=".22" />
        </linearGradient>
        <linearGradient id="ha-head" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffb46b" />
          <stop offset="1" stop-color="var(--accent)" />
        </linearGradient>
        <linearGradient id="ha-pill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="var(--accent)" />
          <stop offset="1" stop-color="#ff8a3d" />
        </linearGradient>
        <filter id="ha-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#a2460f" flood-opacity=".18" />
        </filter>
        <clipPath id="ha-img">
          <rect x="22" y="22" width="96" height="78" rx="10" />
        </clipPath>
      </defs>

      {/* perspective floor */}
      <g opacity=".9">
        <path d="M40 300 L520 300 L470 230 L90 230 Z" fill="url(#ha-floor)" opacity=".5" />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={90 + i * 47.5} y1="230" x2={40 + i * 60} y2="300" stroke="var(--accent)" stroke-opacity=".18" />
        ))}
        {[238, 250, 265, 282, 300].map((y) => (
          <line key={`h${y}`} x1={90 - (y - 230) * 0.71} y1={y} x2={470 + (y - 230) * 0.71} y2={y} stroke="var(--accent)" stroke-opacity=".16" />
        ))}
      </g>

      {/* back half of the orbit */}
      <ellipse cx="290" cy="190" rx="250" ry="78" transform="rotate(-8 290 190)" fill="none" stroke="var(--accent)" stroke-opacity=".55" stroke-width="2.5" />

      {/* stacked base sheet */}
      <g filter="url(#ha-shadow)" transform="translate(190 210) rotate(4)">
        <rect width="230" height="90" rx="14" fill="var(--paper)" />
      </g>

      {/* back document */}
      <g filter="url(#ha-shadow)" transform="translate(300 20) rotate(9)">
        <rect width="150" height="196" rx="14" fill="var(--paper)" />
        {lines(22, 34, [84, 106, 96, 70, 100, 88, 60])}
      </g>

      {/* main PDF card */}
      <g filter="url(#ha-shadow)" transform="translate(140 46) rotate(-13)">
        <rect width="176" height="222" rx="18" fill="var(--paper)" stroke="var(--accent)" stroke-width="3" />
        <path d="M18 0 H130 L176 46 V60 H0 V18 A18 18 0 0 1 18 0 Z" fill="url(#ha-head)" />
        <path d="M130 0 L176 46 H144 A14 14 0 0 1 130 32 Z" fill="#fff" fill-opacity=".85" />
        {/* generic document glyph */}
        <g transform="translate(64 78)" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 0 H30 L48 18 V56 A6 6 0 0 1 42 62 H6 A6 6 0 0 1 0 56 V6 A6 6 0 0 1 6 0 Z" />
          <path d="M30 0 V18 H48" />
          <path d="M12 34 H36 M12 46 H28" />
        </g>
        <text x="88" y="190" text-anchor="middle" font-size="44" font-weight="800" fill="var(--accent)" letter-spacing="1">
          PDF
        </text>
      </g>

      {/* image card */}
      <g filter="url(#ha-shadow)" transform="translate(318 106) rotate(10)">
        <rect width="140" height="168" rx="16" fill="var(--paper)" stroke="#cfc8bc" stroke-width="2" />
        <rect x="22" y="22" width="96" height="78" rx="10" fill="#ffe7d3" />
        <g clip-path="url(#ha-img)">
          <path d="M22 100 L56 62 L78 84 L92 72 L118 100 Z" fill="var(--accent)" />
          <circle cx="98" cy="44" r="10" fill="#ff9f55" />
        </g>
        {lines(22, 118, [96, 72], 14)}
      </g>

      {/* front half of the orbit, drawn over the cards */}
      <path
        d="M 44 215 C 120 290, 460 255, 536 165"
        transform="rotate(-8 290 190)"
        fill="none"
        stroke="var(--accent)"
        stroke-width="2.5"
        stroke-linecap="round"
        opacity=".85"
      />

      {/* code chip */}
      <g filter="url(#ha-shadow)" transform="translate(88 228) rotate(10)">
        <rect width="66" height="48" rx="12" fill="var(--paper)" stroke="#cfc8bc" stroke-width="2" />
        <path d="M24 16 L16 24 L24 32 M42 16 L50 24 L42 32 M36 13 L30 35" fill="none" stroke="#4b4741" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      {/* process() pill */}
      <g filter="url(#ha-shadow)" transform="translate(404 40) rotate(12)">
        <rect width="142" height="44" rx="12" fill="url(#ha-pill)" />
        <path d="M18 15 L25 22 L18 29" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <text x="34" y="29" font-size="19" font-weight="700" fill="#fff" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
          process()
        </text>
      </g>
    </svg>
  );
}
