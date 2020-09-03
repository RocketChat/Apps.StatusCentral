
export class IncidentMaintenance {
    public static create(): IncidentMaintenance {
        return new IncidentMaintenance();
    }

    public start: Date;
    public end: Date;

    public withStart(value: Date): IncidentMaintenance {
        this.start = value;
        return this;
    }

    public withEnd(value: Date): IncidentMaintenance {
        this.end = value;
        return this;
    }
}
