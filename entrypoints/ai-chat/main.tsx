import { getLegacyRedirectHref } from '@/features/navigation/lib/pageNavigation'

const redirectToApp = (
  pathname = window.location.pathname,
  search = window.location.search,
  replace: (href: string) => void = href => window.location.replace(href),
) => {
  const nextHref = getLegacyRedirectHref(pathname, search)
  replace(nextHref)
  return nextHref
}

document.addEventListener('DOMContentLoaded', () => {
  redirectToApp()
})

export { redirectToApp }
