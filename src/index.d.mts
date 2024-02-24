declare module '@modernpoacher/halacious/utils' {
  import type Negotiator from 'negotiator'

  import type {
    HalaciousTypes
  } from '@modernpoacher/halacious'

  type Representation = HalaciousTypes.Representation

  export function getRepresentationSelf (arg: Representation): Record<string, unknown> | undefined

  export function hasRepresentationSelf (arg: Representation): boolean

  export function getRepresentationSelfHref (arg: Representation): string | undefined

  export function hasRepresentationSelfHref (arg: Representation): boolean

  export function getRepresentationEntity (arg: Representation): Record<string, unknown> | undefined

  export function hasRepresentationEntity (arg: Representation): boolean

  export function getRepresentationRequest (arg: Representation): Record<string, unknown> | undefined

  export function hasRepresentationRequest (arg: Representation): boolean

  export function getRepresentationRequestServer (arg: Representation): Record<string, unknown> | undefined

  export function hasRepresentationRequestServer (arg: Representation): boolean

  export function getRepresentationRequestPath (arg: Representation): string | undefined

  export function hasRepresentationRequestPath (arg: Representation): boolean

  export function getRepresentationRequestRoute (arg: Representation): Record<string, unknown> | undefined

  export function hasRepresentationRequestRoute (arg: Representation): boolean

  export function getRepresentationRequestRoutePath (arg: Representation): string | undefined

  export function hasRepresentationRequestRoutePath (arg: Representation): boolean

  export function getRepresentationRequestRouteMethod (arg: Representation): string | undefined

  export function hasRepresentationRequestRouteMethod (arg: Representation): boolean

  export function getRoutePath (arg: { path?: string }): string | undefined

  export function hasRoutePath (arg: { path?: string }): boolean

  export function getRouteSettings (arg: { settings?: Record<string, unknown> }): Record<string, unknown>

  export function getRouteSettingsIsInternal (arg: { settings?: { isInternal?: boolean } }): boolean

  export function getRouteSettingsPlugins (arg: { settings?: { plugins?: Record<string, unknown> } }): Record<string, unknown>

  export function getRouteSettingsPluginsHal (arg: { settings?: { plugins?: { hal?: Record<string, unknown> } } }): Record<string, unknown>

  export function getRouteSettingsPluginsHalApi (arg: { settings?: { plugins?: { hal?: { api?: Record<string, unknown> } } } }): Record<string, unknown> | null

  export function getRouteSettingsPluginsHalQuery (arg: { settings?: { plugins?: { hal?: { query?: string } } } }): string | null

  export function getRouteSettingsPluginsHalAbsolute (arg: { settings?: { plugins?: { hal?: { absolute?: boolean } } } }): boolean | null

  export function getRequestPath (arg: { path?: string }): string | undefined

  export function hasRequestPath (arg: { path?: string }): boolean

  export function getRequestMethod (arg: { method?: string }): string | undefined

  export function hasRequestMethod (arg: { method?: string }): boolean

  export function getRequestRoute (arg: { route?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasRequestRoute (arg: { route?: Record<string, unknown> }): boolean

  export function getRequestRoutePath (arg: { route?: { path?: string } }): string | undefined

  export function hasRequestRoutePath (arg: { route?: { path?: string } }): boolean

  export function getRequestRouteMethod (arg: { route?: { method?: string } }): string | undefined

  export function hasRequestRouteMethod (arg: { route?: { method?: string } }): boolean

  export function getRequestServer (arg: { server?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasRequestServer (arg: { server?: Record<string, unknown> }): boolean

  export function getRequestHeaders (arg: { headers?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasRequestHeaders (arg: { headers?: Record<string, unknown> }): boolean

  export function getRequestHeadersAccept (arg: { headers?: { accept?: string } }): string | undefined

  export function getRequestResponse (arg: { response?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasRequestResponse (arg: { response?: Record<string, unknown> }): boolean

  export function getRequestResponseSource (arg: { response?: { source?: Record<string, unknown> } }): Record<string, unknown> | undefined

  export function getRequestResponseHeaders (arg: { response?: { headers?: Record<string, unknown> } }): Record<string, unknown> | undefined

  export function getRequestResponseHeadersLocation (arg: { response?: { headers?: { location?: string } } }): string | undefined

  export function getResponseVariety (arg: { variety?: string }): string | undefined

  export function getResponseStatusCode (arg: { statusCode?: number }): number | undefined

  export function isResponseStatusCodeInSuccessRange (statusCode: number | undefined): boolean

  export function getFieldValueByPath (path?: string, context?: Record<string, unknown>): Record<string, unknown>

  export function getMediaType (request: { headers: Negotiator.Headers }, mediaTypes: string[]): string

  export function getTemplateContext (template: string, context: Record<string, unknown>): Record<string, unknown>

  export function getPath (arg: { path?: string }): string | undefined

  export function hasPath (arg: { path?: string }): boolean

  export function getMethod (arg: { method?: string }): string | undefined

  export function hasMethod (arg: { method?: string }): boolean

  export function getSelf (arg: { self?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasSelf (arg: { self?: Record<string, unknown> }): boolean

  export function getHref (arg: { href?: string }): string | undefined

  export function hasHref (arg: { href?: string }): boolean

  export function getServer (arg: { server?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasServer (arg: { server?: Record<string, unknown> }): boolean

  export function getRequest (arg: { request?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasRequest (arg: { request?: Record<string, unknown> }): boolean

  export function getResponse (arg: { response?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasResponse (arg: { response?: Record<string, unknown> }): boolean

  export function getSettings (arg: { settings?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasSettings (arg: { settings?: Record<string, unknown> }): boolean

  export function getHeaders (arg: { headers?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasHeaders (arg: { headers?: Record<string, unknown> }): boolean

  export function getEntity (arg: { entity?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasEntity (arg: { entity?: Record<string, unknown> }): boolean

  export function getRoute (arg: { route?: string }): string | undefined

  export function hasRoute (arg: { route?: string }): boolean

  export function getName (arg: { name?: string }): string | undefined

  export function hasName (arg: { name?: string }): boolean

  export function getPrefix (arg: { prefix?: string }): string | undefined

  export function hasPrefix (arg: { prefix?: string }): boolean

  export function getRels (arg: { rels?: Record<string, unknown> }): Record<string, unknown> | undefined

  export function hasRels (arg: { rels?: Record<string, unknown> }): boolean

  export function getAbsolute (arg: { absolute?: boolean }): boolean | undefined

  export function hasAbsolute (arg: { absolute?: boolean }): boolean

  export function getQuery (arg: { query?: string }): string | undefined

  export function hasQuery (arg: { query?: string }): boolean

  export function getIgnore (arg: { ignore?: string }): string | undefined

  export function hasIgnore (arg: { ignore?: string }): boolean

  export function isRelativePath (path?: string): boolean
}

declare module '@modernpoacher/halacious' {
  export namespace HalaciousTypes {
    interface Request {
      method?: string
      path?: string
      server: Record<string, unknown>
      route: {
        method?: string
        path?: string
      }
      params: Record<string, unknown>
    }

    export interface Representation {
      factory: RepresentationFactory
      request: Request
      self: string | { href?: string }
      entity: Record<string, unknown>
      ignore: (v: string) => undefined
      embed: (v: string, u: string, m: unknown[] | Record<string, unknown>) => undefined
    }

    export interface RepresentationFactory {
      create: (entity: Record<string, string | number | object>, self?: string | { href?: string }, root?: Representation) => Representation
    }
  }

  export const plugin: object
}
