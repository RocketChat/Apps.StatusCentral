import { IIncidentUpdateModel } from './incidentUpdate';
import { IServiceModel } from './service';

export interface IIncidentModel {
    id: string;
    time: Date;
    title: string;
    status: string;
    services: Array<IServiceModel>;
    updates: Array<IIncidentUpdateModel>;
    updatedAt: Date;
}
