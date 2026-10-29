const flag = 'movenow.onboarded'

// localStorage kann fehlen oder werfen (privates Fenster): dann läuft das Onboarding bei jedem Start.
export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(flag) === '1'
  } catch {
    return false
  }
}

export function finishOnboarding() {
  try {
    localStorage.setItem(flag, '1')
  } catch {
    // nichts zu tun
  }
}
