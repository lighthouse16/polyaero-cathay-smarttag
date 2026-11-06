/**
 * PolyAero Cathay SmartTag - Supabase Client Abstraction
 * Supports optional backend integration without breaking local mock development.
 */

export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
}

export class BackendClientManager {
  private static instance: BackendClientManager;
  private url: string | undefined;
  private anonKey: string | undefined;

  private constructor() {
    // Check Expo environment variables or Next.js environment variables
    this.url =
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
      undefined;

    this.anonKey =
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
      undefined;
  }

  public static getInstance(): BackendClientManager {
    if (!BackendClientManager.instance) {
      BackendClientManager.instance = new BackendClientManager();
    }
    return BackendClientManager.instance;
  }

  public isConfigured(): boolean {
    return Boolean(this.url && this.anonKey && !this.url.includes('your-project'));
  }

  public getConfig(): SupabaseConfig {
    return {
      url: this.url,
      anonKey: this.anonKey,
    };
  }
}

export const backendClient = BackendClientManager.getInstance();
