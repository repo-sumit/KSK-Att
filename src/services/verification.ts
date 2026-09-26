/**
 * VerificationService — the full-screen module between batch selection and the
 * student list (PRD §8), reused unchanged for instructor self-attendance
 * (PRD §18.4). It checks location and face per configuration and records a
 * pass; the roster and submit both require that pass (INV-16).
 */
import type { SessionKey } from '@/domain/attendance';
import { err, ok, type Result } from '@/lib/result';
import { toLocalDate } from '@/lib/time';
import type { VerificationPass, VerificationRepository } from '@/repositories/interfaces';
import type { SessionContext } from './context';
import type { CapturedFrame, FaceCaptureService, FaceMatchError, FaceMatchService } from './face';
import { checkLocation, type LocationCheck, type LocationCheckError, type LocationProvider } from './location';
import type { PermissionState } from './simulation';

export type VerificationPurpose = { readonly kind: 'session'; readonly key: SessionKey } | { readonly kind: 'self' };

export const purposeKey = (p: VerificationPurpose) => (p.kind === 'self' ? 'self' : `session:${p.key}`);

export class VerificationService {
  constructor(
    private readonly passes: VerificationRepository,
    private readonly location: LocationProvider,
    private readonly camera: FaceCaptureService,
    private readonly faces: FaceMatchService,
  ) {}

  async hasPass(ctx: SessionContext, purpose: VerificationPurpose): Promise<boolean> {
    if (!ctx.journey.verification.required) return true;
    return Boolean(await this.passes.find(ctx.user.id, purposeKey(purpose), toLocalDate(ctx.clock.now())));
  }

  locationPermission(): Promise<PermissionState> {
    return this.location.permission();
  }
  requestLocationPermission(): Promise<PermissionState> {
    return this.location.requestPermission();
  }
  /** The camera itself is opened by the face screen (it needs the live preview); this only reads the permission. */
  cameraPermission(): Promise<PermissionState> {
    return this.camera.permission();
  }

  /** Geo-tagging captures silently; geo-fencing also enforces the radius. */
  async checkLocation(ctx: SessionContext): Promise<Result<LocationCheck, LocationCheckError | 'not_required'>> {
    const step = ctx.journey.verification.location;
    if (step === 'none') return err('not_required');
    return checkLocation(this.location, step === 'fence' ? 'fencing' : 'tagging', ctx.institute.location, ctx.config.verification.fenceRadiusM);
  }

  /** Matches the photo from the face check. Simulated in this build (MockFaceMatchService): no comparison happens. */
  async matchFace(ctx: SessionContext, frame: CapturedFrame): Promise<Result<true, FaceMatchError | 'not_required'>> {
    if (!ctx.journey.verification.face) return err('not_required');
    return this.faces.verify(ctx.user.id, frame);
  }

  async grant(ctx: SessionContext, purpose: VerificationPurpose, location?: LocationCheck): Promise<Result<VerificationPass, never>> {
    const pass: VerificationPass = {
      staffId: ctx.user.id,
      purpose: purposeKey(purpose),
      date: toLocalDate(ctx.clock.now()),
      grantedAt: ctx.clock.now().toISOString(),
      ...(location ? { location: location.location } : {}),
    };
    await this.passes.grant(pass);
    return ok(pass);
  }
}
