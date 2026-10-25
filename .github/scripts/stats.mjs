// Builds assets/card.svg from the GitHub contribution calendar.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const user = process.env.USERNAME;
const token = process.env.GITHUB_TOKEN;

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchDays() {
  const { user: u } = await gql(`query($login:String!){user(login:$login){createdAt}}`, { login: user });
  const byDate = new Map();
  const now = new Date();
  for (let y = new Date(u.createdAt).getUTCFullYear(); y <= now.getUTCFullYear(); y++) {
    const from = new Date(Date.UTC(y, 0, 1)).toISOString();
    const to = new Date(Math.min(Date.UTC(y, 11, 31, 23, 59, 59), now.getTime())).toISOString();
    const data = await gql(
      `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
      { login: user, from, to },
    );
    for (const w of data.user.contributionsCollection.contributionCalendar.weeks)
      for (const d of w.contributionDays)
        if (d.date >= from.slice(0, 10) && d.date <= to.slice(0, 10)) byDate.set(d.date, d.contributionCount);
  }
  const days = [...byDate].map(([date, count]) => ({ date, count }));
  for (const y of new Set(days.map((d) => d.date.slice(0, 4))))
    console.log(y, days.filter((d) => d.date.startsWith(y)).reduce((s, d) => s + d.count, 0));
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeStats(days) {
  const total = days.reduce((s, d) => s + d.count, 0);
  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  // Today without contributions yet doesn't break the current streak.
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  let current = 0;
  while (i >= 0 && days[i].count > 0) { current++; i--; }
  const weeks = [];
  for (let j = Math.max(0, days.length - 26 * 7); j < days.length; j += 7)
    weeks.push(days.slice(j, j + 7).reduce((s, d) => s + d.count, 0));
  return { total, current, longest, weeks };
}

const MONO = "ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace";
const SANS = "'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif";

const ABOUT = [
  ["3rd-year CS student @ ", "ACS UPB", "#ffffff"],
  ["Full-stack developer @ ", "Animalia", "#ffffff"],
  ["Backend in ", "Kotlin + Spring Boot", "#ffffff"],
  ["Mobile apps in ", "Flutter", "#ffffff"],
];

const STACK = [
  ["#d0d0d6", ["Kotlin", "Spring Boot", "Java", "PostgreSQL"]],
  ["#d0d0d6", ["Flutter", "Dart"]],
  ["#d0d0d6", ["Python", "C", "JavaScript", "Git", "Linux"]],
];

function chips(x0, y0, maxX) {
  const out = [];
  let x = x0, y = y0, n = 0;
  for (const [color, items] of STACK) {
    for (const name of items) {
      const w = name.length * 9.7 + 28;
      if (x + w > maxX) { x = x0; y += 46; }
      out.push(`<g class="f" style="animation-delay:${(0.5 + n++ * 0.05).toFixed(2)}s">
    <rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="34" rx="17" fill="${color}" fill-opacity="0.05" stroke="${color}" stroke-opacity="0.18"/>
    <text x="${(x + w / 2).toFixed(1)}" y="${y + 23}" text-anchor="middle" class="chip" fill="${color}">${name}</text>
  </g>`);
      x += w + 10;
    }
  }
  return out.join("\n  ");
}

export function render({ total, current, longest, weeks }) {
  const max = Math.max(1, ...weeks);
  const chartX = 640, chartW = 496, chartBottom = 576, chartH = 62;
  const gap = 6, bw = (chartW - gap * (weeks.length - 1)) / weeks.length;
  const bars = weeks.map((v, i) => {
    const h = v === 0 ? 3 : Math.max(6, Math.sqrt(v / max) * chartH);
    const x = chartX + i * (bw + gap);
    return `<rect class="bar" style="animation-delay:${(0.9 + i * 0.03).toFixed(2)}s" x="${x.toFixed(1)}" y="${(chartBottom - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${v === 0 ? "#26262c" : "url(#bar)"}"/>`;
  }).join("\n  ");
  const about = ABOUT.map(([pre, hl, color], i) =>
    `<text class="txt f" style="animation-delay:${(0.4 + i * 0.12).toFixed(2)}s" x="64" y="${314 + i * 34}"><tspan fill="#ff8c42">➜ </tspan>${pre}<tspan fill="${color}">${hl}</tspan></text>`,
  ).join("\n  ");
  const stat = (x, value, label, color) =>
    `<text class="num f" style="animation-delay:.8s" x="${x}" y="540" fill="${color}">${value}</text>
  <text class="lbl f" style="animation-delay:.8s" x="${x}" y="572">${label}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0e0e11"/><stop offset="1" stop-color="#16161b"/>
    </linearGradient>
    <linearGradient id="name" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff8c42"><animate attributeName="stop-color" values="#ff8c42;#ffa25c;#ff8c42" dur="8s" repeatCount="indefinite"/></stop>
      <stop offset="1" stop-color="#ffa25c"><animate attributeName="stop-color" values="#ffa25c;#ff8c42;#ffa25c" dur="8s" repeatCount="indefinite"/></stop>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#ff7a29"/><stop offset="1" stop-color="#ffa25c"/>
    </linearGradient>
    <radialGradient id="g1"><stop offset="0" stop-color="#ff8c42" stop-opacity="0.10"/><stop offset="1" stop-color="#ff8c42" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2"><stop offset="0" stop-color="#ffffff" stop-opacity="0.03"/><stop offset="1" stop-color="#ff6b1a" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#fff" stroke-opacity="0.035"/></pattern>
    <clipPath id="clip"><rect width="1200" height="630" rx="20"/></clipPath>
  </defs>
  <style>
    .name { font: 800 64px ${SANS}; letter-spacing: -1px; }
    .role { font: 500 22px ${SANS}; fill: #e6e6ea; }
    .meta, .sec, .lbl { font: 15px ${MONO}; fill: #8b8b96; }
    .sec { font-size: 13px; letter-spacing: 2px; fill: #5f5f6a; }
    .txt { font: 18px ${MONO}; fill: #b4b4be; }
    .chip { font: 16px ${MONO}; }
    .num { font: 700 42px ${SANS}; }
    .f { opacity: 0; animation: in .7s ease-out forwards; }
    @keyframes in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
    .bar { transform-box: fill-box; transform-origin: bottom; animation: grow .6s ease-out both; }
    @keyframes grow { from { transform: scaleY(0) } }
  </style>
  <g clip-path="url(#clip)">
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#grid)"/>
    <circle cx="1060" cy="20" r="300" fill="url(#g1)"/>
    <circle cx="80" cy="640" r="300" fill="url(#g2)"/>
  </g>
  <rect x="1" y="1" width="1198" height="628" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"/>

  <text class="meta f" x="64" y="74">// hello, world</text>
  <text class="name f" style="animation-delay:.1s" x="62" y="140" fill="url(#name)">Ayan Selim</text>
  <text class="role f" style="animation-delay:.2s" x="64" y="180">Full-stack Developer · Kotlin · Spring Boot · Flutter</text>
  <text class="meta f" style="animation-delay:.2s" x="1136" y="74" text-anchor="end">Bucharest, RO</text>
  <text class="meta f" style="animation-delay:.3s;fill:#ff8c42" x="1136" y="102" text-anchor="end">in/ayan-selim-97890b399</text>

  <line x1="64" y1="228" x2="1136" y2="228" stroke="#ffffff" stroke-opacity="0.08"/>

  <text class="sec" x="64" y="272">ABOUT</text>
  ${about}
  <text class="sec" x="640" y="272">STACK</text>
  ${chips(640, 292, 1136)}

  <line x1="64" y1="452" x2="1136" y2="452" stroke="#ffffff" stroke-opacity="0.08"/>

  <text class="sec" x="64" y="490">ACTIVITY</text>
  ${stat(64, total, "contributions", "#ff8c42")}
  ${stat(250, `${current}d`, "current streak", "#ffffff")}
  ${stat(436, `${longest}d`, "longest streak", "#ffffff")}
  <text class="sec" x="640" y="490">LAST ${weeks.length} WEEKS</text>
  ${bars}
</svg>
`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const days = process.env.MOCK ? JSON.parse(readFileSync(process.env.MOCK, "utf8")) : await fetchDays();
  const out = process.env.OUT ?? "assets/card.svg";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render(computeStats(days)));
}
