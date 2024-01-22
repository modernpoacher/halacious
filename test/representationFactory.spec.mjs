import * as chai from 'chai'
import hapi from '@hapi/hapi'
import halacious from '#halacious'
import RepresentationFactory from '#halacious/representationFactory'

const should = chai.should()

const PLUGIN = 'halacious' // '@modernpoacher/halacious'

describe('Representation Factory', () => {
  let server
  let representationFactory

  beforeEach(async () => {
    server = hapi.server({ port: 9191 })

    await server.register(halacious)

    const {
      plugins: {
        [PLUGIN]: plugin
      }
    } = server

    representationFactory = new RepresentationFactory(plugin)
  })

  afterEach(async () => {
    await server.stop()
  })

  it('should create a new representation', () => {
    should.exist(representationFactory)
    const entity = { firstName: 'Bob', lastName: 'Smith' }
    const representation = representationFactory.create(entity, '/people')
    representation._links.should.have.property('self')
    representation._links.self.should.have.property('href', '/people')
    representation.should.have.property('entity', entity)
  })

  it('should serialize a simple entity into property JSON', () => {
    const entity = { firstName: 'Bob', lastName: 'Smith' }
    const representation = representationFactory.create(entity, '/people')
    const json = JSON.stringify(representation)
    json.should.deep.equal(
      '{"_links":{"self":{"href":"/people"}},"firstName":"Bob","lastName":"Smith"}'
    )
  })

  it('should create an array of like-named links', () => {
    const entity = {}
    const representation = representationFactory.create(entity, '/people')
    representation.link('mco:boss', '/people/100')
    representation.link('mco:boss', '/people/101')
    representation.link('mco:boss', '/people/102')
    representation._links['mco:boss'].should.have.length(3)
    representation._links['mco:boss'][0].should.have.property('href', '/people/100')
    representation._links['mco:boss'][1].should.have.property('href', '/people/101')
    representation._links['mco:boss'][2].should.have.property('href', '/people/102')
  })

  it('should create a single-element array of links', () => {
    const entity = {}
    const representation = representationFactory.create(entity, '/people')
    representation.link('mco:boss', ['/people/100'])
    representation._links['mco:boss'].should.have.length(1)
    representation._links['mco:boss'][0].should.have.property('href', '/people/100')
  })

  it('should create an array of like-named embeds', () => {
    const entity = {}
    const representation = representationFactory.create(entity, '/people')
    representation.embed('mco:boss', '/people/100', {})
    representation.embed('mco:boss', '/people/101', {})
    representation.embed('mco:boss', '/people/102', {})
    representation._embedded['mco:boss'].should.have.length(3)
    representation._embedded['mco:boss'][0]._links.self.should.have.property(
      'href',
      '/people/100'
    )
    representation._embedded['mco:boss'][1]._links.self.should.have.property(
      'href',
      '/people/101'
    )
    representation._embedded['mco:boss'][2]._links.self.should.have.property(
      'href',
      '/people/102'
    )
  })

  it('should ignore properties', () => {
    const obj = { id: 100, first: 'John', last: 'Smith' }
    const representation = representationFactory.create(obj, '/people')
    representation.ignore('id', 'first')
    const json = JSON.stringify(representation)
    json.should.deep.equal(
      '{"_links":{"self":{"href":"/people"}},"last":"Smith"}'
    )
  })

  it('should support extra properties', () => {
    const obj = { id: 100, first: 'John', last: 'Smith' }
    const representation = representationFactory.create(obj, '/people')
    representation.ignore('id')
    representation.prop('company', 'ACME')
    const json = JSON.stringify(representation)
    json.should.deep.equal(
      '{"_links":{"self":{"href":"/people"}},"first":"John","last":"Smith","company":"ACME"}'
    )
  })

  it('should support objects with custom json serialization', () => {
    const entity = {
      _id: 100,
      _hidden: 'hidden',
      name: 'John Smith',
      company: 'Acme',
      toJSON () {
        return {
          id: this._id,
          name: this.name,
          company: this.company,
          boss: this.boss
        }
      },
      boss: {
        _id: 100,
        _hidden: 'hidden',
        name: 'Boss Man',
        company: 'Acme',
        toJSON () {
          return {
            id: this._id,
            name: this.name,
            company: this.company
          }
        }
      }
    }

    const representation = representationFactory.create(entity, '/me')
    const json = JSON.stringify(representation)
    json.should.deep.equal(
      '{"_links":{"self":{"href":"/me"}},"id":100,"name":"John Smith","company":"Acme","boss":{"id":100,"name":"Boss Man","company":"Acme"}}'
    )
  })

  it('should handle direct call toJSON correctly', () => {
    const entity = {
      _id: 100,
      _hidden: 'hidden',
      name: 'John Smith',
      company: 'Acme',
      toJSON () {
        return {
          id: this._id,
          name: this.name,
          company: this.company
        }
      }
    }

    const boss = {
      _id: 100,
      _hidden: 'hidden',
      name: 'Boss Man',
      company: 'Acme',
      toJSON () {
        return {
          id: this._id,
          name: this.name,
          company: this.company
        }
      }
    }

    const representation = representationFactory.create(entity, '/me')

    // Should embed array of objects correctly
    representation.embed('mco:boss', './boss1', [boss])

    // Should embed single object correctly
    representation.embed('mco:boss2', './boss2', boss)

    const json = representation.toJSON()
    json.should.deep.equal({
      _links: { self: { href: '/me' } },
      id: 100,
      name: 'John Smith',
      company: 'Acme',
      _embedded: {
        'mco:boss': [
          {
            _links: { self: { href: '/me/boss1' } },
            id: 100,
            name: 'Boss Man',
            company: 'Acme'
          }
        ],
        'mco:boss2': {
          _links: { self: { href: '/me/boss2' } },
          id: 100,
          name: 'Boss Man',
          company: 'Acme'
        }
      }
    })
  })

  it('should link to a registered rel', () => {
    const {
      plugins: {
        [PLUGIN]: plugin
      }
    } = server

    plugin.namespaces
      .add({ name: 'mycompany', prefix: 'mco' })
      .rel({ name: 'boss' })

    const entity = { firstName: 'Bob', lastName: 'Smith' }
    const representation = representationFactory.create(entity, '/people')
    representation.link('mco:boss', '/people/1234')
    representation._links.should.have.property('mco:boss')
    representation._links['mco:boss'].should.have.property('href', '/people/1234')
  })

  it('should not break when linking an empty array', () => {
    const representation = representationFactory.create({ firstName: 'Bob' }, '/people')
    representation.link('employees', [])
    representation._links.should.have.property('employees').that.has.length(0)
  })

  it('should resolve relative paths', () => {
    const entity = { firstName: 'Bob', lastName: 'Smith' }
    const representation = representationFactory.create(entity, '/people')
    representation.resolve('./1234').should.equal('/people/1234')
    representation.resolve('../1234').should.equal('/1234')
    representation.resolve('/companies/100').should.equal('/companies/100')
  })

  it('should include a curie link', () => {
    const {
      plugins: {
        [PLUGIN]: plugin
      }
    } = server

    plugin.namespaces
      .add({ name: 'mycompany', prefix: 'mco' })
      .rel({ name: 'boss' })

    const representation = representationFactory.create({}, '/people')
    representation.link('mco:boss', '/people/1234')
    const json = JSON.stringify(representation)
    json.should.deep.equal(
      '{"_links":{"self":{"href":"/people"},"curies":[{"name":"mco","href":"/rels/mycompany/{rel}","templated":true}],"mco:boss":{"href":"/people/1234"}}}'
    )
  })

  it('should embed an entity', () => {
    const {
      plugins: {
        [PLUGIN]: plugin
      }
    } = server

    plugin.namespaces
      .add({ name: 'mycompany', prefix: 'mco' })
      .rel({ name: 'boss' })

    const representation = representationFactory.create(
      { firstName: 'Bob', lastName: 'Smith' },
      '/people/me'
    )
    representation.embed('mco:boss', './boss', {
      firstName: 'Boss',
      lastName: 'Man'
    })

    const json = JSON.stringify(representation)
    const obj = JSON.parse(json)
    obj.should.deep.equal({
      _links: {
        self: { href: '/people/me' },
        curies: [
          { name: 'mco', href: '/rels/mycompany/{rel}', templated: true }
        ]
      },
      firstName: 'Bob',
      lastName: 'Smith',
      _embedded: {
        'mco:boss': {
          _links: { self: { href: '/people/me/boss' } },
          firstName: 'Boss',
          lastName: 'Man'
        }
      }
    })
  })

  it('should embed an empty array', () => {
    const {
      plugins: {
        [PLUGIN]: plugin
      }
    } = server

    plugin.namespaces
      .add({ name: 'mycompany', prefix: 'mco' })
      .rel({ name: 'boss' })

    const representation = representationFactory.create(
      { firstName: 'Bob', lastName: 'Smith' },
      '/people/me'
    )
    representation.embed('mco:boss', './boss', [])

    const json = JSON.stringify(representation)
    const obj = JSON.parse(json)
    obj.should.deep.equal({
      _links: {
        self: { href: '/people/me' },
        curies: [
          { name: 'mco', href: '/rels/mycompany/{rel}', templated: true }
        ]
      },
      firstName: 'Bob',
      lastName: 'Smith',
      _embedded: {
        'mco:boss': []
      }
    })
  })

  it('should use top level curie link', () => {
    const {
      plugins: {
        [PLUGIN]: plugin
      }
    } = server

    plugin.namespaces
      .add({ name: 'mycompany', prefix: 'mco' })
      .rel({ name: 'boss' })

    plugin.namespaces
      .add({ name: 'google', prefix: 'goog' })
      .rel({ name: 'profile' })

    const representation = representationFactory.create(
      { firstName: 'Bob', lastName: 'Smith' },
      '/people/me'
    )
    const boss = representation.embed('mco:boss', './boss', {
      firstName: 'Boss',
      lastName: 'Man'
    })
    boss.link('goog:profile', 'http://users.google.com/BossMan')
    const json = JSON.stringify(representation)
    const obj = JSON.parse(json)
    obj.should.deep.equal({
      _links: {
        self: { href: '/people/me' },
        curies: [
          { name: 'mco', href: '/rels/mycompany/{rel}', templated: true },
          { name: 'goog', href: '/rels/google/{rel}', templated: true }
        ]
      },
      firstName: 'Bob',
      lastName: 'Smith',
      _embedded: {
        'mco:boss': {
          _links: {
            self: { href: '/people/me/boss' },
            'goog:profile': { href: 'http://users.google.com/BossMan' }
          },
          firstName: 'Boss',
          lastName: 'Man'
        }
      }
    })
  })
})
