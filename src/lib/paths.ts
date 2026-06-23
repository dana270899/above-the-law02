const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export const routerBasename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL

export function assetUrl(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export function appPath(path: string): string {
  return assetUrl(path)
}
