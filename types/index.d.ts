declare namespace halacious {
  export interface Representation {
    request: {
      route: {
        method?: string
        path?: string
      }
      params: {
        collection?: string
        member?: string
      }
    }
    entity: {
      collections?: Array<{ uid: string }>
      members?: Array<{ uid: string }>
    }
    ignore: (v: string) => void
    embed: (v: string, u: string, m: object) => void
  }
}

export default halacious
