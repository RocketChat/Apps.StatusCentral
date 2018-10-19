import { IncidenStatusEnum } from './../enums/incidentStatus';

export interface IIncidentUpdateModel {
    id: string;
    time: Date;
    status: IncidenStatusEnum;
    message: string;
}
