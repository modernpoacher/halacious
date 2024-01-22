export function getRepresentationSelf (representation) {
  return getSelf(representation)
}

export function hasRepresentationSelf (representation) {
  return hasSelf(representation)
}

export function getRepresentationSelfHref (representation) {
  return getHref(getRepresentationSelf(representation))
}

export function hasRepresentationSelfHref (representation) {
  return hasHref(getRepresentationSelf(representation))
}

export function getRepresentationEntity (representation) {
  return getEntity(representation)
}

export function hasRepresentationEntity (representation) {
  return hasEntity(representation)
}

export function getRepresentationRequest (representation) {
  return getRequest(representation)
}

export function hasRepresentationRequest (representation) {
  return hasRequest(representation)
}

export function getRepresentationRequestServer (representation) {
  return getServer(getRepresentationRequest(representation))
}

export function hasRepresentationRequestServer (representation) {
  return hasServer(getRepresentationRequest(representation))
}

export function getRepresentationRequestPath (representation) {
  return getPath(getRepresentationRequest(representation))
}

export function hasRepresentationRequestPath (representation) {
  return hasPath(getRepresentationRequest(representation))
}

export function getRepresentationRequestRoute (representation) {
  return getRoute(getRepresentationRequest(representation))
}

export function hasRepresentationRequestRoute (representation) {
  return hasRoute(getRepresentationRequest(representation))
}

export function getRepresentationRequestRoutePath (representation) {
  return getPath(getRepresentationRequestRoute(representation))
}

export function hasRepresentationRequestRoutePath (representation) {
  return hasPath(getRepresentationRequestRoute(representation))
}

export function getRepresentationRequestRouteMethod (representation) {
  return getMethod(getRepresentationRequestRoute(representation))
}

export function hasRepresentationRequestRouteMethod (representation) {
  return hasMethod(getRepresentationRequestRoute(representation))
}

export function getRoutePath (route) {
  return getPath(route)
}

export function hasRoutePath (route) {
  return hasPath(route)
}

export function getRouteSettings (route) {
  return getSettings(route)
}

export function hasRouteSettings (route) {
  return hasSettings(route)
}

export function getRouteSettingsIsInternal (route) {
  const {
    isInternal = false
  } = getRouteSettings(route) // ?? {}

  return isInternal
}

export function getRouteSettingsPlugins (route) {
  const {
    plugins = {}
  } = getRouteSettings(route) // ?? {}

  return plugins
}

export function getRouteSettingsPluginsHal (route) {
  const {
    hal = {}
  } = getRouteSettingsPlugins(route) // ?? {}

  return hal
}

export function getRouteSettingsPluginsHalApi (route) {
  const {
    api = null
  } = getRouteSettingsPluginsHal(route) // ?? {}

  return api
}

export function getRouteSettingsPluginsHalQuery (route) {
  return getQuery(getRouteSettingsPluginsHal(route)) || null
}

export function getRouteSettingsPluginsHalAbsolute (route) {
  return getAbsolute(getRouteSettingsPluginsHal(route)) || null
}

export function getRequestPath (request) {
  return getPath(request)
}

export function hasRequestPath (request) {
  return hasPath(request)
}

export function getRequestMethod (request) {
  return getMethod(request)
}

export function hasRequestMethod (request) {
  return hasMethod(request)
}

export function getRequestRoute (request) {
  return getRoute(request)
}

export function hasRequestRoute (request) {
  return hasRoute(request)
}

export function getRequestRoutePath (request) {
  return getPath(getRequestRoute(request))
}

export function hasRequestRoutePath (request) {
  return hasPath(getRequestRoute(request))
}

export function getRequestRouteMethod (request) {
  return getMethod(getRequestRoute(request))
}

export function hasRequestRouteMethod (request) {
  return hasMethod(getRequestRoute(request))
}

export function getRequestServer (request) {
  return getServer(request)
}

export function hasRequestServer (request) {
  return hasServer(request)
}

export function getRequestHeaders (request) {
  return getHeaders(request)
}

export function hasRequestHeaders (request) {
  return hasHeaders(request)
}

export function getRequestHeadersAccept (request) {
  const {
    accept
  } = getRequestHeaders(request) ?? {}

  return accept
}

export function getRequestResponse (request) {
  return getResponse(request)
}

export function hasRequestResponse (request) {
  return hasResponse(request)
}

export function getRequestResponseSource (request) {
  const {
    source
  } = getRequestResponse(request) ?? {}

  return source
}

export function getRequestResponseHeaders (request) {
  return getHeaders(getRequestResponse(request))
}

export function getRequestResponseHeadersLocation (request) {
  const {
    location
  } = getRequestResponseHeaders(request) ?? {}

  return location
}

export function getResponseVariety ({ variety }) {
  return variety
}

export function getResponseStatusCode ({ statusCode }) {
  return statusCode
}

export function isResponseStatusCodeInSuccessRange (statusCode) {
  return statusCode >= 200 && statusCode < 300
}

export { default as getFieldValueByPath } from './utils/getFieldValueByPath.mjs'

export { default as getMediaType } from './utils/getMediaType.mjs'

export { default as getTemplateContext } from './utils/getTemplateContext.mjs'

export function getPath ({ path }) {
  return path
}

export function hasPath (arg) {
  return Boolean(getPath(arg))
}

export function getMethod ({ method }) {
  return method
}

export function hasMethod (arg) {
  return Boolean(getMethod(arg))
}

export function getSelf ({ self }) {
  return self
}

export function hasSelf (arg) {
  return Boolean(getSelf(arg))
}

export function getHref ({ href }) {
  return href
}

export function hasHref (arg) {
  return Boolean(getHref(arg))
}

export function getServer ({ server }) {
  return server
}

export function hasServer (arg) {
  return Boolean(getServer(arg))
}

export function getRequest ({ request }) {
  return request
}

export function hasRequest (arg) {
  return Boolean(getRequest(arg))
}

export function getResponse ({ response }) {
  return response
}

export function hasResponse (arg) {
  return Boolean(getResponse(arg))
}

export function getSettings ({ settings }) {
  return settings
}

export function hasSettings (arg) {
  return Boolean(getSettings(arg))
}

export function getHeaders ({ headers }) {
  return headers
}

export function hasHeaders (arg) {
  return Boolean(getHeaders(arg))
}

export function getEntity ({ entity }) {
  return entity
}

export function hasEntity (arg) {
  return Boolean(getEntity(arg))
}

export function getRoute ({ route }) {
  return route
}

export function hasRoute (arg) {
  return Boolean(getRoute(arg))
}

export function getName ({ name }) {
  return name
}

export function hasName (arg) {
  return Boolean(getName(arg))
}

export function getPrefix ({ prefix }) {
  return prefix
}

export function hasPrefix (arg) {
  return Boolean(getPrefix(arg))
}

export function getRels ({ rels }) {
  return rels
}

export function hasRels (arg) {
  return Boolean(getRels(arg))
}

export function getAbsolute ({ absolute }) {
  return absolute
}

export function hasAbsolute (arg) {
  return Boolean(getAbsolute(arg))
}

export function getQuery ({ query }) {
  return query
}

export function hasQuery (arg) {
  return Boolean(getQuery(arg))
}

export function getIgnore ({ ignore }) {
  return ignore
}

export function hasIgnore (arg) {
  return Boolean(getIgnore(arg))
}

export function isRelativePath (path = '') {
  const p = String(path ?? '')

  return (
    p.startsWith('./') ||
    p.startsWith('../')
  )
}
