import { useLayoutEffect, useState, type RefObject } from 'react'

import type { Size } from '../video/geometry'

const EMPTY_SIZE: Size = { width: 0, height: 0 }

export function useElementSize<T extends HTMLElement>(
  elementRef: RefObject<T | null>,
): Size {
  const [size, setSize] = useState<Size>(EMPTY_SIZE)

  useLayoutEffect(() => {
    const element = elementRef.current
    if (element === null) {
      return
    }

    const measure = () => {
      const bounds = element.getBoundingClientRect()
      setSize({ width: bounds.width, height: bounds.height })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => observer.disconnect()
  }, [elementRef])

  return size
}
