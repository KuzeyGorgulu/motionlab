export interface ShortcutItem {
  keys: string
  description: string
}

export interface ShortcutGroup {
  title: string
  items: readonly ShortcutItem[]
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Playback',
    items: [
      { keys: 'Space', description: 'Play or pause' },
      { keys: 'Left / Right', description: 'Step backward or forward by approximately one frame' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { keys: 'V', description: 'Select and edit annotations' },
      { keys: 'P', description: 'Create a point annotation' },
      { keys: 'L', description: 'Create a line annotation' },
      { keys: 'A', description: 'Create an angle annotation' },
      { keys: 'T', description: 'Start or stop Track Mark' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: 'Delete / Backspace', description: 'Delete the current track point or selected annotation' },
      { keys: 'Escape', description: 'Cancel the active interaction or stop assisted tracking' },
      { keys: 'Ctrl/Cmd + Z', description: 'Undo in the active editing domain' },
      { keys: 'Ctrl/Cmd + Shift + Z', description: 'Redo in the active editing domain' },
      { keys: 'Ctrl/Cmd + Y', description: 'Redo in the active editing domain' },
    ],
  },
  {
    title: 'Help',
    items: [
      { keys: '?', description: 'Open Keyboard Shortcuts' },
    ],
  },
]

export interface ExperimentExample {
  id: string
  title: string
  demonstrates: string
  workflow: string
  inspect: string
  bundled: boolean
}

export const EXPERIMENT_EXAMPLES: readonly ExperimentExample[] = [
  {
    id: 'constant-speed',
    title: 'Constant-Speed Motion',
    demonstrates: 'Linear motion, calibrated position, velocity, and residual analysis.',
    workflow: 'Review the bundled track, inspect Position and Velocity, then fit a constant-velocity model.',
    inspect: 'Velocity components, model parameters, R², residual magnitude, and the report preview.',
    bundled: true,
  },
  {
    id: 'bouncing-ball',
    title: 'Bouncing Ball',
    demonstrates: 'Calibration, changing velocity, acceleration, model fitting, and fit deviations.',
    workflow: 'Film side-on, calibrate in the motion plane, and track the ball center through a bounce.',
    inspect: 'Vertical position and velocity, acceleration, fitted motion segments, and residuals near impact.',
    bundled: false,
  },
  {
    id: 'projectile',
    title: 'Projectile / Tossed Object',
    demonstrates: 'Two-dimensional tracking, coordinate axes, and component motion graphs.',
    workflow: 'Keep the camera fixed, define a horizontal X axis, and track one consistent point on the object.',
    inspect: 'X/Y position, velocity components, trajectory shape, and constant-acceleration fit quality.',
    bundled: false,
  },
]
