import {
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
} from '../Icons'
import { FALLBACK_FRAME_RATE, formatTimestamp } from '../../video/timing'

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

interface TransportControlsProps {
  currentTime: number
  duration: number | null
  isPlaying: boolean
  playbackRate: number
  controlsEnabled: boolean
  timelineEnabled: boolean
  onTogglePlayback: () => Promise<void>
  onSeek: (time: number) => void
  onStep: (direction: -1 | 1) => void
  onPlaybackRateChange: (rate: number) => void
}

export function TransportControls({
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  controlsEnabled,
  timelineEnabled,
  onTogglePlayback,
  onSeek,
  onStep,
  onPlaybackRateChange,
}: TransportControlsProps) {
  return (
    <section className="transport" aria-label="Video transport controls">
      <div className="timeline-row">
        <output className="timecode" aria-label="Current timestamp">
          {formatTimestamp(currentTime)}
        </output>
        <input
          aria-label="Video timeline"
          className="timeline"
          disabled={!timelineEnabled}
          max={duration ?? 1}
          min="0"
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          step="0.001"
          type="range"
          value={timelineEnabled ? Math.min(currentTime, duration ?? 0) : 0}
        />
        <output className="timecode timecode--duration" aria-label="Total duration">
          {formatTimestamp(duration)}
        </output>
      </div>

      <div className="transport__lower">
        <div className="transport__buttons">
          <button
            aria-label="Step backward by approximately one frame"
            className="transport-button"
            disabled={!controlsEnabled}
            onClick={() => onStep(-1)}
            title="Step backward approximately one frame (Left arrow)"
            type="button"
          >
            <StepBackIcon />
          </button>
          <button
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            className="transport-button transport-button--primary"
            disabled={!controlsEnabled}
            onClick={() => void onTogglePlayback()}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            type="button"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            aria-label="Step forward by approximately one frame"
            className="transport-button"
            disabled={!controlsEnabled}
            onClick={() => onStep(1)}
            title="Step forward approximately one frame (Right arrow)"
            type="button"
          >
            <StepForwardIcon />
          </button>
        </div>

        <div className="transport__status" title="Browser video seeking does not guarantee exact adjacent-frame decoding">
          <span className="status-dot" aria-hidden="true" />
          <span>
            Step ≈ {(1000 / FALLBACK_FRAME_RATE).toFixed(1)} ms
          </span>
          <span className="separator" aria-hidden="true">/</span>
          <span>{FALLBACK_FRAME_RATE} fps fallback</span>
        </div>

        <label className="rate-control">
          <span>Playback</span>
          <select
            aria-label="Playback speed"
            disabled={!controlsEnabled}
            onChange={(event) => onPlaybackRateChange(Number(event.currentTarget.value))}
            value={playbackRate}
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
