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

export function getRepresentationRequestPath (representation) {
  return getPath(getRepresentationRequest(representation))
}

export function hasRepresentationRequestPath (representation) {
  return hasPath(getRepresentationRequest(representation))
}

export function getRoutePath (route) {
  return getPath(route)
}

export function hasRoutePath (route) {
  return hasPath(route)
}

export function getRouteSettings ({ settings = {} }) {
  return settings
}

export function getRouteSettingsIsInternal (route) {
  const {
    isInternal = false
  } = getRouteSettings(route)

  return isInternal
}

export function getRouteSettingsPlugins (route) {
  const {
    plugins = {}
  } = getRouteSettings(route)

  return plugins
}

export function getRouteSettingsPluginsHal (route) {
  const {
    hal = {}
  } = getRouteSettingsPlugins(route)

  return hal
}

export function getRouteSettingsPluginsHalApi (route) {
  const {
    api = null
  } = getRouteSettingsPluginsHal(route)

  return api
}

export function getRouteSettingsPluginsHalQuery (route) {
  const {
    query = null
  } = getRouteSettingsPluginsHal(route)

  return query
}

export function getRouteSettingsPluginsHalAbsolute (route) {
  const {
    absolute = null
  } = getRouteSettingsPluginsHal(route)

  return absolute
}

export function getRequestPath (request) {
  return getPath(request)
}

export function hasRequestPath (request) {
  return hasPath(request)
}

export function getRequestRoute (request) {
  return getRoute(request)
}

export function hastRequestRoute (request) {
  return hasRoute(request)
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
  } = getRequestHeaders(request)

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
  } = getRequestResponse(request)

  return source
}

export function getRequestResponseHeaders (request) {
  return getHeaders(getRequestResponse(request))
}

export function getRequestResponseHeadersLocation (request) {
  const {
    location
  } = getRequestResponseHeaders(request)

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

function getPath ({ path }) {
  return path
}

function hasPath (arg) {
  return Boolean(getPath(arg))
}

function getSelf ({ self }) {
  return self
}

function hasSelf (arg) {
  return Boolean(getSelf(arg))
}

function getHref ({ href }) {
  return href
}

function hasHref (arg) {
  return Boolean(getHref(arg))
}

function getServer ({ server }) {
  return server
}

function hasServer (arg) {
  return Boolean(getServer(arg))
}

function getRequest ({ request }) {
  return request
}

function hasRequest (arg) {
  return Boolean(getRequest(arg))
}

function getResponse ({ response }) {
  return response
}

function hasResponse (arg) {
  return Boolean(getResponse(arg))
}

function getHeaders ({ headers }) {
  return headers
}

function hasHeaders (arg) {
  return Boolean(getHeaders(arg))
}

function getEntity ({ entity }) {
  return entity
}

function hasEntity (arg) {
  return Boolean(getEntity(arg))
}

function getRoute ({ route }) {
  return route
}

function hasRoute (arg) {
  return Boolean(getRoute(arg))
}
