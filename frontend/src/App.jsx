import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import LanguageProvider from './i18n/LanguageProvider.jsx'
import { useLanguage } from './i18n/useLanguage.js'
import UiThemeProvider from './ui/UiThemeProvider.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { rememberVisit } from './utils/lastVisited.js'

// The editor and the public preview are the heaviest screens — together they
// pull in the entire renderer, all eight AI templates, the schema validators,
// the responsive HTML emitter, and the iframe runtime. Visitors who only land
// on /login, /register, or /  (the dashboard) shouldn't pay for any of that
// up front. React.lazy splits each off into its own chunk that streams in only
// when the matching route mounts; the Suspense fallback keeps the UI from
// flashing blank between chunks.
const EditorPage = lazy(() => import('./pages/EditorPage.jsx'))
const PreviewPage = lazy(() => import('./pages/PreviewPage.jsx'))
const CodeProjectPage = lazy(() => import('./pages/CodeProjectPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage.jsx'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage.jsx'))
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const ReviewPage = lazy(() => import('./pages/ReviewPage.jsx'))

// Records every ordinary page the user visits, so a workspace can send them
// back out to where they actually were rather than one history step back —
// which, from the editor, is usually another editor.
function VisitTracker() {
  const location = useLocation()
  rememberVisit(location.pathname)
  return null
}

function FullScreenLoading() {
  const { t } = useLanguage()
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
      {t('Loading…')}
    </div>
  )
}

function ThemedPage({ children }) {
  return <div className="app-theme-surface contents">{children}</div>
}

export default function App() {
  return (
    <UiThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          {/* Inside the router so it can key itself on the path, and around
              Suspense so a chunk that fails to load is caught too. */}
          <VisitTracker />
          <AppErrorBoundary>
            <Suspense fallback={<FullScreenLoading />}>
              <Routes>
          <Route path="/login" element={<ThemedPage><LoginPage /></ThemedPage>} />
          <Route path="/register" element={<ThemedPage><RegisterPage /></ThemedPage>} />
          <Route path="/forgot-password" element={<ThemedPage><ForgotPasswordPage /></ThemedPage>} />
          <Route path="/reset-password" element={<ThemedPage><ResetPasswordPage /></ThemedPage>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ThemedPage><ExplorePage /></ThemedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/editor/:id"
            element={
              <ProtectedRoute>
                <EditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/code"
            element={
              <ProtectedRoute>
                <ThemedPage><CodeProjectPage /></ThemedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ThemedPage><ProfilePage /></ThemedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <ThemedPage><FavoritesPage /></ThemedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <ThemedPage><AdminPage /></ThemedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute>
                <ThemedPage><SettingsPage /></ThemedPage>
              </ProtectedRoute>
            }
          />
          <Route path="/site/:slug" element={<PreviewPage />} />
          <Route path="/review/:token" element={<ThemedPage><ReviewPage /></ThemedPage>} />
          <Route path="/u/:id" element={<ThemedPage><PublicProfilePage /></ThemedPage>} />
          <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AppErrorBoundary>
        </BrowserRouter>
      </LanguageProvider>
    </UiThemeProvider>
  )
}
