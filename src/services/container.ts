/**
 * Composition root. Builds repositories and services for a data source.
 * `mock` (the only source today) wires the KeyValueStore-backed repositories and
 * simulated providers; `api` will wire repositories/api without touching UI code.
 */
import { MAHARASHTRA } from '@/config/states/maharashtra';
import type { StateConfiguration } from '@/config/types';
import { isPackStale } from '@/domain/device';
import { EventBus } from '@/lib/events';
import type { KeyValueStore } from '@/lib/kv-store';
import type { Clock } from '@/lib/time';
import type { Repositories } from '@/repositories/interfaces';
import { MockDatabase } from '@/repositories/mock/database';
import {
  MockAttendanceRepository,
  MockBatchPackRepository,
  MockCorrectionRepository,
  MockFaceEnrolmentRepository,
  MockMasterDataRepository,
  MockOfflineQueueRepository,
  DevicePreferencesRepository,
  MockSessionRepository,
  MockStaffAttendanceRepository,
  MockVerificationRepository,
} from '@/repositories/mock/repositories';
import { AttendanceService } from './attendance';
import { MockAuthService, type AuthService } from './auth';
import { ConfigurationService, type ConfigOverridesSource } from './configuration';
import { BrowserConnectivity, SimulatedConnectivity, type ConnectivityService } from './connectivity';
import { CorrectionService } from './corrections';
import type { FaceVerificationService } from './face';
import { BatchPackService } from './packs';
import { BrowserLocationProvider, type LocationProvider } from './location';
import { ReportService } from './reports';
import { SessionService } from './session';
import { SimulatedFaceVerificationService } from './simulated/face';
import { SimulatedLocationProvider } from './simulated/location';
import { SimulatedSyncGateway } from './simulated/sync-gateway';
import { simulatedDelay, type SimulationSource } from './simulation';
import { StaffAttendanceService } from './staff-attendance';
import { SyncService } from './sync';
import { VerificationService } from './verification';

export interface Services {
  readonly auth: AuthService;
  readonly session: SessionService;
  readonly configuration: ConfigurationService;
  readonly attendance: AttendanceService;
  readonly verification: VerificationService;
  readonly face: FaceVerificationService;
  readonly corrections: CorrectionService;
  readonly staffAttendance: StaffAttendanceService;
  readonly reports: ReportService;
  readonly sync: SyncService;
  readonly packs: BatchPackService;
  readonly connectivity: ConnectivityService;
}

export interface AppContainer {
  readonly repositories: Repositories;
  readonly services: Services;
  readonly bus: EventBus;
  readonly clock: Clock;
  readonly simulation: SimulationSource;
  /** Demo-only handle to the mock database (Reset Demo, face-enrolment toggle). */
  readonly mockDatabase: MockDatabase;
}

export interface MockContainerOptions {
  readonly store: KeyValueStore;
  /** Device-level preferences (language). Separate from mock data. */
  readonly preferencesStore: KeyValueStore;
  readonly clock: Clock;
  readonly simulation: SimulationSource;
  readonly configOverrides?: ConfigOverridesSource;
  readonly state?: StateConfiguration;
  /** Production wiring: real browser online/offline events and Geolocation API. */
  readonly realDevice?: boolean;
}

export function createMockContainer(opts: MockContainerOptions): AppContainer {
  const bus = new EventBus();
  const db = new MockDatabase(opts.store, opts.clock, bus);
  const delay = simulatedDelay(opts.simulation);
  const masterData = new MockMasterDataRepository(db, delay);
  const faceEnrolment = new MockFaceEnrolmentRepository(db);

  const repositories: Repositories = {
    masterData,
    attendance: new MockAttendanceRepository(db),
    corrections: new MockCorrectionRepository(db),
    staffAttendance: new MockStaffAttendanceRepository(db),
    faceEnrolment,
    verification: new MockVerificationRepository(db),
    offlineQueue: new MockOfflineQueueRepository(db),
    packs: new MockBatchPackRepository(db),
    session: new MockSessionRepository(db),
    preferences: new DevicePreferencesRepository(opts.preferencesStore, bus),
    syncGateway: new SimulatedSyncGateway(opts.simulation, opts.clock),
  };

  const configuration = new ConfigurationService(opts.state ?? MAHARASHTRA, opts.configOverrides);
  const connectivity: ConnectivityService = opts.realDevice ? new BrowserConnectivity() : new SimulatedConnectivity(opts.simulation);
  const face = new SimulatedFaceVerificationService(opts.simulation, faceEnrolment, opts.clock);
  const auth = new MockAuthService(masterData, repositories.session, opts.clock);

  const location: LocationProvider = opts.realDevice ? new BrowserLocationProvider() : new SimulatedLocationProvider(opts.simulation);
  const session = new SessionService(auth, masterData, configuration, face, opts.clock);

  const sync = new SyncService({
    queue: repositories.offlineQueue,
    attendance: repositories.attendance,
    staff: repositories.staffAttendance,
    gateway: repositories.syncGateway,
    connectivity,
    bus,
    autoSync: () => configuration.base().offline.autoSync,
    confirmationMs: () => 3500 * Math.max(opts.simulation.get().speed, 0.05),
  });
  const onRecordQueued = () => sync.request();
  const corrections = new CorrectionService(repositories.attendance, repositories.corrections);

  const services: Services = {
    auth,
    session,
    configuration,
    connectivity,
    face,
    sync,
    corrections,
    verification: new VerificationService(repositories.verification, location, face),
    attendance: new AttendanceService({
      attendance: repositories.attendance,
      corrections: repositories.corrections,
      verification: repositories.verification,
      offlineQueue: repositories.offlineQueue,
      packs: repositories.packs,
      isOnline: () => connectivity.isOnline(),
      isPackStale: (downloadedAt) => isPackStale({ batchId: '', downloadedAt }, opts.clock.now(), configuration.base().offline.refreshDays),
      onRecordQueued,
    }),
    staffAttendance: new StaffAttendanceService(repositories.staffAttendance, repositories.verification, repositories.offlineQueue, onRecordQueued),
    reports: new ReportService(repositories.attendance, repositories.corrections, repositories.staffAttendance, corrections),
    packs: new BatchPackService(repositories.packs, connectivity),
  };

  return { repositories, services, bus, clock: opts.clock, simulation: opts.simulation, mockDatabase: db };
}
