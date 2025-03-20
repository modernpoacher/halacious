import Negotiator from 'negotiator'

/**
 *  Selects the media type based on the request's Accept header and a ranked ordering of configured
 *  media types
 *
 *  @param request
 *  @param mediaTypes
 *  @return {*}
 */
export default function getMediaType (request, mediaTypes) {
  return (
    new Negotiator(request).mediaType([].concat(mediaTypes))
  )
}
