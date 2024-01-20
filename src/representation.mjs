import * as hoek from '@hapi/hoek'
import URI from 'urijs'

const TEMPLATE = /{*}/

/**
 * A HAL wrapper interface around an entity. Provides an api for adding new links and recursively embedding child
 * entities.
 *
 * @param factory
 * @param self
 * @param entity
 * @param root
 * @constructor
 */
export class Representation {
  constructor (factory, self, entity, root = this) {
    const {
      _halacious: halacious,
      _request: request
    } = factory

    const {
      href
    } = self

    const links = {
      self
    }

    this.factory = factory
    this.self = href
    this.entity = entity
    this._root = root
    this._halacious = halacious
    this._request = request
    this._links = links
    this._embedded = {}
    this._namespaces = {}
    this._props = new Map()
    this._ignore = new Set()
  }

  getHalacious () {
    return this._halacious
  }

  getRequest () {
    return this._request
  }

  getRoot () {
    return this._root
  }

  getLinks () {
    return this._links
  }

  getEmbedded () {
    return this._embedded
  }

  getNamespaces () {
    return this._namespaces
  }

  getProps () {
    return this._props
  }

  getIgnore () {
    return this._ignore
  }

  get halacious () {
    return this._halacious
  }

  get request () {
    return this._request
  }

  /**
   * Adds a namespace to the 'curie' link collection. all curies in a response, top level or nested, should be declared
   * in the top level _links collection. a reference '_root' is kept to the top level representation for this purpose
   *
   * @param namespace
   */
  curie (namespace) {
    if (namespace) {
      const root = this.getRoot()

      const namespaces = root.getNamespaces()

      const {
        prefix
      } = namespace

      if (Reflect.has(namespaces, prefix)) return

      Reflect.set(namespaces, prefix, namespace)

      const links = root.getLinks()

      const curies = Reflect.get(links, 'curies') ?? []

      const request = this.getRequest()

      const namespaceUrl = this.getHalacious().namespaceUrl(request, namespace)

      Reflect.set(links, 'curies', curies.concat({
        name: prefix,
        href: `${namespaceUrl}/{rel}`,
        templated: true
      }))
    }
  }

  /**
   * Adds a custom property to the HAL payload
   * @param {String} name the property name
   * @param {*} value the property value
   * @return {Representation}
   */
  prop (name, value) {
    this.getProps()
      .set(name, value)

    return this
  }

  /**
   * Merges an object's properties into the custom properties collection
   *
   * @param prop
   */
  merge (prop) {
    const props = this.getProps()

    Object
      .entries(prop)
      .forEach(([name, value]) => {
        props.set(name, value)
      })

    return this
  }

  /**
   * @param {...String || String[]} args properties to ignore
   * @return {Representation}
   */
  ignore (arg, ...args) {
    const props = (
      Array.isArray(arg)
        ? arg
        : [arg].concat(args)
    )

    const ignore = this.getIgnore()

    props
      .filter(Boolean)
      .forEach((prop) => {
        ignore.add(prop)
      })

    return this
  }

  /**
   * Prepares the representation for JSON serialization.
   * @return {{}}
   */
  toJSON () {
    // initialize the json entity
    const object = { _links: this.getLinks() }

    // copy all target properties in the entity using JSON.stringify(). if the entity has a .toJSON() implementation,
    // it will be called. properties on the ignore list will not be copied
    const {
      entity
    } = this

    const ignore = this.getIgnore()

    JSON.stringify(entity, (key, value) => {
      if (!key) {
        return value
      }

      if (!ignore.has(key)) Reflect.set(object, key, value)
    })

    const props = this.getProps()

    // merge in any extra properties
    Object.assign(object, Object.fromEntries(Array.from(props.entries()).filter(([key]) => !ignore.has(key))))

    const embedded = this.getEmbedded()

    const entries = Object.entries(embedded)
    if (entries.length) {
      object._embedded = (
        entries
          .reduce((accumulator, [entryKey, entryValue]) => {
            let currentValue

            if (entryValue instanceof Representation) {
              currentValue = {}
            } else {
              if (Array.isArray(entryValue)) {
                currentValue = []
              }
            }

            JSON.stringify(entryValue, (key, value) => {
              if (!key) {
                return value
              }

              if (!ignore.has(key)) Reflect.set(currentValue, key, value)
            })

            return (
              Object.assign(accumulator, { [entryKey]: currentValue })
            )
          }, {})
      )
    }

    return object
  }

