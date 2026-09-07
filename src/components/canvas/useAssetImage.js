import { useEffect, useState } from 'react'

// Load an image asset for canvas rendering.
// Returns { image, failed }: while loading (or when loading is impossible,
// e.g. missing src / jsdom) the caller renders a placeholder outline + type
// label instead (08 §17) and never blocks.
export function useAssetImage(src) {
  const loadable =
    Boolean(src) && typeof window !== 'undefined' && typeof window.Image === 'function'
  const [loaded, setLoaded] = useState({ src, image: null, error: false })

  // Reset when the source changes (render-phase adjustment, no extra effect).
  if (loaded.src !== src) {
    setLoaded({ src, image: null, error: false })
  }

  useEffect(() => {
    if (!loadable) {
      return undefined
    }
    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (!cancelled) {
        setLoaded({ src, image: img, error: false })
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        setLoaded({ src, image: null, error: true })
      }
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src, loadable])

  return { image: loaded.image, failed: !loadable || loaded.error }
}
