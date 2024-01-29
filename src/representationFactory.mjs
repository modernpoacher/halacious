import Representation from './representation.mjs'

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
      new Representation(this, entity, link, root)
    )
  }
}

export default RepresentationFactory
