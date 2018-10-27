import { ServiceStatusEnum } from './../enums/serviceStatus';

export interface IServiceModel {
    id: number;
    name: string;
    status: ServiceStatusEnum;
    description: string;
    group: string;
    link: string;
    tags: Array<string>;
    enabled: boolean;
    updatedAt: Date;
}
