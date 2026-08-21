export type MotionLabRoute = 'landing' | 'app'

export function resolveMotionLabRoute(pathname: string): MotionLabRoute {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  return normalizedPath === '/app' ? 'app' : 'landing'
}
