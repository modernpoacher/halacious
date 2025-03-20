import getFieldValueByPath from './getFieldValueByPath.mjs'

const REG = /{([^{}]+)}|([^{}]+)/g

/**
 *  Evaluates and flattens deep expressions (e.g. '/{foo.a.b}') into a single level context object: {'foo.a.b': value}
 *  so that it may be used by url-template library
 *
 *  @param template
 *  @param context
 *  @return {{}}
 */
export default function getTemplateContext (template, context) {
  const templateContext = {}
  let matches

  while ((matches = REG.exec(template))) {
    if (Array.isArray(matches)) {
      const [
        , // input,
        path
      ] = matches

      if (path) {
        const fieldValue = getFieldValueByPath(path, context)
        if (fieldValue) Reflect.set(templateContext, path, fieldValue.toString())
      }
    }
  }

  return templateContext
}
