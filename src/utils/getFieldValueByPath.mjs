function reduce (accumulator, fieldName) {
  return (
    fieldName in accumulator
      ? accumulator[fieldName]
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
