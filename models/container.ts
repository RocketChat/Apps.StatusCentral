import { StepEnum } from './../enums/step';
import { IIncidentModel } from './incident';

export interface IContainer {
    data: Partial<IIncidentModel>;
    step: StepEnum;
    userId: string;
    roomId: string;
}
