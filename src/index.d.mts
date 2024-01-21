declare module '@modernpoacher/halacious' {
  export namespace HalaciousTypes {
    interface RequestType {
      route: {
        method?: string
        path?: string
      }
      params: Record<string, any>
    }

    export interface Representation {
      getRequest: () => RequestType
      request: RequestType
      entity: Record<string, any>
      ignore: (v: string) => void
      embed: (v: string, u: string, m: object) => void
    }
  }

  export const plugin: object
}
