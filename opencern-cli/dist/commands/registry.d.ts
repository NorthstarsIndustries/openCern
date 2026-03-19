export type CommandCategory = 'data' | 'analysis' | 'ai' | 'container' | 'session' | 'system' | 'file';
export interface CommandDef {
    name: string;
    aliases?: string[];
    description: string;
    usage?: string;
    category: CommandCategory;
    requiresApi?: boolean;
    requiresAuth?: boolean;
    requiresDocker?: boolean;
    shortcut?: string;
    args?: ArgSpec[];
}
export interface ArgSpec {
    name: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean' | 'file';
    description?: string;
}
export declare const registry: {
    getAll(): CommandDef[];
    getByCategory(category: CommandCategory): CommandDef[];
    getCategories(): CommandCategory[];
    getCategoryLabel(category: CommandCategory): string;
    find(name: string): CommandDef | undefined;
    search(query: string): CommandDef[];
    getCompletions(partial: string): CommandDef[];
    requiresApi(name: string): boolean;
    requiresDocker(name: string): boolean;
};
export default registry;
//# sourceMappingURL=registry.d.ts.map