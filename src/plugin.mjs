import joi from 'joi'
import * as boom from '@hapi/boom'
import * as hoek from '@hapi/hoek'
import _ from 'lodash'
import fs from 'node:fs'
import path from 'node:path'
import pug from 'pug'
import util from 'util'
import async from 'async'
import {
  marked
} from 'marked'
import url from 'url'
import URI from 'urijs'
import * as urlTemplate from 'url-template'
import Negotiator from 'negotiator'
import URITemplate from 'urijs/src/URITemplate.js'
import IAM from '#where-am-i'
import RepresentationFactory from './representation.mjs'

const HAL_MIME_TYPE = 'application/hal+json'

const REG = /{([^{}]+)}|([^{}]+)/g

const PKG = JSON.parse(fs.readFileSync(path.join(IAM, './package.json')))

function reach (object, path) {
  const parts = path ? path.split('.') : []

  for (let i = 0; i < parts.length && !_.isUndefined(object); i++) {
    object = object[parts[i]]
  }

  return object
}

/**
 * evaluates and flattens deep expressions (e.g. '/{foo.a.b}') into a single level context object: {'foo.a.b': value}
 * so that it may be used by url-template library
 * @param template
 * @param ctx
 * @return {{}}
 */
function flattenContext (template, ctx) {
  let arr
  const result = {}

  while ((arr = REG.exec(template)) !== null) {
    if (arr[1]) {
      const value = reach(ctx, arr[1])
      result[arr[1]] = value && value.toString()
    }
  }

  return result
}

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

/**
 * Registers plugin routes and an "api" object with the hapi server.
 * @param server
 * @param opts
 * @param next
 */
