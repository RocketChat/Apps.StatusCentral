import { IncidentStatusEnum } from '../enums/incidentStatus';

export class IncidentUpdate {
    id: number;
    time: Date;
    status: IncidentStatusEnum;
    message: string;
}
