import { ServiceStatusEnum } from './enum/service-status-enum';

export class Service {
    public static create(): Service {
        return new Service();
    }

    public id: number;
    public name: string;
    public status: ServiceStatusEnum;
    public description: string;
    public group: string;
    public link: string;
    public tags: Array<string>;
    public enabled: boolean;
    public updatedAt: Date;

    public withId(value: number): Service {
        this.id = value;
        return this;
    }

    public withName(value: string): Service {
        this.name = value;
        return this;
    }

    public withStatus(value: ServiceStatusEnum): Service {
        this.status = value;
        return this;
    }

    public withDescription(value: string): Service {
        this.description = value;
        return this;
    }

    public withGroup(value: string): Service {
        this.group = value;
        return this;
    }

    public withLink(value: string): Service {
        this.link = value;
        return this;
    }

    public withTags(value: Array<string>): Service {
        this.tags = value;
        return this;
    }

    public withEnabled(value: boolean): Service {
        this.enabled = value;
        return this;
    }

    public withUpdatedAt(value: Date): Service {
        this.updatedAt = value;
        return this;
    }
}
