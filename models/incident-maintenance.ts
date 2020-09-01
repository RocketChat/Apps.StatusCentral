
export class IncidentMaintenance {
    public static create(): IncidentMaintenance {
        return new IncidentMaintenance();
    }

    public start: number;
    public end: number;

    public withStart(value: number): IncidentMaintenance {
        this.start = value;
        return this;
    }

    public withEnd(value: number): IncidentMaintenance {
        this.end = value;
        return this;
    }
}
