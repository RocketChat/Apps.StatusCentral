import { IIncidentUpdateModel } from './incidentUpdate';
import { IServiceModel } from './service';

export interface IIncidentModel {
    id: number;
    time: Date;
    title: string;
    status: string;
    services: Array<Partial<IServiceModel>>;
    updates: Array<Partial<IIncidentUpdateModel>>;
    updatedAt: Date;
}
