/**
 *  Previously `reach`
 */
export default function getFieldValueByPath (path = '', context = {}) {
  const fieldNames = String(path).split('.')

  return (
    fieldNames
      .filter(Boolean)
      .reduce((accumulator, fieldName) => (
        Reflect.has(accumulator, fieldName)
          ? Reflect.get(accumulator, fieldName)
          : accumulator
      ), context)
  )
}
