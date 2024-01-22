/**
 * @typedef {import('@modernpoacher/halacious').HalaciousTypes.Representation} Representation
 */

import joi from 'joi'
import * as boom from '@hapi/boom'
import * as hoek from '@hapi/hoek'
import {
  readdirSync,
  readFileSync
} from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import url from 'node:url'
import _ from 'lodash'
import pug from 'pug'
import async from 'async'
import {
  marked
} from 'marked'
import debug from 'debug'
import URI from 'urijs'
import * as urlTemplate from 'url-template'
import URITemplate from 'urijs/src/URITemplate.js'

import PKG from '#package' assert { type: 'json' }
import IAM from '#where-am-i'

import RepresentationFactory from './representation.mjs'

import {
  getRepresentationEntity,
  getRepresentationSelfHref,
  getRepresentationRequest,
  getRepresentationRequestPath,
  getRouteSettingsPluginsHal,
  getRouteSettingsPluginsHalApi,
  getRouteSettingsPluginsHalQuery,
  getRouteSettingsIsInternal,
  getRequestRoute,
  getRequestHeadersAccept,
  getRequestServer,
  getRequestResponse,
  getRequestResponseSource,
  getRequestResponseHeadersLocation,
  getResponseVariety,
  getResponseStatusCode,
  isResponseStatusCodeInSuccessRange,
  getPath,
  hasPath,
  getName,
  hasName,
  getPrefix,
  getRels,
  hasRels,
  getAbsolute,
  getQuery,
  getIgnore,
  getMediaType,
  getTemplateContext,
  isRelativePath
} from './utils.mjs'

function sortByName ({ name: alpha }, { name: omega }) {
  return (
    alpha.localeCompare(omega)
  )
}

const HAL_MIME_TYPE = 'application/hal+json'

const log = debug('@modernpoacher/halacious')

log('`@modernpoacher/halacious` is awake')

const optionsSchema = joi.object({
  absolute: joi.boolean().default(false),
  host: joi.string(),
  hostname: joi.string(),
  port: joi.number().integer(),
  protocol: joi.string(),
  strict: joi.boolean().default(false),
  relsPath: joi.string().default('/rels'),
  relsAuth: joi
    .alternatives()
    .try(joi.boolean().allow(false), joi.object())
    .default(false),
  relsTemplate: joi.boolean().default(true),
  autoApi: joi.boolean().default(true),
  apiPath: joi.string().allow('').default('/api'),
  apiAuth: joi
    .alternatives()
    .try(joi.boolean().allow(false), joi.object())
    .default(false),
  apiServerLabel: joi.string(),
  mediaTypes: joi.array().items(joi.string()).single().default([HAL_MIME_TYPE]),
  requireHalJsonAcceptHeader: joi.boolean().default(false),
  marked: joi.object().default({})
})

// valid rel options
const relSchema = joi.object({
  // the rel name, will default to file's basename if available
  name: joi.string().required(),

  // a path to the rel's documentation in html or markdown
  file: joi.string().optional(),

  // a short textual description
  description: joi.string().optional(),

  // returns the qualified name of the rel (including the namespace)
  qname: joi
    .function()
    .optional()
    .default(function getQName () {
      return function qname () {
        return this.namespace
          ? util.format('%s:%s', getPrefix(this.namespace), this.name)
          : this.name
      }
    })
}).unknown()

// valid namespace options
const namespaceSchema = joi.object({
  // the namespace name, will default to dir basename if available
  name: joi.string().required(),

  // a path to a directory containing rel descriptors. all rels will automatically be added
  dir: joi.string().optional(),

  // the namespace prefix for shorthand rel addressing (e.g. 'prefix:relname')
  prefix: joi.string().optional().default(joi.ref('name')),

  // a short description
  description: joi.string().optional(),

  // a map of rel objects, keyed by name
  rels: joi.object().optional(),

  // validates and adds a rel to the namespace
  rel: joi
    .function()
    .optional()
    .default(function getRel () {
      return function rel (rel) {
        if (!hasRels(this)) this.rels = {}

        if (_.isString(rel)) rel = { name: rel }

        if (!hasName(rel)) rel.name = (rel.file && path.basename(rel.file, path.extname(rel.file)))

        const { error, value } = relSchema.validate(rel)
        if (error) throw error

        rel = value

        const relName = getName(rel)
        const rels = getRels(this)

        Reflect.set(rels, relName, rel)

        rel.namespace = this

        return this
      }
    }),

  // synchronously scans a directory for rel descriptors and adds them to the namespace
  scanDirectory: joi
    .function()
    .optional()
    .default(function getScanDirectory () {
      return function scanDirectory (directory) {
        const files = readdirSync(directory)

        files
          .forEach((file) => {
            this.rel({ file: path.join(directory, file) })
          })

        return this
      }
    })
})

