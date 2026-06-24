import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'

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

function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ExplorePage />
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
                <CodeProjectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/site/:slug" element={<PreviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
