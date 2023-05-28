declare namespace halacious {
  export interface Collection {
    uid: string
  }

  export interface Member {
    uid: string
  }

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
      collections?: Collection[]
      members?: Member[]
    }
    ignore: (v: string) => void
    embed: (v: string, u: string, m: object) => void
  }
}

export = halacious