// see http://tools.ietf.org/html/draft-kelly-json-hal-06#section-8.2
const linkSchema = joi.object({
  href: joi.alternatives([joi.string(), joi.function()]).required(),
  templated: joi.boolean().optional(),
  title: joi.string().optional(),
  type: joi.string().optional(),
  deprecation: joi.string().optional(),
  name: joi.string().optional(),
  profile: joi.string().optional(),
  hreflang: joi.string().optional()
})

/**
 * Wraps callback functions
 *
 * @param {(err: Error | null, any) => void} done
 * @return {(err: Error | null, any) => void}
 */
function wrap (done, representation) {
  return function wrap (err, result) {
    if (err instanceof Error) {
      done(err)
    } else {
      done(null, result || representation)
    }
  }
}

/**
 * Registers plugin routes and an "api" object with the hapi server
 *
 * @param server
 * @param opts
 * @param {(err: Error | null, any) => void} done
 */
export const plugin = {
  pkg: PKG,

  async register (server, opts) {
    const { error, value: settings } = optionsSchema.validate(opts)

    if (error) throw error

    marked.setOptions(settings.marked)

    const selection = settings.apiServerLabel
      ? server.select(settings.apiServerLabel)
      : server

    const byName = new Map()
    const byPrefix = new Map()

    // keeps found routes in a cache
    const routeCache = new Map()

    const internals = {
      byName,
      byPrefix
    }

    /**
     * Route handler for /rels
     *
     * @type {{handler: handler}}
     */
    function getRelsRouteConfig (auth) {
      return {
        auth,
        handler ({ path }, h) {
          return h.view('namespaces', {
            path,
            namespaces: internals.namespaces()
          })
        }
      }
    }

    /**
     * Route handler for /rels/{namespace}/{rel}
     *
     * @type {{handler: handler}}
     */
    function getRelRouteConfig (auth) {
      return {
        auth,
        handler ({ params: { namespace: namespaceName, rel: relName } }, h) {
          const rel = internals.rel(namespaceName, relName)

          if (!rel) {
            log(`Invalid rel "${namespaceName}" ("${relName}")`)
            throw boom.notFound()
          }

          const {
            file
          } = rel

          if (file) {
            const buffer = readFileSync(file)

            if (settings.relsTemplate) {
              return h.view('rel', {
                rel,
                relData: marked(buffer.toString())
              })
            }

            return marked(buffer.toString())
          }

          return h.view('rel', { rel })
        }
      }
    }

    /**
     * Locates a named route. This feature may not belong here
     *
     * @param routeName
     * @return {*}
     */
    function getRouteFromRouteCache (routeName) {
      if (!routeCache.has(routeName)) {
        routeCache.set(routeName, (
          server
            .table()
            .find((route) => (
              getName(getRouteSettingsPluginsHal(route)) === routeName
            ))
        ))
      }

      return (
        routeCache.get(routeName)
      )
    }

    /**
     * Configures a representation with parameters specified by a hapi route config. The configuration object may
     * include 'links', 'embedded', and 'prepare' properties.
     *
     * @param {Record<string, any>} config the config object
     * @param {Representation} representation the representation to configure
     * @param {(err: Error | null, any) => void} done
     */
    function configureRepresentation (
      config,
      representation,
      done
    ) {
      function getHref (href, context) {
        return _.isFunction(href)
          ? href(representation, context)
          : urlTemplate.parseTemplate(href).expand(getTemplateContext(href, context))
      }

      /**
       * @param {Record<string, any>} config the config object
       * @param {Representation} representation the representation to configure
       * @param {(err: Error | null, any) => void} done
       */
      function prepareEntity (representation, done) {
        const { prepare } = config

        if (_.isFunction(prepare)) {
          prepare(representation, wrap(done, representation))
        } else {
          done(null, representation)
        }
      }

      /**
       * @param {Record<string, any>} config the config object
       * @param {Representation} representation the representation to configure
       * @param {(err: Error | null, any) => void} done
       */
      function cascadeEntity (config, representation, done) {
        representation.ignore(getIgnore(config))

        // cascade the async config functions
        prepareEntity(representation, done)
      }

      try {
        // shorthand prepare function
        if (_.isFunction(config)) config = { prepare: config }

        if (Reflect.has(config, 'links')) {
          const links = Reflect.get(config, 'links')

          const entity = getRepresentationEntity(representation)

          Object.entries(links)
            .forEach(([rel, link]) => {
              const representationLink = internals.link(link, getRepresentationSelfHref(representation))
              representationLink.href = getHref(representationLink.href, entity)
              representation.link(rel, representationLink)

              // grab query options
              if (config.query) {
                representationLink.href += config.query
              }
            })
        }

        if (Reflect.has(config, 'embedded')) {
          // configure embedded declarations. each rel entry is also a representation config object
          const embedded = Reflect.get(config, 'embedded')

          const entity = getRepresentationEntity(representation)

          async.each(
            Object.entries(embedded),
            ([rel, route], done) => {
              // assume that arrays should be embedded as a collection
              if (!hasPath(route)) {
                throw new Error(
                    `Invalid route "${getRepresentationRequestPath(representation)}": "embedded" route configuration property requires a path`
                )
              }

              let embedded = hoek.reach(entity, getPath(route))

              if (!embedded) return done()

              // force the embed array to be inialized. no self rel is necessary
              if (_.isArray(embedded)) representation.embed(rel, null, [])

              // force into an array for iterating
              embedded = [].concat(embedded)

              // embedded reps probably also shouldnt appear in the object payload
              representation.ignore(getPath(route))

              async.each(
                embedded,
                (item, done) => {
                  const link = internals.link(
                    getHref(route.href, { self: entity, item }),
                    getRepresentationSelfHref(representation)
                  )

                  // create the embedded representation from the possibly templated href
                  let embedded = representation.embed(rel, link, item)

                  // force into an array for iterating
                  embedded = [].concat(embedded)

                  // recursively process its links/embedded declarations
                  async.each(
                    embedded,
                    (representation, done) => {
                      transformRepresentationEntity(route, representation, done)
                    },
                    done
                  )
                },
                done
              )
            },
            (err) => {
              if (err) return done(err)

              return (
                cascadeEntity(config, representation, done)
              )
            }
          )
        } else {
          return (
            cascadeEntity(config, representation, done)
          )
        }
      } catch (e) {
        done(e)
      }
    }

    function transformRepresentationEntity (
      config,
      representation,
      done
    ) {
      /**
       * Looks for a toHal(representation, done) method on the entity. If found, it is called asynchronously. The method may modify the
       * representation or pass back a completely new representation by calling done(newRep)
       *
       * @param {(err: Error | null, any) => void} done
       */
      function transformEntity (done) {
        const { toHal } = getRepresentationEntity(representation)

        if (_.isFunction(toHal)) {
          toHal(representation, wrap(done, representation))
        } else {
          done(null, representation)
        }
      }

      async.waterfall(
        [
          transformEntity,
          (representation, done) => {
            configureRepresentation(config, representation, done)
          }
        ],
        done
      )
    }

    /**
     * Expands the query string template, if present, using query parameter values in the request
     *
     * @param request
     * @param queryTemplate
     * @param {boolean} isAbsolute whether the link should be expanded to include the server
     * @return {*}
     */
    function getRequestPath (request, queryTemplate, isAbsolute) {
      const path = isAbsolute
        ? internals.buildUrl(request, getPath(request))
        : getPath(request)

      if (queryTemplate) {
        const uriTemplate = new URITemplate(path + queryTemplate)
        return (
          uriTemplate.expand(request.query)
        )
      }

      return path
    }

    /**
     * Resolves to a relative URL
     *
     * @param request
     * @param {string} uri
     * @param {boolean} isAbsolute
     * @return {*}
     */
    function getRelativeUrl (request, uri, isAbsolute) {
      let relativeUrl = null
      let queryParams = null

      if (uri.match(/^\w+:\/\//)) {
        relativeUrl = uri
      } else {
        const [
          route = '',
          query = null
        ] = uri.split('?')

        relativeUrl = route.startsWith('/') ? route : '/' + route
        queryParams = query || queryParams
      }

      if (isAbsolute) {
        relativeUrl = internals.buildUrl(request, relativeUrl, queryParams)
      }

      return relativeUrl
    }

    function isAcceptHeaderValid (request) {
      return (
        !settings.requireHalJsonAcceptHeader ||
        (getRequestHeadersAccept(request) ?? '').toLowerCase().includes(HAL_MIME_TYPE)
      )
    }

    function isSourceEligible (source) {
      return _.isObject(source) && !_.isArray(source)
    }

    function isRequestEligible (request) {
      return (
        !getRouteSettingsIsInternal(getRequestRoute(request)) && // hapi 9/10 routes can be marked internal only
        isAcceptHeaderValid(request) &&
        internals.filter(request)
      )
    }

    function isResponseEligible (response) {
      return (
        getResponseVariety(response) === 'plain' &&
        isResponseStatusCodeInSuccessRange(getResponseStatusCode(response))
      )
    }

    function isEligible (request) {
      return (
        isRequestEligible(request) &&
        isResponseEligible(getRequestResponse(request)) &&
        isSourceEligible(getRequestResponseSource(request))
      )
    }

    /**
     * Prepares a hal response with all root "api" handlers declared in the routing table. Api handlers are identified with
     * the plugins.hal.api configuration settings. This function is exported for convenience if the developer wishes to
     * define his or her own api handler in order to include metadata in the payload
     *
     * @param {boolean} isAbsolute
     * @param {Representation} representation
     * @param {(err: Error | null, any) => void} done
     */
    function toHal (isAbsolute, representation, done) {
      const request = getRepresentationRequest(representation)

      // grab the routing table and iterate
      const server = getRequestServer(request)

      server.table()
        .forEach((route) => {
          const api = getRouteSettingsPluginsHalApi(route)

          if (api) {
            let {
              path: uri = ''
            } = route

            if (isAbsolute) {
              uri = internals.buildUrl(request, uri)
            }

            const query = getRouteSettingsPluginsHalQuery(route)

            // grab query options
            if (query) {
              uri += query
            }

            representation.link(api, uri)
          }
        })

      done()
    }

    /**
     * Creates an auto api route configuration
     *
     * @param auth
     * @param {boolean} isAbsolute
     * @return {{auth: *, handler: handler, plugins: {hal: toHal}}}
     */
    function getApiRouteConfig (auth, isAbsolute) {
      return {
        auth,
        handler (req, h) {
          return h.response({}).type(HAL_MIME_TYPE)
        },
        plugins: {
          hal: toHal.bind(null, isAbsolute)
        }
      }
    }

    /**
     * Creates a redirector to redirect the browser from /api to /api/
     *
     * @param auth
     * @param {string} url
     * @return {{auth: *, handler: handler}}
     */
    function getApiRedirectConfig (auth, url) {
      return {
        auth,
        handler (req, h) {
          return h.redirect(url.concat('/'))
        }
      }
    }

    /**
     * Returns namespaces sorted by name
     *
     * @return {*}
     */
    internals.namespaces = function namespaces () {
      return (
        Array
          .from(byName.values())
          .sort(sortByName)
      )
    }

    /**
     * Validates and adds a new namespace configuration
     *
     * @param namespace the namespace config
     * @return {*} a new namespace object
     */
    internals.namespaces.add = function add (namespace) {
      // if only dir is specified
      if (!hasName(namespace)) namespace.name = (namespace.dir && path.basename(namespace.dir))

      // fail fast if the namespace isnt valid
      const { error, value } = namespaceSchema.validate(namespace)

      if (error) throw error

      namespace = value

      // would prefer to initialize w/ joi but it keeps a static reference to the value for some reason
      namespace.rels = {}

      if (namespace.dir) {
        namespace.scanDirectory(namespace.dir)
      }

      // index and return
      const name = getName(namespace)
      const prefix = getPrefix(namespace)

      byName
        .set(name, namespace)
      byPrefix
        .set(prefix, namespace)

      return namespace
    }

    /**
     * Removes one or all registered namespaces. Mainly used for testing
     *
     * @param {string} name the namespace to remove. a falsy value will remove all namespaces
     */
    internals.namespaces.remove = function remove (name) {
      if (!name) {
        byName
          .clear()
        byPrefix
          .clear()
      } else {
        if (byName.has(name)) {
          const namespace = byName.get(name)

          const prefix = getPrefix(namespace)

          byName
            .delete(name)
          byPrefix
            .delete(prefix)
        }
      }
    }

    /**
     * Looks up a specific namespace
     *
     * @param namespace
     * @return {*}
     */
    internals.namespace = function namespace (name) {
      return (
        byName.get(name)
      )
    }

    /**
     * Returns namespace rels sorted by name
     *
     * @return {*}
     */
    internals.rels = function rels () {
      return (
        Array
          .from(byName.values())
          .reduce((accumulator, { rels = {} }) => accumulator.concat(Object.values(rels)), [])
          .sort(sortByName)
      )
    }

    /**
     * Adds a new rel configuration to a namespace
     *
     * @param {string} name the namespace name
     * @param rel the rel configuration
     * @return the new rel
     */
    internals.rels.add = function add (name, rel) {
      if (!byName.has(name)) throw new Error(`Invalid namespace "${name}"`)

      const namespace = byName.get(name)

      namespace.rel(rel)

      const relName = getName(rel)
      const rels = getRels(namespace)

      return (
        Reflect.get(rels, relName)
      )
    }

    /**
     * Looks up a rel under a given namespace
     * @param {string} namespaceName the namespace name
     * @param {string} relName the rel name
     * @return {*} the rel or undefined if not found
     */
    internals.rel = function rel (namespaceName, relName) {
      if (!namespaceName) throw new Error(`Invalid rel "${namespaceName}"`)

      let namespace
      let rel

      if (!relName) {
        // for shorthand namespace:rel notation
        if (namespaceName.includes(':')) {
          const [prefix, name] = namespaceName.split(':')
          namespace = byPrefix.get(prefix)
          relName = name
        }
      } else {
        namespace = byName.get(namespaceName)
      }

      // namespace is valid, check for rel
      if (namespace) {
        const rels = getRels(namespace)

        if (!Reflect.has(rels, relName)) {
          if (!settings.strict) {
            // lazily create the rel
            namespace.rel({ name: relName })
          } else {
            // could be a typo, fail fast to let the developer know
            throw new Error(`Invalid rel "${namespaceName}" ("${relName}")`)
          }
        }

        rel = Reflect.get(rels, relName)
      } else {
        // could be globally qualified (e.g. 'self')
        const { error, value } = relSchema.validate({ name: namespaceName })
        if (error) throw error

        rel = value
      }

      return rel
    }

    /**
     * Resolves a name
     *
     * @param link
     * @param relativeTo
     */
    internals.link = function link (link, relativeTo) {
      link = (
        _.isFunction(link) || _.isString(link)
          ? { href: link }
          : hoek.clone(link)
      )

      const { error, value } = linkSchema.validate(link)

      if (error) throw error

      link = value

      relativeTo = (relativeTo ?? '').split('?').shift().trim()

      if (
        relativeTo &&
        (isRelativePath(link.href) || settings.absolute)
      ) {
        try {
          link.href = (
            new URI(link.href)
              .absoluteTo(relativeTo.concat('/'))
              .toString()
          )
        } catch (e) {
          log(`Invalid URL "${link.href}"`)
          return link
        }
      }

      return link
    }

    /**
     * Locates a named route and expands templated parameters
     *
     * @param routeName
     * @param params
     * @return String the expanded path to the named route
     */
    internals.route = function route (routeName, params) {
      const route = server.lookup(routeName) || getRouteFromRouteCache(routeName)
      if (!route) throw new Error(`Invalid route "${routeName}"`)

      const i = /{([\s\S]+?)(?:\?|\*\d*)??}/g
      const c = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, typeof value !== 'object' ? encodeURIComponent(value) : value]))

      const href = _.template(getPath(route), { interpolate: i })(c)

      const query = getRouteSettingsPluginsHalQuery(route) // hoek.reach(route.settings, 'plugins.hal.query')

      if (query) {
        return href + query
      }

      return href
    }

    /**
     * Returns the documentation link to a namespace
     *
     * @param request
     * @param namespace
     * @return {*}
     */
    internals.namespaceUrl = function namespaceUrl (request, namespace) {
      const path = [settings.relsPath, getName(namespace)].join('/')

      if (settings.absolute) {
        return internals.buildUrl(request, path)
      }

      return path
    }

    internals.filter = function filter (request) {
      return getRouteSettingsPluginsHal(getRequestRoute(request)) // _.get(getRouteSettings(getRequestRoute(request)), 'plugins.hal', true)
    }

    /**
     * Expands the url path to include protocol://server:port
     *
     * @param request
     * @param {string} pathname
     * @param {string | void} search
     * @return {*}
     */
    internals.buildUrl = function buildUrl (request, pathname, search) {
      return url.format({
        protocol: settings.protocol || request.info.protocol || 'http',
        hostname: settings.hostname || request.info.host,
        pathname,
        host: settings.host || request.headers.host,
        port: settings.port || request.info.port,
        search
      })
    }

    /**
     * Assigns a filter function to test routes before applying the hal interceptor
     *
     * @param filter
     */
    internals.setFilter = function setFilter (filter) {
      const { error } = joi.function().validate(filter)
      if (error) throw error

      internals.filter = filter
    }

    internals.setUrlBuilder = function setUrlBuilder (urlBuilder) {
      const { error } = joi.function().validate(urlBuilder)
      if (error) throw error

      internals.buildUrl = urlBuilder
    }

    const api = {
      namespaces: internals.namespaces,
      namespace: internals.namespace,
      namespaceUrl: internals.namespaceUrl,
      link: internals.link,
      rels: internals.rels,
      rel: internals.rel,
      route: internals.route,
      toHal,
      filter: internals.setFilter,
      urlBuilder: internals.setUrlBuilder,
      configureRepresentation
    }

    /**
     * A Hapi lifecycle method that looks for the application/hal+json accept header and wraps the response entity into a
     * HAL representation
     *
     * @param request
     * @param h
     */
    internals.postHandler = function postHandler (request, h) {
      if (isEligible(request)) {
        const mediaType = getMediaType(request, settings.mediaTypes)
        if (mediaType) {
          const config = getRouteSettingsPluginsHal(getRequestRoute(request))

          // e.g. honor the location header if it has been set using response.created(...) or response.location(...)
          const location = getRequestResponseHeadersLocation(request)
          const isAbsolute = Boolean(getAbsolute(config) || getAbsolute(settings))

          const self = (
            location
              ? getRelativeUrl(request, location, isAbsolute)
              : getRequestPath(request, getQuery(config), isAbsolute)
          )

          // all new representations for the request will be built by this guy
          const representationFactory = new RepresentationFactory(api, request)
          const representation = representationFactory.create(getRequestResponseSource(request), self)

          return (
            new Promise((resolve, reject) => {
              transformRepresentationEntity(config, representation, (err, representation) => {
                if (err) return reject(err)

                const response = getRequestResponse(request)

                // send back what they asked for (as plain object
                // so validation can be done correctly)
                response.source = representation.toJSON()
                response.type(mediaType)

                return (
                  resolve(h.continue)
                )
              })
            })
          )
        }
      }

      return h.continue
    }

    // hapi wont find the local swig without this
    server.expose(api)

    selection.ext('onPostHandler', internals.postHandler)

    if (settings.autoApi) {
      // bind the API handler to api root + '/'. Ending with '/' is necessary for resolving relative links on the client
      selection.route({
        method: 'GET',
        path: settings.apiPath.concat('/'),
        config: getApiRouteConfig(
          settings.apiAuth,
          settings.absolute
        )
      })

      // set up a redirect to api root + '/'
      if (settings.apiPath) {
        selection.route({
          method: 'GET',
          path: settings.apiPath,
          config: getApiRedirectConfig(
            settings.apiAuth,
            settings.apiPath
          )
        })
      }
    }

    internals.preStart = function preStart (server) {
      if (_.isFunction(server.views)) {
        server.views({
          engines: {
            jade: pug
          },
          path: path.join(IAM, './views'),
          isCached: false
        })

        server.route({
          method: 'GET',
          path: settings.relsPath,
          config: getRelsRouteConfig(settings.relsAuth)
        })

        server.route({
          method: 'GET',
          path: `${settings.relsPath}/{namespace}/{rel}`,
          config: getRelRouteConfig(settings.relsAuth)
        })
      }
    }

    server.ext('onPreStart', internals.preStart)
  }
}
