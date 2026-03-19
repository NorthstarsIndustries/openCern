export interface ProfileData {
    username: string | null;
    displayName: string | null;
    email: string | null;
    org: string | null;
    authenticated: boolean;
    anthropicKey: boolean;
    ibmQuantumKey: boolean;
    defaultModel: string;
    dataDir: string;
}
export declare function getProfile(): ProfileData;
export declare function setProfileField(key: string, value: string): {
    success: boolean;
    message: string;
};
export declare function formatProfile(): string[];
export declare function exportProfile(): string;
//# sourceMappingURL=profile.d.ts.map