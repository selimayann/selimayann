// Builds assets/stats.svg from the GitHub contribution calendar.
import { writeFileSync, readFileSync } from "node:fs";

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

export function render({ total, current, longest, weeks }) {
  const max = Math.max(1, ...weeks);
  const chartX = 40, chartW = 1120, chartBottom = 400, chartH = 150;
  const gap = 8, bw = (chartW - gap * (weeks.length - 1)) / weeks.length;
  const bars = weeks.map((v, i) => {
    const h = v === 0 ? 4 : Math.max(8, (v / max) * chartH);
    const x = chartX + i * (bw + gap);
    return `<rect class="bar" style="animation-delay:${(i * 0.03).toFixed(2)}s" x="${x.toFixed(1)}" y="${(chartBottom - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${v === 0 ? "#1f2740" : "url(#bar)"}"/>`;
  }).join("\n  ");
  const stat = (x, value, label, color) => `
  <text class="num" x="${x}" y="150" fill="${color}">${value}</text>
  <text class="lbl" x="${x}" y="184">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="450" viewBox="0 0 1200 450">
  <defs>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#7aa2f7"/><stop offset="1" stop-color="#bb9af7"/>
    </linearGradient>
  </defs>
  <style>
    .num { font: 700 48px 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; }
    .lbl, .ax { font: 18px ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; fill: #7f89b5; }
    .ttl { font: 18px ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; fill: #a9b1d6; }
    .bar { transform-box: fill-box; transform-origin: bottom; animation: grow .6s ease-out both; }
    @keyframes grow { from { transform: scaleY(0) } }
  </style>
  <rect x="1" y="1" width="1198" height="448" rx="18" fill="#0b1020" stroke="#7aa2f7" stroke-opacity="0.18" stroke-width="2"/>
  <path d="M1 58V19A18 18 0 0 1 19 1H1181A18 18 0 0 1 1199 19V58Z" fill="#111a33"/>
  <circle cx="34" cy="30" r="8" fill="#f7768e"/><circle cx="60" cy="30" r="8" fill="#e0af68"/><circle cx="86" cy="30" r="8" fill="#9ece6a"/>
  <text class="ttl" x="600" y="37" text-anchor="middle">activity.log</text>
  ${stat(40, total, "total contributions", "#7aa2f7")}
  ${stat(440, `${current}d`, "current streak", "#bb9af7")}
  ${stat(840, `${longest}d`, "longest streak", "#7dcfff")}
  <text class="ax" x="40" y="232">// contributions per week, last ${weeks.length} weeks</text>
  ${bars}
  <line x1="40" y1="${chartBottom + 0.5}" x2="1160" y2="${chartBottom + 0.5}" stroke="#3b4261"/>
</svg>
`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const days = process.env.MOCK ? JSON.parse(readFileSync(process.env.MOCK, "utf8")) : await fetchDays();
  writeFileSync(process.env.OUT ?? "assets/stats.svg", render(computeStats(days)));
}
