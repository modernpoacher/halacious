import _ from 'lodash'
import * as hoek from '@hapi/hoek'
import URI from 'urijs'

const templatedRE = /{*}/

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
  constructor (factory, self, entity, root) {
    this._halacious = factory._halacious
    this.factory = factory
    this.request = factory._request
    this._root = root || this
    this.self = self.href
    this._links = { self }
    this._embedded = {}
    this._namespaces = {}
    this._props = {}
    this._ignore = {}
    this.entity = entity
  }

  /**
   * Adds a namespace to the 'curie' link collection. all curies in a response, top level or nested, should be declared
   * in the top level _links collection. a reference '_root' is kept to the top level representation for this purpose
   * @param namespace
   */
  curie (namespace) {
    if (namespace && !this._root._namespaces[namespace.prefix]) {
      this._root._namespaces[namespace.prefix] = namespace
      this._root._links.curies = this._root._links.curies || []
      this._root._links.curies.push({
        name: namespace.prefix,
        href: `${this._halacious.namespaceUrl(this.request, namespace)}/{rel}`,
        templated: true
      })
    }
  }

  /**
   * Adds a custom property to the HAL payload
   * @param {String} name the property name
   * @param {*} value the property value
   * @return {Representation}
   */
  prop (name, value) {
    this._props[name] = value
    return this
  }

  /**
   * Merges an object's properties into the custom properties collection.
   * @param prop
   */
  merge (prop) {
    hoek.merge(this._props, prop)
  }

  /**
   * @param {...String || String[]} args properties to ignore
   * @return {Representation}
   */
  ignore (...args) {
    const props = _.isArray(args[0]) ? args[0] : args
    props.forEach(function (prop) {
      this._ignore[prop] = true
    }, this)
    return this
  }

  /**
   * Prepares the representation for JSON serialization.
   * @return {{}}
   */
  toJSON () {
    // initialize the json entity
    const payload = { _links: this._links }
    const self = this

    // copy all target properties in the entity using JSON.stringify(). if the entity has a .toJSON() implementation,
    // it will be called. properties on the ignore list will not be copied
    const { entity } = this
    JSON.stringify(entity, (key, value) => {
      if (!key) {
        return value
      }
      if (!self._ignore[key]) {
        payload[key] = value
      }
    })

    // merge in any extra properties
    _.assign(payload, this._props)

    const embeddedKeys = _.keys(this._embedded)
    if (embeddedKeys.length > 0) {
      payload._embedded = {}

      const self = this
      embeddedKeys.forEach((embedKey) => {
        if (self._embedded[embedKey] instanceof Representation) {
          payload._embedded[embedKey] = {}
        } else if (self._embedded[embedKey] instanceof Array) {
          payload._embedded[embedKey] = []
        }

        JSON.stringify(self._embedded[embedKey], (key, value) => {
          if (!key) {
            return value
          }

          payload._embedded[embedKey][key] = value
        })
      })
    }

    return payload
  }

  /**
   * Creates a new link and adds it to the _links collection
   * @param rel
   * @param link
   * @return {{} || []} the new link
   */
  link (originalRel, link) {
    const rel = this._halacious.rel(originalRel)
    const qname = rel.qname()

    if (_.isArray(link)) {
      const that = this
      this._links[qname] = []
      return link.map((l) => that.link(originalRel, l), this)
    }

    // adds the namespace to the top level curie list
    this.curie(rel.namespace)

    link = this._halacious.link(link, this._links.self.href)
    link.templated = templatedRE.test(link.href) ? true : undefined
    // e.g. 'mco:rel'
    if (!this._links[qname]) {
      this._links[qname] = link
    } else if (_.isArray(this._links[qname])) {
      this._links[qname].push(link)
    } else {
      this._links[qname] = [this._links[qname], link]
    }

    return link
  }

  /**
   * Resolves a relative path against the representation's self href
   * @param relativePath
   * @return {*}
   */
  resolve (relativePath) {
    return new URI(relativePath)
      .absoluteTo(`${this._links.self.href}/`)
      .toString()
  }

  /**
   * Returns the path to a named route (specified by the plugins.hal.name configuration parameter), expanding any supplied
   * path parameters.
   * @param {String} routeName the route's name
   * @param {{}=} params for expanding templated urls
   * @return {*}
   */
  route (routeName, params) {
    return this._halacious.route(routeName, params)
  }

  /**
   * Wraps an entity into a HAL representation and adds it to the _embedded collection
   * @param {String} rel the rel name
   * @param {String || {}} self an href or link object for the entity
   * @param {{} || []} entity an object to wrap
   * @return {entity || []}
   */
  embed (originalRel, self, entity) {
    const rel = this._halacious.rel(originalRel)
    const qname = rel.qname()

    this.curie(rel.namespace)

    if (_.isArray(entity)) {
      const that = this
      this._embedded[qname] = []
      return entity.map((e) => that.embed(originalRel, self, e), this)
    }

    self = this._halacious.link(self, this._links.self.href)

    const embedded = this.factory.create(entity, self, this._root)

    if (!this._embedded[qname]) {
      this._embedded[qname] = embedded
    } else if (_.isArray(this._embedded[qname])) {
      this._embedded[qname].push(embedded)
    } else {
      this._embedded[qname] = [this._embedded[qname], embedded]
    }

    return embedded
  }

  /**
   * Convenience method for embedding an array of entities
   * @param rel
   * @param self
   * @param entities
   * @return {Representation}
   */
  embedCollection (rel, self, entities) {
    entities = _.isArray(entities) ? entities : [entities]
    entities.forEach(function (entity) {
      this.embed(rel, hoek.clone(self), entity)
    }, this)
    return this
  }

  /**
   * Configures a representation using a configuration object such as those found in route definitions
   * @param config
   * @param callback
   */
  configure (config, callback) {
    this._halacious.configureRepresentation(this, config, callback)
  }
}

/**
 * Responsible for creating all hal entities, top level or embedded, needed for a hapi request
 * @param halacious a reference to the plugin api
 * @param request a hapi request object
 * @constructor
 */
export class RepresentationFactory {
  constructor (halacious, request) {
    this._halacious = halacious
    this._request = request
  }

  /**
   * Creates a new hal representation out of a javascript object
   * @param {{}=} entity the entity to wrap with a representation. an empty object is created by default
   * @param {String || {}=} self the self href or link object. The request's path is used by default
   * @param {Representation} root a pointer to the top level representation for adding curied links
   * should be expanded into absolute urls
   * @return {Representation}
   */
  create (entity, self, root) {
    entity = entity || {}
    self = self || (this._request && this._request.path)
    self = this._halacious.link(self)
    return new Representation(this, self, entity, root)
  }
}

export default RepresentationFactory
