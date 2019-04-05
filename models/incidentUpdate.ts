import { IncidentStatusEnum } from './../enums/incidentStatus';

export interface IIncidentUpdateModel {
    id: number;
    time: Date;
    status: IncidentStatusEnum;
    message: string;
}
