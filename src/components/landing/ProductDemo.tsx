import { useRef, useState } from 'react'

const DEMO_VIDEO_URL = '/demo/motionlab-demo.mp4'
const DEMO_POSTER_URL = '/demo/motionlab-demo-poster.jpg'
const DEMO_YOUTUBE_URL = 'https://www.youtube.com/watch?v=guZrnA7kIt8'

export function ProductDemo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasStarted, setHasStarted] = useState(false)

  const startPlayback = () => {
    const video = videoRef.current

    if (video === null) return

    setHasStarted(true)
    void video.play().catch(() => {
      setHasStarted(false)
    })
  }

  return (
    <div className="landing-product-demo__player">
      <div className="landing-product-demo__frame">
        <div className="landing-product-demo__viewport">
          <video
            ref={videoRef}
            aria-label="MotionLab product demo"
            controls={hasStarted}
            onPlay={() => setHasStarted(true)}
            playsInline
            poster={DEMO_POSTER_URL}
            preload="none"
          >
            <source src={DEMO_VIDEO_URL} type="video/mp4" />
            Your browser does not support embedded video.{' '}
            <a href={DEMO_VIDEO_URL}>Download the MotionLab demo</a> instead.
          </video>

          {!hasStarted && (
            <button
              className="landing-product-demo__play"
              type="button"
              aria-label="Play the MotionLab product demo"
              onClick={startPlayback}
            >
              <span className="landing-product-demo__play-content" aria-hidden="true">
                <span className="landing-product-demo__play-icon">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M8.5 5.3v13.4L19 12 8.5 5.3Z" />
                  </svg>
                </span>
                <span>Play demo</span>
              </span>
            </button>
          )}
        </div>
      </div>

      <a
        className="landing-product-demo__youtube"
        href={DEMO_YOUTUBE_URL}
        aria-label="Watch on YouTube (opens in a new tab)"
        target="_blank"
        rel="noopener noreferrer"
      >
        Watch on YouTube <span aria-hidden="true">↗</span>
      </a>
    </div>
  )
}