export const plugin = {
  pkg: PKG,

  async register (server, opts) {
    let settings = opts

    const { error, value } = optionsSchema.validate(opts)

    if (error) throw error

    settings = value

    marked.setOptions(settings.marked)

    const selection = settings.apiServerLabel
      ? server.select(settings.apiServerLabel)
      : server

    const internals = {}

    // for tracking down namespaces
    internals.byName = {}
    internals.byPrefix = {}

    // valid rel options
    internals.relSchema = joi.object({
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
        .default(function () {
          return function () {
            return this.namespace
              ? util.format('%s:%s', this.namespace.prefix, this.name)
              : this.name
          }
        })
    }).unknown()

    // valid namespace options
    internals.nsSchema = joi.object({
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
        .default(function () {
          return function (rel) {
            this.rels = this.rels || {}

            if (_.isString(rel)) rel = { name: rel }

            rel.name =
              rel.name ||
              (rel.file && path.basename(rel.file, path.extname(rel.file)))

            const { error, value } = internals.relSchema.validate(rel)
            if (error) throw error

            rel = value

            this.rels[rel.name] = rel
            rel.namespace = this
            return this
          }
        }),

      // synchronously scans a directory for rel descriptors and adds them to the namespace
      scanDirectory: joi
        .function()
        .optional()
        .default(function () {
          return function (directory) {
            const files = fs.readdirSync(directory)
            files.forEach(function (file) {
              this.rel({ file: path.join(directory, file) })
            }, this)

            return this
          }
        })
    })

    internals.filter = function (request) {
      return _.get(request.route.settings, 'plugins.hal', true)
    }

    /**
     * Returns a list of all registered namespaces sorted by name
     * @return {*}
     */
    internals.namespaces = function () {
      return _.sortBy(_.values(internals.byName), 'name')
    }

    /**
     * Validates and adds a new namespace configuration
     * @param namespace the namespace config
     * @return {*} a new namespace object
     */
    internals.namespaces.add = function (namespace) {
      // if only dir is specified
      namespace.name =
        namespace.name || (namespace.dir && path.basename(namespace.dir))

      // fail fast if the namespace isnt valid
      const { error, value } = internals.nsSchema.validate(namespace)

      if (error) throw error

      namespace = value

      // would prefer to initialize w/ joi but it keeps a static reference to the value for some reason
      namespace.rels = {}

      if (namespace.dir) {
        namespace.scanDirectory(namespace.dir)
      }

      // index and return
      internals.byName[namespace.name] = namespace
      internals.byPrefix[namespace.prefix] = namespace

      return namespace
    }

    /**
     * Removes one or all registered namespaces. Mainly used for testing
     * @param {String=} namespace the namespace to remove. a falsy value will remove all namespaces
     */
    internals.namespaces.remove = function (namespace) {
      let ns

      if (!namespace) {
        internals.byName = {}
        internals.byPrefix = {}
      } else {
        ns = internals.byName[namespace]
        if (ns) {
          delete internals.byName[namespace]
          delete internals.byPrefix[namespace.prefix]
        }
      }
    }

    /**
     * Looks up a specific namespace
     * @param namespace
     * @return {*}
     */
    internals.namespace = function (namespace) {
      return internals.byName[namespace]
    }

    /**
     * Sorts and returns all rels by namespace
     * @return {*}
     */
    internals.rels = function () {
      let rels = []
      _.values(internals.byName).forEach((ns) => {
        rels = rels.concat(_.values(ns.rels) || [])
      })
      return _.sortBy(rels, 'name')
    }

    /**
     * Adds a new rel configuration to a namespace
     * @param {String} namespace the namespace name
     * @param rel the rel configuration
     * @return the new rel
     */
    internals.rels.add = function (namespace, rel) {
      const ns = internals.byName[namespace]
      if (!ns) throw new Error(`Invalid namespace ${namespace}`)
      ns.rel(rel)
      return ns.rels[rel.name]
    }

    /**
     * Looks up a rel under a given namespace
     * @param {String} namespace the namespace name
     * @param {String} name the rel name
     * @return {*} the rel or undefined if not found
     */
    internals.rel = function (namespace, name) {
      let parts, ns, rel

      if (!name) {
        // for shorthand namespace:rel notation
        if (namespace.indexOf(':') > 0) {
          parts = namespace.split(':')
          ns = internals.byPrefix[parts[0]]
          name = parts[1]
        }
      } else {
        ns = internals.byName[namespace]
      }

      // namespace is valid, check for rel
      if (ns) {
        if (ns.rels[name]) {
          // rel has been defined
          rel = ns.rels[name]
        } else if (!settings.strict) {
          // lazily create the rel
          ns.rel({ name })
          rel = ns.rels[name]
        } else {
          // could be a typo, fail fast to let the developer know
          throw new Error(`No such rel: "${namespace}"`)
        }
      } else {
        // could be globally qualified (e.g. 'self')
        const { error, value } = internals.relSchema.validate({ name: namespace })
        if (error) throw error

        rel = value
      }

      return rel
    }

    /**
     * Route handler for /rels
     * @type {{handler: handler}}
     */
    internals.namespacesRoute = function (relsAuth) {
      return {
        auth: relsAuth,
        handler (req, h) {
          return h.view('namespaces', {
            path: req.path,
            namespaces: internals.namespaces()
          })
        }
      }
    }

    /**
     * Route handler for /rels/{namespace}/{rel}
     * @type {{handler: handler}}
     */
    internals.relRoute = function (relsAuth) {
      return {
        auth: relsAuth,
        handler (req, h) {
          const rel = internals.rel(req.params.namespace, req.params.rel)
          if (!rel) {
            console.warn('rel not found!')
            throw boom.notFound()
          }

          if (rel.file) {
            const data = fs.readFileSync(rel.file)
            if (settings.relsTemplate) {
              return h.view('rel', {
                rel,
                relData: marked(data.toString())
              })
            }
            return marked(data.toString())
          }
          return h.view('rel', { rel })
        }
      }
    }

    // see http://tools.ietf.org/html/draft-kelly-json-hal-06#section-8.2
    internals.linkSchema = joi.object({
      href: joi.alternatives([joi.string(), joi.function()]).required(),
      templated: joi.boolean().optional(),
      title: joi.string().optional(),
      type: joi.string().optional(),
      deprecation: joi.string().optional(),
      name: joi.string().optional(),
      profile: joi.string().optional(),
      hreflang: joi.string().optional()
    })

    internals.isRelativePath = function (path) {
      return (
        path &&
        (path.substring(0, 2) === './' || path.substring(0, 3) === '../')
      )
    }

    /**
     * Resolves a name
     * @param link
     * @param relativeTo
     */
    internals.link = function (link, relativeTo) {
      relativeTo = relativeTo && relativeTo.split('?')[0]
      link =
        _.isFunction(link) || _.isString(link)
          ? { href: link }
          : hoek.clone(link)
      const { error, value } = internals.linkSchema.validate(link)

      if (error) throw error
      link = value

      if (
        relativeTo &&
        (internals.isRelativePath(link.href) || settings.absolute)
      ) {
        try {
          link.href = new URI(link.href)
            .absoluteTo(`${relativeTo}/`)
            .toString()
        } catch (e) {
          console.warn(e)
          return link
        }
      }
      return link
    }

    // keeps found routes in a cache
    internals.routeCache = {}

    /**
     * Locates a named route. This feature may not belong here
     * @param routeName
     * @return {*}
     */
    internals.locateRoute = function (routeName) {
      if (internals.routeCache[routeName]) {
        return internals.routeCache[routeName].path
      }

      const routes = server.table()

      routes.forEach((route) => {
        if (
          route.settings.plugins.hal &&
          route.settings.plugins.hal.name === routeName
        ) {
          internals.routeCache[routeName] = route
        }
      })

      return internals.routeCache[routeName]
    }

    /**
     * Locates a named route and expands templated parameters
     * @param routeId
     * @param params
     * @return String the expanded path to the named route
     */
    internals.route = function (routeId, params) {
      const route = server.lookup(routeId) || internals.locateRoute(routeId)
      if (!route) throw new Error(`No route found with id or name ${routeId}`)
      const href = _.template(route.path, {
        interpolate: /{([\s\S]+?)(?:\?|\*\d*)??}/g
      })(
        _.mapValues(params, (val) =>
          typeof val !== 'object' ? encodeURIComponent(val) : val
        )
      )
      const query = hoek.reach(route.settings, 'plugins.hal.query')
      return query ? href + query : href
    }

    /**
     * Returns the documentation link to a namespace
     * @param request
     * @param namespace
     * @return {*}
     */
    internals.namespaceUrl = function (request, namespace) {
      const path = [settings.relsPath, namespace.name].join('/')

      if (settings.absolute) {
        return internals.buildUrl(request, path)
      }

      return path
    }

    /**
     * Configures a representation with parameters specified by a hapi route config. The configuration object may
     * include 'links', 'embedded', and 'prepare' properties.
     * @param {Representation} rep the representation to configure
     * @param {{}} config the config object
     * @param callback
     */
    internals.configureRepresentation = function configureRepresentation (
      rep,
      config,
      callback
    ) {
      const resolveHref = function (href, ctx) {
        return _.isFunction(href)
          ? href(rep, ctx)
          : urlTemplate.parseTemplate(href).expand(flattenContext(href, ctx))
      }

      try {
        const { entity } = rep

        // shorthand prepare function
        if (_.isFunction(config)) config = { prepare: config }

        // configure links
        _.forEach(config.links, (link, rel) => {
          const repLink = internals.link(link, rep.self.href)
          repLink.href = resolveHref(repLink.href, entity)
          rep.link(rel, repLink)

          // grab query options
          if (config.query) {
            repLink.href += config.query
          }
        })

        /**
         * Wraps callback functions to support next(rep) instead of next(null, rep)
         * @param callback
         * @return {Function}
         */
        const wrap = function (callback) {
          return function (err, result) {
            if (err instanceof Error) {
              callback(err)
            } else {
              callback(null, result || rep)
            }
          }
        }

        /**
         * Looks for an asynchronous prepare method for programmatic configuration of the outbound hal entity. As with
         * toHal(), the prepare method can modify the existing rep or create an entirely new one.
         * @param rep
         * @param callback
         */
        const prepareEntity = function (rep, callback) {
          if (_.isFunction(config.prepare)) {
            config.prepare(rep, wrap(callback))
          } else {
            callback(null, rep)
          }
        }

        // configure embedded declarations. each rel entry is also a representation config object
        async.each(
          Object.keys(config.embedded || {}),
          (rel, cb) => {
            const embed = config.embedded[rel]

            // assume that arrays should be embedded as a collection
            if (!embed.path) {
              throw new Error(
                `Error in route ${rep.request.path}: "embedded" route configuration property requires a path`
              )
            }
            let embedded = hoek.reach(entity, embed.path)
            if (!embedded) return cb()

            // force the embed array to be inialized. no self rel is necessary
            if (_.isArray(embedded)) rep.embed(rel, null, [])

            // force into an array for iterating
            embedded = [].concat(embedded)

            // embedded reps probably also shouldnt appear in the object payload
            rep.ignore(embed.path)

            async.each(
              embedded,
              (item, acb) => {
                const link = internals.link(
                  resolveHref(embed.href, { self: entity, item }),
                  rep.self.href
                )

                // create the embedded representation from the possibly templated href
                let embeddedRep = rep.embed(rel, link, item)

                embeddedRep = _.isArray(embeddedRep)
                  ? embeddedRep
                  : [embeddedRep]
                // recursively process its links/embedded declarations
                async.each(
                  embeddedRep,
                  (e, bcb) => {
                    internals.halifyAndConfigure(e, embed, bcb)
                  },
                  acb
                )
              },
              cb
            )
          },
          (err) => {
            if (err) return callback(err)

            rep.ignore(config.ignore)

            // cascade the async config functions
            prepareEntity(rep, callback)
          }
        )
      } catch (e) {
        callback(e)
      }
    }

    internals.halifyAndConfigure = function (rep, config, callback) {
      /**
       * Wraps callback functions to support next(rep) instead of next(null, rep)
       * @param callback
       * @return {Function}
       */
      const wrap = function (callback) {
        return function (err, result) {
          if (err instanceof Error) {
            callback(err)
          } else {
            callback(null, result || rep)
          }
        }
      }

      /**
       * Looks for a toHal(representation, next) method on the entity. If found, it is called asynchronously. The method may modify the
       * representation or pass back a completely new representation by calling next(newRep)
       * @param callback
       */
      const convertEntity = function (callback) {
        if (_.isFunction(rep.entity.toHal)) {
          rep.entity.toHal(rep, wrap(callback))
        } else {
          callback(null, rep)
        }
      }

      const configureEntity = function (rep, callback) {
        internals.configureRepresentation(rep, config, callback)
      }

      async.waterfall([convertEntity, configureEntity], callback)
    }

    /**
     * Selects the media type based on the request's Accept header and a ranked ordering of configured
     * media types.
     * @param mediaTypes
     * @param request
     * @return {*}
     */
    internals.getMediaType = function (mediaTypes, request) {
      return new Negotiator(request).mediaType(
        _.isArray(mediaTypes) ? mediaTypes : [mediaTypes]
      )
    }

    /**
     * Expands the url path to include protocol://server:port
     * @param request
     * @param path
     * @param search
     * @return {*}
     */
    internals.buildUrl = function (request, path, search) {
      return url.format({
        host: settings.host || request.headers.host,
        hostname: settings.hostname || request.info.host,
        port: settings.port || request.info.port,
        pathname: path,
        protocol: settings.protocol || request.info.protocol || 'http',
        search
      })
    }

    /**
     * Expands the query string template, if present, using query parameter values in the request.
     * @param request
     * @param queryTemplate
     * @param { boolean } absolute whether the link should be expanded to include the server
     * @return {*}
     */
    internals.getRequestPath = function (request, queryTemplate, absolute) {
      let uriTemplate

      const path = absolute
        ? internals.buildUrl(request, request.path)
        : request.path

      if (queryTemplate) {
        uriTemplate = new URITemplate(path + queryTemplate)
        return uriTemplate.expand(request.query)
      }
      return path
    }

    /**
     * Resolves a relative url. Borrowed from hapi
     * @param request
     * @param uri
     * @param absolute
     * @return {*}
     */
    internals.location = function (request, uri, absolute) {
      const isAbsolute = uri.match(/^\w+:\/\//)

      let path = isAbsolute ? uri : (uri.charAt(0) === '/' ? '' : '/') + uri
      let search = null

      if (isAbsolute) {
        path = uri
      } else {
        const parts = uri.split('?')
        path = (parts[0].charAt(0) === '/' ? '' : '/') + parts[0]
        if (parts.length > 1) {
          // eslint-disable-next-line prefer-destructuring
          search = parts[1]
        }
      }

      if (absolute) {
        path = internals.buildUrl(request, path, search)
      }
      return path
    }

    internals.successfulResponseCode = function (statusCode) {
      return statusCode >= 200 && statusCode < 300
    }

    internals.isSourceEligible = function (source) {
      return _.isObject(source) && !_.isArray(source)
    }

    internals.isAcceptHeaderValid = function (request) {
      const accept = request.headers.accept || ''

      return (
        !settings.requireHalJsonAcceptHeader ||
        accept.toLowerCase().indexOf(HAL_MIME_TYPE) >= 0
      )
    }

    internals.isRequestEligible = function (request) {
      // hapi 9/10 routes can be marked internal only
      return (
        !request.route.settings.isInternal &&
        internals.isAcceptHeaderValid(request) &&
        internals.filter(request)
      )
    }

    internals.isResponseEligible = function (response) {
      return (
        response.variety === 'plain' &&
        internals.successfulResponseCode(response.statusCode)
      )
    }

    internals.shouldHalify = function (request) {
      return (
        internals.isRequestEligible(request) &&
        internals.isResponseEligible(request.response) &&
        internals.isSourceEligible(request.response.source)
      )
    }

    /**
     * Prepares a hal response with all root "api" handlers declared in the routing table. Api handlers are identified with
     * the plugins.hal.api configuration settings. This function is exported for convenience if the developer wishes to
     * define his or her own api handler in order to include metadata in the payload
     *
     * @param absolute
     * @param rep
     * @param next
     */
    internals.apiLinker = function (absolute, rep, next) {
      // grab the routing table and iterate
      const req = rep.request

      const routes = req.server.table()

      for (let i = 0; i < routes.length; i++) {
        const route = routes[i]

        const halConfig = route.settings.plugins.hal || {}

        if (halConfig.api) {
          const rel = halConfig.api
          let href = routes[i].path

          if (absolute) {
            href = internals.buildUrl(rep.request, href)
          }

          // grab query options
          if (halConfig.query) {
            href += halConfig.query
          }

          rep.link(rel, href)
        }
      }
      next()
    }

    /**
     * Creates an auto api route configuration
     * @param absolute
     * @param apiAuth
     * @return {{auth: *, handler: handler, plugins: {hal: apiLinker}}}
     */
    internals.apiRouteConfig = function (absolute, apiAuth) {
      return {
        auth: apiAuth,
        handler (req, h) {
          return h.response({}).type(HAL_MIME_TYPE)
        },
        plugins: {
          hal: internals.apiLinker.bind(null, absolute)
        }
      }
    }

    /**
     * Creates a redirector to redirect the browser from /api to /api/
     * @param apiUrl
     * @param apiAuth
     * @return {{auth: *, handler: handler}}
     */
    internals.apiRedirectConfig = function (apiUrl, apiAuth) {
      return {
        auth: apiAuth,
        handler (req, h) {
          return h.redirect(`${apiUrl}/`)
        }
      }
    }

    /**
     * Assigns a filter function to test routes before applying the hal interceptor.
     * @param filterFn
     */
    internals.setFilter = function (filterFn) {
      const { error } = joi.function().validate(filterFn)
      if (error) throw error

      internals.filter = filterFn
    }

    internals.setUrlBuilder = function (urlBuilder) {
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
      resolve: internals.resolve,
      route: internals.route,
      apiLinker: internals.apiLinker,
      filter: internals.setFilter,
      urlBuilder: internals.setUrlBuilder,
      configureRepresentation: internals.configureRepresentation
    }

    /**
     * A hapi lifecycle method that looks for the application/hal+json accept header and wraps the response entity into a
     * HAL representation
     * @param request
     * @param h
     */
    internals.postHandler = function (request, h) {
      let rf, halConfig, entity, rep, self
      const mediaType = internals.getMediaType(settings.mediaTypes, request)
      let absolute

      if (mediaType && internals.shouldHalify(request)) {
        halConfig = request.route.settings.plugins.hal || {}

        // all new representations for the request will be built by this guy
        rf = new RepresentationFactory(api, request)

        entity = request.response.source

        absolute = halConfig.absolute || settings.absolute

        // e.g. honor the location header if it has been set using response.created(...) or response.location(...)
        const { location } = request.response.headers
        self = location
          ? internals.location(request, location, absolute)
          : internals.getRequestPath(request, halConfig.query, absolute)

        rep = rf.create(entity, self)

        return new Promise((resolve, reject) => {
          internals.halifyAndConfigure(rep, halConfig, (err, rep) => {
            if (err) {
              return reject(err)
            }

            // send back what they asked for, as plain object
            // so validation can be done correctly
            request.response.source = rep.toJSON()
            request.response.type(mediaType)

            return resolve(h.continue)
          })
        })
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
        path: `${settings.apiPath}/`,
        config: internals.apiRouteConfig(settings.absolute, settings.apiAuth)
      })

      // set up a redirect to api root + '/'
      if (settings.apiPath.length > 0) {
        selection.route({
          method: 'GET',
          path: settings.apiPath,
          config: internals.apiRedirectConfig(
            settings.apiPath,
            settings.apiAuth
          )
        })
      }
    }

    internals.preStart = function (server) {
      if (_.isFunction(server.views)) {
        server.views({
          engines: {
            jade: pug
          },
          path: path.join(IAM, './views'),
          isCached: false
        })
        server.route({
          method: 'get',
          path: settings.relsPath,
          config: internals.namespacesRoute(settings.relsAuth)
        })
        server.route({
          method: 'get',
          path: `${settings.relsPath}/{namespace}/{rel}`,
          config: internals.relRoute(settings.relsAuth)
        })
      }
    }

    server.ext('onPreStart', internals.preStart)
  }
}
