import { useCallback, useLayoutEffect, useRef } from 'react'

const FOCUSABLE = 'button, a[href], input:not([type="hidden"]), select, textarea, iframe, [tabindex]'

function focusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter((element) => {
    const style = window.getComputedStyle(element)
    return element.tabIndex >= 0 && !element.disabled &&
      !element.closest('[hidden], [inert]') &&
      style.display !== 'none' && style.visibility !== 'hidden'
  })
}

function collapsedTransform(dialog, origin) {
  const rect = dialog.getBoundingClientRect()
  if (!origin || !rect.width || !rect.height || !origin.width || !origin.height) {
    return 'translateY(18px) scale(0.94)'
  }
  const x = origin.left + origin.width / 2 - rect.left - rect.width / 2
  const y = origin.top + origin.height / 2 - rect.top - rect.height / 2
  const scaleX = Math.max(0.04, Math.min(1, origin.width / rect.width))
  const scaleY = Math.max(0.04, Math.min(1, origin.height / rect.height))
  return `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function runAnimation(state, element, frames, options) {
  if (!element?.animate) return null
  const animation = element.animate(frames, options)
  state.animations.add(animation)
  // Cancelling a WAAPI animation rejects its finished promise.
  animation.finished.then(() => {
    state.animations.delete(animation)
    animation.cancel()
  }, () => state.animations.delete(animation))
  return animation
}

/** Animate a mounted dialog from its trigger without delaying reduced-motion users. */
export function useDialogMotion({ open, origin, disabled = false, onClose }) {
  const dialogRef = useRef(null)
  const backdropRef = useRef(null)
  const runtimeRef = useRef(null)
  const optionsRef = useRef(null)

  useLayoutEffect(() => {
    optionsRef.current = { origin, disabled, onClose }
  }, [origin, disabled, onClose])

  useLayoutEffect(() => {
    if (!open || !dialogRef.current) return undefined
    const dialog = dialogRef.current
    const backdrop = backdropRef.current
    const initialOrigin = optionsRef.current.origin
    const trigger = initialOrigin?.trigger || document.activeElement
    const state = { active: true, closing: false, animations: new Set() }
    runtimeRef.current = state

    const body = document.body
    const originalOverflow = body.style.overflow
    const originalPadding = body.style.paddingRight
    const scrollbar = document.documentElement.clientWidth > 0
      ? Math.max(0, window.innerWidth - document.documentElement.clientWidth)
      : 0
    if (scrollbar) {
      body.style.paddingRight = `${parseFloat(window.getComputedStyle(body).paddingRight || '0') + scrollbar}px`
    }
    body.style.overflow = 'hidden'

    if (!dialog.contains(document.activeElement)) {
      const firstInput = dialog.querySelector('input:not([type="hidden"]):not(:disabled), textarea:not(:disabled)')
      const target = firstInput || focusableElements(dialog)[0] || dialog
      target.focus({ preventScroll: true })
    }

    if (!prefersReducedMotion()) {
      runAnimation(state, dialog, [
        { transform: collapsedTransform(dialog, initialOrigin), opacity: 0.2 },
        { transform: 'none', opacity: 1 },
      ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' })
      runAnimation(state, backdrop, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 240, easing: 'ease-out', fill: 'both',
      })
    }

    return () => {
      state.active = false
      for (const animation of state.animations) animation.cancel()
      state.animations.clear()
      if (runtimeRef.current === state) runtimeRef.current = null
      body.style.overflow = originalOverflow
      body.style.paddingRight = originalPadding
      if (trigger?.isConnected && !dialog.contains(trigger)) trigger.focus?.({ preventScroll: true })
    }
  }, [open])

  const requestClose = useCallback(() => {
    const state = runtimeRef.current
    const options = optionsRef.current
    const dialog = dialogRef.current
    if (!state?.active || state.closing || options.disabled) return
    state.closing = true

    if (prefersReducedMotion() || !dialog?.animate) {
      options.onClose?.()
      return
    }

    // Read the visual position before cancelling entry, including a fast second click.
    const current = window.getComputedStyle(dialog)
    const transform = current.transform
    const opacity = current.opacity
    const backdrop = backdropRef.current
    const backdropOpacity = backdrop ? window.getComputedStyle(backdrop).opacity : '1'
    for (const animation of state.animations) animation.cancel()
    state.animations.clear()

    const animation = runAnimation(state, dialog, [
      { transform: transform === 'none' ? 'none' : transform, opacity },
      { transform: collapsedTransform(dialog, options.origin), opacity: 0 },
    ], { duration: 200, easing: 'cubic-bezier(.4,0,.8,.2)', fill: 'both' })
    runAnimation(state, backdrop, [{ opacity: backdropOpacity }, { opacity: 0 }], {
      duration: 200, easing: 'ease-in', fill: 'both',
    })
    animation.finished.then(() => {
      if (state.active) optionsRef.current.onClose?.()
    }, () => {})
  }, [])

  const onKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      requestClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const elements = focusableElements(dialogRef.current)
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (!first) {
      event.preventDefault()
      dialogRef.current.focus({ preventScroll: true })
    } else if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement))) {
      event.preventDefault()
      last.focus({ preventScroll: true })
    } else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement))) {
      event.preventDefault()
      first.focus({ preventScroll: true })
    }
  }, [requestClose])

  return { dialogRef, backdropRef, requestClose, onKeyDown }
}
