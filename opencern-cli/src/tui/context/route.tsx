import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper.js"

export type HomeRoute = {
  type: "home"
}

export type SessionRoute = {
  type: "session"
  prompt?: string
}

export type DockerRoute = {
  type: "docker"
}

export type QuantumRoute = {
  type: "quantum"
}

export type DatasetsRoute = {
  type: "datasets"
}

export type LogsRoute = {
  type: "logs"
}

export type Route = HomeRoute | SessionRoute | DockerRoute | QuantumRoute | DatasetsRoute | LogsRoute

export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route",
  init: () => {
    const [store, setStore] = createStore<Route>({ type: "home" })

    return {
      get data() {
        return store
      },
      navigate(route: Route) {
        setStore(route)
      },
    }
  },
})

export function useRouteData<T extends Route["type"]>(type: T) {
  const route = useRoute()
  return route.data as Extract<Route, { type: typeof type }>
}