  /**
   * Creates a new link and adds it to the _links collection
   *
   * @param rel
   * @param link
   * @return {{} || []} the new link
   */
  link (relName, link) {
    const halacious = this.getHalacious()

    const rel = halacious.rel(relName)
    const key = rel.qname()

    const links = this.getLinks()

    if (Array.isArray(link)) {
      if (!Reflect.has(links, key)) Reflect.set(links, key, [])

      return (
        link.map((href) => this.link(relName, href))
      )
    }

    // adds the namespace to the top level curie list
    this.curie(rel.namespace)

    const {
      self: {
        href = ''
      }
    } = links

    link = halacious.link(link, href)

    if (TEMPLATE.test(link.href)) link.templated = true

    // e.g. 'mco:rel'
    const value = Reflect.get(links, key)
    if (value) {
      Reflect.set(links, key, [].concat(value, link))
    } else {
      Reflect.set(links, key, link)
    }

    return link
  }

  /**
   * Resolves a relative path against the representation's self href
   *
   * @param relativePath
   * @return {*}
   */
  resolve (relativePath) {
    const {
      self: {
        href = ''
      }
    } = this.getLinks()

    return (
      new URI(relativePath)
        .absoluteTo(href.concat('/'))
        .toString()
    )
  }

  /**
   * Returns the path to a named route (specified by the plugins.hal.name configuration parameter), expanding any supplied
   * path parameters.
   * @param {String} routeName the route's name
   * @param {{}=} params for expanding templated urls
   * @return {*}
   */
  route (routeName, params) {
    return this.getHalacious().route(routeName, params)
  }

  /**
   * Wraps an entity into a HAL representation and adds it to the _embedded collection
   * @param {String} rel the rel name
   * @param {String || {}} self an href or link object for the entity
   * @param {{} || []} entity an object to wrap
   * @return {entity || []}
   */
  embed (relName, self, entity) {
    const halacious = this.getHalacious()

    const rel = halacious.rel(relName)
    const key = rel.qname()

    this.curie(rel.namespace)

    const embedded = this.getEmbedded()

    if (Array.isArray(entity)) {
      if (!Reflect.has(embedded, key)) Reflect.set(embedded, key, [])

      return (
        entity.map((entity) => this.embed(relName, self, entity))
      )
    }

    const {
      self: {
        href = ''
      }
    } = this.getLinks()

    const root = this.getRoot()

    self = halacious.link(self, href)

    const embed = this.factory.create(entity, self, root)

    const value = Reflect.get(embedded, key)
    if (value) {
      Reflect.set(embedded, key, [].concat(value, embed))
    } else {
      Reflect.set(embedded, key, embed)
    }

    return embed
  }

  /**
   * Convenience method for embedding an entity or array of entities
   *
   * @param rel
   * @param self
   * @param arg
   * @return {Representation}
   */
  embedCollection (rel, self, arg) {
    const entities = (
      Array.isArray(arg)
        ? arg
        : [arg]
    )

    entities
      .filter(Boolean)
      .forEach((entity) => {
        this.embed(rel, hoek.clone(self), entity)
      })

    return this
  }

  /**
   * Configures a representation using a configuration object such as those found in route definitions
   * @param config
   * @param callback
   */
  configure (config, callback) {
    this.getHalacious().configureRepresentation(this, config, callback)
  }
}

/**
 * Responsible for creating all hal entities, top level or embedded, needed for a Hapi request
 *
 * @param halacious a reference to the plugin api
 * @param request a hapi request object
 * @constructor
 */
export class RepresentationFactory {
  constructor (halacious, request) {
    this._halacious = halacious
    this._request = request
  }

  getHalacious () {
    return this._halacious
  }

  getRequest () {
    return this._request
  }

  getRequestPath () {
    return this.getRequest()?.path
  }

  get halacious () {
    return this._halacious
  }

  get request () {
    return this._request
  }

  get requestPath () {
    return this.request?.path
  }

  /**
   * Creates a new hal representation out of a javascript object
   * @param {{}=} entity the entity to wrap with a representation. an empty object is created by default
   * @param {String || {}=} self the self href or link object. The request's path is used by default
   * @param {Representation} root a pointer to the top level representation for adding curied links
   * should be expanded into absolute urls
   * @return {Representation}
   */
  create (entity = {}, self = this.getRequestPath(), root) {
    const halacious = this.getHalacious()

    const link = halacious.link(self)

    return (
      new Representation(this, link, entity, root)
    )
  }
}

export default RepresentationFactory
