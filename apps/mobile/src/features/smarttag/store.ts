/**
 * PolyAero Cathay SmartTag — Mobile Store & Navigation State (Phase 2)
 *
 * Wraps `InMemorySmartTagRepository` from `@polyaero/shared` with:
 *   - Web `localStorage` persistence adapter when available (pure memory on native, zero extra native deps)
 *   - Active sub-screen navigation inside the My Trips / My Bookings tab so the
 *     existing 5-tab floating pill dock stays visible on all 5 approved mockups
 *   - Hardware back stack and Expo Router deep-link synchronization
 *   - React 19 `useSyncExternalStore` hook (`useSmartTagStore`)
 */

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import {
  InMemorySmartTagRepository,
  KeyValueStorageAdapter,
  SmartTagRepository,
  SmartTagRepositorySnapshot,
  DEMO_ITINERARY_ID,
  DEFAULT_DECLARATIONS,
  backendClient,
} from '@polyaero/shared';

export type SmartTagScreenRoute =
  | 'bookings'
  | 'prepare'
  | 'sync'
  | 'result'
  | 'journey'
  | 'report';

export interface SmartTagNavigationState {
  currentRoute: SmartTagScreenRoute;
  history: SmartTagScreenRoute[];
}

const createWebStorageAdapter = (): KeyValueStorageAdapter | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
      removeItem: (key: string) => window.localStorage.removeItem(key),
    };
  }
  return null;
};

class MobileSmartTagController {
  public readonly repository: SmartTagRepository;
  private nav: SmartTagNavigationState = {
    currentRoute: 'bookings',
    history: [],
  };
  private navListeners = new Set<() => void>();
  private combinedSnapshot: {
    repo: SmartTagRepositorySnapshot;
    nav: SmartTagNavigationState;
    isLiveBackendConfigured: boolean;
  };

  constructor() {
    const initialUrl = this.readInitialWebParams();
    this.repository = new InMemorySmartTagRepository({
      storage: createWebStorageAdapter(),
      populateDemoBookingOnInit: initialUrl.populateDemo,
    });

    if (initialUrl.populateDemo && this.repository.listItineraries().length === 0) {
      this.repository.addDemoItinerary();
    }

    if (initialUrl.seedPreset) {
      const itin = this.repository.addDemoItinerary();
      const { bags } = this.repository.prepareBagsForItinerary({
        itineraryId: itin.id,
        bagCount: 1,
        declarations: DEFAULT_DECLARATIONS,
      });
      if (bags[0]) {
        this.repository.seedDemoJourneyMilestonePreset(bags[0].id, initialUrl.seedPreset);
      }
    } else if (initialUrl.prepareOnly) {
      const itin = this.repository.addDemoItinerary();
      this.repository.prepareBagsForItinerary({
        itineraryId: itin.id,
        bagCount: 1,
        declarations: DEFAULT_DECLARATIONS,
      });
    }

    if (initialUrl.route) {
      this.nav = {
        currentRoute: initialUrl.route,
        history: initialUrl.route === 'bookings' ? [] : ['bookings'],
      };
    }

    this.combinedSnapshot = {
      repo: this.repository.getSnapshot(),
      nav: this.nav,
      isLiveBackendConfigured: backendClient.isConfigured(),
    };

    this.repository.subscribe(() => {
      this.refreshCombinedSnapshot();
      this.emit();
    });
  }

  private readInitialWebParams(): {
    populateDemo: boolean;
    prepareOnly: boolean;
    seedPreset:
      | 'AWAITING_DROP'
      | 'ACCEPTED'
      | 'LOADED'
      | 'ARRIVED_TOKYO'
      | 'COLLECTED'
      | 'DELAYED'
      | null;
    route: SmartTagScreenRoute | null;
  } {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return { populateDemo: false, prepareOnly: false, seedPreset: null, route: null };
    }
    const params = new URLSearchParams(window.location.search);
    const booked = params.get('booked') === '1' || params.get('booked') === 'true';
    const smarttagParam = params.get('smarttag') as SmartTagScreenRoute | null;
    const validRoutes: SmartTagScreenRoute[] = [
      'bookings',
      'prepare',
      'sync',
      'result',
      'journey',
      'report',
    ];
    const route =
      smarttagParam && validRoutes.includes(smarttagParam) ? smarttagParam : null;

