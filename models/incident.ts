import { IncidentStatusEnum } from './enum/incident-status-enum';
import { IncidentUpdate } from './incident-update';
import { Service } from './service';

export class Incident {
    public static create(): Incident {
        return new Incident();
    }

    public id: number;
    public time: Date;
    public title: string;
    public status: IncidentStatusEnum;
    public services: Array<Partial<Service>>;
    public updates: Array<Partial<IncidentUpdate>>;
    public updatedAt: Date;

    public withId(value: number): Incident {
        this.id = value;
        return this;
    }

    public withTime(value: Date): Incident {
        this.time = value;
        return this;
    }

    public withTitle(value: string): Incident {
        this.title = value;
        return this;
    }

    public withStatus(value: IncidentStatusEnum): Incident {
        this.status = value;
        return this;
    }

    public withServices(value: Array<Partial<Service>>): Incident {
        this.services = value;
        return this;
    }

    public withUpdates(value: Array<Partial<IncidentUpdate>>): Incident {
        this.updates = value;
        return this;
    }

    public withUpdatedAt(value: Date): Incident {
        this.updatedAt = value;
        return this;
    }
}
