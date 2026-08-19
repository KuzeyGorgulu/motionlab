import {
  MIN_TEMPLATE_STANDARD_DEVIATION,
  standardDeviation,
} from './confidence'
import {
  commitAdaptiveTemplateUpdate,
  createAdaptiveTemplateState,
  locateWithAdaptiveTemplates,
} from './adaptiveTemplate'
import type { AdaptiveTemplateState } from './adaptiveTemplate'
import { grayscaleFromRgba } from './templateTracker'
import type {
  AssistedTracker,
  GrayImage,
  PixelRegion,
  SearchPixelRegion,
  TrackerInitializationResult,
  TrackingMatch,
} from './types'
import type {
  TrackerWorkerRequest,
  TrackerWorkerResponse,
} from './workerProtocol'

interface PendingRequest {
  resolve: (response: TrackerWorkerResponse) => void
}

class WorkerAssistedTracker implements AssistedTracker {
  private readonly worker: Worker
  private readonly pending = new Map<number, PendingRequest>()
  private nextRequestId = 1
  private disposed = false

  constructor() {
    this.worker = new Worker(new URL('./tracker.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (event: MessageEvent<TrackerWorkerResponse>) => {
      const pending = this.pending.get(event.data.requestId)
      if (pending === undefined) return
      this.pending.delete(event.data.requestId)
      pending.resolve(event.data)
    }
    this.worker.onerror = () => {
      this.resolvePendingAsWorkerFailure()
    }
    this.worker.onmessageerror = () => {
      this.resolvePendingAsWorkerFailure()
    }
  }

  private resolvePendingAsWorkerFailure() {
    for (const [requestId, pending] of this.pending) {
      pending.resolve({
        type: 'located',
        requestId,
        result: {
          status: 'invalid-frame',
          reason: 'The assisted-tracking worker failed.',
        },
      })
    }
    this.pending.clear()
  }

  private request(
    request: TrackerWorkerRequest & { requestId: number },
    transfer: Transferable[],
  ): Promise<TrackerWorkerResponse> {
    return new Promise((resolve) => {
      if (this.disposed) {
        resolve({
          type: 'located',
          requestId: request.requestId,
          result: {
            status: 'invalid-frame',
            reason: 'The assisted tracker has been disposed.',
          },
        })
        return
      }
      this.pending.set(request.requestId, { resolve })
      this.worker.postMessage(request, transfer)
    })
  }

  async initialize(
    template: PixelRegion,
  ): Promise<TrackerInitializationResult> {
    const requestId = this.nextRequestId++
    const response = await this.request(
      { type: 'initialize', requestId, template },
      [template.pixels.buffer as ArrayBuffer],
    )
    return response.type === 'initialized'
      ? response.result
      : { ok: false, reason: response.result.status === 'invalid-frame'
        ? response.result.reason
        : 'The assisted tracker could not initialize.' }
  }

  async locate(searchRegion: SearchPixelRegion): Promise<TrackingMatch> {
    const requestId = this.nextRequestId++
    const response = await this.request(
      { type: 'locate', requestId, searchRegion },
      [searchRegion.pixels.buffer as ArrayBuffer],
    )
    return response.type === 'located'
      ? response.result
      : {
          status: 'invalid-frame',
          reason: 'The worker returned an unexpected initialization response.',
        }
  }

  commitTemplateUpdate() {
    if (this.disposed) return
    this.worker.postMessage(
      { type: 'commit-template' } satisfies TrackerWorkerRequest,
    )
  }

  reset() {
    if (this.disposed) return
    this.worker.postMessage({ type: 'reset' } satisfies TrackerWorkerRequest)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.resolvePendingAsWorkerFailure()
    this.worker.terminate()
  }
}

class InlineAssistedTracker implements AssistedTracker {
  private state: AdaptiveTemplateState | null = null
  private pendingTemplateUpdate: GrayImage | null = null

  async initialize(
    templateRegion: PixelRegion,
  ): Promise<TrackerInitializationResult> {
    const template = grayscaleFromRgba(templateRegion)
    const texture = template === null ? null : standardDeviation(template.pixels)
    if (template === null) {
      return { ok: false, reason: 'The seed patch contains invalid pixel data.' }
    }
    if (texture === null || texture < MIN_TEMPLATE_STANDARD_DEVIATION) {
      return {
        ok: false,
        reason: 'The seed patch is too flat or featureless to track reliably.',
      }
    }
    this.state = createAdaptiveTemplateState(template)
    this.pendingTemplateUpdate = null
    return { ok: true }
  }

  async locate(searchRegion: SearchPixelRegion): Promise<TrackingMatch> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    this.pendingTemplateUpdate = null
    const search = grayscaleFromRgba(searchRegion)
    if (this.state === null || search === null) {
      return {
        status: 'invalid-frame',
        reason: this.state === null
          ? 'The assisted tracker has not been initialized.'
          : 'The search region contains invalid pixel data.',
      }
    }
    const outcome = locateWithAdaptiveTemplates(
      this.state,
      search,
      searchRegion,
    )
    this.pendingTemplateUpdate = outcome.pendingTemplateUpdate
    return outcome.result
  }

  commitTemplateUpdate() {
    if (this.state === null) return
    this.state = commitAdaptiveTemplateUpdate(
      this.state,
      this.pendingTemplateUpdate,
    )
    this.pendingTemplateUpdate = null
  }

  reset() {
    this.state = null
    this.pendingTemplateUpdate = null
  }

  dispose() {
    this.reset()
  }
}

export function createBrowserAssistedTracker(): AssistedTracker {
  try {
    return new WorkerAssistedTracker()
  } catch {
    return new InlineAssistedTracker()
  }
}
