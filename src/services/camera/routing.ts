/**
 * Picks the real or the simulated camera per the SimulationSource (the demo
 * panel's "Camera: This device / Simulated"; production is always the device),
 * and routes each session to the matching liveness implementation.
 */
import type { CameraSession, FaceCaptureService, LivenessCallbacks, LivenessOptions, LivenessPurpose, LivenessService } from '../face';
import type { SimulationSource } from '../simulation';

export class SwitchableFaceCapture implements FaceCaptureService {
  constructor(
    private readonly sim: SimulationSource,
    private readonly device: FaceCaptureService,
    private readonly simulated: FaceCaptureService,
  ) {}
  private get current() {
    return this.sim.get().camera === 'simulated' ? this.simulated : this.device;
  }
  source() {
    return this.current.source();
  }
  permission() {
    return this.current.permission();
  }
  open() {
    return this.current.open();
  }
}

export class RoutedLiveness implements LivenessService {
  constructor(
    private readonly device: LivenessService,
    private readonly simulated: LivenessService,
  ) {}
  run(session: CameraSession, video: HTMLVideoElement | null, purpose: LivenessPurpose, callbacks: LivenessCallbacks, signal: AbortSignal, options?: LivenessOptions) {
    return (session.kind === 'simulated' ? this.simulated : this.device).run(session, video, purpose, callbacks, signal, options);
  }
}
