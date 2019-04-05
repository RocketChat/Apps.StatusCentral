import { StepEnum } from './../enums/step';
import { IIncidentModel } from './incident';
import { IIncidentUpdateModel } from './incidentUpdate';

export interface IContainer {
    data: Partial<IIncidentModel>;
    update: Partial<IIncidentUpdateModel>;
    step: StepEnum;
    userId: string;
    roomId: string;
}
