export const properties = [
  { id: 1, name: 'Klikstat App', domain: 'app.klikstat.com', initial: 'K', color: '#5B4BE8' },
  { id: 2, name: 'Klikstat Marketing', domain: 'klikstat.com', initial: 'K', color: '#2C6FE0' },
  { id: 3, name: 'Acme Store', domain: 'acme.com', initial: 'A', tag: 'client', color: '#36C28E' },
  { id: 4, name: 'Northwind Blog', domain: 'blog.northwind.io', initial: 'N', tag: 'client', color: '#D98324' },
];

export const chartData = [
  420, 380, 455, 520, 610, 545, 490, 585, 650, 625,
  700, 680, 725, 760, 705, 682, 720, 800, 855, 820,
  785, 862, 900, 875, 920, 885, 845, 912, 960, 940,
];

// Labels at indices: 0=May 22, 7=May 29, 15=Jun 6, 22=Jun 12, 29=Jun 20
export const chartLabels = [
  { idx: 0,  label: 'May 22' },
  { idx: 7,  label: 'May 29' },
  { idx: 15, label: 'Jun 6'  },
  { idx: 22, label: 'Jun 12' },
  { idx: 29, label: 'Jun 20' },
];

export const channels = [
  { name: 'Search',   percent: 43, color: '#5B4BE8' },
  { name: 'Direct',   percent: 25, color: '#C9C1FF' },
  { name: 'Social',   percent: 15, color: '#FF9F6B' },
  { name: 'Referral', percent: 10, color: '#36C28E' },
  { name: 'Email',    percent:  7, color: '#A6A4AE' },
];

export const topPages = [
  { path: '/',                  count: 6842, pct: 100 },
  { path: '/pricing',           count: 3981, pct: 58  },
  { path: '/blog/launch-week',  count: 3012, pct: 44  },
  { path: '/docs',              count: 2140, pct: 31  },
  { path: '/signup',            count: 1508, pct: 22  },
];

export const locations = [
  { code: 'US', name: 'United States',  count: 8210, pct: 100 },
  { code: 'DE', name: 'Germany',        count: 3402, pct: 41  },
  { code: 'GB', name: 'United Kingdom', count: 2788, pct: 34  },
  { code: 'IN', name: 'India',          count: 2301, pct: 28  },
  { code: 'CA', name: 'Canada',         count: 1820, pct: 22  },
];

export const activePages = [
  { path: '/pricing',          count: 7 },
  { path: '/',                 count: 6 },
  { path: '/blog/launch-week', count: 5 },
  { path: '/docs/install',     count: 4 },
  { path: '/signup',           count: 2 },
];

export const liveEvents = [
  { country: 'US', page: '/pricing',      source: 'Google',        time: 'just now', goal: false },
  { country: 'DE', page: 'Signup',        source: null,            time: '12s ago',  goal: true  },
  { country: 'GB', page: '/',             source: 'X / Twitter',   time: '28s ago',  goal: false },
  { country: 'IN', page: '/docs/install', source: 'direct',        time: '41s ago',  goal: false },
];

export const realtimeBars = [12, 18, 8, 22, 15, 10, 28, 20, 14, 25, 19, 38, 52];
