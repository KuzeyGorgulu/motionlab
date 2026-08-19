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
import type { GrayImage } from './types'
import type {
  TrackerWorkerRequest,
  TrackerWorkerResponse,
} from './workerProtocol'

let templateState: AdaptiveTemplateState | null = null
let pendingTemplateUpdate: GrayImage | null = null

self.onmessage = (event: MessageEvent<TrackerWorkerRequest>) => {
  const request = event.data

  if (request.type === 'reset') {
    templateState = null
    pendingTemplateUpdate = null
    return
  }

  if (request.type === 'commit-template') {
    if (templateState !== null) {
      templateState = commitAdaptiveTemplateUpdate(
        templateState,
        pendingTemplateUpdate,
      )
    }
    pendingTemplateUpdate = null
    return
  }

  if (request.type === 'initialize') {
    const nextTemplate = grayscaleFromRgba(request.template)
    const texture =
      nextTemplate === null ? null : standardDeviation(nextTemplate.pixels)
    const result =
      nextTemplate === null
        ? { ok: false as const, reason: 'The seed patch contains invalid pixel data.' }
        : texture === null || texture < MIN_TEMPLATE_STANDARD_DEVIATION
          ? {
              ok: false as const,
              reason: 'The seed patch is too flat or featureless to track reliably.',
            }
          : { ok: true as const }

    templateState = result.ok && nextTemplate !== null
      ? createAdaptiveTemplateState(nextTemplate)
      : null
    pendingTemplateUpdate = null
    const response: TrackerWorkerResponse = {
      type: 'initialized',
      requestId: request.requestId,
      result,
    }
    self.postMessage(response)
    return
  }

  const search = grayscaleFromRgba(request.searchRegion)
  pendingTemplateUpdate = null
  const result =
    templateState === null
      ? {
          status: 'invalid-frame' as const,
          reason: 'The assisted tracker has not been initialized.',
        }
      : search === null
        ? {
            status: 'invalid-frame' as const,
            reason: 'The search region contains invalid pixel data.',
          }
        : (() => {
            const outcome = locateWithAdaptiveTemplates(
              templateState,
              search,
              request.searchRegion,
            )
            pendingTemplateUpdate = outcome.pendingTemplateUpdate
            return outcome.result
          })()
  const response: TrackerWorkerResponse = {
    type: 'located',
    requestId: request.requestId,
    result,
  }
  self.postMessage(response)
}
