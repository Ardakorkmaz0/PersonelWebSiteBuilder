import LanguageSwitcher from '../LanguageSwitcher.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

export function AuthWidgetFrame({ children }) {
  return (
    <div className="max-w-full overflow-hidden">
      <div className="w-[121.96%] origin-top-left scale-[0.82] min-[360px]:w-[111.12%] min-[360px]:scale-[0.9] min-[390px]:w-full min-[390px]:scale-100">
        {children}
      </div>
    </div>
  )
}

export default function AuthShell({ title, description, onSubmit, children, footer }) {
  const { t } = useLanguage()
  const Surface = onSubmit ? 'form' : 'section'
  const surfaceProps = onSubmit ? { onSubmit } : {}

  return (
    <main className="themed-auth-page studio-brand-backdrop min-h-[100dvh] bg-[var(--studio-shell)] text-[var(--studio-text)]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <header className="flex min-h-10 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="brand-mark">S</span>
            <span className="truncate text-base font-bold tracking-tight text-[var(--studio-text)] sm:text-lg">
              Sitebuilder
            </span>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="grid flex-1 items-start gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,29rem)] lg:items-center lg:gap-12 lg:py-10">
          <aside className="relative hidden min-h-[34rem] overflow-hidden rounded-3xl border border-[var(--studio-border)] bg-[color-mix(in_srgb,var(--studio-panel-raised)_78%,var(--studio-accent-soft))] p-8 shadow-[var(--studio-shadow)] lg:flex lg:flex-col lg:justify-between xl:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[color-mix(in_srgb,var(--studio-accent)_18%,transparent)] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--studio-info)_12%,transparent)] blur-3xl" />

            <div className="relative max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--studio-accent)_24%,var(--studio-border))] bg-[var(--studio-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--studio-accent-hover)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--studio-accent)]" />
                Sitebuilder
              </div>
              <p className="max-w-lg text-3xl font-bold leading-tight tracking-tight text-[var(--studio-text)] xl:text-4xl">
                {t('Build and publish your first site in minutes.')}
              </p>
              <p className="mt-4 max-w-md text-sm leading-6 text-[var(--studio-text-muted)]">
                {t('Sign in to keep building your sites.')}
              </p>
            </div>

            <div aria-hidden="true" className="relative mt-10 overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] shadow-[var(--studio-shadow)]">
              <div className="flex items-center gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-control)] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--studio-danger)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--studio-warning)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--studio-success)]" />
                <span className="ml-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-1 text-[10px] font-semibold text-[var(--studio-text-muted)]">
                  {t('Preview')}
                </span>
              </div>
              <div className="grid min-h-56 grid-cols-[7rem_1fr]">
                <div className="border-r border-[var(--studio-border)] bg-[var(--studio-control)] p-3">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--studio-text-faint)]">
                    {t('Components')}
                  </div>
                  {[68, 84, 56, 76].map((width) => (
                    <div key={width} className="mb-2 h-7 rounded-md border border-[var(--studio-border)] bg-[var(--studio-panel-raised)]" style={{ width: `${width}%` }} />
                  ))}
                </div>
                <div className="p-5">
                  <div className="h-3 w-24 rounded-full bg-[var(--studio-accent)]" />
                  <div className="mt-5 h-7 w-3/4 rounded-lg bg-[var(--studio-text)] opacity-90" />
                  <div className="mt-3 h-2.5 w-full rounded-full bg-[var(--studio-border)]" />
                  <div className="mt-2 h-2.5 w-4/5 rounded-full bg-[var(--studio-border)]" />
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {[t('Design'), t('AI'), t('Publish')].map((label) => (
                      <div key={label} className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] px-2 py-3 text-center text-[10px] font-semibold text-[var(--studio-text-muted)]">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="mx-auto w-full max-w-md lg:mx-0">
            <Surface
              {...surfaceProps}
              aria-labelledby="auth-page-title"
              className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-6 shadow-[var(--studio-shadow)] min-[360px]:px-5 sm:p-8"
            >
              <div>
                <h1 id="auth-page-title" className="text-xl font-bold tracking-tight text-[var(--studio-text)] sm:text-2xl">
                  {title}
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-[var(--studio-text-muted)]">
                  {description}
                </p>
              </div>

              <div className="mt-6 space-y-5">
                {children}
              </div>

              {footer && (
                <div className="mt-6 border-t border-[var(--studio-border)] pt-5 text-center text-sm text-[var(--studio-text-muted)]">
                  {footer}
                </div>
              )}
            </Surface>
          </div>
        </div>
      </div>
    </main>
  )
}
