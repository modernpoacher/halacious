function reduce (accumulator, fieldName) {
  return (
    fieldName in accumulator // Reflect.has(accumulator, fieldName)
      ? accumulator[fieldName] // Reflect.get(accumulator, fieldName)
      : accumulator
  )
}

/**
 *  Previously `reach`
 */
export default function getFieldValueByPath (path = '', context = {}) {
  const fieldNames = String(path ?? '').split('.')

  return (
    fieldNames
      .filter(Boolean)
      .reduce(reduce, context)
  )
}
