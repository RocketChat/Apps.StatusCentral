import { IncidentStatusEnum } from './enum/incident-status-enum';
import { Service } from './service';

export class IncidentUpdate {
    public id: number;
    public time: Date;
    public status: IncidentStatusEnum;
    public message: string;
    public services: Array<Partial<Service>>;

    public static create(): IncidentUpdate {
        return new IncidentUpdate();
    }

    public withId(value: number): IncidentUpdate {
        this.id = value;
        return this;
    }

    public withTime(value: Date): IncidentUpdate {
        this.time = value;
        return this;
    }

    public withStatus(value: IncidentStatusEnum): IncidentUpdate {
        this.status = value;
        return this;
    }

    public withMessage(value: string): IncidentUpdate {
        this.message = value;
        return this;
    }

    public withServices(value: Array<Partial<Service>>): IncidentUpdate {
        this.services = value;
        return this;
    }
}
