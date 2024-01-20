declare module '@modernpoacher/halacious' {
  export namespace HalaciousTypes {
    export interface Representation {
      request: {
        route: {
          method?: string
          path?: string
        }
        params: Record<string, any>
      }
      entity: Record<string, any>
      ignore: (v: string) => void
      embed: (v: string, u: string, m: object) => void
    }
  }

  export const plugin: object
}
