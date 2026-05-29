import {
  createRouter,
  createRoute,
  createRootRouteWithContext,
  redirect,
} from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import { supabase } from './lib/supabase'
import { EditorPage } from './pages/EditorPage'
import { GalleryPage } from './pages/GalleryPage'
import { ViewerPage } from './pages/ViewerPage'

export interface RouterContext {
  session: Session | null
}

// Root route — App is the layout shell (nav + Outlet)
const rootRoute = createRootRouteWithContext<RouterContext>()({ component: App })

// / → /editor (exchange Supabase PKCE code before redirecting so the URL isn't stripped)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code && supabase) {
      await supabase.auth.exchangeCodeForSession(code)
    }
    throw redirect({ to: '/editor' })
  },
})

// /editor — no courseId: EditorPage loads last course and navigates to /editor/:courseId
const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/editor',
  component: EditorPage,
})

// /editor/:courseId — editor with a specific course
const editorCourseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/editor/$courseId',
  component: EditorPage,
})

// /gallery — community gallery grid
const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: GalleryPage,
})

// /view/:courseId — read-only orbital viewer
const viewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/view/$courseId',
  component: ViewerPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  editorRoute,
  editorCourseRoute,
  galleryRoute,
  viewerRoute,
])

export const router = createRouter({
  routeTree,
  context: { session: null },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
