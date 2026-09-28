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
import { MockAnnouncementRepository } from '@/repositories/mock/announcements';
import { AnnouncementService } from './announcements';
import { AttendanceService } from './attendance';
import { MockAuthService, type AuthService } from './auth';
import { ConfigurationService, type ConfigOverridesSource } from './configuration';
import { BrowserConnectivity, SimulatedConnectivity, type ConnectivityService } from './connectivity';
import { CorrectionService } from './corrections';
import { BasicClientLivenessService } from './camera/client-liveness';
import { CameraFaceCaptureService } from './camera/device-camera';
import { loadFaceDetector } from './camera/face-detector';
import { RoutedLiveness, SwitchableFaceCapture } from './camera/routing';
import type { FaceCaptureService, FaceMatchService, LivenessService } from './face';
import type { LoginAssistSource } from './login-assist';
import { BatchPackService } from './packs';
import { BrowserLocationProvider, type LocationProvider } from './location';
import { ReportService } from './reports';
import { SessionService } from './session';
import { MockFaceMatchService, SimulatedFaceCaptureService, SimulatedLivenessService } from './simulated/face';
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
  /** The camera (real front camera, or the demo's simulated one). */
  readonly faceCapture: FaceCaptureService;
  /** Guides the steps and takes the photos: a prototype movement check, not production liveness. */
  readonly liveness: LivenessService;
  /** Enrolment + matching: SIMULATED in this build (MockFaceMatchService). */
  readonly faceMatch: FaceMatchService;
  readonly corrections: CorrectionService;
  readonly staffAttendance: StaffAttendanceService;
  readonly reports: ReportService;
  readonly sync: SyncService;
  readonly packs: BatchPackService;
  /** Institute / state notices for Home (D-054). */
  readonly announcements: AnnouncementService;
  readonly connectivity: ConnectivityService;
  /** Demo-only prefill for the login inputs; null in production (nothing renders). */
  readonly loginAssist: LoginAssistSource | null;
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
  readonly loginAssist?: LoginAssistSource;
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
    announcements: new MockAnnouncementRepository(db),
    session: new MockSessionRepository(db),
    preferences: new DevicePreferencesRepository(opts.preferencesStore, bus),
    syncGateway: new SimulatedSyncGateway(opts.simulation, opts.clock),
  };

  const configuration = new ConfigurationService(opts.state ?? MAHARASHTRA, opts.configOverrides);
  const connectivity: ConnectivityService = opts.realDevice ? new BrowserConnectivity() : new SimulatedConnectivity(opts.simulation);
  // Face (D-048): real camera + on-device movement check; matching is simulated until a provider exists.
  const faceCapture = new SwitchableFaceCapture(opts.simulation, new CameraFaceCaptureService(opts.clock), new SimulatedFaceCaptureService(opts.simulation, opts.clock));
  const liveness = new RoutedLiveness(
    new BasicClientLivenessService({ mode: () => opts.simulation.get().liveness, loadDetector: loadFaceDetector, wait: delay }),
    new SimulatedLivenessService(opts.simulation),
  );
  const faceMatch = new MockFaceMatchService(opts.simulation, faceEnrolment, opts.clock);
  const auth = new MockAuthService(masterData, repositories.session, opts.clock);

  const location: LocationProvider = opts.realDevice ? new BrowserLocationProvider() : new SimulatedLocationProvider(opts.simulation);
  const session = new SessionService(auth, masterData, configuration, faceMatch, opts.clock);

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
    faceCapture,
    liveness,
    faceMatch,
    sync,
    corrections,
    verification: new VerificationService(repositories.verification, location, faceCapture, faceMatch),
    attendance: new AttendanceService({
      attendance: repositories.attendance,
      corrections: repositories.corrections,
      verification: repositories.verification,
      offlineQueue: repositories.offlineQueue,
      packs: repositories.packs,
      isOnline: () => connectivity.isOnline(),
      isPackStale: (downloadedAt) => isPackStale({ batchId: '', downloadedAt }, opts.clock.now(), configuration.base().offline.refreshDays),
      onRecordQueued,
      delay,
    }),
    staffAttendance: new StaffAttendanceService(repositories.staffAttendance, repositories.verification, repositories.offlineQueue, onRecordQueued),
    reports: new ReportService(repositories.attendance, repositories.corrections, repositories.staffAttendance, corrections, delay),
    packs: new BatchPackService(repositories.packs, connectivity, repositories.offlineQueue, delay, masterData),
    announcements: new AnnouncementService(repositories.announcements),
    loginAssist: opts.loginAssist ?? null,
  };

  return { repositories, services, bus, clock: opts.clock, simulation: opts.simulation, mockDatabase: db };
}
