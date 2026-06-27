/**
 * Haptic feedback.
 *
 * Android/Chrome use the Vibration API. iOS Safari does NOT support
 * navigator.vibrate at all, so on iPhone we fall back to a hidden
 * `<input type="checkbox" switch>` — toggling an iOS switch control emits a
 * subtle system haptic (iOS 17.4+, including standalone home-screen PWAs).
 * Everything degrades to a silent no-op where unsupported.
 *
 * Note: the haptic only fires when triggered inside a user gesture (a tap
 * handler), which is how all of these are called.
 */

let iosHapticLabel: HTMLLabelElement | null = null

function getIosHapticLabel(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null
  if (iosHapticLabel) return iosHapticLabel

  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText =
    'position:absolute;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;'

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '') // the iOS toggle that produces the haptic
  label.appendChild(input)

  document.body.appendChild(label)
  iosHapticLabel = label
  return label
}

function supportsVibrate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
}

/** Fire a haptic. `iosPulses` controls how many switch toggles on iOS. */
function pulse(pattern: number | number[], iosPulses = 1) {
  if (supportsVibrate()) {
    try {
      navigator.vibrate(pattern)
    } catch {
      // ignore — haptics are best-effort
    }
    return
  }

  // iOS fallback
  const label = getIosHapticLabel()
  if (!label) return
  // First toggle is synchronous (inside the gesture) so it's guaranteed to
  // fire; extra pulses are best-effort for stronger moments.
  label.click()
  for (let i = 1; i < iosPulses; i++) {
    setTimeout(() => label.click(), i * 90)
  }
}

/** Quick tick for small interactions (completing a set, toggling). */
export function hapticTap() {
  pulse(10, 1)
}

/** Stronger double-pulse for successes (workout saved, PR hit). */
export function hapticSuccess() {
  pulse([100, 50, 100], 2)
}

/** Long celebration pattern for big moments (new personal record). */
export function hapticCelebrate() {
  pulse([100, 50, 100, 50, 200], 3)
}
