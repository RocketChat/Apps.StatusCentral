import { IncidenStatusEnum } from './../enums/incidentStatus';

export interface IIncidentUpdateModel {
    id: number;
    time: Date;
    status: IncidenStatusEnum;
    message: string;
}
