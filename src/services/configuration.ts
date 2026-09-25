/**
 * ConfigurationService — resolves the configuration for a session (PRD §5.2).
 * Overrides from the demo panel arrive through ConfigOverridesSource; production
 * builds pass none.
 */
import { resolveConfiguration } from '@/config/resolve';
import type { AppConfiguration, ConfigLayer, StateConfiguration } from '@/config/types';
import type { Institute } from '@/domain/entities';

export interface ConfigOverridesSource {
  /** `staffId` lets the demo give each persona its own mapping model. */
  get(context?: { readonly staffId?: string }): ConfigLayer;
}

export class ConfigurationService {
  constructor(private readonly state: StateConfiguration, private readonly overrides?: ConfigOverridesSource) {}

  get stateName(): string {
    return this.state.stateName;
  }

  /** The state-level floor, before any session-specific layers. */
  base(): AppConfiguration {
    return resolveConfiguration({ state: this.state, demoOverrides: this.overrides?.get() });
  }

  resolveFor(institute: Institute, staffId?: string): AppConfiguration {
    return resolveConfiguration({
      state: this.state,
      district: institute.district,
      instituteId: institute.id,
      demoOverrides: this.overrides?.get({ staffId }),
    });
  }
}