    const presetParam = params.get('preset');
    let seedPreset:
      | 'AWAITING_DROP'
      | 'ACCEPTED'
      | 'LOADED'
      | 'ARRIVED_TOKYO'
      | 'COLLECTED'
      | 'DELAYED'
      | null = null;
    if (
      presetParam === 'AWAITING_DROP' ||
      presetParam === 'ACCEPTED' ||
      presetParam === 'LOADED' ||
      presetParam === 'ARRIVED_TOKYO' ||
      presetParam === 'COLLECTED' ||
      presetParam === 'DELAYED'
    ) {
      seedPreset = presetParam;
    } else if (route === 'result') {
      seedPreset = 'AWAITING_DROP';
    } else if (route === 'journey') {
      seedPreset = 'ARRIVED_TOKYO';
    }

    const prepareOnly = route === 'sync' && !seedPreset;
    const populateDemo = booked || Boolean(route && route !== 'bookings') || Boolean(seedPreset);

    return { populateDemo, prepareOnly, seedPreset, route };
  }

  private refreshCombinedSnapshot(): void {
    this.combinedSnapshot = {
      repo: this.repository.getSnapshot(),
      nav: this.nav,
      isLiveBackendConfigured: backendClient.isConfigured(),
    };
  }

  private emit(): void {
    this.navListeners.forEach((l) => l());
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.navListeners.add(listener);
    return () => {
      this.navListeners.delete(listener);
    };
  };

  public getSnapshot = () => this.combinedSnapshot;

  public navigateTo(
    route: SmartTagScreenRoute,
    options?: { itineraryId?: string; bagSetupId?: string; replace?: boolean }
  ): void {
    if (options?.itineraryId) {
      this.repository.setActiveContext(options.itineraryId, options.bagSetupId);
    } else if (!this.repository.getSnapshot().activeItineraryId) {
      const first = this.repository.listItineraries()[0];
      if (first) {
        this.repository.setActiveContext(first.id, options?.bagSetupId);
      }
    }

    if (route === 'bookings') {
      this.nav = { currentRoute: 'bookings', history: [] };
    } else if (options?.replace) {
      this.nav = {
        currentRoute: route,
        history: this.nav.history.length > 0 ? this.nav.history : ['bookings'],
      };
    } else if (this.nav.currentRoute !== route) {
      this.nav = {
        currentRoute: route,
        history: [...this.nav.history, this.nav.currentRoute],
      };
    }
    this.refreshCombinedSnapshot();
    this.emit();
  }

  public goBack(): boolean {
    if (this.nav.currentRoute === 'bookings') {
      return false;
    }
    const nextHistory = [...this.nav.history];
    const previous = nextHistory.pop() ?? 'bookings';
    this.nav = {
      currentRoute: previous,
      history: nextHistory,
    };
    this.refreshCombinedSnapshot();
    this.emit();
    return true;
  }

  public resetToBookings(): void {
    this.nav = { currentRoute: 'bookings', history: [] };
    this.refreshCombinedSnapshot();
    this.emit();
  }

  public resetAllDemoState(populateDemoBooking = false): void {
    this.repository.resetDemoState({ populateDemoBooking });
    this.nav = { currentRoute: 'bookings', history: [] };
    this.refreshCombinedSnapshot();
    this.emit();
  }

  public ensureActiveItineraryId(): string {
    const snap = this.repository.getSnapshot();
    if (snap.activeItineraryId) return snap.activeItineraryId;
    const first = snap.itineraries[0];
    if (first) return first.id;
    return DEMO_ITINERARY_ID;
  }
}

export const smartTagController = new MobileSmartTagController();
export const smartTagRepository = smartTagController.repository;

export function useSmartTagStore() {
  return useSyncExternalStore(
    smartTagController.subscribe,
    smartTagController.getSnapshot,
    smartTagController.getSnapshot
  );
}
