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

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
const ORANGE = "#ff9f0a";

const SPECS = [
  ["Studying", "Computer Science", ["ACS UPB · Year 3"]],
  ["Working at", "Animalia", ["Full-stack developer"]],
  ["Stack", "Kotlin · Spring Boot", ["Flutter · Dart · Java · PostgreSQL", "Python · C · JavaScript · Git"]],
];

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function render({ total, current, longest, weeks }) {
  const max = Math.max(1, ...weeks);
  const chartX = 700, chartW = 436, chartBottom = 590, chartH = 70;
  const gap = 7, bw = (chartW - gap * (weeks.length - 1)) / weeks.length;
  const bars = weeks.map((v, i) => {
    const h = v === 0 ? bw : Math.max(bw, Math.sqrt(v / max) * chartH);
    const x = chartX + i * (bw + gap);
    return `<rect class="bar" style="animation-delay:${(0.8 + i * 0.025).toFixed(3)}s" x="${x.toFixed(1)}" y="${(chartBottom - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${(bw / 2).toFixed(1)}" fill="${v === 0 ? "#2c2c2e" : ORANGE}"/>`;
  }).join("\n  ");
  const specs = SPECS.map(([label, value, sub], i) => {
    const x = 64 + i * 360;
    return `<g class="f" style="animation-delay:${(0.35 + i * 0.1).toFixed(2)}s">
    <text class="lbl" x="${x}" y="300">${label}</text>
    <text class="val" x="${x}" y="336">${esc(value)}</text>
    ${sub.map((t, j) => `<text class="sub" x="${x}" y="${368 + j * 26}">${esc(t)}</text>`).join("\n    ")}
  </g>`;
  }).join("\n  ");
  const stat = (x, value, unit, label, color) =>
    `<text class="num" x="${x}" y="566" fill="${color}">${value}<tspan class="unit">${unit}</tspan></text>
  <text class="lbl" x="${x}" y="596">${label}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650">
  <style>
    text { font-family: ${FONT}; }
    .eyebrow { font-size: 17px; font-weight: 600; fill: ${ORANGE}; }
    .hero { font-size: 72px; font-weight: 700; letter-spacing: -2px; fill: #f5f5f7; }
    .lead { font-size: 26px; font-weight: 500; letter-spacing: -0.3px; fill: #86868b; }
    .lbl { font-size: 15px; font-weight: 500; fill: #86868b; }
    .val { font-size: 26px; font-weight: 600; letter-spacing: -0.4px; fill: #f5f5f7; }
    .sub { font-size: 17px; fill: #a1a1a6; }
    .num { font-size: 44px; font-weight: 700; letter-spacing: -1px; }
    .unit { font-size: 22px; font-weight: 600; fill: #86868b; }
    .link { font-size: 17px; font-weight: 500; fill: ${ORANGE}; }
    .f { opacity: 0; animation: in .9s cubic-bezier(.2,.7,.2,1) forwards; }
    @keyframes in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
    .bar { transform-box: fill-box; transform-origin: bottom; animation: grow .7s cubic-bezier(.2,.7,.2,1) both; }
    @keyframes grow { from { transform: scaleY(0) } }
  </style>
  <rect x="0.5" y="0.5" width="1199" height="649" rx="28" fill="#0a0a0a" stroke="#ffffff" stroke-opacity="0.08"/>

  <g class="f">
    <text class="eyebrow" x="64" y="88">Bucharest, Romania</text>
    <text class="link" x="1136" y="88" text-anchor="end">LinkedIn ›</text>
  </g>
  <text class="hero f" style="animation-delay:.1s" x="60" y="166">Ayan Selim.</text>
  <text class="lead f" style="animation-delay:.2s" x="64" y="210">Full-stack developer. Built with Kotlin, Spring Boot and Flutter.</text>

  <line x1="64" y1="252" x2="1136" y2="252" stroke="#ffffff" stroke-opacity="0.08"/>
  ${specs}
  <line x1="64" y1="452" x2="1136" y2="452" stroke="#ffffff" stroke-opacity="0.08"/>

  <g class="f" style="animation-delay:.6s">
    <text class="lbl" x="64" y="500">Activity</text>
    ${stat(64, total, "", "contributions", "#f5f5f7")}
    ${stat(270, current, " days", "current streak", "#f5f5f7")}
    ${stat(476, longest, " days", "longest streak", "#f5f5f7")}
    <text class="lbl" x="700" y="500">Last ${weeks.length} weeks</text>
  </g>
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
