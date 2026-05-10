export class ScreeningCompletedEvent {
  constructor(
    public readonly applicationId: string,
    public readonly matchScore: number,
    public readonly recommendation: string,
    public readonly recruiterEmail: string,
  ) {}
}
