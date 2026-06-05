// Named look presets the AI can drop in via applyTemplate. Each is
// { theme, customCss, steps[] } where steps are applied to a freshly-cleared
// page. The model picks one whenever the user names a kind of site (a
// portfolio, a blog, a dashboard, a marketing landing page, …) — far more
// reliable than orchestrating 10+ tool calls by hand.
//
// SUGGESTION_CHIPS is the curated list of "tap-to-prompt" buttons the empty
// chat state shows. Lives next to the templates because most chips kick off
// a template + customisation flow.
//
// Split out of aiAssistant.js so future template tweaks don't drag the
// whole prompt loop module around in diff reviews.

export const TEMPLATES = {
  github: {
    theme: {
      primaryColor: '#2da44e',
      textColor: '#1f2328',
      mutedColor: '#656d76',
      backgroundColor: '#ffffff',
      surfaceColor: '#ffffff',
      softColor: '#f6f8fa',
      headerColor: '#24292f',
      headerTextColor: '#ffffff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      radius: '6px',
      buttonRadius: '6px',
      shadow: '0 1px 0 rgba(31,35,40,.04), 0 1px 3px rgba(140,149,159,.15)',
    },
    customCss: `body { background: #ffffff; }
.rh-card, .card { border: 1px solid #d0d7de !important; box-shadow: none !important; }
.rh-btn { font-weight: 500 !important; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }`,
    steps: [
      { type: 'navbar', alias: 'nav', props: { brand: 'My Project', links: [
        { label: 'Code', href: '#code' },
        { label: 'Issues', href: '#issues' },
        { label: 'Pull requests', href: '#pulls' },
        { label: 'Actions', href: '#actions' },
      ] } },
      { type: 'section', alias: 'hero', props: { heading: 'Build better software, together.' }, styles: { backgroundColor: '#f6f8fa', padding: '64px 40px', textAlign: 'left' } },
      { type: 'heading', props: { text: 'Your one-stop platform for code, collaboration, and shipping.', level: 'h2' }, styles: { fontSize: '36px', fontWeight: '600', color: '#1f2328' } },
      { type: 'text', props: { text: 'Plan, build, and ship with the tools your team already knows. Free for individuals and small teams.' }, styles: { color: '#656d76', fontSize: '18px', maxWidth: '640px' } },
      { type: 'button', props: { text: 'Sign up for free', href: '#signup' }, styles: { backgroundColor: '#2da44e', color: '#ffffff', borderRadius: '6px', padding: '12px 24px' } },
      { type: 'section', props: { heading: 'Why teams choose us' }, styles: { padding: '48px 40px', backgroundColor: '#ffffff' } },
      { type: 'card', props: { title: 'Code review', text: 'Pull requests make collaboration on changes simple.' }, styles: { borderWidth: '1px', borderStyle: 'solid', borderColor: '#d0d7de', borderRadius: '6px', boxShadow: 'none' } },
      { type: 'card', props: { title: 'Project planning', text: 'Track work with issues and boards your team will actually use.' }, styles: { borderWidth: '1px', borderStyle: 'solid', borderColor: '#d0d7de', borderRadius: '6px', boxShadow: 'none' } },
      { type: 'card', props: { title: 'CI / CD', text: 'Automate testing and deployment with workflows.' }, styles: { borderWidth: '1px', borderStyle: 'solid', borderColor: '#d0d7de', borderRadius: '6px', boxShadow: 'none' } },
    ],
  },
  dark: {
    theme: {
      primaryColor: '#3b82f6',
      textColor: '#e6edf3',
      mutedColor: '#7d8590',
      backgroundColor: '#0d1117',
      surfaceColor: '#161b22',
      softColor: '#21262d',
      headerColor: '#010409',
      headerTextColor: '#e6edf3',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      radius: '8px',
      buttonRadius: '8px',
      shadow: '0 8px 24px rgba(0,0,0,.5)',
    },
    customCss: `body { background: #0d1117; color: #e6edf3; }
.rh-card, .card { background: #161b22 !important; border: 1px solid #30363d !important; color: #e6edf3 !important; }
a { color: #58a6ff; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Studio', links: [
        { label: 'Home', href: '#home' },
        { label: 'Work', href: '#work' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ] } },
      { type: 'section', props: { heading: 'Beautiful things, built in the dark.' }, styles: { backgroundColor: '#0d1117', padding: '96px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Design that disappears, work that stands out.', level: 'h1' }, styles: { color: '#e6edf3', fontSize: '52px', fontWeight: '600', textAlign: 'center' } },
      { type: 'text', props: { text: 'A studio practice focused on calm, considered software.' }, styles: { color: '#7d8590', fontSize: '18px', textAlign: 'center' } },
      { type: 'button', props: { text: 'See our work', href: '#work' }, styles: { backgroundColor: '#3b82f6', color: '#ffffff', borderRadius: '8px', padding: '12px 28px' } },
    ],
  },
  apple: {
    theme: {
      primaryColor: '#0071e3',
      textColor: '#1d1d1f',
      mutedColor: '#86868b',
      backgroundColor: '#ffffff',
      surfaceColor: '#ffffff',
      softColor: '#f5f5f7',
      headerColor: '#000000',
      headerTextColor: '#f5f5f7',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      radius: '18px',
      buttonRadius: '980px',
      shadow: '0 4px 20px rgba(0,0,0,0.08)',
    },
    customCss: `body { background: #ffffff; }
.rh-card, .card { border: 0 !important; }`,
    steps: [
      { type: 'navbar', props: { brand: '', links: [
        { label: 'Store', href: '#store' },
        { label: 'Mac', href: '#mac' },
        { label: 'iPhone', href: '#iphone' },
        { label: 'Watch', href: '#watch' },
        { label: 'Support', href: '#support' },
      ] }, styles: { backgroundColor: '#000000', color: '#f5f5f7', padding: '12px 28px', fontSize: '14px' } },
      { type: 'section', props: { heading: 'iPhone' }, styles: { backgroundColor: '#000000', color: '#f5f5f7', padding: '80px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Pro. Beyond.', level: 'h1' }, styles: { color: '#f5f5f7', fontSize: '72px', fontWeight: '600', textAlign: 'center', letterSpacing: '-0.03em' } },
      { type: 'text', props: { text: 'A magical new way to do everything.' }, styles: { color: '#a1a1a6', fontSize: '24px', textAlign: 'center' } },
      { type: 'button', props: { text: 'Learn more', href: '#learn' }, styles: { backgroundColor: '#0071e3', color: '#ffffff', borderRadius: '980px', padding: '12px 22px', fontSize: '17px' } },
    ],
  },
  'minimal-landing': {
    theme: {
      primaryColor: '#111111',
      textColor: '#1a1a1a',
      mutedColor: '#737373',
      backgroundColor: '#fafafa',
      surfaceColor: '#ffffff',
      softColor: '#f4f4f5',
      headerColor: '#fafafa',
      headerTextColor: '#111111',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '2px',
      buttonRadius: '2px',
      shadow: 'none',
    },
    customCss: `body { background: #fafafa; letter-spacing: -0.01em; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Acme', links: [
        { label: 'Product', href: '#product' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Login', href: '#login' },
      ] }, styles: { backgroundColor: '#fafafa', color: '#111111', padding: '20px 40px' } },
      { type: 'section', styles: { backgroundColor: '#fafafa', padding: '120px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Ship faster. Iterate calmer.', level: 'h1' }, styles: { color: '#111111', fontSize: '60px', fontWeight: '600', textAlign: 'center' } },
      { type: 'text', props: { text: 'A no-nonsense way to build the next iteration of your product.' }, styles: { color: '#737373', fontSize: '20px', textAlign: 'center' } },
      { type: 'button', props: { text: 'Get started', href: '#start' }, styles: { backgroundColor: '#111111', color: '#ffffff', borderRadius: '2px', padding: '14px 28px' } },
    ],
  },
  portfolio: {
    theme: {
      primaryColor: '#2563eb',
      textColor: '#1d1d1f',
      mutedColor: '#6e6e73',
      backgroundColor: '#ffffff',
      surfaceColor: '#ffffff',
      softColor: '#f5f5f7',
      headerColor: '#1d1d1f',
      headerTextColor: '#f5f5f7',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '12px',
      buttonRadius: '999px',
      shadow: '0 4px 20px rgba(0,0,0,0.08)',
    },
    customCss: '',
    steps: [
      { type: 'navbar', props: { brand: 'Jane Doe', links: [
        { label: 'Work', href: '#work' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ] } },
      { type: 'section', props: { heading: '' }, styles: { backgroundColor: '#f5f5f7', padding: '96px 40px', textAlign: 'left' } },
      { type: 'heading', props: { text: 'Hi, I’m Jane — a product designer based in Istanbul.', level: 'h1' }, styles: { fontSize: '48px', fontWeight: '600' } },
      { type: 'text', props: { text: 'I help teams turn complex problems into calm, usable interfaces.' }, styles: { color: '#6e6e73', fontSize: '20px', maxWidth: '600px' } },
      { type: 'button', props: { text: 'See my work', href: '#work' }, styles: { backgroundColor: '#2563eb', color: '#ffffff' } },
      { type: 'card', props: { title: 'Project Alpha', text: 'A dashboard for analytics teams. Reduced time-to-insight by 40%.' } },
      { type: 'card', props: { title: 'Project Beta', text: 'A consumer mobile app for habit tracking. 5⭐ in App Store.' } },
      { type: 'card', props: { title: 'Project Gamma', text: 'Brand and website refresh for a Series A startup.' } },
    ],
  },
  blog: {
    theme: {
      primaryColor: '#9333ea',
      textColor: '#1a1a1a',
      mutedColor: '#737373',
      backgroundColor: '#fafafa',
      surfaceColor: '#ffffff',
      softColor: '#f4f4f5',
      headerColor: '#1a1a1a',
      headerTextColor: '#fafafa',
      fontFamily: "Georgia, 'Times New Roman', serif",
      radius: '4px',
      buttonRadius: '4px',
      shadow: '0 1px 3px rgba(0,0,0,.05)',
    },
    customCss: `body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; }
.rh-card, .card { border: 0 !important; box-shadow: none !important; border-bottom: 1px solid #e5e5e5 !important; border-radius: 0 !important; }
h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; letter-spacing: -0.01em; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Daily Notes', links: [
        { label: 'Latest', href: '#latest' },
        { label: 'Archive', href: '#archive' },
        { label: 'About', href: '#about' },
        { label: 'Subscribe', href: '#subscribe' },
      ] } },
      { type: 'section', styles: { backgroundColor: '#fafafa', padding: '72px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Daily Notes', level: 'h1' }, styles: { fontSize: '56px', fontWeight: '700', textAlign: 'center', letterSpacing: '-0.02em' } },
      { type: 'text', props: { text: 'Writing on design, software, and the quiet craft of building things.' }, styles: { color: '#737373', fontSize: '20px', textAlign: 'center', fontStyle: 'italic' } },
      { type: 'heading', props: { text: 'Latest posts', level: 'h2' }, styles: { fontSize: '28px', fontWeight: '700', padding: '24px 40px 8px' } },
      { type: 'card', props: { title: 'On naming things', text: 'A short essay on why naming is the hardest problem in software — and what to do about it.  ·  June 4, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'card', props: { title: 'Design without designers', text: 'How small engineering teams can ship beautiful products without a dedicated design team.  ·  May 28, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'card', props: { title: 'The case for boring stacks', text: 'Why the most exciting engineering decision you can make is to pick the boring tool everyone already knows.  ·  May 19, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'card', props: { title: 'Slow software', text: 'Notes on building software that respects the user’s attention — and the team’s sanity.  ·  May 7, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'section', styles: { backgroundColor: '#f4f4f5', padding: '40px', textAlign: 'center' } },
      { type: 'text', props: { text: 'Get new posts in your inbox — once a week, no spam.' }, styles: { color: '#1a1a1a', fontSize: '18px', textAlign: 'center' } },
      { type: 'button', props: { text: 'Subscribe', href: '#subscribe' }, styles: { backgroundColor: '#9333ea', color: '#ffffff' } },
    ],
  },
  dashboard: {
    theme: {
      primaryColor: '#2563eb',
      textColor: '#0f172a',
      mutedColor: '#64748b',
      backgroundColor: '#f8fafc',
      surfaceColor: '#ffffff',
      softColor: '#f1f5f9',
      headerColor: '#0f172a',
      headerTextColor: '#f8fafc',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '8px',
      buttonRadius: '8px',
      shadow: '0 1px 2px rgba(15,23,42,.05), 0 2px 8px rgba(15,23,42,.05)',
    },
    customCss: `.rh-card, .card { border: 1px solid #e2e8f0 !important; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Acme Console', links: [
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Customers', href: '#customers' },
        { label: 'Reports', href: '#reports' },
        { label: 'Settings', href: '#settings' },
      ] } },
      { type: 'section', props: { heading: 'Dashboard' }, styles: { backgroundColor: '#f8fafc', padding: '40px 40px 16px' } },
      { type: 'text', props: { text: 'A quick summary of how the business is doing this week.' }, styles: { color: '#64748b', padding: '0 40px 24px' } },
      { type: 'card', props: { title: 'Revenue', text: '$84,920  ·  +12.4% vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'card', props: { title: 'New signups', text: '1,284  ·  +6.1% vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'card', props: { title: 'Active users', text: '23,402  ·  +2.8% vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'card', props: { title: 'Churn', text: '2.1%  ·  −0.3pp vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'heading', props: { text: 'Recent activity', level: 'h3' }, styles: { fontSize: '20px', fontWeight: '600', padding: '24px 40px 8px' } },
      { type: 'card', props: { title: 'New customer: Northwind Ltd', text: 'Signed up on the Pro plan — $2,400 ARR.' } },
      { type: 'card', props: { title: 'Plan upgrade: Foo Inc', text: 'Moved from Pro to Enterprise — +$36,000 ARR.' } },
      { type: 'card', props: { title: 'Cancellation: Acme Co', text: 'Cancelled after 14 months — $4,800 ARR churn.' } },
    ],
  },
  marketing: {
    theme: {
      primaryColor: '#ea580c',
      textColor: '#1c1917',
      mutedColor: '#78716c',
      backgroundColor: '#fef7ed',
      surfaceColor: '#ffffff',
      softColor: '#fed7aa',
      headerColor: '#1c1917',
      headerTextColor: '#fef7ed',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '12px',
      buttonRadius: '12px',
      shadow: '0 12px 24px rgba(234,88,12,.15)',
    },
    customCss: `.rh-btn { font-weight: 700 !important; padding: 14px 32px !important; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Sunlight', links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Customers', href: '#customers' },
        { label: 'Sign in', href: '#signin' },
      ] } },
      { type: 'section', styles: { backgroundColor: '#fef7ed', padding: '120px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Sunlight makes your team radiant.', level: 'h1' }, styles: { color: '#1c1917', fontSize: '60px', fontWeight: '700', textAlign: 'center' } },
      { type: 'text', props: { text: 'The simplest way to plan, ship, and celebrate the work your team is doing — together.' }, styles: { color: '#78716c', fontSize: '22px', textAlign: 'center', maxWidth: '640px' } },
      { type: 'button', props: { text: 'Start free trial', href: '#trial' }, styles: { backgroundColor: '#ea580c', color: '#ffffff', borderRadius: '12px' } },
      { type: 'section', props: { heading: 'Built for teams that ship.' }, styles: { backgroundColor: '#ffffff', padding: '64px 40px' } },
      { type: 'card', props: { title: 'Faster planning', text: 'Roadmaps, sprints, and pivots — all in one place.' } },
      { type: 'card', props: { title: 'Effortless reporting', text: 'Auto-generated status updates so you never write another spreadsheet.' } },
      { type: 'card', props: { title: 'Calmer launches', text: 'Coordinate launches across product, marketing, and support without the chaos.' } },
      { type: 'section', styles: { backgroundColor: '#1c1917', padding: '80px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Ready to make this week your best one yet?', level: 'h2' }, styles: { color: '#fef7ed', fontSize: '36px', fontWeight: '700', textAlign: 'center' } },
      { type: 'button', props: { text: 'Try Sunlight free', href: '#trial' }, styles: { backgroundColor: '#ea580c', color: '#ffffff' } },
    ],
  },
}

// Tap-to-prompt chips for the empty chat state. Each chip has a short label
// the user reads + the actual prompt text that gets sent when they tap. The
// chips deliberately cover the high-leverage moves (apply a template, switch
// to dark mode, brand colour) so a brand-new user can produce something
// looking like a site in two clicks.
export const SUGGESTION_CHIPS = [
  { label: 'Portfolio site', prompt: 'Make a personal portfolio site for a product designer.' },
  { label: 'Blog', prompt: 'Make a personal blog about software and design.' },
  { label: 'Marketing landing', prompt: 'Make a marketing landing page for a productivity SaaS.' },
  { label: 'Dashboard', prompt: 'Make an admin dashboard with KPI cards.' },
  { label: 'Dark mode', prompt: 'Switch the site to dark mode.' },
  { label: 'Apple style', prompt: 'Make the site look like an Apple product page.' },
  { label: 'GitHub style', prompt: 'Make the site look like the GitHub homepage.' },
  { label: 'Blue brand color', prompt: 'Change the primary colour of the site to a vibrant blue.' },
  { label: 'Add navbar', prompt: 'Add a navigation bar at the top with Home, About, Contact links.' },
  { label: 'Add hero', prompt: 'Add a hero section with a big heading and a primary call-to-action button.' },
]
