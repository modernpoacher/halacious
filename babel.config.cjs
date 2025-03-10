const debug = require('debug')

const log = debug('@modernpoacher/halacious')

const {
  env: {
    NODE_ENV = 'development'
  }
} = process

log('`@modernpoacher/halacious` is awake')

function env () {
  log({ NODE_ENV })

  return (
    NODE_ENV === 'production'
  )
}

const presets = [
  [
    '@babel/env',
    {
      targets: {
        node: 'current'
      },
      useBuiltIns: 'usage',
      corejs: 3
    }
  ]
]

const plugins = [
  '@babel/syntax-import-assertions'
]

// @ts-ignore
module.exports = (api) => {
  if (api) api.cache.using(env)

  return {
    presets,
    plugins
  }
}
