import { createContext, useContext, type ParentProps } from "solid-js"

const ExitContext = createContext<() => void>()

export function ExitProvider(props: ParentProps<{ onExit: () => void }>) {
  return <ExitContext.Provider value={props.onExit}>{props.children}</ExitContext.Provider>
}

export function useExit() {
  const exit = useContext(ExitContext)
  if (!exit) throw new Error("ExitProvider not found")
  return exit
}
