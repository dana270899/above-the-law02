const base = import.meta.env.BASE_URL.replace(/\/$/, '')

const localGithubPagesPrefix = '/above-the-law02'
const runtimeRouterBase =
  import.meta.env.BASE_URL === '/' &&
  (window.location.pathname === localGithubPagesPrefix ||
    window.location.pathname.startsWith(`${localGithubPagesPrefix}/`))
    ? localGithubPagesPrefix
    : base

export const routerBasename = runtimeRouterBase || undefined

export function assetUrl(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export function appPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${runtimeRouterBase}${normalizedPath}`
}
