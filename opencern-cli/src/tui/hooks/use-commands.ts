import { registry, type CommandCategory } from "../../commands/registry.js"

export function useCommands() {
  return {
    getAll() {
      return registry.getAll()
    },
    find(name: string) {
      return registry.find(name)
    },
    search(query: string) {
      return registry.search(query)
    },
    getCompletions(partial: string) {
      return registry.getCompletions(partial)
    },
    getCategories() {
      return registry.getCategories()
    },
    getByCategory(category: CommandCategory) {
      return registry.getByCategory(category)
    },
  }
}
