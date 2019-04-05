import { IncidentStatusEnum } from './../enums/incidentStatus';
import { IIncidentUpdateModel } from './incidentUpdate';
import { IServiceModel } from './service';

export interface IIncidentModel {
    id: number;
    time: Date;
    title: string;
    status: IncidentStatusEnum;
    services: Array<Partial<IServiceModel>>;
    updates: Array<Partial<IIncidentUpdateModel>>;
    updatedAt: Date;
}
